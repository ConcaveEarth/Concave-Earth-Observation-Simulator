# Concave-Earth-Observation-Simulator

Demo : https://truemodeloftheworld.github.io/Concave-Earth-Observation-Simulator/

Observation Geometry Lab is a Vite + React + TypeScript web app for comparing
long-range observation scenarios across convex-sphere and concave-shell models
with one shared 2D ray-path engine.

## Current Milestone

The app has moved beyond a bare scaffold and now functions as a professional
comparison-first observation lab milestone:

- Shared convex/concave solver with one scenario driving both model outputs
- Cross-section view with labeled constructions, horizons, actual vs apparent
  lines, hidden height, and model transparency outputs
- Split compare workspace with scene-first professional layout
- Export/share workflow, presets, multilingual UI foundation, themes, and unit
  switching
- Interactive legend, feature inspection, fullscreen scene workspace, and
  solver-backed terrain/profile overlays
- Observer-eye reconstruction tab that converts solved apparent elevations into
  a perceptual horizon-and-silhouette view
- Route Map workspace that uses observer/target coordinates to derive great-circle
  distance and bearing, with a draggable route preview in the scene area
- Sky Wrap workspace for inspecting intrinsic and atmospheric bend behavior in a
  dedicated dome-style view instead of forcing it into the cross-section scene
- Layered atmosphere controls with base/upper coefficients, transition height,
  and inversion settings for richer optical experiments
- Export/report maturity with PNG export, JSON scenario export, and HTML report
  export for documenting or sharing scenarios
- Modernized UI and analytics foundation using Radix UI primitives and an
  ECharts-powered sweep workspace, while keeping the custom geometry renderer
  and shared solver domain intact
- Shared viewport utilities and workstation-style scroll areas that unify
  analysis sizing, pan/zoom behavior, and panel scrolling across the newer
  analysis tools
- Coordinate-derived scenario routing groundwork, so observer/target latitude
  and longitude can drive great-circle distance and bearing
- Terrain-aware obstruction support in the shared solver, allowing preset-linked
  terrain/profile silhouettes to block rays along the traced path instead of
  remaining purely illustrative

This milestone is the baseline we can safely build on before deeper analytical
features such as full map-backed scenario selection, continuous terrain-aware
obstruction along the whole path, richer observer-eye reconstruction, and later
sky/celestial modeling.

## Included Now

- Cross-section visualization driven by a shared simulation result object
- Side-by-side or stacked compare mode for Model 1 vs Model 2
- Convex and concave geometry support
- Intrinsic concave curvature presets: `none`, `1/R`, `2/R`, `constant`
- Signed atmospheric coefficient range from `-0.99` to `+0.99`
- Hidden-height, visibility-fraction, apparent-angle, and horizon outputs
- Ray Bundle analysis view driven by sampled target-point visibility solutions
- Profile Visibility analysis view that samples terrain/profile silhouettes through
  the shared solver instead of treating them as pure decoration
- Optional coordinate route inputs that derive surface distance from latitude /
  longitude and the active shell or sphere radius
- Route Map analysis tab for interactive coordinate review and route geometry
- Scenario modes for both quick experimentation and more field-style studies:
  `Simple` mode keeps total observer/target elevations lightweight, while
  `Field` mode splits observer site elevation, observer eye height, target base
  elevation, and target object height
- Preset provenance metadata, including verification status, assumptions, and
  source-inspired notes so demonstration presets and source-derived cases are
  clearly distinguished
- Observer View analysis tab that reconstructs the apparent horizon and visible
  silhouette from solved sample elevations
- Sky Wrap analysis tab that visualizes intrinsic bending, atmospheric bending,
  and net dome-style ray families
- Sweep analysis view for parameter-vs-output comparison curves
- Layered atmosphere mode with altitude transition and inversion controls
- URL-serializable state plus PNG, JSON, and HTML report export
- Domain, state, and UI separation with Vitest coverage
- Radix-powered collapsible sections, navigation dropdowns, and analysis tabs
- Radix ScrollArea-powered control, data, and legend docks
- ECharts-backed sweep analysis with responsive resizing and split bundles for
  faster initial loading
- Shared D3-backed viewport helpers for the non-cross-section analysis SVG
  views, improving maintainability and future framing work

## Near-Term Roadmap

- Tighten remaining line/path fidelity in the cross-section constructions
- Deepen ray-bundle analytics and visibility-envelope explanations
- Expand sweep metrics, performance, and field-style scenario controls
- Advance the current route-map groundwork into fuller map-backed scenario
  selection and route editing
- Deepen terrain/profile obstruction from profile-sampled solver participation into
  more complete obstruction handling along the path
- Refine observer-eye reconstruction and later extend sky-wrap toward
  celestial/dome studies

## Scripts

```bash
npm install
npm run dev
npm run check
npm run test
npm run build
```

## Structure

- `src/domain`: pure geometry, curvature, ray tracing, solver, presets, scene model
- `src/state`: centralized app state and URL serialization
- `src/ui`: Radix-enhanced controls, analysis tabs, renderers, analytics panels,
  export helpers
- `src/test`: domain, state, and UI tests

## GitHub Pages

This repo is configured for project-site deployment on GitHub Pages.

- Expected site URL: `https://concaveearth.github.io/Concave-Earth-Observation-Simulator/`
- Deployment workflow: `.github/workflows/deploy-pages.yml`
- Requirement: push the current branch to `main`, then enable Pages in the repository settings if GitHub has not auto-enabled the workflow-backed source yet.
