import { clamp } from "./units";

export interface GreatCircleRouteMetrics {
  centralAngleRad: number;
  distanceM: number;
  initialBearingDeg: number;
}

export interface GreatCircleRoutePoint {
  latDeg: number;
  lonDeg: number;
  distanceM: number;
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

function sphericalToCartesian(latRad: number, lonRad: number) {
  const cosLat = Math.cos(latRad);
  return {
    x: cosLat * Math.cos(lonRad),
    y: cosLat * Math.sin(lonRad),
    z: Math.sin(latRad),
  };
}

function cartesianToSpherical(point: { x: number; y: number; z: number }) {
  const magnitude = Math.hypot(point.x, point.y, point.z) || 1;
  const x = point.x / magnitude;
  const y = point.y / magnitude;
  const z = point.z / magnitude;
  return {
    latDeg: radToDeg(Math.asin(z)),
    lonDeg: normalizeLongitudeDeg(radToDeg(Math.atan2(y, x))),
  };
}

export function interpolateGreatCircleRoute(args: {
  observerLatDeg: number;
  observerLonDeg: number;
  targetLatDeg: number;
  targetLonDeg: number;
  radiusM: number;
  sampleCount?: number;
}): GreatCircleRoutePoint[] {
  const sampleCount = Math.max(2, args.sampleCount ?? 64);
  const observerLatRad = degToRad(normalizeLatitudeDeg(args.observerLatDeg));
  const observerLonRad = degToRad(normalizeLongitudeDeg(args.observerLonDeg));
  const targetLatRad = degToRad(normalizeLatitudeDeg(args.targetLatDeg));
  const targetLonRad = degToRad(normalizeLongitudeDeg(args.targetLonDeg));
  const route = getGreatCircleRouteMetrics(args);
  const start = sphericalToCartesian(observerLatRad, observerLonRad);
  const end = sphericalToCartesian(targetLatRad, targetLonRad);
  const omega = route.centralAngleRad;
  const sinOmega = Math.sin(omega);

  return Array.from({ length: sampleCount }, (_, index) => {
    const fraction = sampleCount === 1 ? 0 : index / (sampleCount - 1);

    if (sinOmega < 1e-6) {
      return {
        latDeg: args.observerLatDeg,
        lonDeg: args.observerLonDeg,
        distanceM: route.distanceM * fraction,
      };
    }

    const weightA = Math.sin((1 - fraction) * omega) / sinOmega;
    const weightB = Math.sin(fraction * omega) / sinOmega;
    const point = {
      x: start.x * weightA + end.x * weightB,
      y: start.y * weightA + end.y * weightB,
      z: start.z * weightA + end.z * weightB,
    };
    const spherical = cartesianToSpherical(point);

    return {
      latDeg: spherical.latDeg,
      lonDeg: spherical.lonDeg,
      distanceM: route.distanceM * fraction,
    };
  });
}
