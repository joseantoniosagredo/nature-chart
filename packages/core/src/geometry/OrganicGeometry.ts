import type {
  BranchGeometryParams,
  BranchSkeletonResult,
  OrientedPoint2D,
  PetalGeometryParams,
  Point2D,
  StemGeometryParams,
  TendrilGeometryParams,
  TreeRingGeometryParams,
  VineGeometryParams,
  VineSkeletonResult,
} from '../types';

const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Redondeo rápido a 2 decimales para mantener cadenas `d` de SVG compactas
 * y amigables para el parser del navegador.
 */
function fmt(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

/**
 * Convierte cualquier clave (string o número) en una semilla numérica determinista.
 */
export function hashStringToSeed(key: string | number): number {
  const str = String(key);
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

/**
 * Ruido coherente 1D continuo y determinista basado en superposición armónica
 * con frecuencias inconmensurables (proporción áurea φ y π).
 * Garantiza diferenciabilidad C∞ para evitar saltos durante animaciones.
 */
export function organicNoise1D(t: number, seed: number): number {
  const phase1 = seed * TWO_PI;
  const phase2 = seed * 19.193;
  const phase3 = seed * 37.719;

  const h1 = Math.sin(t * TWO_PI + phase1);
  const h2 = 0.5 * Math.sin(t * TWO_PI * 1.6180339 + phase2);
  const h3 = 0.25 * Math.cos(t * TWO_PI * 3.1415926 + phase3);

  return (h1 + h2 + h3) / 1.75;
}

/**
 * Conversión de coordenadas polares (convención D3: 0 rad = 12 en punto, sentido horario)
 * a coordenadas cartesianas SVG.
 */
export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleRad: number
): Point2D {
  return {
    x: cx + radius * Math.sin(angleRad),
    y: cy - radius * Math.cos(angleRad),
  };
}

/**
 * Convierte una polilínea de puntos 2D en comandos de curva Bézier cúbica suave
 * usando interpolación spline de Catmull-Rom uniforme (tensión α = 0.5).
 */
export function pointsToSmoothBezierCommands(
  points: readonly Point2D[],
  tension = 0.35
): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  if (n === 2) {
    return `M ${fmt(points[0].x)} ${fmt(points[0].y)} L ${fmt(points[1].x)} ${fmt(points[1].y)}`;
  }

  const segments: string[] = [`M ${fmt(points[0].x)} ${fmt(points[0].y)}`];

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    segments.push(
      `C ${fmt(cp1x)} ${fmt(cp1y)}, ${fmt(cp2x)} ${fmt(cp2y)}, ${fmt(p2.x)} ${fmt(p2.y)}`
    );
  }

  return segments.join(' ');
}

/**
 * Genera el trazado SVG cerrado (`d`) de un pétalo botánico mediante curvas Bézier cúbicas
 * paramétricas en coordenadas polares.
 *
 * Morfología:
 * - Uña basal (unguiculus) anclada al borde del pistilo (`innerRadius`).
 * - Limbo simétrico o ligeramente asimétrico gobernado por `curvature` y `tipSharpness`.
 * - Ápice en `outerRadius` con transición continua o acuminada.
 */
export function generatePetalPath(params: PetalGeometryParams): string {
  const {
    cx,
    cy,
    startAngle,
    endAngle,
    innerRadius,
    outerRadius,
    curvature,
    tipSharpness,
    noiseIntensity = 0.03,
    seed = 0.5,
  } = params;

  const clampedOuter = Math.max(innerRadius + 2, outerRadius);
  const radialSpan = clampedOuter - innerRadius;
  const midAngle = (startAngle + endAngle) * 0.5;
  const halfAngle = Math.max(0.02, (endAngle - startAngle) * 0.5);

  // Micro-asimetría orgánica reproducible por semilla
  const asymAngle = organicNoise1D(0.37, seed) * halfAngle * noiseIntensity;
  const asymRadius = organicNoise1D(0.73, seed) * radialSpan * noiseIntensity;

  // La base del pétalo (uña) es más estrecha que el lóbulo medio para dar aspecto floral
  const baseHalfAngle = halfAngle * 0.42;
  const baseLeft = polarToCartesian(cx, cy, innerRadius, midAngle - baseHalfAngle);
  const baseRight = polarToCartesian(cx, cy, innerRadius, midAngle + baseHalfAngle);

  // Ápice del pétalo
  const tipAngle = midAngle + asymAngle;
  const tipRadius = clampedOuter + asymRadius;
  const tipPoint = polarToCartesian(cx, cy, tipRadius, tipAngle);

  // Puntos de control de primer orden (ensanchamiento basal / cadera del pétalo)
  const shoulderRadius = innerRadius + radialSpan * 0.36;
  const shoulderSpread = halfAngle * (0.75 + curvature * 0.65);
  const cp1Left = polarToCartesian(cx, cy, shoulderRadius, midAngle - shoulderSpread);
  const cp1Right = polarToCartesian(cx, cy, shoulderRadius, midAngle + shoulderSpread);

  // Puntos de control de segundo orden (lóbulo superior y agudeza apical)
  const lobeRadius =
    innerRadius + radialSpan * (0.94 - Math.min(1, Math.max(0, tipSharpness)) * 0.22);
  const lobeSpread =
    halfAngle * (1.15 - Math.min(1, Math.max(0, tipSharpness)) * 0.82) * curvature;

  const cp2Left = polarToCartesian(
    cx,
    cy,
    lobeRadius,
    tipAngle - Math.max(0.01, lobeSpread)
  );
  const cp2Right = polarToCartesian(
    cx,
    cy,
    lobeRadius,
    tipAngle + Math.max(0.01, lobeSpread)
  );

  // Punto de control para cerrar la base siguiendo la curvatura cóncava/convexa del pistilo
  const pistilMid = polarToCartesian(cx, cy, innerRadius * 0.94, midAngle);

  return [
    `M ${fmt(baseLeft.x)} ${fmt(baseLeft.y)}`,
    `C ${fmt(cp1Left.x)} ${fmt(cp1Left.y)}, ${fmt(cp2Left.x)} ${fmt(cp2Left.y)}, ${fmt(tipPoint.x)} ${fmt(tipPoint.y)}`,
    `C ${fmt(cp2Right.x)} ${fmt(cp2Right.y)}, ${fmt(cp1Right.x)} ${fmt(cp1Right.y)}, ${fmt(baseRight.x)} ${fmt(baseRight.y)}`,
    `Q ${fmt(pistilMid.x)} ${fmt(pistilMid.y)}, ${fmt(baseLeft.x)} ${fmt(baseLeft.y)}`,
    'Z',
  ].join(' ');
}

/**
 * Genera el patrón de venación (nervadura central y nervios secundarios arqueados)
 * para el interior de un pétalo.
 */
export function generatePetalVenationPath(params: PetalGeometryParams): string {
  const {
    cx,
    cy,
    startAngle,
    endAngle,
    innerRadius,
    outerRadius,
    curvature,
    seed = 0.5,
  } = params;

  const clampedOuter = Math.max(innerRadius + 4, outerRadius);
  const radialSpan = clampedOuter - innerRadius;
  const midAngle = (startAngle + endAngle) * 0.5;
  const halfAngle = Math.max(0.02, (endAngle - startAngle) * 0.5);

  const veinStart = polarToCartesian(cx, cy, innerRadius, midAngle);
  const veinEnd = polarToCartesian(cx, cy, innerRadius + radialSpan * 0.86, midAngle);
  const veinCtrl = polarToCartesian(
    cx,
    cy,
    innerRadius + radialSpan * 0.45,
    midAngle + organicNoise1D(0.5, seed) * halfAngle * 0.08
  );

  const subVeins: string[] = [
    `M ${fmt(veinStart.x)} ${fmt(veinStart.y)} Q ${fmt(veinCtrl.x)} ${fmt(veinCtrl.y)}, ${fmt(veinEnd.x)} ${fmt(veinEnd.y)}`,
  ];

  // Dos pares de nervaduras secundarias acródromas/camptódromas
  const branchFractions = [0.28, 0.52];
  for (const frac of branchFractions) {
    const originR = innerRadius + radialSpan * frac;
    const targetR = innerRadius + radialSpan * (frac + 0.26);
    const spread = halfAngle * 0.55 * curvature * (1.1 - frac * 0.5);

    const originPt = polarToCartesian(cx, cy, originR, midAngle);
    const leftTarget = polarToCartesian(cx, cy, targetR, midAngle - spread);
    const rightTarget = polarToCartesian(cx, cy, targetR, midAngle + spread);

    const leftCtrl = polarToCartesian(
      cx,
      cy,
      (originR + targetR) * 0.52,
      midAngle - spread * 0.45
    );
    const rightCtrl = polarToCartesian(
      cx,
      cy,
      (originR + targetR) * 0.52,
      midAngle + spread * 0.45
    );

    subVeins.push(
      `M ${fmt(originPt.x)} ${fmt(originPt.y)} Q ${fmt(leftCtrl.x)} ${fmt(leftCtrl.y)}, ${fmt(leftTarget.x)} ${fmt(leftTarget.y)}`,
      `M ${fmt(originPt.x)} ${fmt(originPt.y)} Q ${fmt(rightCtrl.x)} ${fmt(rightCtrl.y)}, ${fmt(rightTarget.x)} ${fmt(rightTarget.y)}`
    );
  }

  return subVeins.join(' ');
}

/**
 * Calcula la geometría completa de una enredadera (VineBarChart):
 * 1. Trazado cerrado con ahusamiento alométrico (`bodyPath`).
 * 2. Trazado central (`centerlinePath`).
 * 3. Nudos filotácticos con vectores normales y tangentes (`nodes`) para posicionar hojas.
 * 4. Punto y orientación del ápice (`apex`) para zarcillos.
 */
export function generateVineSkeleton(params: VineGeometryParams): VineSkeletonResult {
  const {
    startX,
    startY,
    endX,
    endY,
    baseThickness,
    tipThickness,
    swayAmplitude,
    swayFrequency,
    seed,
    segments = 16,
  } = params;

  const dx = endX - startX;
  const dy = endY - startY;
  const totalLength = Math.hypot(dx, dy);

  if (totalLength < 1e-3) {
    const fallbackPt: OrientedPoint2D = {
      x: startX,
      y: startY,
      t: 0,
      angleDeg: -90,
      normalX: 1,
      normalY: 0,
      side: 1,
    };
    return {
      bodyPath: `M ${fmt(startX)} ${fmt(startY)} Z`,
      centerlinePath: `M ${fmt(startX)} ${fmt(startY)}`,
      nodes: [],
      apex: fallbackPt,
    };
  }

  // Vector director unitario u y vector ortogonal v
  const ux = dx / totalLength;
  const uy = dy / totalLength;
  const vx = -uy;
  const vy = ux;

  const phaseSign = seed >= 0.5 ? 1 : -1;
  const phaseOffset = seed * TWO_PI;

  /**
   * Evalúa un punto en el eje central de la enredadera para t ∈ [0, 1].
   * La envolvente sin(π·t)^0.85 garantiza anclaje exacto en t=0 y oscilación suave en el ascenso.
   */
  const evaluateCenterPoint = (t: number): Point2D => {
    const axialDist = t * totalLength;
    // Amortiguación si el tallo aún es muy corto (crecimiento inicial)
    const lengthScale = Math.min(1, totalLength / 80);
    const envelope = Math.pow(Math.sin(Math.PI * Math.min(0.96, t * 0.92)), 0.85);
    const primaryWave = Math.sin(t * Math.PI * swayFrequency * 2 + phaseOffset);
    const secondaryWave = 0.3 * organicNoise1D(t * 1.5, seed);
    const lateralOffset =
      phaseSign * swayAmplitude * lengthScale * envelope * (primaryWave + secondaryWave);

    return {
      x: startX + ux * axialDist + vx * lateralOffset,
      y: startY + uy * axialDist + vy * lateralOffset,
    };
  };

  const spinePoints: Point2D[] = [];
  const leftContour: Point2D[] = [];
  const rightContour: Point2D[] = [];
  const sampledOriented: OrientedPoint2D[] = [];

  const dt = 1 / segments;
  const eps = 0.005;

  for (let i = 0; i <= segments; i++) {
    const t = i * dt;
    const center = evaluateCenterPoint(t);
    spinePoints.push(center);

    // Derivada numérica centrada para obtener tangente y normal exactas
    const tPrev = Math.max(0, t - eps);
    const tNext = Math.min(1, t + eps);
    const pPrev = evaluateCenterPoint(tPrev);
    const pNext = evaluateCenterPoint(tNext);

    const tx = pNext.x - pPrev.x;
    const ty = pNext.y - pPrev.y;
    const tLen = Math.hypot(tx, ty) || 1;
    const unitTx = tx / tLen;
    const unitTy = ty / tLen;

    // Normal unitaria (rotación de -90° respecto a la tangente)
    const normalX = -unitTy;
    const normalY = unitTx;
    const angleDeg = Math.atan2(unitTy, unitTx) * RAD_TO_DEG;

    // Ley de ahusamiento alométrico (tapering botánico no lineal)
    const halfWidth =
      0.5 * (baseThickness + (tipThickness - baseThickness) * Math.pow(t, 0.72));

    leftContour.push({
      x: center.x + normalX * halfWidth,
      y: center.y + normalY * halfWidth,
    });
    rightContour.push({
      x: center.x - normalX * halfWidth,
      y: center.y - normalY * halfWidth,
    });

    sampledOriented.push({
      x: center.x,
      y: center.y,
      t,
      angleDeg,
      normalX,
      normalY,
      side: i % 2 === 0 ? 1 : -1,
    });
  }

  // Construcción del contorno cerrado: sube por margen izquierdo, redondea ápice y baja por margen derecho
  const rightReversed = [...rightContour].reverse();
  const leftCommands = pointsToSmoothBezierCommands(leftContour, 0.3);
  const rightCommands = pointsToSmoothBezierCommands(rightReversed, 0.3).replace(
    /^M [^C]+/,
    `L ${fmt(rightReversed[0].x)} ${fmt(rightReversed[0].y)}`
  );

  const bodyPath = `${leftCommands} ${rightCommands} Z`;
  const centerlinePath = pointsToSmoothBezierCommands(spinePoints, 0.32);

  // Selección de nudos intermedios (excluyendo extrema base y extremo ápice) para inserción de hojas
  const nodes: OrientedPoint2D[] = [];
  for (let i = 2; i < sampledOriented.length - 1; i += 2) {
    nodes.push(sampledOriented[i]);
  }

  const apex = sampledOriented[sampledOriented.length - 1];

  return {
    bodyPath,
    centerlinePath,
    nodes,
    apex,
  };
}

/**
 * Genera el trazado de un zarcillo botánico (espiral logarítmica/arquimediana amortiguada)
 * que nace en un nudo o en el ápice de una enredadera.
 */
export function generateTendrilPath(params: TendrilGeometryParams): string {
  const { origin, angleDeg, length, coils, chirality } = params;
  if (length <= 1 || coils <= 0.1) {
    return `M ${fmt(origin.x)} ${fmt(origin.y)}`;
  }

  const steps = Math.max(12, Math.round(coils * 10));
  const baseRad = angleDeg * DEG_TO_RAD;
  const points: Point2D[] = [origin];

  let currentX = origin.x;
  let currentY = origin.y;
  const stepLength = length / steps;

  for (let i = 1; i <= steps; i++) {
    const s = i / steps;
    // Curvatura progresiva: el zarcillo se proyecta primero y se enrolla hacia su punta
    const spiralAngle =
      baseRad + chirality * Math.pow(s, 1.45) * coils * TWO_PI;
    const radiusDecay = stepLength * (1 - 0.55 * s);

    currentX += Math.cos(spiralAngle) * radiusDecay;
    currentY += Math.sin(spiralAngle) * radiusDecay;
    points.push({ x: currentX, y: currentY });
  }

  return pointsToSmoothBezierCommands(points, 0.38);
}

/**
 * Genera un tallo leñoso u orgánico que conecta una secuencia de puntos
 * (usado por AxisHelper para sustituir la línea de dominio y por StemLineChart).
 */
export function generateStemPath(params: StemGeometryParams): string {
  const { points, roughness, seed } = params;
  if (points.length < 2) return '';

  const subdivided: Point2D[] = [];
  const subdivisionsPerSegment = 6;

  for (let i = 0; i < points.length - 1; i++) {
    const pA = points[i];
    const pB = points[i + 1];
    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const segLen = Math.hypot(dx, dy) || 1;
    const nx = -dy / segLen;
    const ny = dx / segLen;

    const steps = i === points.length - 2 ? subdivisionsPerSegment : subdivisionsPerSegment - 1;
    for (let s = 0; s <= steps; s++) {
      const localT = s / subdivisionsPerSegment;
      const globalT = (i + localT) / (points.length - 1);
      // Los extremos exactos (0 y 1) se mantienen fijos para alinear con márgenes/escalas
      const pinEnvelope = Math.sin(Math.PI * localT);
      const disp =
        organicNoise1D(globalT * 3.5, seed + i * 0.17) * roughness * pinEnvelope;

      subdivided.push({
        x: pA.x + dx * localT + nx * disp,
        y: pA.y + dy * localT + ny * disp,
      });
    }
  }

  return pointsToSmoothBezierCommands(subdivided, 0.32);
}

/**
 * Ruido coherente periódico en el ángulo (período 2π) para contornos cerrados.
 * A diferencia de `organicNoise1D`, solo usa armónicos enteros, por lo que el contorno
 * cierra sin costura. Rango aproximado [-1, 1].
 */
export function organicPeriodicNoise(angleRad: number, seed: number): number {
  const h2 = Math.sin(angleRad * 2 + seed * TWO_PI);
  const h3 = 0.55 * Math.sin(angleRad * 3 + seed * 19.193);
  const h5 = 0.3 * Math.cos(angleRad * 5 + seed * 37.719);
  const h9 = 0.15 * Math.sin(angleRad * 9 + seed * 53.311);
  return (h2 + h3 + h5 + h9) / 2;
}

/**
 * Variante cerrada de `pointsToSmoothBezierCommands`: spline Catmull-Rom periódica
 * que termina en `Z` con continuidad C1 en el punto de cierre.
 */
export function pointsToClosedSmoothBezierCommands(
  points: readonly Point2D[],
  tension = 1 / 6
): string {
  const n = points.length;
  if (n < 3) return '';

  const segments: string[] = [`M ${fmt(points[0].x)} ${fmt(points[0].y)}`];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    segments.push(
      `C ${fmt(p1.x + (p2.x - p0.x) * tension)} ${fmt(p1.y + (p2.y - p0.y) * tension)}, ` +
        `${fmt(p2.x - (p3.x - p1.x) * tension)} ${fmt(p2.y - (p3.y - p1.y) * tension)}, ` +
        `${fmt(p2.x)} ${fmt(p2.y)}`
    );
  }
  segments.push('Z');
  return segments.join(' ');
}

/**
 * Punto del contorno de un anillo de crecimiento de radio medio `radius` en el ángulo
 * `angleRad` (convención D3: 0 = 12 en punto, sentido horario).
 * El contorno es homotético respecto a (cx, cy): todos los anillos del tronco quedan anidados.
 */
export function treeRingPointAt(
  params: Pick<TreeRingGeometryParams, 'cx' | 'cy' | 'wobble' | 'eccentricity' | 'seed'>,
  radius: number,
  angleRad: number
): Point2D {
  const { cx, cy, wobble, eccentricity, seed } = params;
  const shape = 1 + wobble * organicPeriodicNoise(angleRad, seed);
  const eccAngle = seed * TWO_PI;
  return {
    x: cx + radius * (eccentricity * Math.cos(eccAngle) + shape * Math.sin(angleRad)),
    y: cy + radius * (eccentricity * Math.sin(eccAngle) - shape * Math.cos(angleRad)),
  };
}

/**
 * Genera el trazado de un anillo de crecimiento como banda cerrada
 * (contorno exterior + contorno interior), pensado para `fill-rule="evenodd"`.
 * Con `innerRadius ≈ 0` devuelve un disco macizo (médula).
 */
export function generateTreeRingPath(params: TreeRingGeometryParams): string {
  const { innerRadius, outerRadius, samples = 48 } = params;

  const loop = (radius: number): string => {
    const pts: Point2D[] = [];
    for (let i = 0; i < samples; i++) {
      pts.push(treeRingPointAt(params, radius, (i / samples) * TWO_PI));
    }
    return pointsToClosedSmoothBezierCommands(pts);
  };

  const outer = loop(Math.max(0.5, outerRadius));
  return innerRadius > 0.5 ? `${outer} ${loop(innerRadius)}` : outer;
}

/**
 * Esqueleto de una rama leñosa: curva cúbica que sale tangente a la rama madre
 * (`startAngleDeg`) y se dirige al extremo, con perturbación coherente anclada en ambos
 * extremos y ahusamiento alométrico entre `baseThickness` y `tipThickness`.
 */
export function generateBranchSkeleton(params: BranchGeometryParams): BranchSkeletonResult {
  const { x0, y0, x1, y1, startAngleDeg, baseThickness, tipThickness, gnarl, seed } = params;
  const length = Math.hypot(x1 - x0, y1 - y0);

  if (length < 1e-3) {
    return {
      bodyPath: `M ${fmt(x0)} ${fmt(y0)} Z`,
      apex: { x: x0, y: y0, t: 1, angleDeg: startAngleDeg, normalX: 0, normalY: 0, side: 1 },
    };
  }

  const startRad = startAngleDeg * DEG_TO_RAD;
  const c1x = x0 + Math.cos(startRad) * length * 0.42;
  const c1y = y0 + Math.sin(startRad) * length * 0.42;
  const arriveLen = Math.hypot(x1 - c1x, y1 - c1y) || 1;
  const c2x = x1 - ((x1 - c1x) / arriveLen) * length * 0.25;
  const c2y = y1 - ((y1 - c1y) / arriveLen) * length * 0.25;

  const evaluate = (t: number): Point2D => {
    const inv = 1 - t;
    const b0 = inv * inv * inv;
    const b1 = 3 * inv * inv * t;
    const b2 = 3 * inv * t * t;
    const b3 = t * t * t;
    const bx = b0 * x0 + b1 * c1x + b2 * c2x + b3 * x1;
    const by = b0 * y0 + b1 * c1y + b2 * c2y + b3 * y1;
    // Perturbación perpendicular a la cuerda, anclada (sin(πt)) para conectar exactamente con madre e hijas
    const disp = gnarl * Math.sin(Math.PI * t) * organicNoise1D(t * 1.3, seed);
    return {
      x: bx - ((y1 - y0) / length) * disp,
      y: by + ((x1 - x0) / length) * disp,
    };
  };

  const segments = 10;
  const eps = 0.005;
  const left: Point2D[] = [];
  const right: Point2D[] = [];
  let apex: OrientedPoint2D | null = null;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const c = evaluate(t);
    const pPrev = evaluate(Math.max(0, t - eps));
    const pNext = evaluate(Math.min(1, t + eps));
    const tLen = Math.hypot(pNext.x - pPrev.x, pNext.y - pPrev.y) || 1;
    const ux = (pNext.x - pPrev.x) / tLen;
    const uy = (pNext.y - pPrev.y) / tLen;
    const halfWidth =
      0.5 * (baseThickness + (tipThickness - baseThickness) * Math.pow(t, 0.8));

    left.push({ x: c.x - uy * halfWidth, y: c.y + ux * halfWidth });
    right.push({ x: c.x + uy * halfWidth, y: c.y - ux * halfWidth });

    if (i === segments) {
      apex = {
        x: c.x,
        y: c.y,
        t: 1,
        angleDeg: Math.atan2(uy, ux) * RAD_TO_DEG,
        normalX: -uy,
        normalY: ux,
        side: seed >= 0.5 ? 1 : -1,
      };
    }
  }

  const leftCommands = pointsToSmoothBezierCommands(left, 0.3);
  const rightCommands = pointsToSmoothBezierCommands([...right].reverse(), 0.3).replace(
    /^M/,
    'L'
  );

  return {
    bodyPath: `${leftCommands} ${rightCommands} Z`,
    apex: apex ?? { x: x1, y: y1, t: 1, angleDeg: startAngleDeg, normalX: 0, normalY: 0, side: 1 },
  };
}

/**
 * Interpolación lineal en espacio de parámetros de una rama para `.tween(...)`.
 */
export function interpolateBranchParams(
  from: BranchGeometryParams,
  to: BranchGeometryParams,
  t: number
): BranchGeometryParams {
  const inv = 1 - t;
  return {
    x0: from.x0 * inv + to.x0 * t,
    y0: from.y0 * inv + to.y0 * t,
    x1: from.x1 * inv + to.x1 * t,
    y1: from.y1 * inv + to.y1 * t,
    startAngleDeg: from.startAngleDeg * inv + to.startAngleDeg * t,
    baseThickness: from.baseThickness * inv + to.baseThickness * t,
    tipThickness: from.tipThickness * inv + to.tipThickness * t,
    gnarl: from.gnarl * inv + to.gnarl * t,
    seed: to.seed,
  };
}

/**
 * Genera interpolador de parámetros geométricos de un pétalo para `attrTween('d', ...)`.
 * Garantiza un morphing matemáticamente exacto de las curvas Bézier durante las transiciones.
 */
export function createPetalPathInterpolator(
  from: PetalGeometryParams,
  to: PetalGeometryParams
): (t: number) => string {
  return (t: number): string => {
    const inv = 1 - t;
    return generatePetalPath({
      cx: from.cx * inv + to.cx * t,
      cy: from.cy * inv + to.cy * t,
      startAngle: from.startAngle * inv + to.startAngle * t,
      endAngle: from.endAngle * inv + to.endAngle * t,
      innerRadius: from.innerRadius * inv + to.innerRadius * t,
      outerRadius: from.outerRadius * inv + to.outerRadius * t,
      curvature: from.curvature * inv + to.curvature * t,
      tipSharpness: from.tipSharpness * inv + to.tipSharpness * t,
      noiseIntensity:
        (from.noiseIntensity ?? 0.03) * inv + (to.noiseIntensity ?? 0.03) * t,
      seed: to.seed ?? from.seed ?? 0.5,
    });
  };
}

/**
 * Genera interpolador del esqueleto completo de una enredadera para `t ∈ [0, 1]`.
 * Permite animar simultáneamente el cuerpo del tallo, sus hojas y su zarcillo apical.
 */
export function interpolateVineParams(
  from: VineGeometryParams,
  to: VineGeometryParams,
  t: number
): VineGeometryParams {
  const inv = 1 - t;
  return {
    startX: from.startX * inv + to.startX * t,
    startY: from.startY * inv + to.startY * t,
    endX: from.endX * inv + to.endX * t,
    endY: from.endY * inv + to.endY * t,
    baseThickness: from.baseThickness * inv + to.baseThickness * t,
    tipThickness: from.tipThickness * inv + to.tipThickness * t,
    swayAmplitude: from.swayAmplitude * inv + to.swayAmplitude * t,
    swayFrequency: from.swayFrequency * inv + to.swayFrequency * t,
    seed: to.seed,
    segments: to.segments ?? from.segments ?? 16,
  };
}

// Re-export de utilidades agrupadas para consumo tanto funcional (tree-shakable) como por namespace
export const OrganicGeometry = {
  hashStringToSeed,
  organicNoise1D,
  polarToCartesian,
  pointsToSmoothBezierCommands,
  generatePetalPath,
  generatePetalVenationPath,
  generateVineSkeleton,
  generateTendrilPath,
  generateStemPath,
  createPetalPathInterpolator,
  interpolateVineParams,
  organicPeriodicNoise,
  pointsToClosedSmoothBezierCommands,
  treeRingPointAt,
  generateTreeRingPath,
  generateBranchSkeleton,
  interpolateBranchParams,
  HALF_PI,
  TWO_PI,
} as const;

