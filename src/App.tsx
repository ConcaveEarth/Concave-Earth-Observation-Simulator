import { useDeferredValue, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { buildSceneViewModel, solveVisibility } from "./domain";
import { hydrateStateFromSearch, appReducer, serializeStateToSearch } from "./state/appState";
import { ControlsPanel } from "./ui/components/ControlsPanel";
import { RightPanel } from "./ui/components/RightPanel";
import { SceneSvg } from "./ui/components/SceneSvg";
import { SceneToolbar } from "./ui/components/SceneToolbar";
import { TopNav } from "./ui/components/TopNav";
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
  const [isSceneFullscreen, setIsSceneFullscreen] = useState(false);

  useEffect(() => {
    const search = serializeStateToSearch(state);
    window.history.replaceState({}, "", `${window.location.pathname}${search}`);
  }, [state]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsSceneFullscreen(document.fullscreenElement === sceneHostRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    handleFullscreenChange();

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

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

  const visibleSceneKeys = new Set(scenes.map((scene) => scene.sceneKey));
  const hoveredSceneVisible =
    state.hoveredSceneKey !== null && visibleSceneKeys.has(state.hoveredSceneKey);
  const selectedSceneVisible =
    state.selectedSceneKey !== null && visibleSceneKeys.has(state.selectedSceneKey);
  const activeFeatureId = hoveredSceneVisible
    ? state.hoveredFeatureId
    : selectedSceneVisible
      ? state.selectedFeatureId
      : null;
  const activeSceneKey =
    hoveredSceneVisible
      ? state.hoveredSceneKey
      : selectedSceneVisible
        ? state.selectedSceneKey
        : null;
  const inspectedSceneKey =
    activeSceneKey ??
    (deferredState.viewMode === "compare" ? "primary" : deferredState.focusedModel);
  const inspectedResult =
    inspectedSceneKey === "primary" ? primaryResult : comparisonResult;
  const inspectedScene =
    inspectedSceneKey === "primary" ? primaryScene : comparisonScene;
  const isFeaturePinned =
    selectedSceneVisible && state.selectedFeatureId !== null && state.selectedSceneKey !== null;
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

  async function handleToggleFullscreen() {
    const sceneElement = sceneHostRef.current;

    if (!sceneElement) {
      setMessage("The scene workspace was not ready for fullscreen mode.");
      return;
    }

    try {
      if (document.fullscreenElement === sceneElement) {
        await document.exitFullscreen();
      } else {
        await sceneElement.requestFullscreen();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Fullscreen mode could not be started.",
      );
    }
  }

  return (
    <div className="app-frame">
      <div className="background-noise" />
      <TopNav />

      <div className="app-shell">
        <ControlsPanel
          state={state}
          dispatch={dispatch}
          onExport={handleExport}
          onCopyLink={handleCopyLink}
        />

        <main className="center-panel">
          <div className="scene-card panel" ref={sceneHostRef}>
            <div className="scene-card__header">
              <div className="scene-card__intro">
                <p className="scene-card__eyebrow">Simulation-first / comparison-first</p>
                <h2>Observation Geometry Lab</h2>
                <p className="scene-card__text">
                  Shared geometry and ray-path outputs drive both panels, so convex and
                  concave views remain locked to the same scenario while preserving their
                  own geometric and optical assumptions.
                </p>
              </div>

              <SceneToolbar
                state={state}
                dispatch={dispatch}
                suggestedVerticalScale={suggestedVerticalScale}
                isFullscreen={isSceneFullscreen}
                onToggleFullscreen={handleToggleFullscreen}
              />
            </div>

            <div className="scene-card__viewport">
              <SceneSvg
                scenes={scenes}
                annotated={state.annotated}
                showScaleGuides={state.showScaleGuides}
                showTerrainOverlay={state.showTerrainOverlay}
                activeFeatureId={activeFeatureId}
                activeSceneKey={activeSceneKey}
                hoveredFeatureId={state.hoveredFeatureId}
                hoveredSceneKey={state.hoveredSceneKey}
                selectedFeatureId={state.selectedFeatureId}
                selectedSceneKey={state.selectedSceneKey}
                framingMode={state.sceneViewport.framingMode}
                scaleMode={state.sceneViewport.scaleMode}
                zoom={state.sceneViewport.zoom}
                verticalZoom={state.sceneViewport.verticalZoom}
                onHoverFeature={(sceneKey, featureId) =>
                  dispatch({ type: "setHoveredFeature", sceneKey, value: featureId })
                }
                onSelectFeature={(sceneKey, featureId) => {
                  if (featureId == null || sceneKey == null) {
                    dispatch({ type: "clearSelectedFeature" });
                    return;
                  }

                  dispatch({ type: "setSelectedFeature", sceneKey, value: featureId });
                }}
              />
            </div>
          </div>
        </main>

        <RightPanel
          state={state}
          activeResult={inspectedResult}
          activeScene={inspectedScene}
          inspectedSceneKey={inspectedSceneKey}
          activeFeatureId={activeFeatureId}
          isFeaturePinned={Boolean(isFeaturePinned)}
          onClearSelection={() => dispatch({ type: "clearSelectedFeature" })}
          onExport={handleExport}
          onCopyLink={handleCopyLink}
          message={message}
        />
      </div>
    </div>
  );
}
