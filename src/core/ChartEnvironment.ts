import { select, type Selection } from 'd3-selection';
import type {
  BotanicalPalette,
  ChartDimensions,
  ChartEnvironmentConfig,
  EnvironmentEventListener,
  EnvironmentEventMap,
  Margin,
  SharedDefsRegistry,
} from '../types';

export const DEFAULT_BOTANICAL_PALETTE: BotanicalPalette = {
  background: '#FAF7F0', // Papel de herbario cálido
  stems: ['#2D5A27', '#3E6B36', '#4F772D', '#5C6F44', '#314E2C'],
  foliage: ['#4F772D', '#6A994E', '#90A955', '#386641', '#84A98C'],
  petals: [
    '#D96B62', // Antocianina carmesí suave
    '#E8986B', // Carotenoide albaricoque
    '#E2B857', // Flavonoide ocre dorado
    '#9B6B9E', // Malvidina violeta botánico
    '#6B9AC4', // Delfinidina azul aciano
    '#D48C9E', // Rosa silvestre
  ],
  pistil: '#E9C46A',
  pistilStroke: '#8C5A2B',
  axis: '#5C4D3C', // Corteza leñosa
  text: '#2C3527', // Verde carbón oscuro
};

const DEFAULT_MARGIN: Margin = {
  top: 36,
  right: 36,
  bottom: 48,
  left: 56,
};

let instanceCounter = 0;

/**
 * Orquestador del entorno SVG para visualizaciones botánicas.
 * Gestiona el contenedor DOM, ResizeObserver reactivo, loop de frame (`requestAnimationFrame`),
 * capas de composición y el catálogo compartido de `<defs>` (filtros, gradientes y símbolos `<use>`).
 */
export class ChartEnvironment {
  private readonly containerEl: HTMLElement;
  private readonly margin: Margin;
  public readonly palette: BotanicalPalette;
  public readonly defsIds: SharedDefsRegistry;
  public readonly enableOrganicFilter: boolean;
  private readonly roughness: number;

  public readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  public readonly defs: Selection<SVGDefsElement, unknown, null, undefined>;
  public readonly rootGroup: Selection<SVGGElement, unknown, null, undefined>;
  public readonly backgroundLayer: Selection<SVGGElement, unknown, null, undefined>;
  public readonly axisLayer: Selection<SVGGElement, unknown, null, undefined>;
  public readonly chartLayer: Selection<SVGGElement, unknown, null, undefined>;
  public readonly overlayLayer: Selection<SVGGElement, unknown, null, undefined>;

  private dimensions: ChartDimensions;
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private readonly renderQueue = new Set<(timestamp: number) => void>();
  private readonly listeners: {
    [K in keyof EnvironmentEventMap]: Set<EnvironmentEventListener<K>>;
  } = {
    resize: new Set(),
    frame: new Set(),
    destroy: new Set(),
  };

  constructor(config: ChartEnvironmentConfig) {
    const resolved =
      typeof config.container === 'string'
        ? document.querySelector<HTMLElement>(config.container)
        : config.container;

    if (!resolved) {
      throw new Error(
        `[ChartEnvironment] No se encontró el contenedor DOM: ${String(config.container)}`
      );
    }

    this.containerEl = resolved;
    this.margin = { ...DEFAULT_MARGIN, ...config.margin };
    this.palette = { ...DEFAULT_BOTANICAL_PALETTE, ...config.palette };
    this.enableOrganicFilter = config.enableOrganicFilter ?? true;
    this.roughness = config.roughness ?? 1.8;

    const uid = config.idPrefix ?? `botanical-${++instanceCounter}`;
    this.defsIds = {
      leafSymbolId: `${uid}-leaf`,
      thornSymbolId: `${uid}-thorn`,
      budSymbolId: `${uid}-bud`,
      nodeSymbolId: `${uid}-node`,
      organicFilterId: `${uid}-organic-displacement`,
      dropShadowId: `${uid}-drop-shadow`,
      stemGradientId: `${uid}-stem-gradient`,
      pistilGradientId: `${uid}-pistil-gradient`,
      petalGradientIds: this.palette.petals.map((_, idx) => `${uid}-petal-grad-${idx}`),
    };

    this.dimensions = this.measureContainer();

    // Creación del árbol SVG base
    this.svg = select(this.containerEl)
      .append('svg')
      .attr('class', 'd3-plant-svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.dimensions.width} ${this.dimensions.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('background-color', this.palette.background)
      .style('overflow', 'visible')
      .style('font-family', 'Georgia, "Times New Roman", serif');

    this.defs = this.svg.append('defs');
    this.initializeSharedDefs();

    this.rootGroup = this.svg
      .append('g')
      .attr('class', 'd3-plant-root')
      .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

    if (this.enableOrganicFilter) {
      this.rootGroup.attr('filter', `url(#${this.defsIds.organicFilterId})`);
    }

    this.backgroundLayer = this.rootGroup.append('g').attr('class', 'layer-background');
    this.axisLayer = this.rootGroup.append('g').attr('class', 'layer-axis');
    this.chartLayer = this.rootGroup.append('g').attr('class', 'layer-chart');
    this.overlayLayer = this.rootGroup.append('g').attr('class', 'layer-overlay');

    this.setupResizeObserver();
  }

  /**
   * Obtiene una instantánea inmutable de las dimensiones actuales.
   */
  public getDimensions(): ChartDimensions {
    return this.dimensions;
  }

  /**
   * Devuelve el `url(#...)` del gradiente de pétalo asociado a un índice.
   */
  public getPetalGradientUrl(index: number): string {
    const gradIds = this.defsIds.petalGradientIds;
    const id = gradIds[index % gradIds.length];
    return `url(#${id})`;
  }

  /**
   * Suscribe un listener tipado a eventos globales del entorno (`resize`, `frame`, `destroy`).
   * Devuelve una función de desuscripción limpia.
   */
  public on<K extends keyof EnvironmentEventMap>(
    event: K,
    listener: EnvironmentEventListener<K>
  ): () => void {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }

  /**
   * Encola una tarea de renderizado sincronizada con el próximo `requestAnimationFrame`.
   * Evita múltiples repintados síncronos en el mismo frame.
   */
  public scheduleRender(task: (timestamp: number) => void): void {
    this.renderQueue.add(task);
    if (this.rafId === null && typeof requestAnimationFrame !== 'undefined') {
      this.rafId = requestAnimationFrame((timestamp) => {
        this.rafId = null;
        const tasks = Array.from(this.renderQueue);
        this.renderQueue.clear();
        for (const fn of tasks) {
          fn(timestamp);
        }
        this.emit('frame', timestamp);
      });
    } else if (typeof requestAnimationFrame === 'undefined') {
      // Fallback para entornos SSR / testing sin window.requestAnimationFrame
      const tasks = Array.from(this.renderQueue);
      this.renderQueue.clear();
      for (const fn of tasks) {
        fn(Date.now());
      }
    }
  }

  /**
   * Libera el ResizeObserver, cancela frames pendientes y limpia el nodo SVG del DOM.
   */
  public destroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.renderQueue.clear();
    this.emit('destroy', undefined);
    this.listeners.resize.clear();
    this.listeners.frame.clear();
    this.listeners.destroy.clear();
    this.svg.remove();
  }

  private emit<K extends keyof EnvironmentEventMap>(
    event: K,
    payload: EnvironmentEventMap[K]
  ): void {
    for (const listener of this.listeners[event]) {
      listener(payload);
    }
  }

  private measureContainer(): ChartDimensions {
    const rect = this.containerEl.getBoundingClientRect();
    const width = Math.max(rect.width || this.containerEl.clientWidth || 640, 200);
    const height = Math.max(rect.height || this.containerEl.clientHeight || 420, 200);
    const innerWidth = Math.max(width - this.margin.left - this.margin.right, 50);
    const innerHeight = Math.max(height - this.margin.top - this.margin.bottom, 50);

    return {
      width,
      height,
      innerWidth,
      innerHeight,
      margin: this.margin,
    };
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver(() => {
      const nextDims = this.measureContainer();
      if (
        Math.abs(nextDims.width - this.dimensions.width) < 1 &&
        Math.abs(nextDims.height - this.dimensions.height) < 1
      ) {
        return;
      }

      this.dimensions = nextDims;
      this.scheduleRender(() => {
        this.svg.attr(
          'viewBox',
          `0 0 ${this.dimensions.width} ${this.dimensions.height}`
        );
        this.emit('resize', this.dimensions);
      });
    });

    this.resizeObserver.observe(this.containerEl);
  }

  /**
   * Construye el catálogo de `<defs>` compartidos:
   * - Filtro de desplazamiento turbulento (`feTurbulence` + `feDisplacementMap`).
   * - Sombra botánica suave (`feDropShadow`).
   * - Gradientes orgánicos para tallos, pistilo y pétalos.
   * - Símbolos geométricos (`<g id="...">`) anclados en (0,0) para instanciación vía `<use>`:
   *   Hoja (`#...-leaf`), Espina (`#...-thorn`), Brote (`#...-bud`) y Nudo (`#...-node`).
   */
  private initializeSharedDefs(): void {
    // 1. Filtro de textura/borde orgánico sutil
    const organicFilter = this.defs
      .append('filter')
      .attr('id', this.defsIds.organicFilterId)
      .attr('x', '-5%')
      .attr('y', '-5%')
      .attr('width', '110%')
      .attr('height', '110%');

    organicFilter
      .append('feTurbulence')
      .attr('type', 'fractalNoise')
      .attr('baseFrequency', '0.035')
      .attr('numOctaves', '2')
      .attr('result', 'noise');

    organicFilter
      .append('feDisplacementMap')
      .attr('in', 'SourceGraphic')
      .attr('in2', 'noise')
      .attr('scale', String(this.roughness))
      .attr('xChannelSelector', 'R')
      .attr('yChannelSelector', 'G');

    // 2. Filtro de sombra suave para dar volumen a pétalos y tallos
    const shadowFilter = this.defs
      .append('filter')
      .attr('id', this.defsIds.dropShadowId)
      .attr('x', '-15%')
      .attr('y', '-15%')
      .attr('width', '130%')
      .attr('height', '130%');

    shadowFilter
      .append('feDropShadow')
      .attr('dx', '0')
      .attr('dy', '2')
      .attr('stdDeviation', '2.5')
      .attr('flood-color', '#1B2418')
      .attr('flood-opacity', '0.16');

    // 3. Gradiente vertical para tallos / enredaderas
    const stemGrad = this.defs
      .append('linearGradient')
      .attr('id', this.defsIds.stemGradientId)
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%');

    stemGrad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', this.palette.stems[0]);
    stemGrad
      .append('stop')
      .attr('offset', '65%')
      .attr('stop-color', this.palette.stems[1]);
    stemGrad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', this.palette.foliage[1]);

    // 4. Gradiente radial para el pistilo central
    const pistilGrad = this.defs
      .append('radialGradient')
      .attr('id', this.defsIds.pistilGradientId)
      .attr('cx', '40%')
      .attr('cy', '40%')
      .attr('r', '65%');

    pistilGrad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#FFF3B0');
    pistilGrad
      .append('stop')
      .attr('offset', '70%')
      .attr('stop-color', this.palette.pistil);
    pistilGrad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', this.palette.pistilStroke);

    // 5. Gradientes radiales para cada pigmento de pétalo
    this.palette.petals.forEach((color, idx) => {
      const gradId = this.defsIds.petalGradientIds[idx];
      const grad = this.defs
        .append('radialGradient')
        .attr('id', gradId)
        .attr('cx', '50%')
        .attr('cy', '50%')
        .attr('r', '75%');

      grad
        .append('stop')
        .attr('offset', '0%')
        .attr('stop-color', color)
        .attr('stop-opacity', '0.96');
      grad
        .append('stop')
        .attr('offset', '100%')
        .attr('stop-color', color)
        .attr('stop-opacity', '0.78');
    });

    // 6. Símbolo reutilizable: Hoja botánica lanceolada anclada por su pecíolo en (0, 0)
    // Crece a lo largo del eje +X para rotarla directamente según el ángulo normal/tangente.
    const leafGroup = this.defs.append('g').attr('id', this.defsIds.leafSymbolId);
    leafGroup
      .append('path')
      .attr('d', 'M 0 0 L 3 0 M 2.5 0 C 7 -5.5, 15 -4.5, 21 0 C 15 4.5, 7 5.5, 2.5 0 Z')
      .attr('fill', 'currentColor')
      .attr('stroke', '#253D1E')
      .attr('stroke-width', '0.7');
    // Nervadura central y par de nervios secundarios dentro del símbolo
    leafGroup
      .append('path')
      .attr('d', 'M 3 0 Q 11 -0.4, 19 0 M 7 -0.2 L 11 -2.4 M 10 -0.1 L 14 2.1')
      .attr('fill', 'none')
      .attr('stroke', '#E9F5DB')
      .attr('stroke-width', '0.55')
      .attr('stroke-linecap', 'round')
      .attr('opacity', '0.75');

    // 7. Símbolo reutilizable: Espina de tallo (para AxisHelper ticks) anclada en (0, 0)
    const thornGroup = this.defs.append('g').attr('id', this.defsIds.thornSymbolId);
    thornGroup
      .append('path')
      .attr('d', 'M -2.5 0 C -1 3, -0.5 6.5, 1.5 8.5 C 1.2 5, 1.8 2, 2.5 0 Z')
      .attr('fill', this.palette.axis)
      .attr('stroke', '#3A2E21')
      .attr('stroke-width', '0.5');

    // 8. Símbolo reutilizable: Nudo caulinar / articular (para AxisHelper o StemLineChart)
    const nodeGroup = this.defs.append('g').attr('id', this.defsIds.nodeSymbolId);
    nodeGroup
      .append('ellipse')
      .attr('cx', '0')
      .attr('cy', '0')
      .attr('rx', '3.5')
      .attr('ry', '2.2')
      .attr('fill', this.palette.stems[0])
      .attr('stroke', '#F4F1DE')
      .attr('stroke-width', '0.8');

    // 9. Símbolo reutilizable: Brote / capullo apical anclado en (0, 0)
    const budGroup = this.defs.append('g').attr('id', this.defsIds.budSymbolId);
    budGroup
      .append('path')
      .attr('d', 'M 0 0 C 3 -3.5, 7.5 -3, 10 0 C 7.5 3, 3 3.5, 0 0 Z')
      .attr('fill', this.palette.petals[0])
      .attr('stroke', this.palette.stems[0])
      .attr('stroke-width', '0.8');
  }
}

