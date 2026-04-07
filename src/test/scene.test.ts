import { buildSceneViewModel, solveVisibility } from "../domain";
import { defaultComparisonModel, defaultPrimaryModel } from "../domain/presets";

describe("scene view model", () => {
  it("creates a generic profile overlay when no preset-specific profile exists", () => {
    const result = solveVisibility(
      {
        observerHeightM: 45,
        targetHeightM: 35,
        surfaceDistanceM: 58_000,
        radiusM: 6_371_000,
        targetSampleCount: 18,
        presetId: "elevated-observer",
        units: "metric",
      },
      defaultPrimaryModel,
    );

    const scene = buildSceneViewModel(result, "Primary Model", "primary");

    expect(scene.terrainOverlay).toBeDefined();
    expect(scene.terrainOverlay?.line.featureId).toBe("terrain-profile");
    expect(scene.terrainOverlay?.spanDistanceM).toBeGreaterThan(0);
  });

  it("labels the core convex construction families", () => {
    const result = solveVisibility(
      {
        observerHeightM: 45,
        targetHeightM: 35,
        surfaceDistanceM: 58_000,
        radiusM: 6_371_000,
        targetSampleCount: 18,
        presetId: "elevated-observer",
        units: "metric",
      },
      defaultPrimaryModel,
    );

    const scene = buildSceneViewModel(result, "Primary Model", "primary");
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

    if (scene.lines.some((line) => line.featureId === "actual-ray")) {
      expect(labeledFeatures.has("actual-ray")).toBe(true);
    }
  });

  it("uses a curvilinear tangent label for the concave reference curve", () => {
    const result = solveVisibility(
      {
        observerHeightM: 45,
        targetHeightM: 35,
        surfaceDistanceM: 58_000,
        radiusM: 6_371_000,
        targetSampleCount: 18,
        presetId: "elevated-observer",
        units: "metric",
      },
      defaultComparisonModel,
    );

    const scene = buildSceneViewModel(result, "Comparison Model", "comparison");

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
  });
});
