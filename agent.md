# Agent Development Guide (`d3-plant-lib`)

This document defines the architectural, mathematical, performance, and coding rules for any AI agent or developer contributing to **`d3-plant-lib`**.

---

## 1. Core Philosophy & Aesthetic Invariants

`d3-plant-lib` is a botanical and organic data visualization library built on **D3.js v7+** and **TypeScript**.

1. **No Rigid Geometry**: Never render standard rectangular bars (`<rect>`), straight axis lines (`d3-axis`), or circular pie wedges (`d3.arc`). Every datum must be expressed through parametric botanical morphology:
   - **Petals**: Closed polar cubic Bézier curves with venation and stamens (`PetalPieChart`).
   - **Vines / Stems**: Sinusoidally swaying, allometrically tapered stems with phyllotactic leaves and coiling apical tendrils (`VineBarChart`).
   - **Woody Stems / Roots**: Coherently perturbed spline trunks with cauline buds and lateral bifurcations (`StemLineChart`).
2. **Deterministic Organicism**: Organic imperfections must be 100% reproducible per datum key. **Never** call `Math.random()` inside path generators or transition loops. Always hash the datum key via `hashStringToSeed(key)` and sample `organicNoise1D(t, seed)`.

---

## 2. Project Architecture & Separation of Concerns

```text
src/
├── types.ts                     # Strict interfaces, generics, accessors, and chart configs (zero `any`)
├── index.ts                     # Public barrel file (tree-shakable exports)
├── main.ts                      # Vite interactive playground entry
├── example.ts                   # Reference consumer integration
├── core/
│   ├── ChartEnvironment.ts      # SVG lifecycle, ResizeObserver, rAF render queue, layers & shared <defs>
│   ├── BaseChart.ts             # Abstract base class enforcing init(), update(), resize(), destroy()
│   └── AxisHelper.ts            # Botanical axes replacing d3-axis with stems & <use> ticks
├── geometry/
│   └── OrganicGeometry.ts       # Pure mathematical functions for parametric curves & Frenet-Serret frames
└── charts/
    ├── PetalPieChart.ts         # Floral polar chart
    ├── VineBarChart.ts          # Multi-metric climbing vine chart
    └── StemLineChart.ts         # Woody stem & rootlet time/continuous series chart
```

### Architectural Rules
- **Composition over Inheritance for Environment**: Charts receive a `ChartEnvironment` instance in their constructor and extend `BaseChart<TData, TConfig>`.
- **Layer Discipline**: Always render into the appropriate `ChartEnvironment` layer:
  - `env.backgroundLayer` — background textures or grids
  - `env.axisLayer` — `AxisHelper` botanical axes
  - `env.chartLayer` — chart instances (`this.chartGroup`)
  - `env.overlayLayer` — tooltips, annotations, or interactive overlays
- **Pure Geometry Module**: All curve math, normal/tangent vector calculations, and path string builders belong in `src/geometry/OrganicGeometry.ts` as pure functions with zero DOM/D3 selection dependencies.

---

## 3. D3.js v7+ & Performance Rules

1. **Strict `selection.join()` Pattern**:
   - Every data-driven DOM update must use `.selectAll(...).data(items, keyFn).join(enter, update, exit)`.
   - Always pass a deterministic key function (`(d) => d.key`) to `.data(...)`.
   - Never clear and rebuild SVG containers (`selectAll('*').remove()`) inside `onUpdate()`.
2. **Shared `<defs>` and `<use>` Instancing**:
   - Repetitive botanical ornaments (leaves `#...-leaf`, thorns `#...-thorn`, buds `#...-bud`, stem nodes `#...-node`) must be defined once in `ChartEnvironment.initializeSharedDefs()` and instantiated via `<use href="#...">`.
   - Position and orient `<use>` elements using 2D Frenet-Serret tangent/normal frames (`transform="translate(x, y) rotate(deg) scale(s)"`).
3. **Parameter-Space Morphing (`attrTween` / `.tween`)**:
   - Never rely on raw string interpolation of SVG `d` attributes when curve topology or control points change.
   - Store the previous geometry parameter struct in a `Map<string | number, GeometryParams>` keyed by `keyAccessor`, and interpolate the mathematical parameters for $t \in [0, 1]$ inside `attrTween('d', ...)` or `.tween(...)`.
   - Always interrupt active transitions before starting new ones when needed (`selection.interrupt()`) and keep `will-change: transform, opacity` on animated groups.
4. **Tree-Shaking & Modular D3 Imports**:
   - Import only from specific D3 sub-packages (`d3-selection`, `d3-scale`, `d3-shape`, `d3-array`, `d3-ease`, `d3-transition`).
   - Do **not** use monolithic `import * as d3 from 'd3'`.

---

## 4. TypeScript & Code Quality Standards

- **Zero `any` Policy**: `tsconfig.json` enforces `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`, `"noUnusedLocals": true`, and `"noUnusedParameters": true`.
- **Generic Data Models**: Every chart class must be generic (`class MyChart<TData> extends BaseChart<TData, MyChartConfig<TData>>`) and access user data exclusively through typed accessors (`KeyAccessor<TData>`, `NumericAccessor<TData>`, `StringAccessor<TData>`).
- **Compact SVG Paths**: Round floating-point coordinates in SVG `d` strings to 2 decimal places (`fmt(val)`) to keep DOM attributes compact and fast to parse.
- **Surgical Changes & Simplicity**:
  - Write the minimum code required to solve the problem cleanly.
  - Do not introduce speculative abstractions or modify unrelated files.
  - Preserve existing comments and documentation integrity.

---

## 5. Recipe: Adding a New Botanical Chart

1. **Define Types (`src/types.ts`)**:
   - Add `NewChartGeometryParams` and `NewChartConfig<TData> extends BaseChartConfig<TData>`.
2. **Implement Parametric Math (`src/geometry/OrganicGeometry.ts`)**:
   - Write pure path generators and parameter interpolators using `organicNoise1D` and cubic Bézier commands.
3. **Implement the Chart Class (`src/charts/NewChart.ts`)**:
   - Extend `BaseChart<TData, NewChartConfig<TData>>`.
   - Implement `onInit()`, `onResize(dimensions)`, `onUpdate(data, dimensions)`, and `onDestroy()`.
   - Cache previous geometry states by key for smooth `attrTween` transitions.
4. **Export & Wire Up (`src/index.ts` & `src/main.ts`)**:
   - Re-export the chart and its types in `src/index.ts`.
   - Add an interactive specimen card in `index.html` / `src/main.ts` if showcasing in the playground.
5. **Verify**:
   - Run `npm run typecheck` and `npm run build`.

---

## 6. Commands & Verification Workflow

Always verify changes using the project scripts before concluding a task:

```bash
# 1. Typecheck (must exit with 0 errors)
npm run typecheck

# 2. Start Vite HMR dev server (http://localhost:5173/)
npm run dev

# 3. Verify production bundle & TypeScript declarations
npm run build
```

