import { PetalPieChart } from './charts/PetalPieChart';
import { VineBarChart } from './charts/VineBarChart';
import { ChartEnvironment } from './core/ChartEnvironment';

// ============================================================================
// 1. DEFINICIÓN DE MODELOS DE DOMINIO DEL CONSUMIDOR (100% Tipado Estricto)
// ============================================================================

export interface PollinatorSpeciesMetric {
  readonly speciesId: string;
  readonly commonName: string;
  /** Visitas florales por hora -> controla la longitud del pétalo */
  readonly visitsPerHour: number;
  /** Eficiencia de polinización (0 a 100) -> controla la curvatura/apertura del pétalo */
  readonly nectarEfficiency: number;
}

export interface BotanicalCultivarGrowth {
  readonly cultivarCode: string;
  readonly specimenName: string;
  /** Biomasa vertical en cm -> controla la altura de la enredadera */
  readonly stemHeightCm: number;
  /** Índice de área foliar -> controla número y escala de hojas <use> */
  readonly leafAreaIndex: number;
  /** Vigor de agarre -> controla las espirales del zarcillo apical */
  readonly tendrilVigor: number;
}

// ============================================================================
// 2. MONTAJE E INSTANCIACIÓN REACTIVA SOBRE CONTENEDORES HTML
// ============================================================================

export function mountBotanicalDashboard(
  flowerContainerSelector: string | HTMLElement,
  vineContainerSelector: string | HTMLElement
): {
  triggerSeasonalUpdate: () => void;
  dispose: () => void;
} {
  // --- A. Instanciación del PetalPieChart ---
  const flowerEnv = new ChartEnvironment({
    container: flowerContainerSelector,
    margin: { top: 40, right: 40, bottom: 40, left: 40 },
    enableOrganicFilter: true,
    roughness: 1.6,
  });

  const petalChart = new PetalPieChart<PollinatorSpeciesMetric>(flowerEnv, {
    keyAccessor: (d) => d.speciesId,
    labelAccessor: (d) => d.commonName,
    valueAccessor: (d) => d.visitsPerHour,
    curvatureAccessor: (d) => d.nectarEfficiency,
    polarMode: 'equal-angle-variable-length',
    pistilRadiusRatio: 0.15,
    tipSharpness: 0.38,
    showVenation: true,
    showStamens: true,
    transition: {
      duration: 900,
      delayPerItem: 55,
    },
  });

  // Datos iniciales (Primavera)
  const springPollinators: readonly PollinatorSpeciesMetric[] = [
    { speciesId: 'apis-mellifera', commonName: 'Apis mellifera', visitsPerHour: 84, nectarEfficiency: 92 },
    { speciesId: 'bombus-terrestris', commonName: 'Bombus terrestris', visitsPerHour: 68, nectarEfficiency: 98 },
    { speciesId: 'xylocopa-violacea', commonName: 'Xylocopa violacea', visitsPerHour: 45, nectarEfficiency: 76 },
    { speciesId: 'syrphidae-sp', commonName: 'Episyrphus balteatus', visitsPerHour: 59, nectarEfficiency: 64 },
    { speciesId: 'osmia-bicornis', commonName: 'Osmia bicornis', visitsPerHour: 73, nectarEfficiency: 88 },
    { speciesId: 'vanessa-cardui', commonName: 'Vanessa cardui', visitsPerHour: 38, nectarEfficiency: 52 },
  ];

  petalChart.init();
  petalChart.update(springPollinators);

  // --- B. Instanciación del VineBarChart ---
  const vineEnv = new ChartEnvironment({
    container: vineContainerSelector,
    margin: { top: 48, right: 36, bottom: 54, left: 64 },
    enableOrganicFilter: true,
    roughness: 1.9,
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
    transition: {
      duration: 1050,
      delayPerItem: 65,
    },
  });

  const springCultivars: readonly BotanicalCultivarGrowth[] = [
    { cultivarCode: 'vitis-01', specimenName: 'Vitis vinifera', stemHeightCm: 142, leafAreaIndex: 4.8, tendrilVigor: 8.5 },
    { cultivarCode: 'passiflora-02', specimenName: 'Passiflora incarnata', stemHeightCm: 186, leafAreaIndex: 6.2, tendrilVigor: 9.8 },
    { cultivarCode: 'clematis-03', specimenName: 'Clematis vitalba', stemHeightCm: 118, leafAreaIndex: 3.9, tendrilVigor: 6.4 },
    { cultivarCode: 'hedera-04', specimenName: 'Hedera helix', stemHeightCm: 95, leafAreaIndex: 7.5, tendrilVigor: 4.2 },
    { cultivarCode: 'lonicera-05', specimenName: 'Lonicera caprifolium', stemHeightCm: 164, leafAreaIndex: 5.4, tendrilVigor: 7.9 },
  ];

  vineChart.init();
  vineChart.update(springCultivars);

  // --- C. Mutación reactiva de datos (ej. transición estacional a Verano) ---
  const triggerSeasonalUpdate = (): void => {
    const summerPollinators: readonly PollinatorSpeciesMetric[] = [
      { speciesId: 'apis-mellifera', commonName: 'Apis mellifera', visitsPerHour: 96, nectarEfficiency: 95 },
      { speciesId: 'bombus-terrestris', commonName: 'Bombus terrestris', visitsPerHour: 52, nectarEfficiency: 85 },
      { speciesId: 'xylocopa-violacea', commonName: 'Xylocopa violacea', visitsPerHour: 88, nectarEfficiency: 91 },
      { speciesId: 'syrphidae-sp', commonName: 'Episyrphus balteatus', visitsPerHour: 74, nectarEfficiency: 70 },
      { speciesId: 'osmia-bicornis', commonName: 'Osmia bicornis', visitsPerHour: 31, nectarEfficiency: 60 },
      { speciesId: 'macroglossum', commonName: 'Macroglossum stellatarum', visitsPerHour: 67, nectarEfficiency: 84 },
    ];

    const summerCultivars: readonly BotanicalCultivarGrowth[] = [
      { cultivarCode: 'vitis-01', specimenName: 'Vitis vinifera', stemHeightCm: 215, leafAreaIndex: 7.2, tendrilVigor: 9.4 },
      { cultivarCode: 'passiflora-02', specimenName: 'Passiflora incarnata', stemHeightCm: 240, leafAreaIndex: 8.1, tendrilVigor: 10.0 },
      { cultivarCode: 'clematis-03', specimenName: 'Clematis vitalba', stemHeightCm: 175, leafAreaIndex: 5.8, tendrilVigor: 8.2 },
      { cultivarCode: 'lonicera-05', specimenName: 'Lonicera caprifolium', stemHeightCm: 198, leafAreaIndex: 6.9, tendrilVigor: 8.8 },
      { cultivarCode: 'wisteria-06', specimenName: 'Wisteria sinensis', stemHeightCm: 228, leafAreaIndex: 8.6, tendrilVigor: 9.1 },
    ];

    petalChart.update(summerPollinators);
    vineChart.update(summerCultivars);
  };

  const dispose = (): void => {
    petalChart.destroy();
    vineChart.destroy();
    flowerEnv.destroy();
    vineEnv.destroy();
  };

  return { triggerSeasonalUpdate, dispose };
}

