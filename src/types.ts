import type {
  ScaleBand,
  ScaleContinuousNumeric,
  ScalePoint,
  ScaleTime,
} from 'd3-scale';

// ============================================================================
// 1. PRIMITIVAS GEOMÉTRICAS Y DIMENSIONES
// ============================================================================

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

/**
 * Punto sobre una curva paramétrica con marco de Frenet-Serret (tangente y normal)
 * en 2D, usado para anclar hojas, espinas y zarcillos con orientación orgánica.
 */
export interface OrientedPoint2D extends Point2D {
  /** Parámetro normalizado a lo largo de la curva t ∈ [0, 1] */
  readonly t: number;
  /** Ángulo de la tangente en grados */
  readonly angleDeg: number;
  /** Componente X del vector normal unitario */
  readonly normalX: number;
  /** Componente Y del vector normal unitario */
  readonly normalY: number;
  /** Quiraliad / lado sugerido de brotación (+1 derecha, -1 izquierda) */
  readonly side: 1 | -1;
}

export interface Margin {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface ChartDimensions {
  readonly width: number;
  readonly height: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly margin: Margin;
}

// ============================================================================
// 2. PALETA BOTÁNICA Y DEFINICIONES SVG (<defs>)
// ============================================================================

export interface BotanicalPalette {
  readonly background: string;
  readonly stems: readonly string[];
  readonly foliage: readonly string[];
  readonly petals: readonly string[];
  readonly pistil: string;
  readonly pistilStroke: string;
  readonly axis: string;
  readonly text: string;
}

export interface SharedDefsRegistry {
  readonly leafSymbolId: string;
  readonly thornSymbolId: string;
  readonly budSymbolId: string;
  readonly nodeSymbolId: string;
  readonly organicFilterId: string;
  readonly dropShadowId: string;
  readonly stemGradientId: string;
  readonly pistilGradientId: string;
  readonly petalGradientIds: readonly string[];
}

// ============================================================================
// 3. ACCESORES GENÉRICOS TIPADOS (SIN `any`)
// ============================================================================

export type KeyAccessor<TData> = (datum: TData, index: number) => string | number;
export type NumericAccessor<TData> = (datum: TData, index: number) => number;
export type StringAccessor<TData> = (datum: TData, index: number) => string;

// ============================================================================
// 4. CONFIGURACIÓN DEL ENTORNO Y CICLO DE VIDA BASE
// ============================================================================

export interface ChartEnvironmentConfig {
  readonly container: HTMLElement | string;
  readonly margin?: Partial<Margin>;
  readonly palette?: Partial<BotanicalPalette>;
  /** Activa filtro SVG feTurbulence + feDisplacementMap para bordes orgánicos */
  readonly enableOrganicFilter?: boolean;
  /** Intensidad de desplazamiento del filtro orgánico (default: 1.8) */
  readonly roughness?: number;
  /** Prefijo único para IDs de <defs> (evita colisiones entre múltiples instancias) */
  readonly idPrefix?: string;
}

export interface EnvironmentEventMap {
  readonly resize: ChartDimensions;
  readonly frame: number;
  readonly destroy: undefined;
}

export type EnvironmentEventListener<K extends keyof EnvironmentEventMap> = (
  payload: EnvironmentEventMap[K]
) => void;

export interface TransitionConfig {
  readonly duration: number;
  readonly delayPerItem: number;
  readonly ease: (normalizedTime: number) => number;
}

export interface BaseChartConfig<TData> {
  readonly keyAccessor: KeyAccessor<TData>;
  readonly transition?: Partial<TransitionConfig>;
  readonly ariaLabel?: string;
}

export interface IChartLifecycle<TData> {
  init(): void;
  update(data: readonly TData[]): void;
  resize(dimensions: ChartDimensions): void;
  destroy(): void;
}

// ============================================================================
// 5. PARÁMETROS MATEMÁTICOS PARA GEOMETRÍA ORGÁNICA
// ============================================================================

export interface PetalGeometryParams {
  readonly cx: number;
  readonly cy: number;
  /** Ángulo inicial en radianes (0 = 12 en punto, sentido horario igual que d3.arc) */
  readonly startAngle: number;
  /** Ángulo final en radianes */
  readonly endAngle: number;
  /** Radio del pistilo central donde nace el pétalo */
  readonly innerRadius: number;
  /** Longitud total desde el centro hasta el ápice del pétalo */
  readonly outerRadius: number;
  /** Apertura / redondez lateral del pétalo (0.2 = lanceolado, 1.0 = lobulado ancho) */
  readonly curvature: number;
  /** Agudeza del ápice (0 = redondeado tipo magnolia, 1 = acuminado tipo lirio) */
  readonly tipSharpness: number;
  /** Intensidad de micro-ondulación en el borde del pétalo */
  readonly noiseIntensity?: number;
  /** Semilla determinista para reproducibilidad en transiciones */
  readonly seed?: number;
}

export interface VineGeometryParams {
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  /** Grosor del tallo en la base (raíz/eje) */
  readonly baseThickness: number;
  /** Grosor del tallo en el ápice */
  readonly tipThickness: number;
  /** Amplitud de la oscilación sinusoidal en píxeles */
  readonly swayAmplitude: number;
  /** Frecuencia (número de semi-ondas a lo largo del tallo) */
  readonly swayFrequency: number;
  /** Semilla determinista para fase y armónicos secundarios */
  readonly seed: number;
  /** Número de muestras longitudinales para construcción de curvas (default: 16) */
  readonly segments?: number;
}

export interface VineSkeletonResult {
  /** Trazado SVG cerrado (`M ... C ... Z`) del tallo con ahusamiento (tapering) */
  readonly bodyPath: string;
  /** Trazado SVG abierto (`M ... C ...`) del haz vascular central */
  readonly centerlinePath: string;
  /** Nudos calculados con sus vectores normales para insertar hojas vía <use> */
  readonly nodes: readonly OrientedPoint2D[];
  /** Punto y orientación exacta del ápice para el zarcillo o brote terminal */
  readonly apex: OrientedPoint2D;
}

export interface TendrilGeometryParams {
  readonly origin: Point2D;
  /** Ángulo inicial de salida en grados */
  readonly angleDeg: number;
  /** Alcance longitudinal del zarcillo */
  readonly length: number;
  /** Número de espirales / vueltas (ej. 1.5 a 3.5) */
  readonly coils: number;
  /** Dirección de giro de la espiral (+1 horario, -1 antihorario) */
  readonly chirality: 1 | -1;
}

export interface StemGeometryParams {
  readonly points: readonly Point2D[];
  readonly roughness: number;
  readonly seed: number;
}

// ============================================================================
// 6. ESCALAS Y EJES BOTÁNICOS (AxisHelper)
// ============================================================================

export type AxisOrientation = 'bottom' | 'left' | 'top' | 'right';
export type TickMarkerStyle = 'thorn' | 'node' | 'leaf';

export type SupportedAxisScale =
  | ScaleContinuousNumeric<number, number>
  | ScaleTime<number, number>
  | ScaleBand<string>
  | ScalePoint<string>;

export interface BotanicalAxisConfig<Scale extends SupportedAxisScale = SupportedAxisScale> {
  readonly scale: Scale;
  readonly orientation: AxisOrientation;
  readonly tickCount?: number;
  readonly tickFormat?: (domainValue: string | number | Date) => string;
  readonly tickStyle?: TickMarkerStyle;
  readonly stemRoughness?: number;
  readonly label?: string;
  readonly seed?: number;
}

// ============================================================================
// 7. CONFIGURACIÓN DE CHARTS ESPECÍFICOS
// ============================================================================

export interface PetalPieChartConfig<TData> extends BaseChartConfig<TData> {
  /** Métrica principal que gobierna la longitud radial y/o peso angular del pétalo */
  readonly valueAccessor: NumericAccessor<TData>;
  /** Etiqueta de categoría del pétalo */
  readonly labelAccessor: StringAccessor<TData>;
  /** Métrica secundaria opcional para modular la curvatura/anchura del pétalo (0.2 - 1.2) */
  readonly curvatureAccessor?: NumericAccessor<TData>;
  /** Color personalizado opcional por dato */
  readonly colorAccessor?: StringAccessor<TData>;
  /** Proporción del radio reservada para el pistilo central (default: 0.15) */
  readonly pistilRadiusRatio?: number;
  /** Proporción del radio máximo disponible en el contenedor (default: 0.84) */
  readonly maxRadiusRatio?: number;
  /** Separación angular en radianes entre pétalos (default: 0.04) */
  readonly padAngle?: number;
  /** Agudeza del ápice del pétalo entre 0 y 1 (default: 0.45) */
  readonly tipSharpness?: number;
  /**
   * Modo de codificación polar:
   * - 'equal-angle-variable-length': Ángulos iguales, el valor controla la longitud del pétalo (Rosa botánica).
   * - 'angle-and-length': El valor controla tanto la apertura angular como la longitud radial.
   */
  readonly polarMode?: 'equal-angle-variable-length' | 'angle-and-length';
  /** Dibuja nervaduras centrales y secundarias en cada pétalo (default: true) */
  readonly showVenation?: boolean;
  /** Dibuja estambres alrededor del pistilo (default: true) */
  readonly showStamens?: boolean;
}

export interface VineBarChartConfig<TData> extends BaseChartConfig<TData> {
  /** Categoría en el eje basal (X en vertical, Y en horizontal) */
  readonly categoryAccessor: StringAccessor<TData>;
  /** Métrica principal: altura/longitud de crecimiento de la enredadera */
  readonly primaryValueAccessor: NumericAccessor<TData>;
  /** Métrica secundaria opcional: controla la cantidad y escala de hojas (<use>) */
  readonly foliageValueAccessor?: NumericAccessor<TData>;
  /** Métrica terciaria opcional: controla el rizado del zarcillo apical */
  readonly tendrilValueAccessor?: NumericAccessor<TData>;
  /** Color opcional por enredadera */
  readonly colorAccessor?: StringAccessor<TData>;
  /** Grosor del tallo en la base en px (default: 14) */
  readonly baseThickness?: number;
  /** Grosor del tallo en el ápice en px (default: 2.5) */
  readonly tipThickness?: number;
  /** Amplitud máxima de oscilación orgánica del tallo en px (default: 10) */
  readonly swayAmplitude?: number;
  /** Frecuencia de curvatura a lo largo del tallo (default: 1.6) */
  readonly swayFrequency?: number;
  /** Padding interno de la escala de bandas (default: 0.35) */
  readonly paddingInner?: number;
  /** Dominio Y explícito opcional [min, max] */
  readonly yDomain?: readonly [number, number];
}

export interface StemLineChartConfig<TData> extends BaseChartConfig<TData> {
  readonly xAccessor: NumericAccessor<TData>;
  readonly yAccessor: NumericAccessor<TData>;
  /** Métrica opcional que genera ramificaciones/raíces secundarias en cada nudo */
  readonly branchValueAccessor?: NumericAccessor<TData>;
  readonly baseThickness?: number;
  readonly tipThickness?: number;
  readonly roughness?: number;
}
