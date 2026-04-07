import { useDeferredValue, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { buildSceneViewModel, solveVisibility } from "./domain";
import { hydrateStateFromSearch, appReducer, serializeStateToSearch } from "./state/appState";
import { ControlsPanel } from "./ui/components/ControlsPanel";
import { RightPanel } from "./ui/components/RightPanel";
import { SceneSvg } from "./ui/components/SceneSvg";
import { SceneToolbar } from "./ui/components/SceneToolbar";
import { downloadSvgAsPng } from "./ui/exportSvg";

function getSceneFilename(viewMode: string): string {
  return `observation-geometry-lab-${viewMode}.png`;
}

export default function App() {
  const [state, dispatch] = useReducer(
    appReducer,
    window.location.search,
    hydrateStateFromSearch,
  );
  const deferredState = useDeferredValue(state);
  const [message, setMessage] = useState<string | null>(null);
  const sceneHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const search = serializeStateToSearch(state);
    window.history.replaceState({}, "", `${window.location.pathname}${search}`);
  }, [state]);

  const primaryResult = useMemo(
    () => solveVisibility(deferredState.scenario, deferredState.primaryModel),
    [deferredState],
  );
  const comparisonResult = useMemo(
    () => solveVisibility(deferredState.scenario, deferredState.comparisonModel),
    [deferredState],
  );

  const primaryScene = useMemo(
    () => buildSceneViewModel(primaryResult, "Primary Model", "primary"),
    [primaryResult],
  );
  const comparisonScene = useMemo(
    () => buildSceneViewModel(comparisonResult, "Comparison Model", "comparison"),
    [comparisonResult],
  );

  const scenes =
    deferredState.viewMode === "compare"
      ? [primaryScene, comparisonScene]
      : [deferredState.focusedModel === "primary" ? primaryScene : comparisonScene];

  const inspectedSceneKey =
    state.hoveredSceneKey ??
    (deferredState.viewMode === "compare" ? "primary" : deferredState.focusedModel);
  const inspectedResult =
    inspectedSceneKey === "primary" ? primaryResult : comparisonResult;
  const inspectedScene =
    inspectedSceneKey === "primary" ? primaryScene : comparisonScene;
  const displayedScenes = scenes;
  const suggestedVerticalScale =
    displayedScenes.reduce(
      (largest, scene) => Math.max(largest, scene.suggestedVerticalScale),
      1,
    );

  async function handleExport() {
    const svg = sceneHostRef.current?.querySelector("svg");

    if (!svg) {
      setMessage("The scene was not ready to export.");
      return;
    }

    try {
      await downloadSvgAsPng(svg as SVGSVGElement, getSceneFilename(state.viewMode));
      setMessage("PNG exported from the current view.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "PNG export failed unexpectedly.",
      );
    }
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}${window.location.pathname}${serializeStateToSearch(state)}`;

    try {
      await navigator.clipboard.writeText(url);
      setMessage("Share link copied to the clipboard.");
    } catch {
      setMessage(url);
    }
  }

  return (
    <div className="app-shell">
      <div className="background-noise" />
      <ControlsPanel
        state={state}
        dispatch={dispatch}
        onExport={handleExport}
        onCopyLink={handleCopyLink}
      />

      <main className="center-panel">
        <header className="hero-card">
          <div>
            <p className="hero-card__eyebrow">Simulation-first / comparison-first</p>
            <h2>Observation Geometry Lab</h2>
          </div>
          <p className="hero-card__text">
            Shared geometry and ray-path outputs drive both the diagram and the numeric
            comparison layer, so every panel reflects the same underlying solve.
          </p>
        </header>

        <div className="scene-card panel" ref={sceneHostRef}>
          <SceneToolbar
            state={state}
            dispatch={dispatch}
            suggestedVerticalScale={suggestedVerticalScale}
          />
          <SceneSvg
            scenes={scenes}
            annotated={state.annotated}
            hoveredFeatureId={state.hoveredFeatureId}
            hoveredSceneKey={state.hoveredSceneKey}
            framingMode={state.sceneViewport.framingMode}
            zoom={state.sceneViewport.zoom}
            verticalZoom={state.sceneViewport.verticalZoom}
            onHoverFeature={(sceneKey, featureId) =>
              dispatch({ type: "setHoveredFeature", sceneKey, value: featureId })
            }
          />
        </div>
      </main>

      <RightPanel
        state={state}
        activeResult={inspectedResult}
        activeScene={inspectedScene}
        inspectedSceneKey={inspectedSceneKey}
        onExport={handleExport}
        onCopyLink={handleCopyLink}
        message={message}
      />
    </div>
  );
}
