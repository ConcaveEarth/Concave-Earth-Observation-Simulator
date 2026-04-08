import type { Dispatch } from "react";
import { t, type LanguageMode } from "../../i18n";
import type { SweepMetric, SweepParameter, SweepRangeMode } from "../../domain/analysis";
import type { AppAction, AppState } from "../../state/appState";
import type { FocusedModel } from "../../domain/types";

interface PresentationToolbarProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
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

export function PresentationToolbar({
  state,
  dispatch,
  language,
}: PresentationToolbarProps) {
  return (
    <div className="scene-toolbar scene-toolbar--presentation">
      <div className="scene-toolbar__group">
        <span className="scene-toolbar__label">{t(language, "panelLayout")}</span>
        <ControlButton
          label={t(language, "singlePanel")}
          active={state.viewMode === "cross-section"}
          onClick={() => dispatch({ type: "setViewMode", value: "cross-section" })}
        />
        <ControlButton
          label={t(language, "splitCompare")}
          active={state.viewMode === "compare"}
          onClick={() => dispatch({ type: "setViewMode", value: "compare" })}
        />
      </div>

      {state.viewMode === "cross-section" ? (
        <div className="scene-toolbar__group">
          <span className="scene-toolbar__label">{t(language, "singlePanelModel")}</span>
          <ControlButton
            label={t(language, "primaryModelShort")}
            active={state.focusedModel === "primary"}
            onClick={() => dispatch({ type: "setFocusedModel", value: "primary" })}
          />
          <ControlButton
            label={t(language, "comparisonModelShort")}
            active={state.focusedModel === "comparison"}
            onClick={() =>
              dispatch({ type: "setFocusedModel", value: "comparison" as FocusedModel })
            }
          />
        </div>
      ) : (
        <div className="scene-toolbar__group">
          <span className="scene-toolbar__label">{t(language, "compareLayout")}</span>
          <ControlButton
            label={t(language, "auto")}
            active={state.sceneViewport.compareLayout === "auto"}
            onClick={() =>
              dispatch({
                type: "setViewportField",
                key: "compareLayout",
                value: "auto",
              })
            }
          />
          <ControlButton
            label={t(language, "sideBySide")}
            active={state.sceneViewport.compareLayout === "side-by-side"}
            onClick={() =>
              dispatch({
                type: "setViewportField",
                key: "compareLayout",
                value: "side-by-side",
              })
            }
          />
          <ControlButton
            label={t(language, "stacked")}
            active={state.sceneViewport.compareLayout === "stacked"}
            onClick={() =>
              dispatch({
                type: "setViewportField",
                key: "compareLayout",
                value: "stacked",
              })
            }
          />
        </div>
      )}

      {state.analysisTab === "cross-section" ? (
        <>
          <div className="scene-toolbar__group">
            <span className="scene-toolbar__label">{t(language, "annotations")}</span>
            <ControlButton
              label={t(language, "annotatedMode")}
              active={state.annotated}
              onClick={() => dispatch({ type: "setAnnotated", value: !state.annotated })}
            />
            <ControlButton
              label={t(language, "adaptive")}
              active={state.labelDensity === "adaptive"}
              onClick={() => dispatch({ type: "setLabelDensity", value: "adaptive" })}
            />
            <ControlButton
              label={t(language, "full")}
              active={state.labelDensity === "full"}
              onClick={() => dispatch({ type: "setLabelDensity", value: "full" })}
            />
          </div>

          <div className="scene-toolbar__group">
            <span className="scene-toolbar__label">{t(language, "guides")}</span>
            <ControlButton
              label={t(language, "scaleGuides")}
              active={state.showScaleGuides}
              onClick={() =>
                dispatch({ type: "setShowScaleGuides", value: !state.showScaleGuides })
              }
            />
            <ControlButton
              label={t(language, "profileOverlay")}
              active={state.showTerrainOverlay}
              onClick={() =>
                dispatch({
                  type: "setShowTerrainOverlay",
                  value: !state.showTerrainOverlay,
                })
              }
            />
          </div>
        </>
      ) : state.analysisTab === "ray-bundle" ? (
        <div className="scene-toolbar__group">
          <span className="scene-toolbar__label">{t(language, "guides")}</span>
          <ControlButton
            label={t(language, "scaleGuides")}
            active={state.showScaleGuides}
            onClick={() =>
              dispatch({ type: "setShowScaleGuides", value: !state.showScaleGuides })
            }
          />
        </div>
      ) : (
        <>
          <div className="scene-toolbar__group">
            <span className="scene-toolbar__label">{t(language, "sweepParameter")}</span>
            <select
              className="scene-toolbar__select"
              value={state.sweepConfig.parameter}
              onChange={(event) =>
                dispatch({
                  type: "setSweepField",
                  key: "parameter",
                  value: event.target.value as SweepParameter,
                })
              }
            >
              <option value="distance">{t(language, "distanceParameter")}</option>
              <option value="observerHeight">{t(language, "observerHeightParameter")}</option>
              <option value="targetHeight">{t(language, "targetHeightParameter")}</option>
              <option value="atmosphere">{t(language, "atmosphereParameter")}</option>
            </select>
          </div>

          <div className="scene-toolbar__group">
            <span className="scene-toolbar__label">{t(language, "sweepMetric")}</span>
            <select
              className="scene-toolbar__select"
              value={state.sweepConfig.metric}
              onChange={(event) =>
                dispatch({
                  type: "setSweepField",
                  key: "metric",
                  value: event.target.value as SweepMetric,
                })
              }
            >
              <option value="hiddenHeight">{t(language, "hiddenHeightMetric")}</option>
              <option value="visibilityFraction">
                {t(language, "visibilityFractionMetric")}
              </option>
              <option value="apparentElevation">
                {t(language, "apparentElevationMetric")}
              </option>
              <option value="opticalHorizon">{t(language, "opticalHorizonMetric")}</option>
            </select>
          </div>

          <div className="scene-toolbar__group">
            <span className="scene-toolbar__label">{t(language, "sweepRange")}</span>
            <select
              className="scene-toolbar__select"
              value={state.sweepConfig.rangeMode}
              onChange={(event) =>
                dispatch({
                  type: "setSweepField",
                  key: "rangeMode",
                  value: event.target.value as SweepRangeMode,
                })
              }
            >
              <option value="focused">{t(language, "focused")}</option>
              <option value="operational">{t(language, "operational")}</option>
              <option value="wide">{t(language, "wide")}</option>
            </select>
          </div>

          <div className="scene-toolbar__group">
            <span className="scene-toolbar__label">{t(language, "sweepResolution")}</span>
            <input
              className="scene-toolbar__input"
              type="number"
              min={8}
              max={80}
              step={1}
              value={state.sweepConfig.sampleCount}
              onChange={(event) =>
                dispatch({
                  type: "setSweepField",
                  key: "sampleCount",
                  value: Math.round(Number(event.target.value)),
                })
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
