import {
  angleOf,
  getTargetAngle,
  heightFromRadius,
  isSurfaceIntersection,
  length,
  localTangentAtAngle,
  pointAtSurfaceHeight,
  surfaceClearance,
  unwrapAngle,
  vec,
} from "./geometry";
import { getTurnRatePerMeter } from "./curvature";
import { clamp, lerp } from "./units";
import type { ModelConfig, RayPoint, RayTrace, ScenarioInput } from "./types";

interface TraceState {
  x: number;
  y: number;
  headingRad: number;
}

export interface TraceRayOptions {
  scenario: ScenarioInput;
  model: ModelConfig;
  launchAngleRad: number;
  targetAngleRad?: number;
  maxArcLengthM?: number;
  stepM?: number;
}

export function getDefaultStepM(scenario: ScenarioInput): number {
  return clamp(scenario.surfaceDistanceM / 420, 180, 1500);
}

export function getDefaultMaxArcLengthM(scenario: ScenarioInput): number {
  return scenario.surfaceDistanceM + Math.max(160_000, scenario.surfaceDistanceM * 0.9);
}

function derivative(
  state: TraceState,
  scenario: ScenarioInput,
  model: ModelConfig,
): TraceState {
  return {
    x: Math.cos(state.headingRad),
    y: Math.sin(state.headingRad),
    headingRad: getTurnRatePerMeter(
      { x: state.x, y: state.y },
      state.headingRad,
      scenario,
      model,
    ),
  };
}

function rk4Step(
  state: TraceState,
  ds: number,
  scenario: ScenarioInput,
  model: ModelConfig,
): TraceState {
  const k1 = derivative(state, scenario, model);

  const k2State = {
    x: state.x + (k1.x * ds) / 2,
    y: state.y + (k1.y * ds) / 2,
    headingRad: state.headingRad + (k1.headingRad * ds) / 2,
  };
  const k2 = derivative(k2State, scenario, model);

  const k3State = {
    x: state.x + (k2.x * ds) / 2,
    y: state.y + (k2.y * ds) / 2,
    headingRad: state.headingRad + (k2.headingRad * ds) / 2,
  };
  const k3 = derivative(k3State, scenario, model);

  const k4State = {
    x: state.x + k3.x * ds,
    y: state.y + k3.y * ds,
    headingRad: state.headingRad + k3.headingRad * ds,
  };
  const k4 = derivative(k4State, scenario, model);

  return {
    x: state.x + (ds / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
    y: state.y + (ds / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
    headingRad:
      state.headingRad +
      (ds / 6) *
        (k1.headingRad + 2 * k2.headingRad + 2 * k3.headingRad + k4.headingRad),
  };
}

function makeRayPoint(state: TraceState, s: number): RayPoint {
  return { x: state.x, y: state.y, headingRad: state.headingRad, s };
}

export function traceRay({
  scenario,
  model,
  launchAngleRad,
  targetAngleRad = getTargetAngle(scenario.surfaceDistanceM, scenario.radiusM),
  stepM = getDefaultStepM(scenario),
  maxArcLengthM = getDefaultMaxArcLengthM(scenario),
}: TraceRayOptions): RayTrace {
  const observerPoint = pointAtSurfaceHeight(
    scenario.radiusM,
    0,
    model.geometryMode,
    scenario.observerHeightM,
  );
  const initialHeading = angleOf(localTangentAtAngle(0)) + launchAngleRad;

  let state: TraceState = {
    x: observerPoint.x,
    y: observerPoint.y,
    headingRad: initialHeading,
  };

  let previousAngle = 0;
  let arcLength = 0;
  let minSurfaceClearanceM = surfaceClearance(
    length(observerPoint),
    scenario.radiusM,
    model.geometryMode,
  );

  const points: RayPoint[] = [makeRayPoint(state, 0)];

  while (arcLength < maxArcLengthM) {
    const previousState = state;
    const previousRadius = length(previousState);
    const nextState = rk4Step(previousState, stepM, scenario, model);
    const nextRadius = length(nextState);
    const nextAngle = unwrapAngle(Math.atan2(nextState.y, nextState.x), previousAngle);

    minSurfaceClearanceM = Math.min(
      minSurfaceClearanceM,
      surfaceClearance(nextRadius, scenario.radiusM, model.geometryMode),
    );

    let surfaceFraction: number | null = null;
    const surfaceDelta = nextRadius - previousRadius;
    const crossedSurface =
      isSurfaceIntersection(nextRadius, scenario.radiusM, model.geometryMode) &&
      ((model.geometryMode === "convex" && surfaceDelta < 0) ||
        (model.geometryMode === "concave" && surfaceDelta > 0));

    if (crossedSurface && Math.abs(surfaceDelta) > 1e-9) {
      surfaceFraction = clamp(
        (scenario.radiusM - previousRadius) / surfaceDelta,
        0,
        1,
      );
    }

    let targetFraction: number | null = null;
    const angleDelta = nextAngle - previousAngle;

    if (
      targetAngleRad >= previousAngle &&
      targetAngleRad <= nextAngle &&
      Math.abs(angleDelta) > 1e-9
    ) {
      targetFraction = clamp((targetAngleRad - previousAngle) / angleDelta, 0, 1);
    }

    const shouldTakeTarget =
      targetFraction != null &&
      (surfaceFraction == null || targetFraction <= surfaceFraction);

    if (shouldTakeTarget && targetFraction != null) {
      const crossingState = {
        x: lerp(previousState.x, nextState.x, targetFraction),
        y: lerp(previousState.y, nextState.y, targetFraction),
        headingRad: lerp(previousState.headingRad, nextState.headingRad, targetFraction),
      };
      const crossingPoint = makeRayPoint(crossingState, arcLength + stepM * targetFraction);
      const crossingRadius = length(crossingPoint);

      points.push(crossingPoint);

      return {
        launchAngleRad,
        points,
        incomingHeadingRad: crossingState.headingRad,
        totalBendRad: crossingState.headingRad - initialHeading,
        terminationReason: "target-angle",
        targetCrossing: {
          position: vec(crossingPoint.x, crossingPoint.y),
          arcLengthM: crossingPoint.s,
          radialDistanceM: crossingRadius,
          heightM: heightFromRadius(crossingRadius, scenario.radiusM, model.geometryMode),
          missHeightM: 0,
          fraction: targetFraction,
        },
        minSurfaceClearanceM,
      };
    }

    if (surfaceFraction != null) {
      const intersectionState = {
        x: lerp(previousState.x, nextState.x, surfaceFraction),
        y: lerp(previousState.y, nextState.y, surfaceFraction),
        headingRad: lerp(previousState.headingRad, nextState.headingRad, surfaceFraction),
      };
      const intersectionPoint = makeRayPoint(
        intersectionState,
        arcLength + stepM * surfaceFraction,
      );

      points.push(intersectionPoint);

      return {
        launchAngleRad,
        points,
        incomingHeadingRad: intersectionState.headingRad,
        totalBendRad: intersectionState.headingRad - initialHeading,
        terminationReason: "surface-intersection",
        firstSurfaceIntersection: vec(intersectionPoint.x, intersectionPoint.y),
        firstSurfaceArcLengthM: intersectionPoint.s,
        minSurfaceClearanceM,
      };
    }

    arcLength += stepM;
    state = nextState;
    previousAngle = nextAngle;
    points.push(makeRayPoint(nextState, arcLength));
  }

  return {
    launchAngleRad,
    points,
    incomingHeadingRad: state.headingRad,
    totalBendRad: state.headingRad - initialHeading,
    terminationReason: "max-arc",
    minSurfaceClearanceM,
  };
}

