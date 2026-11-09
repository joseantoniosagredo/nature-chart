import type { Selection } from 'd3-selection';
import 'd3-transition';
import {
  generateStemPath,
  hashStringToSeed,
  organicNoise1D,
} from '../geometry/OrganicGeometry';
import type {
  BotanicalAxisConfig,
  Point2D,
  SupportedAxisScale,
  TickMarkerStyle,
} from '../types';
import type { ChartEnvironment } from './ChartEnvironment';

interface NormalizedTick {
  readonly key: string;
  readonly rawValue: string | number | Date;
  readonly label: string;
  readonly position: number;
}

/**
 * Type guard para distinguir escalas continuas (`ScaleContinuousNumeric` / `ScaleTime`)
 * que implementan `.ticks()` frente a escalas ordinales (`ScaleBand` / `ScalePoint`).
 */
function hasTicksMethod(
  scale: SupportedAxisScale
): scale is Extract<SupportedAxisScale, { ticks: (count?: number) => unknown[] }> {
  return typeof (scale as { ticks?: unknown }).ticks === 'function';
}

function hasBandwidthMethod(
  scale: SupportedAxisScale
): scale is Extract<SupportedAxisScale, { bandwidth: () => number }> {
  return typeof (scale as { bandwidth?: unknown }).bandwidth === 'function';
}

/**
 * Gestor de ejes botánicos tematizados.
 * Sustituye las líneas cartesianas rígidas de `d3-axis` por un tallo leñoso/herbáceo
 * (`generateStemPath`) y marcas de graduación instanciadas vía `<use href="#...">`
 * (espinas, nudos caulinares o foliolos).
 */
export class AxisHelper {
  private readonly env: ChartEnvironment;

  constructor(environment: ChartEnvironment) {
    this.env = environment;
  }

  /**
   * Renderiza o actualiza reactivamente un eje botánico sobre un grupo SVG `<g>`.
   */
  public renderAxis<Scale extends SupportedAxisScale>(
    containerGroup: Selection<SVGGElement, unknown, null, undefined>,
    config: BotanicalAxisConfig<Scale>,
    duration = 600
  ): void {
    const {
      scale,
      orientation,
      tickCount = 6,
      tickFormat,
      tickStyle = 'thorn',
      stemRoughness = 2.8,
      label,
      seed = 0.42,
    } = config;

    const range = scale.range() as readonly number[];
    const r0 = range[0] ?? 0;
    const r1 = range[range.length - 1] ?? 0;
    const isHorizontal = orientation === 'bottom' || orientation === 'top';

    const startPoint: Point2D = isHorizontal ? { x: r0, y: 0 } : { x: 0, y: r0 };
    const endPoint: Point2D = isHorizontal ? { x: r1, y: 0 } : { x: 0, y: r1 };

    // 1. Tallo principal del eje (sustituye a path.domain de d3-axis)
    const stemPoints: Point2D[] = [
      startPoint,
      {
        x: (startPoint.x + endPoint.x) * 0.5,
        y: (startPoint.y + endPoint.y) * 0.5,
      },
      endPoint,
    ];
    const stemPathData = generateStemPath({
      points: stemPoints,
      roughness: stemRoughness,
      seed,
    });

    containerGroup
      .selectAll<SVGPathElement, string>('path.botanical-axis-stem')
      .data([stemPathData])
      .join(
        (enter) =>
          enter
            .append('path')
            .attr('class', 'botanical-axis-stem')
            .attr('fill', 'none')
            .attr('stroke', this.env.palette.axis)
            .attr('stroke-width', 2.6)
            .attr('stroke-linecap', 'round')
            .attr('d', (d) => d),
        (update) =>
          update
            .transition()
            .duration(duration)
            .attr('d', (d) => d)
      );

    // 2. Extracción y normalización de ticks desde d3-scale
    const ticks = this.extractTicks(scale, tickCount, tickFormat);
    const symbolHref = this.resolveTickSymbolHref(tickStyle);

    // 3. Data Join estricto (`selection.join`) para los ticks botánicos
    const tickGroups = containerGroup
      .selectAll<SVGGElement, NormalizedTick>('g.botanical-tick')
      .data(ticks, (d) => d.key)
      .join(
        (enter) => {
          const g = enter
            .append('g')
            .attr('class', 'botanical-tick')
            .style('will-change', 'transform, opacity')
            .attr('opacity', 0)
            .attr('transform', (d) => this.computeTickTransform(d.position, isHorizontal));

          // Instanciación eficiente vía <use> apuntando a <defs>
          g.append('use')
            .attr('class', 'botanical-tick-marker')
            .attr('href', symbolHref)
            .style('color', this.env.palette.foliage[0]);

          g.append('text')
            .attr('class', 'botanical-tick-label')
            .attr('fill', this.env.palette.text)
            .attr('font-size', '11.5px')
            .style('user-select', 'none');

          return g;
        },
        (update) => update,
        (exit) =>
          exit
            .transition()
            .duration(duration * 0.6)
            .attr('opacity', 0)
            .remove()
      );

    // Actualización de posición y rotación orgánica de cada espina/nudo/hoja
    tickGroups
      .transition()
      .duration(duration)
      .attr('opacity', 1)
      .attr('transform', (d) => this.computeTickTransform(d.position, isHorizontal));

    tickGroups
      .select<SVGUseElement>('use.botanical-tick-marker')
      .attr('href', symbolHref)
      .attr('transform', (d, idx) =>
        this.computeMarkerOrientation(orientation, tickStyle, d.key, idx)
      );

    // Posicionamiento tipográfico según orientación del eje
    const textOffset = this.computeLabelPosition(orientation);
    tickGroups
      .select<SVGTextElement>('text.botanical-tick-label')
      .attr('x', textOffset.x)
      .attr('y', textOffset.y)
      .attr('dy', textOffset.dy)
      .attr('text-anchor', textOffset.anchor)
      .text((d) => d.label);

    // 4. Etiqueta descriptiva opcional del eje
    const labelData = label ? [label] : [];
    containerGroup
      .selectAll<SVGTextElement, string>('text.botanical-axis-title')
      .data(labelData)
      .join('text')
      .attr('class', 'botanical-axis-title')
      .attr('fill', this.env.palette.text)
      .attr('font-size', '12.5px')
      .attr('font-style', 'italic')
      .attr('text-anchor', 'middle')
      .attr('transform', () => {
        const mid = (r0 + r1) * 0.5;
        if (orientation === 'bottom') return `translate(${mid}, 38)`;
        if (orientation === 'top') return `translate(${mid}, -28)`;
        if (orientation === 'left') return `translate(-42, ${mid}) rotate(-90)`;
        return `translate(42, ${mid}) rotate(90)`;
      })
      .text((d) => d);
  }

  private extractTicks(
    scale: SupportedAxisScale,
    tickCount: number,
    customFormat?: (val: string | number | Date) => string
  ): NormalizedTick[] {
    if (hasTicksMethod(scale)) {
      const rawTicks = scale.ticks(tickCount) as Array<number | Date>;
      const defaultFormatter = scale.tickFormat
        ? scale.tickFormat(tickCount)
        : (v: number | Date) => String(v);

      return rawTicks.map((val) => {
        const pos = scale(val as never) ?? 0;
        const label = customFormat
          ? customFormat(val)
          : defaultFormatter(val as never);
        return {
          key: val instanceof Date ? String(val.getTime()) : String(val),
          rawValue: val,
          label,
          position: pos,
        };
      });
    }

    // Escala categórica (ScaleBand o ScalePoint)
    const domain = scale.domain() as string[];
    const bandOffset = hasBandwidthMethod(scale) ? scale.bandwidth() * 0.5 : 0;

    return domain.map((cat) => {
      const basePos = (scale as (d: string) => number | undefined)(cat) ?? 0;
      return {
        key: cat,
        rawValue: cat,
        label: customFormat ? customFormat(cat) : cat,
        position: basePos + bandOffset,
      };
    });
  }

  private resolveTickSymbolHref(style: TickMarkerStyle): string {
    switch (style) {
      case 'leaf':
        return `#${this.env.defsIds.leafSymbolId}`;
      case 'node':
        return `#${this.env.defsIds.nodeSymbolId}`;
      case 'thorn':
      default:
        return `#${this.env.defsIds.thornSymbolId}`;
    }
  }

  private computeTickTransform(position: number, isHorizontal: boolean): string {
    return isHorizontal
      ? `translate(${position}, 0)`
      : `translate(0, ${position})`;
  }

  private computeMarkerOrientation(
    orientation: BotanicalAxisConfig['orientation'],
    style: TickMarkerStyle,
    key: string,
    index: number
  ): string {
    const seed = hashStringToSeed(key);
    const jitter = organicNoise1D(index * 0.25, seed) * 10;

    if (style === 'node') {
      const baseRot = orientation === 'left' || orientation === 'right' ? 90 : 0;
      return `rotate(${baseRot + jitter * 0.5})`;
    }

    if (style === 'leaf') {
      const baseAngle =
        orientation === 'bottom'
          ? 90
          : orientation === 'top'
          ? -90
          : orientation === 'left'
          ? 180
          : 0;
      return `rotate(${baseAngle + jitter}) scale(0.55)`;
    }

    // 'thorn' (espina apuntando hacia afuera del eje)
    const thornAngle =
      orientation === 'bottom'
        ? 0
        : orientation === 'top'
        ? 180
        : orientation === 'left'
        ? 90
        : -90;
    return `rotate(${thornAngle + jitter}) scale(0.95)`;
  }

  private computeLabelPosition(orientation: BotanicalAxisConfig['orientation']): {
    x: number;
    y: number;
    dy: string;
    anchor: 'start' | 'middle' | 'end';
  } {
    switch (orientation) {
      case 'bottom':
        return { x: 0, y: 18, dy: '0.71em', anchor: 'middle' };
      case 'top':
        return { x: 0, y: -14, dy: '0em', anchor: 'middle' };
      case 'left':
        return { x: -14, y: 0, dy: '0.32em', anchor: 'end' };
      case 'right':
        return { x: 14, y: 0, dy: '0.32em', anchor: 'start' };
    }
  }
}
