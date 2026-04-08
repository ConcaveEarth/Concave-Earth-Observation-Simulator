import { useDeferredValue, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  buildRayBundlePanelData,
  buildSceneViewModel,
  buildSweepChartData,
  formatSweepParameterValue,
  solveVisibility,
} from "./domain";
import { hydrateStateFromSearch, appReducer, serializeStateToSearch } from "./state/appState";
import { AnalysisTabs } from "./ui/components/AnalysisTabs";
import { ControlsPanel } from "./ui/components/ControlsPanel";
import { PresentationToolbar } from "./ui/components/PresentationToolbar";
import { RayBundleView } from "./ui/components/RayBundleView";
import { RightPanel } from "./ui/components/RightPanel";
import { SceneLegendOverlay } from "./ui/components/SceneLegendOverlay";
import { SceneSvg } from "./ui/components/SceneSvg";
import { SceneToolbar } from "./ui/components/SceneToolbar";
import { SweepChart } from "./ui/components/SweepChart";
import { TopNav } from "./ui/components/TopNav";
import { AppFooter } from "./ui/components/AppFooter";
import { downloadSvgAsPng } from "./ui/exportSvg";
import { t } from "./i18n";

function getSceneFilename(analysisTab: string, viewMode: string): string {
  return `observation-geometry-lab-${analysisTab}-${viewMode}.png`;
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
  const primaryBundle = useMemo(
    () =>
      buildRayBundlePanelData(
        primaryResult,
        t(deferredState.language, "primaryModelTitle"),
        "primary",
      ),
    [primaryResult, deferredState.language],
  );
  const comparisonBundle = useMemo(
    () =>
      buildRayBundlePanelData(
        comparisonResult,
        t(deferredState.language, "comparisonModelTitle"),
        "comparison",
      ),
    [comparisonResult, deferredState.language],
  );
  const sweepData = useMemo(
    () =>
      buildSweepChartData({
        scenario: deferredState.scenario,
        primaryModel: deferredState.primaryModel,
        comparisonModel: deferredState.comparisonModel,
        focusedModel: deferredState.focusedModel,
        compareMode: deferredState.viewMode === "compare",
        config: deferredState.sweepConfig,
        language: deferredState.language,
      }),
    [
      deferredState.scenario,
      deferredState.primaryModel,
      deferredState.comparisonModel,
      deferredState.focusedModel,
      deferredState.viewMode,
      deferredState.sweepConfig,
      deferredState.language,
    ],
  );

  const scenes =
    deferredState.viewMode === "compare"
      ? [primaryScene, comparisonScene]
      : [deferredState.focusedModel === "primary" ? primaryScene : comparisonScene];
  const bundlePanels =
    deferredState.viewMode === "compare"
      ? [primaryBundle, comparisonBundle]
      : [deferredState.focusedModel === "primary" ? primaryBundle : comparisonBundle];

  const visibleSceneKeys = new Set(scenes.map((scene) => scene.sceneKey));
  const hoveredSceneVisible =
    state.hoveredSceneKey !== null && visibleSceneKeys.has(state.hoveredSceneKey);
  const selectedSceneVisible =
    state.selectedSceneKey !== null && visibleSceneKeys.has(state.selectedSceneKey);
  const interactionEnabled = deferredState.analysisTab === "cross-section";
  const activeFeatureId = interactionEnabled
    ? hoveredSceneVisible
      ? state.hoveredFeatureId
      : selectedSceneVisible
        ? state.selectedFeatureId
        : null
    : null;
  const activeSceneKey = interactionEnabled
    ? hoveredSceneVisible
      ? state.hoveredSceneKey
      : selectedSceneVisible
        ? state.selectedSceneKey
        : null
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
  const useSceneFirstLayout =
    state.workspaceMode === "professional" || state.fullWidthScene;
  const resolvedCompareLayout =
    state.sceneViewport.compareLayout === "auto"
      ? windowWidth < 1180
        ? "stacked"
        : "side-by-side"
      : state.sceneViewport.compareLayout;
  const stackedCompareView =
    state.viewMode === "compare" && resolvedCompareLayout === "stacked";
  const shouldShowLegendOverlay =
    deferredState.analysisTab === "cross-section" &&
    state.workspaceMode === "professional" &&
    useSceneFirstLayout &&
    showLegendOverlay;

  async function handleExport() {
    const svg = sceneHostRef.current?.querySelector("svg");

    if (!svg) {
      setMessage("The scene was not ready to export.");
      return;
    }

    try {
      await downloadSvgAsPng(
        svg as SVGSVGElement,
        getSceneFilename(state.analysisTab, state.viewMode),
      );
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
          useSceneFirstLayout ? "app-shell app-shell--fullwidth-scene" : "app-shell"
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
          <div
            className={
              deferredState.analysisTab === "ray-bundle"
                ? "scene-card scene-card--ray-bundle panel"
                : deferredState.analysisTab === "sweep"
                  ? "scene-card scene-card--sweep panel"
                  : "scene-card panel"
            }
            ref={sceneHostRef}
          >
            <div className="scene-card__header">
              <div className="scene-card__intro">
                <p className="scene-card__eyebrow">{t(state.language, "simulationFirst")}</p>
                <h2>{t(state.language, "appEyebrow")}</h2>
                <p className="scene-card__text">
                  {t(state.language, "sharedSceneText")}
                </p>
              </div>

              <div className="scene-card__tools">
                <AnalysisTabs
                  value={state.analysisTab}
                  language={state.language}
                  onChange={(value) => dispatch({ type: "setAnalysisTab", value })}
                />

                <PresentationToolbar
                  state={state}
                  dispatch={dispatch}
                  language={state.language}
                />

                {state.analysisTab === "cross-section" ? (
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
                ) : (
                  <div className="scene-toolbar scene-toolbar--compact">
                    <div className="scene-toolbar__group scene-toolbar__group--meta">
                      <span className="scene-toolbar__meta scene-toolbar__meta--hint">
                        {state.analysisTab === "ray-bundle"
                          ? t(state.language, "rayBundleIntro")
                          : `${t(state.language, "sweepIntro")} ${formatSweepParameterValue(
                              sweepData.range.min,
                              sweepData.parameter,
                              state.unitPreferences,
                            )} to ${formatSweepParameterValue(
                              sweepData.range.max,
                              sweepData.parameter,
                              state.unitPreferences,
                            )} • ${state.sweepConfig.sampleCount} solves`}
                      </span>
                    </div>
                    <div className="scene-toolbar__group">
                      <span className="scene-toolbar__label">{t(state.language, "zoom")}</span>
                      <button
                        type="button"
                        className="scene-toolbar__button"
                        onClick={() => dispatch({ type: "adjustViewportZoom", delta: -0.15 })}
                      >
                        -
                      </button>
                      <span className="scene-toolbar__value">
                        {state.sceneViewport.zoom.toFixed(2)}x
                      </span>
                      <button
                        type="button"
                        className="scene-toolbar__button"
                        onClick={() => dispatch({ type: "adjustViewportZoom", delta: 0.15 })}
                      >
                        +
                      </button>
                    </div>
                    <div className="scene-toolbar__group">
                      <span className="scene-toolbar__label">{t(state.language, "vertical")}</span>
                      <button
                        type="button"
                        className="scene-toolbar__button"
                        onClick={() =>
                          dispatch({ type: "adjustViewportVerticalZoom", delta: -0.2 })
                        }
                      >
                        -
                      </button>
                      <span className="scene-toolbar__value">
                        {state.sceneViewport.verticalZoom.toFixed(2)}x
                      </span>
                      <button
                        type="button"
                        className="scene-toolbar__button"
                        onClick={() =>
                          dispatch({ type: "adjustViewportVerticalZoom", delta: 0.2 })
                        }
                      >
                        +
                      </button>
                    </div>
                    <div className="scene-toolbar__group scene-toolbar__group--meta">
                      <span className="scene-toolbar__meta">
                        {t(state.language, "analysisViewportHint")}
                      </span>
                      <button
                        type="button"
                        className="scene-toolbar__button"
                        onClick={() => dispatch({ type: "resetViewport" })}
                      >
                        {t(state.language, "reset")}
                      </button>
                    </div>
                    <div className="scene-toolbar__group">
                      <button
                        type="button"
                        className="scene-toolbar__button"
                        onClick={handleToggleFullscreen}
                      >
                        {isSceneFullscreen
                          ? t(state.language, "exitFullscreen")
                          : t(state.language, "fullscreen")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {state.analysisTab === "cross-section" ? (
              <div
                className={
                  shouldShowLegendOverlay
                    ? stackedCompareView
                      ? "scene-card__viewport scene-card__viewport--with-legend scene-card__viewport--stacked-list"
                      : "scene-card__viewport scene-card__viewport--with-legend"
                    : stackedCompareView
                      ? "scene-card__viewport scene-card__viewport--stacked-list"
                      : "scene-card__viewport"
                }
              >
                <div
                  className={
                    stackedCompareView
                      ? "scene-stack-list"
                      : "scene-card__canvas"
                  }
                >
                  {stackedCompareView ? (
                    scenes.map((scene) => (
                      <div key={scene.sceneKey} className="scene-stack-item">
                        <SceneSvg
                          scenes={[scene]}
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
                          compareLayout="side-by-side"
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
                    ))
                  ) : (
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
                  )}
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
            ) : state.analysisTab === "ray-bundle" ? (
              <div
                className={
                  stackedCompareView
                    ? "scene-card__viewport scene-card__viewport--analysis scene-card__viewport--stacked-list"
                    : "scene-card__viewport scene-card__viewport--analysis"
                }
              >
                <div
                  className={
                    stackedCompareView
                      ? "scene-stack-list"
                      : "scene-card__canvas"
                  }
                >
                  {stackedCompareView ? (
                    bundlePanels.map((panel) => (
                      <div key={panel.sceneKey} className="scene-stack-item scene-stack-item--analysis">
                        <RayBundleView
                          panels={[panel]}
                          compareLayout="side-by-side"
                          unitPreferences={state.unitPreferences}
                          showScaleGuides={state.showScaleGuides}
                          zoom={state.sceneViewport.zoom}
                          verticalZoom={state.sceneViewport.verticalZoom}
                          panX={state.sceneViewport.panX}
                          panY={state.sceneViewport.panY}
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
                    ))
                  ) : (
                    <RayBundleView
                      panels={bundlePanels}
                      compareLayout={resolvedCompareLayout}
                      unitPreferences={state.unitPreferences}
                      showScaleGuides={state.showScaleGuides}
                      zoom={state.sceneViewport.zoom}
                      verticalZoom={state.sceneViewport.verticalZoom}
                      panX={state.sceneViewport.panX}
                      panY={state.sceneViewport.panY}
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
                  )}
                </div>
              </div>
            ) : (
              <div className="scene-card__viewport scene-card__viewport--analysis">
                <div className="scene-card__canvas">
                  <SweepChart
                    data={sweepData}
                    units={state.unitPreferences}
                    zoom={state.sceneViewport.zoom}
                    verticalZoom={state.sceneViewport.verticalZoom}
                    panX={state.sceneViewport.panX}
                    panY={state.sceneViewport.panY}
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
              </div>
            )}
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
          sceneFirstLayout={useSceneFirstLayout}
        />
      </div>

      <AppFooter language={state.language} />
    </div>
  );
}
