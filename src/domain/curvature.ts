import {
  cross,
  directionFromAngle,
  localGroundAtPoint,
  normalize,
  scale,
} from "./geometry";
import type { ModelConfig, ScenarioInput, Vec2 } from "./types";

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

  return (1 / scenario.radiusM) * Math.max(0, model.atmosphere.coefficient);
}

export function getTurnRatePerMeter(
  point: Vec2,
  headingRad: number,
  scenario: ScenarioInput,
  model: ModelConfig,
): number {
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
    getAtmosphereCurvatureMagnitude(model, scenario),
    localGroundAtPoint(point, model.geometryMode),
  );

  return intrinsic + atmosphere;
}

