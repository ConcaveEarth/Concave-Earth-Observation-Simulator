import type { Dispatch } from "react";
import type { AppAction, AppState } from "../../state/appState";

interface SceneToolbarProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  suggestedVerticalScale: number;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
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
  onToggleFullscreen,
}: SceneToolbarProps) {
  const scaleSummary =
    state.sceneViewport.scaleMode === "true-scale"
      ? `True scale • vertical x${state.sceneViewport.verticalZoom.toFixed(2)}`
      : `Diagram base x${suggestedVerticalScale.toFixed(1)} • vertical x${state.sceneViewport.verticalZoom.toFixed(2)}`;

  return (
    <div className="scene-toolbar">
      <div className="scene-toolbar__group">
        <span className="scene-toolbar__label">Frame</span>
        <ControlButton
          label="Auto Fit"
          active={state.sceneViewport.framingMode === "auto"}
          onClick={() =>
            dispatch({
              type: "setViewportField",
              key: "framingMode",
              value: "auto",
            })
          }
        />
        <ControlButton
          label="Full Span"
          active={state.sceneViewport.framingMode === "full"}
          onClick={() =>
            dispatch({
              type: "setViewportField",
              key: "framingMode",
              value: "full",
            })
          }
        />
      </div>

      <div className="scene-toolbar__group">
        <span className="scene-toolbar__label">Scale</span>
        <ControlButton
          label="True Scale"
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
          label="Diagram"
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
        <span className="scene-toolbar__label">Zoom</span>
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
        <span className="scene-toolbar__label">Vertical</span>
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
          Hover to inspect, click to pin
        </span>
        <span className="scene-toolbar__meta">
          {scaleSummary}
        </span>
        <ControlButton
          label="Reset"
          onClick={() => dispatch({ type: "resetViewport" })}
        />
      </div>

      <div className="scene-toolbar__group">
        <ControlButton
          label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          onClick={onToggleFullscreen}
        />
      </div>
    </div>
  );
}
