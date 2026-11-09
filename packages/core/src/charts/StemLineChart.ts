import { extent } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import type { Selection } from 'd3-selection';
import 'd3-transition';
import { AxisHelper } from '../core/AxisHelper';
import { BaseChart } from '../core/BaseChart';
import type { ChartEnvironment } from '../core/ChartEnvironment';
import {
  generateStemPath,
  generateTendrilPath,
  hashStringToSeed,
} from '../geometry/OrganicGeometry';
import type {
  ChartDimensions,
  Point2D,
  StemLineChartConfig,
} from '../types';

interface StemNodeDatum<TData> {
  readonly key: string | number;
  readonly raw: TData;
  readonly x: number;
  readonly y: number;
  readonly angleDeg: number;
  readonly branchValue: number;
  readonly chirality: 1 | -1;
}

/**
 * Gráfico de líneas continuo tematizado como un tallo leñoso con bifurcaciones
 * orgánicas y nudos caulinares (`StemLineChart`).
 */
export class StemLineChart<TData> extends BaseChart<
  TData,
  StemLineChartConfig<TData>
> {
  private readonly axisHelper: AxisHelper;
  private xAxisGroup!: Selection<SVGGElement, unknown, null, undefined>;
  private yAxisGroup!: Selection<SVGGElement, unknown, null, undefined>;
  private stemPathEl!: Selection<SVGPathElement, unknown, null, undefined>;
  private branchesGroup!: Selection<SVGGElement, unknown, null, undefined>;
  private nodesGroup!: Selection<SVGGElement, unknown, null, undefined>;

  constructor(environment: ChartEnvironment, config: StemLineChartConfig<TData>) {
    super(environment, config);
    this.axisHelper = new AxisHelper(environment);
  }

  protected onInit(): void {
    const dims = this.env.getDimensions();

    this.xAxisGroup = this.env.axisLayer
      .append('g')
      .attr('class', 'stem-axis-x')
      .attr('transform', `translate(0, ${dims.innerHeight})`);

    this.yAxisGroup = this.env.axisLayer
      .append('g')
      .attr('class', 'stem-axis-y');

    this.branchesGroup = this.chartGroup
      .append('g')
      .attr('class', 'stem-branches');

    this.stemPathEl = this.chartGroup
      .append('path')
      .attr('class', 'stem-main-trunk')
      .attr('fill', 'none')
      .attr('stroke', this.env.palette.stems[0])
      .attr('stroke-width', this.config.baseThickness ?? 4.5)
      .attr('stroke-linecap', 'round');

    this.nodesGroup = this.chartGroup
      .append('g')
      .attr('class', 'stem-nodes');
  }

  protected onResize(dimensions: ChartDimensions): void {
    this.xAxisGroup.attr('transform', `translate(0, ${dimensions.innerHeight})`);
  }

  protected onUpdate(data: readonly TData[], dimensions: ChartDimensions): void {
    const {
      keyAccessor,
      xAccessor,
      yAccessor,
      branchValueAccessor,
      roughness = 3.2,
    } = this.config;

    const xExtent = extent(data, (d, i) => xAccessor(d, i)) as [number, number];
    const yExtent = extent(data, (d, i) => yAccessor(d, i)) as [number, number];

    const xScale = scaleLinear()
      .domain([xExtent[0] ?? 0, xExtent[1] ?? 1])
      .range([0, dimensions.innerWidth]);

    const yScale = scaleLinear()
      .domain([0, (yExtent[1] ?? 1) * 1.15])
      .range([dimensions.innerHeight, 0])
      .nice();

    const { duration, ease } = this.transitionConfig;

    this.axisHelper.renderAxis(
      this.xAxisGroup,
      { scale: xScale, orientation: 'bottom', tickStyle: 'node' },
      duration
    );
    this.axisHelper.renderAxis(
      this.yAxisGroup,
      { scale: yScale, orientation: 'left', tickStyle: 'thorn' },
      duration
    );

    const points: Point2D[] = data.map((d, i) => ({
      x: xScale(xAccessor(d, i)),
      y: yScale(yAccessor(d, i)),
    }));

    const mainPathD = generateStemPath({
      points,
      roughness,
      seed: 0.618,
    });

    this.stemPathEl
      .transition()
      .duration(duration)
      .ease(ease)
      .attr('d', mainPathD);

    const nodeData: StemNodeDatum<TData>[] = data.map((d, i) => {
      const prev = points[Math.max(0, i - 1)];
      const next = points[Math.min(points.length - 1, i + 1)];
      const angleDeg = (Math.atan2(next.y - prev.y, next.x - prev.x) * 180) / Math.PI;
      const key = keyAccessor(d, i);

      return {
        key,
        raw: d,
        x: points[i].x,
        y: points[i].y,
        angleDeg,
        branchValue: branchValueAccessor ? branchValueAccessor(d, i) : 12,
        chirality: hashStringToSeed(key) >= 0.5 ? 1 : -1,
      };
    });

    // Bifurcaciones orgánicas secundarias en cada nudo
    this.branchesGroup
      .selectAll<SVGPathElement, StemNodeDatum<TData>>('path.stem-bifurcation')
      .data(nodeData, (d) => d.key)
      .join('path')
      .attr('class', 'stem-bifurcation')
      .attr('fill', 'none')
      .attr('stroke', this.env.palette.stems[1])
      .attr('stroke-width', 1.4)
      .attr('stroke-linecap', 'round')
      .transition()
      .duration(duration)
      .ease(ease)
      .attr('d', (d) =>
        generateTendrilPath({
          origin: { x: d.x, y: d.y },
          angleDeg: d.angleDeg + d.chirality * 42,
          length: Math.min(36, Math.max(10, d.branchValue)),
          coils: 0.85,
          chirality: d.chirality,
        })
      );

    // Nudos caulinares y brotes vía <use>
    this.nodesGroup
      .selectAll<SVGUseElement, StemNodeDatum<TData>>('use.stem-node-marker')
      .data(nodeData, (d) => d.key)
      .join('use')
      .attr('class', 'stem-node-marker')
      .attr('href', `#${this.env.defsIds.budSymbolId}`)
      .transition()
      .duration(duration)
      .ease(ease)
      .attr(
        'transform',
        (d) =>
          `translate(${d.x}, ${d.y}) rotate(${d.angleDeg + d.chirality * 42}) scale(0.85)`
      );
  }

  protected override onDestroy(): void {
    this.xAxisGroup?.remove();
    this.yAxisGroup?.remove();
  }
}

