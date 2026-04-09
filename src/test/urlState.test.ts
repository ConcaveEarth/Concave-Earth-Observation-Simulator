import {
  type AppState,
  createDefaultState,
  hydrateStateFromSearch,
  serializeStateToSearch,
} from "../state/appState";

describe("URL state round-tripping", () => {
  it("serializes and hydrates scenario and view selections", () => {
    const state: AppState = {
      ...createDefaultState(),
      viewMode: "compare" as const,
      focusedModel: "comparison" as const,
      annotated: false,
      labelDensity: "full" as const,
      theme: "blueprint" as const,
      language: "it" as const,
      workspaceMode: "simple" as const,
      fullWidthScene: false,
      fitContentHeight: false,
      showScaleGuides: false,
      showTerrainOverlay: false,
      useTerrainObstruction: false,
      sceneViewport: {
        ...createDefaultState().sceneViewport,
        framingMode: "full" as const,
        scaleMode: "diagram" as const,
        compareLayout: "stacked" as const,
        zoom: 1.4,
        verticalZoom: 2.2,
        panX: 1400,
        panY: -220,
      },
      unitPreferences: {
        height: "ft" as const,
        distance: "mi" as const,
        radius: "mi" as const,
      },
      scenario: {
        ...createDefaultState().scenario,
        observerHeightM: 34,
        targetHeightM: 93,
        surfaceDistanceM: 77_000,
        coordinates: {
          enabled: true,
          observerLatDeg: 29.95,
          observerLonDeg: -90.07,
          targetLatDeg: 30.31,
          targetLonDeg: -89.8,
        },
      },
      primaryModel: {
        ...createDefaultState().primaryModel,
        lineBehavior: {
          ...createDefaultState().primaryModel.lineBehavior,
          referenceConstruction: "straight-horizontal",
          objectLightPath: "straight",
          showSourceGeometricPath: false,
        },
      },
    };

    const hydrated = hydrateStateFromSearch(serializeStateToSearch(state));

    expect(hydrated.viewMode).toBe("compare");
    expect(hydrated.focusedModel).toBe("comparison");
    expect(hydrated.annotated).toBe(false);
    expect(hydrated.labelDensity).toBe("full");
    expect(hydrated.theme).toBe("blueprint");
    expect(hydrated.language).toBe("it");
    expect(hydrated.workspaceMode).toBe("simple");
    expect(hydrated.fullWidthScene).toBe(false);
    expect(hydrated.fitContentHeight).toBe(false);
    expect(hydrated.showScaleGuides).toBe(false);
    expect(hydrated.showTerrainOverlay).toBe(false);
    expect(hydrated.useTerrainObstruction).toBe(false);
    expect(hydrated.sceneViewport.framingMode).toBe("full");
    expect(hydrated.sceneViewport.scaleMode).toBe("diagram");
    expect(hydrated.sceneViewport.compareLayout).toBe("stacked");
    expect(hydrated.sceneViewport.zoom).toBe(1.4);
    expect(hydrated.sceneViewport.verticalZoom).toBe(2.2);
    expect(hydrated.sceneViewport.panX).toBe(1400);
    expect(hydrated.sceneViewport.panY).toBe(-220);
    expect(hydrated.unitPreferences.height).toBe("ft");
    expect(hydrated.unitPreferences.distance).toBe("mi");
    expect(hydrated.unitPreferences.radius).toBe("mi");
    expect(hydrated.scenario.observerHeightM).toBe(34);
    expect(hydrated.scenario.targetHeightM).toBe(93);
    expect(hydrated.scenario.coordinates.enabled).toBe(true);
    expect(hydrated.scenario.coordinates.observerLatDeg).toBeCloseTo(29.95);
    expect(hydrated.scenario.coordinates.observerLonDeg).toBeCloseTo(-90.07);
    expect(hydrated.scenario.coordinates.targetLatDeg).toBeCloseTo(30.31);
    expect(hydrated.scenario.coordinates.targetLonDeg).toBeCloseTo(-89.8);
    expect(hydrated.scenario.surfaceDistanceM).toBeGreaterThan(0);
    expect(hydrated.primaryModel.lineBehavior.referenceConstruction).toBe(
      "straight-horizontal",
    );
    expect(hydrated.primaryModel.lineBehavior.objectLightPath).toBe("straight");
    expect(hydrated.primaryModel.lineBehavior.showSourceGeometricPath).toBe(false);
  });
});
