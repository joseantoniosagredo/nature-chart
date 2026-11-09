import type { Selection } from 'd3-selection';
import 'd3-transition';
import { BaseChart } from '../core/BaseChart';
import type { ChartEnvironment } from '../core/ChartEnvironment';
import {
  generateStemPath,
  generateTreeRingPath,
  treeRingPointAt,
} from '../geometry/OrganicGeometry';
import type {
  ChartDimensions,
  TreeRingChartConfig,
  TreeRingGeometryParams,
} from '../types';

interface RingRadii {
  readonly inner: number;
  readonly outer: number;
}

interface ComputedRingDatum<TData> {
  readonly key: string | number;
  readonly raw: TData;
  readonly index: number;
  readonly value: number;
  readonly label: string;
  readonly fill: string;
  readonly radii: RingRadii;
  readonly showLabel: boolean;
}

/** Semilla fija del tronco: todos los anillos comparten contorno para quedar anidados */
const TRUNK_SEED = 0.382;

/**
 * Gráfico dendrocronológico (`TreeRingChart`).
 * Una serie temporal se dibuja como la sección transversal de un tronco: cada dato es un
 * anillo de crecimiento cuya anchura radial codifica el valor. Los anillos son bandas cerradas
 * Bézier homotéticas (nunca se cruzan) con madera temprana / tardía, médula y corteza,
 * y un testigo de barrena etiqueta los años.
 */
export class TreeRingChart<TData> extends BaseChart<
  TData,
  TreeRingChartConfig<TData>
> {
  private ringsGroup!: Selection<SVGGElement, unknown, null, undefined>;
  private barkPath!: Selection<SVGPathElement, unknown, null, undefined>;
  private pithPath!: Selection<SVGPathElement, unknown, null, undefined>;
  private coreGroup!: Selection<SVGGElement, unknown, null, undefined>;
  private corePath!: Selection<SVGPathElement, unknown, null, undefined>;

  /** Caché de radios previos por clave para interpolación en espacio de parámetros */
  private readonly previousRadii = new Map<string | number, RingRadii>();
  private previousBark: RingRadii = { inner: 0, outer: 0 };

  constructor(environment: ChartEnvironment, config: TreeRingChartConfig<TData>) {
    super(environment, config);
  }

  protected onInit(): void {
    this.onResize(this.env.getDimensions());

    const { barkColor = this.env.palette.axis, latewoodColor = '#B98B57' } = this.config;

    this.barkPath = this.chartGroup
      .append('path')
      .attr('class', 'trunk-bark')
      .attr('fill', barkColor)
      .attr('fill-rule', 'evenodd')
      .attr('stroke', '#3A2E21')
      .attr('stroke-width', 1)
      .attr('filter', `url(#${this.env.defsIds.dropShadowId})`);

    this.ringsGroup = this.chartGroup.append('g').attr('class', 'trunk-rings');

    this.pithPath = this.chartGroup
      .append('path')
      .attr('class', 'trunk-pith')
      .attr('fill', latewoodColor);

    this.coreGroup = this.chartGroup.append('g').attr('class', 'trunk-core-sample');
    this.corePath = this.coreGroup
      .append('path')
      .attr('class', 'core-sample-line')
      .attr('fill', 'none')
      .attr('stroke', this.env.palette.text)
      .attr('stroke-width', 0.9)
      .attr('stroke-dasharray', '2 2')
      .attr('opacity', 0.55);
  }

  protected onResize(dimensions: ChartDimensions): void {
    this.chartGroup.attr(
      'transform',
      `translate(${dimensions.innerWidth * 0.5}, ${dimensions.innerHeight * 0.5})`
    );
  }

  protected onUpdate(data: readonly TData[], dimensions: ChartDimensions): void {
    const {
      keyAccessor,
      valueAccessor,
      labelAccessor,
      colorAccessor,
      earlywoodColor = '#EAD7AE',
      latewoodColor = '#B98B57',
      barkThickness = 10,
      wobble = 0.06,
      eccentricity = 0.08,
      maxRadiusRatio = 0.86,
      coreSampleAngle = 0,
      labelEvery,
    } = this.config;

    const shape: Omit<TreeRingGeometryParams, 'innerRadius' | 'outerRadius'> = {
      cx: 0,
      cy: 0,
      wobble,
      eccentricity,
      seed: TRUNK_SEED,
    };

    // El contorno se dilata hasta (1 + wobble + eccentricity) veces el radio medio
    const available =
      (Math.min(dimensions.innerWidth, dimensions.innerHeight) * 0.5 * maxRadiusRatio) /
      (1 + wobble + eccentricity);
    const pithRadius = Math.max(3, available * 0.035);
    const ringSpace = Math.max(10, available - barkThickness - pithRadius);

    const values = data.map((d, i) => Math.max(0, valueAccessor(d, i)));
    const total = values.reduce((acc, v) => acc + v, 0) || 1;
    const pxPerUnit = ringSpace / total;

    const avgRingPx = ringSpace / Math.max(1, data.length);
    const every = Math.max(1, labelEvery ?? Math.ceil(13 / Math.max(1e-6, avgRingPx)));

    let cursor = pithRadius;
    const rings: ComputedRingDatum<TData>[] = data.map((datum, i) => {
      const inner = cursor;
      cursor += values[i] * pxPerUnit;
      // Siempre se etiqueta el anillo más reciente (el exterior)
      const fromOutside = data.length - 1 - i;
      return {
        key: keyAccessor(datum, i),
        raw: datum,
        index: i,
        value: values[i],
        label: labelAccessor(datum, i),
        fill: colorAccessor ? colorAccessor(datum, i) : earlywoodColor,
        radii: { inner, outer: cursor },
        showLabel: fromOutside % every === 0,
      };
    });
    const trunkRadius = cursor;

    const { duration, delayPerItem, ease } = this.transitionConfig;
    const ringPath = (r: RingRadii): string =>
      generateTreeRingPath({ ...shape, innerRadius: r.inner, outerRadius: r.outer });
    const lerp = (a: RingRadii, b: RingRadii, t: number): RingRadii => ({
      inner: a.inner * (1 - t) + b.inner * t,
      outer: a.outer * (1 - t) + b.outer * t,
    });

    // Instantánea de radios previos compartida por anillos y etiquetas
    const fromRadii = new Map(this.previousRadii);
    this.previousRadii.clear();
    for (const ring of rings) this.previousRadii.set(ring.key, ring.radii);
    const startOf = (d: ComputedRingDatum<TData>): RingRadii =>
      fromRadii.get(d.key) ?? { inner: d.radii.inner, outer: d.radii.inner };

    // 1. Anillos de crecimiento
    this.ringsGroup
      .selectAll<SVGPathElement, ComputedRingDatum<TData>>('path.growth-ring')
      .data(rings, (d) => d.key)
      .join(
        (enter) => {
          const path = enter
            .append('path')
            .attr('class', 'growth-ring')
            .attr('fill-rule', 'evenodd')
            .attr('stroke', latewoodColor)
            .attr('stroke-linejoin', 'round');
          path.append('title');
          return path;
        },
        (update) => update,
        (exit) =>
          exit
            .transition()
            .duration(duration * 0.6)
            .ease(ease)
            .attr('opacity', 0)
            .attrTween('d', (d) => {
              const collapsed = { inner: d.radii.inner, outer: d.radii.inner };
              return (t: number) => ringPath(lerp(d.radii, collapsed, t));
            })
            .remove()
      )
      .attr('fill', (d) => d.fill)
      .attr('fill-opacity', (d) => (d.index % 2 === 0 ? 1 : 0.82))
      .call((sel) => sel.select('title').text((d) => `${d.label}: ${d.value}`))
      .transition()
      .duration(duration)
      .delay((d) => (fromRadii.has(d.key) ? 0 : d.index * delayPerItem * 0.5))
      .ease(ease)
      .attr('opacity', 1)
      // La madera tardía (límite oscuro) es proporcional a la anchura del anillo
      .attr('stroke-width', (d) =>
        Math.min(3, Math.max(0.6, (d.radii.outer - d.radii.inner) * 0.18))
      )
      .attrTween('d', (d) => {
        const from = startOf(d);
        return (t: number) => ringPath(lerp(from, d.radii, t));
      });

    // 2. Médula y corteza
    this.pithPath.attr('d', ringPath({ inner: 0, outer: pithRadius }));

    const barkTarget: RingRadii = { inner: trunkRadius, outer: trunkRadius + barkThickness };
    const barkFrom = this.previousBark.outer > 0 ? this.previousBark : barkTarget;
    this.previousBark = barkTarget;
    this.barkPath
      .transition()
      .duration(duration)
      .ease(ease)
      .attrTween('d', () => (t: number) => ringPath(lerp(barkFrom, barkTarget, t)));

    // 3. Testigo de barrena (core sample) desde la médula hasta la corteza
    const coreEnd = treeRingPointAt(shape, trunkRadius + barkThickness, coreSampleAngle);
    const coreStart = treeRingPointAt(shape, 0, coreSampleAngle);
    this.corePath
      .transition()
      .duration(duration)
      .ease(ease)
      .attr(
        'd',
        generateStemPath({ points: [coreStart, coreEnd], roughness: 0.8, seed: TRUNK_SEED })
      );

    const labelRings = rings.filter((r) => r.showLabel);
    const rotationDeg = (coreSampleAngle * 180) / Math.PI;
    const labelTransform = (r: RingRadii): string => {
      const p = treeRingPointAt(shape, (r.inner + r.outer) * 0.5, coreSampleAngle);
      return `translate(${p.x}, ${p.y}) rotate(${rotationDeg})`;
    };

    this.coreGroup
      .selectAll<SVGGElement, ComputedRingDatum<TData>>('g.ring-label')
      .data(labelRings, (d) => d.key)
      .join(
        (enter) => {
          const g = enter.append('g').attr('class', 'ring-label').attr('opacity', 0);
          g.append('use')
            .attr('href', `#${this.env.defsIds.nodeSymbolId}`)
            .attr('transform', 'scale(0.7)');
          g.append('text')
            .attr('x', 7)
            .attr('dy', '0.35em')
            .attr('font-size', '10px')
            .attr('fill', this.env.palette.text)
            .attr('stroke', this.env.palette.background)
            .attr('stroke-width', 2.5)
            .attr('paint-order', 'stroke');
          return g;
        },
        (update) => update,
        (exit) => exit.transition().duration(duration * 0.4).attr('opacity', 0).remove()
      )
      .call((sel) => sel.select('text').text((d) => d.label))
      .transition()
      .duration(duration)
      .ease(ease)
      .attr('opacity', 1)
      .attrTween('transform', (d) => {
        const from = startOf(d);
        return (t: number) => labelTransform(lerp(from, d.radii, t));
      });

    // Mantiene la corteza / testigo encima y la médula sobre los anillos
    this.pithPath.raise();
    this.coreGroup.raise();
  }

  protected override onDestroy(): void {
    this.previousRadii.clear();
  }
}
