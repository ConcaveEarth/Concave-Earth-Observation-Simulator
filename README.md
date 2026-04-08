# Concave-Earth-Observation-Simulator

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

This milestone is the baseline we can safely build on before deeper analytical
features such as observer-eye reconstruction, terrain-aware obstruction, and
map workflows.

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
- Sweep analysis view for parameter-vs-output comparison curves
- URL-serializable state plus PNG export
- Domain, state, and UI separation with Vitest coverage

## Near-Term Roadmap

- Tighten remaining line/path fidelity in the cross-section constructions
- Deepen ray-bundle analytics and visibility-envelope explanations
- Expand sweep metrics and scenario controls
- Deepen terrain/profile obstruction from profile-sampled solver participation into
  more complete obstruction handling along the path
- Add observer-eye reconstruction and later sky-wrap / celestial views

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
- `src/ui`: controls, analysis tabs, renderers, analytics panels, export helpers
- `src/test`: domain, state, and UI tests

## GitHub Pages

This repo is configured for project-site deployment on GitHub Pages.

- Expected site URL: `https://concaveearth.github.io/Concave-Earth-Observation-Simulator/`
- Deployment workflow: `.github/workflows/deploy-pages.yml`
- Requirement: push the current branch to `main`, then enable Pages in the repository settings if GitHub has not auto-enabled the workflow-backed source yet.
