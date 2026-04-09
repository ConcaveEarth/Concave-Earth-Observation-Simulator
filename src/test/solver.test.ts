import { getTurnRatePerMeter } from "../domain/curvature";
import { angleOf, localTangentAtAngle, pointAtSurfaceHeight } from "../domain/geometry";
import type { ModelConfig, TerrainProfilePreset } from "../domain/types";
import {
  applyPresetToModel,
  defaultComparisonModel,
  defaultPrimaryModel,
  defaultScenario,
  getPresetById,
} from "../domain/presets";
import { solveVisibility } from "../domain/solver";

describe("visibility solver", () => {
  it("returns stable horizon and visibility outputs for the convex baseline", () => {
    const result = solveVisibility(
      {
        ...defaultScenario,
        observerHeightM: 12,
        targetHeightM: 28,
        surfaceDistanceM: 42_000,
      },
      {
        ...defaultPrimaryModel,
        atmosphere: { mode: "none", coefficient: 0 },
      },
    );

    expect(result.geometricHorizon).not.toBeNull();
    expect(result.hiddenHeightM).toBeGreaterThanOrEqual(0);
    expect(result.hiddenHeightM).toBeLessThanOrEqual(result.scenario.targetHeightM);
    expect(result.targetSamples).toHaveLength(result.scenario.targetSampleCount);
  });

  it("keeps scenario distance identical across compare models", () => {
    const primary = solveVisibility(defaultScenario, defaultPrimaryModel);
    const comparison = solveVisibility(defaultScenario, defaultComparisonModel);

    expect(primary.targetAngleRad).toBeCloseTo(comparison.targetAngleRad, 9);
    expect(primary.scenario.surfaceDistanceM).toBe(comparison.scenario.surfaceDistanceM);
  });

  it("keeps the convex optical horizon stable across small observer-height changes", () => {
    const scenario235 = {
      ...defaultScenario,
      observerHeightM: 235,
      targetHeightM: 35,
      surfaceDistanceM: 58_000,
      presetId: "elevated-observer",
    };
    const scenario236 = {
      ...scenario235,
      observerHeightM: 236,
    };

    const result235 = solveVisibility(scenario235, defaultPrimaryModel);
    const result236 = solveVisibility(scenario236, defaultPrimaryModel);

    expect(result235.geometricHorizon).not.toBeNull();
    expect(result235.opticalHorizon).not.toBeNull();
    expect(result236.geometricHorizon).not.toBeNull();
    expect(result236.opticalHorizon).not.toBeNull();

    expect(result235.opticalHorizon!.distanceM).toBeGreaterThan(
      result235.geometricHorizon!.distanceM,
    );
    expect(result236.opticalHorizon!.distanceM).toBeGreaterThan(
      result236.geometricHorizon!.distanceM,
    );
    expect(
      Math.abs(result236.opticalHorizon!.distanceM - result235.opticalHorizon!.distanceM),
    ).toBeLessThan(300);
  });

  it("lets atmospheric refraction counter concave intrinsic bending", () => {
    const scenario = {
      ...defaultScenario,
      observerHeightM: 2,
      targetHeightM: 35,
      surfaceDistanceM: 58_000,
    };
    const concaveNoAtmosphere: ModelConfig = {
      ...defaultComparisonModel,
      atmosphere: { mode: "none", coefficient: 0 },
      intrinsicCurvatureMode: "2/R",
    };
    const concaveStrongAtmosphere: ModelConfig = {
      ...defaultComparisonModel,
      atmosphere: { mode: "simpleCoefficient", coefficient: 0.99 },
      intrinsicCurvatureMode: "2/R",
    };
    const point = pointAtSurfaceHeight(
      scenario.radiusM,
      0,
      "concave",
      scenario.observerHeightM,
    );
    const heading = angleOf(localTangentAtAngle(0));
    const noAtmosphereTurn = getTurnRatePerMeter(
      point,
      heading,
      scenario,
      concaveNoAtmosphere,
    );
    const strongAtmosphereTurn = getTurnRatePerMeter(
      point,
      heading,
      scenario,
      concaveStrongAtmosphere,
    );

    expect(Math.abs(strongAtmosphereTurn)).toBeLessThan(Math.abs(noAtmosphereTurn));
  });

  it("lets negative convex atmosphere shorten the optical horizon", () => {
    const scenario = {
      ...defaultScenario,
      observerHeightM: 12,
      targetHeightM: 18,
      surfaceDistanceM: 42_000,
    };
    const downwardModel: ModelConfig = {
      ...defaultPrimaryModel,
      atmosphere: { mode: "simpleCoefficient", coefficient: 0.15 },
    };
    const upwardModel: ModelConfig = {
      ...defaultPrimaryModel,
      atmosphere: { mode: "simpleCoefficient", coefficient: -0.15 },
    };

    const downwardResult = solveVisibility(scenario, downwardModel);
    const upwardResult = solveVisibility(scenario, upwardModel);

    expect(downwardResult.opticalHorizon).not.toBeNull();
    expect(upwardResult.opticalHorizon).not.toBeNull();
    expect(downwardResult.opticalHorizon!.distanceM).toBeGreaterThan(
      upwardResult.opticalHorizon!.distanceM,
    );
    expect(downwardResult.opticalHorizon!.trace).not.toBeNull();
  });

  it("keeps the concave apparent horizon direction non-positive for the default low-horizon case", () => {
    const result = solveVisibility(defaultScenario, defaultComparisonModel);

    expect(result.opticalHorizon).not.toBeNull();
    expect(result.opticalHorizon!.apparentElevationRad).toBeLessThanOrEqual(0);
  });

  it("builds a traced convex optical horizon ray under atmospheric refraction", () => {
    const result = solveVisibility(defaultScenario, {
      ...defaultPrimaryModel,
      atmosphere: { mode: "simpleCoefficient", coefficient: 0.15 },
    });

    expect(result.opticalHorizon).not.toBeNull();
    expect(result.opticalHorizon!.trace).not.toBeNull();
    expect(result.opticalHorizon!.trace!.points.length).toBeGreaterThan(4);
    expect(result.opticalHorizon!.distanceM).toBeGreaterThan(0);
  });

  it("refines partial visibility between sample slices for the convex Aconcagua case", () => {
    const preset = getPresetById("aconcagua-study");
    const result = solveVisibility(
      preset.scenario,
      applyPresetToModel(defaultPrimaryModel, preset.primaryModel),
    );
    const lowestVisibleIndex = result.targetSamples.findIndex((sample) => sample.visible);

    expect(lowestVisibleIndex).toBeGreaterThan(0);
    expect(result.hiddenHeightM).toBeGreaterThan(
      result.targetSamples[lowestVisibleIndex - 1].sampleHeightM,
    );
    expect(result.hiddenHeightM).toBeLessThan(
      result.targetSamples[lowestVisibleIndex].sampleHeightM,
    );
  });

  it("keeps the Roxas-inspired Aconcagua concave preset partially visible with a traced horizon", () => {
    const preset = getPresetById("aconcagua-study");
    const result = solveVisibility(
      preset.scenario,
      applyPresetToModel(defaultComparisonModel, preset.comparisonModel),
    );

    expect(result.scenario.observerHeightM).toBe(6_400);
    expect(result.scenario.targetHeightM).toBe(7_040);
    expect(result.scenario.surfaceDistanceM).toBe(460_000);
    expect(result.opticalHorizon).not.toBeNull();
    expect(result.opticalHorizon!.trace).not.toBeNull();
    expect(result.hiddenHeightM).toBeGreaterThan(0);
    expect(result.visibleHeightM).toBeGreaterThan(0);
    expect(result.visibilityFraction).toBeGreaterThan(0);
    expect(result.visibilityFraction).toBeLessThan(1);
  });

  it("supports field-mode observer and target elevations without losing total-height geometry", () => {
    const result = solveVisibility(
      {
        ...defaultScenario,
        scenarioMode: "field",
        observerSurfaceElevationM: 120,
        observerEyeHeightM: 1.7,
        observerHeightM: 121.7,
        targetBaseElevationM: 480,
        targetHeightM: 32,
        surfaceDistanceM: 36_000,
      },
      defaultPrimaryModel,
    );

    expect(result.observerPoint).toEqual(
      pointAtSurfaceHeight(
        result.scenario.radiusM,
        0,
        result.model.geometryMode,
        121.7,
      ),
    );
    expect(result.targetBasePoint).toEqual(
      pointAtSurfaceHeight(
        result.scenario.radiusM,
        result.targetAngleRad,
        result.model.geometryMode,
        480,
      ),
    );
    expect(result.targetTopPoint).toEqual(
      pointAtSurfaceHeight(
        result.scenario.radiusM,
        result.targetAngleRad,
        result.model.geometryMode,
        512,
      ),
    );
    expect(result.targetSamples[0].absoluteHeightM).toBeCloseTo(480, 6);
    expect(result.targetSamples[result.targetSamples.length - 1].absoluteHeightM).toBeCloseTo(
      512,
      6,
    );
  });

  it("lets terrain obstruction block rays before they reach the target", () => {
    const terrainWall: TerrainProfilePreset = {
      id: "terrain-wall",
      name: "Terrain wall",
      description: "A synthetic obstruction positioned between observer and target.",
      samples: [
        { distanceM: 0, heightM: 0 },
        { distanceM: 900, heightM: 0 },
        { distanceM: 1_050, heightM: 120 },
        { distanceM: 1_200, heightM: 120 },
        { distanceM: 1_350, heightM: 0 },
        { distanceM: 2_000, heightM: 0 },
      ],
    };
    const scenario = {
      ...defaultScenario,
      observerHeightM: 2,
      targetHeightM: 30,
      surfaceDistanceM: 2_000,
      targetSampleCount: 12,
    };

    const withoutTerrain = solveVisibility(
      scenario,
      { ...defaultPrimaryModel, atmosphere: { mode: "none", coefficient: 0 } },
      null,
    );
    const withTerrain = solveVisibility(
      scenario,
      { ...defaultPrimaryModel, atmosphere: { mode: "none", coefficient: 0 } },
      terrainWall,
    );

    expect(withoutTerrain.visibilityFraction).toBeGreaterThan(withTerrain.visibilityFraction);
    expect(withTerrain.terrainProfile?.id).toBe("terrain-wall");
    expect(withTerrain.hiddenHeightM).toBeGreaterThan(withoutTerrain.hiddenHeightM);
    expect(withTerrain.visibleHeightM).toBeLessThan(withoutTerrain.visibleHeightM);
  });
});
