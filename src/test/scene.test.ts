import { buildSceneViewModel, solveVisibility } from "../domain";
import { defaultPrimaryModel } from "../domain/presets";

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
});
