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
});

