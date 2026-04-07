import { startTransition } from "react";
import type { Dispatch } from "react";
import { getPresetById, scenarioPresets } from "../../domain/presets";
import type {
  FocusedModel,
  ModelConfig,
  ScenarioInput,
  ViewMode,
} from "../../domain/types";
import type { AppAction, AppState } from "../../state/appState";
import { PanelSection } from "./PanelSection";

interface ControlsPanelProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  onExport: () => void;
  onCopyLink: () => void;
}

interface ModelEditorProps {
  title: string;
  target: FocusedModel;
  model: ModelConfig;
  dispatch: Dispatch<AppAction>;
}

function NumberField({
  label,
  value,
  step,
  min,
  max,
  suffix,
  resetValue,
  onReset,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max?: number;
  suffix: string;
  resetValue?: number;
  onReset?: () => void;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <div className="field__label-row">
        <span>{label}</span>
        {onReset ? (
          <button
            type="button"
            className="field__reset"
            onClick={onReset}
            disabled={resetValue === value}
          >
            Reset
          </button>
        ) : null}
      </div>
      <div className="field__row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <div className="field__value">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <span>{suffix}</span>
        </div>
      </div>
    </label>
  );
}

function ViewPills({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="pill-group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? "pill pill--active" : "pill"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ModelEditor({ title, target, model, dispatch }: ModelEditorProps) {
  const isConcave = model.geometryMode === "concave";

  return (
    <PanelSection title={title} eyebrow="Geometry / Optics / Atmosphere">
      <label className="field">
        <span>Geometry</span>
        <select
          value={model.geometryMode}
          onChange={(event) =>
            dispatch({
              type: "setModelField",
              target,
              key: "geometryMode",
              value: event.target.value,
            })
          }
        >
          <option value="convex">Convex Sphere</option>
          <option value="concave">Concave Shell</option>
        </select>
      </label>

      <label className="field">
        <span>Intrinsic curvature</span>
        <select
          value={model.intrinsicCurvatureMode}
          disabled={!isConcave}
          onChange={(event) =>
            dispatch({
              type: "setModelField",
              target,
              key: "intrinsicCurvatureMode",
              value: event.target.value,
            })
          }
        >
          <option value="none">None</option>
          <option value="1/R">1 / R</option>
          <option value="2/R">2 / R</option>
          <option value="constant">Custom constant</option>
        </select>
      </label>

      {isConcave && model.intrinsicCurvatureMode === "constant" ? (
        <label className="field">
          <span>Custom intrinsic curvature</span>
          <input
            type="number"
            step="0.00000001"
            value={model.intrinsicCurvaturePerM}
            onChange={(event) =>
              dispatch({
                type: "setModelField",
                target,
                key: "intrinsicCurvaturePerM",
                value: Number(event.target.value),
              })
            }
          />
        </label>
      ) : null}

      <label className="field">
        <span>Atmosphere</span>
        <select
          value={model.atmosphere.mode}
          onChange={(event) =>
            dispatch({
              type: "setAtmosphereField",
              target,
              key: "mode",
              value: event.target.value,
            })
          }
        >
          <option value="none">None</option>
          <option value="simpleCoefficient">Simple coefficient</option>
        </select>
      </label>

      {model.atmosphere.mode === "simpleCoefficient" ? (
        <NumberField
          label="Atmospheric coefficient"
          value={model.atmosphere.coefficient}
          min={0}
          max={0.5}
          step={0.01}
          suffix="k"
          onChange={(value) =>
            dispatch({
              type: "setAtmosphereField",
              target,
              key: "coefficient",
              value,
            })
          }
        />
      ) : null}
    </PanelSection>
  );
}

export function ControlsPanel({
  state,
  dispatch,
  onExport,
  onCopyLink,
}: ControlsPanelProps) {
  const presetDefaults = getPresetById(state.scenario.presetId).scenario;
  const setScenarioValue = <K extends keyof ScenarioInput>(
    key: K,
    value: ScenarioInput[K],
  ) => {
    dispatch({ type: "setScenarioField", key, value });
  };

  return (
    <aside className="left-panel panel">
      <div className="panel__intro">
        <p className="panel__eyebrow">Observation Geometry Lab</p>
        <h1>Comparison-first observation simulator</h1>
        <p>
          One shared ray engine drives both the convex baseline and the concave
          shell interpretation.
        </p>
      </div>

      <PanelSection title="Scenario" eyebrow="Observation inputs">
        <label className="field">
          <div className="field__label-row">
            <span>Preset</span>
            <button
              type="button"
              className="field__reset"
              onClick={() =>
                startTransition(() =>
                  dispatch({ type: "applyPreset", presetId: state.scenario.presetId }),
                )
              }
            >
              Restore all
            </button>
          </div>
          <select
            value={state.scenario.presetId}
            onChange={(event) =>
              startTransition(() =>
                dispatch({ type: "applyPreset", presetId: event.target.value }),
              )
            }
          >
            {scenarioPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>

        <NumberField
          label="Observer height"
          value={state.scenario.observerHeightM}
          min={1}
          max={40000}
          step={10}
          suffix="m"
          resetValue={presetDefaults.observerHeightM}
          onReset={() => setScenarioValue("observerHeightM", presetDefaults.observerHeightM)}
          onChange={(value) => setScenarioValue("observerHeightM", value)}
        />
        <NumberField
          label="Target height"
          value={state.scenario.targetHeightM}
          min={1}
          max={20000}
          step={10}
          suffix="m"
          resetValue={presetDefaults.targetHeightM}
          onReset={() => setScenarioValue("targetHeightM", presetDefaults.targetHeightM)}
          onChange={(value) => setScenarioValue("targetHeightM", value)}
        />
        <NumberField
          label="Surface distance"
          value={state.scenario.surfaceDistanceM}
          min={1000}
          max={1000000}
          step={1000}
          suffix="m"
          resetValue={presetDefaults.surfaceDistanceM}
          onReset={() => setScenarioValue("surfaceDistanceM", presetDefaults.surfaceDistanceM)}
          onChange={(value) => setScenarioValue("surfaceDistanceM", value)}
        />
        <NumberField
          label="Shell / sphere radius"
          value={state.scenario.radiusM}
          min={3000000}
          max={9000000}
          step={1000}
          suffix="m"
          resetValue={presetDefaults.radiusM}
          onReset={() => setScenarioValue("radiusM", presetDefaults.radiusM)}
          onChange={(value) => setScenarioValue("radiusM", value)}
        />
        <NumberField
          label="Target samples"
          value={state.scenario.targetSampleCount}
          min={8}
          max={36}
          step={1}
          suffix="pts"
          resetValue={presetDefaults.targetSampleCount}
          onReset={() =>
            setScenarioValue("targetSampleCount", presetDefaults.targetSampleCount)
          }
          onChange={(value) => setScenarioValue("targetSampleCount", value)}
        />
      </PanelSection>

      <PanelSection title="View" eyebrow="Presentation">
        <ViewPills
          value={state.viewMode}
          options={[
            { label: "Cross-section", value: "cross-section" },
            { label: "Split Compare", value: "compare" },
          ]}
          onChange={(value) =>
            dispatch({ type: "setViewMode", value: value as ViewMode })
          }
        />

        {state.viewMode === "cross-section" ? (
          <>
            <p className="field__hint">Single-panel model</p>
            <ViewPills
              value={state.focusedModel}
              options={[
                { label: "Primary", value: "primary" },
                { label: "Comparison", value: "comparison" },
              ]}
              onChange={(value) =>
                dispatch({ type: "setFocusedModel", value: value as FocusedModel })
              }
            />
          </>
        ) : (
          <p className="field__hint">
            Split compare mode always shows both models side by side.
          </p>
        )}

        <label className="switch">
          <input
            type="checkbox"
            checked={state.annotated}
            onChange={(event) =>
              dispatch({ type: "setAnnotated", value: event.target.checked })
            }
          />
          <span>Annotated mode</span>
        </label>

        <label className="switch">
          <input
            type="checkbox"
            checked={state.showScaleGuides}
            onChange={(event) =>
              dispatch({ type: "setShowScaleGuides", value: event.target.checked })
            }
          />
          <span>Scale guides</span>
        </label>

        <label className="switch">
          <input
            type="checkbox"
            checked={state.showTerrainOverlay}
            onChange={(event) =>
              dispatch({ type: "setShowTerrainOverlay", value: event.target.checked })
            }
          />
          <span>Profile overlay</span>
        </label>

        <p className="field__hint">
          Fine-tune framing from the scene toolbar in the center panel.
        </p>
      </PanelSection>

      <ModelEditor
        title="Primary Model"
        target="primary"
        model={state.primaryModel}
        dispatch={dispatch}
      />

      <ModelEditor
        title="Comparison Model"
        target="comparison"
        model={state.comparisonModel}
        dispatch={dispatch}
      />

      <PanelSection title="Export" eyebrow="Shareable state">
        <div className="action-row">
          <button type="button" className="action-button" onClick={onExport}>
            Export PNG
          </button>
          <button type="button" className="action-button action-button--ghost" onClick={onCopyLink}>
            Copy Share URL
          </button>
        </div>
      </PanelSection>
    </aside>
  );
}
