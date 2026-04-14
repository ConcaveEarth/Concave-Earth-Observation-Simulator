import {
  add,
  getTargetAngle,
  invertPointThroughCircle,
  localTangentAtAngle,
  localUpAtAngle,
  normalize,
  pointAtSurfaceHeight,
  scale,
  toObserverFrame,
} from "./geometry";
import {
  getGreatCircleRouteMetrics,
  interpolateGreatCircleRoute,
  projectGreatCircleDestination,
} from "./geodesy";
import {
  getAtmosphereCurvatureMagnitudeAtHeight,
  getIntrinsicCurvatureMagnitude,
} from "./curvature";
import {
  getDefaultMaxArcLengthM,
  traceRayForDisplay,
} from "./raytrace";
import {
  createGenericTargetProfile,
  getTerrainProfileByPresetId,
  sampleTerrainProfileHeight,
} from "./profiles";
import {
  getObserverTotalHeightM,
  getTargetTopElevationM,
} from "./scenario";
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
import { getModelLabel, t, type LanguageMode } from "../i18n";

export type AnalysisTab =
  | "cross-section"
  | "ray-bundle"
  | "observer-view"
  | "sweep"
  | "profile-visibility"
  | "route-map"
  | "sky-wrap"
  | "inversion-lab";
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

export interface RouteMapPanelData {
  sceneKey: FocusedModel;
  title: string;
  subtitle: string;
  routeDistanceM: number;
  bearingDeg: number;
  routePoints: Array<{ lonDeg: number; latDeg: number; distanceM: number }>;
  observerPoint: { lonDeg: number; latDeg: number };
  targetPoint: { lonDeg: number; latDeg: number };
  coordinatesEnabled: boolean;
  usesPreviewSeed: boolean;
}

export interface SkyWrapCurve {
  id: string;
  label: string;
  color: string;
  points: Vec2[];
}

export interface SkyWrapPanelData {
  sceneKey: FocusedModel;
  title: string;
  subtitle: string;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  domeRadius: number;
  gridCurves: SkyWrapCurve[];
  rayCurves: SkyWrapCurve[];
  stats: {
    intrinsicLabel: string;
    atmosphereLabel: string;
    netLabel: string;
  };
}

export interface InversionLabCurve {
  id: string;
  featureId: string;
  label: string;
  color: string;
  points: Vec2[];
  width: number;
  dashed?: boolean;
  opacity?: number;
}

export interface InversionLabMarker {
  id: string;
  featureId: string;
  label: string;
  point: Vec2;
  color: string;
  labelOffset?: Vec2;
}

export interface InversionLabAuditItem {
  label: string;
  value: string;
}

export interface InversionLabSubview {
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  curves: InversionLabCurve[];
  markers: InversionLabMarker[];
}

export interface InversionLabPanelData {
  sceneKey: FocusedModel;
  title: string;
  subtitle: string;
  inversionRadiusM: number;
  globalView: InversionLabSubview;
  localView: InversionLabSubview;
  globalGuideRadiiM: number[];
  coreRadiusM: number;
  localVerticalScale: number;
  audit: InversionLabAuditItem[];
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
  const finitePoints = points.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  );

  if (!finitePoints.length) {
    return {
      minX: -1_000,
      maxX: 1_000,
      minY: -1_000,
      maxY: 1_000,
    };
  }

  const minX = Math.min(...finitePoints.map((point) => point.x));
  const maxX = Math.max(...finitePoints.map((point) => point.x));
  const minY = Math.min(...finitePoints.map((point) => point.y));
  const maxY = Math.max(...finitePoints.map((point) => point.y));
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
    getObserverTotalHeightM(result.scenario),
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

function getDisplayTracePoints(
  result: VisibilitySolveResult,
  launchAngleRad: number,
  targetAngleRad: number | null,
  maxArcLengthM: number,
) {
  return traceRayForDisplay({
    scenario: result.scenario,
    model: result.model,
    terrainProfile: result.terrainProfile,
    launchAngleRad,
    targetAngleRad,
    maxArcLengthM,
  }).points;
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
      const current = getObserverTotalHeightM(scenario);
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
        scenario:
          scenario.scenarioMode === "field"
            ? {
                ...scenario,
                observerEyeHeightM: Math.max(0, value - scenario.observerSurfaceElevationM),
                observerHeightM: value,
              }
            : { ...scenario, observerHeightM: value },
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
            ...model.atmosphere,
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
          sample.absoluteHeightM,
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
      const displayTracePoints = getDisplayTracePoints(
        result,
        sample.trace.launchAngleRad,
        sample.targetAngleRad,
        sample.trace.points[sample.trace.points.length - 1]?.s ??
          result.scenario.surfaceDistanceM,
      );
      traces.push({
        id: `bundle-visible-${index}`,
        featureId: "bundle-visible-rays",
        color: `rgba(255, 194, 101, ${0.34 + index / Math.max(result.targetSamples.length * 1.8, 1)})`,
        width: 1.8,
        points: displayTracePoints.map((point) => {
          const local = transformToObserverFrame(result, point);
          return { x: local.x, y: local.y * verticalScale };
        }),
      });
    } else {
      blockedSamples += 1;
      const blockedTrace = getDisplayTracePoints(
        result,
        sample.actualElevationRad,
        targetAngleRad,
        getDefaultMaxArcLengthM(result.scenario),
      );
      const blockedTracePoints = blockedTrace.map((point) => {
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
      getTargetTopElevationM(result.scenario),
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
      const displayTracePoints = getDisplayTracePoints(
        result,
        solve.trace.launchAngleRad,
        solve.targetAngleRad,
        solve.trace.points[solve.trace.points.length - 1]?.s ?? solve.targetDistanceM,
      );
      traces.push({
        id: `profile-ray-${index}`,
        color: solve.visible
          ? "rgba(255, 194, 101, 0.7)"
          : "rgba(222, 231, 242, 0.42)",
        width: solve.visible ? 1.9 : 1.25,
        dashed: !solve.visible,
        points: displayTracePoints.map((tracePoint) => {
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
        minTopPad: Math.max(180, getObserverTotalHeightM(result.scenario) * verticalScale * 0.08),
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

export function buildRouteMapPanelData(
  result: VisibilitySolveResult,
  title: string,
  sceneKey: FocusedModel,
): RouteMapPanelData {
  const presetRouteAnchors: Record<
    string,
    { observerLatDeg: number; observerLonDeg: number; bearingDeg: number }
  > = {
    "low-ship": { observerLatDeg: 29.476, observerLonDeg: -90.769, bearingDeg: 78 },
    "elevated-observer": {
      observerLatDeg: 34.954,
      observerLonDeg: -120.161,
      bearingDeg: 256,
    },
    "aconcagua-study": {
      observerLatDeg: -32.947,
      observerLonDeg: -65.314,
      bearingDeg: 267,
    },
    "oil-rig": { observerLatDeg: 29.271, observerLonDeg: -90.104, bearingDeg: 137 },
    "lake-pontchartrain": {
      observerLatDeg: 30.044,
      observerLonDeg: -90.118,
      bearingDeg: 62,
    },
    "chicago-lake-michigan": {
      observerLatDeg: 42.040,
      observerLonDeg: -87.654,
      bearingDeg: 82,
    },
    "balloon-100kft": {
      observerLatDeg: 35.123,
      observerLonDeg: -111.745,
      bearingDeg: 88,
    },
    "strong-concave-demo": {
      observerLatDeg: 28.451,
      observerLonDeg: -80.428,
      bearingDeg: 93,
    },
    "six-foot-horizon": {
      observerLatDeg: 29.410,
      observerLonDeg: -89.989,
      bearingDeg: 90,
    },
    "great-orme-blackpool": {
      observerLatDeg: 53.323,
      observerLonDeg: -3.848,
      bearingDeg: 63,
    },
    "canigou-marseille": {
      observerLatDeg: 43.296,
      observerLonDeg: 5.369,
      bearingDeg: 245,
    },
  };

  const rawRouteMetrics = getGreatCircleRouteMetrics({
    observerLatDeg: result.scenario.coordinates.observerLatDeg,
    observerLonDeg: result.scenario.coordinates.observerLonDeg,
    targetLatDeg: result.scenario.coordinates.targetLatDeg,
    targetLonDeg: result.scenario.coordinates.targetLonDeg,
    radiusM: result.scenario.radiusM,
  });
  const usePreviewSeed =
    !result.scenario.coordinates.enabled &&
    rawRouteMetrics.distanceM < Math.max(50, result.scenario.surfaceDistanceM * 0.02);
  const previewAnchor =
    presetRouteAnchors[result.scenario.presetId] ?? {
      observerLatDeg: 29.476,
      observerLonDeg: -90.769,
      bearingDeg: 78,
    };
  const effectiveObserverPoint = usePreviewSeed
    ? {
        latDeg: previewAnchor.observerLatDeg,
        lonDeg: previewAnchor.observerLonDeg,
      }
    : {
        latDeg: result.scenario.coordinates.observerLatDeg,
        lonDeg: result.scenario.coordinates.observerLonDeg,
      };
  const effectiveTargetPoint = usePreviewSeed
    ? projectGreatCircleDestination({
        originLatDeg: previewAnchor.observerLatDeg,
        originLonDeg: previewAnchor.observerLonDeg,
        bearingDeg: previewAnchor.bearingDeg,
        distanceM: result.scenario.surfaceDistanceM,
        radiusM: result.scenario.radiusM,
      })
    : {
        latDeg: result.scenario.coordinates.targetLatDeg,
        lonDeg: result.scenario.coordinates.targetLonDeg,
      };
  const routeMetrics = getGreatCircleRouteMetrics({
    observerLatDeg: effectiveObserverPoint.latDeg,
    observerLonDeg: effectiveObserverPoint.lonDeg,
    targetLatDeg: effectiveTargetPoint.latDeg,
    targetLonDeg: effectiveTargetPoint.lonDeg,
    radiusM: result.scenario.radiusM,
  });
  const routePoints = interpolateGreatCircleRoute({
    observerLatDeg: effectiveObserverPoint.latDeg,
    observerLonDeg: effectiveObserverPoint.lonDeg,
    targetLatDeg: effectiveTargetPoint.latDeg,
    targetLonDeg: effectiveTargetPoint.lonDeg,
    radiusM: result.scenario.radiusM,
    sampleCount: 72,
  });

  return {
    sceneKey,
    title,
    subtitle: result.scenario.coordinates.enabled
      ? "Placed observation points are driving the route distance and bearing."
      : usePreviewSeed
        ? "Schematic preview route derived from the current scenario distance. Click the map to place real observation points."
        : "Map preview using the stored observation coordinates. Enable route distance to drive the scenario from the map.",
    routeDistanceM: routeMetrics.distanceM,
    bearingDeg: routeMetrics.initialBearingDeg,
    routePoints,
    observerPoint: effectiveObserverPoint,
    targetPoint: effectiveTargetPoint,
    coordinatesEnabled: result.scenario.coordinates.enabled,
    usesPreviewSeed: usePreviewSeed,
  };
}

function formatCurvatureLabel(valuePerM: number, radiusM: number) {
  const ratio = Math.abs(valuePerM * radiusM);
  if (ratio < 1e-6) {
    return "0.00 / R neutral";
  }
  const direction = valuePerM >= 0 ? "upward" : "downward";
  return `${ratio.toFixed(2)} / R ${direction}`;
}

export function buildSkyWrapPanelData(
  result: VisibilitySolveResult,
  title: string,
  sceneKey: FocusedModel,
): SkyWrapPanelData {
  const sampleAnglesDeg = [8, 18, 30, 42, 56, 70, 82];
  const maxArcLengthM = Math.min(result.scenario.radiusM * 0.1, 900_000);
  const frame = createObserverFrame(result);
  const rayCurves: SkyWrapCurve[] = sampleAnglesDeg
    .map((angleDeg, index) => {
      const trace = traceRayForDisplay({
        scenario: result.scenario,
        model: result.model,
        terrainProfile: null,
        launchAngleRad: (angleDeg * Math.PI) / 180,
        targetAngleRad: null,
        maxArcLengthM,
      });
      const points = trace.points
        .map((point) =>
          toObserverFrame(point, frame.observerPoint, frame.observerTangent, frame.observerUp),
        )
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

      return {
        id: `${sceneKey}-sky-ray-${index}`,
        label: `${angleDeg} deg launch`,
        color: index % 2 === 0 ? "#ffd07e" : "#7dd7ff",
        points,
      };
    })
    .filter((curve) => curve.points.length >= 2);

  const gridCurves: SkyWrapCurve[] = [0.15, 0.32, 0.5, 0.68, 0.86].map((fraction, index) => {
    const radius = maxArcLengthM * fraction;
    const points = Array.from({ length: 64 }, (_, pointIndex) => {
      const angle = lerp(0, Math.PI / 2, pointIndex / 63);
      return {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      };
    });

    return {
      id: `${sceneKey}-sky-grid-${index}`,
      label: `Shell ${Math.round(fraction * 100)}%`,
      color: "rgba(180, 205, 232, 0.28)",
      points,
    };
  });

  const fallbackRayCurves =
    rayCurves.length > 0
      ? rayCurves
      : [
          {
            id: `${sceneKey}-sky-ray-fallback`,
            label: "Fallback launch",
            color: "#ffd07e",
            points: [
              { x: 0, y: 0 },
              { x: maxArcLengthM * 0.45, y: maxArcLengthM * 0.2 },
            ],
          },
        ];
  const allPoints = [
    ...fallbackRayCurves.flatMap((curve) => curve.points),
    ...gridCurves.flatMap((curve) => curve.points),
  ];
  const bounds = collectBounds(allPoints, {
    xPaddingFactor: 0.08,
    minXPad: 40_000,
    topPaddingFactor: 0.14,
    bottomPaddingFactor: 0.08,
    minTopPad: 40_000,
    minBottomPad: 20_000,
  });
  const intrinsic = result.model.geometryMode === "concave"
    ? getIntrinsicCurvatureMagnitude(result.model, result.scenario)
    : 0;
  const atmosphere = -getAtmosphereCurvatureMagnitudeAtHeight(result.model, result.scenario, 0);
  const net = intrinsic + atmosphere;

  return {
    sceneKey,
    title,
    subtitle:
      result.model.geometryMode === "concave"
        ? "Sky-wrap workspace showing intrinsic upward bending with atmospheric refraction delaying or tightening the rise of each ray."
        : "Sky-path workspace showing the observer-frame ray family under the active atmospheric refraction law.",
    bounds,
    domeRadius: maxArcLengthM,
    gridCurves,
    rayCurves: fallbackRayCurves,
    stats: {
      intrinsicLabel: formatCurvatureLabel(intrinsic, result.scenario.radiusM),
      atmosphereLabel: formatCurvatureLabel(atmosphere, result.scenario.radiusM),
      netLabel: formatCurvatureLabel(net, result.scenario.radiusM),
    },
  };
}

function samplePolylineBetweenPoints(from: Vec2, to: Vec2, sampleCount = 96): Vec2[] {
  return Array.from({ length: sampleCount }, (_, index) => {
    const fraction = sampleCount === 1 ? 0 : index / (sampleCount - 1);
    return {
      x: lerp(from.x, to.x, fraction),
      y: lerp(from.y, to.y, fraction),
    };
  });
}

function sampleRayFromPoint(origin: Vec2, direction: Vec2, lengthM: number, sampleCount = 64): Vec2[] {
  return Array.from({ length: sampleCount }, (_, index) => {
    const fraction = sampleCount === 1 ? 0 : index / (sampleCount - 1);
    return {
      x: origin.x + direction.x * lengthM * fraction,
      y: origin.y + direction.y * lengthM * fraction,
    };
  });
}

function sampleCirclePolyline(radiusM: number, sampleCount = 192): Vec2[] {
  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / sampleCount;
    return {
      x: radiusM * Math.cos(angle),
      y: radiusM * Math.sin(angle),
    };
  });
}

function sampleSurfaceWindow(
  result: VisibilitySolveResult,
  startAngleRad: number,
  endAngleRad: number,
  sampleCount = 144,
) {
  return Array.from({ length: sampleCount }, (_, index) => {
    const angle = lerp(startAngleRad, endAngleRad, sampleCount === 1 ? 0 : index / (sampleCount - 1));
    return pointAtSurfaceHeight(
      result.scenario.radiusM,
      angle,
      result.model.geometryMode,
      0,
    );
  });
}

function invertPolyline(points: Vec2[], inversionRadiusM: number, maxRadiusFactor = 2.4): Vec2[] {
  const maxRadiusM = inversionRadiusM * maxRadiusFactor;

  return points
    .map((point) => invertPointThroughCircle(point, inversionRadiusM))
    .filter((point): point is Vec2 => point != null && Math.hypot(point.x, point.y) <= maxRadiusM);
}

function makeInversionCurve(
  id: string,
  featureId: string,
  label: string,
  color: string,
  points: Vec2[],
  options: {
    width?: number;
    dashed?: boolean;
    opacity?: number;
  } = {},
): InversionLabCurve {
  return {
    id,
    featureId,
    label,
    color,
    points,
    width: options.width ?? 2,
    dashed: options.dashed,
    opacity: options.opacity,
  };
}

function exaggerateLocalCurve(points: Vec2[], verticalScale: number) {
  return points.map((point) => ({
    x: point.x,
    y: point.y * verticalScale,
  }));
}

function transformWorldCurveToObserverFrame(
  result: VisibilitySolveResult,
  points: Vec2[],
  verticalScale: number,
) {
  return exaggerateLocalCurve(points.map((point) => transformToObserverFrame(result, point)), verticalScale);
}

function createSymmetricBounds(radiusM: number, outerFactor = 1.18) {
  return {
    minX: -radiusM * outerFactor,
    maxX: radiusM * outerFactor,
    minY: -radiusM * outerFactor,
    maxY: radiusM * outerFactor,
  };
}

export function buildInversionLabPanelData(
  result: VisibilitySolveResult,
  title: string,
  sceneKey: FocusedModel,
  units: UnitPreferences,
  language: LanguageMode = "en",
): InversionLabPanelData {
  const inversionRadiusM = result.scenario.radiusM;
  const coreRadiusM = inversionRadiusM * 0.2;
  const targetTopPoint = result.targetTopPoint;
  const observerPoint = result.observerPoint;
  const observerSurfacePoint = result.observerSurfacePoint;
  const targetBasePoint = result.targetBasePoint;
  const targetTangent = localTangentAtAngle(result.targetAngleRad);
  const referenceTracePoints =
    result.primaryRay?.points.map((point) => ({ x: point.x, y: point.y })) ??
    result.opticalHorizon?.trace?.points.map((point) => ({ x: point.x, y: point.y })) ??
    samplePolylineBetweenPoints(observerPoint, targetTopPoint, 64);
  const directSightlinePoints = samplePolylineBetweenPoints(observerPoint, targetTopPoint, 128);
  const invertedDirectPoints = invertPolyline(directSightlinePoints, inversionRadiusM, 1.85);
  const invertedTracePoints = invertPolyline(referenceTracePoints, inversionRadiusM, 1.85);
  const apparentElevationRad =
    result.apparentElevationRad ??
    result.opticalHorizon?.apparentElevationRad ??
    result.actualElevationRad;
  const apparentDirectionWorld = normalize(
    add(
      scale(result.observerTangent, Math.cos(apparentElevationRad)),
      scale(result.observerUp, Math.sin(apparentElevationRad)),
    ),
  );
  const apparentDirectionPoints = sampleRayFromPoint(
    observerPoint,
    apparentDirectionWorld,
    inversionRadiusM * 0.42,
    84,
  );
  const observerTangentPoints = sampleRayFromPoint(
    {
      x: observerSurfacePoint.x - result.observerTangent.x * inversionRadiusM * 0.18,
      y: observerSurfacePoint.y - result.observerTangent.y * inversionRadiusM * 0.18,
    },
    result.observerTangent,
    inversionRadiusM * 0.36,
    48,
  );
  const targetTangentPoints = sampleRayFromPoint(
    {
      x: targetBasePoint.x - targetTangent.x * inversionRadiusM * 0.16,
      y: targetBasePoint.y - targetTangent.y * inversionRadiusM * 0.16,
    },
    targetTangent,
    inversionRadiusM * 0.32,
    48,
  );
  const guideRadiiM = [0.28, 0.48, 0.68, 0.88].map((fraction) => inversionRadiusM * fraction);

  const targetAnglePad = Math.max(0.12, Math.min(0.42, result.targetAngleRad * 0.22));
  const localSurfacePoints = sampleSurfaceWindow(
    result,
    -targetAnglePad,
    result.targetAngleRad + targetAnglePad * 1.18,
  );
  const localRawPoints = [
    ...localSurfacePoints.map((point) => transformToObserverFrame(result, point)),
    ...referenceTracePoints.map((point) => transformToObserverFrame(result, point)),
    ...directSightlinePoints.map((point) => transformToObserverFrame(result, point)),
    ...apparentDirectionPoints.map((point) => transformToObserverFrame(result, point)),
    transformToObserverFrame(result, targetTopPoint),
    transformToObserverFrame(result, observerPoint),
  ];
  const localVerticalScale = getVerticalExaggeration(
    Math.max(result.scenario.surfaceDistanceM, result.opticalHorizon?.distanceM ?? 0, 1),
    localRawPoints,
  );

  const localObserverHorizontalPoints = [
    { x: -result.scenario.surfaceDistanceM * 0.08, y: 0 },
    { x: result.scenario.surfaceDistanceM * 1.06, y: 0 },
  ];
  const localActualPoints = transformWorldCurveToObserverFrame(result, referenceTracePoints, localVerticalScale);
  const localDirectPoints = transformWorldCurveToObserverFrame(result, directSightlinePoints, localVerticalScale);
  const localApparentPoints = transformWorldCurveToObserverFrame(result, apparentDirectionPoints, localVerticalScale);
  const localSurface = exaggerateLocalCurve(
    localSurfacePoints.map((point) => transformToObserverFrame(result, point)),
    localVerticalScale,
  );
  const localMarkers: InversionLabMarker[] = [
    {
      id: `${sceneKey}-local-observer`,
      featureId: "observer",
      label: t(language, "observerMarker"),
      point: { x: 0, y: 0 },
      color: "#f4f8ff",
      labelOffset: { x: 14, y: -18 },
    },
    {
      id: `${sceneKey}-local-target`,
      featureId: "target",
      label: t(language, "targetMarker"),
      point: transformWorldCurveToObserverFrame(result, [targetTopPoint], localVerticalScale)[0],
      color: "#ffd89b",
      labelOffset: { x: 12, y: -14 },
    },
  ];
  if (result.opticalHorizon?.point) {
    localMarkers.push({
      id: `${sceneKey}-local-optical-horizon`,
      featureId: "optical-horizon",
      label: t(language, "featureOpticalHorizon"),
      point: transformWorldCurveToObserverFrame(
        result,
        [result.opticalHorizon.point],
        localVerticalScale,
      )[0],
      color: "#7cf3ad",
      labelOffset: { x: 12, y: -10 },
    });
  }

  const localBounds = collectBounds(
    [
      ...localSurface,
      ...localActualPoints,
      ...localDirectPoints,
      ...localApparentPoints,
      ...localObserverHorizontalPoints,
      ...localMarkers.map((marker) => marker.point),
    ],
    {
      xPaddingFactor: 0.09,
      minXPad: Math.max(result.scenario.surfaceDistanceM * 0.1, 3_000),
      topPaddingFactor: 0.22,
      bottomPaddingFactor: 0.22,
      minTopPad: Math.max(result.scenario.surfaceDistanceM * 0.05, 120),
      minBottomPad: Math.max(result.scenario.surfaceDistanceM * 0.05, 120),
    },
  );

  const localView: InversionLabSubview = {
    bounds: localBounds,
    curves: [
      makeInversionCurve(
        `${sceneKey}-local-surface`,
        "surface",
        t(
          language,
          result.model.geometryMode === "convex"
            ? "featureSurfaceSea"
            : "featureSurfaceGround",
        ),
        "#76c7ff",
        localSurface,
        { width: 2.6 },
      ),
      makeInversionCurve(
        `${sceneKey}-local-horizontal`,
        "observer-horizontal",
        t(language, "featureObserverHorizontal"),
        "#9fa8ff",
        localObserverHorizontalPoints,
        { width: 1.6, dashed: true, opacity: 0.88 },
      ),
      makeInversionCurve(
        `${sceneKey}-local-actual`,
        "actual-ray",
        t(language, "featureActualRayPath"),
        "#f8e6b6",
        localActualPoints,
        { width: 2.8 },
      ),
      makeInversionCurve(
        `${sceneKey}-local-direct`,
        "geometric-sightline",
        t(language, "featureDirectGeometricSightline"),
        "#e8edf4",
        localDirectPoints,
        { width: 1.5, dashed: true, opacity: 0.82 },
      ),
      makeInversionCurve(
        `${sceneKey}-local-apparent`,
        "apparent-line",
        t(language, "featureApparentLineOfSight"),
        "#ff7fc5",
        localApparentPoints,
        { width: 1.6, dashed: true, opacity: 0.88 },
      ),
    ],
    markers: localMarkers,
  };

  const globalOuterFactor = Math.max(
    1.16,
    Math.min(
      1.75,
      Math.max(
        ...[
          ...referenceTracePoints,
          ...invertedDirectPoints,
          ...invertedTracePoints,
          observerPoint,
          targetTopPoint,
        ].map((point) => Math.hypot(point.x, point.y) / inversionRadiusM),
      ) * 1.08,
    ),
  );
  const globalBounds = createSymmetricBounds(inversionRadiusM, globalOuterFactor);
  const globalCurves: InversionLabCurve[] = [
    makeInversionCurve(
      `${sceneKey}-global-boundary`,
      "inversion-boundary",
      t(language, "inversionBoundary"),
      result.model.geometryMode === "convex" ? "#8fcfff" : "#8bb4ff",
      sampleCirclePolyline(inversionRadiusM, 220),
      { width: 2.2 },
    ),
    makeInversionCurve(
      `${sceneKey}-global-core`,
      "inversion-core",
      t(language, "inversionCore"),
      "rgba(219, 230, 243, 0.28)",
      sampleCirclePolyline(coreRadiusM, 144),
      { width: 1.4, opacity: 0.92 },
    ),
    makeInversionCurve(
      `${sceneKey}-global-actual`,
      "actual-ray",
      t(language, "featureActualRayPath"),
      "#f7e7b5",
      referenceTracePoints,
      { width: 2.6 },
    ),
    makeInversionCurve(
      `${sceneKey}-global-direct`,
      "geometric-sightline",
      t(language, "featureDirectGeometricSightline"),
      "#edf3fb",
      directSightlinePoints,
      { width: 1.45, dashed: true, opacity: 0.78 },
    ),
    makeInversionCurve(
      `${sceneKey}-global-mapped-direct`,
      "mapped-direct",
      t(language, "inversionMappedSightline"),
      "#8a7dff",
      invertedDirectPoints,
      { width: 1.9, opacity: 0.9 },
    ),
    makeInversionCurve(
      `${sceneKey}-global-mapped-actual`,
      "mapped-actual",
      t(language, "inversionMappedOpticalPath"),
      "#56d8d1",
      invertedTracePoints,
      { width: 1.7, dashed: true, opacity: 0.86 },
    ),
    makeInversionCurve(
      `${sceneKey}-global-observer-tangent`,
      "observer-tangent",
      t(language, "inversionObserverTangent"),
      "#ff8b8b",
      observerTangentPoints,
      { width: 1.4, opacity: 0.82 },
    ),
    makeInversionCurve(
      `${sceneKey}-global-target-tangent`,
      "target-tangent",
      t(language, "inversionTargetTangent"),
      "#ffb36d",
      targetTangentPoints,
      { width: 1.35, opacity: 0.76 },
    ),
    makeInversionCurve(
      `${sceneKey}-global-apparent`,
      "apparent-line",
      t(language, "featureApparentLineOfSight"),
      "#ff7fc5",
      apparentDirectionPoints,
      { width: 1.5, dashed: true, opacity: 0.78 },
    ),
  ];
  const globalMarkers: InversionLabMarker[] = [
    {
      id: `${sceneKey}-global-observer`,
      featureId: "observer",
      label: t(language, "observerMarker"),
      point: observerPoint,
      color: "#f4f8ff",
      labelOffset: { x: 12, y: -14 },
    },
    {
      id: `${sceneKey}-global-target`,
      featureId: "target",
      label: t(language, "targetMarker"),
      point: targetTopPoint,
      color: "#ffd89b",
      labelOffset: { x: 12, y: -12 },
    },
    {
      id: `${sceneKey}-global-center`,
      featureId: "inversion-center",
      label: t(language, "inversionCenter"),
      point: { x: 0, y: 0 },
      color: "#d9e3ef",
      labelOffset: { x: 12, y: -12 },
    },
  ];

  const tracedBendRad =
    result.primaryRay?.totalBendRad ??
    result.opticalHorizon?.trace?.totalBendRad ??
    0;
  const mappedFamilyLabel =
    result.model.geometryMode === "convex"
      ? t(language, "inversionFamilyConvex")
      : t(language, "inversionFamilyConcave");
  const correspondenceLabel =
    invertedDirectPoints.length > 3
      ? t(language, "inversionCorrespondenceReady")
      : t(language, "inversionCorrespondenceLimited");

  return {
    sceneKey,
    title,
    subtitle:
      result.model.geometryMode === "convex"
        ? t(language, "inversionLabConvexBody")
        : t(language, "inversionLabConcaveBody"),
    inversionRadiusM,
    globalView: {
      bounds: globalBounds,
      curves: globalCurves,
      markers: globalMarkers,
    },
    localView,
    globalGuideRadiiM: guideRadiiM,
    coreRadiusM,
    localVerticalScale,
    audit: [
      { label: t(language, "surfaceDistance"), value: formatDistance(result.scenario.surfaceDistanceM, units.distance) },
      { label: t(language, "centralAngle"), value: formatAngle(result.targetAngleRad) },
      { label: t(language, "apparentElevation"), value: formatAngle(apparentElevationRad) },
      { label: t(language, "inversionMappedFamily"), value: mappedFamilyLabel },
      { label: t(language, "inversionActualBend"), value: formatAngle(tracedBendRad) },
      { label: t(language, "inversionCorrespondence"), value: correspondenceLabel },
    ],
  };
}

