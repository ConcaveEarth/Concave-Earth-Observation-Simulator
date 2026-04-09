import {
  getTargetAngle,
  localTangentAtAngle,
  localUpAtAngle,
  pointAtSurfaceHeight,
  toObserverFrame,
} from "./geometry";
import { clampAtmosphereCoefficient } from "./curvature";
import {
  getDefaultMaxArcLengthM,
  getDefaultStepM,
  traceRay,
} from "./raytrace";
import { clamp, lerp } from "./units";
import type {
  HorizonResult,
  ModelConfig,
  RayTrace,
  ScenarioInput,
  TerrainProfilePreset,
  Vec2,
  VisibilitySample,
  VisibilitySolveResult,
} from "./types";

interface SolvedRay {
  trace: RayTrace;
  actualElevationRad: number;
  apparentElevationRad: number;
  missHeightM: number;
}

interface HorizonSearchCandidate {
  result: HorizonResult;
  forwardX: number;
  launchAngleRad: number;
}

function getObserverPoint(scenario: ScenarioInput, model: ModelConfig): Vec2 {
  return pointAtSurfaceHeight(
    scenario.radiusM,
    0,
    model.geometryMode,
    scenario.observerHeightM,
  );
}

function getTargetPoint(
  scenario: ScenarioInput,
  model: ModelConfig,
  targetDistanceM: number,
  sampleHeightM: number,
): Vec2 {
  return pointAtSurfaceHeight(
    scenario.radiusM,
    getTargetAngle(targetDistanceM, scenario.radiusM),
    model.geometryMode,
    sampleHeightM,
  );
}

function solveGeometricHorizon(
  scenario: ScenarioInput,
  model: ModelConfig,
  observerPoint: Vec2,
  observerTangent: Vec2,
  observerUp: Vec2,
): HorizonResult | null {
  if (model.geometryMode !== "convex") {
    return null;
  }

  const observerRadius = scenario.radiusM + scenario.observerHeightM;
  const horizonAngle = Math.acos(scenario.radiusM / observerRadius);
  const point = pointAtSurfaceHeight(scenario.radiusM, horizonAngle, model.geometryMode, 0);
  const local = toObserverFrame(point, observerPoint, observerTangent, observerUp);

  return {
    point,
    surfaceAngleRad: horizonAngle,
    distanceM: scenario.radiusM * horizonAngle,
    apparentElevationRad: Math.atan2(local.y, local.x),
  };
}

function solveConvexOpticalHorizon(
  scenario: ScenarioInput,
  model: ModelConfig,
  observerPoint: Vec2,
  observerTangent: Vec2,
  observerUp: Vec2,
  terrainProfile: TerrainProfilePreset | null,
): HorizonResult | null {
  if (model.geometryMode !== "convex") {
    return null;
  }

  const coefficient =
    model.atmosphere.mode === "simpleCoefficient"
      ? clampAtmosphereCoefficient(model.atmosphere.coefficient)
      : 0;
  const relativeCurvatureFactor = Math.max(0.01, 1 - coefficient);
  const effectiveRadius = scenario.radiusM / relativeCurvatureFactor;
  const effectiveHorizonAngle = Math.acos(
    effectiveRadius / (effectiveRadius + scenario.observerHeightM),
  );
  const surfaceDistanceM = effectiveRadius * effectiveHorizonAngle;
  const actualSurfaceAngle = surfaceDistanceM / scenario.radiusM;
  const point = pointAtSurfaceHeight(
    scenario.radiusM,
    actualSurfaceAngle,
    model.geometryMode,
    0,
  );
  const launchCenter = -effectiveHorizonAngle;
  const maxArcLengthM = getDefaultMaxArcLengthM(scenario);
  const stepM = getDefaultStepM(scenario);

  const searchRange = (
    minLaunch: number,
    maxLaunch: number,
    attempts: number,
  ): HorizonSearchCandidate | null => {
    let best: HorizonSearchCandidate | null = null;

    for (let index = 0; index < attempts; index += 1) {
      const launchAngleRad = lerp(minLaunch, maxLaunch, index / (attempts - 1));
      const trace = traceRay({
        scenario,
        model,
        terrainProfile,
        launchAngleRad,
        targetAngleRad: null,
        maxArcLengthM,
        stepM,
      });

      if (!trace.firstSurfaceIntersection) {
        continue;
      }

      const localIntersection = toObserverFrame(
        trace.firstSurfaceIntersection,
        observerPoint,
        observerTangent,
        observerUp,
      );

      if (localIntersection.x <= 0) {
        continue;
      }

      const surfaceAngleRad = Math.atan2(
        trace.firstSurfaceIntersection.y,
        trace.firstSurfaceIntersection.x,
      );
      const result: HorizonResult = {
        point: trace.firstSurfaceIntersection,
        surfaceAngleRad,
        trace,
        distanceM: Math.abs(scenario.radiusM * surfaceAngleRad),
        apparentElevationRad: launchAngleRad,
      };

      if (!best || localIntersection.x > best.forwardX) {
        best = { result, forwardX: localIntersection.x, launchAngleRad };
      }
    }

    return best;
  };

  let tracedBest =
    searchRange(
      clamp(launchCenter - 0.16, -0.9, 0.04),
      clamp(launchCenter + 0.06, -0.9, 0.04),
      96,
    ) ??
    searchRange(-0.48, 0, 96);

  if (tracedBest) {
    for (const windowSize of [0.05, 0.018] as const) {
      const refined = searchRange(
        clamp(tracedBest.launchAngleRad - windowSize, -0.9, 0.04),
        clamp(tracedBest.launchAngleRad + windowSize, -0.9, 0.04),
        72,
      );

      if (refined) {
        tracedBest = refined;
      }
    }
  }

  return {
    point,
    surfaceAngleRad: actualSurfaceAngle,
    trace: tracedBest?.result.trace,
    distanceM: surfaceDistanceM,
    apparentElevationRad: -effectiveHorizonAngle,
  };
}

function evaluateRayAtHeight(
  scenario: ScenarioInput,
  model: ModelConfig,
  targetDistanceM: number,
  sampleHeightM: number,
  terrainProfile: TerrainProfilePreset | null = null,
): SolvedRay | null {
  const observerPoint = getObserverPoint(scenario, model);
  const observerTangent = localTangentAtAngle(0);
  const observerUp = localUpAtAngle(0, model.geometryMode);
  const targetAngleRad = getTargetAngle(targetDistanceM, scenario.radiusM);
  const targetPoint = getTargetPoint(scenario, model, targetDistanceM, sampleHeightM);
  const targetLocal = toObserverFrame(targetPoint, observerPoint, observerTangent, observerUp);
  const actualElevationRad = Math.atan2(targetLocal.y, targetLocal.x);
  const searchWindow = model.geometryMode === "concave" ? 0.34 : 0.22;
  const launchMin = clamp(actualElevationRad - searchWindow, -1.25, 1.25);
  const launchMax = clamp(actualElevationRad + searchWindow, -1.25, 1.25);
  const samples = 21;
  const toleranceM = Math.max(0.8, scenario.targetHeightM / (scenario.targetSampleCount * 2));
  const trials: Array<{ angle: number; miss: number; trace: RayTrace }> = [];

  for (let index = 0; index < samples; index += 1) {
    const angle = lerp(launchMin, launchMax, index / (samples - 1));
    const trace = traceRay({
      scenario,
      model,
      terrainProfile,
      launchAngleRad: angle,
      targetAngleRad,
    });

    if (!trace.targetCrossing) {
      continue;
    }

    const miss = trace.targetCrossing.heightM - sampleHeightM;
    trace.targetCrossing.missHeightM = miss;
    trials.push({ angle, miss, trace });
  }

  if (!trials.length) {
    return null;
  }

  const directHit = trials.reduce((best, candidate) =>
    Math.abs(candidate.miss) < Math.abs(best.miss) ? candidate : best,
  );

  if (Math.abs(directHit.miss) <= toleranceM) {
    return {
      trace: directHit.trace,
      actualElevationRad,
      apparentElevationRad: directHit.trace.launchAngleRad,
      missHeightM: directHit.miss,
    };
  }

  for (let index = 0; index < trials.length - 1; index += 1) {
    const left = trials[index];
    const right = trials[index + 1];

    if (Math.sign(left.miss) === Math.sign(right.miss)) {
      continue;
    }

    let low = left;
    let high = right;
    let best = Math.abs(low.miss) < Math.abs(high.miss) ? low : high;

    for (let iteration = 0; iteration < 18; iteration += 1) {
      const angle = (low.angle + high.angle) / 2;
      const trace = traceRay({
        scenario,
        model,
        terrainProfile,
        launchAngleRad: angle,
        targetAngleRad,
      });

      if (!trace.targetCrossing) {
        break;
      }

      const miss = trace.targetCrossing.heightM - sampleHeightM;
      trace.targetCrossing.missHeightM = miss;
      const candidate = { angle, miss, trace };

      if (Math.abs(candidate.miss) < Math.abs(best.miss)) {
        best = candidate;
      }

      if (Math.abs(miss) <= toleranceM) {
        best = candidate;
        break;
      }

      if (Math.sign(miss) === Math.sign(low.miss)) {
        low = candidate;
      } else {
        high = candidate;
      }
    }

    if (Math.abs(best.miss) <= toleranceM * 2) {
      return {
        trace: best.trace,
        actualElevationRad,
        apparentElevationRad: best.trace.launchAngleRad,
        missHeightM: best.miss,
      };
    }
  }

  return null;
}

export function solveTargetPointVisibility(
  scenario: ScenarioInput,
  model: ModelConfig,
  targetDistanceM: number,
  sampleHeightM: number,
  terrainProfile: TerrainProfilePreset | null = null,
): VisibilitySample {
  const observerPoint = getObserverPoint(scenario, model);
  const observerTangent = localTangentAtAngle(0);
  const observerUp = localUpAtAngle(0, model.geometryMode);
  const targetAngleRad = getTargetAngle(targetDistanceM, scenario.radiusM);
  const targetPoint = getTargetPoint(scenario, model, targetDistanceM, sampleHeightM);
  const localTarget = toObserverFrame(targetPoint, observerPoint, observerTangent, observerUp);
  const actualElevationRad = Math.atan2(localTarget.y, localTarget.x);
  const solved = evaluateRayAtHeight(
    scenario,
    model,
    targetDistanceM,
    sampleHeightM,
    terrainProfile,
  );

  return {
    targetDistanceM,
    targetAngleRad,
    targetPoint,
    sampleHeightM,
    visible: Boolean(solved),
    trace: solved?.trace,
    apparentElevationRad: solved?.apparentElevationRad,
    actualElevationRad,
    missHeightM: solved?.missHeightM ?? Number.POSITIVE_INFINITY,
  };
}

function solveOpticalHorizon(
  scenario: ScenarioInput,
  model: ModelConfig,
  observerPoint: Vec2,
  observerTangent: Vec2,
  observerUp: Vec2,
  terrainProfile: TerrainProfilePreset | null,
): HorizonResult | null {
  if (model.geometryMode === "convex") {
    return solveConvexOpticalHorizon(
      scenario,
      model,
      observerPoint,
      observerTangent,
      observerUp,
      terrainProfile,
    );
  }

  const attempts = 72;
  const maxArcLengthM = getDefaultMaxArcLengthM(scenario);
  const stepM = getDefaultStepM(scenario);

  function searchRange(minLaunch: number, maxLaunch: number) {
    let best: { result: HorizonResult; forwardX: number } | null = null;

    for (let index = 0; index < attempts; index += 1) {
      const launchAngleRad = lerp(minLaunch, maxLaunch, index / (attempts - 1));
      const trace = traceRay({
        scenario,
        model,
        terrainProfile,
        launchAngleRad,
        targetAngleRad: null,
        maxArcLengthM,
        stepM,
      });

      if (!trace.firstSurfaceIntersection) {
        continue;
      }

      const localIntersection = toObserverFrame(
        trace.firstSurfaceIntersection,
        observerPoint,
        observerTangent,
        observerUp,
      );

      if (localIntersection.x <= 0) {
        continue;
      }

      const result: HorizonResult = {
        point: trace.firstSurfaceIntersection,
        surfaceAngleRad: Math.atan2(
          trace.firstSurfaceIntersection.y,
          trace.firstSurfaceIntersection.x,
        ),
        trace,
        distanceM:
          scenario.radiusM *
          Math.atan2(trace.firstSurfaceIntersection.y, trace.firstSurfaceIntersection.x),
        apparentElevationRad: Math.min(launchAngleRad, 0),
      };

      if (!best || localIntersection.x > best.forwardX) {
        best = { result, forwardX: localIntersection.x };
      }
    }

    return best;
  }

  return (
    searchRange(-0.48, 0)?.result ??
    searchRange(-0.48, 0.12)?.result ??
    null
  );
}

function refineHiddenHeightBoundary(
  scenario: ScenarioInput,
  model: ModelConfig,
  targetSamples: VisibilitySample[],
  terrainProfile: TerrainProfilePreset | null,
): number {
  const lowestVisibleIndex = targetSamples.findIndex((sample) => sample.visible);

  if (lowestVisibleIndex < 0) {
    return scenario.targetHeightM;
  }

  if (lowestVisibleIndex === 0) {
    return 0;
  }

  const blockedBelow = targetSamples[lowestVisibleIndex - 1];
  const visibleAbove = targetSamples[lowestVisibleIndex];

  if (!blockedBelow || blockedBelow.visible || !visibleAbove?.visible) {
    return visibleAbove?.sampleHeightM ?? scenario.targetHeightM;
  }

  let low = blockedBelow.sampleHeightM;
  let high = visibleAbove.sampleHeightM;
  let bestVisible = high;
  const toleranceM = Math.max(0.05, Math.min(0.5, scenario.targetHeightM / 10_000));

  for (let iteration = 0; iteration < 16 && high - low > toleranceM; iteration += 1) {
    const middle = (low + high) / 2;
    const sample = solveTargetPointVisibility(
      scenario,
      model,
      scenario.surfaceDistanceM,
      middle,
      terrainProfile,
    );

    if (sample.visible) {
      bestVisible = middle;
      high = middle;
    } else {
      low = middle;
    }
  }

  return bestVisible;
}

export function solveVisibility(
  scenario: ScenarioInput,
  model: ModelConfig,
  terrainProfile: TerrainProfilePreset | null = null,
): VisibilitySolveResult {
  const observerPoint = getObserverPoint(scenario, model);
  const observerSurfacePoint = pointAtSurfaceHeight(
    scenario.radiusM,
    0,
    model.geometryMode,
    0,
  );
  const targetBasePoint = getTargetPoint(scenario, model, scenario.surfaceDistanceM, 0);
  const targetTopPoint = getTargetPoint(
    scenario,
    model,
    scenario.surfaceDistanceM,
    scenario.targetHeightM,
  );
  const targetAngleRad = getTargetAngle(scenario.surfaceDistanceM, scenario.radiusM);
  const observerTangent = localTangentAtAngle(0);
  const observerUp = localUpAtAngle(0, model.geometryMode);
  const geometricHorizon = solveGeometricHorizon(
    scenario,
    model,
    observerPoint,
    observerTangent,
    observerUp,
  );
  const opticalHorizon = solveOpticalHorizon(
    scenario,
    model,
    observerPoint,
    observerTangent,
    observerUp,
    terrainProfile,
  );

  const sampleCount = Math.max(4, scenario.targetSampleCount);
  const targetSamples: VisibilitySample[] = [];
  let solvedVisibleSamples = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const sampleHeightM =
      sampleCount === 1 ? 0 : (scenario.targetHeightM * index) / (sampleCount - 1);
    const sample = solveTargetPointVisibility(
      scenario,
      model,
      scenario.surfaceDistanceM,
      sampleHeightM,
      terrainProfile,
    );

    if (sample.visible) {
      solvedVisibleSamples += 1;
    }

    targetSamples.push(sample);
  }

  const visibleSamples = targetSamples.filter((sample) => sample.visible);
  const lowestVisible = visibleSamples[0];
  const highestVisible = visibleSamples[visibleSamples.length - 1];
  const hiddenHeightM = lowestVisible
    ? refineHiddenHeightBoundary(scenario, model, targetSamples, terrainProfile)
    : scenario.targetHeightM;
  const visibleHeightM = Math.max(0, scenario.targetHeightM - hiddenHeightM);
  const visibilityFraction =
    scenario.targetHeightM > 0
      ? visibleHeightM / scenario.targetHeightM
      : visibleSamples.length
        ? 1
        : 0;

  return {
    scenario,
    model,
    terrainProfile,
    observerPoint,
    observerSurfacePoint,
    targetBasePoint,
    targetTopPoint,
    targetAngleRad,
    observerTangent,
    observerUp,
    geometricHorizon,
    opticalHorizon,
    targetSamples,
    primaryRay: highestVisible?.trace ?? opticalHorizon?.trace ?? null,
    visible: Boolean(visibleSamples.length),
    hiddenHeightM,
    visibleHeightM,
    visibilityFraction,
    apparentElevationRad:
      highestVisible?.apparentElevationRad ?? opticalHorizon?.apparentElevationRad ?? null,
    actualElevationRad:
      highestVisible?.actualElevationRad ?? visibleSamples[0]?.actualElevationRad ?? 0,
    firstBlockingIntersection:
      targetSamples.find((sample) => !sample.visible)?.trace?.firstSurfaceIntersection ??
      null,
    solverMetadata: {
      stepM: getDefaultStepM(scenario),
      maxArcLengthM: getDefaultMaxArcLengthM(scenario),
      sampleCount,
      solvedVisibleSamples,
    },
  };
}
