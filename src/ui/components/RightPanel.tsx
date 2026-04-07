import { pointAtSurfaceHeight, toObserverFrame } from "../../domain/geometry";
import { getPresetById } from "../../domain/presets";
import { formatAngle, formatDistance, formatFraction, formatHeight, roundTo } from "../../domain/units";
import type { FocusedModel, SceneViewModel, VisibilitySolveResult } from "../../domain/types";
import type { AppState, WorkspaceMode } from "../../state/appState";
import { PanelSection } from "./PanelSection";

interface RightPanelProps {
  state: AppState;
  activeResult: VisibilitySolveResult;
  activeScene: SceneViewModel;
  inspectedSceneKey: FocusedModel;
  activeFeatureId: string | null;
  isFeaturePinned: boolean;
  workspaceMode: WorkspaceMode;
  onClearSelection: () => void;
  onExport: () => void;
  onCopyLink: () => void;
  message: string | null;
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

function getFeatureMetrics(
  result: VisibilitySolveResult,
  activeScene: SceneViewModel,
  featureId: string | null,
): { title: string; description: string; metrics: FeatureMetric[] } {
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
  const hoverId = featureId ?? "scene";

  switch (hoverId) {
    case "surface":
      return {
        title: "Surface / Shell",
        description:
          result.model.geometryMode === "convex"
            ? "The physical surface curve of the convex model."
            : "The physical inner shell curve of the concave model.",
        metrics: [
          { label: "Geometry", value: result.model.geometryMode },
          { label: "Radius", value: formatDistance(result.scenario.radiusM) },
          { label: "Surface distance", value: formatDistance(result.scenario.surfaceDistanceM) },
          { label: "Central angle", value: formatAngle(result.targetAngleRad) },
          { label: "Target base drop from tangent", value: formatHeight(geometricDropM) },
        ],
      };
    case "observer-horizontal":
      return {
        title: "Observer Horizontal",
        description:
          "A straight local tangent through the observer. This is the geometric horizontal reference line.",
        metrics: [
          {
            label: "Observer height",
            value: formatHeight(result.scenario.observerHeightM),
          },
          { label: "Reference angle", value: "0 deg tangent" },
          {
            label: "Target base below tangent",
            value: formatHeight(geometricDropM),
          },
          {
            label: "Geometric horizon",
            value: result.geometricHorizon
              ? formatDistance(result.geometricHorizon.distanceM)
              : "N/A",
          },
        ],
      };
    case "observer-altitude-curve":
      return {
        title: "Observer Altitude Curve",
        description:
          "A constant-height reference curve following the active surface/shell geometry at the observer altitude.",
        metrics: [
          { label: "Reference height", value: formatHeight(result.scenario.observerHeightM) },
          { label: "Target offset from tangent", value: formatHeight(Math.abs(observerAltitudeLocal.y)) },
          {
            label: "Curve direction",
            value: observerAltitudeLocal.y < 0 ? "Drops below tangent" : "Rises above tangent",
          },
          { label: "Geometry mode", value: result.model.geometryMode },
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
                value: formatDistance(activeScene.terrainOverlay.spanDistanceM),
              },
              {
                label: "Peak / top height",
                value: formatHeight(activeScene.terrainOverlay.maxHeightM),
              },
              {
                label: "Use in solver",
                value: "Illustrative only",
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
          { label: "Chord length", value: formatDistance(chordLengthM) },
          { label: "Geometric elevation", value: formatAngle(result.actualElevationRad) },
          { label: "Target top local rise", value: formatHeight(Math.abs(targetTopLocal.y)) },
          { label: "Central angle", value: formatAngle(result.targetAngleRad) },
        ],
      };
    case "actual-ray":
      return {
        title: "Actual Ray Path",
        description:
          "The solved ray under the active atmosphere and intrinsic curvature assumptions.",
        metrics: primaryRay
          ? [
              { label: "Launch angle", value: formatAngle(primaryRay.launchAngleRad) },
              { label: "Total bend", value: formatAngle(primaryRay.totalBendRad) },
              {
                label: "Solved arc length",
                value: primaryRay.targetCrossing
                  ? formatDistance(primaryRay.targetCrossing.arcLengthM)
                  : "N/A",
              },
              { label: "Min surface clearance", value: formatHeight(primaryRay.minSurfaceClearanceM) },
              { label: "Termination", value: primaryRay.terminationReason },
            ]
          : [{ label: "Status", value: "No solved primary ray" }],
      };
    case "apparent-line":
      return {
        title: "Apparent Line Of Sight",
        description:
          "The straight apparent direction at the observer implied by the solved ray.",
        metrics: [
          { label: "Apparent elevation", value: formatAngle(result.apparentElevationRad) },
          { label: "Geometric elevation", value: formatAngle(result.actualElevationRad) },
          {
            label: "Apparent minus geometric",
            value: formatAngle(
              (result.apparentElevationRad ?? 0) - result.actualElevationRad,
            ),
          },
          { label: "Model", value: result.model.label },
        ],
      };
    case "horizon-geometric":
      return {
        title: "Geometric Horizon",
        description:
          "The tangent-to-surface horizon with no optical correction.",
        metrics: result.geometricHorizon
          ? [
              { label: "Distance", value: formatDistance(result.geometricHorizon.distanceM) },
              { label: "Surface angle", value: formatAngle(result.geometricHorizon.surfaceAngleRad) },
              { label: "Apparent elevation", value: formatAngle(result.geometricHorizon.apparentElevationRad) },
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
              { label: "Distance", value: formatDistance(result.opticalHorizon.distanceM) },
              { label: "Apparent elevation", value: formatAngle(result.opticalHorizon.apparentElevationRad) },
              {
                label: "Vs geometric horizon",
                value: result.geometricHorizon
                  ? formatDistance(geometricHorizonDeltaM)
                  : "N/A",
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
          { label: "Hidden height", value: formatHeight(result.hiddenHeightM) },
          { label: "Visible height", value: formatHeight(result.visibleHeightM) },
          { label: "Visibility fraction", value: formatFraction(result.visibilityFraction) },
          { label: "Solved visible samples", value: String(result.solverMetadata.solvedVisibleSamples) },
        ],
      };
    default:
      return {
        title: result.model.label,
        description:
          "Hover a line, curve, or construction in the scene to inspect its angular and geodetic values here.",
        metrics: [
          { label: "Scene", value: result.model.label },
          { label: "Surface distance", value: formatDistance(result.scenario.surfaceDistanceM) },
          { label: "Central angle", value: formatAngle(result.targetAngleRad) },
          {
            label: "Solver trace step",
            value: `${roundTo(result.solverMetadata.stepM, 0)} m`,
          },
        ],
      };
  }
}

export function RightPanel({
  state,
  activeResult,
  activeScene,
  inspectedSceneKey,
  activeFeatureId,
  isFeaturePinned,
  workspaceMode,
  onClearSelection,
  onExport,
  onCopyLink,
  message,
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
  const geometricDropM = Math.max(0, -targetBaseLocal.y);
  const scaleModeLabel =
    state.sceneViewport.scaleMode === "true-scale"
      ? "True scale"
      : state.sceneViewport.scaleMode === "survey"
        ? "Survey scale"
        : "Diagram spread";
  const professionalMode = workspaceMode === "professional";
  const featureDetails = getFeatureMetrics(
    activeResult,
    activeScene,
    activeFeatureId,
  );

  return (
    <aside className="right-panel panel">
      <PanelSection title="Current Output" eyebrow="Numerics">
        <div className="metrics-grid">
          <SummaryMetric
            label="Hidden height"
            value={formatHeight(activeResult.hiddenHeightM)}
          />
          <SummaryMetric
            label="Visible height"
            value={formatHeight(activeResult.visibleHeightM)}
          />
          <SummaryMetric
            label="Visibility fraction"
            value={formatFraction(activeResult.visibilityFraction)}
          />
          <SummaryMetric
            label="Apparent elevation"
            value={formatAngle(activeResult.apparentElevationRad)}
          />
          <SummaryMetric
            label="Actual elevation"
            value={formatAngle(activeResult.actualElevationRad)}
          />
          <SummaryMetric
            label="Optical horizon"
            value={
              activeResult.opticalHorizon
                ? formatDistance(activeResult.opticalHorizon.distanceM)
                : "N/A"
            }
          />
        </div>
      </PanelSection>

      <PanelSection title="Model Transparency" eyebrow="Assumptions">
        <div className="detail-card">
          <p>
            <strong>Inspecting:</strong> {inspectedSceneKey === "primary" ? "Primary panel" : "Comparison panel"}
          </p>
          <p>
            <strong>Geometry:</strong> {activeResult.model.geometryMode === "convex" ? "Convex sphere" : "Concave shell"}
          </p>
          <p>
            <strong>Intrinsic:</strong> {activeResult.model.intrinsicCurvatureMode}
          </p>
          <p>
            <strong>Atmosphere:</strong> {activeResult.model.atmosphere.mode}
            {activeResult.model.atmosphere.mode === "simpleCoefficient"
              ? ` (k = ${activeResult.model.atmosphere.coefficient.toFixed(2)})`
              : ""}
          </p>
          <p>
            <strong>Radius:</strong> {formatDistance(activeResult.scenario.radiusM)}
          </p>
          <p>
            <strong>Viewport:</strong> {state.sceneViewport.framingMode === "auto" ? "Auto fit" : "Full span"}
            {` | zoom ${state.sceneViewport.zoom.toFixed(2)}x`}
          </p>
          <p>
            <strong>Scale mode:</strong> {scaleModeLabel}
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
        <PanelSection title="Survey Geometry" eyebrow="Field metrics">
          <div className="detail-card">
            <div className="feature-metrics">
              <div className="feature-metrics__row">
                <span>Surface arc distance</span>
                <strong>{formatDistance(activeResult.scenario.surfaceDistanceM)}</strong>
              </div>
              <div className="feature-metrics__row">
                <span>Surface chord</span>
                <strong>{formatDistance(surfaceChordM)}</strong>
              </div>
              <div className="feature-metrics__row">
                <span>Arc minus chord</span>
                <strong>{formatDistance(activeResult.scenario.surfaceDistanceM - surfaceChordM)}</strong>
              </div>
              <div className="feature-metrics__row">
                <span>Central angle</span>
                <strong>{formatAngle(activeResult.targetAngleRad)}</strong>
              </div>
              <div className="feature-metrics__row">
                <span>Target base drop from tangent</span>
                <strong>{formatHeight(geometricDropM)}</strong>
              </div>
              <div className="feature-metrics__row">
                <span>Geometric horizon dip</span>
                <strong>
                  {activeResult.geometricHorizon
                    ? formatAngle(Math.abs(activeResult.geometricHorizon.apparentElevationRad))
                    : "N/A"}
                </strong>
              </div>
              <div className="feature-metrics__row">
                <span>Optical horizon dip</span>
                <strong>
                  {activeResult.opticalHorizon
                    ? formatAngle(Math.abs(activeResult.opticalHorizon.apparentElevationRad))
                    : "N/A"}
                </strong>
              </div>
            </div>
          </div>
        </PanelSection>
      ) : null}

      {professionalMode ? (
        <PanelSection title="Line Legend" eyebrow="Scene guide">
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

      <PanelSection title="Feature Inspection" eyebrow="Inspection">
        <div className="detail-card">
          <div className="detail-card__toolbar">
            <div>
              <p className="detail-card__eyebrow">
                {isFeaturePinned ? "Pinned feature" : activeFeatureId ? "Hovered feature" : "Scene summary"}
              </p>
              <h4>{hoveredAnnotation?.label ?? featureDetails.title}</h4>
            </div>
            {isFeaturePinned ? (
              <button
                type="button"
                className="field__reset"
                onClick={onClearSelection}
              >
                Clear pin
              </button>
            ) : null}
          </div>
          <p>{hoveredAnnotation?.description ?? featureDetails.description}</p>
          <p className="field__hint">
            Hover a construction to inspect it. Click a line or marker in the scene to pin it here.
          </p>
          <div className="feature-metrics">
            {featureDetails.metrics.map((metric) => (
              <div key={metric.label} className="feature-metrics__row">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </PanelSection>

      {professionalMode ? (
        <PanelSection title="Preset Notes" eyebrow="Context">
          <div className="detail-card">
            <h4>{preset.name}</h4>
            <p>{preset.description}</p>
            {activeScene.terrainOverlay ? (
              <p>
                Profile overlay: {activeScene.terrainOverlay.name}. This layer is
                aligned to the scenario distances for diagram readability, and it
                does not yet replace the solver's baseline surface-intersection mesh.
              </p>
            ) : null}
          </div>
        </PanelSection>
      ) : null}

      <PanelSection title="Share / Export" eyebrow="Output">
        <div className="action-row">
          <button type="button" className="action-button" onClick={onExport}>
            Export PNG
          </button>
          <button type="button" className="action-button action-button--ghost" onClick={onCopyLink}>
            Copy Share URL
          </button>
        </div>
        {message ? <p className="status-text">{message}</p> : null}
      </PanelSection>
    </aside>
  );
}
