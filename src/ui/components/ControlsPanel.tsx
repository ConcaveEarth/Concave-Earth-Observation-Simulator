import { startTransition, useEffect, useMemo, useState } from "react";
import type { Dispatch } from "react";
import {
  ATMOSPHERE_COEFFICIENT_MAX,
  ATMOSPHERE_COEFFICIENT_MIN,
} from "../../domain/curvature";
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
import { getPresetName, t, type LanguageMode } from "../../i18n";
import type {
  FocusedModel,
  ModelConfig,
  ScenarioInput,
  ViewMode,
} from "../../domain/types";
import type { AnalysisTab, SweepMetric, SweepParameter, SweepRangeMode } from "../../domain/analysis";
import type { AppAction, AppState } from "../../state/appState";
import { PanelSection } from "./PanelSection";

interface ControlsPanelProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  onExport: () => void;
  onCopyLink: () => void;
  language: LanguageMode;
}

interface ModelEditorProps {
  title: string;
  target: FocusedModel;
  model: ModelConfig;
  dispatch: Dispatch<AppAction>;
  sectionId?: string;
  language: LanguageMode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

function formatInputValue(value: number, decimals: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  return String(roundTo(value, decimals));
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
  language,
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
  language: LanguageMode;
}) {
  const displayFromBase = toDisplayValue ?? ((baseValue: number) => baseValue);
  const baseFromDisplay = toBaseValue ?? ((displayValue: number) => displayValue);
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
    displayedSliderStep >= 10
      ? 0
      : displayedSliderStep >= 1
        ? 1
        : displayedSliderStep >= 0.1
          ? 2
          : 3;
  const inputDecimals =
    unit === "pts" ? 0 : displayedStep >= 10 ? 0 : displayedStep >= 1 ? 2 : 3;
  const formattedDisplayedValue = useMemo(
    () => formatInputValue(displayedValue, inputDecimals),
    [displayedValue, inputDecimals],
  );
  const [draftValue, setDraftValue] = useState(formattedDisplayedValue);

  useEffect(() => {
    setDraftValue(formattedDisplayedValue);
  }, [formattedDisplayedValue]);

  const clampBaseValue = (nextValue: number) =>
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, nextValue));

  const updateFromDisplay = (nextDisplayedValue: number) => {
    if (!Number.isFinite(nextDisplayedValue)) {
      return;
    }

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
            {t(language, "reset")}
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
            type="text"
            inputMode="decimal"
            value={draftValue}
            onChange={(event) => {
              const nextDraft = event.target.value;
              setDraftValue(nextDraft);
              const parsed = Number(nextDraft.replace(",", "."));

              if (Number.isFinite(parsed)) {
                updateFromDisplay(parsed);
              }
            }}
            onBlur={() => setDraftValue(formattedDisplayedValue)}
            aria-label={`${label} value`}
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
        <span className="field__microcopy">{t(language, "dragMicrocopy")}</span>
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
  language,
  collapsible,
  collapsed,
  onToggleCollapsed,
}: ModelEditorProps) {
  const isConcave = model.geometryMode === "concave";

  return (
    <PanelSection
      title={title}
      eyebrow={t(language, "geometryOpticsAtmosphere")}
      sectionId={sectionId}
      collapsible={collapsible}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
    >
      <label className="field">
        <span>{t(language, "geometry")}</span>
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
          <option value="convex">{t(language, "convexSphere")}</option>
          <option value="concave">{t(language, "concaveShell")}</option>
        </select>
      </label>

      <label className="field">
        <span>{t(language, "intrinsicCurvature")}</span>
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
          <option value="none">{t(language, "none")}</option>
          <option value="1/R">1 / R</option>
          <option value="2/R">2 / R</option>
          <option value="constant">{t(language, "customConstant")}</option>
        </select>
      </label>

      {isConcave && model.intrinsicCurvatureMode === "constant" ? (
        <label className="field">
          <span>{t(language, "customConstant")}</span>
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
        <span>{t(language, "atmosphere")}</span>
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
          <option value="none">{t(language, "none")}</option>
          <option value="simpleCoefficient">{t(language, "simpleCoefficient")}</option>
        </select>
      </label>

      {model.atmosphere.mode === "simpleCoefficient" ? (
        <>
          <NumberField
            label={t(language, "atmosphericCoefficient")}
            value={model.atmosphere.coefficient}
            min={ATMOSPHERE_COEFFICIENT_MIN}
            max={ATMOSPHERE_COEFFICIENT_MAX}
            step={0.01}
            unit="k"
            language={language}
            onChange={(value) =>
              dispatch({
                type: "setAtmosphereField",
                target,
                key: "coefficient",
                value,
              })
            }
          />
          <p className="field__hint">{t(language, "atmosphereHint")}</p>
        </>
      ) : null}
    </PanelSection>
  );
}

export function ControlsPanel({
  state,
  dispatch,
  onExport,
  onCopyLink,
  language,
}: ControlsPanelProps) {
  const [collapsedSections, setCollapsedSections] = useState({
    view: false,
    scenario: false,
    model1: false,
    model2: false,
    export: false,
  });
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
    { label: t(language, "view"), target: "control-view" },
    { label: t(language, "scenario"), target: "control-scenario" },
    { label: t(language, "primary"), target: "control-primary-model" },
    { label: t(language, "compare"), target: "control-comparison-model" },
    { label: t(language, "export"), target: "control-export" },
  ] as const;
  const presetDefaults = getPresetById(state.scenario.presetId).scenario;
  const setScenarioValue = <K extends keyof ScenarioInput>(
    key: K,
    value: ScenarioInput[K],
  ) => {
    dispatch({ type: "setScenarioField", key, value });
  };
  const toggleSection = (key: keyof typeof collapsedSections) =>
    setCollapsedSections((current) => ({ ...current, [key]: !current[key] }));

  return (
    <aside className="left-panel panel">
      <div className="panel__intro">
        <p className="panel__eyebrow">{t(language, "appEyebrow")}</p>
        <h1>{t(language, "panelIntroTitle")}</h1>
        <p>{t(language, "panelIntroBody")}</p>
      </div>

      <div className="controls-dock">
        <div className="controls-dock__nav">
          <p className="controls-dock__eyebrow">{t(language, "quickJump")}</p>
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
          <p className="field__hint">{t(language, "quickJumpHint")}</p>
        </div>

        <PanelSection
          title={t(language, "view")}
          eyebrow={t(language, "presentation")}
          sectionId="control-view"
          collapsible
          collapsed={collapsedSections.view}
          onToggleCollapsed={() => toggleSection("view")}
        >
          <label className="field">
            <span>{t(language, "analysisView")}</span>
            <ViewPills
              value={state.analysisTab}
              options={[
                { label: t(language, "crossSection"), value: "cross-section" },
                { label: t(language, "rayBundle"), value: "ray-bundle" },
                { label: t(language, "sweep"), value: "sweep" },
              ]}
              onChange={(value) =>
                dispatch({ type: "setAnalysisTab", value: value as AnalysisTab })
              }
            />
          </label>

          <label className="field">
            <span>{t(language, "panelLayout")}</span>
            <ViewPills
              value={state.viewMode}
              options={[
                { label: t(language, "singlePanel"), value: "cross-section" },
                { label: t(language, "splitCompare"), value: "compare" },
              ]}
              onChange={(value) =>
                dispatch({ type: "setViewMode", value: value as ViewMode })
              }
            />
          </label>

          {state.analysisTab === "cross-section" ? (
            <p className="field__hint">{t(language, "centerLayoutHint")}</p>
          ) : state.analysisTab === "ray-bundle" ? (
            <p className="field__hint">{t(language, "rayBundleIntro")}</p>
          ) : (
            <p className="field__hint">{t(language, "sweepIntro")}</p>
          )}

          {state.analysisTab === "sweep" ? (
            <>
              <label className="field">
                <span>{t(language, "sweepParameter")}</span>
                <select
                  value={state.sweepConfig.parameter}
                  onChange={(event) =>
                    dispatch({
                      type: "setSweepField",
                      key: "parameter",
                      value: event.target.value as SweepParameter,
                    })
                  }
                >
                  <option value="distance">{t(language, "distanceParameter")}</option>
                  <option value="observerHeight">{t(language, "observerHeightParameter")}</option>
                  <option value="targetHeight">{t(language, "targetHeightParameter")}</option>
                  <option value="atmosphere">{t(language, "atmosphereParameter")}</option>
                </select>
              </label>

              <label className="field">
                <span>{t(language, "sweepMetric")}</span>
                <select
                  value={state.sweepConfig.metric}
                  onChange={(event) =>
                    dispatch({
                      type: "setSweepField",
                      key: "metric",
                      value: event.target.value as SweepMetric,
                    })
                  }
                >
                  <option value="hiddenHeight">{t(language, "hiddenHeightMetric")}</option>
                  <option value="visibilityFraction">
                    {t(language, "visibilityFractionMetric")}
                  </option>
                  <option value="apparentElevation">
                    {t(language, "apparentElevationMetric")}
                  </option>
                  <option value="opticalHorizon">{t(language, "opticalHorizonMetric")}</option>
                </select>
              </label>

              <label className="field">
                <span>{t(language, "sweepRange")}</span>
                <select
                  value={state.sweepConfig.rangeMode}
                  onChange={(event) =>
                    dispatch({
                      type: "setSweepField",
                      key: "rangeMode",
                      value: event.target.value as SweepRangeMode,
                    })
                  }
                >
                  <option value="focused">{t(language, "focused")}</option>
                  <option value="operational">{t(language, "operational")}</option>
                  <option value="wide">{t(language, "wide")}</option>
                </select>
              </label>

              <NumberField
                label={t(language, "sweepResolution")}
                value={state.sweepConfig.sampleCount}
                min={8}
                max={80}
                step={1}
                unit="pts"
                language={language}
                onChange={(value) =>
                  dispatch({
                    type: "setSweepField",
                    key: "sampleCount",
                    value: Math.round(value),
                  })
                }
              />
            </>
          ) : null}

          {state.viewMode === "cross-section" ? (
            <>
              <p className="field__hint">{t(language, "singlePanelModel")}</p>
              <ViewPills
                value={state.focusedModel}
                options={[
                  { label: t(language, "primaryModelShort"), value: "primary" },
                  { label: t(language, "comparisonModelShort"), value: "comparison" },
                ]}
                onChange={(value) =>
                  dispatch({ type: "setFocusedModel", value: value as FocusedModel })
                }
              />
            </>
          ) : (
            <label className="field">
              <span>{t(language, "compareLayout")}</span>
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
                <option value="auto">{t(language, "auto")}</option>
                <option value="side-by-side">{t(language, "sideBySide")}</option>
                <option value="stacked">{t(language, "stacked")}</option>
              </select>
            </label>
          )}

          {state.viewMode === "compare" ? (
            <label className="switch">
              <input
                type="checkbox"
                checked={state.sceneViewport.compareLayout === "stacked"}
                onChange={(event) =>
                  dispatch({
                    type: "setViewportField",
                    key: "compareLayout",
                    value: event.target.checked ? "stacked" : "side-by-side",
                  })
                }
              />
              <span>{t(language, "stackComparePanels")}</span>
            </label>
          ) : null}

          {state.analysisTab === "cross-section" ? (
            <>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={state.annotated}
                  onChange={(event) =>
                    dispatch({ type: "setAnnotated", value: event.target.checked })
                  }
                />
                <span>{t(language, "annotatedMode")}</span>
              </label>

              <label className="field">
                <span>{t(language, "labelDensity")}</span>
                <select
                  value={state.labelDensity}
                  onChange={(event) =>
                    dispatch({
                      type: "setLabelDensity",
                      value: event.target.value as AppState["labelDensity"],
                    })
                  }
                >
                  <option value="adaptive">{t(language, "adaptive")}</option>
                  <option value="full">{t(language, "full")}</option>
                </select>
              </label>
            </>
          ) : null}

          {state.analysisTab !== "sweep" ? (
            <label className="switch">
              <input
                type="checkbox"
                checked={state.showScaleGuides}
                onChange={(event) =>
                  dispatch({ type: "setShowScaleGuides", value: event.target.checked })
                }
              />
              <span>{t(language, "scaleGuides")}</span>
            </label>
          ) : null}

          {state.analysisTab === "cross-section" ? (
            <label className="switch">
              <input
                type="checkbox"
                checked={state.showTerrainOverlay}
                onChange={(event) =>
                  dispatch({ type: "setShowTerrainOverlay", value: event.target.checked })
                }
              />
              <span>{t(language, "profileOverlay")}</span>
            </label>
          ) : null}

          <p className="field__hint">{t(language, "centerLayoutHint")}</p>
        </PanelSection>

        <PanelSection
          title={t(language, "scenario")}
          eyebrow={t(language, "observationInputs")}
          sectionId="control-scenario"
          collapsible
          collapsed={collapsedSections.scenario}
          onToggleCollapsed={() => toggleSection("scenario")}
        >
          <label className="field">
            <div className="field__label-row">
              <span>{t(language, "preset")}</span>
              <button
                type="button"
                className="field__reset"
                onClick={() =>
                  startTransition(() =>
                    dispatch({ type: "applyPreset", presetId: state.scenario.presetId }),
                  )
                }
              >
                {t(language, "restoreAll")}
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
                  {getPresetName(language, preset)}
                </option>
              ))}
            </select>
          </label>

          <NumberField
            label={t(language, "observerHeight")}
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
            toDisplayValue={(baseValue, nextUnit) =>
              metersToHeightUnit(baseValue, nextUnit as HeightUnit)
            }
            toBaseValue={(displayValue, nextUnit) =>
              heightUnitToMeters(displayValue, nextUnit as HeightUnit)
            }
            onChange={(nextValue) => setScenarioValue("observerHeightM", nextValue)}
            language={language}
          />
          <NumberField
            label={t(language, "targetHeight")}
            value={state.scenario.targetHeightM}
            min={0}
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
            toDisplayValue={(baseValue, nextUnit) =>
              metersToHeightUnit(baseValue, nextUnit as HeightUnit)
            }
            toBaseValue={(displayValue, nextUnit) =>
              heightUnitToMeters(displayValue, nextUnit as HeightUnit)
            }
            onChange={(nextValue) => setScenarioValue("targetHeightM", nextValue)}
            language={language}
          />
          <NumberField
            label={t(language, "surfaceDistance")}
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
            toDisplayValue={(baseValue, nextUnit) =>
              metersToDistanceUnit(baseValue, nextUnit as DistanceUnit)
            }
            toBaseValue={(displayValue, nextUnit) =>
              distanceUnitToMeters(displayValue, nextUnit as DistanceUnit)
            }
            onChange={(nextValue) => setScenarioValue("surfaceDistanceM", nextValue)}
            language={language}
          />
          <NumberField
            label={t(language, "shellSphereRadius")}
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
            toDisplayValue={(baseValue, nextUnit) =>
              metersToDistanceUnit(baseValue, nextUnit as RadiusUnit)
            }
            toBaseValue={(displayValue, nextUnit) =>
              distanceUnitToMeters(displayValue, nextUnit as RadiusUnit)
            }
            onChange={(nextValue) => setScenarioValue("radiusM", nextValue)}
            language={language}
          />
          <NumberField
            label={t(language, "targetSamples")}
            value={state.scenario.targetSampleCount}
            min={8}
            max={36}
            step={1}
            unit="pts"
            resetValue={presetDefaults.targetSampleCount}
            onReset={() =>
              setScenarioValue("targetSampleCount", presetDefaults.targetSampleCount)
            }
            onChange={(nextValue) => setScenarioValue("targetSampleCount", nextValue)}
            language={language}
          />
        </PanelSection>

        <ModelEditor
          title={t(language, "primaryModelTitle")}
          target="primary"
          model={state.primaryModel}
          dispatch={dispatch}
          sectionId="control-primary-model"
          language={language}
          collapsible
          collapsed={collapsedSections.model1}
          onToggleCollapsed={() => toggleSection("model1")}
        />

        <ModelEditor
          title={t(language, "comparisonModelTitle")}
          target="comparison"
          model={state.comparisonModel}
          dispatch={dispatch}
          sectionId="control-comparison-model"
          language={language}
          collapsible
          collapsed={collapsedSections.model2}
          onToggleCollapsed={() => toggleSection("model2")}
        />

        <PanelSection
          title={t(language, "export")}
          eyebrow={t(language, "shareableState")}
          sectionId="control-export"
          collapsible
          collapsed={collapsedSections.export}
          onToggleCollapsed={() => toggleSection("export")}
        >
          <div className="action-row">
            <button type="button" className="action-button" onClick={onExport}>
              {t(language, "exportPng")}
            </button>
            <button
              type="button"
              className="action-button action-button--ghost"
              onClick={onCopyLink}
            >
              {t(language, "copyShareUrl")}
            </button>
          </div>
        </PanelSection>
      </div>
    </aside>
  );
}
