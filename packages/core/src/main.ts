import {
  ChartEnvironment,
  PetalPieChart,
  StemLineChart,
  VineBarChart,
  type BotanicalCultivarGrowth,
  type PollinatorSpeciesMetric,
} from './index';

interface StemSeasonPoint {
  readonly monthIndex: number;
  readonly sapFlowRate: number;
  readonly rootletLength: number;
}

// ============================================================================
// 1. PETAL PIE CHART (Corola de Polinización)
// ============================================================================

const SPECIES_CATALOG: ReadonlyArray<
  Pick<PollinatorSpeciesMetric, 'speciesId' | 'commonName'>
> = [
  { speciesId: 'apis', commonName: 'Apis mellifera' },
  { speciesId: 'bombus', commonName: 'Bombus terrestris' },
  { speciesId: 'xylocopa', commonName: 'Xylocopa violacea' },
  { speciesId: 'syrphidae', commonName: 'Episyrphus' },
  { speciesId: 'osmia', commonName: 'Osmia bicornis' },
  { speciesId: 'vanessa', commonName: 'Vanessa cardui' },
  { speciesId: 'macroglossum', commonName: 'M. stellatarum' },
  { speciesId: 'halictus', commonName: 'Halictus scabiosae' },
];

let activePetalCount = 6;

function generatePollinatorData(count: number): PollinatorSpeciesMetric[] {
  return SPECIES_CATALOG.slice(0, count).map((sp) => ({
    ...sp,
    visitsPerHour: Math.round(28 + Math.random() * 72),
    nectarEfficiency: Math.round(40 + Math.random() * 60),
  }));
}

const flowerEnv = new ChartEnvironment({
  container: '#flower-chart-container',
  margin: { top: 32, right: 32, bottom: 32, left: 32 },
  enableOrganicFilter: true,
  roughness: 1.5,
});

const petalChart = new PetalPieChart<PollinatorSpeciesMetric>(flowerEnv, {
  keyAccessor: (d) => d.speciesId,
  labelAccessor: (d) => d.commonName,
  valueAccessor: (d) => d.visitsPerHour,
  curvatureAccessor: (d) => d.nectarEfficiency,
  polarMode: 'equal-angle-variable-length',
  pistilRadiusRatio: 0.14,
  maxRadiusRatio: 0.76,
  tipSharpness: 0.36,
  showVenation: true,
  showStamens: true,
});

petalChart.init();
petalChart.update(generatePollinatorData(activePetalCount));

// ============================================================================
// 2. VINE BAR CHART (Crecimiento de Cultivares)
// ============================================================================

const CULTIVAR_CATALOG: ReadonlyArray<
  Pick<BotanicalCultivarGrowth, 'cultivarCode' | 'specimenName'>
> = [
  { cultivarCode: 'vitis', specimenName: 'Vitis vinifera' },
  { cultivarCode: 'passiflora', specimenName: 'Passiflora' },
  { cultivarCode: 'clematis', specimenName: 'Clematis vitalba' },
  { cultivarCode: 'hedera', specimenName: 'Hedera helix' },
  { cultivarCode: 'lonicera', specimenName: 'Lonicera' },
  { cultivarCode: 'wisteria', specimenName: 'Wisteria sinensis' },
  { cultivarCode: 'humulus', specimenName: 'Humulus lupulus' },
];

let activeVineCount = 5;

function generateVineData(count: number): BotanicalCultivarGrowth[] {
  return CULTIVAR_CATALOG.slice(0, count).map((cv) => ({
    ...cv,
    stemHeightCm: Math.round(75 + Math.random() * 165),
    leafAreaIndex: Number((2.5 + Math.random() * 6.5).toFixed(1)),
    tendrilVigor: Number((3.0 + Math.random() * 7.0).toFixed(1)),
  }));
}

const vineEnv = new ChartEnvironment({
  container: '#vine-chart-container',
  margin: { top: 44, right: 28, bottom: 48, left: 56 },
  enableOrganicFilter: true,
  roughness: 1.8,
});

const vineChart = new VineBarChart<BotanicalCultivarGrowth>(vineEnv, {
  keyAccessor: (d) => d.cultivarCode,
  categoryAccessor: (d) => d.specimenName,
  primaryValueAccessor: (d) => d.stemHeightCm,
  foliageValueAccessor: (d) => d.leafAreaIndex,
  tendrilValueAccessor: (d) => d.tendrilVigor,
  baseThickness: 15,
  tipThickness: 2.5,
  swayAmplitude: 10,
  swayFrequency: 1.5,
});

vineChart.init();
vineChart.update(generateVineData(activeVineCount));

// ============================================================================
// 3. STEM LINE CHART (Flujo de Savia y Ramificación Leñosa)
// ============================================================================

function generateStemSeries(): StemSeasonPoint[] {
  return Array.from({ length: 9 }, (_, idx) => ({
    monthIndex: idx + 1,
    sapFlowRate: Math.round(25 + Math.sin(idx * 0.65) * 35 + Math.random() * 35),
    rootletLength: Math.round(12 + Math.random() * 22),
  }));
}

const stemEnv = new ChartEnvironment({
  container: '#stem-chart-container',
  margin: { top: 32, right: 36, bottom: 42, left: 56 },
  enableOrganicFilter: true,
  roughness: 1.6,
});

const stemChart = new StemLineChart<StemSeasonPoint>(stemEnv, {
  keyAccessor: (d) => d.monthIndex,
  xAccessor: (d) => d.monthIndex,
  yAccessor: (d) => d.sapFlowRate,
  branchValueAccessor: (d) => d.rootletLength,
  baseThickness: 5,
  roughness: 3.5,
});

stemChart.init();
stemChart.update(generateStemSeries());

// ============================================================================
// 4. CONTROLES INTERACTIVOS DEL DOM
// ============================================================================

document.getElementById('btn-petal-randomize')?.addEventListener('click', () => {
  petalChart.update(generatePollinatorData(activePetalCount));
});

document.getElementById('btn-petal-add')?.addEventListener('click', () => {
  if (activePetalCount < SPECIES_CATALOG.length) {
    activePetalCount++;
    petalChart.update(generatePollinatorData(activePetalCount));
  }
});

document.getElementById('btn-petal-remove')?.addEventListener('click', () => {
  if (activePetalCount > 3) {
    activePetalCount--;
    petalChart.update(generatePollinatorData(activePetalCount));
  }
});

document.getElementById('btn-vine-randomize')?.addEventListener('click', () => {
  vineChart.update(generateVineData(activeVineCount));
});

document.getElementById('btn-vine-add')?.addEventListener('click', () => {
  if (activeVineCount < CULTIVAR_CATALOG.length) {
    activeVineCount++;
    vineChart.update(generateVineData(activeVineCount));
  }
});

document.getElementById('btn-vine-remove')?.addEventListener('click', () => {
  if (activeVineCount > 2) {
    activeVineCount--;
    vineChart.update(generateVineData(activeVineCount));
  }
});

document.getElementById('btn-stem-randomize')?.addEventListener('click', () => {
  stemChart.update(generateStemSeries());
});

document.getElementById('btn-season-all')?.addEventListener('click', () => {
  petalChart.update(generatePollinatorData(activePetalCount));
  vineChart.update(generateVineData(activeVineCount));
  stemChart.update(generateStemSeries());
});

const widthSlider = document.getElementById('width-slider') as HTMLInputElement | null;
const widthLabel = document.getElementById('width-label');
const dashboardGrid = document.getElementById('dashboard-grid');

widthSlider?.addEventListener('input', () => {
  const pct = widthSlider.value;
  if (widthLabel) widthLabel.textContent = `${pct}%`;
  if (dashboardGrid) dashboardGrid.style.width = `${pct}%`;
});

