import type { Dispatch } from "react";
import { t, type LanguageMode } from "../../i18n";
import type { AppAction, AppState } from "../../state/appState";

interface SceneToolbarProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  suggestedVerticalScale: number;
  isFullscreen: boolean;
  showLegend: boolean;
  onToggleLegend: () => void;
  onToggleFullscreen: () => void;
  language: LanguageMode;
}

function ControlButton({
  label,
  onClick,
  active = false,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={active ? "scene-toolbar__button scene-toolbar__button--active" : "scene-toolbar__button"}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function SceneToolbar({
  state,
  dispatch,
  suggestedVerticalScale,
  isFullscreen,
  showLegend,
  onToggleLegend,
  onToggleFullscreen,
  language,
}: SceneToolbarProps) {
  const scaleSummary =
    state.sceneViewport.scaleMode === "true-scale"
      ? t(language, "scaleSummaryTrue", {
          vertical: state.sceneViewport.verticalZoom.toFixed(2),
        })
      : state.sceneViewport.scaleMode === "survey"
        ? t(language, "scaleSummarySurvey", {
            vertical: state.sceneViewport.verticalZoom.toFixed(2),
          })
        : t(language, "scaleSummaryDiagram", {
            base: suggestedVerticalScale.toFixed(1),
            vertical: state.sceneViewport.verticalZoom.toFixed(2),
          });

  return (
    <div className="scene-toolbar">
      <div className="scene-toolbar__group">
        <span className="scene-toolbar__label">{t(language, "frame")}</span>
        <ControlButton
          label={t(language, "autoFit")}
          active={state.sceneViewport.framingMode === "auto"}
          onClick={() => {
            dispatch({
              type: "setViewportField",
              key: "framingMode",
              value: "auto",
            });
            dispatch({ type: "setViewportField", key: "panX", value: 0 });
            dispatch({ type: "setViewportField", key: "panY", value: 0 });
          }}
        />
        <ControlButton
          label={t(language, "fullSpan")}
          active={state.sceneViewport.framingMode === "full"}
          onClick={() => {
            dispatch({
              type: "setViewportField",
              key: "framingMode",
              value: "full",
            });
            dispatch({ type: "setViewportField", key: "panX", value: 0 });
            dispatch({ type: "setViewportField", key: "panY", value: 0 });
          }}
        />
      </div>

      {state.workspaceMode !== "professional" ? (
        <div className="scene-toolbar__group">
          <span className="scene-toolbar__label">{t(language, "layout")}</span>
          <ControlButton
            label={t(language, "fullWidth")}
            active={state.fullWidthScene}
            onClick={() => dispatch({ type: "setFullWidthScene", value: true })}
          />
          <ControlButton
            label={t(language, "docked")}
            active={!state.fullWidthScene}
            onClick={() => dispatch({ type: "setFullWidthScene", value: false })}
          />
        </div>
      ) : null}

      <div className="scene-toolbar__group">
        <span className="scene-toolbar__label">{t(language, "scale")}</span>
        <ControlButton
          label={t(language, "survey")}
          active={state.sceneViewport.scaleMode === "survey"}
          onClick={() =>
            dispatch({
              type: "setViewportField",
              key: "scaleMode",
              value: "survey",
            })
          }
        />
        <ControlButton
          label={t(language, "trueScale")}
          active={state.sceneViewport.scaleMode === "true-scale"}
          onClick={() =>
            dispatch({
              type: "setViewportField",
              key: "scaleMode",
              value: "true-scale",
            })
          }
        />
        <ControlButton
          label={t(language, "diagram")}
          active={state.sceneViewport.scaleMode === "diagram"}
          onClick={() =>
            dispatch({
              type: "setViewportField",
              key: "scaleMode",
              value: "diagram",
            })
          }
        />
      </div>

      <div className="scene-toolbar__group">
        <span className="scene-toolbar__label">{t(language, "zoom")}</span>
        <ControlButton
          label="-"
          onClick={() => dispatch({ type: "adjustViewportZoom", delta: -0.15 })}
        />
        <span className="scene-toolbar__value">
          {state.sceneViewport.zoom.toFixed(2)}x
        </span>
        <ControlButton
          label="+"
          onClick={() => dispatch({ type: "adjustViewportZoom", delta: 0.15 })}
        />
      </div>

      <div className="scene-toolbar__group">
        <span className="scene-toolbar__label">{t(language, "vertical")}</span>
        <ControlButton
          label="-"
          onClick={() =>
            dispatch({ type: "adjustViewportVerticalZoom", delta: -0.2 })
          }
        />
        <span className="scene-toolbar__value">
          {state.sceneViewport.verticalZoom.toFixed(2)}x
        </span>
        <ControlButton
          label="+"
          onClick={() =>
            dispatch({ type: "adjustViewportVerticalZoom", delta: 0.2 })
          }
        />
      </div>

      <div className="scene-toolbar__group scene-toolbar__group--meta">
        <span className="scene-toolbar__meta scene-toolbar__meta--hint">
          {t(language, "hoverHint")}
        </span>
        <span className="scene-toolbar__meta">{scaleSummary}</span>
        <ControlButton
          label={t(language, "reset")}
          onClick={() => dispatch({ type: "resetViewport" })}
        />
      </div>

      <div className="scene-toolbar__group">
        <ControlButton
          label={t(language, "legend")}
          active={showLegend}
          onClick={onToggleLegend}
        />
        <ControlButton
          label={isFullscreen ? t(language, "exitFullscreen") : t(language, "fullscreen")}
          onClick={onToggleFullscreen}
        />
      </div>
    </div>
  );
}
