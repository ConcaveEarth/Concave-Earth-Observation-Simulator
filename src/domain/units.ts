export const METERS_IN_KILOMETER = 1000;
export const RAD_TO_DEG = 180 / Math.PI;
export const DEG_TO_RAD = Math.PI / 180;

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

export function formatDistance(meters: number): string {
  if (Math.abs(meters) >= METERS_IN_KILOMETER) {
    return `${roundTo(meters / METERS_IN_KILOMETER, 2).toLocaleString()} km`;
  }

  return `${roundTo(meters, 1).toLocaleString()} m`;
}

export function formatHeight(meters: number): string {
  return `${roundTo(meters, 1).toLocaleString()} m`;
}

export function formatAngle(rad: number | null | undefined): string {
  if (rad == null || Number.isNaN(rad)) {
    return "N/A";
  }

  return `${roundTo(rad * RAD_TO_DEG, 3)}°`;
}

export function formatFraction(value: number): string {
  return `${roundTo(value * 100, 1)}%`;
}

