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
import { solveVisibility } from "./solver";
import { clamp, formatAngle, formatDistance, formatFraction, formatHeight, lerp } from "./units";
import type { FocusedModel, ModelConfig, ScenarioInput, VisibilitySolveResult, Vec2 } from "./types";
import type { UnitPreferences } from "./units";
import { getModelLabel, type LanguageMode } from "../i18n";

export type AnalysisTab = "cross-section" | "ray-bundle" | "sweep";
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
  }>;
  stats: {
    visibleSamples: number;
    blockedSamples: number;
    visibilityFractionLabel: string;
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
      const result = solveVisibility(applied.scenario, applied.model);
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
    },
  };
}
