import {
  getTargetAngle,
  heightFromRadius,
  length,
  localTangentAtAngle,
  localUpAtAngle,
  pointAtSurfaceHeight,
  toObserverFrame,
} from "./geometry";
import { clampAtmosphereCoefficient } from "./curvature";
import {
  getObserverTotalHeightM,
  getObserverSurfaceElevationM,
  getTargetBaseElevationM,
  getTargetObjectHeightM,
  getTargetTopElevationM,
} from "./scenario";
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

interface RayTrial {
  angle: number;
  miss: number;
  trace: RayTrace;
  reachesTarget: boolean;
}

interface HorizonTraceTrial {
  launchAngleRad: number;
  trace: RayTrace;
  clearanceM: number;
  intersectsSurface: boolean;
}

function getPrecisionStepM(
  scenario: ScenarioInput,
  model: ModelConfig,
  targetDistanceM: number,
): number {
  const base = getDefaultStepM({ ...scenario, surfaceDistanceM: targetDistanceM });

  if (model.geometryMode === "convex") {
    return clamp(base / 3, 30, 180);
  }

  return clamp(base / 2, 60, 260);
}

function getConvexHorizonTraceStepM(surfaceDistanceM: number): number {
  return clamp(surfaceDistanceM / 280, 8, 100);
}

function getObserverPoint(scenario: ScenarioInput, model: ModelConfig): Vec2 {
  return pointAtSurfaceHeight(
    scenario.radiusM,
    0,
    model.geometryMode,
    getObserverTotalHeightM(scenario),
  );
}

function getTargetPoint(
  scenario: ScenarioInput,
  model: ModelConfig,
  targetDistanceM: number,
  absoluteHeightM: number,
): Vec2 {
  return pointAtSurfaceHeight(
    scenario.radiusM,
    getTargetAngle(targetDistanceM, scenario.radiusM),
    model.geometryMode,
    absoluteHeightM,
  );
}

function evaluateTargetTrial(
  trace: RayTrace,
  scenario: ScenarioInput,
  model: ModelConfig,
  targetAngleRad: number,
  absoluteTargetHeightM: number,
): RayTrial {
  if (trace.targetCrossing) {
    const miss = trace.targetCrossing.heightM - absoluteTargetHeightM;
    trace.targetCrossing.missHeightM = miss;

    return {
      angle: trace.launchAngleRad,
      miss,
      trace,
      reachesTarget: true,
    };
  }

  if (trace.firstSurfaceIntersection) {
    const surfaceAngleRad = Math.abs(
      Math.atan2(trace.firstSurfaceIntersection.y, trace.firstSurfaceIntersection.x),
    );
    const arcShortfallM = Math.max(0, targetAngleRad - surfaceAngleRad) * scenario.radiusM;

    return {
      angle: trace.launchAngleRad,
      miss: -Math.max(absoluteTargetHeightM, 1) - arcShortfallM * 0.01,
      trace,
      reachesTarget: false,
    };
  }

  const lastPoint = trace.points[trace.points.length - 1];
  const lastAngleRad = Math.abs(Math.atan2(lastPoint.y, lastPoint.x));

  if (lastAngleRad >= targetAngleRad) {
    const lastHeightM = heightFromRadius(
      length(lastPoint),
      scenario.radiusM,
      model.geometryMode,
    );

    return {
      angle: trace.launchAngleRad,
      miss: lastHeightM - absoluteTargetHeightM,
      trace,
      reachesTarget: false,
    };
  }

  return {
    angle: trace.launchAngleRad,
    miss: -Math.max(absoluteTargetHeightM, 1),
    trace,
    reachesTarget: false,
  };
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

  const observerRadius = scenario.radiusM + getObserverTotalHeightM(scenario);
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
    effectiveRadius / (effectiveRadius + getObserverTotalHeightM(scenario)),
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
  const maxArcLengthM = Math.max(
    getDefaultMaxArcLengthM({
      ...scenario,
      surfaceDistanceM,
    }),
    surfaceDistanceM + Math.max(20_000, surfaceDistanceM * 0.75),
  );
  const stepM = getConvexHorizonTraceStepM(surfaceDistanceM);

  const traceForLaunch = (launchAngleRad: number): HorizonTraceTrial => {
    const trace = traceRay({
      scenario,
      model,
      terrainProfile,
      launchAngleRad,
      targetAngleRad: null,
      maxArcLengthM,
      stepM,
    });

    return {
      launchAngleRad,
      trace,
      clearanceM: trace.minSurfaceClearanceM,
      intersectsSurface: Boolean(trace.firstSurfaceIntersection),
    };
  };

  let steeper: HorizonTraceTrial | null = null;
  let shallower: HorizonTraceTrial | null = null;
  let windowSize = Math.max(0.0006, Math.abs(launchCenter) * 0.75 + 0.0006);

  for (let index = 0; index < 12; index += 1) {
    const steeperCandidate = traceForLaunch(
      clamp(launchCenter - windowSize, -0.9, 0.04),
    );
    const shallowerCandidate = traceForLaunch(
      clamp(launchCenter + windowSize, -0.9, 0.04),
    );

    if (steeperCandidate.clearanceM <= 0 || steeperCandidate.intersectsSurface) {
      steeper = steeperCandidate;
    }

    if (shallowerCandidate.clearanceM > 0 && !shallowerCandidate.intersectsSurface) {
      shallower = shallowerCandidate;
    }

    if (steeper && shallower) {
      break;
    }

    windowSize *= 1.75;
  }

  let tracedBest: HorizonTraceTrial | null = null;

  if (steeper && shallower) {
    tracedBest =
      Math.abs(steeper.clearanceM) < Math.abs(shallower.clearanceM)
        ? steeper
        : shallower;

    for (let iteration = 0; iteration < 32; iteration += 1) {
      const middleAngle = (steeper.launchAngleRad + shallower.launchAngleRad) / 2;
      const middle = traceForLaunch(middleAngle);

      if (Math.abs(middle.clearanceM) < Math.abs(tracedBest.clearanceM)) {
        tracedBest = middle;
      }

      if (middle.clearanceM <= 0 || middle.intersectsSurface) {
        steeper = middle;
      } else {
        shallower = middle;
      }
    }

    const displayTraceRaw = traceRay({
      scenario,
      model,
      terrainProfile,
      launchAngleRad: tracedBest.launchAngleRad,
      targetAngleRad: actualSurfaceAngle,
      maxArcLengthM,
      stepM,
    });

    if (displayTraceRaw.targetCrossing) {
      const snappedPoint = {
        x: point.x,
        y: point.y,
        headingRad:
          displayTraceRaw.points[displayTraceRaw.points.length - 1]?.headingRad ??
          displayTraceRaw.incomingHeadingRad,
        s: displayTraceRaw.targetCrossing.arcLengthM,
      };
      const snappedPoints = [...displayTraceRaw.points];
      snappedPoints[snappedPoints.length - 1] = snappedPoint;
      tracedBest = {
        ...tracedBest,
        trace: {
          ...displayTraceRaw,
          points: snappedPoints,
          firstSurfaceIntersection: point,
          firstSurfaceArcLengthM: displayTraceRaw.targetCrossing.arcLengthM,
        },
      };
    }
  }

  return {
    point,
    surfaceAngleRad: actualSurfaceAngle,
    trace: tracedBest?.trace,
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
  const absoluteTargetHeightM = getTargetBaseElevationM(scenario) + sampleHeightM;
  const targetPoint = getTargetPoint(scenario, model, targetDistanceM, absoluteTargetHeightM);
  const targetLocal = toObserverFrame(targetPoint, observerPoint, observerTangent, observerUp);
  const actualElevationRad = Math.atan2(targetLocal.y, targetLocal.x);
  const stepM = getPrecisionStepM(scenario, model, targetDistanceM);
  const searchWindow = model.geometryMode === "concave" ? 0.34 : 0.22;
  const launchMin = clamp(actualElevationRad - searchWindow, -1.25, 1.25);
  const launchMax = clamp(actualElevationRad + searchWindow, -1.25, 1.25);
  const samples = model.geometryMode === "convex" ? 45 : 25;
  const toleranceM = Math.max(
    0.8,
    getTargetObjectHeightM(scenario) / (scenario.targetSampleCount * 2),
  );
  const trials: RayTrial[] = [];
  const usesBlockedBracketSolve = model.geometryMode === "convex";

  for (let index = 0; index < samples; index += 1) {
    const angle = lerp(launchMin, launchMax, index / (samples - 1));
    const trace = traceRay({
      scenario,
      model,
      terrainProfile,
      launchAngleRad: angle,
      targetAngleRad,
      stepM,
    });

    if (usesBlockedBracketSolve) {
      const evaluated = evaluateTargetTrial(
        trace,
        scenario,
        model,
        targetAngleRad,
        absoluteTargetHeightM,
      );
      evaluated.angle = angle;
      trials.push(evaluated);
      continue;
    }

    if (trace.targetCrossing) {
      const miss = trace.targetCrossing.heightM - absoluteTargetHeightM;
      trace.targetCrossing.missHeightM = miss;
      trials.push({
        angle,
        miss,
        trace,
        reachesTarget: true,
      });
    }
  }

  if (!trials.length) {
    return null;
  }

  const visibleTrials = trials.filter((trial) => trial.reachesTarget);

  if (!visibleTrials.length) {
    return null;
  }

  const sortedTrials = [...visibleTrials].sort(
    (left, right) => Math.abs(left.miss) - Math.abs(right.miss),
  );
  const directHit = sortedTrials[0];

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
        stepM,
      });
      const candidate = evaluateTargetTrial(
        trace,
        scenario,
        model,
        targetAngleRad,
        absoluteTargetHeightM,
      );
      candidate.angle = angle;

      if (Math.abs(candidate.miss) < Math.abs(best.miss)) {
        best = candidate;
      }

      if (candidate.reachesTarget && Math.abs(candidate.miss) <= toleranceM) {
        best = candidate;
        break;
      }

      if (Math.sign(candidate.miss) === Math.sign(low.miss)) {
        low = candidate;
      } else {
        high = candidate;
      }
    }

    if (best.reachesTarget && Math.abs(best.miss) <= toleranceM * 2) {
      return {
        trace: best.trace,
        actualElevationRad,
        apparentElevationRad: best.trace.launchAngleRad,
        missHeightM: best.miss,
      };
    }
  }

  const bestIndex = trials.findIndex((trial) => trial === directHit);

  if (bestIndex >= 0) {
    const leftNeighbor = trials[Math.max(0, bestIndex - 1)];
    const rightNeighbor = trials[Math.min(trials.length - 1, bestIndex + 1)];
    const refinementMin = Math.min(
      leftNeighbor?.angle ?? directHit.angle,
      directHit.angle,
      rightNeighbor?.angle ?? directHit.angle,
    );
    const refinementMax = Math.max(
      leftNeighbor?.angle ?? directHit.angle,
      directHit.angle,
      rightNeighbor?.angle ?? directHit.angle,
    );

    if (refinementMax - refinementMin > 1e-6) {
      let best = directHit;

      for (let iteration = 0; iteration < 4; iteration += 1) {
        const windowCenter = best.angle;
        const windowHalfSpan = Math.max(
          (refinementMax - refinementMin) / Math.pow(2, iteration + 1),
          1e-5,
        );
        const minAngle = clamp(windowCenter - windowHalfSpan, launchMin, launchMax);
        const maxAngle = clamp(windowCenter + windowHalfSpan, launchMin, launchMax);

        for (let index = 0; index < 7; index += 1) {
          const angle =
            minAngle + ((maxAngle - minAngle) * index) / 6;
          const trace = traceRay({
            scenario,
            model,
            terrainProfile,
            launchAngleRad: angle,
            targetAngleRad,
            stepM,
          });
          const candidate = evaluateTargetTrial(
            trace,
            scenario,
            model,
            targetAngleRad,
            absoluteTargetHeightM,
          );
          candidate.angle = angle;

          if (
            candidate.reachesTarget &&
            Math.abs(candidate.miss) < Math.abs(best.miss)
          ) {
            best = candidate;
          }
        }

        if (best.reachesTarget && Math.abs(best.miss) <= toleranceM) {
          return {
            trace: best.trace,
            actualElevationRad,
            apparentElevationRad: best.trace.launchAngleRad,
            missHeightM: best.miss,
          };
        }
      }

      if (best.reachesTarget && Math.abs(best.miss) <= toleranceM * 1.5) {
        return {
          trace: best.trace,
          actualElevationRad,
          apparentElevationRad: best.trace.launchAngleRad,
          missHeightM: best.miss,
        };
      }
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
  const absoluteHeightM = getTargetBaseElevationM(scenario) + sampleHeightM;
  const targetPoint = getTargetPoint(scenario, model, targetDistanceM, absoluteHeightM);
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
    absoluteHeightM,
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
    getObserverSurfaceElevationM(scenario),
  );
  const targetBasePoint = getTargetPoint(
    scenario,
    model,
    scenario.surfaceDistanceM,
    getTargetBaseElevationM(scenario),
  );
  const targetTopPoint = getTargetPoint(
    scenario,
    model,
    scenario.surfaceDistanceM,
    getTargetTopElevationM(scenario),
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
