# CLAUDE.md — Project Instructions for `nature-chart`

## Project Overview
`nature-chart` is a botanical and organic parametric data visualization library in **TypeScript** built on **D3.js v7+** and bundled with **Vite**. Visual encodings use nature and botany metaphors (cubic Bézier flower petals, allometrically tapered climbing vines, phyllotactic `<use>` leaves, coiling tendrils, and woody stems).

---

## Essential Commands
- `npm run dev` — Start Vite HMR development server (`http://localhost:5173/`)
- `npm run typecheck` — Run strict TypeScript validation (`tsc --noEmit`)
- `npm run build` — Compile TypeScript and build production bundle (`tsc && vite build`)
- `npm run preview` — Preview the production Vite build

> **Verification Rule**: Every code change MUST pass `npm run typecheck` with zero errors before completion.

---

## Architecture & Module Map

- **[`src/types.ts`](./packages/core/src/types.ts)**: Central contract definitions. Contains all geometry parameter interfaces, `BotanicalPalette`, `ChartDimensions`, generic data accessors (`KeyAccessor<T>`, `NumericAccessor<T>`, `StringAccessor<T>`), and chart configurations.
- **[`src/geometry/OrganicGeometry.ts`](./packages/core/src/geometry/OrganicGeometry.ts)**: Pure mathematical utilities:
  - `hashStringToSeed(key)` & `organicNoise1D(t, seed)` — Deterministic $C^\infty$ harmonic coherent noise.
  - `generatePetalPath(params)` & `generatePetalVenationPath(params)` — Polar cubic Bézier petals and acrodromous venation.
  - `generateVineSkeleton(params)` — Computes tapered stem `bodyPath`, vascular `centerlinePath`, Frenet-Serret `nodes` (`OrientedPoint2D` with normal/tangent vectors), and `apex`.
  - `generateTendrilPath(params)` — Decaying Archimedean/logarithmic spiral tendrils.
  - `generateStemPath(params)` — Coherently perturbed woody stems.
- **[`src/core/ChartEnvironment.ts`](./packages/core/src/core/ChartEnvironment.ts)**: Orchestrates the `<svg>`, `ResizeObserver`, `requestAnimationFrame` render queue (`scheduleRender`), layer groups (`backgroundLayer`, `axisLayer`, `chartLayer`, `overlayLayer`), and shared `<defs>` (`#...-leaf`, `#...-thorn`, `#...-node`, `#...-bud`, organic displacement filter, gradients).
- **[`src/core/BaseChart.ts`](./packages/core/src/core/BaseChart.ts)**: Abstract base class for all charts (`BaseChart<TData, TConfig>`), standardizing `init()`, `update(data)`, `resize(dimensions)`, and `destroy()`.
- **[`src/core/AxisHelper.ts`](./packages/core/src/core/AxisHelper.ts)**: Replaces rigid `d3-axis` domain lines with organic stems and renders ticks using `<use href="#...">` (`thorn`, `node`, `leaf`). Supports both continuous (`ScaleLinear`, `ScaleTime`) and ordinal (`ScaleBand`, `ScalePoint`) D3 scales.
- **[`src/charts/`](./packages/core/src/charts/)**:
  - `PetalPieChart.ts` — Polar floral chart with Bézier petals, stamens, and central pistil.
  - `VineBarChart.ts` — Climbing vine bar chart encoding primary height, secondary foliage (`<use>` leaves), and tertiary apical tendrils.
  - `StemLineChart.ts` — Continuous woody stem chart with buds and lateral bifurcations.
- **[`index.html`](./packages/core/index.html) & [`src/main.ts`](./packages/core/src/main.ts)**: Interactive Herbarium playground served by Vite.

---

## Strict Coding & Design Rules

### 1. Mathematical & Visual Rules
- **No Rigid Primitives**: Do not use `<rect>`, `d3.arc()`, or `d3-axis` for data representation. Use parametric cubic Bézier curves (`M ... C ... Z`) and organic splines from `OrganicGeometry.ts`.
- **Deterministic Randomness**: Never use `Math.random()` inside geometry builders or transition tweens (causes flickering at 60fps). Always derive a seed from the datum key via `hashStringToSeed(key)` and call `organicNoise1D(t, seed)`.
- **Parameter-Space Morphing**: Interpolate geometry parameter objects (`PetalGeometryParams`, `VineGeometryParams`) inside `attrTween('d', ...)` or `.tween(...)` rather than interpolating raw SVG path strings.

### 2. D3.js v7+ & DOM Performance Rules
- **Strict `selection.join()`**: Always use `.selectAll(...).data(data, keyFn).join(enter, update, exit)` with an explicit key function. Never wipe containers with `.selectAll('*').remove()` on data updates.
- **SVG `<defs>` + `<use>` Instancing**: Repetitive decorative elements (leaves, thorns, buds, stem nodes) must be defined once in `ChartEnvironment` `<defs>` and instantiated via `<use href="#...">` transformed along curve normals/tangents.
- **Modular D3 Imports**: Import from individual sub-packages (`d3-selection`, `d3-scale`, `d3-shape`, `d3-array`, `d3-ease`, `d3-transition`) to preserve tree-shaking (`"sideEffects": false`).

### 3. TypeScript & Behavioral Guidelines
- **Strict Typing (Zero `any`)**: Respect all compiler flags in `tsconfig.json` (`strict`, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`).
- **Think Before Coding**: State assumptions explicitly; surface tradeoffs rather than guessing silently.
- **Simplicity First**: Write the minimum code that solves the problem cleanly. Avoid speculative abstractions.
- **Surgical Changes**: Touch only the lines necessary for the request. Preserve existing comments, formatting, and architecture.

