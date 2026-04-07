import { t, type LanguageMode } from "../../i18n";
import type { SurfaceAnnotation } from "../../domain/types";

interface SceneLegendOverlayProps {
  annotations: SurfaceAnnotation[];
  activeFeatureId: string | null;
  visible: boolean;
  showTerrainOverlay: boolean;
  language: LanguageMode;
}

export function SceneLegendOverlay({
  annotations,
  activeFeatureId,
  visible,
  showTerrainOverlay,
  language,
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
          <div
            key={annotation.id}
            className={
              annotation.id === activeFeatureId
                ? "legend-item legend-item--active"
                : "legend-item"
            }
          >
            <span
              className="legend-swatch"
              style={{ backgroundColor: annotation.color }}
            />
            <span>{annotation.label}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
