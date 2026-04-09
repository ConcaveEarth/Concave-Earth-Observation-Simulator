import type { ScenarioInput, ScenarioMode } from "./types";

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}

export function getObserverSurfaceElevationM(scenario: ScenarioInput): number {
  return scenario.scenarioMode === "field" ? clampNonNegative(scenario.observerSurfaceElevationM) : 0;
}

export function getObserverEyeHeightM(scenario: ScenarioInput): number {
  return scenario.scenarioMode === "field"
    ? clampNonNegative(scenario.observerEyeHeightM)
    : clampNonNegative(scenario.observerHeightM);
}

export function getObserverTotalHeightM(scenario: ScenarioInput): number {
  return scenario.scenarioMode === "field"
    ? getObserverSurfaceElevationM(scenario) + getObserverEyeHeightM(scenario)
    : clampNonNegative(scenario.observerHeightM);
}

export function getTargetBaseElevationM(scenario: ScenarioInput): number {
  return scenario.scenarioMode === "field" ? clampNonNegative(scenario.targetBaseElevationM) : 0;
}

export function getTargetObjectHeightM(scenario: ScenarioInput): number {
  return clampNonNegative(scenario.targetHeightM);
}

export function getTargetTopElevationM(scenario: ScenarioInput): number {
  return getTargetBaseElevationM(scenario) + getTargetObjectHeightM(scenario);
}

export function normalizeScenarioInput(scenario: ScenarioInput): ScenarioInput {
  const scenarioMode: ScenarioMode = scenario.scenarioMode === "field" ? "field" : "simple";

  if (scenarioMode === "field") {
    const observerSurfaceElevationM = clampNonNegative(scenario.observerSurfaceElevationM);
    const observerEyeHeightM = clampNonNegative(scenario.observerEyeHeightM);
    const targetBaseElevationM = clampNonNegative(scenario.targetBaseElevationM);
    const targetHeightM = clampNonNegative(scenario.targetHeightM);

    return {
      ...scenario,
      scenarioMode,
      observerSurfaceElevationM,
      observerEyeHeightM,
      observerHeightM: observerSurfaceElevationM + observerEyeHeightM,
      targetBaseElevationM,
      targetHeightM,
    };
  }

  const observerHeightM = clampNonNegative(scenario.observerHeightM);
  const targetTopElevationM = clampNonNegative(
    clampNonNegative(scenario.targetBaseElevationM) + clampNonNegative(scenario.targetHeightM),
  );

  return {
    ...scenario,
    scenarioMode,
    observerHeightM,
    observerSurfaceElevationM: 0,
    observerEyeHeightM: observerHeightM,
    targetBaseElevationM: 0,
    targetHeightM: targetTopElevationM,
  };
}
