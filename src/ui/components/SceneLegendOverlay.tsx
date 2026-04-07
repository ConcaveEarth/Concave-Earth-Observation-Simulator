import { t, type LanguageMode } from "../../i18n";
import type { SurfaceAnnotation } from "../../domain/types";

interface SceneLegendOverlayProps {
  annotations: SurfaceAnnotation[];
  sceneKey: "primary" | "comparison";
  activeFeatureId: string | null;
  selectedFeatureId: string | null;
  selectedSceneKey: "primary" | "comparison" | null;
  visible: boolean;
  showTerrainOverlay: boolean;
  language: LanguageMode;
  onHoverFeature: (
    sceneKey: "primary" | "comparison" | null,
    featureId: string | null,
  ) => void;
  onToggleFeature: (
    sceneKey: "primary" | "comparison",
    featureId: string,
  ) => void;
}

export function SceneLegendOverlay({
  annotations,
  sceneKey,
  activeFeatureId,
  selectedFeatureId,
  selectedSceneKey,
  visible,
  showTerrainOverlay,
  language,
  onHoverFeature,
  onToggleFeature,
}: SceneLegendOverlayProps) {
  if (!visible) {
    return null;
  }

  const visibleAnnotations = annotations.filter(
    (annotation) => showTerrainOverlay || annotation.id !== "terrain-profile",
  );

  return (
    <aside className="scene-legend-overlay panel" aria-label={t(language, "activeLegend")}>
      <div className="scene-legend-overlay__header">
        <p className="panel-section__eyebrow">{t(language, "sceneGuide")}</p>
        <h3>{t(language, "lineLegend")}</h3>
      </div>
      <div className="legend-list">
        {visibleAnnotations.map((annotation) => (
          <button
            type="button"
            key={annotation.id}
            className={
              annotation.id === activeFeatureId
                ? "legend-item legend-item--active"
                : annotation.id === selectedFeatureId && selectedSceneKey === sceneKey
                  ? "legend-item legend-item--pinned"
                : "legend-item"
            }
            onMouseEnter={() => onHoverFeature(sceneKey, annotation.id)}
            onMouseLeave={() => onHoverFeature(null, null)}
            onFocus={() => onHoverFeature(sceneKey, annotation.id)}
            onBlur={() => onHoverFeature(null, null)}
            onClick={() => onToggleFeature(sceneKey, annotation.id)}
          >
            <span
              className="legend-swatch"
              style={{ backgroundColor: annotation.color }}
            />
            <span>{annotation.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
