import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch } from "react";
import {
  ATMOSPHERE_COEFFICIENT_MAX,
  ATMOSPHERE_COEFFICIENT_MIN,
} from "../../domain/curvature";
import { getGreatCircleRouteMetrics } from "../../domain/geodesy";
import { getPresetById, scenarioPresets } from "../../domain/presets";
import {
  getObserverTotalHeightM,
  getTargetTopElevationM,
} from "../../domain/scenario";
import {
  distanceUnitToMeters,
  formatDistance,
  formatAngle,
  formatHeight,
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
  ScenarioMode,
} from "../../domain/types";
import type { AppAction, AppState } from "../../state/appState";
import { PanelSection } from "./PanelSection";
import { PanelScrollArea } from "./PanelScrollArea";

interface ControlsPanelProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  onExport: () => void;
  onExportJson: () => void;
  onExportReport: () => void;
  onCopyLink: () => void;
  language: LanguageMode;
}

interface ModelEditorProps {
  title: string;
  target: FocusedModel;
  model: ModelConfig;
  unitPreferences: AppState["unitPreferences"];
  dispatch: Dispatch<AppAction>;
  sectionId?: string;
  language: LanguageMode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const heightUnitOptions = [
  { label: "m", value: "m" },
  { label: "ft", value: "ft" },
] as const;

function formatInputValue(value: number, decimals: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  return roundTo(value, decimals).toLocaleString("en-US", {
    useGrouping: false,
    maximumFractionDigits: Math.max(0, decimals),
  });
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
  disabled,
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
  disabled?: boolean;
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
    unit === "pts"
      ? 0
      : unit === "ft" || unit === "m"
        ? 2
        : unit === "mi" || unit === "km"
          ? 3
          : 2;
  const formattedDisplayedValue = useMemo(
    () => formatInputValue(displayedValue, inputDecimals),
    [displayedValue, inputDecimals],
  );
  const [draftValue, setDraftValue] = useState(formattedDisplayedValue);
  const sliderFrameRef = useRef<number | null>(null);
  const sliderPendingValueRef = useRef<number | null>(null);

  useEffect(() => {
    setDraftValue(formattedDisplayedValue);
  }, [formattedDisplayedValue]);

  useEffect(
    () => () => {
      if (sliderFrameRef.current != null) {
        cancelAnimationFrame(sliderFrameRef.current);
      }
    },
    [],
  );

  const clampBaseValue = (nextValue: number) =>
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, nextValue));

  const commitFromDisplay = (nextDisplayedValue: number) => {
    if (!Number.isFinite(nextDisplayedValue)) {
      return;
    }

    startTransition(() => {
      onChange(clampBaseValue(baseFromDisplay(nextDisplayedValue, unit)));
    });
  };

  const scheduleFromDisplay = (nextDisplayedValue: number) => {
    if (!Number.isFinite(nextDisplayedValue)) {
      return;
    }

    sliderPendingValueRef.current = nextDisplayedValue;

    if (sliderFrameRef.current != null) {
      return;
    }

    sliderFrameRef.current = requestAnimationFrame(() => {
      sliderFrameRef.current = null;
      const pendingValue = sliderPendingValueRef.current;
      sliderPendingValueRef.current = null;

      if (pendingValue != null) {
        commitFromDisplay(pendingValue);
      }
    });
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
            disabled={disabled || resetValue === value}
          >
            {t(language, "reset")}
          </button>
        ) : null}
      </div>
      <div className="field__slider-row">
        <button
          type="button"
          className="field__stepper"
          onClick={() => commitFromDisplay(displayedValue - displayedSliderStep)}
          disabled={disabled || displayedValue <= displayedMin}
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
          disabled={disabled}
          onChange={(event) => scheduleFromDisplay(Number(event.target.value))}
        />
        <button
          type="button"
          className="field__stepper"
          onClick={() => commitFromDisplay(displayedValue + displayedSliderStep)}
          disabled={disabled || (displayedMax == null ? false : displayedValue >= displayedMax)}
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
            style={{ width: `${Math.max(6, draftValue.length + 1)}ch` }}
            disabled={disabled}
            onChange={(event) => {
              const nextDraft = event.target.value;
              setDraftValue(nextDraft);
              const parsed = Number(nextDraft.replace(",", "."));

              if (Number.isFinite(parsed)) {
                commitFromDisplay(parsed);
              }
            }}
            onBlur={() => setDraftValue(formattedDisplayedValue)}
            aria-label={`${label} value`}
          />
          {unitOptions && onUnitChange ? (
            <select
              className="field__unit-select"
              value={unit}
              disabled={disabled}
              onChange={(event) => onUnitChange(event.target.value)}
            >
              {unitOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <span>
              {unit === "pts" || unit === "k" || unit === "°"
                ? unit
                : getUnitLabel(unit as DistanceUnit | HeightUnit | RadiusUnit)}
            </span>
          )}
        </div>
        <span className="field__microcopy">{t(language, "dragMicrocopy")}</span>
      </div>
    </label>
  );
}

function ModelEditor({
  title,
  target,
  model,
  unitPreferences,
  dispatch,
  sectionId,
  language,
  collapsible,
  collapsed,
  onToggleCollapsed,
}: ModelEditorProps) {
  const isConcave = model.geometryMode === "concave";
  const [advancedCollapsed, setAdvancedCollapsed] = useState(true);

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
          <option value="layered">{t(language, "layeredAtmosphere")}</option>
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

      {model.atmosphere.mode === "layered" ? (
        <>
          <NumberField
            label={t(language, "baseAtmosphericCoefficient")}
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
          <NumberField
            label={t(language, "upperAtmosphericCoefficient")}
            value={model.atmosphere.upperCoefficient}
            min={ATMOSPHERE_COEFFICIENT_MIN}
            max={ATMOSPHERE_COEFFICIENT_MAX}
            step={0.01}
            unit="k"
            language={language}
            onChange={(value) =>
              dispatch({
                type: "setAtmosphereField",
                target,
                key: "upperCoefficient",
                value,
              })
            }
          />
          <NumberField
            label={t(language, "transitionHeight")}
            value={model.atmosphere.transitionHeightM}
            min={0}
            max={120_000}
            step={100}
            unit={unitPreferences.height}
            unitOptions={[...heightUnitOptions]}
            onUnitChange={(value) =>
              dispatch({
                type: "setUnitPreference",
                key: "height",
                value: value as HeightUnit,
              })
            }
            toDisplayValue={(baseValue, nextUnit) =>
              metersToHeightUnit(baseValue, nextUnit as HeightUnit)
            }
            toBaseValue={(displayValue, nextUnit) =>
              heightUnitToMeters(displayValue, nextUnit as HeightUnit)
            }
            language={language}
            onChange={(value) =>
              dispatch({
                type: "setAtmosphereField",
                target,
                key: "transitionHeightM",
                value,
              })
            }
          />
          <NumberField
            label={t(language, "inversionStrength")}
            value={model.atmosphere.inversionStrength}
            min={ATMOSPHERE_COEFFICIENT_MIN}
            max={ATMOSPHERE_COEFFICIENT_MAX}
            step={0.01}
            unit="k"
            language={language}
            onChange={(value) =>
              dispatch({
                type: "setAtmosphereField",
                target,
                key: "inversionStrength",
                value,
              })
            }
          />
          <NumberField
            label={t(language, "inversionBaseHeight")}
            value={model.atmosphere.inversionBaseHeightM}
            min={0}
            max={20_000}
            step={10}
            unit={unitPreferences.height}
            unitOptions={[...heightUnitOptions]}
            onUnitChange={(value) =>
              dispatch({
                type: "setUnitPreference",
                key: "height",
                value: value as HeightUnit,
              })
            }
            toDisplayValue={(baseValue, nextUnit) =>
              metersToHeightUnit(baseValue, nextUnit as HeightUnit)
            }
            toBaseValue={(displayValue, nextUnit) =>
              heightUnitToMeters(displayValue, nextUnit as HeightUnit)
            }
            language={language}
            onChange={(value) =>
              dispatch({
                type: "setAtmosphereField",
                target,
                key: "inversionBaseHeightM",
                value,
              })
            }
          />
          <NumberField
            label={t(language, "inversionDepth")}
            value={model.atmosphere.inversionDepthM}
            min={0}
            max={10_000}
            step={10}
            unit={unitPreferences.height}
            unitOptions={[...heightUnitOptions]}
            onUnitChange={(value) =>
              dispatch({
                type: "setUnitPreference",
                key: "height",
                value: value as HeightUnit,
              })
            }
            toDisplayValue={(baseValue, nextUnit) =>
              metersToHeightUnit(baseValue, nextUnit as HeightUnit)
            }
            toBaseValue={(displayValue, nextUnit) =>
              heightUnitToMeters(displayValue, nextUnit as HeightUnit)
            }
            language={language}
            onChange={(value) =>
              dispatch({
                type: "setAtmosphereField",
                target,
                key: "inversionDepthM",
                value,
              })
            }
          />
          <p className="field__hint">{t(language, "layeredAtmosphereHint")}</p>
        </>
      ) : null}

      <PanelSection
        title={t(language, "advancedLineBehavior")}
        sectionId={`${sectionId}-advanced-lines`}
        className="panel-section--nested"
        collapsible
        collapsed={advancedCollapsed}
        onToggleCollapsed={() => setAdvancedCollapsed((current) => !current)}
      >
        <label className="field">
          <span>{t(language, "referenceConstruction")}</span>
          <select
            value={model.lineBehavior.referenceConstruction}
            onChange={(event) =>
              dispatch({
                type: "setLineBehaviorField",
                target,
                key: "referenceConstruction",
                value: event.target.value,
              })
            }
          >
            <option value="auto">{t(language, "auto")}</option>
            <option value="straight-horizontal">{t(language, "straightHorizontal")}</option>
            <option value="curved-altitude">{t(language, "curvedAltitude")}</option>
            <option value="curvilinear-tangent">{t(language, "curvilinearTangentOption")}</option>
            <option value="hidden">{t(language, "hidden")}</option>
          </select>
        </label>

        <label className="field">
          <span>{t(language, "objectLightPath")}</span>
          <select
            value={model.lineBehavior.objectLightPath}
            onChange={(event) =>
              dispatch({
                type: "setLineBehaviorField",
                target,
                key: "objectLightPath",
                value: event.target.value,
              })
            }
          >
            <option value="auto">{t(language, "auto")}</option>
            <option value="traced">{t(language, "tracedCurve")}</option>
            <option value="straight">{t(language, "straightChord")}</option>
            <option value="hidden">{t(language, "hidden")}</option>
          </select>
        </label>

        <label className="field">
          <span>{t(language, "opticalHorizonRay")}</span>
          <select
            value={model.lineBehavior.opticalHorizonRay}
            onChange={(event) =>
              dispatch({
                type: "setLineBehaviorField",
                target,
                key: "opticalHorizonRay",
                value: event.target.value,
              })
            }
          >
            <option value="auto">{t(language, "auto")}</option>
            <option value="traced">{t(language, "tracedCurve")}</option>
            <option value="straight">{t(language, "straightChord")}</option>
            <option value="hidden">{t(language, "hidden")}</option>
          </select>
        </label>

        <label className="field">
          <span>{t(language, "apparentDirectionSource")}</span>
          <select
            value={model.lineBehavior.apparentDirection}
            onChange={(event) =>
              dispatch({
                type: "setLineBehaviorField",
                target,
                key: "apparentDirection",
                value: event.target.value,
              })
            }
          >
            <option value="auto">{t(language, "auto")}</option>
            <option value="target">{t(language, "targetApparentDirection")}</option>
            <option value="horizon">{t(language, "horizonApparentDirection")}</option>
            <option value="hidden">{t(language, "hidden")}</option>
          </select>
        </label>

        <label className="switch">
          <input
            type="checkbox"
            checked={model.lineBehavior.showObserverHorizontal}
            onChange={(event) =>
              dispatch({
                type: "setLineBehaviorField",
                target,
                key: "showObserverHorizontal",
                value: event.target.checked,
              })
            }
          />
          <span>{t(language, "showObserverHorizontal")}</span>
        </label>

        <label className="switch">
          <input
            type="checkbox"
            checked={model.lineBehavior.showSourceGeometricPath}
            onChange={(event) =>
              dispatch({
                type: "setLineBehaviorField",
                target,
                key: "showSourceGeometricPath",
                value: event.target.checked,
              })
            }
          />
          <span>{t(language, "showSourceGeometricPath")}</span>
        </label>

        <label className="switch">
          <input
            type="checkbox"
            checked={model.lineBehavior.showGeometricHorizon}
            onChange={(event) =>
              dispatch({
                type: "setLineBehaviorField",
                target,
                key: "showGeometricHorizon",
                value: event.target.checked,
              })
            }
          />
          <span>{t(language, "showGeometricHorizon")}</span>
        </label>

        <p className="field__hint">{t(language, "advancedLineBehaviorHint")}</p>
      </PanelSection>
    </PanelSection>
  );
}

export function ControlsPanel({
  state,
  dispatch,
  onExport,
  onExportJson,
  onExportReport,
  onCopyLink,
  language,
}: ControlsPanelProps) {
  type ScenarioNumericField =
    | "observerHeightM"
    | "observerSurfaceElevationM"
    | "observerEyeHeightM"
    | "targetHeightM"
    | "targetBaseElevationM"
    | "surfaceDistanceM"
    | "radiusM"
    | "targetSampleCount";
  const [collapsedSections, setCollapsedSections] = useState({
    scenario: false,
    model1: false,
    model2: false,
    export: false,
  });
  const [coordinatesCollapsed, setCoordinatesCollapsed] = useState(true);
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
  const preset = getPresetById(state.scenario.presetId);
  const presetDefaults = preset.scenario;
  const observerTotalHeightM = getObserverTotalHeightM(state.scenario);
  const targetTopElevationM = getTargetTopElevationM(state.scenario);
  const scenarioModeOptions: Array<{ label: string; value: ScenarioMode }> = [
    { label: t(language, "simpleMode"), value: "simple" },
    { label: t(language, "fieldMode"), value: "field" },
  ];
  const verificationKey =
    preset.verificationStatus === "verified"
      ? "presetStatusVerified"
      : preset.verificationStatus === "source-inspired"
        ? "presetStatusSourceInspired"
        : "presetStatusIllustrative";
  const routeMetrics = useMemo(
    () =>
      getGreatCircleRouteMetrics({
        observerLatDeg: state.scenario.coordinates.observerLatDeg,
        observerLonDeg: state.scenario.coordinates.observerLonDeg,
        targetLatDeg: state.scenario.coordinates.targetLatDeg,
        targetLonDeg: state.scenario.coordinates.targetLonDeg,
        radiusM: state.scenario.radiusM,
      }),
    [
      state.scenario.coordinates.observerLatDeg,
      state.scenario.coordinates.observerLonDeg,
      state.scenario.coordinates.targetLatDeg,
      state.scenario.coordinates.targetLonDeg,
      state.scenario.radiusM,
    ],
  );
  const setScenarioValue = <K extends ScenarioNumericField>(
    key: K,
    value: ScenarioInput[K],
  ) => {
    dispatch({ type: "setScenarioField", key, value });
  };
  const setScenarioMode = (value: ScenarioMode) => {
    dispatch({ type: "setScenarioMode", value });
  };
  const toggleSection = (key: keyof typeof collapsedSections) =>
    setCollapsedSections((current) => ({ ...current, [key]: !current[key] }));

  return (
    <aside className="left-panel panel">
      <PanelScrollArea viewportClassName="left-panel__viewport">
        <div className="panel__intro">
          <p className="panel__eyebrow">{t(language, "appEyebrow")}</p>
          <h1>{t(language, "panelIntroTitle")}</h1>
          <p>{t(language, "panelIntroBody")}</p>
        </div>

        <div className="controls-dock">
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

          <div className="field__stats">
            <span>
              <strong>{t(language, "presetVerification")}:</strong> {t(language, verificationKey)}
            </span>
            {preset.provenance ? (
              <span>
                <strong>{t(language, "presetProvenance")}:</strong> {preset.provenance}
              </span>
            ) : null}
          </div>

          <label className="field">
            <span>{t(language, "scenarioMode")}</span>
            <select
              value={state.scenario.scenarioMode}
              onChange={(event) => setScenarioMode(event.target.value as ScenarioMode)}
            >
              {scenarioModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <p className="field__hint">
            {state.scenario.scenarioMode === "field"
              ? t(language, "fieldScenarioHint")
              : t(language, "simpleScenarioHint")}
          </p>

          {state.scenario.scenarioMode === "field" ? (
            <>
              <NumberField
                label={t(language, "observerSiteElevation")}
                value={state.scenario.observerSurfaceElevationM}
                min={0}
                max={20_000}
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
                resetValue={presetDefaults.observerSurfaceElevationM}
                onReset={() =>
                  setScenarioValue(
                    "observerSurfaceElevationM",
                    presetDefaults.observerSurfaceElevationM,
                  )
                }
                toDisplayValue={(baseValue, nextUnit) =>
                  metersToHeightUnit(baseValue, nextUnit as HeightUnit)
                }
                toBaseValue={(displayValue, nextUnit) =>
                  heightUnitToMeters(displayValue, nextUnit as HeightUnit)
                }
                onChange={(nextValue) =>
                  setScenarioValue("observerSurfaceElevationM", nextValue)
                }
                language={language}
              />
              <NumberField
                label={t(language, "observerEyeHeight")}
                value={state.scenario.observerEyeHeightM}
                min={0}
                max={100}
                step={0.5}
                unit={state.unitPreferences.height}
                unitOptions={[...heightUnitOptions]}
                onUnitChange={(value) =>
                  dispatch({
                    type: "setUnitPreference",
                    key: "height",
                    value: value as HeightUnit,
                  })
                }
                resetValue={presetDefaults.observerEyeHeightM}
                onReset={() =>
                  setScenarioValue("observerEyeHeightM", presetDefaults.observerEyeHeightM)
                }
                toDisplayValue={(baseValue, nextUnit) =>
                  metersToHeightUnit(baseValue, nextUnit as HeightUnit)
                }
                toBaseValue={(displayValue, nextUnit) =>
                  heightUnitToMeters(displayValue, nextUnit as HeightUnit)
                }
                onChange={(nextValue) => setScenarioValue("observerEyeHeightM", nextValue)}
                language={language}
              />
              <NumberField
                label={t(language, "targetBaseElevation")}
                value={state.scenario.targetBaseElevationM}
                min={0}
                max={20_000}
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
                resetValue={presetDefaults.targetBaseElevationM}
                onReset={() =>
                  setScenarioValue("targetBaseElevationM", presetDefaults.targetBaseElevationM)
                }
                toDisplayValue={(baseValue, nextUnit) =>
                  metersToHeightUnit(baseValue, nextUnit as HeightUnit)
                }
                toBaseValue={(displayValue, nextUnit) =>
                  heightUnitToMeters(displayValue, nextUnit as HeightUnit)
                }
                onChange={(nextValue) => setScenarioValue("targetBaseElevationM", nextValue)}
                language={language}
              />
              <NumberField
                label={t(language, "targetObjectHeight")}
                value={state.scenario.targetHeightM}
                min={0}
                max={20_000}
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
              <div className="field__stats">
                <span>
                  <strong>{t(language, "observerTotalElevation")}:</strong>{" "}
                  {formatHeight(observerTotalHeightM, state.unitPreferences.height)}
                </span>
                <span>
                  <strong>{t(language, "targetTopElevation")}:</strong>{" "}
                  {formatHeight(targetTopElevationM, state.unitPreferences.height)}
                </span>
              </div>
            </>
          ) : (
            <>
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
                label={t(language, "targetTopElevation")}
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
            </>
          )}
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
            disabled={state.scenario.coordinates.enabled}
            language={language}
          />
          {state.scenario.coordinates.enabled ? (
            <p className="field__hint">
              {t(language, "coordinateDistanceHint", {
                distance: formatDistance(routeMetrics.distanceM, state.unitPreferences.distance),
                bearing: routeMetrics.initialBearingDeg.toFixed(1),
              })}
            </p>
          ) : null}
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

          <PanelSection
            title={t(language, "routeCoordinates")}
            sectionId="control-route-coordinates"
            className="panel-section--nested"
            collapsible
            collapsed={coordinatesCollapsed}
            onToggleCollapsed={() => setCoordinatesCollapsed((current) => !current)}
          >
            <label className="switch">
              <input
                type="checkbox"
                checked={state.scenario.coordinates.enabled}
                onChange={(event) =>
                  dispatch({
                    type: "setCoordinateField",
                    key: "enabled",
                    value: event.target.checked,
                  })
                }
              />
              <span>{t(language, "useCoordinateDistance")}</span>
            </label>

            <div className="coordinate-grid">
              <label className="field">
                <span>{t(language, "observerLatitude")}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.0001"
                  min={-90}
                  max={90}
                  value={state.scenario.coordinates.observerLatDeg}
                  onChange={(event) =>
                    dispatch({
                      type: "setCoordinateField",
                      key: "observerLatDeg",
                      value: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="field">
                <span>{t(language, "observerLongitude")}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.0001"
                  min={-180}
                  max={180}
                  value={state.scenario.coordinates.observerLonDeg}
                  onChange={(event) =>
                    dispatch({
                      type: "setCoordinateField",
                      key: "observerLonDeg",
                      value: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="field">
                <span>{t(language, "targetLatitude")}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.0001"
                  min={-90}
                  max={90}
                  value={state.scenario.coordinates.targetLatDeg}
                  onChange={(event) =>
                    dispatch({
                      type: "setCoordinateField",
                      key: "targetLatDeg",
                      value: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="field">
                <span>{t(language, "targetLongitude")}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.0001"
                  min={-180}
                  max={180}
                  value={state.scenario.coordinates.targetLonDeg}
                  onChange={(event) =>
                    dispatch({
                      type: "setCoordinateField",
                      key: "targetLonDeg",
                      value: Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>

            <div className="field__stats">
              <span>
                <strong>{t(language, "derivedDistance")}:</strong>{" "}
                {formatDistance(routeMetrics.distanceM, state.unitPreferences.distance)}
              </span>
              <span>
                <strong>{t(language, "initialBearing")}:</strong>{" "}
                {formatAngle((routeMetrics.initialBearingDeg * Math.PI) / 180)}
              </span>
            </div>
            <p className="field__hint">{t(language, "routeCoordinateHint")}</p>
          </PanelSection>

          <label className="switch">
            <input
              type="checkbox"
              checked={state.useTerrainObstruction}
              onChange={(event) =>
                dispatch({ type: "setUseTerrainObstruction", value: event.target.checked })
              }
            />
            <span>{t(language, "terrainBlocksRays")}</span>
          </label>
          </PanelSection>

          <ModelEditor
            title={t(language, "primaryModelTitle")}
            target="primary"
            model={state.primaryModel}
            unitPreferences={state.unitPreferences}
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
            unitPreferences={state.unitPreferences}
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
              <button type="button" className="action-button action-button--ghost" onClick={onExportJson}>
                {t(language, "exportJson")}
              </button>
              <button type="button" className="action-button action-button--ghost" onClick={onExportReport}>
                {t(language, "exportReport")}
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
      </PanelScrollArea>
    </aside>
  );
}
