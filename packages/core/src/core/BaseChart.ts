import { easeCubicOut } from 'd3-ease';
import type { Selection } from 'd3-selection';
import type {
  BaseChartConfig,
  ChartDimensions,
  IChartLifecycle,
  TransitionConfig,
} from '../types';
import type { ChartEnvironment } from './ChartEnvironment';

const DEFAULT_TRANSITION: TransitionConfig = {
  duration: 750,
  delayPerItem: 40,
  ease: easeCubicOut,
};

/**
 * Clase abstracta base que estandariza el ciclo de vida de todos los gráficos botánicos
 * (`init`, `update`, `resize`, `destroy`) y su composición con `ChartEnvironment`.
 */
export abstract class BaseChart<
  TData,
  TConfig extends BaseChartConfig<TData>
> implements IChartLifecycle<TData>
{
  protected readonly env: ChartEnvironment;
  protected readonly config: TConfig;
  protected readonly transitionConfig: TransitionConfig;
  protected readonly chartGroup: Selection<SVGGElement, unknown, null, undefined>;

  protected currentData: readonly TData[] = [];
  protected isInitialized = false;
  private unsubscribeResize: (() => void) | null = null;

  constructor(environment: ChartEnvironment, config: TConfig) {
    this.env = environment;
    this.config = config;
    this.transitionConfig = {
      ...DEFAULT_TRANSITION,
      ...config.transition,
    };

    this.chartGroup = this.env.chartLayer
      .append('g')
      .attr('class', `botanical-chart ${this.constructor.name}`)
      .attr('role', 'graphics-document')
      .attr('aria-label', config.ariaLabel ?? this.constructor.name)
      .style('will-change', 'transform, opacity');
  }

  /**
   * Inicializa capas internas, ejes o elementos estructurales estáticos,
   * y suscribe el gráfico al ciclo reactivo de redimensionado del entorno.
   */
  public init(): void {
    if (this.isInitialized) return;
    this.onInit();
    this.unsubscribeResize = this.env.on('resize', (dimensions) => {
      this.resize(dimensions);
    });
    this.isInitialized = true;
  }

  /**
   * Actualiza el gráfico con un nuevo conjunto de datos aplicando el patrón
   * `selection.join()` con funciones clave y transiciones interpoladas.
   */
  public update(data: readonly TData[]): void {
    if (!this.isInitialized) {
      this.init();
    }
    this.currentData = data;
    this.env.scheduleRender(() => {
      this.onUpdate(this.currentData, this.env.getDimensions());
    });
  }

  /**
   * Recalcula escalas y geometrías ante cambios en el `ResizeObserver` del contenedor.
   */
  public resize(dimensions: ChartDimensions): void {
    if (!this.isInitialized) return;
    this.onResize(dimensions);
    if (this.currentData.length > 0) {
      this.onUpdate(this.currentData, dimensions);
    }
  }

  /**
   * Cancela transiciones activas, desuscribe listeners y elimina los nodos DOM del chart.
   */
  public destroy(): void {
    if (this.unsubscribeResize) {
      this.unsubscribeResize();
      this.unsubscribeResize = null;
    }
    this.chartGroup.selectAll('*').interrupt();
    this.onDestroy();
    this.chartGroup.remove();
    this.currentData = [];
    this.isInitialized = false;
  }

  protected abstract onInit(): void;
  protected abstract onUpdate(
    data: readonly TData[],
    dimensions: ChartDimensions
  ): void;
  protected abstract onResize(dimensions: ChartDimensions): void;
  protected onDestroy(): void {
    // Hook opcional para subclases que requieran liberar recursos adicionales
  }
}

