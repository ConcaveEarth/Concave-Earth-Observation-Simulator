# Concave-Earth-Observation-Simulator

Observation Geometry Lab is a Vite + React + TypeScript web app for comparing
long-range observation scenarios across convex-sphere and concave-shell models
with one shared 2D ray-path engine.

## Included in this V1 scaffold

- Cross-section visualization driven by a shared simulation result object
- Side-by-side compare mode for primary vs comparison models
- Convex and concave geometry support
- Intrinsic concave curvature presets: `none`, `1/R`, `2/R`, `constant`
- Simple additive atmosphere coefficient
- Hidden-height, visibility-fraction, apparent-angle, and horizon outputs
- URL-serializable state plus PNG export
- Domain, state, and UI separation with Vitest coverage

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
- `src/ui`: controls, renderer, right-rail analytics, export helpers
- `src/test`: domain, state, and UI tests

## GitHub Pages

This repo is configured for project-site deployment on GitHub Pages.

- Expected site URL: `https://concaveearth.github.io/Concave-Earth-Observation-Simulator/`
- Deployment workflow: `.github/workflows/deploy-pages.yml`
- Requirement: push the current branch to `main`, then enable Pages in the repository settings if GitHub has not auto-enabled the workflow-backed source yet.
