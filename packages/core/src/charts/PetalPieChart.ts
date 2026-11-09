import { max } from 'd3-array';
import { scaleLinear, scaleSqrt } from 'd3-scale';
import type { Selection } from 'd3-selection';
import { pie, type PieArcDatum } from 'd3-shape';
import 'd3-transition';
import { BaseChart } from '../core/BaseChart';
import type { ChartEnvironment } from '../core/ChartEnvironment';
import {
  createPetalPathInterpolator,
  generatePetalPath,
  generatePetalVenationPath,
  hashStringToSeed,
  polarToCartesian,
} from '../geometry/OrganicGeometry';
import type {
  ChartDimensions,
  PetalGeometryParams,
  PetalPieChartConfig,
} from '../types';

interface ComputedPetalDatum<TData> {
  readonly key: string | number;
  readonly raw: TData;
  readonly index: number;
  readonly value: number;
  readonly label: string;
  readonly fill: string;
  readonly geometry: PetalGeometryParams;
}

/**
 * Gráfico de sectores floral (`PetalPieChart`).
 * Cada segmento es un pétalo paramétrico que brota de un pistilo central,
 * cuya longitud radial, apertura angular y curvatura Bézier están gobernadas por los datos.
 */
export class PetalPieChart<TData> extends BaseChart<
  TData,
  PetalPieChartConfig<TData>
> {
  private corollaGroup!: Selection<SVGGElement, unknown, null, undefined>;
  private stamensGroup!: Selection<SVGGElement, unknown, null, undefined>;
  private pistilGroup!: Selection<SVGGElement, unknown, null, undefined>;
  private labelsGroup!: Selection<SVGGElement, unknown, null, undefined>;

  /** Caché de geometrías previas por clave para interpolación `attrTween` sin artefactos */
  private readonly previousGeometry = new Map<string | number, PetalGeometryParams>();

  constructor(environment: ChartEnvironment, config: PetalPieChartConfig<TData>) {
    super(environment, config);
  }

  protected onInit(): void {
    const dims = this.env.getDimensions();
    const cx = dims.innerWidth * 0.5;
    const cy = dims.innerHeight * 0.5;

    this.chartGroup.attr('transform', `translate(${cx}, ${cy})`);

    this.corollaGroup = this.chartGroup
      .append('g')
      .attr('class', 'flower-corolla');
    this.stamensGroup = this.chartGroup
      .append('g')
      .attr('class', 'flower-stamens');
    this.pistilGroup = this.chartGroup
      .append('g')
      .attr('class', 'flower-pistil');
    this.labelsGroup = this.chartGroup
      .append('g')
      .attr('class', 'flower-labels');
  }

  protected onResize(dimensions: ChartDimensions): void {
    const cx = dimensions.innerWidth * 0.5;
    const cy = dimensions.innerHeight * 0.5;
    this.chartGroup.attr('transform', `translate(${cx}, ${cy})`);
  }

  protected onUpdate(data: readonly TData[], dimensions: ChartDimensions): void {
    const {
      keyAccessor,
      valueAccessor,
      labelAccessor,
      curvatureAccessor,
      colorAccessor,
      pistilRadiusRatio = 0.14,
      maxRadiusRatio = 0.82,
      padAngle = 0.04,
      tipSharpness = 0.42,
      polarMode = 'equal-angle-variable-length',
      showVenation = true,
      showStamens = true,
    } = this.config;

    const availableRadius = Math.min(dimensions.innerWidth, dimensions.innerHeight) * 0.5;
    const innerRadius = Math.max(14, availableRadius * pistilRadiusRatio);
    const maxOuterRadius = Math.max(innerRadius + 30, availableRadius * maxRadiusRatio);

    const maxValue = max(data, (d, i) => valueAccessor(d, i)) ?? 1;
    const radiusScale = scaleSqrt()
      .domain([0, Math.max(1e-6, maxValue)])
      .range([innerRadius + 16, maxOuterRadius]);

    const maxCurvature = curvatureAccessor
      ? max(data, (d, i) => curvatureAccessor(d, i)) ?? 1
      : 1;
    const curvatureScale = scaleLinear()
      .domain([0, Math.max(1e-6, maxCurvature)])
      .range([0.45, 1.05])
      .clamp(true);

    // Generador angular D3
    const pieGenerator = pie<TData>()
      .padAngle(padAngle)
      .sort(null)
      .value((d, i) =>
        polarMode === 'angle-and-length' ? Math.max(0, valueAccessor(d, i)) : 1
      );

    const arcs: PieArcDatum<TData>[] = pieGenerator([...data]);

    const computedPetals: ComputedPetalDatum<TData>[] = arcs.map((arc, i) => {
      const datum = arc.data;
      const key = keyAccessor(datum, i);
      const val = Math.max(0, valueAccessor(datum, i));
      const outerRadius = radiusScale(val);
      const curvature = curvatureAccessor
        ? curvatureScale(curvatureAccessor(datum, i))
        : 0.78;
      const seed = hashStringToSeed(key);

      const geometry: PetalGeometryParams = {
        cx: 0,
        cy: 0,
        startAngle: arc.startAngle,
        endAngle: arc.endAngle,
        innerRadius,
        outerRadius,
        curvature,
        tipSharpness,
        noiseIntensity: 0.025,
        seed,
      };

      return {
        key,
        raw: datum,
        index: i,
        value: val,
        label: labelAccessor(datum, i),
        fill: colorAccessor
          ? colorAccessor(datum, i)
          : this.env.getPetalGradientUrl(i),
        geometry,
      };
    });

    const { duration, delayPerItem, ease } = this.transitionConfig;

    // Snapshot de la geometría previa: el tween del cuerpo sobrescribe `previousGeometry`
    // al arrancar, por lo que la venación debe leer el estado inicial desde aquí.
    const startGeometry = new Map(this.previousGeometry);

    // Interpolación en espacio de parámetros para la venación (no de cadenas SVG)
    const venationTween =
      (from: PetalGeometryParams, to: PetalGeometryParams) =>
      (t: number): string => {
        if (!showVenation) return '';
        const inv = 1 - t;
        return generatePetalVenationPath({
          ...to,
          startAngle: from.startAngle * inv + to.startAngle * t,
          endAngle: from.endAngle * inv + to.endAngle * t,
          innerRadius: from.innerRadius * inv + to.innerRadius * t,
          outerRadius: from.outerRadius * inv + to.outerRadius * t,
          curvature: from.curvature * inv + to.curvature * t,
        });
      };

    const sproutGeometry = (geometry: PetalGeometryParams): PetalGeometryParams => {
      const midAngle = (geometry.startAngle + geometry.endAngle) * 0.5;
      return {
        ...geometry,
        startAngle: midAngle - 0.02,
        endAngle: midAngle + 0.02,
        outerRadius: geometry.innerRadius + 2,
        curvature: 0.2,
      };
    };

    // 1. Selección y Data Join de Pétalos (g.petal-node)
    this.corollaGroup
      .selectAll<SVGGElement, ComputedPetalDatum<TData>>('g.petal-node')
      .data(computedPetals, (d) => d.key)
      .join(
        (enter) => {
          const group = enter
            .append('g')
            .attr('class', 'petal-node')
            .style('will-change', 'transform, opacity')
            .attr('opacity', 0);

          // Cuerpo principal del pétalo
          group
            .append('path')
            .attr('class', 'petal-body')
            .attr('fill', (d) => d.fill)
            .attr('stroke', (_, i) =>
              this.env.palette.petals[i % this.env.palette.petals.length]
            )
            .attr('stroke-width', 1.2)
            .attr('filter', `url(#${this.env.defsIds.dropShadowId})`);

          // Patrón de venación interna
          group
            .append('path')
            .attr('class', 'petal-venation')
            .attr('fill', 'none')
            .attr('stroke', '#FFFDF7')
            .attr('stroke-width', 0.85)
            .attr('stroke-linecap', 'round')
            .attr('opacity', showVenation ? 0.45 : 0);

          group
            .transition()
            .duration(duration)
            .delay((_, i) => i * delayPerItem)
            .ease(ease)
            .attr('opacity', 1);

          group
            .select<SVGPathElement>('path.petal-body')
            .transition()
            .duration(duration)
            .delay((_, i) => i * delayPerItem)
            .ease(ease)
            .attrTween('d', (d) => {
              this.previousGeometry.set(d.key, d.geometry);
              return createPetalPathInterpolator(sproutGeometry(d.geometry), d.geometry);
            });

          group
            .select<SVGPathElement>('path.petal-venation')
            .transition()
            .duration(duration)
            .delay((_, i) => i * delayPerItem)
            .ease(ease)
            .attrTween('d', (d) => venationTween(sproutGeometry(d.geometry), d.geometry));

          return group;
        },
        (update) => {
          update
            .transition()
            .duration(duration)
            .ease(ease)
            .attr('opacity', 1);

          update
            .select<SVGPathElement>('path.petal-body')
            .attr('fill', (d) => d.fill)
            .transition()
            .duration(duration)
            .ease(ease)
            .attrTween('d', (d) => {
              const prev = startGeometry.get(d.key) ?? d.geometry;
              this.previousGeometry.set(d.key, d.geometry);
              return createPetalPathInterpolator(prev, d.geometry);
            });

          update
            .select<SVGPathElement>('path.petal-venation')
            .transition()
            .duration(duration)
            .ease(ease)
            .attr('opacity', showVenation ? 0.45 : 0)
            .attrTween('d', (d) =>
              venationTween(startGeometry.get(d.key) ?? d.geometry, d.geometry)
            );

          return update;
        },
        (exit) => {
          exit
            .select<SVGPathElement>('path.petal-venation')
            .transition()
            .duration(duration * 0.65)
            .ease(ease)
            .attrTween('d', (d) =>
              venationTween(d.geometry, { ...d.geometry, outerRadius: d.geometry.innerRadius })
            );

          return exit
            .each((d) => {
              this.previousGeometry.delete(d.key);
            })
            .transition()
            .duration(duration * 0.65)
            .ease(ease)
            .attr('opacity', 0)
            .select<SVGPathElement>('path.petal-body')
            .attrTween('d', (d) => {
              const collapsed: PetalGeometryParams = {
                ...d.geometry,
                outerRadius: d.geometry.innerRadius,
              };
              return createPetalPathInterpolator(d.geometry, collapsed);
            })
            .end()
            .then(() => {
              exit.remove();
            })
            .catch(() => {
              // Si la transición se interrumpe antes de terminar, limpiamos de forma segura
              exit.remove();
            });
        }
      );

    // 2. Estambres radiales alrededor del pistilo (opcional)
    const stamenData = showStamens ? computedPetals : [];
    this.stamensGroup
      .selectAll<SVGGElement, ComputedPetalDatum<TData>>('g.flower-stamen')
      .data(stamenData, (d) => d.key)
      .join(
        (enter) => {
          const g = enter.append('g').attr('class', 'flower-stamen');
          g.append('line')
            .attr('class', 'stamen-filament')
            .attr('stroke', this.env.palette.pistilStroke)
            .attr('stroke-width', 1);
          g.append('circle')
            .attr('class', 'stamen-anther')
            .attr('r', 2.4)
            .attr('fill', this.env.palette.pistil)
            .attr('stroke', this.env.palette.pistilStroke)
            .attr('stroke-width', 0.8);
          return g;
        },
        (update) => update,
        (exit) => exit.remove()
      )
      .each((d, i, nodes) => {
        const midAngle = (d.geometry.startAngle + d.geometry.endAngle) * 0.5;
        const basePt = polarToCartesian(0, 0, innerRadius * 0.95, midAngle);
        const tipPt = polarToCartesian(
          0,
          0,
          innerRadius + Math.min(20, (d.geometry.outerRadius - innerRadius) * 0.25),
          midAngle
        );
        const groupSel = this.stamensGroup.select(() => nodes[i]);
        groupSel
          .select('line.stamen-filament')
          .transition()
          .duration(duration)
          .attr('x1', basePt.x)
          .attr('y1', basePt.y)
          .attr('x2', tipPt.x)
          .attr('y2', tipPt.y);
        groupSel
          .select('circle.stamen-anther')
          .transition()
          .duration(duration)
          .attr('cx', tipPt.x)
          .attr('cy', tipPt.y);
      });

    // 3. Pistilo central con textura orgánica
    this.pistilGroup
      .selectAll<SVGCircleElement, number>('circle.pistil-core')
      .data([innerRadius])
      .join('circle')
      .attr('class', 'pistil-core')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('fill', `url(#${this.env.defsIds.pistilGradientId})`)
      .attr('stroke', this.env.palette.pistilStroke)
      .attr('stroke-width', 2)
      .attr(' stroke-dasharray', '3 1.5')
      .transition()
      .duration(duration)
      .attr('r', (r) => r);

    // 4. Etiquetas periféricas alineadas al ápice de cada pétalo
    this.labelsGroup
      .selectAll<SVGTextElement, ComputedPetalDatum<TData>>('text.petal-label')
      .data(computedPetals, (d) => d.key)
      .join(
        (enter) =>
          enter
            .append('text')
            .attr('class', 'petal-label')
            .attr('fill', this.env.palette.text)
            .attr('font-size', '12px')
            .attr('dy', '0.35em')
            .attr('opacity', 0),
        (update) => update,
        (exit) => exit.transition().duration(duration * 0.5).attr('opacity', 0).remove()
      )
      .transition()
      .duration(duration)
      .ease(ease)
      .attr('opacity', 1)
      .attr('x', (d) => {
        const midAngle = (d.geometry.startAngle + d.geometry.endAngle) * 0.5;
        return polarToCartesian(0, 0, d.geometry.outerRadius + 16, midAngle).x;
      })
      .attr('y', (d) => {
        const midAngle = (d.geometry.startAngle + d.geometry.endAngle) * 0.5;
        return polarToCartesian(0, 0, d.geometry.outerRadius + 16, midAngle).y;
      })
      .attr('text-anchor', (d) => {
        const midAngle = (d.geometry.startAngle + d.geometry.endAngle) * 0.5;
        const sinVal = Math.sin(midAngle);
        if (Math.abs(sinVal) < 0.15) return 'middle';
        return sinVal > 0 ? 'start' : 'end';
      })
      .text((d) => `${d.label} (${d.value})`);

    // Asegura que la caché mantenga el estado final aunque no hubiera interpolación activa
    for (const item of computedPetals) {
      if (!this.previousGeometry.has(item.key)) {
        this.previousGeometry.set(item.key, item.geometry);
      }
    }
  }
}

export { generatePetalPath };
