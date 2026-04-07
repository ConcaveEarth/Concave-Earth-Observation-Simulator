import { getPresetById } from "../../domain/presets";
import { formatAngle, formatDistance, formatFraction, formatHeight } from "../../domain/units";
import type { SceneViewModel, VisibilitySolveResult } from "../../domain/types";
import type { AppState } from "../../state/appState";
import { PanelSection } from "./PanelSection";

interface RightPanelProps {
  state: AppState;
  activeResult: VisibilitySolveResult;
  activeScene: SceneViewModel;
  onExport: () => void;
  onCopyLink: () => void;
  message: string | null;
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

export function RightPanel({
  state,
  activeResult,
  activeScene,
  onExport,
  onCopyLink,
  message,
}: RightPanelProps) {
  const preset = getPresetById(state.scenario.presetId);
  const hoveredAnnotation = activeScene.annotations.find(
    (annotation) => annotation.id === state.hoveredFeatureId,
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
            <strong>Solver:</strong> {activeResult.solverMetadata.sampleCount} target samples,{" "}
            {formatDistance(activeResult.solverMetadata.stepM)} trace step
          </p>
        </div>
      </PanelSection>

      <PanelSection title="Explanation" eyebrow="Hovered feature">
        <div className="detail-card">
          <h4>{hoveredAnnotation?.label ?? activeScene.title}</h4>
          <p>
            {hoveredAnnotation?.description ??
              "Hover the diagram to inspect the active ray, surface, horizon, and hidden-height constructs."}
          </p>
        </div>
      </PanelSection>

      <PanelSection title="Preset Notes" eyebrow="Context">
        <div className="detail-card">
          <h4>{preset.name}</h4>
          <p>{preset.description}</p>
        </div>
      </PanelSection>

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

