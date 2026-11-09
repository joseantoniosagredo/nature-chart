import { extent, max } from 'd3-array';
import { scaleLinear, scaleSqrt } from 'd3-scale';
import type { Selection } from 'd3-selection';
import 'd3-transition';
import { AxisHelper } from '../core/AxisHelper';
import { BaseChart } from '../core/BaseChart';
import type { ChartEnvironment } from '../core/ChartEnvironment';
import { hashStringToSeed } from '../geometry/OrganicGeometry';
import type { ChartDimensions, LeafScatterChartConfig } from '../types';

/** Parámetros de posición y forma de una hoja (espacio de interpolación) */
interface LeafPose {
  readonly x: number;
  readonly y: number;
  readonly angleDeg: number;
  readonly scale: number;
}

interface ComputedLeafDatum<TData> {
  readonly key: string | number;
  readonly raw: TData;
  readonly color: string;
  readonly title: string;
  readonly pose: LeafPose;
}

/** Desplazamiento que centra el limbo del símbolo de hoja (pecíolo en 0, ápice en ~21) */
const LEAF_CENTER_OFFSET = -10.5;

function poseTransform(p: LeafPose): string {
  return `translate(${p.x}, ${p.y}) rotate(${p.angleDeg}) scale(${p.scale}) translate(${LEAF_CENTER_OFFSET}, 0)`;
}

function lerpPose(a: LeafPose, b: LeafPose, t: number): LeafPose {
  const inv = 1 - t;
  return {
    x: a.x * inv + b.x * t,
    y: a.y * inv + b.y * t,
    angleDeg: a.angleDeg * inv + b.angleDeg * t,
    scale: a.scale * inv + b.scale * t,
  };
}

/**
 * Diagrama de dispersión foliar (`LeafScatterChart`).
 * Cada observación es una hoja instanciada vía `<use href="#...-leaf">` centrada en (x, y):
 * el área foliar codifica una métrica de tamaño, el pigmento codifica el grupo / especie
 * y la orientación del limbo puede codificar una cuarta variable.
 */
export class LeafScatterChart<TData> extends BaseChart<
  TData,
  LeafScatterChartConfig<TData>
> {
  private readonly axisHelper: AxisHelper;
  private xAxisGroup!: Selection<SVGGElement, unknown, null, undefined>;
  private yAxisGroup!: Selection<SVGGElement, unknown, null, undefined>;
  private leavesGroup!: Selection<SVGGElement, unknown, null, undefined>;
  private legendGroup!: Selection<SVGGElement, unknown, null, undefined>;

  private readonly previousPose = new Map<string | number, LeafPose>();

  constructor(environment: ChartEnvironment, config: LeafScatterChartConfig<TData>) {
    super(environment, config);
    this.axisHelper = new AxisHelper(environment);
  }

  protected onInit(): void {
    const dims = this.env.getDimensions();
    this.xAxisGroup = this.env.axisLayer
      .append('g')
      .attr('class', 'leaf-axis-x')
      .attr('transform', `translate(0, ${dims.innerHeight})`);
    this.yAxisGroup = this.env.axisLayer.append('g').attr('class', 'leaf-axis-y');
    this.leavesGroup = this.chartGroup.append('g').attr('class', 'leaf-scatter');
    this.legendGroup = this.chartGroup.append('g').attr('class', 'leaf-legend');
  }

  protected onResize(dimensions: ChartDimensions): void {
    this.xAxisGroup.attr('transform', `translate(0, ${dimensions.innerHeight})`);
  }

  protected onUpdate(data: readonly TData[], dimensions: ChartDimensions): void {
    const {
      keyAccessor,
      xAccessor,
      yAccessor,
      sizeAccessor,
      groupAccessor,
      colorAccessor,
      angleAccessor,
      labelAccessor,
      leafScaleRange = [0.6, 1.9],
      xDomain,
      yDomain,
      xLabel,
      yLabel,
    } = this.config;

    const xExt = extent(data, (d, i) => xAccessor(d, i));
    const yExt = extent(data, (d, i) => yAccessor(d, i));
    const pad = (lo: number, hi: number): [number, number] => {
      const span = hi - lo || Math.abs(hi) || 1;
      return [lo - span * 0.06, hi + span * 0.06];
    };

    const xScale = scaleLinear()
      .domain(xDomain ? [xDomain[0], xDomain[1]] : pad(xExt[0] ?? 0, xExt[1] ?? 1))
      .range([0, dimensions.innerWidth])
      .nice();
    const yScale = scaleLinear()
      .domain(yDomain ? [yDomain[0], yDomain[1]] : pad(yExt[0] ?? 0, yExt[1] ?? 1))
      .range([dimensions.innerHeight, 0])
      .nice();

    const maxSize = sizeAccessor ? max(data, (d, i) => sizeAccessor(d, i)) ?? 1 : 1;
    const sizeScale = scaleSqrt()
      .domain([0, Math.max(1e-6, maxSize)])
      .range([leafScaleRange[0], leafScaleRange[1]])
      .clamp(true);

    // Pigmento estable por grupo, en orden de aparición
    // Un verde y después pigmentos de pétalo: los verdes de la paleta son demasiado parecidos entre sí
    const pigments = [
      this.env.palette.foliage[0],
      ...this.env.palette.petals,
      ...this.env.palette.foliage.slice(1),
    ];
    const groupIndex = new Map<string, number>();

    const { duration, delayPerItem, ease } = this.transitionConfig;

    this.axisHelper.renderAxis(
      this.xAxisGroup,
      { scale: xScale, orientation: 'bottom', tickStyle: 'node', label: xLabel, seed: 0.13 },
      duration
    );
    this.axisHelper.renderAxis(
      this.yAxisGroup,
      { scale: yScale, orientation: 'left', tickStyle: 'leaf', label: yLabel, seed: 0.57 },
      duration
    );

    const leaves: ComputedLeafDatum<TData>[] = data.map((d, i) => {
      const key = keyAccessor(d, i);
      const seed = hashStringToSeed(key);
      let color = this.env.palette.foliage[0];
      if (colorAccessor) {
        color = colorAccessor(d, i);
      } else if (groupAccessor) {
        const group = groupAccessor(d, i);
        if (!groupIndex.has(group)) groupIndex.set(group, groupIndex.size);
        color = pigments[(groupIndex.get(group) ?? 0) % pigments.length];
      }
      return {
        key,
        raw: d,
        color,
        title: labelAccessor ? labelAccessor(d, i) : String(key),
        pose: {
          x: xScale(xAccessor(d, i)),
          y: yScale(yAccessor(d, i)),
          // Inclinación determinista hacia arriba (-125° … -55°) si no se codifica una variable
          angleDeg: angleAccessor ? angleAccessor(d, i) : -90 + (seed - 0.5) * 70,
          scale: sizeAccessor ? sizeScale(sizeAccessor(d, i)) : 1,
        },
      };
    });

    const fromPose = new Map(this.previousPose);
    this.previousPose.clear();
    for (const leaf of leaves) this.previousPose.set(leaf.key, leaf.pose);

    this.leavesGroup
      .selectAll<SVGUseElement, ComputedLeafDatum<TData>>('use.scatter-leaf')
      .data(leaves, (d) => d.key)
      .join(
        (enter) => {
          const use = enter
            .append('use')
            .attr('class', 'scatter-leaf')
            .attr('href', `#${this.env.defsIds.leafSymbolId}`)
            .attr('opacity', 0)
            .attr('transform', (d) => poseTransform({ ...d.pose, scale: 0.01 }));
          use.append('title');
          return use;
        },
        (update) => update,
        (exit) =>
          exit
            .transition()
            .duration(duration * 0.5)
            .ease(ease)
            .attr('opacity', 0)
            .attrTween('transform', (d) => (t: number) =>
              poseTransform(lerpPose(d.pose, { ...d.pose, scale: 0.01 }, t))
            )
            .remove()
      )
      .style('color', (d) => d.color)
      .call((sel) => sel.select('title').text((d) => d.title))
      .transition()
      .duration(duration)
      .delay((d, i) => (fromPose.has(d.key) ? 0 : i * delayPerItem * 0.4))
      .ease(ease)
      .attr('opacity', 0.9)
      .attrTween('transform', (d) => {
        const from = fromPose.get(d.key) ?? { ...d.pose, scale: 0.01 };
        return (t: number) => poseTransform(lerpPose(from, d.pose, t));
      });

    // Leyenda de grupos (solo cuando el color lo asigna `groupAccessor`)
    const legendData = colorAccessor
      ? []
      : Array.from(groupIndex, ([name, idx]) => ({
          name,
          color: pigments[idx % pigments.length],
        }));

    this.legendGroup
      .attr('transform', 'translate(14, 6)')
      .selectAll<SVGGElement, { name: string; color: string }>('g.leaf-legend-item')
      .data(legendData, (d) => d.name)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'leaf-legend-item');
        g.append('use')
          .attr('href', `#${this.env.defsIds.leafSymbolId}`)
          .attr('transform', 'rotate(-35) scale(0.55)');
        g.append('text')
          .attr('x', 16)
          .attr('dy', '-0.1em')
          .attr('font-size', '11px')
          .attr('font-style', 'italic')
          .attr('fill', this.env.palette.text);
        return g;
      })
      .attr('transform', (_, i) => `translate(0, ${i * 18 + 10})`)
      .style('color', (d) => d.color)
      .call((sel) => sel.select('text').text((d) => d.name));
  }

  protected override onDestroy(): void {
    this.xAxisGroup?.remove();
    this.yAxisGroup?.remove();
    this.previousPose.clear();
  }
}
