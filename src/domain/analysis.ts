import {
  getTargetAngle,
  localTangentAtAngle,
  localUpAtAngle,
  pointAtSurfaceHeight,
  toObserverFrame,
} from "./geometry";
import {
  getDefaultMaxArcLengthM,
  getDefaultStepM,
  traceRay,
} from "./raytrace";
import {
  createGenericTargetProfile,
  getTerrainProfileByPresetId,
  sampleTerrainProfileHeight,
} from "./profiles";
import { solveTargetPointVisibility, solveVisibility } from "./solver";
import { clamp, formatAngle, formatDistance, formatFraction, formatHeight, lerp } from "./units";
import type {
  FocusedModel,
  ModelConfig,
  ScenarioInput,
  TerrainProfilePreset,
  VisibilitySample,
  VisibilitySolveResult,
  Vec2,
} from "./types";
import type { UnitPreferences } from "./units";
import { getModelLabel, type LanguageMode } from "../i18n";

export type AnalysisTab =
  | "cross-section"
  | "ray-bundle"
  | "observer-view"
  | "sweep"
  | "profile-visibility";
export type SweepParameter =
  | "distance"
  | "observerHeight"
  | "targetHeight"
  | "atmosphere";
export type SweepMetric =
  | "hiddenHeight"
  | "visibilityFraction"
  | "apparentElevation"
  | "opticalHorizon";
export type SweepRangeMode = "focused" | "operational" | "wide";

export interface SweepConfig {
  parameter: SweepParameter;
  metric: SweepMetric;
  rangeMode: SweepRangeMode;
  sampleCount: number;
}

export interface SweepRange {
  min: number;
  max: number;
  current: number;
}

export interface SweepSeriesPoint {
  x: number;
  y: number | null;
  result: VisibilitySolveResult;
}

export interface SweepSeries {
  id: FocusedModel;
  label: string;
  color: string;
  points: SweepSeriesPoint[];
}

export interface SweepChartData {
  parameter: SweepParameter;
  metric: SweepMetric;
  range: SweepRange;
  series: SweepSeries[];
  yMin: number;
  yMax: number;
}

export interface BundleTrace {
  id: string;
  featureId: string;
  color: string;
  width: number;
  dashed?: boolean;
  points: Vec2[];
}

export interface BundleMarker {
  id: string;
  featureId: string;
  point: Vec2;
  color: string;
}

export interface RayBundlePanelData {
  sceneKey: FocusedModel;
  title: string;
  subtitle: string;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  suggestedVerticalScale: number;
  surfacePoints: Vec2[];
  targetStem: {
    base: Vec2;
    top: Vec2;
    visibleStart: Vec2;
  };
  observerStem: {
    base: Vec2;
    top: Vec2;
  };
  traces: BundleTrace[];
  markers: BundleMarker[];
  samplePoints: Array<{
    id: string;
    point: Vec2;
    visible: boolean;
    distanceM: number;
    heightM: number;
  }>;
  stats: {
    visibleSamples: number;
    blockedSamples: number;
    visibilityFractionLabel: string;
    bundleSpanM: number;
  };
}

export interface ProfileVisibilityTrace {
  id: string;
  color: string;
  width: number;
  dashed?: boolean;
  points: Vec2[];
}

export interface ProfileVisibilitySamplePoint {
  id: string;
  point: Vec2;
  distanceM: number;
  heightM: number;
  visible: boolean;
  apparentElevationRad: number | null;
}

export interface ProfileVisibilityPanelData {
  sceneKey: FocusedModel;
  title: string;
  subtitle: string;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  suggestedVerticalScale: number;
  surfacePoints: Vec2[];
  profilePolyline: Vec2[];
  profileSegments: ProfileVisibilityTrace[];
  observerStem: {
    base: Vec2;
    top: Vec2;
  };
  traces: ProfileVisibilityTrace[];
  markers: Array<{
    id: string;
    point: Vec2;
    color: string;
    label: string;
  }>;
  samplePoints: ProfileVisibilitySamplePoint[];
  stats: {
    visibleSamples: number;
    blockedSamples: number;
    visibilityFractionLabel: string;
    visibleSpanM: number;
    sampleCount: number;
    maxProfileHeightM: number;
  };
}

export interface ObserverViewMarker {
  id: string;
  point: Vec2;
  color: string;
  label: string;
}

export interface ObserverViewPanelData {
  sceneKey: FocusedModel;
  title: string;
  subtitle: string;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  horizonElevationRad: number;
  eyeLevelElevationRad: number;
  visibleSilhouette: Vec2[];
  ghostSilhouette: Vec2[];
  samplePoints: Array<{
    id: string;
    point: Vec2;
    visible: boolean;
    distanceM: number;
    heightM: number;
    apparentElevationRad: number | null;
    actualElevationRad: number;
  }>;
  markers: ObserverViewMarker[];
  stats: {
    visibleSamples: number;
    blockedSamples: number;
    visibilityFractionLabel: string;
    horizonDipLabel: string;
    apparentProfileSpanM: number;
    topVisibleElevationRad: number | null;
    topGhostElevationRad: number;
  };
}

export const defaultSweepConfig: SweepConfig = {
  parameter: "distance",
  metric: "hiddenHeight",
  rangeMode: "operational",
  sampleCount: 24,
};

const sweepSeriesColors: Record<FocusedModel, string> = {
  primary: "#ffd07e",
  comparison: "#7dd7ff",
};

function collectBounds(
  points: Vec2[],
  {
    xPaddingFactor = 0.08,
    minXPad = 900,
    topPaddingFactor = 0.18,
    bottomPaddingFactor = 0.3,
    minTopPad = 140,
    minBottomPad = 200,
  }: {
    xPaddingFactor?: number;
    minXPad?: number;
    topPaddingFactor?: number;
    bottomPaddingFactor?: number;
    minTopPad?: number;
    minBottomPad?: number;
  } = {},
) {
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const paddingX = Math.max(spanX * xPaddingFactor, minXPad);
  const paddingTop = Math.max(spanY * topPaddingFactor, minTopPad);
  const paddingBottom = Math.max(spanY * bottomPaddingFactor, minBottomPad);

  return {
    minX: minX - paddingX,
    maxX: maxX + paddingX,
    minY: minY - paddingBottom,
    maxY: maxY + paddingTop,
  };
}

function getVerticalExaggeration(focusDistanceM: number, samples: Vec2[]): number {
  const minY = Math.min(...samples.map((point) => point.y));
  const maxY = Math.max(...samples.map((point) => point.y));
  const rawSpan = Math.max(maxY - minY, 40);
  const targetSpan = focusDistanceM * 0.3;
  return clamp(targetSpan / rawSpan, 8, 70);
}

function createObserverFrame(result: VisibilitySolveResult) {
  const observerPoint = pointAtSurfaceHeight(
    result.scenario.radiusM,
    0,
    result.model.geometryMode,
    result.scenario.observerHeightM,
  );
  const observerTangent = localTangentAtAngle(0);
  const observerUp = localUpAtAngle(0, result.model.geometryMode);

  return {
    observerPoint,
    observerTangent,
    observerUp,
  };
}

function transformToObserverFrame(result: VisibilitySolveResult, point: Vec2) {
  const frame = createObserverFrame(result);
  return toObserverFrame(point, frame.observerPoint, frame.observerTangent, frame.observerUp);
}

function exaggerate(points: Vec2[], verticalScale: number) {
  return points.map((point) => ({
    x: point.x,
    y: point.y * verticalScale,
  }));
}

function getBundleMetricValue(result: VisibilitySolveResult, metric: SweepMetric): number | null {
  switch (metric) {
    case "hiddenHeight":
      return result.hiddenHeightM;
    case "visibilityFraction":
      return result.visibilityFraction * 100;
    case "apparentElevation":
      return result.apparentElevationRad == null ? null : (result.apparentElevationRad * 180) / Math.PI;
    case "opticalHorizon":
      return result.opticalHorizon?.distanceM ?? null;
    default:
      return null;
  }
}

export function getSweepRange(
  scenario: ScenarioInput,
  config: SweepConfig,
  model: ModelConfig,
): SweepRange {
  switch (config.parameter) {
    case "distance": {
      const current = scenario.surfaceDistanceM;
      if (config.rangeMode === "focused") {
        return {
          min: Math.max(1_000, current * 0.45),
          max: Math.max(current * 1.35, 6_000),
          current,
        };
      }
      if (config.rangeMode === "wide") {
        return {
          min: 1_000,
          max: Math.min(scenario.radiusM * Math.PI * 0.42, Math.max(current * 3, 60_000)),
          current,
        };
      }
      return {
        min: Math.max(1_000, current * 0.25),
        max: Math.max(current * 2, 20_000),
        current,
      };
    }
    case "observerHeight": {
      const current = scenario.observerHeightM;
      if (config.rangeMode === "focused") {
        return { min: 0, max: Math.max(current * 2.5, 30), current };
      }
      if (config.rangeMode === "wide") {
        return { min: 0, max: Math.max(current * 20, 40_000), current };
      }
      return { min: 0, max: Math.max(current * 6, 800), current };
    }
    case "targetHeight": {
      const current = scenario.targetHeightM;
      if (config.rangeMode === "focused") {
        return { min: 0, max: Math.max(current * 2.5, 30), current };
      }
      if (config.rangeMode === "wide") {
        return { min: 0, max: Math.max(current * 12, 12_000), current };
      }
      return { min: 0, max: Math.max(current * 5, 600), current };
    }
    case "atmosphere":
    default: {
      const current = model.atmosphere.mode === "simpleCoefficient" ? model.atmosphere.coefficient : 0;
      if (config.rangeMode === "focused") {
        return { min: -0.3, max: 0.3, current };
      }
      if (config.rangeMode === "wide") {
        return { min: -0.99, max: 0.99, current };
      }
      return { min: -0.6, max: 0.6, current };
    }
  }
}

function applySweepValue(
  scenario: ScenarioInput,
  model: ModelConfig,
  parameter: SweepParameter,
  value: number,
): { scenario: ScenarioInput; model: ModelConfig } {
  switch (parameter) {
    case "distance":
      return {
        scenario: { ...scenario, surfaceDistanceM: value },
        model,
      };
    case "observerHeight":
      return {
        scenario: { ...scenario, observerHeightM: value },
        model,
      };
    case "targetHeight":
      return {
        scenario: { ...scenario, targetHeightM: value },
        model,
      };
    case "atmosphere":
    default:
      return {
        scenario,
        model: {
          ...model,
          atmosphere: {
            mode: "simpleCoefficient",
            coefficient: value,
          },
        },
      };
  }
}

export function buildSweepChartData(args: {
  scenario: ScenarioInput;
  primaryModel: ModelConfig;
  comparisonModel: ModelConfig;
  terrainProfile?: TerrainProfilePreset | null;
  focusedModel: FocusedModel;
  compareMode: boolean;
  config: SweepConfig;
  language?: LanguageMode;
}): SweepChartData {
  const baseRange = getSweepRange(args.scenario, args.config, args.primaryModel);
  const language = args.language ?? "en";
  const targets = args.compareMode
    ? ([
        {
          id: "primary" as const,
          label: getModelLabel(language, args.primaryModel),
          model: args.primaryModel,
        },
        {
          id: "comparison" as const,
          label: getModelLabel(language, args.comparisonModel),
          model: args.comparisonModel,
        },
      ] as const)
    : ([
        {
          id: args.focusedModel,
          label: getModelLabel(
            language,
            args.focusedModel === "primary"
              ? args.primaryModel
              : args.comparisonModel,
          ),
          model:
            args.focusedModel === "primary"
              ? args.primaryModel
              : args.comparisonModel,
        },
      ] as const);

  const series: SweepSeries[] = targets.map((target) => ({
    id: target.id,
    label: target.label,
    color: sweepSeriesColors[target.id],
    points: Array.from({ length: args.config.sampleCount }, (_, index) => {
      const fraction =
        args.config.sampleCount === 1 ? 0 : index / (args.config.sampleCount - 1);
      const value = lerp(baseRange.min, baseRange.max, fraction);
      const applied = applySweepValue(args.scenario, target.model, args.config.parameter, value);
      const result = solveVisibility(
        applied.scenario,
        applied.model,
        args.terrainProfile ?? null,
      );
      return {
        x: value,
        y: getBundleMetricValue(result, args.config.metric),
        result,
      };
    }),
  }));

  const allValues = series.flatMap((entry) =>
    entry.points
      .map((point) => point.y)
      .filter((value): value is number => value != null && Number.isFinite(value)),
  );
  const rawMin = allValues.length ? Math.min(...allValues) : 0;
  const rawMax = allValues.length ? Math.max(...allValues) : 1;
  const padding = Math.max((rawMax - rawMin) * 0.1, rawMax === rawMin ? 1 : 0);

  return {
    parameter: args.config.parameter,
    metric: args.config.metric,
    range: baseRange,
    series,
    yMin: args.config.metric === "visibilityFraction" ? 0 : rawMin - padding,
    yMax: args.config.metric === "visibilityFraction" ? 100 : rawMax + padding,
  };
}

export function formatSweepParameterValue(
  value: number,
  parameter: SweepParameter,
  units: UnitPreferences,
): string {
  switch (parameter) {
    case "distance":
      return formatDistance(value, units.distance);
    case "observerHeight":
    case "targetHeight":
      return formatHeight(value, units.height);
    case "atmosphere":
    default:
      return `k ${value.toFixed(2)}`;
  }
}

export function formatSweepMetricValue(
  value: number | null,
  metric: SweepMetric,
  units: UnitPreferences,
): string {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }

  switch (metric) {
    case "hiddenHeight":
      return formatHeight(value, units.height);
    case "visibilityFraction":
      return `${value.toFixed(1)}%`;
    case "apparentElevation":
      return formatAngle((value * Math.PI) / 180);
    case "opticalHorizon":
    default:
      return formatDistance(value, units.distance);
  }
}

export function buildRayBundlePanelData(
  result: VisibilitySolveResult,
  title: string,
  sceneKey: FocusedModel,
): RayBundlePanelData {
  const targetAngleRad = getTargetAngle(result.scenario.surfaceDistanceM, result.scenario.radiusM);
  const rawSurfaceSamples = Array.from({ length: 160 }, (_, index) => {
    const angle = lerp(
      -targetAngleRad * 0.12,
      targetAngleRad * 1.06,
      index / 159,
    );
    const point = pointAtSurfaceHeight(
      result.scenario.radiusM,
      angle,
      result.model.geometryMode,
      0,
    );
    return transformToObserverFrame(result, point);
  });
  const visibleTracePoints = result.targetSamples
    .filter((sample) => sample.visible && sample.trace?.points.length)
    .flatMap((sample, index) =>
      sample.trace!.points.map((point) => ({
        x: transformToObserverFrame(result, point).x,
        y: transformToObserverFrame(result, point).y,
        key: `visible-${index}`,
      })),
    );
  const targetBase = transformToObserverFrame(result, result.targetBasePoint);
  const targetTop = transformToObserverFrame(result, result.targetTopPoint);
  const visibleStartWorld = pointAtSurfaceHeight(
    result.scenario.radiusM,
    targetAngleRad,
    result.model.geometryMode,
    result.hiddenHeightM,
  );
  const targetVisibleStart = transformToObserverFrame(result, visibleStartWorld);
  const observerBase = transformToObserverFrame(result, result.observerSurfacePoint);
  const observerTop = { x: 0, y: 0 };
  const verticalScale = getVerticalExaggeration(
    result.scenario.surfaceDistanceM,
    [
      ...rawSurfaceSamples,
      ...visibleTracePoints.map((point) => ({ x: point.x, y: point.y })),
      targetBase,
      targetTop,
      targetVisibleStart,
      observerBase,
      observerTop,
    ],
  );
  const surfacePoints = exaggerate(rawSurfaceSamples, verticalScale);
  const traces: BundleTrace[] = [];
  const samplePoints: RayBundlePanelData["samplePoints"] = [];
  let visibleSamples = 0;
  let blockedSamples = 0;

  result.targetSamples.forEach((sample, index) => {
    const targetPoint = transformToObserverFrame(
      result,
      pointAtSurfaceHeight(
        result.scenario.radiusM,
        targetAngleRad,
        result.model.geometryMode,
        sample.sampleHeightM,
      ),
    );
    const exTargetPoint = { x: targetPoint.x, y: targetPoint.y * verticalScale };
    samplePoints.push({
      id: `sample-${index}`,
      point: exTargetPoint,
      visible: sample.visible,
      distanceM: result.scenario.surfaceDistanceM,
      heightM: sample.sampleHeightM,
    });

    if (sample.visible && sample.trace?.points.length) {
      visibleSamples += 1;
      traces.push({
        id: `bundle-visible-${index}`,
        featureId: "bundle-visible-rays",
        color: `rgba(255, 194, 101, ${0.34 + index / Math.max(result.targetSamples.length * 1.8, 1)})`,
        width: 1.8,
        points: sample.trace.points.map((point) => {
          const local = transformToObserverFrame(result, point);
          return { x: local.x, y: local.y * verticalScale };
        }),
      });
    } else {
      blockedSamples += 1;
      const blockedTrace = traceRay({
        scenario: result.scenario,
        model: result.model,
        launchAngleRad: sample.actualElevationRad,
        targetAngleRad,
        maxArcLengthM: getDefaultMaxArcLengthM(result.scenario),
        stepM: getDefaultStepM(result.scenario),
      });
      const blockedTracePoints = blockedTrace.points.map((point) => {
        const local = transformToObserverFrame(result, point);
        return { x: local.x, y: local.y * verticalScale };
      });
      traces.push({
        id: `bundle-hidden-${index}`,
        featureId: "bundle-blocked-rays",
        color: `rgba(222, 231, 242, ${0.22 + index / Math.max(result.targetSamples.length * 3.2, 1)})`,
        width: 1.2,
        dashed: true,
        points:
          blockedTracePoints.length > 1
            ? blockedTracePoints
            : [
                { x: 0, y: 0 },
                exTargetPoint,
              ],
      });
    }
  });

  const envelopePoints = samplePoints
    .filter((point) =>
      result.targetSamples[Number(point.id.replace("sample-", ""))]?.visible,
    )
    .map((point) => point.point);

  if (envelopePoints.length > 1) {
    traces.push({
      id: "bundle-envelope",
      featureId: "bundle-envelope",
      color: "rgba(124, 233, 201, 0.92)",
      width: 2.4,
      points: envelopePoints,
    });
  }

  const exObserverBase = { x: observerBase.x, y: observerBase.y * verticalScale };
  const exTargetBase = { x: targetBase.x, y: targetBase.y * verticalScale };
  const exTargetTop = { x: targetTop.x, y: targetTop.y * verticalScale };
  const exVisibleStart = { x: targetVisibleStart.x, y: targetVisibleStart.y * verticalScale };

  return {
    sceneKey,
    title,
    subtitle: `${visibleSamples}/${result.targetSamples.length} sampled rays reach the observer`,
    bounds: collectBounds(
      [
        ...surfacePoints,
        ...traces.flatMap((trace) => trace.points),
        exObserverBase,
        observerTop,
        exTargetBase,
        exTargetTop,
        exVisibleStart,
      ],
      {
        xPaddingFactor: 0.1,
        minXPad: Math.max(1_000, result.scenario.surfaceDistanceM * 0.03),
        topPaddingFactor: 0.2,
        bottomPaddingFactor: 0.36,
        minTopPad: Math.max(180, result.scenario.targetHeightM * verticalScale * 0.08),
        minBottomPad: Math.max(280, result.scenario.targetHeightM * verticalScale * 0.18),
      },
    ),
    suggestedVerticalScale: verticalScale,
    surfacePoints,
    targetStem: {
      base: exTargetBase,
      top: exTargetTop,
      visibleStart: exVisibleStart,
    },
    observerStem: {
      base: exObserverBase,
      top: observerTop,
    },
    traces,
    markers: [
      {
        id: "bundle-observer",
        featureId: "bundle-observer",
        point: observerTop,
        color: "#f5f2e8",
      },
      {
        id: "bundle-target-top",
        featureId: "bundle-envelope",
        point: exTargetTop,
        color: "#ffd07e",
      },
    ],
    samplePoints,
    stats: {
      visibleSamples,
      blockedSamples,
      visibilityFractionLabel: formatFraction(result.visibilityFraction),
      bundleSpanM: result.scenario.surfaceDistanceM,
    },
  };
}

function sampleProfileForAnalysis(result: VisibilitySolveResult) {
  const profile =
    getTerrainProfileByPresetId(result.scenario.presetId) ??
    createGenericTargetProfile(
      result.scenario.presetId,
      result.scenario.surfaceDistanceM,
      result.scenario.targetHeightM,
    );
  const sortedSamples = [...profile.samples].sort((left, right) => left.distanceM - right.distanceM);
  const minDistanceM = sortedSamples[0].distanceM;
  const maxDistanceM = sortedSamples[sortedSamples.length - 1].distanceM;
  const sampleCount = clamp(
    Math.round(result.scenario.targetSampleCount * 2.4),
    18,
    52,
  );

  const analysisSamples = Array.from({ length: sampleCount }, (_, index) => {
    const fraction = sampleCount === 1 ? 0 : index / (sampleCount - 1);
    const distanceM = lerp(minDistanceM, maxDistanceM, fraction);
    return {
      distanceM,
      heightM: sampleTerrainProfileHeight(profile, distanceM) ?? 0,
    };
  });

  return {
    profile,
    minDistanceM,
    maxDistanceM,
    analysisSamples,
  };
}

interface SolvedProfileAnalysisSample {
  distanceM: number;
  heightM: number;
  solve: VisibilitySample;
  observerFramePoint: Vec2;
}

function solveProfileSamplesForAnalysis(result: VisibilitySolveResult) {
  const { profile, minDistanceM, maxDistanceM, analysisSamples } =
    sampleProfileForAnalysis(result);

  const solvedSamples: SolvedProfileAnalysisSample[] = analysisSamples.map((sample) => {
    const solve = solveTargetPointVisibility(
      result.scenario,
      result.model,
      sample.distanceM,
      sample.heightM,
      result.terrainProfile,
    );

    return {
      distanceM: sample.distanceM,
      heightM: sample.heightM,
      solve,
      observerFramePoint: transformToObserverFrame(result, solve.targetPoint),
    };
  });

  return {
    profile,
    minDistanceM,
    maxDistanceM,
    solvedSamples,
  };
}

function buildProfileVisibilitySegments(
  samplePoints: ProfileVisibilitySamplePoint[],
): ProfileVisibilityTrace[] {
  const segments: ProfileVisibilityTrace[] = [];

  for (let index = 0; index < samplePoints.length - 1; index += 1) {
    const left = samplePoints[index];
    const right = samplePoints[index + 1];
    const visible = left.visible && right.visible;

    segments.push({
      id: `profile-segment-${index}`,
      color: visible ? "rgba(255, 208, 126, 0.96)" : "rgba(182, 194, 206, 0.52)",
      width: visible ? 3.6 : 2.2,
      dashed: !visible,
      points: [left.point, right.point],
    });
  }

  return segments;
}

export function buildProfileVisibilityPanelData(
  result: VisibilitySolveResult,
  title: string,
  sceneKey: FocusedModel,
): ProfileVisibilityPanelData {
  const { profile, maxDistanceM, solvedSamples } =
    solveProfileSamplesForAnalysis(result);
  const maxDistanceAngleRad = getTargetAngle(maxDistanceM, result.scenario.radiusM);
  const rawSurfaceSamples = Array.from({ length: 180 }, (_, index) => {
    const angle = lerp(
      -maxDistanceAngleRad * 0.08,
      maxDistanceAngleRad * 1.02,
      index / 179,
    );
    const point = pointAtSurfaceHeight(
      result.scenario.radiusM,
      angle,
      result.model.geometryMode,
      0,
    );
    return transformToObserverFrame(result, point);
  });
  const observerBase = transformToObserverFrame(result, result.observerSurfacePoint);
  const observerTop = { x: 0, y: 0 };
  const rawProfilePoints = solvedSamples.map((sample) => sample.observerFramePoint);
  const verticalScale = getVerticalExaggeration(maxDistanceM, [
    ...rawSurfaceSamples,
    ...rawProfilePoints,
    observerBase,
    observerTop,
  ]);
  const surfacePoints = exaggerate(rawSurfaceSamples, verticalScale);
  const profilePolyline = exaggerate(rawProfilePoints, verticalScale);
  const observerStemBase = { x: observerBase.x, y: observerBase.y * verticalScale };
  const traces: ProfileVisibilityTrace[] = [];
  const samplePoints: ProfileVisibilitySamplePoint[] = [];
  let visibleSamples = 0;
  let blockedSamples = 0;

  const rayStride = Math.max(1, Math.floor(solvedSamples.length / 10));

  solvedSamples.forEach((sample, index) => {
    const solve = sample.solve;
    const point = {
      x: sample.observerFramePoint.x,
      y: sample.observerFramePoint.y * verticalScale,
    };

    samplePoints.push({
      id: `profile-sample-${index}`,
      point,
      distanceM: sample.distanceM,
      heightM: sample.heightM,
      visible: solve.visible,
      apparentElevationRad: solve.apparentElevationRad ?? null,
    });

    if (solve.visible) {
      visibleSamples += 1;
    } else {
      blockedSamples += 1;
    }

    const shouldDrawRay =
      index % rayStride === 0 || index === solvedSamples.length - 1 || index === 0;

    if (!shouldDrawRay) {
      return;
    }

    if (solve.trace?.points.length) {
      traces.push({
        id: `profile-ray-${index}`,
        color: solve.visible
          ? "rgba(255, 194, 101, 0.7)"
          : "rgba(222, 231, 242, 0.42)",
        width: solve.visible ? 1.9 : 1.25,
        dashed: !solve.visible,
        points: solve.trace.points.map((tracePoint) => {
          const local = transformToObserverFrame(result, tracePoint);
          return { x: local.x, y: local.y * verticalScale };
        }),
      });
    }
  });

  const profileSegments = buildProfileVisibilitySegments(samplePoints);
  const visiblePoints = samplePoints.filter((sample) => sample.visible);
  const visibleSpanM =
    visiblePoints.length > 1
      ? visiblePoints[visiblePoints.length - 1].distanceM - visiblePoints[0].distanceM
      : 0;

  return {
    sceneKey,
    title,
    subtitle: `${profile.name} - ${visibleSamples}/${samplePoints.length} sampled profile points reach the observer${
      result.terrainProfile ? " - terrain-aware obstruction active" : ""
    }`,
    bounds: collectBounds(
      [
        ...surfacePoints,
        ...profilePolyline,
        ...traces.flatMap((trace) => trace.points),
        observerStemBase,
        observerTop,
      ],
      {
        xPaddingFactor: 0.08,
        minXPad: Math.max(1_000, maxDistanceM * 0.025),
        topPaddingFactor: 0.18,
        bottomPaddingFactor: 0.34,
        minTopPad: Math.max(180, result.scenario.observerHeightM * verticalScale * 0.08),
        minBottomPad: Math.max(260, Math.max(...profilePolyline.map((point) => Math.abs(point.y))) * 0.12),
      },
    ),
    suggestedVerticalScale: verticalScale,
    surfacePoints,
    profilePolyline,
    profileSegments,
    observerStem: {
      base: observerStemBase,
      top: observerTop,
    },
    traces,
    markers: [
      {
        id: "profile-observer",
        point: observerTop,
        color: "#f5f2e8",
        label: "Observer",
      },
      {
      id: "profile-peak",
      point:
        samplePoints.reduce((highest, sample) =>
          sample.point.y > highest.point.y ? sample : highest,
        ).point,
      color: "#ffd07e",
      label: "Profile peak",
    },
    ],
    samplePoints,
    stats: {
      visibleSamples,
      blockedSamples,
      visibilityFractionLabel: formatFraction(
        samplePoints.length ? visibleSamples / samplePoints.length : 0,
      ),
      visibleSpanM,
      sampleCount: samplePoints.length,
      maxProfileHeightM: Math.max(...profile.samples.map((sample) => sample.heightM)),
    },
  };
}

function createObserverViewPoints(
  solvedSamples: SolvedProfileAnalysisSample[],
  minDistanceM: number,
) {
  return solvedSamples.map((sample) => ({
    id: `observer-sample-${sample.distanceM}`,
    x: sample.distanceM - minDistanceM,
    actualY: sample.solve.actualElevationRad,
    apparentY: sample.solve.apparentElevationRad ?? null,
    visible: sample.solve.visible,
    distanceM: sample.distanceM,
    heightM: sample.heightM,
  }));
}

export function buildObserverViewPanelData(
  result: VisibilitySolveResult,
  title: string,
  sceneKey: FocusedModel,
): ObserverViewPanelData {
  const { profile, minDistanceM, maxDistanceM, solvedSamples } =
    solveProfileSamplesForAnalysis(result);
  const observerViewPoints = createObserverViewPoints(solvedSamples, minDistanceM);
  const spanX = Math.max(maxDistanceM - minDistanceM, 1);
  const horizonElevationRad =
    result.opticalHorizon?.apparentElevationRad ??
    result.geometricHorizon?.apparentElevationRad ??
    0;
  const visibleSilhouette = observerViewPoints
    .filter((point) => point.visible && point.apparentY != null)
    .map((point) => ({
      x: point.x,
      y: point.apparentY as number,
    }));
  const ghostSilhouette = observerViewPoints.map((point) => ({
    x: point.x,
    y: point.actualY,
  }));
  const allPoints = [
    ...visibleSilhouette,
    ...ghostSilhouette,
    { x: 0, y: horizonElevationRad },
    { x: spanX, y: horizonElevationRad },
    { x: 0, y: 0 },
    { x: spanX, y: 0 },
  ];
  const bounds = collectBounds(allPoints, {
    xPaddingFactor: 0.12,
    minXPad: Math.max(120, spanX * 0.12),
    topPaddingFactor: 0.24,
    bottomPaddingFactor: 0.26,
    minTopPad: 0.02,
    minBottomPad: 0.03,
  });
  const topVisiblePoint =
    visibleSilhouette.length > 0
      ? visibleSilhouette.reduce((highest, point) =>
          point.y > highest.y ? point : highest,
        )
      : null;
  const topGhostPoint = ghostSilhouette.reduce((highest, point) =>
    point.y > highest.y ? point : highest,
  );
  const apparentProfileSpanM =
    observerViewPoints.length > 1
      ? observerViewPoints[observerViewPoints.length - 1].distanceM -
        observerViewPoints[0].distanceM
      : 0;

  return {
    sceneKey,
    title,
    subtitle: `${profile.name} reconstructed into apparent elevation space${
      result.terrainProfile ? " - terrain-aware obstruction active" : ""
    }`,
    bounds,
    horizonElevationRad,
    eyeLevelElevationRad: 0,
    visibleSilhouette,
    ghostSilhouette,
    samplePoints: observerViewPoints.map((point) => ({
      id: point.id,
      point: {
        x: point.x,
        y: point.apparentY ?? point.actualY,
      },
      visible: point.visible,
      distanceM: point.distanceM,
      heightM: point.heightM,
      apparentElevationRad: point.apparentY,
      actualElevationRad: point.actualY,
    })),
    markers: [
      {
        id: "observer-view-horizon",
        point: { x: spanX * 0.08, y: horizonElevationRad },
        color: "#8dffcb",
        label: "Apparent horizon",
      },
      {
        id: "observer-view-eye-level",
        point: { x: spanX * 0.08, y: 0 },
        color: "#a8b2ff",
        label: "Observer horizontal",
      },
      ...(topVisiblePoint
        ? [
            {
              id: "observer-view-top-visible",
              point: topVisiblePoint,
              color: "#ffd07e",
              label: "Visible silhouette",
            },
          ]
        : []),
      {
        id: "observer-view-geometric-ghost",
        point: topGhostPoint,
        color: "#dce7f2",
        label: "Geometric ghost",
      },
    ],
    stats: {
      visibleSamples: solvedSamples.filter((sample) => sample.solve.visible).length,
      blockedSamples: solvedSamples.filter((sample) => !sample.solve.visible).length,
      visibilityFractionLabel: formatFraction(result.visibilityFraction),
      horizonDipLabel: formatAngle(Math.abs(horizonElevationRad)),
      apparentProfileSpanM,
      topVisibleElevationRad: topVisiblePoint?.y ?? null,
      topGhostElevationRad: topGhostPoint.y,
    },
  };
}
