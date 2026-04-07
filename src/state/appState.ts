import {
  applyPresetToModel,
  defaultComparisonModel,
  defaultPrimaryModel,
  defaultScenario,
  getPresetById,
} from "../domain/presets";
import type {
  FocusedModel,
  GeometryMode,
  IntrinsicCurvatureMode,
  ModelConfig,
  ScenarioInput,
  ViewMode,
} from "../domain/types";

export interface AppState {
  scenario: ScenarioInput;
  primaryModel: ModelConfig;
  comparisonModel: ModelConfig;
  viewMode: ViewMode;
  focusedModel: FocusedModel;
  annotated: boolean;
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
  | { type: "setAnnotated"; value: boolean }
  | { type: "setHoveredFeature"; value: string | null }
  | { type: "applyPreset"; presetId: string };

export function createDefaultState(): AppState {
  return {
    scenario: defaultScenario,
    primaryModel: defaultPrimaryModel,
    comparisonModel: defaultComparisonModel,
    viewMode: "cross-section",
    focusedModel: "primary",
    annotated: true,
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
        action.key === "mode" ? action.value : Number(action.value),
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
    case "setAnnotated":
      return { ...state, annotated: action.value };
    case "setHoveredFeature":
      return { ...state, hoveredFeatureId: action.value };
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
      coefficient: parseNumber(
        params,
        `${prefix}AtmosphereK`,
        fallback.atmosphere.coefficient,
      ),
    },
  };
}

export function serializeStateToSearch(state: AppState): string {
  const params = new URLSearchParams();
  params.set("preset", state.scenario.presetId);
  params.set("view", state.viewMode);
  params.set("focus", state.focusedModel);
  params.set("annotated", state.annotated ? "1" : "0");
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
    annotated: params.get("annotated") !== "0",
    hoveredFeatureId: null,
  };
}

