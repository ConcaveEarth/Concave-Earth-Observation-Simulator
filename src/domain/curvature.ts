import {
  cross,
  directionFromAngle,
  localGroundAtPoint,
  normalize,
  scale,
} from "./geometry";
import { clamp } from "./units";
import type { ModelConfig, ScenarioInput, Vec2 } from "./types";

export const ATMOSPHERE_COEFFICIENT_DEFAULT = 0.15;
export const ATMOSPHERE_COEFFICIENT_MIN = -0.99;
export const ATMOSPHERE_COEFFICIENT_MAX = 0.99;

export function clampAtmosphereCoefficient(value: number): number {
  return clamp(value, ATMOSPHERE_COEFFICIENT_MIN, ATMOSPHERE_COEFFICIENT_MAX);
}

function signedTurnRate(
  headingRad: number,
  magnitudePerM: number,
  targetDirection: Vec2,
): number {
  if (magnitudePerM === 0) {
    return 0;
  }

  const direction = directionFromAngle(headingRad);
  const turnSide = Math.sign(cross(direction, normalize(targetDirection)));
  return turnSide * magnitudePerM;
}

export function getIntrinsicCurvatureMagnitude(
  model: ModelConfig,
  scenario: ScenarioInput,
): number {
  if (model.geometryMode !== "concave") {
    return 0;
  }

  switch (model.intrinsicCurvatureMode) {
    case "1/R":
      return 1 / scenario.radiusM;
    case "2/R":
      return 2 / scenario.radiusM;
    case "constant":
      return Math.max(0, model.intrinsicCurvaturePerM);
    case "none":
    default:
      return 0;
  }
}

export function getAtmosphereCurvatureMagnitude(
  model: ModelConfig,
  scenario: ScenarioInput,
): number {
  if (model.atmosphere.mode === "none") {
    return 0;
  }

  return getAtmosphereCurvatureMagnitudeAtHeight(model, scenario, 0);
}

function getLayeredAtmosphereCoefficient(
  model: ModelConfig,
  heightAboveSurfaceM: number,
): number {
  const height = Math.max(0, heightAboveSurfaceM);
  const transitionHeightM = Math.max(1, model.atmosphere.transitionHeightM);
  const baseMix = clamp(height / transitionHeightM, 0, 1);
  const baselineCoefficient =
    model.atmosphere.coefficient +
    (model.atmosphere.upperCoefficient - model.atmosphere.coefficient) * baseMix;
  const inversionBaseM = Math.max(0, model.atmosphere.inversionBaseHeightM);
  const inversionDepthM = Math.max(1, model.atmosphere.inversionDepthM);
  const inversionPeakM = inversionBaseM + inversionDepthM / 2;
  const distanceFromPeak = Math.abs(height - inversionPeakM);
  const normalizedDistance = clamp(distanceFromPeak / (inversionDepthM / 2), 0, 1);
  const inversionProfile = 1 - normalizedDistance;

  return baselineCoefficient + model.atmosphere.inversionStrength * inversionProfile;
}

export function getAtmosphereCurvatureMagnitudeAtHeight(
  model: ModelConfig,
  scenario: ScenarioInput,
  heightAboveSurfaceM: number,
): number {
  if (model.atmosphere.mode === "none") {
    return 0;
  }

  const coefficient =
    model.atmosphere.mode === "layered"
      ? getLayeredAtmosphereCoefficient(model, heightAboveSurfaceM)
      : model.atmosphere.coefficient;

  return (1 / scenario.radiusM) * clampAtmosphereCoefficient(coefficient);
}

export function getTurnRatePerMeter(
  point: Vec2,
  headingRad: number,
  scenario: ScenarioInput,
  model: ModelConfig,
): number {
  const radialDistanceM = Math.hypot(point.x, point.y);
  const heightAboveSurfaceM =
    model.geometryMode === "concave"
      ? Math.max(0, scenario.radiusM - radialDistanceM)
      : Math.max(0, radialDistanceM - scenario.radiusM);
  const intrinsic =
    model.geometryMode === "concave"
      ? signedTurnRate(
          headingRad,
          getIntrinsicCurvatureMagnitude(model, scenario),
          scale(point, -1),
        )
      : 0;

  const atmosphere = signedTurnRate(
    headingRad,
    getAtmosphereCurvatureMagnitudeAtHeight(model, scenario, heightAboveSurfaceM),
    localGroundAtPoint(point, model.geometryMode),
  );

  return intrinsic + atmosphere;
}
