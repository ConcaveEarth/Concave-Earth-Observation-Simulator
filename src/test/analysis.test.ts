import { describe, expect, it } from "vitest";
import {
  buildProfileVisibilityPanelData,
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
});
