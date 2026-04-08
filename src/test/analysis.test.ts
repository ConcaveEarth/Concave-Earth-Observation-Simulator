import { describe, expect, it } from "vitest";
import {
  buildRayBundlePanelData,
  buildSweepChartData,
  defaultComparisonModel,
  defaultPrimaryModel,
  defaultScenario,
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
});
