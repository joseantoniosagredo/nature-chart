import {
  BranchTreeChart,
  ChartEnvironment,
  LeafScatterChart,
  PetalPieChart,
  StemLineChart,
  TreeRingChart,
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
// 4. TREE RING CHART (Dendrocronología)
// ============================================================================

interface AnnualGrowth {
  readonly year: number;
  readonly ringWidthMm: number;
}

let ringYears = 24;

function generateRingSeries(count: number): AnnualGrowth[] {
  return Array.from({ length: count }, (_, idx) => ({
    year: 2000 + idx,
    // Crecimiento juvenil vigoroso que decrece con la edad + variabilidad climática
    ringWidthMm: Number((1.2 + 2.6 * Math.exp(-idx / 9) + Math.random() * 1.6).toFixed(2)),
  }));
}

const ringEnv = new ChartEnvironment({
  container: '#ring-chart-container',
  margin: { top: 20, right: 20, bottom: 20, left: 20 },
  enableOrganicFilter: false,
});

const ringChart = new TreeRingChart<AnnualGrowth>(ringEnv, {
  keyAccessor: (d) => d.year,
  valueAccessor: (d) => d.ringWidthMm,
  labelAccessor: (d) => String(d.year),
  ariaLabel: 'Anchura de anillos de crecimiento por año',
});

let ringData = generateRingSeries(ringYears);
ringChart.init();
ringChart.update(ringData);

// ============================================================================
// 5. BRANCH TREE CHART (Jerarquía Taxonómica)
// ============================================================================

interface TaxonNode {
  readonly id: string;
  readonly parent: string | null;
  readonly name: string;
  readonly specimens: number;
}

const TAXONOMY: ReadonlyArray<Omit<TaxonNode, 'specimens'>> = [
  { id: 'plantae', parent: null, name: 'Plantae' },
  { id: 'rosaceae', parent: 'plantae', name: 'Rosaceae' },
  { id: 'rosa', parent: 'rosaceae', name: 'Rosa' },
  { id: 'prunus', parent: 'rosaceae', name: 'Prunus' },
  { id: 'malus', parent: 'rosaceae', name: 'Malus' },
  { id: 'fagaceae', parent: 'plantae', name: 'Fagaceae' },
  { id: 'quercus', parent: 'fagaceae', name: 'Quercus' },
  { id: 'fagus', parent: 'fagaceae', name: 'Fagus' },
  { id: 'lamiaceae', parent: 'plantae', name: 'Lamiaceae' },
  { id: 'salvia', parent: 'lamiaceae', name: 'Salvia' },
  { id: 'lavandula', parent: 'lamiaceae', name: 'Lavandula' },
  { id: 'thymus', parent: 'lamiaceae', name: 'Thymus' },
  { id: 'mentha', parent: 'lamiaceae', name: 'Mentha' },
  { id: 'pinaceae', parent: 'plantae', name: 'Pinaceae' },
  { id: 'pinus', parent: 'pinaceae', name: 'Pinus' },
  { id: 'abies', parent: 'pinaceae', name: 'Abies' },
];

let includePinaceae = true;

function generateTaxonData(): TaxonNode[] {
  return TAXONOMY.filter(
    (t) => includePinaceae || (t.id !== 'pinaceae' && t.parent !== 'pinaceae')
  ).map((t) => ({ ...t, specimens: Math.round(4 + Math.random() * 46) }));
}

const treeEnv = new ChartEnvironment({
  container: '#tree-chart-container',
  margin: { top: 16, right: 16, bottom: 8, left: 16 },
  enableOrganicFilter: true,
  roughness: 1.2,
});

const treeChart = new BranchTreeChart<TaxonNode>(treeEnv, {
  keyAccessor: (d) => d.id,
  parentAccessor: (d) => d.parent,
  valueAccessor: (d) => d.specimens,
  labelAccessor: (d) => d.name,
  ariaLabel: 'Especímenes del herbario por familia y género',
});

treeChart.init();
treeChart.update(generateTaxonData());

// ============================================================================
// 6. LEAF SCATTER CHART (Rasgos Foliares)
// ============================================================================

interface LeafTraitSample {
  readonly sampleId: string;
  readonly species: string;
  readonly lightLevel: number;
  readonly photosynthesis: number;
  readonly leafAreaCm2: number;
}

const SCATTER_SPECIES = ['Quercus ilex', 'Fagus sylvatica', 'Salvia officinalis'] as const;

function generateLeafSamples(): LeafTraitSample[] {
  return Array.from({ length: 36 }, (_, idx) => {
    const species = SCATTER_SPECIES[idx % SCATTER_SPECIES.length];
    const speciesIdx = idx % SCATTER_SPECIES.length;
    const light = Math.round(80 + Math.random() * 1400);
    // Curva de saturación lumínica con asíntota distinta por especie
    const pMax = [14, 10, 18][speciesIdx];
    return {
      sampleId: `s-${idx}`,
      species,
      lightLevel: light,
      photosynthesis: Number(
        (pMax * (1 - Math.exp(-light / 380)) + (Math.random() - 0.5) * 2.5).toFixed(1)
      ),
      leafAreaCm2: Math.round(6 + Math.random() * 60),
    };
  });
}

const leafEnv = new ChartEnvironment({
  container: '#leaf-chart-container',
  margin: { top: 24, right: 36, bottom: 48, left: 56 },
  enableOrganicFilter: false,
});

const leafChart = new LeafScatterChart<LeafTraitSample>(leafEnv, {
  keyAccessor: (d) => d.sampleId,
  xAccessor: (d) => d.lightLevel,
  yAccessor: (d) => d.photosynthesis,
  sizeAccessor: (d) => d.leafAreaCm2,
  groupAccessor: (d) => d.species,
  labelAccessor: (d) =>
    `${d.species} · ${d.lightLevel} µmol/m²s · ${d.photosynthesis} µmol CO₂ · ${d.leafAreaCm2} cm²`,
  ariaLabel: 'Fotosíntesis frente a luz por especie',
});

leafChart.init();
leafChart.update(generateLeafSamples());

// ============================================================================
// 7. CONTROLES INTERACTIVOS DEL DOM
// ============================================================================

document.getElementById('btn-ring-randomize')?.addEventListener('click', () => {
  ringData = generateRingSeries(ringYears);
  ringChart.update(ringData);
});

document.getElementById('btn-ring-add')?.addEventListener('click', () => {
  ringYears++;
  ringData = [...ringData, ...generateRingSeries(ringYears).slice(-1)];
  ringChart.update(ringData);
});

document.getElementById('btn-tree-randomize')?.addEventListener('click', () => {
  treeChart.update(generateTaxonData());
});

document.getElementById('btn-tree-toggle')?.addEventListener('click', () => {
  includePinaceae = !includePinaceae;
  treeChart.update(generateTaxonData());
});

document.getElementById('btn-leaf-randomize')?.addEventListener('click', () => {
  leafChart.update(generateLeafSamples());
});

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
  ringData = generateRingSeries(ringYears);
  ringChart.update(ringData);
  treeChart.update(generateTaxonData());
  leafChart.update(generateLeafSamples());
});

const widthSlider = document.getElementById('width-slider') as HTMLInputElement | null;
const widthLabel = document.getElementById('width-label');
const dashboardGrid = document.getElementById('dashboard-grid');

widthSlider?.addEventListener('input', () => {
  const pct = widthSlider.value;
  if (widthLabel) widthLabel.textContent = `${pct}%`;
  if (dashboardGrid) dashboardGrid.style.width = `${pct}%`;
});

