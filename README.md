# 🌿 nature-chart

> Botanical and organic parametric data visualization library in **TypeScript** built on **D3.js v7+** and bundled with **Vite**.

Transform rigid Cartesian charts into living, botanical morphologies: cubic Bézier flower corollas, allometrically tapered climbing vines, phyllotactic `<use>` leaf foliage, coiling tendrils, and woody branching stems.

---

## 📽️ Demo Showcase

<p align="center">
  <video src="videos/nature-charts.mp4" width="100%" controls autoplay loop muted playsinline>
    <a href="videos/nature-charts.mp4">🌿 View Demo Video (videos/nature-charts.mp4)</a>
  </video>
</p>

*Video preview of the interactive Herbarium showcase displaying living botanical charts with real-time morphing transitions, organic displacement filters, and dynamic updates.*

---

## ✨ Key Botanical Visual Metaphors

Standard charts rely on rigid rectangular bars (`<rect>`), circular wedges (`d3.arc()`), and uniform linear ticks (`d3-axis`). `nature-chart` replaces rigid geometry with biologically informed parametric mathematical models:

| Chart | Botanical Metaphor | Visual Encodings |
| :--- | :--- | :--- |
| **`PetalPieChart`** | Floral Corolla & Pistil | Polar cubic Bézier petals (length $\propto$ value, curvature $\propto$ efficiency), radial stamens with anthers, acrodromous venation, and central pistil disc. |
| **`VineBarChart`** | Climbing Vines & Tendrils | Allometrically tapered sinusoidal stems (height $\propto$ primary value), Frenet–Serret positioned `<use>` leaves (count $\propto$ secondary metric), and apical logarithmic spiral tendrils (vigor $\propto$ tertiary metric). |
| **`StemLineChart`** | Woody Stems & Rootlets | Continuous woody trunk modulated by coherent harmonic noise, cauline axillary buds at inflection points, and lateral rootlets/bifurcations for secondary series. |
| **`TreeRingChart`** | Dendrochronology Cross-Section | Nested homothetic annual growth rings around an organic pith, radial vascular rays, rugged cambium/bark perimeter, and an interactive labeled core sample boring. |
| **`BranchTreeChart`** | Leonardo da Vinci Pipe Model | Hierarchical tree network where branch cross-sectional area follows Leonardo's pipe model ($\sum d_{\text{child}}^2 = d_{\text{parent}}^2$, thickness $\propto \sqrt{\text{subtree value}}$), ending in terminal `<use>` leaf clusters. |
| **`LeafScatterChart`** | Phyllotactic Foliage Canopy | Multidimensional scatter marks rendered as instanced `<use>` botanical leaves; area encoded by blade scale, hue encoded by cultivar taxon, and orientation aligned to an optional continuous angle. |

---

## 🏛️ Core Principles & Architecture

### 1. Deterministic Coherent Organicism
- **Zero random flickering at 60fps**: Pure deterministic organic variation.
- Never call raw `Math.random()` inside path generators or transition tweens.
- Every datum is hashed via `hashStringToSeed(key)` and sampled using deterministic harmonic coherent noise (`organicNoise1D(t, seed)`), ensuring smooth, reproducible geometry across renders and resizes.

### 2. Parameter-Space Morphing
- When data updates or transitions occur, `nature-chart` avoids glitchy SVG path string interpolation.
- Instead, it smoothly interpolates the underlying parametric configuration objects (`PetalGeometryParams`, `VineGeometryParams`) inside D3 transition tweens (`attrTween('d', ...)`), recalculating valid organic splines frame-by-frame.

### 3. SVG `<defs>` & `<use>` Instancing
- High-performance rendering of repetitive botanical elements (leaves, thorns, buds, stem nodes).
- Shared templates are generated once inside `ChartEnvironment` `<defs>` and instanced across thousands of positions using hardware-accelerated SVG `<use>` elements aligned along Frenet–Serret normal and tangent frames.

### 4. Layer & Lifecycle Discipline
- Coordinated through `ChartEnvironment` and `BaseChart<TData, TConfig>`:
  - `backgroundLayer`: Background textures and organic paper canvas.
  - `axisLayer`: Organic stem domain axes and `<use>` thorn/node ticks via `AxisHelper`.
  - `chartLayer`: Primary botanical morphologies.
  - `overlayLayer`: Interactive overlays, tooltips, and inspection highlights.
- Built-in `ResizeObserver` with debounced `requestAnimationFrame` render queue.

### 5. Strict TypeScript & Tree-Shakable D3
- 100% strict TypeScript types (`strict: true`, zero `any`).
- Modular sub-package imports (`d3-selection`, `d3-scale`, `d3-shape`, `d3-array`, `d3-ease`, `d3-transition`, `d3-hierarchy`) with `"sideEffects": false`.

---

## 📦 Project Structure

```text
nature-chart/
├── packages/
│   └── core/
│       ├── index.html                  # Herbarium interactive showcase
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                # Public exports barrel
│           ├── types.ts                # Strict geometry interfaces, palettes & accessors
│           ├── main.ts                 # Showcase playground implementation
│           ├── example.ts              # Consumer integration reference
│           ├── core/
│           │   ├── ChartEnvironment.ts # SVG container, layers, <defs> & render queue
│           │   ├── BaseChart.ts        # Abstract chart base class
│           │   └── AxisHelper.ts       # Botanical axis with stem & thorn/node ticks
│           ├── geometry/
│           │   └── OrganicGeometry.ts  # Pure math: Béziers, Frenet frames, noise, spirals
│           └── charts/
│               ├── PetalPieChart.ts    # Floral polar corolla
│               ├── VineBarChart.ts     # Climbing vine bar chart
│               ├── StemLineChart.ts    # Woody stem & rootlet chart
│               ├── TreeRingChart.ts    # Dendrochronological cross-section
│               ├── BranchTreeChart.ts  # Pipe-model hierarchical tree
│               └── LeafScatterChart.ts # Instanced leaf scatter plot
├── videos/
│   └── nature-charts.mp4               # Showcase recording
├── claude.md                           # Project instructions & verification rules
└── package.json                        # Monorepo workspace configuration
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm (v9+ with workspace support)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/nature-chart.git
cd nature-chart
npm install
```

### Essential Commands

```bash
# Start Vite development server with hot-reload (http://localhost:5173/)
npm run dev

# Run strict TypeScript validation (tsc --noEmit)
npm run typecheck

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

> **Note**: As defined in `claude.md`, all code changes must pass `npm run typecheck` with zero errors.

---

## 💡 Quick Usage Example

```typescript
import {
  ChartEnvironment,
  PetalPieChart,
  VineBarChart,
  type PollinatorSpeciesMetric,
  type BotanicalCultivarGrowth
} from '@nature-chart/core';

// 1. Initialize the botanical SVG environment
const env = new ChartEnvironment({
  container: '#chart-container',
  margin: { top: 40, right: 40, bottom: 40, left: 40 },
  enableOrganicFilter: true, // Applies subtle botanical SVG turbulence displacement
  roughness: 1.5,
});

// 2. Instantiate a PetalPieChart
interface PollinatorMetric {
  speciesId: string;
  name: string;
  visits: number;
  efficiency: number;
}

const petalChart = new PetalPieChart<PollinatorMetric>(env, {
  keyAccessor: (d) => d.speciesId,
  labelAccessor: (d) => d.name,
  valueAccessor: (d) => d.visits,
  curvatureAccessor: (d) => d.efficiency,
  polarMode: 'equal-angle-variable-length',
  pistilRadiusRatio: 0.15,
  tipSharpness: 0.38,
  showVenation: true,
  showStamens: true,
  transition: {
    duration: 900,
    delayPerItem: 50,
  },
});

// 3. Render and update data reactively
const data: PollinatorMetric[] = [
  { speciesId: 'apis', name: 'Apis mellifera', visits: 85, efficiency: 92 },
  { speciesId: 'bombus', name: 'Bombus terrestris', visits: 64, efficiency: 78 },
  { speciesId: 'osmia', name: 'Osmia bicornis', visits: 42, efficiency: 65 },
  { speciesId: 'xylocopa', name: 'Xylocopa violacea', visits: 55, efficiency: 88 },
];

petalChart.update(data);
```

---

## 🎨 Botanical Palette System

`nature-chart` ships with an earthy botanical palette designed for high aesthetic contrast and natural tone harmony:

```typescript
export const DEFAULT_BOTANICAL_PALETTE: BotanicalPalette = {
  primaryStem: '#2D4A22',      // Deep forest stem
  secondaryStem: '#3F6131',    // Olive leaf shoot
  leafFill: '#5B8C3E',         // Vibrant canopy green
  leafStroke: '#1E3517',       // Shadow venation
  barkDark: '#3A2618',         // Deep bark furrow
  barkLight: '#7A5C43',        // Weathered sapwood
  petalColors: [
    '#D95D39',                 // Poetic terracotta
    '#E08E45',                 // Marigold amber
    '#C44961',                 // Deep peony rose
    '#E8B838',                 // Wild mustard gold
    '#7E6B8F',                 // Alpine violet
    '#588B8B',                 // Sage succulent
  ],
  pith: '#E8D8B8',             // Raw parchment pith
  accentPollen: '#F2C94C',     // Vibrant stamen anther pollen
  accentSap: '#A4C3B2',        // Translucent sap flow
};
```

---

## 📄 License

This project is licensed under the ISC License. See [LICENSE](./LICENSE) for details.

