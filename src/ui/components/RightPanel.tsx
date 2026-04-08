import {
  getAtmosphereCurvatureMagnitude,
  getIntrinsicCurvatureMagnitude,
} from "../../domain/curvature";
import {
  formatSweepMetricValue,
  formatSweepParameterValue,
  type ObserverViewPanelData,
  type ProfileVisibilityPanelData,
  type RayBundlePanelData,
  type SweepChartData,
} from "../../domain/analysis";
import { pointAtSurfaceHeight, toObserverFrame } from "../../domain/geometry";
import { getPresetById } from "../../domain/presets";
import {
  formatAngle,
  formatDistance,
  formatFraction,
  formatHeight,
  formatRadius,
} from "../../domain/units";
import { getModelLabel, getPresetDescription, getPresetName, t, type LanguageMode } from "../../i18n";
import type { FocusedModel, SceneViewModel, VisibilitySolveResult } from "../../domain/types";
import type { AppState, WorkspaceMode } from "../../state/appState";
import { PanelSection } from "./PanelSection";

interface RightPanelProps {
  state: AppState;
  activeResult: VisibilitySolveResult;
  activeScene: SceneViewModel;
  activeBundlePanel: RayBundlePanelData;
  activeProfilePanel: ProfileVisibilityPanelData;
  activeObserverPanel: ObserverViewPanelData;
  sweepData: SweepChartData;
  inspectedSceneKey: FocusedModel;
  activeFeatureId: string | null;
  isFeaturePinned: boolean;
  workspaceMode: WorkspaceMode;
  onClearSelection: () => void;
  onExport: () => void;
  onCopyLink: () => void;
  message: string | null;
  language: LanguageMode;
  sceneFirstLayout: boolean;
}

interface FeatureMetric {
  label: string;
  value: string;
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getLocalPoint(result: VisibilitySolveResult, point: { x: number; y: number }) {
  return toObserverFrame(
    point,
    result.observerPoint,
    result.observerTangent,
    result.observerUp,
  );
}

function getReferenceVisibleSample(result: VisibilitySolveResult) {
  const visibleSamples = result.targetSamples.filter(
    (sample) => sample.visible && sample.trace?.targetCrossing,
  );

  if (!visibleSamples.length) {
    return null;
  }

  return result.hiddenHeightM > 0
    ? visibleSamples[0]
    : visibleSamples[visibleSamples.length - 1];
}

function formatCurvatureRatio(
  magnitudePerM: number,
  radiusM: number,
  direction: "upward" | "downward",
) {
  const ratio = Math.abs(magnitudePerM * radiusM);
  return `${ratio.toFixed(2)} / R ${direction}`;
}

function getAnalysisTabLabel(language: LanguageMode, analysisTab: AppState["analysisTab"]) {
  switch (analysisTab) {
    case "ray-bundle":
      return t(language, "rayBundle");
    case "observer-view":
      return t(language, "observerView");
    case "profile-visibility":
      return t(language, "profileVisibility");
    case "sweep":
      return t(language, "sweep");
    case "cross-section":
    default:
      return t(language, "crossSection");
  }
}

function getSweepParameterLabel(language: LanguageMode, parameter: SweepChartData["parameter"]) {
  switch (parameter) {
    case "observerHeight":
      return t(language, "observerHeightParameter");
    case "targetHeight":
      return t(language, "targetHeightParameter");
    case "atmosphere":
      return t(language, "atmosphereParameter");
    case "distance":
    default:
      return t(language, "distanceParameter");
  }
}

function getSweepMetricLabel(language: LanguageMode, metric: SweepChartData["metric"]) {
  switch (metric) {
    case "visibilityFraction":
      return t(language, "visibilityFractionMetric");
    case "apparentElevation":
      return t(language, "apparentElevationMetric");
    case "opticalHorizon":
      return t(language, "opticalHorizonMetric");
    case "hiddenHeight":
    default:
      return t(language, "hiddenHeightMetric");
  }
}

function getNearestSweepPoint(
  series: SweepChartData["series"][number],
  currentX: number,
) {
  return series.points.reduce((nearest, point) => {
    if (!nearest) {
      return point;
    }

    return Math.abs(point.x - currentX) < Math.abs(nearest.x - currentX) ? point : nearest;
  }, null as SweepChartData["series"][number]["points"][number] | null);
}

function getCurrentOutputCards(args: {
  state: AppState;
  activeResult: VisibilitySolveResult;
  activeBundlePanel: RayBundlePanelData;
  activeProfilePanel: ProfileVisibilityPanelData;
  activeObserverPanel: ObserverViewPanelData;
  sweepData: SweepChartData;
  language: LanguageMode;
}) {
  const { state, activeResult, activeBundlePanel, activeProfilePanel, activeObserverPanel, sweepData, language } = args;
  const units = state.unitPreferences;

  if (state.analysisTab === "ray-bundle") {
    return [
      {
        label: t(language, "visibleSamples"),
        value: String(activeBundlePanel.stats.visibleSamples),
      },
      {
        label: t(language, "blockedSamples"),
        value: String(activeBundlePanel.stats.blockedSamples),
      },
      {
        label: t(language, "visibilityFraction"),
        value: activeBundlePanel.stats.visibilityFractionLabel,
      },
      {
        label: t(language, "bundleSpan"),
        value: formatDistance(activeBundlePanel.stats.bundleSpanM, units.distance),
      },
      {
        label: t(language, "bundleSampleCount"),
        value: String(activeBundlePanel.samplePoints.length),
      },
      {
        label: t(language, "hiddenHeight"),
        value: formatHeight(activeResult.hiddenHeightM, units.height),
      },
    ];
  }

  if (state.analysisTab === "observer-view") {
    return [
      {
        label: t(language, "visibleSamples"),
        value: String(activeObserverPanel.stats.visibleSamples),
      },
      {
        label: t(language, "blockedSamples"),
        value: String(activeObserverPanel.stats.blockedSamples),
      },
      {
        label: t(language, "apparentHorizonDip"),
        value: activeObserverPanel.stats.horizonDipLabel,
      },
      {
        label: t(language, "visibleTopElevation"),
        value:
          activeObserverPanel.stats.topVisibleElevationRad == null
            ? "N/A"
            : formatAngle(activeObserverPanel.stats.topVisibleElevationRad),
      },
      {
        label: t(language, "geometricTopElevation"),
        value: formatAngle(activeObserverPanel.stats.topGhostElevationRad),
      },
      {
        label: t(language, "apparentProfileSpan"),
        value: formatDistance(activeObserverPanel.stats.apparentProfileSpanM, units.distance),
      },
    ];
  }

  if (state.analysisTab === "profile-visibility") {
    return [
      {
        label: t(language, "visibleSamples"),
        value: String(activeProfilePanel.stats.visibleSamples),
      },
      {
        label: t(language, "blockedSamples"),
        value: String(activeProfilePanel.stats.blockedSamples),
      },
      {
        label: t(language, "visibilityFraction"),
        value: activeProfilePanel.stats.visibilityFractionLabel,
      },
      {
        label: t(language, "visibleProfileSpan"),
        value: formatDistance(activeProfilePanel.stats.visibleSpanM, units.distance),
      },
      {
        label: t(language, "profileSamples"),
        value: String(activeProfilePanel.stats.sampleCount),
      },
      {
        label: t(language, "maxProfileHeight"),
        value: formatHeight(activeProfilePanel.stats.maxProfileHeightM, units.height),
      },
    ];
  }

  if (state.analysisTab === "sweep") {
    const primarySeries = sweepData.series.find((series) => series.id === "primary") ?? sweepData.series[0];
    const comparisonSeries = sweepData.series.find((series) => series.id === "comparison");
    const primaryCurrent = primarySeries ? getNearestSweepPoint(primarySeries, sweepData.range.current) : null;
    const comparisonCurrent = comparisonSeries
      ? getNearestSweepPoint(comparisonSeries, sweepData.range.current)
      : null;

    return [
      {
        label: t(language, "activeParameter"),
        value: getSweepParameterLabel(language, sweepData.parameter),
      },
      {
        label: t(language, "activeMetric"),
        value: getSweepMetricLabel(language, sweepData.metric),
      },
      {
        label: t(language, "currentScenarioValue"),
        value: formatSweepParameterValue(
          sweepData.range.current,
          sweepData.parameter,
          units,
        ),
      },
      {
        label: comparisonCurrent ? t(language, "modelOneCurrent") : t(language, "activeModelCurrent"),
        value: primaryCurrent
          ? formatSweepMetricValue(primaryCurrent.y, sweepData.metric, units)
          : "N/A",
      },
      ...(comparisonCurrent
        ? [
            {
              label: t(language, "modelTwoCurrent"),
              value: formatSweepMetricValue(comparisonCurrent.y, sweepData.metric, units),
            },
          ]
        : []),
      {
        label: t(language, "sweepSamples"),
        value: String(state.sweepConfig.sampleCount),
      },
    ];
  }

  return [
    {
      label: t(language, "hiddenHeight"),
      value: formatHeight(activeResult.hiddenHeightM, units.height),
    },
    {
      label: t(language, "visibleHeight"),
      value: formatHeight(activeResult.visibleHeightM, units.height),
    },
    {
      label: t(language, "visibilityFraction"),
      value: formatFraction(activeResult.visibilityFraction),
    },
    {
      label: t(language, "apparentElevation"),
      value: formatAngle(activeResult.apparentElevationRad),
    },
    {
      label: t(language, "actualElevation"),
      value: formatAngle(activeResult.actualElevationRad),
    },
    {
      label: t(language, "opticalHorizon"),
      value: activeResult.opticalHorizon
        ? formatDistance(activeResult.opticalHorizon.distanceM, units.distance)
        : "N/A",
    },
  ];
}

function getAnalysisSummary(args: {
  state: AppState;
  activeResult: VisibilitySolveResult;
  activeBundlePanel: RayBundlePanelData;
  activeProfilePanel: ProfileVisibilityPanelData;
  activeObserverPanel: ObserverViewPanelData;
  sweepData: SweepChartData;
  language: LanguageMode;
}): { title: string; description: string; metrics: FeatureMetric[] } {
  const { state, activeResult, activeBundlePanel, activeProfilePanel, activeObserverPanel, sweepData, language } = args;
  const units = state.unitPreferences;

  switch (state.analysisTab) {
    case "ray-bundle":
      return {
        title: t(language, "rayBundleSummaryTitle"),
        description: t(language, "rayBundleSummaryBody"),
        metrics: [
          { label: t(language, "activeAnalysis"), value: getAnalysisTabLabel(language, state.analysisTab) },
          { label: t(language, "bundleSampleCount"), value: String(activeBundlePanel.samplePoints.length) },
          { label: t(language, "bundleSpan"), value: formatDistance(activeBundlePanel.stats.bundleSpanM, units.distance) },
          { label: t(language, "visibilityFraction"), value: activeBundlePanel.stats.visibilityFractionLabel },
        ],
      };
    case "observer-view":
      return {
        title: t(language, "observerReconstructionTitle"),
        description: t(language, "observerReconstructionBody"),
        metrics: [
          { label: t(language, "activeAnalysis"), value: getAnalysisTabLabel(language, state.analysisTab) },
          { label: t(language, "apparentHorizonDip"), value: activeObserverPanel.stats.horizonDipLabel },
          {
            label: t(language, "visibleTopElevation"),
            value:
              activeObserverPanel.stats.topVisibleElevationRad == null
                ? "N/A"
                : formatAngle(activeObserverPanel.stats.topVisibleElevationRad),
          },
          {
            label: t(language, "apparentProfileSpan"),
            value: formatDistance(activeObserverPanel.stats.apparentProfileSpanM, units.distance),
          },
        ],
      };
    case "profile-visibility":
      return {
        title: t(language, "profileVisibilitySummaryTitle"),
        description: t(language, "profileVisibilitySummaryBody"),
        metrics: [
          { label: t(language, "activeAnalysis"), value: getAnalysisTabLabel(language, state.analysisTab) },
          { label: t(language, "profileSamples"), value: String(activeProfilePanel.stats.sampleCount) },
          {
            label: t(language, "visibleProfileSpan"),
            value: formatDistance(activeProfilePanel.stats.visibleSpanM, units.distance),
          },
          {
            label: t(language, "maxProfileHeight"),
            value: formatHeight(activeProfilePanel.stats.maxProfileHeightM, units.height),
          },
        ],
      };
    case "sweep":
      return {
        title: t(language, "sweepSummaryTitle"),
        description: t(language, "sweepSummaryBody"),
        metrics: [
          { label: t(language, "activeAnalysis"), value: getAnalysisTabLabel(language, state.analysisTab) },
          { label: t(language, "activeParameter"), value: getSweepParameterLabel(language, sweepData.parameter) },
          { label: t(language, "activeMetric"), value: getSweepMetricLabel(language, sweepData.metric) },
          {
            label: t(language, "comparedSeries"),
            value: String(sweepData.series.length),
          },
        ],
      };
    case "cross-section":
    default:
      return {
        title: getModelLabel(language, activeResult.model),
        description:
          "Hover a line, curve, or construction in the scene to inspect its angular and geodetic values here.",
        metrics: [
          { label: "Scene", value: getModelLabel(language, activeResult.model) },
          {
            label: "Surface distance",
            value: formatDistance(activeResult.scenario.surfaceDistanceM, units.distance),
          },
          { label: "Central angle", value: formatAngle(activeResult.targetAngleRad) },
          {
            label: "Solver trace step",
            value: formatDistance(activeResult.solverMetadata.stepM, units.distance),
          },
        ],
      };
  }
}

function getFeatureMetrics(
  result: VisibilitySolveResult,
  activeScene: SceneViewModel,
  state: AppState,
  featureId: string | null,
  language: LanguageMode,
): { title: string; description: string; metrics: FeatureMetric[] } {
  const units = state.unitPreferences;
  const targetBaseLocal = getLocalPoint(result, result.targetBasePoint);
  const targetTopLocal = getLocalPoint(result, result.targetTopPoint);
  const observerAltitudePoint = pointAtSurfaceHeight(
    result.scenario.radiusM,
    result.targetAngleRad,
    result.model.geometryMode,
    result.scenario.observerHeightM,
  );
  const observerAltitudeLocal = getLocalPoint(result, observerAltitudePoint);
  const geometricDropM = Math.max(0, -targetBaseLocal.y);
  const chordLengthM = Math.hypot(
    result.targetTopPoint.x - result.observerPoint.x,
    result.targetTopPoint.y - result.observerPoint.y,
  );
  const geometricHorizonDeltaM =
    result.opticalHorizon && result.geometricHorizon
      ? result.opticalHorizon.distanceM - result.geometricHorizon.distanceM
      : 0;
  const primaryRay = result.primaryRay;
  const referenceVisibleSample = getReferenceVisibleSample(result);
  const referenceTargetPoint = referenceVisibleSample
    ? pointAtSurfaceHeight(
        result.scenario.radiusM,
        result.targetAngleRad,
        result.model.geometryMode,
        referenceVisibleSample.sampleHeightM,
      )
    : null;
  const referenceTargetLocal = referenceTargetPoint
    ? getLocalPoint(result, referenceTargetPoint)
    : null;
  const referenceChordLengthM = referenceTargetPoint
    ? Math.hypot(
        referenceTargetPoint.x - result.observerPoint.x,
        referenceTargetPoint.y - result.observerPoint.y,
      )
    : 0;
  const intrinsicCurvatureMagnitude = getIntrinsicCurvatureMagnitude(
    result.model,
    result.scenario,
  );
  const atmosphereCurvatureMagnitude = getAtmosphereCurvatureMagnitude(
    result.model,
    result.scenario,
  );
  const netCurvatureMagnitude =
    result.model.geometryMode === "concave"
      ? intrinsicCurvatureMagnitude - atmosphereCurvatureMagnitude
      : atmosphereCurvatureMagnitude;
  const hoverId = featureId ?? "scene";

  switch (hoverId) {
    case "surface":
      return {
        title:
          result.model.geometryMode === "convex"
            ? "Surface / Sea Level"
            : "Surface / Ground Level",
        description:
          result.model.geometryMode === "convex"
            ? "The physical surface curve of the convex model."
            : "The physical inner shell curve of the concave model.",
        metrics: [
          { label: "Geometry", value: result.model.geometryMode },
          { label: "Radius", value: formatRadius(result.scenario.radiusM, units.radius) },
          {
            label: "Surface distance",
            value: formatDistance(result.scenario.surfaceDistanceM, units.distance),
          },
          { label: "Central angle", value: formatAngle(result.targetAngleRad) },
          {
            label: "Target base drop from tangent",
            value: formatHeight(geometricDropM, units.height),
          },
          {
            label: "Reference role",
            value:
              result.model.geometryMode === "convex"
                ? "Ground / sea-level curve in the convex plate"
                : "Ground / sea-level curve in the concave plate",
          },
        ],
      };
    case "observer-horizontal":
      return {
        title: "Straight Observer Horizontal",
        description:
          "A straight local tangent through the observer. This is the Euclidean horizontal reference line.",
        metrics: [
          {
            label: "Observer height",
            value: formatHeight(result.scenario.observerHeightM, units.height),
          },
          { label: "Reference angle", value: "0 deg tangent" },
          {
            label: "Target base below tangent",
            value: formatHeight(geometricDropM, units.height),
          },
          {
            label: "Geometric horizon",
            value: result.geometricHorizon
              ? formatDistance(result.geometricHorizon.distanceM, units.distance)
              : "N/A",
          },
          {
            label: "Reference role",
            value:
              result.model.geometryMode === "convex"
                ? "Straight horizontal family in the convex plate"
                : "Straight comparison construction in the concave plate",
          },
        ],
      };
    case "observer-altitude-curve":
      return {
        title:
          result.model.geometryMode === "convex"
            ? "Curved Altitude Reference"
            : "Curvilinear Tangent",
        description:
          result.model.geometryMode === "convex"
            ? "A constant-height reference curve following the convex surface geometry at the observer altitude."
            : "A constant-height reference curve following the concave shell geometry at the observer altitude. This is the curvilinear tangent-style reference in the concave view.",
        metrics: [
          {
            label: "Reference height",
            value: formatHeight(result.scenario.observerHeightM, units.height),
          },
          {
            label: "Target offset from tangent",
            value: formatHeight(Math.abs(observerAltitudeLocal.y), units.height),
          },
          {
            label: "Curve direction",
            value: observerAltitudeLocal.y < 0 ? "Drops below tangent" : "Rises above tangent",
          },
          { label: "Geometry mode", value: result.model.geometryMode },
          {
            label: "Reference role",
            value:
              result.model.geometryMode === "convex"
                ? "Curved level / altitude family in the convex plate"
                : "Curvilinear tangent family in the concave plate",
          },
        ],
      };
    case "observer-height":
      return {
        title: "Observer Height",
        description:
          "The vertical height construction from the observer's local surface/shell point to the observation point.",
        metrics: [
          { label: "Observer height", value: formatHeight(result.scenario.observerHeightM, units.height) },
          { label: "Base point", value: "Observer surface point" },
          { label: "Top point", value: "Observation point" },
          {
            label: "Reference role",
            value: "Vertical height construction",
          },
        ],
      };
    case "target-height":
      return {
        title: "Target Height",
        description:
          "The vertical height construction from the target base on the surface/shell to the top of the target.",
        metrics: [
          { label: "Target height", value: formatHeight(result.scenario.targetHeightM, units.height) },
          { label: "Base point", value: "Target base" },
          { label: "Top point", value: "Target top" },
          {
            label: "Reference role",
            value: "Vertical target-height construction",
          },
        ],
      };
    case "terrain-profile":
      return {
        title: activeScene.terrainOverlay?.name ?? "Terrain / Profile Overlay",
        description:
          activeScene.terrainOverlay?.description ??
          "A terrain or structure overlay aligned to the current preset distances.",
        metrics: activeScene.terrainOverlay
          ? [
              {
                label: "Profile span",
                value: formatDistance(activeScene.terrainOverlay.spanDistanceM, units.distance),
              },
              {
                label: "Peak / top height",
                value: formatHeight(activeScene.terrainOverlay.maxHeightM, units.height),
              },
              {
                label: "Use in solver",
                value: "Illustrative only",
              },
              {
                label: "Reference role",
                value: "Terrain / shoreline / mountain overlay",
              },
            ]
          : [{ label: "Status", value: "No profile overlay available" }],
      };
    case "geometric-sightline":
      return {
        title: "Direct Geometric Sightline",
        description:
          "The straight Euclidean line from observer to target top before optical bending.",
        metrics: [
          { label: "Chord length", value: formatDistance(chordLengthM, units.distance) },
          { label: "Geometric elevation", value: formatAngle(result.actualElevationRad) },
          {
            label: "Target top local rise",
            value: formatHeight(Math.abs(targetTopLocal.y), units.height),
          },
          { label: "Central angle", value: formatAngle(result.targetAngleRad) },
          {
            label: "Reference role",
            value: "Straight geometric construction line",
          },
        ],
      };
    case "source-geometric-path":
      return {
        title: "Object-To-Observer Geometric Path",
        description:
          "The straight Euclidean line from the referenced source point on the object to the observer. On the convex model this can pass through the surface even when a curved optical path still reaches the observer.",
        metrics: referenceVisibleSample && referenceTargetLocal
          ? [
              {
                label: "Referenced source height",
                value: formatHeight(referenceVisibleSample.sampleHeightM, units.height),
              },
              {
                label: "Geometric elevation",
                value: formatAngle(referenceVisibleSample.actualElevationRad),
              },
              {
                label: "Chord length",
                value: formatDistance(referenceChordLengthM, units.distance),
              },
              {
                label: "Surface obstruction",
                value:
                  result.hiddenHeightM > 0
                    ? "Used against the visibility boundary / partially obstructed object"
                    : "Direct line to the fully visible target point",
              },
              {
                label: "Reference role",
                value: "Straight source-to-observer construction",
              },
            ]
          : [{ label: "Status", value: "No referenced source point is currently solved" }],
      };
    case "actual-ray":
      return {
        title:
          result.primaryRay?.targetCrossing != null
            ? "Actual Ray Path"
            : "Optical Horizon Reference Ray",
        description:
          result.primaryRay?.targetCrossing != null
            ? "The solved ray under the active atmosphere and intrinsic curvature assumptions."
            : "No target-reaching ray is currently solved, so this is the grazing horizon reference ray under the active curvature law.",
        metrics: primaryRay
          ? [
              { label: "Launch angle", value: formatAngle(primaryRay.launchAngleRad) },
              { label: "Total bend", value: formatAngle(primaryRay.totalBendRad) },
              {
                label: "Path type",
                value:
                  Math.abs(primaryRay.totalBendRad) < 1e-4 ? "Near-straight" : "Curved",
              },
              {
                label: "Solved arc length",
                value: primaryRay.targetCrossing
                  ? formatDistance(primaryRay.targetCrossing.arcLengthM, units.distance)
                  : "N/A",
              },
              {
                label: "Min surface clearance",
                value: formatHeight(primaryRay.minSurfaceClearanceM, units.height),
              },
              { label: "Termination", value: primaryRay.terminationReason },
              {
                label: "Reference role",
                value:
                  result.model.geometryMode === "convex"
                    ? "Curved optical line of sight in the convex plate"
                    : "Curved physical sight path in the concave plate",
              },
            ]
          : [{ label: "Status", value: "No solved primary ray" }],
      };
    case "source-light-path":
      return {
        title: "Object-To-Observer Light Path",
        description:
          result.model.geometryMode === "convex"
            ? "The curved physical light path from the referenced source point to the observer under the active atmospheric bending."
            : "The curved physical light path from the referenced source point to the observer under the intrinsic concave bending law plus atmospheric modification.",
        metrics: referenceVisibleSample?.trace
          ? [
              {
                label: "Referenced source height",
                value: formatHeight(referenceVisibleSample.sampleHeightM, units.height),
              },
              {
                label: "Apparent elevation",
                value: formatAngle(referenceVisibleSample.apparentElevationRad),
              },
              {
                label: "Solved arc length",
                value: formatDistance(
                  referenceVisibleSample.trace.targetCrossing?.arcLengthM ??
                    referenceVisibleSample.trace.points[
                      referenceVisibleSample.trace.points.length - 1
                    ]?.s ??
                    0,
                  units.distance,
                ),
              },
              {
                label: "Total bend",
                value: formatAngle(referenceVisibleSample.trace.totalBendRad),
              },
              {
                label: "Min surface clearance",
                value: formatHeight(
                  referenceVisibleSample.trace.minSurfaceClearanceM,
                  units.height,
                ),
              },
              {
                label: "Reference role",
                value:
                  result.model.geometryMode === "convex"
                    ? "Curved source-to-observer optical path"
                    : "Curved source-to-observer endospherical path",
              },
            ]
          : [{ label: "Status", value: "No referenced source light path is currently solved" }],
      };
    case "apparent-line":
      return {
        title: result.visible ? "Apparent Line Of Sight" : "Apparent Horizon Direction",
        description:
          result.visible
            ? "The straight apparent direction at the observer implied by the solved ray."
            : "The straight apparent direction associated with the solved grazing horizon ray when no target-reaching ray is available.",
        metrics: [
          { label: "Apparent elevation", value: formatAngle(result.apparentElevationRad) },
          { label: "Geometric elevation", value: formatAngle(result.actualElevationRad) },
          {
            label: "Apparent minus geometric",
            value: formatAngle(
              (result.apparentElevationRad ?? 0) - result.actualElevationRad,
            ),
          },
          { label: "Model", value: getModelLabel(language, result.model) },
          {
            label: "Reference role",
            value: "Straight apparent direction seen at the observer",
          },
        ],
      };
    case "horizon-geometric":
      return {
        title:
          result.model.geometryMode === "convex"
            ? "Geometric Horizon Tangent"
            : "Geometric Horizon Construction",
        description:
          "The tangent-to-surface horizon with no optical correction.",
        metrics: result.geometricHorizon
          ? [
              {
                label: "Distance",
                value: formatDistance(
                  result.geometricHorizon.distanceM,
                  units.distance,
                ),
              },
              { label: "Surface angle", value: formatAngle(result.geometricHorizon.surfaceAngleRad) },
              { label: "Apparent elevation", value: formatAngle(result.geometricHorizon.apparentElevationRad) },
              {
                label: "Reference role",
                value:
                  result.model.geometryMode === "convex"
                    ? "Rectilinear tangent family in the convex plate"
                    : "Straight geometric horizon construction",
              },
            ]
          : [{ label: "Status", value: "Not available for this solve" }],
      };
    case "horizon-optical":
      return {
        title: "Optical Horizon",
        description:
          "The traced grazing boundary under the active ray-curvature law.",
        metrics: result.opticalHorizon
          ? [
              {
                label: "Distance",
                value: formatDistance(result.opticalHorizon.distanceM, units.distance),
              },
              { label: "Apparent elevation", value: formatAngle(result.opticalHorizon.apparentElevationRad) },
              {
                label: "Vs geometric horizon",
                value: result.geometricHorizon
                  ? formatDistance(geometricHorizonDeltaM, units.distance)
                  : "N/A",
              },
              {
                label: "Reference role",
                value: "Grazing curved horizon boundary under the active ray law",
              },
            ]
          : [{ label: "Status", value: "No optical horizon found" }],
      };
    case "hidden-height":
      return {
        title: "Hidden Height",
        description:
          "The obscured lower portion of the target under the active solve.",
        metrics: [
          { label: "Hidden height", value: formatHeight(result.hiddenHeightM, units.height) },
          { label: "Visible height", value: formatHeight(result.visibleHeightM, units.height) },
          { label: "Visibility fraction", value: formatFraction(result.visibilityFraction) },
          { label: "Solved visible samples", value: String(result.solverMetadata.solvedVisibleSamples) },
          { label: "Reference role", value: "Occluded lower target segment" },
        ],
      };
    default:
      return {
        title: getModelLabel(language, result.model),
        description:
          "Hover a line, curve, or construction in the scene to inspect its angular and geodetic values here.",
        metrics: [
          { label: "Scene", value: getModelLabel(language, result.model) },
          {
            label: "Surface distance",
            value: formatDistance(result.scenario.surfaceDistanceM, units.distance),
          },
          { label: "Central angle", value: formatAngle(result.targetAngleRad) },
          {
            label: "Solver trace step",
            value: formatDistance(result.solverMetadata.stepM, units.distance),
          },
        ],
      };
  }
}

function getFieldMetricRows(args: {
  state: AppState;
  activeResult: VisibilitySolveResult;
  activeBundlePanel: RayBundlePanelData;
  activeProfilePanel: ProfileVisibilityPanelData;
  activeObserverPanel: ObserverViewPanelData;
  sweepData: SweepChartData;
  surfaceChordM: number;
  geometricDropM: number;
  language: LanguageMode;
}) {
  const {
    state,
    activeResult,
    activeBundlePanel,
    activeProfilePanel,
    activeObserverPanel,
    sweepData,
    surfaceChordM,
    geometricDropM,
    language,
  } = args;

  const units = state.unitPreferences;

  if (state.analysisTab === "ray-bundle") {
    const visibleStartHeightM =
      activeBundlePanel.samplePoints.find((point) => point.visible)?.heightM ?? 0;

    return [
      {
        label: "Surface arc distance",
        value: formatDistance(activeResult.scenario.surfaceDistanceM, units.distance),
      },
      {
        label: t(language, "bundleSpan"),
        value: formatDistance(activeBundlePanel.stats.bundleSpanM, units.distance),
      },
      {
        label: t(language, "bundleSampleCount"),
        value: String(activeBundlePanel.samplePoints.length),
      },
      {
        label: "Visible start height",
        value: formatHeight(visibleStartHeightM, units.height),
      },
      {
        label: "Observer height",
        value: formatHeight(activeResult.scenario.observerHeightM, units.height),
      },
      {
        label: "Target stack height",
        value: formatHeight(activeResult.scenario.targetHeightM, units.height),
      },
    ];
  }

  if (state.analysisTab === "observer-view") {
    return [
      { label: t(language, "apparentHorizonDip"), value: activeObserverPanel.stats.horizonDipLabel },
      {
        label: t(language, "apparentProfileSpan"),
        value: formatDistance(activeObserverPanel.stats.apparentProfileSpanM, units.distance),
      },
      {
        label: t(language, "visibleTopElevation"),
        value:
          activeObserverPanel.stats.topVisibleElevationRad == null
            ? "N/A"
            : formatAngle(activeObserverPanel.stats.topVisibleElevationRad),
      },
      {
        label: t(language, "geometricTopElevation"),
        value: formatAngle(activeObserverPanel.stats.topGhostElevationRad),
      },
      {
        label: t(language, "visibleSamples"),
        value: String(activeObserverPanel.stats.visibleSamples),
      },
      {
        label: t(language, "blockedSamples"),
        value: String(activeObserverPanel.stats.blockedSamples),
      },
    ];
  }

  if (state.analysisTab === "profile-visibility") {
    return [
      {
        label: "Surface arc distance",
        value: formatDistance(activeResult.scenario.surfaceDistanceM, units.distance),
      },
      {
        label: t(language, "visibleProfileSpan"),
        value: formatDistance(activeProfilePanel.stats.visibleSpanM, units.distance),
      },
      {
        label: t(language, "profileSamples"),
        value: String(activeProfilePanel.stats.sampleCount),
      },
      {
        label: t(language, "maxProfileHeight"),
        value: formatHeight(activeProfilePanel.stats.maxProfileHeightM, units.height),
      },
      {
        label: t(language, "visibleSamples"),
        value: String(activeProfilePanel.stats.visibleSamples),
      },
      {
        label: t(language, "blockedSamples"),
        value: String(activeProfilePanel.stats.blockedSamples),
      },
    ];
  }

  if (state.analysisTab === "sweep") {
    return [
      {
        label: t(language, "activeParameter"),
        value: getSweepParameterLabel(language, sweepData.parameter),
      },
      {
        label: t(language, "activeMetric"),
        value: getSweepMetricLabel(language, sweepData.metric),
      },
      {
        label: t(language, "currentScenarioValue"),
        value: formatSweepParameterValue(
          sweepData.range.current,
          sweepData.parameter,
          units,
        ),
      },
      {
        label: "Range start",
        value: formatSweepParameterValue(sweepData.range.min, sweepData.parameter, units),
      },
      {
        label: "Range end",
        value: formatSweepParameterValue(sweepData.range.max, sweepData.parameter, units),
      },
      {
        label: t(language, "sweepSamples"),
        value: String(state.sweepConfig.sampleCount),
      },
    ];
  }

  return [
    {
      label: "Surface arc distance",
      value: formatDistance(activeResult.scenario.surfaceDistanceM, units.distance),
    },
    {
      label: "Surface chord",
      value: formatDistance(surfaceChordM, units.distance),
    },
    {
      label: "Arc minus chord",
      value: formatDistance(activeResult.scenario.surfaceDistanceM - surfaceChordM, units.distance),
    },
    {
      label: "Central angle",
      value: formatAngle(activeResult.targetAngleRad),
    },
    {
      label: "Target base drop from tangent",
      value: formatHeight(geometricDropM, units.height),
    },
    {
      label: "Geometric horizon dip",
      value: activeResult.geometricHorizon
        ? formatAngle(Math.abs(activeResult.geometricHorizon.apparentElevationRad))
        : "N/A",
    },
    {
      label: "Optical horizon dip",
      value: activeResult.opticalHorizon
        ? formatAngle(Math.abs(activeResult.opticalHorizon.apparentElevationRad))
        : "N/A",
    },
  ];
}

export function RightPanel({
  state,
  activeResult,
  activeScene,
  activeBundlePanel,
  activeProfilePanel,
  activeObserverPanel,
  sweepData,
  inspectedSceneKey,
  activeFeatureId,
  isFeaturePinned,
  workspaceMode,
  onClearSelection,
  onExport,
  onCopyLink,
  message,
  language,
  sceneFirstLayout,
}: RightPanelProps) {
  const preset = getPresetById(state.scenario.presetId);
  const hoveredAnnotation = activeScene.annotations.find(
    (annotation) => annotation.id === activeFeatureId,
  );
  const targetBaseLocal = getLocalPoint(activeResult, activeResult.targetBasePoint);
  const surfaceChordM = Math.hypot(
    activeResult.targetBasePoint.x - activeResult.observerSurfacePoint.x,
    activeResult.targetBasePoint.y - activeResult.observerSurfacePoint.y,
  );
  const intrinsicCurvatureMagnitude = getIntrinsicCurvatureMagnitude(
    activeResult.model,
    activeResult.scenario,
  );
  const atmosphereCurvatureMagnitude = getAtmosphereCurvatureMagnitude(
    activeResult.model,
    activeResult.scenario,
  );
  const atmosphereDirection =
    atmosphereCurvatureMagnitude >= 0 ? "downward" : "upward";
  const netCurvatureMagnitude =
    activeResult.model.geometryMode === "concave"
      ? intrinsicCurvatureMagnitude - atmosphereCurvatureMagnitude
      : atmosphereCurvatureMagnitude;
  const netCurvatureDirection =
    netCurvatureMagnitude >= 0 ? "upward" : "downward";
  const geometricDropM = Math.max(0, -targetBaseLocal.y);
  const scaleModeLabel =
    state.sceneViewport.scaleMode === "true-scale"
      ? "True scale"
      : state.sceneViewport.scaleMode === "survey"
        ? "Survey scale"
        : "Diagram spread";
  const professionalMode = workspaceMode === "professional";
  const analysisSummary = getAnalysisSummary({
    state,
    activeResult,
    activeBundlePanel,
    activeProfilePanel,
    activeObserverPanel,
    sweepData,
    language,
  });
  const currentOutputCards = getCurrentOutputCards({
    state,
    activeResult,
    activeBundlePanel,
    activeProfilePanel,
    activeObserverPanel,
    sweepData,
    language,
  });
  const fieldMetricRows = getFieldMetricRows({
    state,
    activeResult,
    activeBundlePanel,
    activeProfilePanel,
    activeObserverPanel,
    sweepData,
    surfaceChordM,
    geometricDropM,
    language,
  });
  const featureDetails = getFeatureMetrics(
    activeResult,
    activeScene,
    state,
    activeFeatureId,
    language,
  );

  return (
    <aside className="right-panel panel">
      <PanelSection
        title={t(language, "currentOutput")}
        eyebrow={t(language, "numerics")}
        className="right-panel__section right-panel__section--numerics"
      >
        <div className="metrics-grid">
          {currentOutputCards.map((metric) => (
            <SummaryMetric key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>
      </PanelSection>

      <PanelSection
        title={t(language, "modelTransparency")}
        eyebrow={t(language, "assumptions")}
        className="right-panel__section right-panel__section--assumptions"
      >
          <div className="detail-card">
          <p>
            <strong>{t(language, "activeAnalysis")}:</strong>{" "}
            {getAnalysisTabLabel(language, state.analysisTab)}
          </p>
          <p>
            <strong>Inspecting:</strong> {inspectedSceneKey === "primary" ? `${t(language, "primaryModelTitle")} panel` : `${t(language, "comparisonModelTitle")} panel`}
          </p>
          <p>
            <strong>Geometry:</strong> {activeResult.model.geometryMode === "convex" ? t(language, "convexSphere") : t(language, "concaveShell")}
          </p>
          <p>
            <strong>Intrinsic:</strong> {activeResult.model.intrinsicCurvatureMode}
          </p>
          <p>
            <strong>Model:</strong> {getModelLabel(language, activeResult.model)}
          </p>
          <p>
            <strong>{t(language, "atmosphericRefraction")}:</strong>{" "}
            {activeResult.model.atmosphere.mode === "simpleCoefficient"
              ? t(language, "atmosphericRefractionWithK", {
                  value: activeResult.model.atmosphere.coefficient.toFixed(2),
                })
              : t(language, "none")}
          </p>
          <p>
            <strong>Curvature law:</strong>{" "}
            {activeResult.model.geometryMode === "concave"
              ? `${formatCurvatureRatio(
                  intrinsicCurvatureMagnitude,
                  activeResult.scenario.radiusM,
                  "upward",
                )} + ${formatCurvatureRatio(
                  atmosphereCurvatureMagnitude,
                  activeResult.scenario.radiusM,
                  atmosphereDirection,
                )} = ${formatCurvatureRatio(
                  netCurvatureMagnitude,
                  activeResult.scenario.radiusM,
                  netCurvatureDirection,
                )}`
              : formatCurvatureRatio(
                  atmosphereCurvatureMagnitude,
                  activeResult.scenario.radiusM,
                  atmosphereDirection,
                )}
          </p>
          <p>
            <strong>Radius:</strong> {formatRadius(activeResult.scenario.radiusM, state.unitPreferences.radius)}
          </p>
          <p>
            <strong>Viewport:</strong> {state.sceneViewport.framingMode === "auto" ? "Auto fit" : "Full span"}
            {` | zoom ${state.sceneViewport.zoom.toFixed(2)}x`}
          </p>
          <p>
            <strong>Scale mode:</strong> {scaleModeLabel}
          </p>
          <p>
            <strong>Units:</strong> height {state.unitPreferences.height} | distance{" "}
            {state.unitPreferences.distance} | radius {state.unitPreferences.radius}
          </p>
          <p>
            <strong>Vertical display:</strong>{" "}
            {state.sceneViewport.scaleMode === "true-scale"
              ? `${state.sceneViewport.verticalZoom.toFixed(2)}x true-scale factor`
              : state.sceneViewport.scaleMode === "survey"
                ? `${state.sceneViewport.verticalZoom.toFixed(2)}x survey relief factor`
                : `base x${activeScene.suggestedVerticalScale.toFixed(1)} with control x${state.sceneViewport.verticalZoom.toFixed(2)}`}
          </p>
        </div>
      </PanelSection>

      {professionalMode ? (
        <PanelSection
          title={
            state.analysisTab === "ray-bundle"
              ? t(language, "rayBundleSummaryTitle")
              : state.analysisTab === "observer-view"
                ? t(language, "observerReconstructionTitle")
                : state.analysisTab === "profile-visibility"
                  ? t(language, "profileVisibilitySummaryTitle")
                  : state.analysisTab === "sweep"
                    ? t(language, "sweepSummaryTitle")
                    : t(language, "surveyGeometry")
          }
          eyebrow={t(language, "fieldMetrics")}
          className="right-panel__section right-panel__section--field-metrics"
        >
          <div className="detail-card">
            <div className="feature-metrics">
              {fieldMetricRows.map((metric) => (
                <div key={metric.label} className="feature-metrics__row">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </PanelSection>
      ) : null}

      {professionalMode && !sceneFirstLayout ? (
        <PanelSection
          title={t(language, "lineLegend")}
          eyebrow={t(language, "sceneGuide")}
          className="right-panel__section right-panel__section--legend"
        >
          <div className="detail-card">
            <div className="legend-list">
              {activeScene.annotations
                .filter(
                  (annotation) =>
                    state.showTerrainOverlay || annotation.id !== "terrain-profile",
                )
                .map((annotation) => (
                  <div
                    key={annotation.id}
                    className={
                      annotation.id === activeFeatureId
                        ? "legend-item legend-item--active"
                        : "legend-item"
                    }
                  >
                    <span
                      className="legend-swatch"
                      style={{ backgroundColor: annotation.color }}
                    />
                    <span>{annotation.label}</span>
                  </div>
                ))}
            </div>
          </div>
        </PanelSection>
      ) : null}

      <PanelSection
        title={t(language, "featureInspection")}
        eyebrow={t(language, "inspection")}
        className="right-panel__section right-panel__section--inspection"
      >
          <div className="detail-card">
            <div className="detail-card__toolbar">
              <div>
                <p className="detail-card__eyebrow">
                  {state.analysisTab === "cross-section"
                    ? isFeaturePinned
                      ? t(language, "pinnedFeature")
                      : activeFeatureId
                        ? t(language, "hoveredFeature")
                        : t(language, "sceneSummary")
                    : t(language, "sceneSummary")}
                </p>
                <h4>
                  {state.analysisTab === "cross-section"
                    ? hoveredAnnotation?.label ?? featureDetails.title
                    : analysisSummary.title}
                </h4>
              </div>
              {state.analysisTab === "cross-section" && isFeaturePinned ? (
                <button
                  type="button"
                  className="field__reset"
                onClick={onClearSelection}
              >
                {t(language, "clearPin")}
                </button>
              ) : null}
            </div>
            <p>
              {state.analysisTab === "cross-section"
                ? hoveredAnnotation?.description ?? featureDetails.description
                : analysisSummary.description}
            </p>
            <p className="field__hint">
              {state.analysisTab === "cross-section"
                ? t(language, "hoverToInspectHint")
                : t(language, "sharedSceneText")}
            </p>
            <div className="feature-metrics">
              {(state.analysisTab === "cross-section"
                ? featureDetails.metrics
                : analysisSummary.metrics
              ).map((metric) => (
                <div key={metric.label} className="feature-metrics__row">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </PanelSection>

      {professionalMode ? (
        <PanelSection
          title={t(language, "presetNotes")}
          eyebrow={t(language, "context")}
          className="right-panel__section right-panel__section--context"
        >
          <div className="detail-card">
            <h4>{getPresetName(language, preset)}</h4>
            <p>{getPresetDescription(language, preset)}</p>
            {activeScene.terrainOverlay ? (
              <p>
                Profile overlay: {activeScene.terrainOverlay.name}. This layer is
                aligned to the scenario distances for diagram readability in the
                cross-section view, and the dedicated Profile Visibility analysis
                tab now samples that profile through the shared solver.
              </p>
            ) : null}
          </div>
        </PanelSection>
      ) : null}

      <PanelSection
        title={t(language, "shareExport")}
        eyebrow={t(language, "output")}
        className="right-panel__section right-panel__section--output"
      >
        <div className="action-row">
          <button type="button" className="action-button" onClick={onExport}>
            {t(language, "exportPng")}
          </button>
          <button type="button" className="action-button action-button--ghost" onClick={onCopyLink}>
            {t(language, "copyShareUrl")}
          </button>
        </div>
        {message ? <p className="status-text">{message}</p> : null}
      </PanelSection>
    </aside>
  );
}
