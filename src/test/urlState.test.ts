import {
  createDefaultState,
  hydrateStateFromSearch,
  serializeStateToSearch,
} from "../state/appState";

describe("URL state round-tripping", () => {
  it("serializes and hydrates scenario and view selections", () => {
    const state = {
      ...createDefaultState(),
      viewMode: "compare" as const,
      focusedModel: "comparison" as const,
      annotated: false,
      labelDensity: "full" as const,
      theme: "blueprint" as const,
      workspaceMode: "simple" as const,
      showScaleGuides: false,
      showTerrainOverlay: false,
      sceneViewport: {
        ...createDefaultState().sceneViewport,
        framingMode: "full" as const,
        scaleMode: "diagram" as const,
        compareLayout: "stacked" as const,
        zoom: 1.4,
        verticalZoom: 2.2,
      },
      scenario: {
        ...createDefaultState().scenario,
        observerHeightM: 34,
        targetHeightM: 93,
        surfaceDistanceM: 77_000,
      },
    };

    const hydrated = hydrateStateFromSearch(serializeStateToSearch(state));

    expect(hydrated.viewMode).toBe("compare");
    expect(hydrated.focusedModel).toBe("comparison");
    expect(hydrated.annotated).toBe(false);
    expect(hydrated.labelDensity).toBe("full");
    expect(hydrated.theme).toBe("blueprint");
    expect(hydrated.workspaceMode).toBe("simple");
    expect(hydrated.showScaleGuides).toBe(false);
    expect(hydrated.showTerrainOverlay).toBe(false);
    expect(hydrated.sceneViewport.framingMode).toBe("full");
    expect(hydrated.sceneViewport.scaleMode).toBe("diagram");
    expect(hydrated.sceneViewport.compareLayout).toBe("stacked");
    expect(hydrated.sceneViewport.zoom).toBe(1.4);
    expect(hydrated.sceneViewport.verticalZoom).toBe(2.2);
    expect(hydrated.scenario.observerHeightM).toBe(34);
    expect(hydrated.scenario.targetHeightM).toBe(93);
    expect(hydrated.scenario.surfaceDistanceM).toBe(77_000);
  });
});
