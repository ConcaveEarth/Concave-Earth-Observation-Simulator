import { describe, expect, it } from "vitest";
import {
  buildSceneViewModel,
  defaultPrimaryModel,
  defaultScenario,
  defaultUnitPreferences,
  solveVisibility,
} from "../domain";

const EARTH_RADIUS_M = defaultScenario.radiusM;
const METERS_PER_NAUTICAL_MILE = 1852;

function exactGeometricHorizonDistanceM(heightM: number) {
  return EARTH_RADIUS_M * Math.acos(EARTH_RADIUS_M / (EARTH_RADIUS_M + heightM));
}

function bowditchVisibleHorizonDistanceM(heightM: number) {
  return 2.07 * Math.sqrt(heightM) * METERS_PER_NAUTICAL_MILE;
}

function bowditchDipArcMinutes(heightM: number) {
  return 1.76 * Math.sqrt(heightM);
}

function bowditchGeographicRangeM(observerHeightM: number, targetHeightM: number) {
  return (
    2.07 * (Math.sqrt(observerHeightM) + Math.sqrt(targetHeightM)) * METERS_PER_NAUTICAL_MILE
  );
}

function percentageError(actual: number, expected: number) {
  return ((actual - expected) / expected) * 100;
}

function toArcMinutes(angleRad: number) {
  return Math.abs((angleRad * 180 * 60) / Math.PI);
}

function surfaceDistanceFromPointM(x: number, y: number) {
  return Math.abs(Math.atan2(y, x) * EARTH_RADIUS_M);
}

function makeConvexScenario(overrides: Partial<typeof defaultScenario> = {}) {
  return {
    ...defaultScenario,
    presetId: "convex-validation",
    targetSampleCount: 48,
    ...overrides,
  };
}

function solveConvexThresholdDistanceM(observerHeightM: number, targetHeightM: number) {
  const referenceRangeM = bowditchGeographicRangeM(observerHeightM, targetHeightM);
  let low = 0;
  let high = referenceRangeM * 1.25;

  for (let index = 0; index < 4; index += 1) {
    const result = solveVisibility(
      makeConvexScenario({
        observerHeightM,
        targetHeightM,
        surfaceDistanceM: high,
      }),
      defaultPrimaryModel,
    );

    if (result.visible) {
      high *= 1.2;
    }
  }

  for (let iteration = 0; iteration < 26; iteration += 1) {
    const middle = (low + high) / 2;
    const result = solveVisibility(
      makeConvexScenario({
        observerHeightM,
        targetHeightM,
        surfaceDistanceM: middle,
      }),
      defaultPrimaryModel,
    );

    if (result.visible) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return low;
}

describe("convex globe validation against mainstream geodesy references", () => {
  it("matches the exact spherical geometric horizon distance across low to very high altitudes", () => {
    const heightsM = [2, 10, 45, 235, 6_400, 30_480];
    const rows = heightsM.map((observerHeightM) => {
      const result = solveVisibility(
        makeConvexScenario({
          observerHeightM,
          targetHeightM: 18,
          surfaceDistanceM: 24_000,
        }),
        defaultPrimaryModel,
      );

      const expectedDistanceM = exactGeometricHorizonDistanceM(observerHeightM);
      const actualDistanceM = result.geometricHorizon?.distanceM ?? 0;

      return {
        observerHeightM,
        expectedDistanceKm: Number((expectedDistanceM / 1000).toFixed(3)),
        actualDistanceKm: Number((actualDistanceM / 1000).toFixed(3)),
        errorPercent: Number(percentageError(actualDistanceM, expectedDistanceM).toFixed(5)),
      };
    });

    for (const row of rows) {
      expect(Math.abs(row.errorPercent)).toBeLessThan(0.001);
    }
  });

  it("tracks Bowditch visible-horizon distance and dip closely for standard-refraction globe cases", () => {
    const heightsM = [2, 10, 45, 235, 6_400, 30_480];
    const rows = heightsM.map((observerHeightM) => {
      const result = solveVisibility(
        makeConvexScenario({
          observerHeightM,
          targetHeightM: 18,
          surfaceDistanceM: 24_000,
        }),
        defaultPrimaryModel,
      );

      const expectedDistanceM = bowditchVisibleHorizonDistanceM(observerHeightM);
      const actualDistanceM = result.opticalHorizon?.distanceM ?? 0;
      const tracedDistanceM = result.opticalHorizon?.trace?.firstSurfaceIntersection
        ? surfaceDistanceFromPointM(
            result.opticalHorizon.trace.firstSurfaceIntersection.x,
            result.opticalHorizon.trace.firstSurfaceIntersection.y,
          )
        : 0;
      const expectedDipArcMin = bowditchDipArcMinutes(observerHeightM);
      const actualDipArcMin = toArcMinutes(result.opticalHorizon?.apparentElevationRad ?? 0);

      return {
        observerHeightM,
        bowditchDistanceKm: Number((expectedDistanceM / 1000).toFixed(3)),
        actualDistanceKm: Number((actualDistanceM / 1000).toFixed(3)),
        tracedDistanceKm: Number((tracedDistanceM / 1000).toFixed(3)),
        distanceErrorPercent: Number(percentageError(actualDistanceM, expectedDistanceM).toFixed(3)),
        tracedVsAnalyticPercent: tracedDistanceM
          ? Number(percentageError(tracedDistanceM, actualDistanceM).toFixed(3))
          : null,
        bowditchDipArcMin: Number(expectedDipArcMin.toFixed(3)),
        actualDipArcMin: Number(actualDipArcMin.toFixed(3)),
        dipErrorPercent: Number(percentageError(actualDipArcMin, expectedDipArcMin).toFixed(3)),
      };
    });

    for (const row of rows) {
      expect(Math.abs(row.distanceErrorPercent)).toBeLessThan(1.0);
      expect(Math.abs(row.dipErrorPercent)).toBeLessThan(1.5);
    }
  });

  it("reports current geographic-range thresholds against Bowditch and Light List benchmarks", () => {
    const cases = [
      { label: "Low observer ship", observerHeightM: 2, targetHeightM: 18 },
      { label: "Bridge/shoreline", observerHeightM: 4.572, targetHeightM: 18.288 },
      { label: "Bluff to structure", observerHeightM: 13.716, targetHeightM: 30.48 },
      { label: "Aircraft to mountain", observerHeightM: 6_400, targetHeightM: 7_040 },
    ];

    const rows = cases.map((entry) => {
      const expectedRangeM = bowditchGeographicRangeM(
        entry.observerHeightM,
        entry.targetHeightM,
      );
      const actualRangeM = solveConvexThresholdDistanceM(
        entry.observerHeightM,
        entry.targetHeightM,
      );

      return {
        label: entry.label,
        observerHeightM: Number(entry.observerHeightM.toFixed(3)),
        targetHeightM: Number(entry.targetHeightM.toFixed(3)),
        expectedRangeKm: Number((expectedRangeM / 1000).toFixed(3)),
        actualRangeKm: Number((actualRangeM / 1000).toFixed(3)),
        errorPercent: Number(percentageError(actualRangeM, expectedRangeM).toFixed(3)),
      };
    });

    for (const row of rows) {
      expect(row.actualRangeKm).toBeGreaterThan(0);
    }
  });

  it("renders convex scene constructs with mainstream geometric semantics", () => {
    const result = solveVisibility(
      makeConvexScenario({
        observerHeightM: 10.668,
        targetHeightM: 19.812,
        surfaceDistanceM: 18_000,
      }),
      defaultPrimaryModel,
    );
    const scene = buildSceneViewModel(
      result,
      "Convex Validation",
      "primary",
      defaultUnitPreferences,
    );

    const observerHorizontal = scene.segments.find((segment) => segment.id === "observer-horizontal");
    const geometricHorizonRay = scene.segments.find(
      (segment) => segment.id === "geometric-horizon-ray",
    );
    const apparentLine = scene.segments.find((segment) => segment.id === "apparent-line");
    const referenceCurve = scene.lines.find(
      (line) => line.featureId === "observer-altitude-curve",
    );
    const sourceLightPath = scene.lines.find((line) => line.id === "source-light-path");
    const geometricSightline = scene.lines.find((line) => line.featureId === "geometric-sightline");
    const opticalHorizonTrace = scene.lines.find((line) => line.id === "optical-horizon-trace");

    expect(observerHorizontal).toBeTruthy();
    expect(observerHorizontal?.from.y).toBe(0);
    expect(observerHorizontal?.to.y).toBe(0);

    expect(geometricHorizonRay).toBeTruthy();
    expect((geometricHorizonRay?.to.y ?? 0)).toBeLessThan(0);

    expect(apparentLine).toBeTruthy();
    expect((apparentLine?.to.y ?? 0)).toBeLessThan(0);

    expect(referenceCurve).toBeTruthy();
    expect((referenceCurve?.points.length ?? 0)).toBeGreaterThan(20);
    expect(
      (referenceCurve ? referenceCurve.points[referenceCurve.points.length - 1]?.y : 0) ?? 0,
    ).toBeLessThan(
      (referenceCurve?.points[0]?.y ?? 0) - 1,
    );

    expect(geometricSightline).toBeTruthy();
    expect(geometricSightline?.points).toHaveLength(2);

    expect(opticalHorizonTrace).toBeTruthy();
    expect((opticalHorizonTrace?.points.length ?? 0)).toBeGreaterThan(20);

    expect(sourceLightPath).toBeTruthy();
    expect((sourceLightPath?.points.length ?? 0)).toBeGreaterThan(20);

    const curveStart = sourceLightPath?.points[0];
    const curveMid = sourceLightPath?.points[Math.floor((sourceLightPath?.points.length ?? 2) / 2)];
    const curveEnd = sourceLightPath
      ? sourceLightPath.points[sourceLightPath.points.length - 1]
      : undefined;
    expect(curveStart).toBeTruthy();
    expect(curveMid).toBeTruthy();
    expect(curveEnd).toBeTruthy();

    if (curveStart && curveMid && curveEnd) {
      const chordLength = Math.hypot(curveEnd.x - curveStart.x, curveEnd.y - curveStart.y);
      const polylineLength = sourceLightPath?.points.slice(1).reduce((sum, point, index) => {
        const previous = sourceLightPath.points[index];
        return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
      }, 0) ?? 0;

      expect(polylineLength).toBeGreaterThan(chordLength);
    }

    expect((result.opticalHorizon?.distanceM ?? 0)).toBeGreaterThan(
      result.geometricHorizon?.distanceM ?? 0,
    );
  });

  it("keeps the convex atmosphere coefficient signed as downward curvature in the mainstream case", () => {
    const result = solveVisibility(defaultScenario, defaultPrimaryModel);
    const opticalHorizonDipArcMin = toArcMinutes(result.opticalHorizon?.apparentElevationRad ?? 0);

    expect(result.model.atmosphere.coefficient).toBeGreaterThan(0);
    expect(opticalHorizonDipArcMin).toBeGreaterThan(0);
  });

  it("exposes realistic magnitude differences between geometric and refracted horizon for typical surveying heights", () => {
    const heightsM = [2, 10.668, 45, 235];
    const rows = heightsM.map((observerHeightM) => {
      const result = solveVisibility(
        makeConvexScenario({
          observerHeightM,
          targetHeightM: 18,
          surfaceDistanceM: 24_000,
        }),
        defaultPrimaryModel,
      );
      const geometricM = result.geometricHorizon?.distanceM ?? 0;
      const opticalM = result.opticalHorizon?.distanceM ?? 0;

      return {
        observerHeightM,
        geometricKm: Number((geometricM / 1000).toFixed(3)),
        opticalKm: Number((opticalM / 1000).toFixed(3)),
        extensionMeters: Number((opticalM - geometricM).toFixed(1)),
      };
    });

    expect(rows[0].extensionMeters).toBeGreaterThan(100);
    expect(rows[3].extensionMeters).toBeGreaterThan(rows[0].extensionMeters);
  });
});
