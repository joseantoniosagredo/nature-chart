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

/**
 * Anillo de crecimiento (dendrocronología). Todos los anillos de un mismo tronco comparten
 * `cx`, `cy`, `wobble`, `eccentricity` y `seed`, por lo que son homotéticos y nunca se cruzan.
 */
export interface TreeRingGeometryParams {
  readonly cx: number;
  readonly cy: number;
  /** Radio medio del borde interior del anillo (0 = médula maciza) */
  readonly innerRadius: number;
  /** Radio medio del borde exterior del anillo */
  readonly outerRadius: number;
  /** Irregularidad relativa del contorno (0 = círculo perfecto, 0.08 = tronco natural) */
  readonly wobble: number;
  /** Desplazamiento relativo de la médula respecto al centro (madera de reacción, 0 - 0.2) */
  readonly eccentricity: number;
  /** Semilla compartida por todo el tronco */
  readonly seed: number;
  /** Muestras angulares del contorno (default: 48) */
  readonly samples?: number;
}

/**
 * Rama leñosa ahusada que nace en `(x0, y0)` siguiendo la dirección `startAngleDeg`
 * (heredada de la rama madre) y se curva hasta `(x1, y1)`.
 */
export interface BranchGeometryParams {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  /** Ángulo de salida en grados (convención SVG: 0 = +X, -90 = arriba) */
  readonly startAngleDeg: number;
  readonly baseThickness: number;
  readonly tipThickness: number;
  /** Intensidad de la perturbación orgánica lateral en px */
  readonly gnarl: number;
  readonly seed: number;
}

export interface BranchSkeletonResult {
  /** Trazado cerrado (`M ... C ... Z`) de la rama con ahusamiento */
  readonly bodyPath: string;
  /** Punto y orientación del extremo de la rama (donde brotan hojas o ramas hijas) */
  readonly apex: OrientedPoint2D;
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

export interface TreeRingChartConfig<TData> extends BaseChartConfig<TData> {
  /** Métrica de crecimiento anual: controla la anchura del anillo. Los datos van del más antiguo (médula) al más reciente (corteza). */
  readonly valueAccessor: NumericAccessor<TData>;
  /** Etiqueta del anillo (normalmente el año) */
  readonly labelAccessor: StringAccessor<TData>;
  /** Color opcional por anillo (sustituye la alternancia madera temprana / tardía) */
  readonly colorAccessor?: StringAccessor<TData>;
  /** Color de la madera temprana (default: '#EAD7AE') */
  readonly earlywoodColor?: string;
  /** Color de la madera tardía y de los límites de anillo (default: '#B98B57') */
  readonly latewoodColor?: string;
  /** Color de la corteza (default: palette.axis) */
  readonly barkColor?: string;
  /** Grosor de la corteza en px (default: 10) */
  readonly barkThickness?: number;
  /** Irregularidad del contorno del tronco (default: 0.06) */
  readonly wobble?: number;
  /** Excentricidad de la médula (default: 0.08) */
  readonly eccentricity?: number;
  /** Proporción del radio disponible usada por el tronco (default: 0.86) */
  readonly maxRadiusRatio?: number;
  /** Ángulo en radianes del testigo de barrena donde se etiquetan los anillos (default: π/2 = derecha) */
  readonly coreSampleAngle?: number;
  /** Etiqueta uno de cada N anillos (default: auto según el espacio disponible) */
  readonly labelEvery?: number;
}

export interface BranchTreeChartConfig<TData> extends BaseChartConfig<TData> {
  /** Clave del nodo padre; `null`/`undefined` identifica la raíz (única). `keyAccessor` actúa como id. */
  readonly parentAccessor: (datum: TData, index: number) => string | number | null | undefined;
  /** Peso de cada nodo hoja (default: 1). Las ramas suman el peso de su subárbol. */
  readonly valueAccessor?: NumericAccessor<TData>;
  /** Etiqueta mostrada junto a las hojas terminales */
  readonly labelAccessor?: StringAccessor<TData>;
  /** Color opcional del follaje por nodo hoja (default: por rama principal) */
  readonly colorAccessor?: StringAccessor<TData>;
  /** Grosor del tronco en px (default: 22) */
  readonly trunkThickness?: number;
  /** Grosor mínimo de las ramillas terminales (default: 1.4) */
  readonly minBranchThickness?: number;
  /** Apertura total de la copa en radianes (default: 0.62π) */
  readonly spreadAngle?: number;
  /** Proporción de la altura ocupada por el fuste antes de la primera bifurcación (default: 0.26) */
  readonly trunkRatio?: number;
  /** Perturbación orgánica de las ramas en px (default: 5) */
  readonly gnarl?: number;
  /** Muestra etiquetas en las hojas terminales (default: true) */
  readonly showLabels?: boolean;
}

export interface LeafScatterChartConfig<TData> extends BaseChartConfig<TData> {
  readonly xAccessor: NumericAccessor<TData>;
  readonly yAccessor: NumericAccessor<TData>;
  /** Métrica opcional de área foliar: controla la escala de la hoja (escala raíz cuadrada) */
  readonly sizeAccessor?: NumericAccessor<TData>;
  /** Grupo / especie: asigna un pigmento de la paleta de follaje */
  readonly groupAccessor?: StringAccessor<TData>;
  /** Color explícito por dato (tiene prioridad sobre `groupAccessor`) */
  readonly colorAccessor?: StringAccessor<TData>;
  /** Orientación de la hoja en grados (0 = derecha, -90 = arriba). Default: inclinación determinista por clave */
  readonly angleAccessor?: NumericAccessor<TData>;
  /** Texto del tooltip nativo (`<title>`) */
  readonly labelAccessor?: StringAccessor<TData>;
  /** Rango de escala de la hoja [min, max] (default: [0.6, 1.9]) */
  readonly leafScaleRange?: readonly [number, number];
  readonly xDomain?: readonly [number, number];
  readonly yDomain?: readonly [number, number];
  readonly xLabel?: string;
  readonly yLabel?: string;
}
