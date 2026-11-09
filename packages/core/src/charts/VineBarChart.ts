import { max } from 'd3-array';
import { scaleBand, scaleLinear } from 'd3-scale';
import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import { AxisHelper } from '../core/AxisHelper';
import { BaseChart } from '../core/BaseChart';
import type { ChartEnvironment } from '../core/ChartEnvironment';
import {
  generateTendrilPath,
  generateVineSkeleton,
  hashStringToSeed,
  interpolateVineParams,
} from '../geometry/OrganicGeometry';
import type {
  ChartDimensions,
  OrientedPoint2D,
  VineBarChartConfig,
  VineGeometryParams,
} from '../types';

interface LeafInstanceDatum {
  readonly key: string;
  readonly node: OrientedPoint2D;
  readonly scale: number;
  readonly color: string;
}

interface ComputedVineDatum<TData> {
  readonly key: string | number;
  readonly raw: TData;
  readonly category: string;
  readonly primaryValue: number;
  readonly foliageValue: number;
  readonly tendrilValue: number;
  readonly leafCount: number;
  readonly leafScale: number;
  readonly tendrilCoils: number;
  readonly tendrilLength: number;
  readonly stemColor: string;
  readonly params: VineGeometryParams;
}

/**
 * Gráfico de barras botánico (`VineBarChart`).
 * Sustituye las barras rectangulares por tallos/enredaderas ahusadas con oscilación
 * armónica, hojas instanciadas eficientemente vía `<use>` (métrica secundaria)
 * y zarcillos espirales en el ápice (métrica terciaria).
 */
export class VineBarChart<TData> extends BaseChart<
  TData,
  VineBarChartConfig<TData>
> {
  private readonly axisHelper: AxisHelper;
  private xAxisGroup!: Selection<SVGGElement, unknown, null, undefined>;
  private yAxisGroup!: Selection<SVGGElement, unknown, null, undefined>;
  private vinesContainer!: Selection<SVGGElement, unknown, null, undefined>;

  /** Memoria de parámetros geométricos previos por clave para interpolación orgánica */
  private readonly previousVineParams = new Map<string | number, VineGeometryParams>();

  constructor(environment: ChartEnvironment, config: VineBarChartConfig<TData>) {
    super(environment, config);
    this.axisHelper = new AxisHelper(environment);
  }

  protected onInit(): void {
    const dims = this.env.getDimensions();

    this.xAxisGroup = this.env.axisLayer
      .append('g')
      .attr('class', 'vine-axis-x')
      .attr('transform', `translate(0, ${dims.innerHeight})`);

    this.yAxisGroup = this.env.axisLayer
      .append('g')
      .attr('class', 'vine-axis-y');

    this.vinesContainer = this.chartGroup
      .append('g')
      .attr('class', 'vines-collection');
  }

  protected onResize(dimensions: ChartDimensions): void {
    this.xAxisGroup.attr('transform', `translate(0, ${dimensions.innerHeight})`);
  }

  protected onUpdate(data: readonly TData[], dimensions: ChartDimensions): void {
    const {
      keyAccessor,
      categoryAccessor,
      primaryValueAccessor,
      foliageValueAccessor,
      tendrilValueAccessor,
      colorAccessor,
      baseThickness = 14,
      tipThickness = 2.6,
      swayAmplitude = 9,
      swayFrequency = 1.5,
      paddingInner = 0.36,
      yDomain,
    } = this.config;

    const categories = data.map((d, i) => categoryAccessor(d, i));
    const maxPrimary = max(data, (d, i) => primaryValueAccessor(d, i)) ?? 100;
    const computedYDomain: [number, number] = yDomain
      ? [yDomain[0], yDomain[1]]
      : [0, Math.max(1, maxPrimary * 1.12)];

    // 1. Escalas D3
    const xScale = scaleBand<string>()
      .domain(categories)
      .range([0, dimensions.innerWidth])
      .paddingInner(paddingInner)
      .paddingOuter(0.2);

    const yScale = scaleLinear()
      .domain(computedYDomain)
      .range([dimensions.innerHeight, 0])
      .nice();

    // Escalas para métricas secundarias (hojas) y terciarias (zarcillos)
    const maxFoliage = foliageValueAccessor
      ? max(data, (d, i) => foliageValueAccessor(d, i)) ?? 1
      : 1;
    const leafCountScale = scaleLinear()
      .domain([0, Math.max(1e-6, maxFoliage)])
      .range([2, 7])
      .clamp(true);
    const leafSizeScale = scaleLinear()
      .domain([0, Math.max(1e-6, maxFoliage)])
      .range([0.65, 1.25])
      .clamp(true);

    const maxTendril = tendrilValueAccessor
      ? max(data, (d, i) => tendrilValueAccessor(d, i)) ?? 1
      : 1;
    const tendrilCoilScale = scaleLinear()
      .domain([0, Math.max(1e-6, maxTendril)])
      .range([1.2, 3.2])
      .clamp(true);

    const { duration, delayPerItem, ease } = this.transitionConfig;

    // 2. Renderizado de Ejes Botánicos con AxisHelper
    this.axisHelper.renderAxis(
      this.xAxisGroup,
      {
        scale: xScale,
        orientation: 'bottom',
        tickStyle: 'node',
        stemRoughness: 2.4,
        seed: 0.31,
      },
      duration
    );

    this.axisHelper.renderAxis(
      this.yAxisGroup,
      {
        scale: yScale,
        orientation: 'left',
        tickCount: 6,
        tickStyle: 'thorn',
        stemRoughness: 2.8,
        seed: 0.77,
      },
      duration
    );

    // 3. Construcción de descriptores geométricos por enredadera
    const bandwidth = xScale.bandwidth();
    const adaptiveBaseWidth = Math.min(baseThickness, Math.max(5, bandwidth * 0.42));
    const baselineY = yScale(computedYDomain[0]);

    const computedVines: ComputedVineDatum<TData>[] = data.map((datum, i) => {
      const key = keyAccessor(datum, i);
      const category = categoryAccessor(datum, i);
      const primaryValue = primaryValueAccessor(datum, i);
      const foliageValue = foliageValueAccessor
        ? foliageValueAccessor(datum, i)
        : primaryValue;
      const tendrilValue = tendrilValueAccessor
        ? tendrilValueAccessor(datum, i)
        : primaryValue;

      const centerX = (xScale(category) ?? 0) + bandwidth * 0.5;
      const targetY = yScale(primaryValue);
      const seed = hashStringToSeed(key);

      const params: VineGeometryParams = {
        startX: centerX,
        startY: baselineY,
        endX: centerX,
        endY: targetY,
        baseThickness: adaptiveBaseWidth,
        tipThickness,
        swayAmplitude: Math.min(swayAmplitude, bandwidth * 0.35),
        swayFrequency,
        seed,
        segments: 16,
      };

      return {
        key,
        raw: datum,
        category,
        primaryValue,
        foliageValue,
        tendrilValue,
        leafCount: Math.round(leafCountScale(foliageValue)),
        leafScale: leafSizeScale(foliageValue),
        tendrilCoils: tendrilCoilScale(tendrilValue),
        tendrilLength: Math.min(34, 14 + tendrilCoilScale(tendrilValue) * 6),
        stemColor: colorAccessor
          ? colorAccessor(datum, i)
          : `url(#${this.env.defsIds.stemGradientId})`,
        params,
      };
    });

    // 4. Data Join principal de enredaderas (`g.vine-item`)
    const vineGroups = this.vinesContainer
      .selectAll<SVGGElement, ComputedVineDatum<TData>>('g.vine-item')
      .data(computedVines, (d) => d.key)
      .join(
        (enter) => {
          const g = enter
            .append('g')
            .attr('class', 'vine-item')
            .style('will-change', 'transform, opacity')
            .attr('opacity', 0);

          // Cuerpo principal ahusado de la enredadera
          g.append('path')
            .attr('class', 'vine-body')
            .attr('fill', (d) => d.stemColor)
            .attr('stroke', this.env.palette.stems[0])
            .attr('stroke-width', 0.9)
            .attr('filter', `url(#${this.env.defsIds.dropShadowId})`);

          // Haz vascular central
          g.append('path')
            .attr('class', 'vine-centerline')
            .attr('fill', 'none')
            .attr('stroke', '#A3C18A')
            .attr('stroke-width', 0.8)
            .attr('stroke-linecap', 'round')
            .attr('opacity', 0.55);

          // Zarcillo espiral en el ápice
          g.append('path')
            .attr('class', 'vine-tendril')
            .attr('fill', 'none')
            .attr('stroke', this.env.palette.foliage[0])
            .attr('stroke-width', 1.25)
            .attr('stroke-linecap', 'round');

          // Contenedor de hojas (<use>)
          g.append('g').attr('class', 'vine-foliage');

          // Etiqueta numérica sobre el ápice
          g.append('text')
            .attr('class', 'vine-value-label')
            .attr('fill', this.env.palette.text)
            .attr('font-size', '11px')
            .attr('text-anchor', 'middle')
            .attr('opacity', 0.85);

          // Estado semilla inicial (brote a ras de suelo en baselineY)
          g.each((d) => {
            if (!this.previousVineParams.has(d.key)) {
              this.previousVineParams.set(d.key, {
                ...d.params,
                endY: d.params.startY - 2,
                swayAmplitude: 0,
              });
            }
          });

          return g;
        },
        (update) => update,
        (exit) =>
          exit
            .each((d) => {
              this.previousVineParams.delete(d.key);
            })
            .transition()
            .duration(duration * 0.6)
            .ease(ease)
            .attr('opacity', 0)
            .remove()
      );

    // 5. Transición unificada con `.tween('vine-growth')` para sincronizar tallo, hojas y zarcillo
    vineGroups
      .interrupt()
      .transition()
      .duration(duration)
      .delay((_, i) => i * delayPerItem)
      .ease(ease)
      .attr('opacity', 1)
      .tween('vine-growth', (d, i, groupNodes) => {
        const groupEl = select(groupNodes[i]);
        const bodyPathEl = groupEl.select<SVGPathElement>('path.vine-body');
        const centerPathEl = groupEl.select<SVGPathElement>('path.vine-centerline');
        const tendrilPathEl = groupEl.select<SVGPathElement>('path.vine-tendril');
        const foliageGroupEl = groupEl.select<SVGGElement>('g.vine-foliage');
        const valueLabelEl = groupEl.select<SVGTextElement>('text.vine-value-label');

        const fromParams = this.previousVineParams.get(d.key) ?? d.params;
        this.previousVineParams.set(d.key, d.params);

        return (t: number) => {
          const currentParams = interpolateVineParams(fromParams, d.params, t);
          const skeleton = generateVineSkeleton(currentParams);

          bodyPathEl.attr('d', skeleton.bodyPath).attr('fill', d.stemColor);
          centerPathEl.attr('d', skeleton.centerlinePath);

          // Zarcillo espiral emergiendo del ápice
          const tendrilD = generateTendrilPath({
            origin: { x: skeleton.apex.x, y: skeleton.apex.y },
            angleDeg: skeleton.apex.angleDeg,
            length: d.tendrilLength * t,
            coils: d.tendrilCoils,
            chirality: d.params.seed >= 0.5 ? 1 : -1,
          });
          tendrilPathEl.attr('d', tendrilD);

          // Selección de nudos activos para las hojas (<use>)
          const activeNodes = skeleton.nodes.slice(0, d.leafCount);
          const leafInstances: LeafInstanceDatum[] = activeNodes.map((node, nodeIdx) => ({
            key: `${d.key}-leaf-${nodeIdx}`,
            node,
            // Hojas ligeramente más pequeñas hacia el ápice (acrotonía/basitonía)
            scale: d.leafScale * (1 - node.t * 0.28) * Math.min(1, t * 1.25),
            color:
              this.env.palette.foliage[
                (i + nodeIdx) % this.env.palette.foliage.length
              ],
          }));

          foliageGroupEl
            .selectAll<SVGUseElement, LeafInstanceDatum>('use.vine-leaf')
            .data(leafInstances, (leaf) => leaf.key)
            .join('use')
            .attr('class', 'vine-leaf')
            .attr('href', `#${this.env.defsIds.leafSymbolId}`)
            .style('color', (leaf) => leaf.color)
            .attr('transform', (leaf) => {
              // Orientamos la hoja hacia el lado filotáctico (+1 o -1) a 48° del tallo
              const leafAngle = leaf.node.angleDeg + leaf.node.side * 48;
              return `translate(${leaf.node.x}, ${leaf.node.y}) rotate(${leafAngle}) scale(${leaf.scale})`;
            });

          // Etiqueta numérica flotando sobre el ápice
          valueLabelEl
            .attr('x', skeleton.apex.x)
            .attr('y', skeleton.apex.y - d.tendrilLength * 0.65 - 8)
            .text(Math.round(d.primaryValue * t).toString());
        };
      });
  }

  protected override onDestroy(): void {
    this.xAxisGroup?.remove();
    this.yAxisGroup?.remove();
    this.previousVineParams.clear();
  }
}

