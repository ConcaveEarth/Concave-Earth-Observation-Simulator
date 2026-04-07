import { useDeferredValue, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { buildSceneViewModel, solveVisibility } from "./domain";
import { hydrateStateFromSearch, appReducer, serializeStateToSearch } from "./state/appState";
import { ControlsPanel } from "./ui/components/ControlsPanel";
import { RightPanel } from "./ui/components/RightPanel";
import { SceneLegendOverlay } from "./ui/components/SceneLegendOverlay";
import { SceneSvg } from "./ui/components/SceneSvg";
import { SceneToolbar } from "./ui/components/SceneToolbar";
import { TopNav } from "./ui/components/TopNav";
import { AppFooter } from "./ui/components/AppFooter";
import { downloadSvgAsPng } from "./ui/exportSvg";
import { t } from "./i18n";

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
  const [showLegendOverlay, setShowLegendOverlay] = useState(true);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const search = serializeStateToSearch(state);
    window.history.replaceState({}, "", `${window.location.pathname}${search}`);
  }, [state]);

  useEffect(() => {
    document.documentElement.lang = state.language;
  }, [state.language]);

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

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
    () =>
      buildSceneViewModel(
        primaryResult,
        t(deferredState.language, "primaryModelTitle"),
        "primary",
        deferredState.unitPreferences,
        deferredState.language,
      ),
    [primaryResult, deferredState.language, deferredState.unitPreferences],
  );
  const comparisonScene = useMemo(
    () =>
      buildSceneViewModel(
        comparisonResult,
        t(deferredState.language, "comparisonModelTitle"),
        "comparison",
        deferredState.unitPreferences,
        deferredState.language,
      ),
    [comparisonResult, deferredState.language, deferredState.unitPreferences],
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
  const resolvedCompareLayout =
    state.sceneViewport.compareLayout === "auto"
      ? windowWidth < 1180 || (!state.fullWidthScene && windowWidth >= 1850)
        ? "stacked"
        : "side-by-side"
      : state.sceneViewport.compareLayout;
  const shouldShowLegendOverlay =
    state.workspaceMode === "professional" && state.fullWidthScene && showLegendOverlay;

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

  function handleSceneHoverFeature(
    sceneKey: "primary" | "comparison" | null,
    featureId: string | null,
  ) {
    dispatch({ type: "setHoveredFeature", sceneKey, value: featureId });
  }

  function handleSceneSelectFeature(
    sceneKey: "primary" | "comparison" | null,
    featureId: string | null,
  ) {
    if (featureId == null || sceneKey == null) {
      dispatch({ type: "clearSelectedFeature" });
      return;
    }

    dispatch({ type: "setSelectedFeature", sceneKey, value: featureId });
  }

  function handleLegendToggleFeature(
    sceneKey: "primary" | "comparison",
    featureId: string,
  ) {
    if (state.selectedSceneKey === sceneKey && state.selectedFeatureId === featureId) {
      dispatch({ type: "clearSelectedFeature" });
      return;
    }

    dispatch({ type: "setSelectedFeature", sceneKey, value: featureId });
  }

  return (
    <div
      className={`app-frame theme-${state.theme} workspace-${state.workspaceMode}`}
    >
      <div className="background-noise" />
      <TopNav
        theme={state.theme}
        language={state.language}
        workspaceMode={state.workspaceMode}
        onThemeChange={(value) => dispatch({ type: "setTheme", value })}
        onLanguageChange={(value) => dispatch({ type: "setLanguage", value })}
        onWorkspaceModeChange={(value) =>
          dispatch({ type: "setWorkspaceMode", value })
        }
      />

      <div
        className={
          state.fullWidthScene ? "app-shell app-shell--fullwidth-scene" : "app-shell"
        }
      >
        <ControlsPanel
          state={state}
          dispatch={dispatch}
          onExport={handleExport}
          onCopyLink={handleCopyLink}
          language={state.language}
        />

        <main className="center-panel">
          <div className="scene-card panel" ref={sceneHostRef}>
            <div className="scene-card__header">
              <div className="scene-card__intro">
                <p className="scene-card__eyebrow">{t(state.language, "simulationFirst")}</p>
                <h2>{t(state.language, "appEyebrow")}</h2>
                <p className="scene-card__text">
                  {t(state.language, "sharedSceneText")}
                </p>
              </div>

              <SceneToolbar
                state={state}
                dispatch={dispatch}
                suggestedVerticalScale={suggestedVerticalScale}
                isFullscreen={isSceneFullscreen}
                showLegend={shouldShowLegendOverlay}
                onToggleLegend={() => setShowLegendOverlay((current) => !current)}
                onToggleFullscreen={handleToggleFullscreen}
                language={state.language}
              />
            </div>

            <div
              className={
                shouldShowLegendOverlay
                  ? "scene-card__viewport scene-card__viewport--with-legend"
                  : "scene-card__viewport"
              }
            >
              <div className="scene-card__canvas">
                <SceneSvg
                  scenes={scenes}
                  annotated={state.annotated}
                  labelDensity={state.labelDensity}
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
                  compareLayout={resolvedCompareLayout}
                  zoom={state.sceneViewport.zoom}
                  verticalZoom={state.sceneViewport.verticalZoom}
                  panX={state.sceneViewport.panX}
                  panY={state.sceneViewport.panY}
                  unitPreferences={state.unitPreferences}
                  language={state.language}
                  onHoverFeature={handleSceneHoverFeature}
                  onSelectFeature={handleSceneSelectFeature}
                  onPanBy={(deltaX, deltaY) =>
                    dispatch({ type: "panViewport", deltaX, deltaY })
                  }
                  onAdjustZoom={(delta) =>
                    dispatch({ type: "adjustViewportZoom", delta })
                  }
                  onAdjustVerticalZoom={(delta) =>
                    dispatch({ type: "adjustViewportVerticalZoom", delta })
                  }
                />
              </div>
              <SceneLegendOverlay
                annotations={inspectedScene.annotations}
                sceneKey={inspectedScene.sceneKey}
                activeFeatureId={activeFeatureId}
                selectedFeatureId={state.selectedFeatureId}
                selectedSceneKey={state.selectedSceneKey}
                visible={shouldShowLegendOverlay}
                showTerrainOverlay={state.showTerrainOverlay}
                language={state.language}
                onHoverFeature={handleSceneHoverFeature}
                onToggleFeature={handleLegendToggleFeature}
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
          workspaceMode={state.workspaceMode}
          onExport={handleExport}
          onCopyLink={handleCopyLink}
          message={message}
          language={state.language}
          fullWidthScene={state.fullWidthScene}
        />
      </div>

      <AppFooter language={state.language} />
    </div>
  );
}
