import { describe, expect, it } from "vitest";
import {
  getGreatCircleRouteMetrics,
  normalizeLatitudeDeg,
  normalizeLongitudeDeg,
} from "../domain/geodesy";

describe("geodesy helpers", () => {
  it("normalizes latitude and longitude into valid ranges", () => {
    expect(normalizeLatitudeDeg(123)).toBe(90);
    expect(normalizeLatitudeDeg(-123)).toBe(-90);
    expect(normalizeLongitudeDeg(540)).toBe(-180);
    expect(normalizeLongitudeDeg(-540)).toBe(-180);
  });

  it("derives a great-circle distance and initial bearing from coordinates", () => {
    const route = getGreatCircleRouteMetrics({
      observerLatDeg: 29.9546,
      observerLonDeg: -90.0751,
      targetLatDeg: 30.316,
      targetLonDeg: -89.801,
      radiusM: 6_371_000,
    });

    expect(route.distanceM).toBeGreaterThan(40_000);
    expect(route.distanceM).toBeLessThan(60_000);
    expect(route.centralAngleRad).toBeGreaterThan(0);
    expect(route.initialBearingDeg).toBeGreaterThanOrEqual(0);
    expect(route.initialBearingDeg).toBeLessThan(360);
  });
});
