import type { ModelConfig, ScenarioInput } from "./types";

export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  scenario: ScenarioInput;
  primaryModel?: Partial<ModelConfig>;
  comparisonModel?: Partial<ModelConfig>;
}

export const defaultScenario: ScenarioInput = {
  observerHeightM: 2,
  targetHeightM: 18,
  surfaceDistanceM: 24_000,
  radiusM: 6_371_000,
  targetSampleCount: 18,
  presetId: "low-ship",
  units: "metric",
};

export const defaultPrimaryModel: ModelConfig = {
  id: "primary",
  label: "Convex Sphere + Atmosphere",
  geometryMode: "convex",
  intrinsicCurvatureMode: "none",
  intrinsicCurvaturePerM: 0,
  atmosphere: {
    mode: "simpleCoefficient",
    coefficient: 0.13,
  },
};

export const defaultComparisonModel: ModelConfig = {
  id: "comparison",
  label: "Concave Shell + Intrinsic",
  geometryMode: "concave",
  intrinsicCurvatureMode: "2/R",
  intrinsicCurvaturePerM: 0,
  atmosphere: {
    mode: "simpleCoefficient",
    coefficient: 0.08,
  },
};

export const scenarioPresets: ScenarioPreset[] = [
  {
    id: "low-ship",
    name: "Low Observer Ship",
    description: "A near-sea-level observer looking toward a ship near the horizon.",
    scenario: defaultScenario,
  },
  {
    id: "elevated-observer",
    name: "Elevated Observer",
    description: "Raises the observer to show changed horizon placement and visibility.",
    scenario: {
      ...defaultScenario,
      observerHeightM: 45,
      targetHeightM: 35,
      surfaceDistanceM: 58_000,
      presetId: "elevated-observer",
    },
  },
  {
    id: "aconcagua-study",
    name: "Aconcagua Study",
    description:
      "Long-range mountain visibility case inspired by the classic Aconcagua comparison diagrams.",
    scenario: {
      ...defaultScenario,
      observerHeightM: 6_400,
      targetHeightM: 6_962,
      surfaceDistanceM: 460_000,
      targetSampleCount: 28,
      presetId: "aconcagua-study",
    },
    comparisonModel: {
      intrinsicCurvatureMode: "2/R",
      atmosphere: {
        mode: "simpleCoefficient",
        coefficient: 0.06,
      },
    },
  },
  {
    id: "oil-rig",
    name: "Oil Rig",
    description: "Medium-distance structure with lower obstruction emphasized.",
    scenario: {
      ...defaultScenario,
      observerHeightM: 5,
      targetHeightM: 62,
      surfaceDistanceM: 38_000,
      targetSampleCount: 24,
      presetId: "oil-rig",
    },
  },
  {
    id: "lake-pontchartrain",
    name: "Lake Pontchartrain",
    description:
      "Low-altitude observation across Lake Pontchartrain with a long flat-water path and modest target height.",
    scenario: {
      ...defaultScenario,
      observerHeightM: 2,
      targetHeightM: 18,
      surfaceDistanceM: 38_500,
      targetSampleCount: 24,
      presetId: "lake-pontchartrain",
    },
  },
  {
    id: "chicago-lake-michigan",
    name: "Chicago Across Lake Michigan",
    description:
      "A skyline-style long-water observation inspired by Chicago visibility discussions across Lake Michigan.",
    scenario: {
      ...defaultScenario,
      observerHeightM: 2,
      targetHeightM: 442,
      surfaceDistanceM: 96_000,
      targetSampleCount: 28,
      presetId: "chicago-lake-michigan",
    },
  },
  {
    id: "balloon-100kft",
    name: "High Balloon 100,000 ft",
    description:
      "High-altitude balloon observation from roughly 100,000 ft (30,480 m) to study the horizon from the stratosphere.",
    scenario: {
      ...defaultScenario,
      observerHeightM: 30_480,
      targetHeightM: 2_500,
      surfaceDistanceM: 620_000,
      targetSampleCount: 30,
      presetId: "balloon-100kft",
    },
    primaryModel: {
      atmosphere: {
        mode: "simpleCoefficient",
        coefficient: 0.08,
      },
    },
  },
  {
    id: "strong-concave-demo",
    name: "Strong Concave Demo",
    description:
      "A stylized preset to stress-test intrinsic upward bending under the concave-shell model.",
    scenario: {
      ...defaultScenario,
      observerHeightM: 3,
      targetHeightM: 24,
      surfaceDistanceM: 72_000,
      targetSampleCount: 24,
      presetId: "strong-concave-demo",
    },
    comparisonModel: {
      intrinsicCurvatureMode: "constant",
      intrinsicCurvaturePerM: 3.1e-7,
      atmosphere: {
        mode: "simpleCoefficient",
        coefficient: 0.04,
      },
    },
  },
];

export function getPresetById(id: string): ScenarioPreset {
  return scenarioPresets.find((preset) => preset.id === id) ?? scenarioPresets[0];
}

export function applyPresetToModel(
  baseModel: ModelConfig,
  override: Partial<ModelConfig> | undefined,
): ModelConfig {
  if (!override) {
    return baseModel;
  }

  return {
    ...baseModel,
    ...override,
    atmosphere: override.atmosphere
      ? { ...baseModel.atmosphere, ...override.atmosphere }
      : baseModel.atmosphere,
  };
}
