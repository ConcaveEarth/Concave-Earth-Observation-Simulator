import { buildSceneViewModel, solveVisibility } from "../domain";
import {
  applyPresetToModel,
  defaultComparisonModel,
  defaultPrimaryModel,
  getPresetById,
} from "../domain/presets";
import { defaultUnitPreferences } from "../domain/units";

describe("scene view model", () => {
  const baseScenario = {
    scenarioMode: "simple" as const,
    observerHeightM: 45,
    observerSurfaceElevationM: 0,
    observerEyeHeightM: 45,
    targetHeightM: 35,
    targetBaseElevationM: 0,
    surfaceDistanceM: 58_000,
    radiusM: 6_371_000,
    targetSampleCount: 18,
    presetId: "elevated-observer",
    units: "metric" as const,
    coordinates: {
      enabled: false,
      observerLatDeg: 0,
      observerLonDeg: 0,
      targetLatDeg: 0,
      targetLonDeg: 0,
    },
  };

  it("creates a generic profile overlay when no preset-specific profile exists", () => {
    const result = solveVisibility(
      baseScenario,
      defaultPrimaryModel,
    );

    const scene = buildSceneViewModel(
      result,
      "Primary Model",
      "primary",
      defaultUnitPreferences,
    );

    expect(scene.terrainOverlay).toBeDefined();
    expect(scene.terrainOverlay?.line.featureId).toBe("terrain-profile");
    expect(scene.terrainOverlay?.spanDistanceM).toBeGreaterThan(0);
  });

  it("labels the core convex construction families", () => {
    const result = solveVisibility(
      baseScenario,
      defaultPrimaryModel,
    );

    const scene = buildSceneViewModel(
      result,
      "Primary Model",
      "primary",
      defaultUnitPreferences,
    );
    const labeledFeatures = new Set(scene.labels.map((label) => label.featureId));

    expect(labeledFeatures.has("surface")).toBe(true);
    expect(labeledFeatures.has("observer-horizontal")).toBe(true);
    expect(labeledFeatures.has("observer-altitude-curve")).toBe(true);
    expect(labeledFeatures.has("geometric-sightline")).toBe(true);
    expect(labeledFeatures.has("apparent-line")).toBe(true);
    expect(labeledFeatures.has("horizon-optical")).toBe(true);
    expect(labeledFeatures.has("horizon-geometric")).toBe(true);
    expect(labeledFeatures.has("observer-height")).toBe(true);
    expect(labeledFeatures.has("target-height")).toBe(true);

    if (scene.lines.some((line) => line.featureId === "source-light-path")) {
      expect(scene.lines.some((line) => line.featureId === "source-geometric-path")).toBe(
        true,
      );
      expect(labeledFeatures.has("source-light-path")).toBe(true);
    }

    if (scene.lines.some((line) => line.featureId === "actual-ray")) {
      expect(labeledFeatures.has("actual-ray")).toBe(true);
    }
  });

  it("uses a curvilinear tangent label for the concave reference curve", () => {
    const result = solveVisibility(
      baseScenario,
      defaultComparisonModel,
    );

    const scene = buildSceneViewModel(
      result,
      "Comparison Model",
      "comparison",
      defaultUnitPreferences,
    );

    expect(
      scene.annotations.find((annotation) => annotation.id === "observer-altitude-curve")
        ?.label,
    ).toBe("Curvilinear Tangent");
    expect(
      scene.labels.some(
        (label) =>
          label.featureId === "observer-altitude-curve" &&
          label.text.includes("Curvilinear Tangent"),
      ),
    ).toBe(true);
    expect(scene.visibilityPolygons?.length ?? 0).toBeGreaterThanOrEqual(1);
    const visibleRegion = scene.visibilityPolygons?.find(
      (polygon) => polygon.id === "visible-surface-region",
    );
    const shadowRegion = scene.visibilityPolygons?.find(
      (polygon) => polygon.id === "shadow-surface-region",
    );
    expect(visibleRegion).toBeDefined();
    expect(shadowRegion).toBeDefined();
    expect(
      visibleRegion?.points.some(
        (point) => Math.abs(point.x) < 1e-6 && Math.abs(point.y) < 1e-6,
      ) ?? false,
    ).toBe(false);
  });

  it("respects advanced line behavior overrides for scene construction", () => {
    const result = solveVisibility(
      baseScenario,
      {
        ...defaultPrimaryModel,
        lineBehavior: {
          ...defaultPrimaryModel.lineBehavior,
          referenceConstruction: "straight-horizontal",
          objectLightPath: "straight",
          showSourceGeometricPath: false,
          showObserverHorizontal: false,
        },
      },
    );

    const scene = buildSceneViewModel(
      result,
      "Primary Model",
      "primary",
      defaultUnitPreferences,
    );

    expect(scene.lines.some((line) => line.featureId === "source-geometric-path")).toBe(
      false,
    );
    expect(scene.segments.some((segment) => segment.featureId === "observer-horizontal")).toBe(
      false,
    );
    expect(
      scene.annotations.find((annotation) => annotation.id === "observer-altitude-curve")
        ?.label,
    ).toBe("Straight Horizontal Reference");
  });

  it("builds a Roxas-style concave Aconcagua line family with connected traced paths", () => {
    const preset = getPresetById("aconcagua-study");
    const result = solveVisibility(
      preset.scenario,
      applyPresetToModel(defaultComparisonModel, preset.comparisonModel),
    );

    const scene = buildSceneViewModel(
      result,
      "Comparison Model",
      "comparison",
      defaultUnitPreferences,
    );

    const sourceLightPath = scene.lines.find((line) => line.featureId === "source-light-path");
    const horizonTrace = scene.lines.find((line) => line.featureId === "horizon-optical");

    expect(
      scene.annotations.find((annotation) => annotation.id === "observer-altitude-curve")
        ?.label,
    ).toBe("Curvilinear Tangent");
    expect(scene.segments.some((segment) => segment.featureId === "observer-horizontal")).toBe(
      false,
    );
    expect(scene.segments.some((segment) => segment.featureId === "horizon-geometric")).toBe(
      false,
    );
    expect(sourceLightPath).toBeDefined();
    expect(sourceLightPath!.points.length).toBeGreaterThan(4);
    expect(horizonTrace).toBeDefined();
    expect(horizonTrace!.points.length).toBeGreaterThan(4);
    expect(sourceLightPath!.points[sourceLightPath!.points.length - 1].x).toBeCloseTo(0, 6);
    expect(sourceLightPath!.points[sourceLightPath!.points.length - 1].y).toBeCloseTo(0, 6);

    const start = sourceLightPath!.points[0];
    const end = sourceLightPath!.points[sourceLightPath!.points.length - 1];
    const midpoint = sourceLightPath!.points[Math.floor(sourceLightPath!.points.length / 2)];
    const chordMidY = start.y + (end.y - start.y) * 0.5;
    expect(Math.abs(midpoint.y - chordMidY)).toBeGreaterThan(10);
  });

  it("densifies traced display curves so rendered optical rays are smoother than raw solver traces", () => {
    const result = solveVisibility(baseScenario, defaultPrimaryModel);

    const scene = buildSceneViewModel(
      result,
      "Primary Model",
      "primary",
      defaultUnitPreferences,
    );
    const renderedOpticalRay = scene.lines.find(
      (line) => line.id === "optical-horizon-trace",
    );

    expect(result.opticalHorizon?.trace).toBeDefined();
    expect(renderedOpticalRay).toBeDefined();
    expect(renderedOpticalRay!.points.length).toBeGreaterThan(
      result.opticalHorizon!.trace!.points.length,
    );
  });
});
