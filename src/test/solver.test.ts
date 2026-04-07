import { getTurnRatePerMeter } from "../domain/curvature";
import { angleOf, localTangentAtAngle, pointAtSurfaceHeight } from "../domain/geometry";
import type { ModelConfig } from "../domain/types";
import {
  defaultComparisonModel,
  defaultPrimaryModel,
  defaultScenario,
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
      atmosphere: { mode: "simpleCoefficient", coefficient: 2 },
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
});
