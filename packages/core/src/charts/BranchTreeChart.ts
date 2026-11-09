import { stratify, tree, type HierarchyPointNode } from 'd3-hierarchy';
import { scaleSqrt } from 'd3-scale';
import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import { BaseChart } from '../core/BaseChart';
import type { ChartEnvironment } from '../core/ChartEnvironment';
import {
  generateBranchSkeleton,
  generateStemPath,
  hashStringToSeed,
  interpolateBranchParams,
  polarToCartesian,
} from '../geometry/OrganicGeometry';
import type {
  BranchGeometryParams,
  BranchTreeChartConfig,
  ChartDimensions,
  Point2D,
} from '../types';

interface LeafInstanceDatum {
  readonly key: string;
  readonly angleOffsetDeg: number;
}

interface ComputedBranchDatum<TData> {
  readonly key: string;
  readonly raw: TData;
  readonly depth: number;
  readonly isLeaf: boolean;
  readonly label: string;
  readonly value: number;
  readonly foliageColor: string;
  readonly leaves: readonly LeafInstanceDatum[];
  readonly leafScale: number;
  readonly params: BranchGeometryParams;
  readonly from: BranchGeometryParams;
}

const LEAF_SYMBOL_LENGTH = 21;

function unit(dx: number, dy: number): Point2D {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** Estado colapsado (yema) en un punto: punto de partida de ramas que brotan */
function budAt(point: Point2D, params: BranchGeometryParams): BranchGeometryParams {
  return {
    ...params,
    x0: point.x,
    y0: point.y,
    x1: point.x,
    y1: point.y,
    baseThickness: params.baseThickness * 0.3,
    tipThickness: 0.2,
  };
}

/**
 * Gráfico jerárquico arbóreo (`BranchTreeChart`).
 * Una jerarquía (tabla id / parentId) crece como un árbol: el fuste es la raíz, cada nodo
 * es una rama leñosa curvada y ahusada, y los nodos terminales brotan racimos de hojas `<use>`.
 * El grosor sigue el modelo de tuberías (regla de da Vinci): el área de la sección es
 * proporcional al peso acumulado del subárbol, por lo que grosor ∝ √valor.
 */
export class BranchTreeChart<TData> extends BaseChart<
  TData,
  BranchTreeChartConfig<TData>
> {
  private groundPath!: Selection<SVGPathElement, unknown, null, undefined>;
  private branchesGroup!: Selection<SVGGElement, unknown, null, undefined>;
  private trunkPath!: Selection<SVGPathElement, unknown, null, undefined>;

  private readonly previousParams = new Map<string, BranchGeometryParams>();
  private previousTrunk: BranchGeometryParams | null = null;

  constructor(environment: ChartEnvironment, config: BranchTreeChartConfig<TData>) {
    super(environment, config);
  }

  protected onInit(): void {
    this.groundPath = this.chartGroup
      .append('path')
      .attr('class', 'tree-ground')
      .attr('fill', 'none')
      .attr('stroke', this.env.palette.axis)
      .attr('stroke-width', 1.6)
      .attr('stroke-linecap', 'round')
      .attr('opacity', 0.6);

    this.branchesGroup = this.chartGroup.append('g').attr('class', 'tree-branches');

    this.trunkPath = this.chartGroup
      .append('path')
      .attr('class', 'tree-trunk')
      .attr('fill', this.env.palette.axis)
      .attr('stroke', '#3A2E21')
      .attr('stroke-width', 0.8)
      .attr('filter', `url(#${this.env.defsIds.dropShadowId})`);
  }

  protected onResize(_dimensions: ChartDimensions): void {
    // La geometría completa se recalcula en onUpdate (invocado por BaseChart.resize)
  }

  protected onUpdate(data: readonly TData[], dimensions: ChartDimensions): void {
    const {
      keyAccessor,
      parentAccessor,
      valueAccessor,
      labelAccessor,
      colorAccessor,
      trunkThickness = 22,
      minBranchThickness = 1.4,
      spreadAngle = Math.PI * 0.62,
      trunkRatio = 0.26,
      gnarl = 5,
      showLabels = true,
    } = this.config;

    const { innerWidth: W, innerHeight: H } = dimensions;
    const { duration, ease } = this.transitionConfig;
    const palette = this.env.palette;

    // 1. Jerarquía (stratify) y pesos acumulados por subárbol
    const indexOf = new Map<TData, number>(data.map((d, i) => [d, i]));
    const parentKey = (d: TData, i: number): string | null => {
      const p = parentAccessor(d, i);
      return p === null || p === undefined ? null : String(p);
    };
    const parentIds = new Set(data.map((d, i) => parentKey(d, i)));

    const root =
      data.length > 0
        ? stratify<TData>()
            .id((d, i) => String(keyAccessor(d, i)))
            .parentId((d, i) => parentKey(d, i))([...data])
        : null;

    if (!root) {
      this.renderBranches([], duration, ease);
      return;
    }

    root.sum((d) => {
      const i = indexOf.get(d) ?? 0;
      if (parentIds.has(String(keyAccessor(d, i)))) return 0;
      return valueAccessor ? Math.max(0, valueAccessor(d, i)) : 1;
    });

    const spread = Math.min(Math.PI, Math.max(0.2, spreadAngle));
    const layoutRoot = tree<TData>()
      .size([spread, 1])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.5))(root);

    // 2. Geometría global: base del fuste, horquilla y radio de copa
    const base: Point2D = { x: W * 0.5, y: H - 6 };
    const trunkLength = H * trunkRatio;
    const fork: Point2D = { x: base.x, y: base.y - trunkLength };
    const crownRadius = Math.max(
      20,
      Math.min(
        H - trunkLength - 30,
        (W * 0.5 - 50) / Math.max(0.35, Math.sin(Math.min(spread / 2, Math.PI / 2)))
      )
    );

    const positionOf = (node: HierarchyPointNode<TData>): Point2D =>
      node.depth === 0
        ? fork
        : polarToCartesian(fork.x, fork.y, node.y * crownRadius, node.x - spread / 2);

    const totalValue = root.value ?? 0;
    const thicknessScale = scaleSqrt()
      .domain([0, Math.max(1e-6, totalValue)])
      .range([minBranchThickness, trunkThickness]);
    const thicknessOf = (node: HierarchyPointNode<TData>): number =>
      thicknessScale(node.value ?? 0);

    const leafNodes = layoutRoot.leaves();
    const maxLeafValue = Math.max(1e-6, ...leafNodes.map((n) => n.value ?? 0));
    const leafScaleOf = scaleSqrt().domain([0, maxLeafValue]).range([0.55, 1.35]);

    // 3. Fuste (raíz de la jerarquía)
    const trunkParams: BranchGeometryParams = {
      x0: base.x,
      y0: base.y,
      x1: fork.x,
      y1: fork.y,
      startAngleDeg: -90,
      baseThickness: trunkThickness * 1.3,
      tipThickness: thicknessOf(layoutRoot),
      gnarl: 2,
      seed: hashStringToSeed(layoutRoot.id ?? 'trunk'),
    };
    const trunkFrom = this.previousTrunk ?? budAt(base, trunkParams);
    this.previousTrunk = trunkParams;

    this.trunkPath
      .transition()
      .duration(duration)
      .ease(ease)
      .tween('trunk-growth', () => (t: number) => {
        this.trunkPath.attr(
          'd',
          generateBranchSkeleton(interpolateBranchParams(trunkFrom, trunkParams, t)).bodyPath
        );
      });

    this.groundPath.attr(
      'd',
      generateStemPath({
        points: [
          { x: base.x - Math.min(W * 0.32, 160), y: base.y },
          { x: base.x + Math.min(W * 0.32, 160), y: base.y },
        ],
        roughness: 1.6,
        seed: 0.21,
      })
    );

    // 4. Descriptores por rama, en orden BFS para resolver el estado "from" de madre a hija
    const fromByKey = new Map<string, BranchGeometryParams>();
    const branches: ComputedBranchDatum<TData>[] = [];
    const rootFromApex: Point2D = { x: trunkFrom.x1, y: trunkFrom.y1 };

    for (const node of layoutRoot.descendants()) {
      if (!node.parent) continue;
      const key = node.id ?? '';
      const parent = node.parent;
      const p = positionOf(parent);
      const c = positionOf(node);

      // Dirección heredada: mezcla de la dirección de la madre y la dirección hacia la hija
      const grand = parent.parent ? positionOf(parent.parent) : base;
      const parentDir = unit(p.x - grand.x, p.y - grand.y);
      const childDir = unit(c.x - p.x, c.y - p.y);
      const startDir = unit(
        parentDir.x * 0.55 + childDir.x * 0.45,
        parentDir.y * 0.55 + childDir.y * 0.45
      );

      const isLeaf = !node.children || node.children.length === 0;
      const params: BranchGeometryParams = {
        x0: p.x,
        y0: p.y,
        x1: c.x,
        y1: c.y,
        startAngleDeg: (Math.atan2(startDir.y, startDir.x) * 180) / Math.PI,
        baseThickness: thicknessOf(node),
        // Continuidad del modelo de tuberías: el ápice iguala a la hija más gruesa
        tipThickness: isLeaf
          ? minBranchThickness
          : Math.max(...(node.children ?? []).map(thicknessOf)),
        gnarl: Math.min(gnarl, Math.hypot(c.x - p.x, c.y - p.y) * 0.08),
        seed: hashStringToSeed(key),
      };

      const parentFrom = parent.parent ? fromByKey.get(parent.id ?? '') : undefined;
      const parentFromApex: Point2D = parentFrom
        ? { x: parentFrom.x1, y: parentFrom.y1 }
        : rootFromApex;
      const from = this.previousParams.get(key) ?? budAt(parentFromApex, params);
      fromByKey.set(key, from);

      const datumIndex = indexOf.get(node.data) ?? 0;
      const topAncestor = node.ancestors().find((a) => a.depth === 1) ?? node;
      const topIndex = layoutRoot.children?.indexOf(topAncestor) ?? 0;
      const value = node.value ?? 0;
      const leafCount = isLeaf ? Math.round(2 + Math.min(3, (value / maxLeafValue) * 3)) : 0;

      branches.push({
        key,
        raw: node.data,
        depth: node.depth,
        isLeaf,
        label: labelAccessor ? labelAccessor(node.data, datumIndex) : key,
        value,
        foliageColor: colorAccessor
          ? colorAccessor(node.data, datumIndex)
          : palette.foliage[Math.max(0, topIndex) % palette.foliage.length],
        leaves: Array.from({ length: leafCount }, (_, k) => ({
          key: `${key}-leaf-${k}`,
          angleOffsetDeg: (k - (leafCount - 1) / 2) * 34,
        })),
        leafScale: leafScaleOf(value),
        params,
        from,
      });
    }

    this.previousParams.clear();
    for (const b of branches) this.previousParams.set(b.key, b.params);

    this.renderBranches(branches, duration, ease, showLabels);
  }

  private renderBranches(
    branches: readonly ComputedBranchDatum<TData>[],
    duration: number,
    ease: (t: number) => number,
    showLabels = true
  ): void {
    const leafHref = `#${this.env.defsIds.leafSymbolId}`;

    const groups = this.branchesGroup
      .selectAll<SVGGElement, ComputedBranchDatum<TData>>('g.branch-item')
      .data(branches, (d) => d.key)
      .join(
        (enter) => {
          const g = enter.append('g').attr('class', 'branch-item').attr('opacity', 0);
          g.append('path')
            .attr('class', 'branch-body')
            .attr('fill', this.env.palette.axis)
            .attr('stroke', '#3A2E21')
            .attr('stroke-width', 0.5);
          g.append('g').attr('class', 'branch-foliage');
          g.append('text')
            .attr('class', 'branch-label')
            .attr('font-size', '10.5px')
            .attr('dy', '0.35em')
            .attr('fill', this.env.palette.text)
            .attr('stroke', this.env.palette.background)
            .attr('stroke-width', 2.5)
            .attr('paint-order', 'stroke');
          g.append('title');
          return g;
        },
        (update) => update,
        (exit) =>
          exit
            .each((d) => this.previousParams.delete(d.key))
            .transition()
            .duration(duration * 0.5)
            .ease(ease)
            .attr('opacity', 0)
            .remove()
      )
      // Las ramas madre se pintan encima de sus hijas para ocultar las uniones
      .sort((a, b) => b.depth - a.depth);

    groups.select('title').text((d) => `${d.label}: ${d.value}`);

    groups
      .transition()
      .duration(duration)
      .ease(ease)
      .attr('opacity', 1)
      .tween('branch-growth', (d, i, nodes) => {
        const groupEl = select(nodes[i]);
        const bodyEl = groupEl.select<SVGPathElement>('path.branch-body');
        const foliageEl = groupEl.select<SVGGElement>('g.branch-foliage');
        const labelEl = groupEl.select<SVGTextElement>('text.branch-label');

        return (t: number) => {
          const skeleton = generateBranchSkeleton(interpolateBranchParams(d.from, d.params, t));
          const { apex } = skeleton;
          bodyEl.attr('d', skeleton.bodyPath);

          const scale = d.leafScale * Math.min(1, t * 1.3);
          foliageEl
            .selectAll<SVGUseElement, LeafInstanceDatum>('use.branch-leaf')
            .data(d.leaves, (leaf) => leaf.key)
            .join('use')
            .attr('class', 'branch-leaf')
            .attr('href', leafHref)
            .style('color', d.foliageColor)
            .attr(
              'transform',
              (leaf) =>
                `translate(${apex.x}, ${apex.y}) rotate(${apex.angleDeg + leaf.angleOffsetDeg}) scale(${scale})`
            );

          if (!d.isLeaf || !showLabels) {
            labelEl.text('');
            return;
          }
          const rad = (apex.angleDeg * Math.PI) / 180;
          const reach = LEAF_SYMBOL_LENGTH * d.leafScale + 6;
          const dirX = Math.cos(rad);
          labelEl
            .attr('x', apex.x + dirX * reach)
            .attr('y', apex.y + Math.sin(rad) * reach)
            .attr('text-anchor', dirX > 0.3 ? 'start' : dirX < -0.3 ? 'end' : 'middle')
            .attr('opacity', t)
            .text(d.label);
        };
      });
  }

  protected override onDestroy(): void {
    this.previousParams.clear();
    this.previousTrunk = null;
  }
}
