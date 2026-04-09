import { ATMOSPHERE_COEFFICIENT_DEFAULT } from "./curvature";
import type {
  AtmosphereConfig,
  LineBehaviorConfig,
  ModelConfig,
  ScenarioInput,
} from "./types";

export type PresetVerificationStatus = "verified" | "source-inspired" | "illustrative";

type PresetModelOverride = Omit<Partial<ModelConfig>, "atmosphere" | "lineBehavior"> & {
  atmosphere?: Partial<AtmosphereConfig>;
  lineBehavior?: Partial<LineBehaviorConfig>;
};

export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  scenario: ScenarioInput;
  verificationStatus: PresetVerificationStatus;
  provenance?: string;
  sourceUrl?: string;
  assumptions?: string[];
  primaryModel?: PresetModelOverride;
  comparisonModel?: PresetModelOverride;
}

export const defaultScenario: ScenarioInput = {
  scenarioMode: "simple",
  observerHeightM: 2,
  observerSurfaceElevationM: 0,
  observerEyeHeightM: 2,
  targetHeightM: 18,
  targetBaseElevationM: 0,
  surfaceDistanceM: 24_000,
  radiusM: 6_371_000,
  targetSampleCount: 18,
  presetId: "low-ship",
  units: "metric",
  coordinates: {
    enabled: false,
    observerLatDeg: 0,
    observerLonDeg: 0,
    targetLatDeg: 0,
    targetLonDeg: 0,
  },
};

export const defaultPrimaryModel: ModelConfig = {
  id: "primary",
  label: "Convex Sphere + Atmosphere",
  geometryMode: "convex",
  intrinsicCurvatureMode: "none",
  intrinsicCurvaturePerM: 0,
  atmosphere: {
    mode: "simpleCoefficient",
    coefficient: ATMOSPHERE_COEFFICIENT_DEFAULT,
    upperCoefficient: 0.02,
    transitionHeightM: 12_000,
    inversionStrength: 0,
    inversionBaseHeightM: 50,
    inversionDepthM: 200,
  },
  lineBehavior: {
    referenceConstruction: "curved-altitude",
    opticalHorizonRay: "traced",
    objectLightPath: "traced",
    apparentDirection: "auto",
    showSourceGeometricPath: true,
    showObserverHorizontal: true,
    showGeometricHorizon: true,
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
    coefficient: ATMOSPHERE_COEFFICIENT_DEFAULT,
    upperCoefficient: 0.02,
    transitionHeightM: 12_000,
    inversionStrength: 0,
    inversionBaseHeightM: 50,
    inversionDepthM: 200,
  },
  lineBehavior: {
    referenceConstruction: "curvilinear-tangent",
    opticalHorizonRay: "traced",
    objectLightPath: "traced",
    apparentDirection: "auto",
    showSourceGeometricPath: true,
    showObserverHorizontal: true,
    showGeometricHorizon: true,
  },
};

export const scenarioPresets: ScenarioPreset[] = [
  {
    id: "low-ship",
    name: "Low Observer Ship",
    description: "A near-sea-level observer looking toward a ship near the horizon.",
    scenario: defaultScenario,
    verificationStatus: "illustrative",
    provenance: "Educational sandbox preset for near-sea-level obstruction behavior.",
    assumptions: [
      "Sea-level observer and sea-level target base are assumed.",
      "Target height is treated as top elevation above the datum in simple mode.",
    ],
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
    verificationStatus: "illustrative",
    provenance: "Educational comparison preset emphasizing horizon shift with observer height.",
  },
  {
    id: "aconcagua-study",
    name: "Aconcagua Study",
    description:
      "Roxas-inspired long-range mountain visibility case using the classic Aconcagua plate values: observer 6,400 m, target 7,040 m, distance 460 km.",
    scenario: {
      ...defaultScenario,
      observerHeightM: 6_400,
      targetHeightM: 7_040,
      surfaceDistanceM: 460_000,
      targetSampleCount: 28,
      presetId: "aconcagua-study",
    },
    verificationStatus: "source-inspired",
    provenance:
      "Plate-derived long-range case inspired by the Roxas Aconcagua comparison diagram.",
    assumptions: [
      "Observer and target heights are preserved from the plate as simple top elevations.",
      "Terrain profile is stylized to match the comparative plate rather than full surveyed terrain.",
    ],
    comparisonModel: {
      intrinsicCurvatureMode: "1/R",
      lineBehavior: {
        referenceConstruction: "curvilinear-tangent",
        opticalHorizonRay: "traced",
        objectLightPath: "traced",
        apparentDirection: "auto",
        showSourceGeometricPath: true,
        showObserverHorizontal: false,
        showGeometricHorizon: false,
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
    verificationStatus: "illustrative",
    provenance: "Medium-range marine structure preset for lower-obstruction demonstrations.",
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
    verificationStatus: "source-inspired",
    provenance:
      "Long flat-water observation inspired by Lake Pontchartrain visibility discussions.",
    assumptions: [
      "Current values are approximate and intended for comparison-first study rather than documentary reproduction.",
    ],
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
    verificationStatus: "source-inspired",
    provenance:
      "Skyline-style case inspired by Chicago across Lake Michigan visibility claims.",
    assumptions: [
      "Skyline height is simplified into one target top elevation in simple mode.",
    ],
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
    verificationStatus: "source-inspired",
    provenance: "High-altitude balloon horizon case centered on a 100,000 ft observer height.",
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
    verificationStatus: "illustrative",
    provenance: "Exploratory preset for stressing intrinsic concave bending behavior.",
    comparisonModel: {
      intrinsicCurvatureMode: "constant",
      intrinsicCurvaturePerM: 3.1e-7,
      atmosphere: {
        mode: "simpleCoefficient",
        coefficient: 0.04,
      },
    },
  },
  {
    id: "six-foot-horizon",
    name: "6 ft Sea-Level Horizon",
    description:
      "A 6 ft observer at sea level looking directly toward the geometric horizon.",
    scenario: {
      ...defaultScenario,
      observerHeightM: 1.8288,
      targetHeightM: 0,
      surfaceDistanceM: 4_830,
      targetSampleCount: 8,
      presetId: "six-foot-horizon",
    },
    verificationStatus: "verified",
    provenance: "Geometric horizon baseline for a 6 ft sea-level observer.",
    assumptions: ["Target top elevation is set to the datum to isolate horizon placement."],
  },
  {
    id: "great-orme-blackpool",
    name: "Great Orme To Blackpool Tower",
    description:
      "A classic long-range case using the Great Orme summit and Blackpool Tower heights across roughly 75.3 km.",
    scenario: {
      ...defaultScenario,
      observerHeightM: 207,
      targetHeightM: 158,
      surfaceDistanceM: 75_344,
      targetSampleCount: 24,
      presetId: "great-orme-blackpool",
    },
    verificationStatus: "source-inspired",
    provenance:
      "Long-range landmark case using approximate published summit and tower heights.",
    assumptions: [
      "Observer and target are simplified into one sightline pair without terrain in between.",
    ],
  },
  {
    id: "canigou-marseille",
    name: "Canigou From Marseille Heights",
    description:
      "A long-range mountain case inspired by observations of Canigou from the Marseille heights at roughly 263 km.",
    scenario: {
      ...defaultScenario,
      observerHeightM: 150,
      targetHeightM: 2_785,
      surfaceDistanceM: 263_000,
      targetSampleCount: 30,
      presetId: "canigou-marseille",
    },
    verificationStatus: "source-inspired",
    provenance:
      "Long-range mountain case inspired by Marseille-to-Canigou visibility reports.",
    assumptions: [
      "Current preset values are scenario-study approximations rather than a field-survey package.",
    ],
    primaryModel: {
      atmosphere: {
        mode: "simpleCoefficient",
        coefficient: 0.1,
      },
    },
  },
];

export function getPresetById(id: string): ScenarioPreset {
  return scenarioPresets.find((preset) => preset.id === id) ?? scenarioPresets[0];
}

export function applyPresetToModel(
  baseModel: ModelConfig,
  override: PresetModelOverride | undefined,
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
    lineBehavior: override.lineBehavior
      ? { ...baseModel.lineBehavior, ...override.lineBehavior }
      : baseModel.lineBehavior,
  };
}
