import {
  applyPresetToModel,
  defaultComparisonModel,
  defaultPrimaryModel,
  defaultScenario,
  getPresetById,
} from "../domain/presets";
import { clampAtmosphereCoefficient } from "../domain/curvature";
import type { LanguageMode } from "../i18n";
import { clamp, defaultUnitPreferences } from "../domain/units";
import type {
  FocusedModel,
  GeometryMode,
  IntrinsicCurvatureMode,
  ModelConfig,
  ScenarioInput,
  ViewMode,
} from "../domain/types";
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
  viewMode: ViewMode;
  focusedModel: FocusedModel;
  sceneViewport: SceneViewportState;
  unitPreferences: UnitPreferences;
  annotated: boolean;
  labelDensity: LabelDensityMode;
  theme: ThemeMode;
  language: LanguageMode;
  workspaceMode: WorkspaceMode;
  fullWidthScene: boolean;
  showScaleGuides: boolean;
  showTerrainOverlay: boolean;
  selectedSceneKey: FocusedModel | null;
  selectedFeatureId: string | null;
  hoveredSceneKey: FocusedModel | null;
  hoveredFeatureId: string | null;
}

export type AppAction =
  | { type: "setScenarioField"; key: keyof ScenarioInput; value: number | string }
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
      key: "mode" | "coefficient";
      value: number | string;
    }
  | { type: "setViewMode"; value: ViewMode }
  | { type: "setFocusedModel"; value: FocusedModel }
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
  | { type: "setAnnotated"; value: boolean }
  | { type: "setLabelDensity"; value: LabelDensityMode }
  | { type: "setTheme"; value: ThemeMode }
  | { type: "setLanguage"; value: LanguageMode }
  | { type: "setWorkspaceMode"; value: WorkspaceMode }
  | { type: "setFullWidthScene"; value: boolean }
  | { type: "setShowScaleGuides"; value: boolean }
  | { type: "setShowTerrainOverlay"; value: boolean }
  | { type: "setSelectedFeature"; sceneKey: FocusedModel | null; value: string | null }
  | { type: "clearSelectedFeature" }
  | { type: "setHoveredFeature"; sceneKey: FocusedModel | null; value: string | null }
  | { type: "applyPreset"; presetId: string };

export function createDefaultState(): AppState {
  return {
    scenario: defaultScenario,
    primaryModel: defaultPrimaryModel,
    comparisonModel: defaultComparisonModel,
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
    unitPreferences: defaultUnitPreferences,
    annotated: true,
    labelDensity: "adaptive",
    theme: "night-lab",
    language: "en",
    workspaceMode: "professional",
    fullWidthScene: true,
    showScaleGuides: true,
    showTerrainOverlay: true,
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
  return {
    ...model,
    atmosphere: {
      ...model.atmosphere,
      [action.key]:
        action.key === "mode"
          ? action.value
          : clampAtmosphereCoefficient(Number(action.value)),
    },
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "setScenarioField":
      return {
        ...state,
        scenario: {
          ...state.scenario,
          [action.key]:
            action.key === "presetId" || action.key === "units"
              ? action.value
              : Number(action.value),
        },
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
    case "setViewMode":
      return { ...state, viewMode: action.value };
    case "setFocusedModel":
      return { ...state, focusedModel: action.value };
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
    case "setShowScaleGuides":
      return { ...state, showScaleGuides: action.value };
    case "setShowTerrainOverlay":
      return { ...state, showTerrainOverlay: action.value };
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
        scenario: preset.scenario,
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

function serializeModel(prefix: string, model: ModelConfig, params: URLSearchParams): void {
  params.set(`${prefix}Geometry`, model.geometryMode);
  params.set(`${prefix}Intrinsic`, model.intrinsicCurvatureMode);
  params.set(`${prefix}IntrinsicValue`, String(model.intrinsicCurvaturePerM));
  params.set(`${prefix}AtmosphereMode`, model.atmosphere.mode);
  params.set(`${prefix}AtmosphereK`, String(model.atmosphere.coefficient));
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
      mode:
        atmosphereMode === "none" ? "none" : fallback.atmosphere.mode,
      coefficient: clampAtmosphereCoefficient(
        parseNumber(
          params,
          `${prefix}AtmosphereK`,
          fallback.atmosphere.coefficient,
        ),
      ),
    },
  };
}

export function serializeStateToSearch(state: AppState): string {
  const params = new URLSearchParams();
  params.set("preset", state.scenario.presetId);
  params.set("view", state.viewMode);
  params.set("focus", state.focusedModel);
  params.set("frame", state.sceneViewport.framingMode);
  params.set("scale", state.sceneViewport.scaleMode);
  params.set("compareLayout", state.sceneViewport.compareLayout);
  params.set("zoom", String(state.sceneViewport.zoom));
  params.set("vzoom", String(state.sceneViewport.verticalZoom));
  params.set("panX", String(state.sceneViewport.panX));
  params.set("panY", String(state.sceneViewport.panY));
  params.set("heightUnit", state.unitPreferences.height);
  params.set("distanceUnit", state.unitPreferences.distance);
  params.set("radiusUnit", state.unitPreferences.radius);
  params.set("annotated", state.annotated ? "1" : "0");
  params.set("labels", state.labelDensity);
  params.set("theme", state.theme);
  params.set("language", state.language);
  params.set("workspace", state.workspaceMode);
  params.set("fullWidth", state.fullWidthScene ? "1" : "0");
  params.set("scales", state.showScaleGuides ? "1" : "0");
  params.set("terrain", state.showTerrainOverlay ? "1" : "0");
  params.set("observer", String(state.scenario.observerHeightM));
  params.set("target", String(state.scenario.targetHeightM));
  params.set("distance", String(state.scenario.surfaceDistanceM));
  params.set("radius", String(state.scenario.radiusM));
  params.set("samples", String(state.scenario.targetSampleCount));
  serializeModel("primary", state.primaryModel, params);
  serializeModel("compare", state.comparisonModel, params);
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
    scenario: {
      ...preset.scenario,
      observerHeightM: parseNumber(params, "observer", preset.scenario.observerHeightM),
      targetHeightM: parseNumber(params, "target", preset.scenario.targetHeightM),
      surfaceDistanceM: parseNumber(params, "distance", preset.scenario.surfaceDistanceM),
      radiusM: parseNumber(params, "radius", preset.scenario.radiusM),
      targetSampleCount: parseNumber(
        params,
        "samples",
        preset.scenario.targetSampleCount,
      ),
      presetId,
    },
    primaryModel,
    comparisonModel,
    viewMode: params.get("view") === "compare" ? "compare" : "cross-section",
    focusedModel: params.get("focus") === "comparison" ? "comparison" : "primary",
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
    annotated: params.get("annotated") !== "0",
    labelDensity: normalizeLabelDensity(
      params.get("labels") ?? defaults.labelDensity,
    ),
    theme: normalizeThemeMode(params.get("theme") ?? defaults.theme),
    language: normalizeLanguageMode(params.get("language") ?? defaults.language),
    workspaceMode: normalizeWorkspaceMode(
      params.get("workspace") ?? defaults.workspaceMode,
    ),
    fullWidthScene: params.get("fullWidth") !== "0",
    showScaleGuides: params.get("scales") !== "0",
    showTerrainOverlay: params.get("terrain") !== "0",
    selectedSceneKey: null,
    selectedFeatureId: null,
    hoveredSceneKey: null,
    hoveredFeatureId: null,
  };
}
