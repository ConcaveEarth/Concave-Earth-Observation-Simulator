import type { GeometryMode, Vec2 } from "./types";

export const EPSILON = 1e-9;

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Vec2, factor: number): Vec2 {
  return { x: a.x * factor, y: a.y * factor };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

export function length(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}

export function normalize(a: Vec2): Vec2 {
  const magnitude = length(a);

  if (magnitude < EPSILON) {
    return { x: 0, y: 0 };
  }

  return { x: a.x / magnitude, y: a.y / magnitude };
}

export function angleOf(a: Vec2): number {
  return Math.atan2(a.y, a.x);
}

export function rotateLeft(a: Vec2): Vec2 {
  return { x: -a.y, y: a.x };
}

export function directionFromAngle(angleRad: number): Vec2 {
  return { x: Math.cos(angleRad), y: Math.sin(angleRad) };
}

export function polarToCartesian(radiusM: number, angleRad: number): Vec2 {
  return {
    x: radiusM * Math.cos(angleRad),
    y: radiusM * Math.sin(angleRad),
  };
}

export function unwrapAngle(nextAngle: number, previousAngle: number): number {
  let adjusted = nextAngle;

  while (adjusted - previousAngle > Math.PI) {
    adjusted -= Math.PI * 2;
  }

  while (adjusted - previousAngle < -Math.PI) {
    adjusted += Math.PI * 2;
  }

  return adjusted;
}

export function getTargetAngle(distanceM: number, radiusM: number): number {
  return distanceM / radiusM;
}

export function radiusAtHeight(
  shellRadiusM: number,
  geometryMode: GeometryMode,
  heightM: number,
): number {
  return geometryMode === "convex"
    ? shellRadiusM + heightM
    : shellRadiusM - heightM;
}

export function pointAtSurfaceHeight(
  shellRadiusM: number,
  angleRad: number,
  geometryMode: GeometryMode,
  heightM: number,
): Vec2 {
  return polarToCartesian(radiusAtHeight(shellRadiusM, geometryMode, heightM), angleRad);
}

export function localTangentAtAngle(angleRad: number): Vec2 {
  return normalize({
    x: -Math.sin(angleRad),
    y: Math.cos(angleRad),
  });
}

export function localUpAtAngle(
  angleRad: number,
  geometryMode: GeometryMode,
): Vec2 {
  const radial = normalize(polarToCartesian(1, angleRad));
  return geometryMode === "convex" ? radial : scale(radial, -1);
}

export function localUpAtPoint(point: Vec2, geometryMode: GeometryMode): Vec2 {
  const radial = normalize(point);
  return geometryMode === "convex" ? radial : scale(radial, -1);
}

export function localGroundAtPoint(point: Vec2, geometryMode: GeometryMode): Vec2 {
  return scale(localUpAtPoint(point, geometryMode), -1);
}

export function heightFromRadius(
  radiusM: number,
  shellRadiusM: number,
  geometryMode: GeometryMode,
): number {
  return geometryMode === "convex"
    ? radiusM - shellRadiusM
    : shellRadiusM - radiusM;
}

export function surfaceClearance(
  radiusM: number,
  shellRadiusM: number,
  geometryMode: GeometryMode,
): number {
  return heightFromRadius(radiusM, shellRadiusM, geometryMode);
}

export function isSurfaceIntersection(
  radiusM: number,
  shellRadiusM: number,
  geometryMode: GeometryMode,
): boolean {
  return geometryMode === "convex"
    ? radiusM <= shellRadiusM
    : radiusM >= shellRadiusM;
}

export function toObserverFrame(
  point: Vec2,
  observerPoint: Vec2,
  forwardAxis: Vec2,
  upAxis: Vec2,
): Vec2 {
  const relative = subtract(point, observerPoint);
  return {
    x: dot(relative, forwardAxis),
    y: dot(relative, upAxis),
  };
}

