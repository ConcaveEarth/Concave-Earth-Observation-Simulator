import { startTransition } from "react";
import type { Dispatch } from "react";
import { getPresetById, scenarioPresets } from "../../domain/presets";
import {
  distanceUnitToMeters,
  getDisplayStepMeters,
  getUnitLabel,
  heightUnitToMeters,
  metersToDistanceUnit,
  metersToHeightUnit,
  roundTo,
} from "../../domain/units";
import type { DistanceUnit, HeightUnit, RadiusUnit } from "../../domain/units";
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
  sectionId?: string;
}

function NumberField({
  label,
  value,
  step,
  min,
  max,
  unit,
  unitOptions,
  onUnitChange,
  resetValue,
  onReset,
  onChange,
  toDisplayValue,
  toBaseValue,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max?: number;
  unit: string;
  unitOptions?: Array<{ label: string; value: string }>;
  onUnitChange?: (value: string) => void;
  resetValue?: number;
  onReset?: () => void;
  onChange: (value: number) => void;
  toDisplayValue?: (value: number, unit: string) => number;
  toBaseValue?: (value: number, unit: string) => number;
}) {
  const displayFromBase =
    toDisplayValue ?? ((baseValue: number) => baseValue);
  const baseFromDisplay =
    toBaseValue ?? ((displayValue: number) => displayValue);
  const displayedValue = displayFromBase(value, unit);
  const displayedMin = displayFromBase(min, unit);
  const displayedMax = max == null ? undefined : displayFromBase(max, unit);
  const displayedStep = Math.max(
    getDisplayStepMeters(step, unit as DistanceUnit | HeightUnit | RadiusUnit),
    unit === "m" || unit === "ft" ? 0.1 : 0.01,
  );
  const displayedSliderStep =
    unit === "pts" || unit === "k"
      ? step
      : Math.max(
          displayedStep / 10,
          unit === "m" || unit === "ft" ? 0.1 : 0.01,
        );
  const sliderDecimals =
    displayedSliderStep >= 10 ? 0 : displayedSliderStep >= 1 ? 1 : displayedSliderStep >= 0.1 ? 2 : 3;

  const clampBaseValue = (nextValue: number) =>
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, nextValue));

  const updateFromDisplay = (nextDisplayedValue: number) => {
    onChange(clampBaseValue(baseFromDisplay(nextDisplayedValue, unit)));
  };

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
      <div className="field__slider-row">
        <button
          type="button"
          className="field__stepper"
          onClick={() => updateFromDisplay(displayedValue - displayedSliderStep)}
          disabled={displayedValue <= displayedMin}
          aria-label={`Decrease ${label}`}
        >
          -
        </button>
        <input
          type="range"
          min={displayedMin}
          max={displayedMax}
          step={displayedSliderStep}
          value={roundTo(displayedValue, sliderDecimals)}
          onChange={(event) => updateFromDisplay(Number(event.target.value))}
        />
        <button
          type="button"
          className="field__stepper"
          onClick={() => updateFromDisplay(displayedValue + displayedSliderStep)}
          disabled={displayedMax == null ? false : displayedValue >= displayedMax}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
      <div className="field__value-row">
        <div className="field__value">
          <input
            type="number"
            min={displayedMin}
            max={displayedMax}
            step={displayedStep}
            value={roundTo(displayedValue, displayedStep >= 1 ? 2 : 3)}
            onChange={(event) => updateFromDisplay(Number(event.target.value))}
          />
          {unitOptions && onUnitChange ? (
            <select
              className="field__unit-select"
              value={unit}
              onChange={(event) => onUnitChange(event.target.value)}
            >
              {unitOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <span>{getUnitLabel(unit as DistanceUnit | HeightUnit | RadiusUnit)}</span>
          )}
        </div>
        <span className="field__microcopy">
          Drag for sweep, use +/- for fine adjustment.
        </span>
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

function ModelEditor({
  title,
  target,
  model,
  dispatch,
  sectionId,
}: ModelEditorProps) {
  const isConcave = model.geometryMode === "concave";

  return (
    <PanelSection
      title={title}
      eyebrow="Geometry / Optics / Atmosphere"
      sectionId={sectionId}
    >
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
          unit="k"
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
  const heightUnitOptions = [
    { label: "m", value: "m" },
    { label: "ft", value: "ft" },
  ] as const;
  const distanceUnitOptions = [
    { label: "m", value: "m" },
    { label: "km", value: "km" },
    { label: "ft", value: "ft" },
    { label: "mi", value: "mi" },
  ] as const;
  const radiusUnitOptions = [
    { label: "km", value: "km" },
    { label: "mi", value: "mi" },
  ] as const;
  const controlSections = [
    { label: "Scenario", target: "control-scenario" },
    { label: "View", target: "control-view" },
    { label: "Primary", target: "control-primary-model" },
    { label: "Compare", target: "control-comparison-model" },
    { label: "Export", target: "control-export" },
  ] as const;
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

      <div className="controls-dock">
        <div className="controls-dock__nav">
          <p className="controls-dock__eyebrow">Quick Jump</p>
          <div className="controls-dock__nav-grid">
            {controlSections.map((section) => (
              <a
                key={section.target}
                className="controls-dock__link"
                href={`#${section.target}`}
              >
                {section.label}
              </a>
            ))}
          </div>
          <p className="field__hint">
            Scroll the controls dock independently while the main scene stays in view.
          </p>
        </div>

      <PanelSection
        title="Scenario"
        eyebrow="Observation inputs"
        sectionId="control-scenario"
      >
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
          unit={state.unitPreferences.height}
          unitOptions={[...heightUnitOptions]}
          onUnitChange={(value) =>
            dispatch({
              type: "setUnitPreference",
              key: "height",
              value: value as HeightUnit,
            })
          }
          resetValue={presetDefaults.observerHeightM}
          onReset={() => setScenarioValue("observerHeightM", presetDefaults.observerHeightM)}
          toDisplayValue={(baseValue, unit) =>
            metersToHeightUnit(baseValue, unit as HeightUnit)
          }
          toBaseValue={(displayValue, unit) =>
            heightUnitToMeters(displayValue, unit as HeightUnit)
          }
          onChange={(value) => setScenarioValue("observerHeightM", value)}
        />
        <NumberField
          label="Target height"
          value={state.scenario.targetHeightM}
          min={1}
          max={20000}
          step={10}
          unit={state.unitPreferences.height}
          unitOptions={[...heightUnitOptions]}
          onUnitChange={(value) =>
            dispatch({
              type: "setUnitPreference",
              key: "height",
              value: value as HeightUnit,
            })
          }
          resetValue={presetDefaults.targetHeightM}
          onReset={() => setScenarioValue("targetHeightM", presetDefaults.targetHeightM)}
          toDisplayValue={(baseValue, unit) =>
            metersToHeightUnit(baseValue, unit as HeightUnit)
          }
          toBaseValue={(displayValue, unit) =>
            heightUnitToMeters(displayValue, unit as HeightUnit)
          }
          onChange={(value) => setScenarioValue("targetHeightM", value)}
        />
        <NumberField
          label="Surface distance"
          value={state.scenario.surfaceDistanceM}
          min={1000}
          max={1000000}
          step={1000}
          unit={state.unitPreferences.distance}
          unitOptions={[...distanceUnitOptions]}
          onUnitChange={(value) =>
            dispatch({
              type: "setUnitPreference",
              key: "distance",
              value: value as DistanceUnit,
            })
          }
          resetValue={presetDefaults.surfaceDistanceM}
          onReset={() => setScenarioValue("surfaceDistanceM", presetDefaults.surfaceDistanceM)}
          toDisplayValue={(baseValue, unit) =>
            metersToDistanceUnit(baseValue, unit as DistanceUnit)
          }
          toBaseValue={(displayValue, unit) =>
            distanceUnitToMeters(displayValue, unit as DistanceUnit)
          }
          onChange={(value) => setScenarioValue("surfaceDistanceM", value)}
        />
        <NumberField
          label="Shell / sphere radius"
          value={state.scenario.radiusM}
          min={3000000}
          max={9000000}
          step={1000}
          unit={state.unitPreferences.radius}
          unitOptions={[...radiusUnitOptions]}
          onUnitChange={(value) =>
            dispatch({
              type: "setUnitPreference",
              key: "radius",
              value: value as RadiusUnit,
            })
          }
          resetValue={presetDefaults.radiusM}
          onReset={() => setScenarioValue("radiusM", presetDefaults.radiusM)}
          toDisplayValue={(baseValue, unit) =>
            metersToDistanceUnit(baseValue, unit as RadiusUnit)
          }
          toBaseValue={(displayValue, unit) =>
            distanceUnitToMeters(displayValue, unit as RadiusUnit)
          }
          onChange={(value) => setScenarioValue("radiusM", value)}
        />
        <NumberField
          label="Target samples"
          value={state.scenario.targetSampleCount}
          min={8}
          max={36}
          step={1}
          unit="pts"
          resetValue={presetDefaults.targetSampleCount}
          onReset={() =>
            setScenarioValue("targetSampleCount", presetDefaults.targetSampleCount)
          }
          onChange={(value) => setScenarioValue("targetSampleCount", value)}
        />
      </PanelSection>

      <PanelSection title="View" eyebrow="Presentation" sectionId="control-view">
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
          <>
            <p className="field__hint">
              Split compare can auto-fit side-by-side or stacked layouts depending on the workspace.
            </p>
            <label className="field">
              <span>Compare layout</span>
              <select
                value={state.sceneViewport.compareLayout}
                onChange={(event) =>
                  dispatch({
                    type: "setViewportField",
                    key: "compareLayout",
                    value: event.target.value,
                  })
                }
              >
                <option value="auto">Auto</option>
                <option value="side-by-side">Side by side</option>
                <option value="stacked">Stacked</option>
              </select>
            </label>
          </>
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

        <label className="field">
          <span>Label density</span>
          <select
            value={state.labelDensity}
            onChange={(event) =>
              dispatch({
                type: "setLabelDensity",
                value: event.target.value as AppState["labelDensity"],
              })
            }
          >
            <option value="adaptive">Adaptive</option>
            <option value="full">Full</option>
          </select>
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
          Fine-tune framing, scale, and fullscreen from the scene toolbar in the center panel.
        </p>
      </PanelSection>

      <ModelEditor
        title="Primary Model"
        target="primary"
        model={state.primaryModel}
        dispatch={dispatch}
        sectionId="control-primary-model"
      />

      <ModelEditor
        title="Comparison Model"
        target="comparison"
        model={state.comparisonModel}
        dispatch={dispatch}
        sectionId="control-comparison-model"
      />

      <PanelSection
        title="Export"
        eyebrow="Shareable state"
        sectionId="control-export"
      >
        <div className="action-row">
          <button type="button" className="action-button" onClick={onExport}>
            Export PNG
          </button>
          <button type="button" className="action-button action-button--ghost" onClick={onCopyLink}>
            Copy Share URL
          </button>
        </div>
      </PanelSection>
      </div>
    </aside>
  );
}
