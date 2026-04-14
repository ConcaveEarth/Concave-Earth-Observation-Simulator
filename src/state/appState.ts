import {
  applyPresetToModel,
  defaultComparisonModel,
  defaultPrimaryModel,
  getPresetById,
} from "../domain/presets";
import { defaultSweepConfig } from "../domain/analysis";
import { clampAtmosphereCoefficient } from "../domain/curvature";
import {
  getGreatCircleRouteMetrics,
  normalizeLatitudeDeg,
  normalizeLongitudeDeg,
} from "../domain/geodesy";
import {
  getObserverEyeHeightM,
  getObserverSurfaceElevationM,
  getObserverTotalHeightM,
  getTargetBaseElevationM,
  getTargetTopElevationM,
  normalizeScenarioInput,
} from "../domain/scenario";
import type { LanguageMode } from "../i18n";
import { clamp, defaultUnitPreferences } from "../domain/units";
import type {
  ApparentDirectionMode,
  FocusedModel,
  GeometryMode,
  IntrinsicCurvatureMode,
  LineBehaviorConfig,
  ModelConfig,
  PathDisplayMode,
  ReferenceConstructionMode,
  ScenarioCoordinateInput,
  ScenarioInput,
  ScenarioMode,
  ViewMode,
} from "../domain/types";
import type {
  AnalysisTab,
  SweepConfig,
  SweepMetric,
  SweepParameter,
  SweepRangeMode,
} from "../domain/analysis";
import type { DistanceUnit, HeightUnit, RadiusUnit, UnitPreferences } from "../domain/units";

export type SceneFramingMode = "auto" | "full";
export type SceneScaleMode = "survey" | "true-scale" | "diagram";
export type CompareLayoutMode = "auto" | "side-by-side" | "stacked";
export type LabelDensityMode = "adaptive" | "full";
export type ThemeMode = "night-lab" | "paper-light" | "blueprint";
export type WorkspaceMode = "professional" | "simple";

export interface SceneViewportState {
  framingMode: SceneFramingMode;
  scaleMode: SceneScaleMode;
  compareLayout: CompareLayoutMode;
  zoom: number;
  verticalZoom: number;
  panX: number;
  panY: number;
}

export interface AppState {
  scenario: ScenarioInput;
  primaryModel: ModelConfig;
  comparisonModel: ModelConfig;
  analysisTab: AnalysisTab;
  viewMode: ViewMode;
  focusedModel: FocusedModel;
  sceneViewport: SceneViewportState;
  sweepConfig: SweepConfig;
  unitPreferences: UnitPreferences;
  annotated: boolean;
  labelDensity: LabelDensityMode;
  theme: ThemeMode;
  language: LanguageMode;
  workspaceMode: WorkspaceMode;
  fullWidthScene: boolean;
  fitContentHeight: boolean;
  showScaleGuides: boolean;
  showTerrainOverlay: boolean;
  useTerrainObstruction: boolean;
  selectedSceneKey: FocusedModel | null;
  selectedFeatureId: string | null;
  hoveredSceneKey: FocusedModel | null;
  hoveredFeatureId: string | null;
}

export type AppAction =
  | { type: "setScenarioField"; key: keyof ScenarioInput; value: number | string }
  | { type: "setScenarioMode"; value: ScenarioMode }
  | {
      type: "setModelField";
      target: FocusedModel;
      key: keyof Pick<
        ModelConfig,
        "geometryMode" | "intrinsicCurvatureMode" | "intrinsicCurvaturePerM"
      >;
      value: number | string;
    }
  | {
      type: "setAtmosphereField";
      target: FocusedModel;
      key:
        | "mode"
        | "coefficient"
        | "upperCoefficient"
        | "transitionHeightM"
        | "inversionStrength"
        | "inversionBaseHeightM"
        | "inversionDepthM";
      value: number | string;
    }
  | {
      type: "setLineBehaviorField";
      target: FocusedModel;
      key: keyof LineBehaviorConfig;
      value: boolean | string;
    }
  | { type: "setViewMode"; value: ViewMode }
  | { type: "setAnalysisTab"; value: AnalysisTab }
  | { type: "setFocusedModel"; value: FocusedModel }
  | {
      type: "setSweepField";
      key: keyof SweepConfig;
      value: SweepParameter | SweepMetric | SweepRangeMode | number;
    }
  | {
      type: "setViewportField";
      key: keyof SceneViewportState;
      value: number | string;
    }
  | { type: "adjustViewportZoom"; delta: number }
  | { type: "adjustViewportVerticalZoom"; delta: number }
  | { type: "panViewport"; deltaX: number; deltaY: number }
  | { type: "resetViewport" }
  | {
      type: "setUnitPreference";
      key: keyof UnitPreferences;
      value: HeightUnit | DistanceUnit | RadiusUnit;
    }
  | {
      type: "setCoordinateField";
      key: keyof ScenarioCoordinateInput;
      value: number | boolean;
    }
  | { type: "setAnnotated"; value: boolean }
  | { type: "setLabelDensity"; value: LabelDensityMode }
  | { type: "setTheme"; value: ThemeMode }
  | { type: "setLanguage"; value: LanguageMode }
  | { type: "setWorkspaceMode"; value: WorkspaceMode }
  | { type: "setFullWidthScene"; value: boolean }
  | { type: "setFitContentHeight"; value: boolean }
  | { type: "setShowScaleGuides"; value: boolean }
  | { type: "setShowTerrainOverlay"; value: boolean }
  | { type: "setUseTerrainObstruction"; value: boolean }
  | { type: "setSelectedFeature"; sceneKey: FocusedModel | null; value: string | null }
  | { type: "clearSelectedFeature" }
  | { type: "setHoveredFeature"; sceneKey: FocusedModel | null; value: string | null }
  | { type: "applyPreset"; presetId: string };

export function createDefaultState(): AppState {
  const defaultPreset = getPresetById("oil-rig");

  return {
    scenario: normalizeScenarioAfterEdit(defaultPreset.scenario),
    primaryModel: applyPresetToModel(defaultPrimaryModel, defaultPreset.primaryModel),
    comparisonModel: applyPresetToModel(
      defaultComparisonModel,
      defaultPreset.comparisonModel,
    ),
    analysisTab: "cross-section",
    viewMode: "compare",
    focusedModel: "primary",
    sceneViewport: {
      framingMode: "auto",
      scaleMode: "diagram",
      compareLayout: "auto",
      zoom: 1,
      verticalZoom: 1,
      panX: 0,
      panY: 0,
    },
    sweepConfig: defaultSweepConfig,
    unitPreferences: defaultUnitPreferences,
    annotated: true,
    labelDensity: "adaptive",
    theme: "night-lab",
    language: "en",
    workspaceMode: "professional",
    fullWidthScene: true,
    fitContentHeight: true,
    showScaleGuides: true,
    showTerrainOverlay: true,
    useTerrainObstruction: true,
    selectedSceneKey: null,
    selectedFeatureId: null,
    hoveredSceneKey: null,
    hoveredFeatureId: null,
  };
}

function normalizeGeometryMode(value: string): GeometryMode {
  return value === "concave" ? "concave" : "convex";
}

function normalizeIntrinsicMode(value: string): IntrinsicCurvatureMode {
  switch (value) {
    case "1/R":
    case "2/R":
    case "constant":
      return value;
    case "none":
    default:
      return "none";
  }
}

function normalizeReferenceConstructionMode(value: string): ReferenceConstructionMode {
  switch (value) {
    case "straight-horizontal":
    case "curved-altitude":
    case "curvilinear-tangent":
    case "hidden":
      return value;
    default:
      return "auto";
  }
}

function normalizePathDisplayMode(value: string): PathDisplayMode {
  switch (value) {
    case "traced":
    case "straight":
    case "hidden":
      return value;
    default:
      return "auto";
  }
}

function normalizeApparentDirectionMode(value: string): ApparentDirectionMode {
  switch (value) {
    case "target":
    case "horizon":
    case "hidden":
      return value;
    default:
      return "auto";
  }
}

function normalizeScaleMode(value: string): SceneScaleMode {
  if (value === "diagram") {
    return "diagram";
  }

  if (value === "true-scale") {
    return "true-scale";
  }

  return "survey";
}

function normalizeCompareLayout(value: string): CompareLayoutMode {
  switch (value) {
    case "side-by-side":
    case "stacked":
      return value;
    default:
      return "auto";
  }
}

function normalizeHeightUnit(value: string): HeightUnit {
  return value === "ft" ? "ft" : "m";
}

function normalizeDistanceUnit(value: string): DistanceUnit {
  switch (value) {
    case "m":
    case "ft":
    case "mi":
      return value;
    default:
      return "km";
  }
}

function normalizeRadiusUnit(value: string): RadiusUnit {
  return value === "mi" ? "mi" : "km";
}

function normalizeLabelDensity(value: string): LabelDensityMode {
  return value === "full" ? "full" : "adaptive";
}

function normalizeThemeMode(value: string): ThemeMode {
  switch (value) {
    case "paper-light":
    case "blueprint":
      return value;
    default:
      return "night-lab";
  }
}

function normalizeWorkspaceMode(value: string): WorkspaceMode {
  return value === "simple" ? "simple" : "professional";
}

function normalizeAnalysisTab(value: string): AnalysisTab {
  switch (value) {
    case "ray-bundle":
    case "observer-view":
    case "profile-visibility":
    case "route-map":
    case "sky-wrap":
    case "inversion-lab":
    case "sweep":
      return value;
    default:
      return "cross-section";
  }
}

function normalizeAtmosphereMode(value: string) {
  switch (value) {
    case "none":
    case "layered":
      return value;
    default:
      return "simpleCoefficient";
  }
}

function normalizeSweepParameter(value: string): SweepParameter {
  switch (value) {
    case "observerHeight":
    case "targetHeight":
    case "atmosphere":
      return value;
    default:
      return "distance";
  }
}

function normalizeSweepMetric(value: string): SweepMetric {
  switch (value) {
    case "visibilityFraction":
    case "apparentElevation":
    case "opticalHorizon":
      return value;
    default:
      return "hiddenHeight";
  }
}

function normalizeSweepRangeMode(value: string): SweepRangeMode {
  switch (value) {
    case "focused":
    case "wide":
      return value;
    default:
      return "operational";
  }
}

function normalizeLanguageMode(value: string): LanguageMode {
  switch (value) {
    case "es":
    case "it":
    case "pt":
    case "ru":
      return value;
    default:
      return "en";
  }
}

function deriveCoordinateDistance(scenario: ScenarioInput): ScenarioInput {
  if (!scenario.coordinates.enabled) {
    return scenario;
  }

  const route = getGreatCircleRouteMetrics({
    observerLatDeg: scenario.coordinates.observerLatDeg,
    observerLonDeg: scenario.coordinates.observerLonDeg,
    targetLatDeg: scenario.coordinates.targetLatDeg,
    targetLonDeg: scenario.coordinates.targetLonDeg,
    radiusM: scenario.radiusM,
  });

  return {
    ...scenario,
    surfaceDistanceM: route.distanceM,
  };
}

function normalizeScenarioAfterEdit(scenario: ScenarioInput): ScenarioInput {
  return deriveCoordinateDistance(normalizeScenarioInput(scenario));
}

function updateModel(
  model: ModelConfig,
  action: Extract<AppAction, { type: "setModelField" }>,
): ModelConfig {
  if (action.key === "geometryMode") {
    const geometryMode = normalizeGeometryMode(String(action.value));
    return {
      ...model,
      geometryMode,
      intrinsicCurvatureMode:
        geometryMode === "convex" ? "none" : model.intrinsicCurvatureMode,
    };
  }

  if (action.key === "intrinsicCurvatureMode") {
    return {
      ...model,
      intrinsicCurvatureMode: normalizeIntrinsicMode(String(action.value)),
    };
  }

  return {
    ...model,
    [action.key]: Number(action.value),
  };
}

function updateAtmosphere(
  model: ModelConfig,
  action: Extract<AppAction, { type: "setAtmosphereField" }>,
): ModelConfig {
  const numericKeys = new Set([
    "coefficient",
    "upperCoefficient",
    "transitionHeightM",
    "inversionStrength",
    "inversionBaseHeightM",
    "inversionDepthM",
  ]);

  return {
    ...model,
    atmosphere: {
      ...model.atmosphere,
      [action.key]:
        action.key === "mode"
          ? normalizeAtmosphereMode(String(action.value))
          : numericKeys.has(action.key)
            ? action.key === "coefficient" ||
              action.key === "upperCoefficient" ||
              action.key === "inversionStrength"
              ? clampAtmosphereCoefficient(Number(action.value))
              : Math.max(0, Number(action.value))
            : Number(action.value),
    },
  };
}

function updateLineBehavior(
  model: ModelConfig,
  action: Extract<AppAction, { type: "setLineBehaviorField" }>,
): ModelConfig {
  const normalizedValue =
    action.key === "showSourceGeometricPath" ||
    action.key === "showObserverHorizontal" ||
    action.key === "showGeometricHorizon"
      ? Boolean(action.value)
      : action.key === "referenceConstruction"
        ? normalizeReferenceConstructionMode(String(action.value))
        : action.key === "apparentDirection"
          ? normalizeApparentDirectionMode(String(action.value))
          : normalizePathDisplayMode(String(action.value));

  return {
    ...model,
    lineBehavior: {
      ...model.lineBehavior,
      [action.key]: normalizedValue,
    },
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "setScenarioField":
      return {
        ...state,
        scenario: normalizeScenarioAfterEdit({
          ...state.scenario,
          [action.key]:
            action.key === "presetId" || action.key === "units" || action.key === "scenarioMode"
              ? action.value
              : Number(action.value),
        }),
      };
    case "setScenarioMode": {
      const current = state.scenario;

      if (action.value === current.scenarioMode) {
        return state;
      }

      if (action.value === "field") {
        return {
          ...state,
          scenario: normalizeScenarioAfterEdit({
            ...current,
            scenarioMode: "field",
            observerSurfaceElevationM: getObserverSurfaceElevationM(current),
            observerEyeHeightM: getObserverEyeHeightM(current),
            targetBaseElevationM: getTargetBaseElevationM(current),
            targetHeightM:
              current.scenarioMode === "field"
                ? current.targetHeightM
                : getTargetTopElevationM(current),
          }),
        };
      }

      return {
        ...state,
        scenario: normalizeScenarioAfterEdit({
          ...current,
          scenarioMode: "simple",
          observerHeightM: getObserverTotalHeightM(current),
          targetHeightM: getTargetTopElevationM(current),
        }),
      };
    }
    case "setCoordinateField":
      return {
        ...state,
        scenario: normalizeScenarioAfterEdit({
          ...state.scenario,
          coordinates: {
            ...state.scenario.coordinates,
            [action.key]:
              action.key === "enabled"
                ? Boolean(action.value)
                : action.key === "observerLatDeg" || action.key === "targetLatDeg"
                  ? normalizeLatitudeDeg(Number(action.value))
                  : normalizeLongitudeDeg(Number(action.value)),
          },
        }),
      };
    case "setModelField":
      return action.target === "primary"
        ? { ...state, primaryModel: updateModel(state.primaryModel, action) }
        : { ...state, comparisonModel: updateModel(state.comparisonModel, action) };
    case "setAtmosphereField":
      return action.target === "primary"
        ? { ...state, primaryModel: updateAtmosphere(state.primaryModel, action) }
        : {
            ...state,
            comparisonModel: updateAtmosphere(state.comparisonModel, action),
          };
    case "setLineBehaviorField":
      return action.target === "primary"
        ? { ...state, primaryModel: updateLineBehavior(state.primaryModel, action) }
        : {
            ...state,
            comparisonModel: updateLineBehavior(state.comparisonModel, action),
          };
    case "setViewMode":
      return { ...state, viewMode: action.value };
    case "setAnalysisTab":
      return {
        ...state,
        analysisTab: action.value,
        selectedSceneKey: null,
        selectedFeatureId: null,
        hoveredSceneKey: null,
        hoveredFeatureId: null,
      };
    case "setFocusedModel":
      return { ...state, focusedModel: action.value };
    case "setSweepField":
      return {
        ...state,
        sweepConfig: {
          ...state.sweepConfig,
          [action.key]:
            action.key === "parameter"
              ? normalizeSweepParameter(String(action.value))
              : action.key === "metric"
                ? normalizeSweepMetric(String(action.value))
                : action.key === "rangeMode"
                  ? normalizeSweepRangeMode(String(action.value))
                  : clamp(Number(action.value), 8, 80),
        },
      };
    case "setViewportField":
      return {
        ...state,
        sceneViewport: {
          ...state.sceneViewport,
          [action.key]:
            action.key === "framingMode"
              ? action.value
              : action.key === "scaleMode"
                ? normalizeScaleMode(String(action.value))
                : action.key === "compareLayout"
                  ? normalizeCompareLayout(String(action.value))
                : action.key === "panX" || action.key === "panY"
                  ? Number(action.value)
                  : Number(action.value),
        },
      };
    case "adjustViewportZoom":
      return {
        ...state,
        sceneViewport: {
          ...state.sceneViewport,
          zoom: clamp(state.sceneViewport.zoom + action.delta, 0.35, 6),
        },
      };
    case "adjustViewportVerticalZoom":
      return {
        ...state,
        sceneViewport: {
          ...state.sceneViewport,
          verticalZoom: clamp(
            state.sceneViewport.verticalZoom + action.delta,
            0.25,
            12,
          ),
        },
      };
    case "panViewport":
      return {
        ...state,
        sceneViewport: {
          ...state.sceneViewport,
          panX: state.sceneViewport.panX + action.deltaX,
          panY: state.sceneViewport.panY + action.deltaY,
        },
      };
    case "resetViewport":
      return {
        ...state,
        sceneViewport: createDefaultState().sceneViewport,
      };
    case "setUnitPreference":
      return {
        ...state,
        unitPreferences: {
          ...state.unitPreferences,
          [action.key]:
            action.key === "height"
              ? normalizeHeightUnit(String(action.value))
              : action.key === "radius"
                ? normalizeRadiusUnit(String(action.value))
                : normalizeDistanceUnit(String(action.value)),
        },
      };
    case "setAnnotated":
      return { ...state, annotated: action.value };
    case "setLabelDensity":
      return { ...state, labelDensity: normalizeLabelDensity(action.value) };
    case "setTheme":
      return { ...state, theme: normalizeThemeMode(action.value) };
    case "setLanguage":
      return { ...state, language: normalizeLanguageMode(action.value) };
    case "setWorkspaceMode":
      return { ...state, workspaceMode: normalizeWorkspaceMode(action.value) };
    case "setFullWidthScene":
      return { ...state, fullWidthScene: action.value };
    case "setFitContentHeight":
      return { ...state, fitContentHeight: action.value };
    case "setShowScaleGuides":
      return { ...state, showScaleGuides: action.value };
    case "setShowTerrainOverlay":
      return { ...state, showTerrainOverlay: action.value };
    case "setUseTerrainObstruction":
      return { ...state, useTerrainObstruction: action.value };
    case "setSelectedFeature":
      return {
        ...state,
        selectedSceneKey: action.sceneKey,
        selectedFeatureId: action.value,
      };
    case "clearSelectedFeature":
      return {
        ...state,
        selectedSceneKey: null,
        selectedFeatureId: null,
      };
    case "setHoveredFeature":
      return {
        ...state,
        hoveredSceneKey: action.sceneKey,
        hoveredFeatureId: action.value,
      };
    case "applyPreset": {
      const preset = getPresetById(action.presetId);
      return {
        ...state,
        scenario: normalizeScenarioAfterEdit(preset.scenario),
        primaryModel: applyPresetToModel(defaultPrimaryModel, preset.primaryModel),
        comparisonModel: applyPresetToModel(
          defaultComparisonModel,
          preset.comparisonModel,
        ),
        sceneViewport: createDefaultState().sceneViewport,
        selectedSceneKey: null,
        selectedFeatureId: null,
        hoveredSceneKey: null,
        hoveredFeatureId: null,
      };
    }
    default:
      return state;
  }
}

function setStringIfDifferent(
  params: URLSearchParams,
  key: string,
  value: string,
  baseline: string,
) {
  if (value !== baseline) {
    params.set(key, value);
  }
}

function setFlagIfDifferent(
  params: URLSearchParams,
  key: string,
  value: boolean,
  baseline: boolean,
) {
  if (value !== baseline) {
    params.set(key, value ? "1" : "0");
  }
}

function setNumberIfDifferent(
  params: URLSearchParams,
  key: string,
  value: number,
  baseline: number,
  epsilon = 1e-9,
) {
  if (Math.abs(value - baseline) > epsilon) {
    params.set(key, String(value));
  }
}

function serializeModel(
  prefix: string,
  model: ModelConfig,
  baseline: ModelConfig,
  params: URLSearchParams,
): void {
  setStringIfDifferent(params, `${prefix}Geometry`, model.geometryMode, baseline.geometryMode);
  setStringIfDifferent(
    params,
    `${prefix}Intrinsic`,
    model.intrinsicCurvatureMode,
    baseline.intrinsicCurvatureMode,
  );
  setNumberIfDifferent(
    params,
    `${prefix}IntrinsicValue`,
    model.intrinsicCurvaturePerM,
    baseline.intrinsicCurvaturePerM,
  );
  setStringIfDifferent(
    params,
    `${prefix}AtmosphereMode`,
    model.atmosphere.mode,
    baseline.atmosphere.mode,
  );
  setNumberIfDifferent(
    params,
    `${prefix}AtmosphereK`,
    model.atmosphere.coefficient,
    baseline.atmosphere.coefficient,
  );
  setNumberIfDifferent(
    params,
    `${prefix}AtmosphereUpperK`,
    model.atmosphere.upperCoefficient,
    baseline.atmosphere.upperCoefficient,
  );
  setNumberIfDifferent(
    params,
    `${prefix}AtmosphereTransitionHeight`,
    model.atmosphere.transitionHeightM,
    baseline.atmosphere.transitionHeightM,
  );
  setNumberIfDifferent(
    params,
    `${prefix}AtmosphereInversionStrength`,
    model.atmosphere.inversionStrength,
    baseline.atmosphere.inversionStrength,
  );
  setNumberIfDifferent(
    params,
    `${prefix}AtmosphereInversionBase`,
    model.atmosphere.inversionBaseHeightM,
    baseline.atmosphere.inversionBaseHeightM,
  );
  setNumberIfDifferent(
    params,
    `${prefix}AtmosphereInversionDepth`,
    model.atmosphere.inversionDepthM,
    baseline.atmosphere.inversionDepthM,
  );
  setStringIfDifferent(
    params,
    `${prefix}ReferenceConstruction`,
    model.lineBehavior.referenceConstruction,
    baseline.lineBehavior.referenceConstruction,
  );
  setStringIfDifferent(
    params,
    `${prefix}OpticalHorizonRay`,
    model.lineBehavior.opticalHorizonRay,
    baseline.lineBehavior.opticalHorizonRay,
  );
  setStringIfDifferent(
    params,
    `${prefix}ObjectLightPath`,
    model.lineBehavior.objectLightPath,
    baseline.lineBehavior.objectLightPath,
  );
  setStringIfDifferent(
    params,
    `${prefix}ApparentDirection`,
    model.lineBehavior.apparentDirection,
    baseline.lineBehavior.apparentDirection,
  );
  setFlagIfDifferent(
    params,
    `${prefix}ShowSourceGeometricPath`,
    model.lineBehavior.showSourceGeometricPath,
    baseline.lineBehavior.showSourceGeometricPath,
  );
  setFlagIfDifferent(
    params,
    `${prefix}ShowObserverHorizontal`,
    model.lineBehavior.showObserverHorizontal,
    baseline.lineBehavior.showObserverHorizontal,
  );
  setFlagIfDifferent(
    params,
    `${prefix}ShowGeometricHorizon`,
    model.lineBehavior.showGeometricHorizon,
    baseline.lineBehavior.showGeometricHorizon,
  );
}

function parseNumber(
  params: URLSearchParams,
  key: string,
  fallback: number,
): number {
  const raw = params.get(key);
  const numeric = raw == null ? Number.NaN : Number(raw);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function hydrateModel(
  params: URLSearchParams,
  prefix: string,
  fallback: ModelConfig,
): ModelConfig {
  const geometryMode = params.get(`${prefix}Geometry`);
  const intrinsicCurvatureMode = params.get(`${prefix}Intrinsic`);
  const atmosphereMode = params.get(`${prefix}AtmosphereMode`);

  return {
    ...fallback,
    geometryMode: geometryMode === "concave" ? "concave" : "convex",
    intrinsicCurvatureMode: normalizeIntrinsicMode(
      intrinsicCurvatureMode ?? fallback.intrinsicCurvatureMode,
    ),
    intrinsicCurvaturePerM: parseNumber(
      params,
      `${prefix}IntrinsicValue`,
      fallback.intrinsicCurvaturePerM,
    ),
    atmosphere: {
      mode: normalizeAtmosphereMode(atmosphereMode ?? fallback.atmosphere.mode),
      coefficient: clampAtmosphereCoefficient(
        parseNumber(
          params,
          `${prefix}AtmosphereK`,
          fallback.atmosphere.coefficient,
        ),
      ),
      upperCoefficient: clampAtmosphereCoefficient(
        parseNumber(
          params,
          `${prefix}AtmosphereUpperK`,
          fallback.atmosphere.upperCoefficient,
        ),
      ),
      transitionHeightM: Math.max(
        0,
        parseNumber(
          params,
          `${prefix}AtmosphereTransitionHeight`,
          fallback.atmosphere.transitionHeightM,
        ),
      ),
      inversionStrength: clampAtmosphereCoefficient(
        parseNumber(
          params,
          `${prefix}AtmosphereInversionStrength`,
          fallback.atmosphere.inversionStrength,
        ),
      ),
      inversionBaseHeightM: Math.max(
        0,
        parseNumber(
          params,
          `${prefix}AtmosphereInversionBase`,
          fallback.atmosphere.inversionBaseHeightM,
        ),
      ),
      inversionDepthM: Math.max(
        0,
        parseNumber(
          params,
          `${prefix}AtmosphereInversionDepth`,
          fallback.atmosphere.inversionDepthM,
        ),
      ),
    },
    lineBehavior: {
      referenceConstruction: normalizeReferenceConstructionMode(
        params.get(`${prefix}ReferenceConstruction`) ??
          fallback.lineBehavior.referenceConstruction,
      ),
      opticalHorizonRay: normalizePathDisplayMode(
        params.get(`${prefix}OpticalHorizonRay`) ??
          fallback.lineBehavior.opticalHorizonRay,
      ),
      objectLightPath: normalizePathDisplayMode(
        params.get(`${prefix}ObjectLightPath`) ??
          fallback.lineBehavior.objectLightPath,
      ),
      apparentDirection: normalizeApparentDirectionMode(
        params.get(`${prefix}ApparentDirection`) ??
          fallback.lineBehavior.apparentDirection,
      ),
      showSourceGeometricPath:
        params.get(`${prefix}ShowSourceGeometricPath`) == null
          ? fallback.lineBehavior.showSourceGeometricPath
          : params.get(`${prefix}ShowSourceGeometricPath`) !== "0",
      showObserverHorizontal:
        params.get(`${prefix}ShowObserverHorizontal`) == null
          ? fallback.lineBehavior.showObserverHorizontal
          : params.get(`${prefix}ShowObserverHorizontal`) !== "0",
      showGeometricHorizon:
        params.get(`${prefix}ShowGeometricHorizon`) == null
          ? fallback.lineBehavior.showGeometricHorizon
          : params.get(`${prefix}ShowGeometricHorizon`) !== "0",
    },
  };
}

export function serializeStateToSearch(state: AppState): string {
  const defaults = createDefaultState();
  const preset = getPresetById(state.scenario.presetId);
  const baseScenario = preset.scenario;
  const basePrimaryModel = applyPresetToModel(defaultPrimaryModel, preset.primaryModel);
  const baseComparisonModel = applyPresetToModel(
    defaultComparisonModel,
    preset.comparisonModel,
  );
  const params = new URLSearchParams();
  params.set("preset", state.scenario.presetId);
  setStringIfDifferent(params, "tab", state.analysisTab, defaults.analysisTab);
  setStringIfDifferent(params, "view", state.viewMode, defaults.viewMode);
  setStringIfDifferent(params, "focus", state.focusedModel, defaults.focusedModel);
  setStringIfDifferent(
    params,
    "frame",
    state.sceneViewport.framingMode,
    defaults.sceneViewport.framingMode,
  );
  setStringIfDifferent(
    params,
    "scale",
    state.sceneViewport.scaleMode,
    defaults.sceneViewport.scaleMode,
  );
  setStringIfDifferent(
    params,
    "compareLayout",
    state.sceneViewport.compareLayout,
    defaults.sceneViewport.compareLayout,
  );
  setNumberIfDifferent(params, "zoom", state.sceneViewport.zoom, defaults.sceneViewport.zoom);
  setNumberIfDifferent(
    params,
    "vzoom",
    state.sceneViewport.verticalZoom,
    defaults.sceneViewport.verticalZoom,
  );
  setNumberIfDifferent(params, "panX", state.sceneViewport.panX, defaults.sceneViewport.panX);
  setNumberIfDifferent(params, "panY", state.sceneViewport.panY, defaults.sceneViewport.panY);
  setStringIfDifferent(
    params,
    "sweepParameter",
    state.sweepConfig.parameter,
    defaults.sweepConfig.parameter,
  );
  setStringIfDifferent(
    params,
    "sweepMetric",
    state.sweepConfig.metric,
    defaults.sweepConfig.metric,
  );
  setStringIfDifferent(
    params,
    "sweepRange",
    state.sweepConfig.rangeMode,
    defaults.sweepConfig.rangeMode,
  );
  setNumberIfDifferent(
    params,
    "sweepSamples",
    state.sweepConfig.sampleCount,
    defaults.sweepConfig.sampleCount,
  );
  setStringIfDifferent(
    params,
    "heightUnit",
    state.unitPreferences.height,
    defaults.unitPreferences.height,
  );
  setStringIfDifferent(
    params,
    "distanceUnit",
    state.unitPreferences.distance,
    defaults.unitPreferences.distance,
  );
  setStringIfDifferent(
    params,
    "radiusUnit",
    state.unitPreferences.radius,
    defaults.unitPreferences.radius,
  );
  setFlagIfDifferent(params, "annotated", state.annotated, defaults.annotated);
  setStringIfDifferent(params, "labels", state.labelDensity, defaults.labelDensity);
  setStringIfDifferent(params, "theme", state.theme, defaults.theme);
  setStringIfDifferent(params, "language", state.language, defaults.language);
  setStringIfDifferent(
    params,
    "workspace",
    state.workspaceMode,
    defaults.workspaceMode,
  );
  setFlagIfDifferent(params, "fullWidth", state.fullWidthScene, defaults.fullWidthScene);
  setFlagIfDifferent(
    params,
    "fitHeight",
    state.fitContentHeight,
    defaults.fitContentHeight,
  );
  setFlagIfDifferent(
    params,
    "scales",
    state.showScaleGuides,
    defaults.showScaleGuides,
  );
  setFlagIfDifferent(
    params,
    "terrain",
    state.showTerrainOverlay,
    defaults.showTerrainOverlay,
  );
  setFlagIfDifferent(
    params,
    "terrainBlock",
    state.useTerrainObstruction,
    defaults.useTerrainObstruction,
  );
  setStringIfDifferent(
    params,
    "scenarioMode",
    state.scenario.scenarioMode,
    baseScenario.scenarioMode,
  );
  setNumberIfDifferent(
    params,
    "observer",
    state.scenario.observerHeightM,
    baseScenario.observerHeightM,
  );
  setNumberIfDifferent(
    params,
    "observerSurface",
    state.scenario.observerSurfaceElevationM,
    baseScenario.observerSurfaceElevationM,
  );
  setNumberIfDifferent(
    params,
    "observerEye",
    state.scenario.observerEyeHeightM,
    baseScenario.observerEyeHeightM,
  );
  setNumberIfDifferent(
    params,
    "target",
    state.scenario.targetHeightM,
    baseScenario.targetHeightM,
  );
  setNumberIfDifferent(
    params,
    "targetBase",
    state.scenario.targetBaseElevationM,
    baseScenario.targetBaseElevationM,
  );
  setNumberIfDifferent(
    params,
    "distance",
    state.scenario.surfaceDistanceM,
    baseScenario.surfaceDistanceM,
  );
  setNumberIfDifferent(
    params,
    "radius",
    state.scenario.radiusM,
    baseScenario.radiusM,
  );
  setNumberIfDifferent(
    params,
    "samples",
    state.scenario.targetSampleCount,
    baseScenario.targetSampleCount,
  );
  setFlagIfDifferent(
    params,
    "coords",
    state.scenario.coordinates.enabled,
    baseScenario.coordinates.enabled,
  );
  setNumberIfDifferent(
    params,
    "observerLat",
    state.scenario.coordinates.observerLatDeg,
    baseScenario.coordinates.observerLatDeg,
  );
  setNumberIfDifferent(
    params,
    "observerLon",
    state.scenario.coordinates.observerLonDeg,
    baseScenario.coordinates.observerLonDeg,
  );
  setNumberIfDifferent(
    params,
    "targetLat",
    state.scenario.coordinates.targetLatDeg,
    baseScenario.coordinates.targetLatDeg,
  );
  setNumberIfDifferent(
    params,
    "targetLon",
    state.scenario.coordinates.targetLonDeg,
    baseScenario.coordinates.targetLonDeg,
  );
  serializeModel("primary", state.primaryModel, basePrimaryModel, params);
  serializeModel("compare", state.comparisonModel, baseComparisonModel, params);
  return `?${params.toString()}`;
}

export function hydrateStateFromSearch(search: string): AppState {
  const defaults = createDefaultState();

  if (!search) {
    return defaults;
  }

  const params = new URLSearchParams(search);
  const presetId = params.get("preset") ?? defaults.scenario.presetId;
  const preset = getPresetById(presetId);
  const primaryModel = hydrateModel(
    params,
    "primary",
    applyPresetToModel(defaultPrimaryModel, preset.primaryModel),
  );
  const comparisonModel = hydrateModel(
    params,
    "compare",
    applyPresetToModel(defaultComparisonModel, preset.comparisonModel),
  );

  return {
    scenario: normalizeScenarioAfterEdit({
      ...preset.scenario,
      scenarioMode:
        params.get("scenarioMode") === "field" ? "field" : preset.scenario.scenarioMode,
      observerHeightM: parseNumber(params, "observer", preset.scenario.observerHeightM),
      observerSurfaceElevationM: parseNumber(
        params,
        "observerSurface",
        preset.scenario.observerSurfaceElevationM,
      ),
      observerEyeHeightM: parseNumber(
        params,
        "observerEye",
        preset.scenario.observerEyeHeightM,
      ),
      targetHeightM: parseNumber(params, "target", preset.scenario.targetHeightM),
      targetBaseElevationM: parseNumber(
        params,
        "targetBase",
        preset.scenario.targetBaseElevationM,
      ),
      surfaceDistanceM: parseNumber(params, "distance", preset.scenario.surfaceDistanceM),
      radiusM: parseNumber(params, "radius", preset.scenario.radiusM),
      targetSampleCount: parseNumber(
        params,
        "samples",
        preset.scenario.targetSampleCount,
      ),
      presetId,
      coordinates: {
        enabled:
          params.get("coords") == null
            ? preset.scenario.coordinates.enabled
            : params.get("coords") !== "0",
        observerLatDeg: normalizeLatitudeDeg(
          parseNumber(params, "observerLat", preset.scenario.coordinates.observerLatDeg),
        ),
        observerLonDeg: normalizeLongitudeDeg(
          parseNumber(params, "observerLon", preset.scenario.coordinates.observerLonDeg),
        ),
        targetLatDeg: normalizeLatitudeDeg(
          parseNumber(params, "targetLat", preset.scenario.coordinates.targetLatDeg),
        ),
        targetLonDeg: normalizeLongitudeDeg(
          parseNumber(params, "targetLon", preset.scenario.coordinates.targetLonDeg),
        ),
      },
    }),
    primaryModel,
    comparisonModel,
    analysisTab: normalizeAnalysisTab(params.get("tab") ?? defaults.analysisTab),
    viewMode:
      params.get("view") == null
        ? defaults.viewMode
        : params.get("view") === "compare"
          ? "compare"
          : "cross-section",
    focusedModel:
      params.get("focus") == null
        ? defaults.focusedModel
        : params.get("focus") === "comparison"
          ? "comparison"
          : "primary",
    sceneViewport: {
      framingMode: params.get("frame") === "full" ? "full" : "auto",
      scaleMode: normalizeScaleMode(params.get("scale") ?? defaults.sceneViewport.scaleMode),
      compareLayout: normalizeCompareLayout(
        params.get("compareLayout") ?? defaults.sceneViewport.compareLayout,
      ),
      zoom: parseNumber(params, "zoom", defaults.sceneViewport.zoom),
      verticalZoom: parseNumber(
        params,
        "vzoom",
        defaults.sceneViewport.verticalZoom,
      ),
      panX: parseNumber(params, "panX", defaults.sceneViewport.panX),
      panY: parseNumber(params, "panY", defaults.sceneViewport.panY),
    },
    sweepConfig: {
      parameter: normalizeSweepParameter(
        params.get("sweepParameter") ?? defaults.sweepConfig.parameter,
      ),
      metric: normalizeSweepMetric(
        params.get("sweepMetric") ?? defaults.sweepConfig.metric,
      ),
      rangeMode: normalizeSweepRangeMode(
        params.get("sweepRange") ?? defaults.sweepConfig.rangeMode,
      ),
      sampleCount: clamp(
        parseNumber(params, "sweepSamples", defaults.sweepConfig.sampleCount),
        8,
        80,
      ),
    },
    unitPreferences: {
      height: normalizeHeightUnit(
        params.get("heightUnit") ?? defaults.unitPreferences.height,
      ),
      distance: normalizeDistanceUnit(
        params.get("distanceUnit") ?? defaults.unitPreferences.distance,
      ),
      radius: normalizeRadiusUnit(
        params.get("radiusUnit") ?? defaults.unitPreferences.radius,
      ),
    },
    annotated:
      params.get("annotated") == null ? defaults.annotated : params.get("annotated") !== "0",
    labelDensity: normalizeLabelDensity(
      params.get("labels") ?? defaults.labelDensity,
    ),
    theme: normalizeThemeMode(params.get("theme") ?? defaults.theme),
    language: normalizeLanguageMode(params.get("language") ?? defaults.language),
    workspaceMode: normalizeWorkspaceMode(
      params.get("workspace") ?? defaults.workspaceMode,
    ),
    fullWidthScene:
      params.get("fullWidth") == null
        ? defaults.fullWidthScene
        : params.get("fullWidth") !== "0",
    fitContentHeight:
      params.get("fitHeight") == null
        ? defaults.fitContentHeight
        : params.get("fitHeight") !== "0",
    showScaleGuides:
      params.get("scales") == null
        ? defaults.showScaleGuides
        : params.get("scales") !== "0",
    showTerrainOverlay:
      params.get("terrain") == null
        ? defaults.showTerrainOverlay
        : params.get("terrain") !== "0",
    useTerrainObstruction:
      params.get("terrainBlock") == null
        ? defaults.useTerrainObstruction
        : params.get("terrainBlock") !== "0",
    selectedSceneKey: null,
    selectedFeatureId: null,
    hoveredSceneKey: null,
    hoveredFeatureId: null,
  };
}
