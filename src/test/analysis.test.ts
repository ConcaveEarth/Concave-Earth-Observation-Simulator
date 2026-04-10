import { describe, expect, it } from "vitest";
import {
  applyPresetToModel,
  buildObserverViewPanelData,
  buildProfileVisibilityPanelData,
  buildRayBundlePanelData,
  buildRouteMapPanelData,
  buildSkyWrapPanelData,
  buildSweepChartData,
  defaultComparisonModel,
  defaultPrimaryModel,
  defaultScenario,
  getPresetById,
  solveVisibility,
} from "../domain";

describe("analysis helpers", () => {
  it("builds compare sweep series with the requested sample count", () => {
    const data = buildSweepChartData({
      scenario: defaultScenario,
      primaryModel: defaultPrimaryModel,
      comparisonModel: defaultComparisonModel,
      focusedModel: "primary",
      compareMode: true,
      config: {
        parameter: "distance",
        metric: "hiddenHeight",
        rangeMode: "focused",
        sampleCount: 12,
      },
    });

    expect(data.series).toHaveLength(2);
    expect(data.series[0].points).toHaveLength(12);
    expect(data.range.max).toBeGreaterThan(data.range.min);
  });

  it("keeps the convex Aconcagua visibility sweep monotonic as distance increases", () => {
    const preset = getPresetById("aconcagua-study");
    const data = buildSweepChartData({
      scenario: preset.scenario,
      primaryModel: applyPresetToModel(defaultPrimaryModel, preset.primaryModel),
      comparisonModel: applyPresetToModel(defaultComparisonModel, preset.comparisonModel),
      focusedModel: "primary",
      compareMode: false,
      config: {
        parameter: "distance",
        metric: "visibilityFraction",
        rangeMode: "operational",
        sampleCount: 18,
      },
    });

    const values = data.series[0].points
      .map((point) => point.y)
      .filter((value): value is number => value != null);

    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]).toBeLessThanOrEqual(values[index - 1] + 1e-6);
    }
  });

  it("builds a ray bundle panel from shared solver outputs", () => {
    const result = solveVisibility(defaultScenario, defaultPrimaryModel);
    const panel = buildRayBundlePanelData(result, "Model 1", "primary");

    expect(panel.surfacePoints.length).toBeGreaterThan(20);
    expect(panel.samplePoints).toHaveLength(defaultScenario.targetSampleCount);
    expect(panel.stats.visibleSamples + panel.stats.blockedSamples).toBe(
      defaultScenario.targetSampleCount,
    );
    expect(panel.bounds.maxX).toBeGreaterThan(panel.bounds.minX);
  });

  it("builds a terrain-aware profile visibility panel from shared solver outputs", () => {
    const result = solveVisibility(defaultScenario, defaultComparisonModel);
    const panel = buildProfileVisibilityPanelData(result, "Model 2", "comparison");

    expect(panel.profilePolyline.length).toBeGreaterThan(10);
    expect(panel.profileSegments.length).toBeGreaterThan(5);
    expect(panel.samplePoints.length).toBeGreaterThan(10);
    expect(panel.stats.visibleSamples + panel.stats.blockedSamples).toBe(
      panel.samplePoints.length,
    );
    expect(panel.bounds.maxY).toBeGreaterThan(panel.bounds.minY);
  });

  it("builds an observer-eye reconstruction panel from shared solver outputs", () => {
    const result = solveVisibility(defaultScenario, defaultComparisonModel);
    const panel = buildObserverViewPanelData(result, "Model 2", "comparison");

    expect(panel.ghostSilhouette.length).toBeGreaterThan(10);
    expect(panel.samplePoints.length).toBeGreaterThan(10);
    expect(panel.bounds.maxX).toBeGreaterThan(panel.bounds.minX);
    expect(panel.bounds.maxY).toBeGreaterThan(panel.bounds.minY);
  });

  it("builds a coordinate route-map panel from scenario coordinates", () => {
    const result = solveVisibility(
      {
        ...defaultScenario,
        coordinates: {
          enabled: true,
          observerLatDeg: 29.95,
          observerLonDeg: -90.07,
          targetLatDeg: 30.02,
          targetLonDeg: -89.78,
        },
      },
      defaultPrimaryModel,
    );
    const panel = buildRouteMapPanelData(result, "Route Map", "primary");

    expect(panel.coordinatesEnabled).toBe(true);
    expect(panel.routeDistanceM).toBeGreaterThan(0);
    expect(panel.routePoints.length).toBeGreaterThan(10);
    expect(panel.bearingDeg).toBeGreaterThanOrEqual(0);
    expect(panel.bearingDeg).toBeLessThanOrEqual(360);
  });

  it("seeds a usable preview route when a preset has no distinct stored coordinates yet", () => {
    const result = solveVisibility(defaultScenario, defaultPrimaryModel);
    const panel = buildRouteMapPanelData(result, "Route Map", "primary");

    expect(panel.usesPreviewSeed).toBe(true);
    expect(panel.routeDistanceM).toBeGreaterThan(20_000);
    expect(panel.routePoints.length).toBeGreaterThan(10);
    expect(panel.observerPoint.latDeg).not.toBe(panel.targetPoint.latDeg);
    expect(panel.observerPoint.lonDeg).not.toBe(panel.targetPoint.lonDeg);
  });

  it("builds a sky-wrap panel with grid and ray families", () => {
    const result = solveVisibility(defaultScenario, defaultComparisonModel);
    const panel = buildSkyWrapPanelData(result, "Sky Wrap", "comparison");

    expect(panel.gridCurves.length).toBeGreaterThan(2);
    expect(panel.rayCurves.length).toBeGreaterThan(3);
    expect(panel.bounds.maxX).toBeGreaterThan(panel.bounds.minX);
    expect(panel.bounds.maxY).toBeGreaterThan(panel.bounds.minY);
    expect(panel.domeRadius).toBeGreaterThan(0);
  });

  it("reports concave intrinsic as upward and normal atmosphere as downward in sky-wrap stats", () => {
    const result = solveVisibility(defaultScenario, defaultComparisonModel);
    const panel = buildSkyWrapPanelData(result, "Sky Wrap", "comparison");

    expect(panel.stats.intrinsicLabel).toContain("upward");
    expect(panel.stats.atmosphereLabel).toContain("downward");
  });
});
