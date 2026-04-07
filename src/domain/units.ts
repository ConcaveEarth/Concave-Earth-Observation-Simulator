export const METERS_IN_KILOMETER = 1000;
export const METERS_IN_FOOT = 0.3048;
export const METERS_IN_MILE = 1609.344;
export const RAD_TO_DEG = 180 / Math.PI;
export const DEG_TO_RAD = Math.PI / 180;

export type HeightUnit = "m" | "ft";
export type DistanceUnit = "m" | "km" | "ft" | "mi";
export type RadiusUnit = "km" | "mi";

export interface UnitPreferences {
  height: HeightUnit;
  distance: DistanceUnit;
  radius: RadiusUnit;
}

export const defaultUnitPreferences: UnitPreferences = {
  height: "m",
  distance: "km",
  radius: "km",
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function getDistanceUnitMeters(unit: DistanceUnit | RadiusUnit): number {
  switch (unit) {
    case "m":
      return 1;
    case "km":
      return METERS_IN_KILOMETER;
    case "ft":
      return METERS_IN_FOOT;
    case "mi":
      return METERS_IN_MILE;
    default:
      return 1;
  }
}

export function getUnitLabel(unit: HeightUnit | DistanceUnit | RadiusUnit): string {
  return unit;
}

export function metersToHeightUnit(meters: number, unit: HeightUnit): number {
  return unit === "ft" ? meters / METERS_IN_FOOT : meters;
}

export function heightUnitToMeters(value: number, unit: HeightUnit): number {
  return unit === "ft" ? value * METERS_IN_FOOT : value;
}

export function metersToDistanceUnit(
  meters: number,
  unit: DistanceUnit | RadiusUnit,
): number {
  return meters / getDistanceUnitMeters(unit);
}

export function distanceUnitToMeters(
  value: number,
  unit: DistanceUnit | RadiusUnit,
): number {
  return value * getDistanceUnitMeters(unit);
}

export function getDisplayStepMeters(
  baseStepMeters: number,
  unit: HeightUnit | DistanceUnit | RadiusUnit,
): number {
  const converted = metersToDistanceUnit(baseStepMeters, unit as DistanceUnit | RadiusUnit);

  if (converted >= 10) {
    return Math.max(1, roundTo(converted, 0));
  }

  if (converted >= 1) {
    return roundTo(converted, 1);
  }

  return roundTo(converted, 3);
}

export function formatDistance(
  meters: number,
  unit: DistanceUnit = defaultUnitPreferences.distance,
): string {
  return `${roundTo(metersToDistanceUnit(meters, unit), unit === "m" || unit === "ft" ? 1 : 2).toLocaleString()} ${unit}`;
}

export function formatRadius(
  meters: number,
  unit: RadiusUnit = defaultUnitPreferences.radius,
): string {
  return `${roundTo(metersToDistanceUnit(meters, unit), 2).toLocaleString()} ${unit}`;
}

export function formatHeight(
  meters: number,
  unit: HeightUnit = defaultUnitPreferences.height,
): string {
  return `${roundTo(metersToHeightUnit(meters, unit), 1).toLocaleString()} ${unit}`;
}

export function formatAngle(rad: number | null | undefined): string {
  if (rad == null || Number.isNaN(rad)) {
    return "N/A";
  }

  return `${roundTo(rad * RAD_TO_DEG, 3)}\u00B0`;
}

export function formatFraction(value: number): string {
  return `${roundTo(value * 100, 1)}%`;
}

