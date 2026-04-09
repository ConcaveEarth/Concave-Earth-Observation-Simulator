import { clamp } from "./units";

export interface GreatCircleRouteMetrics {
  centralAngleRad: number;
  distanceM: number;
  initialBearingDeg: number;
}

export function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

export function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

export function normalizeLatitudeDeg(value: number): number {
  return clamp(value, -90, 90);
}

export function normalizeLongitudeDeg(value: number): number {
  const wrapped = ((value + 180) % 360 + 360) % 360;
  return wrapped - 180;
}

export function getGreatCircleRouteMetrics(args: {
  observerLatDeg: number;
  observerLonDeg: number;
  targetLatDeg: number;
  targetLonDeg: number;
  radiusM: number;
}): GreatCircleRouteMetrics {
  const observerLatRad = degToRad(normalizeLatitudeDeg(args.observerLatDeg));
  const observerLonRad = degToRad(normalizeLongitudeDeg(args.observerLonDeg));
  const targetLatRad = degToRad(normalizeLatitudeDeg(args.targetLatDeg));
  const targetLonRad = degToRad(normalizeLongitudeDeg(args.targetLonDeg));
  const deltaLat = targetLatRad - observerLatRad;
  const deltaLon = targetLonRad - observerLonRad;

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(observerLatRad) * Math.cos(targetLatRad) * Math.sin(deltaLon / 2) ** 2;
  const centralAngleRad = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(1 - haversine, 0)));
  const y = Math.sin(deltaLon) * Math.cos(targetLatRad);
  const x =
    Math.cos(observerLatRad) * Math.sin(targetLatRad) -
    Math.sin(observerLatRad) * Math.cos(targetLatRad) * Math.cos(deltaLon);
  const initialBearingDeg = ((radToDeg(Math.atan2(y, x)) % 360) + 360) % 360;

  return {
    centralAngleRad,
    distanceM: args.radiusM * centralAngleRad,
    initialBearingDeg,
  };
}
