import type { CSSProperties } from "react";
import type { SceneLine, SceneSegment, SceneViewModel, Vec2 } from "../../domain/types";
import { formatDistance } from "../../domain/units";
import type { SceneFramingMode, SceneScaleMode } from "../../state/appState";

interface SceneSvgProps {
  scenes: SceneViewModel[];
  annotated: boolean;
  showScaleGuides: boolean;
  showTerrainOverlay: boolean;
  activeFeatureId: string | null;
  activeSceneKey: SceneViewModel["sceneKey"] | null;
  hoveredFeatureId: string | null;
  hoveredSceneKey: SceneViewModel["sceneKey"] | null;
  selectedFeatureId: string | null;
  selectedSceneKey: SceneViewModel["sceneKey"] | null;
  framingMode: SceneFramingMode;
  scaleMode: SceneScaleMode;
  zoom: number;
  verticalZoom: number;
  onHoverFeature: (
    sceneKey: SceneViewModel["sceneKey"] | null,
    featureId: string | null,
  ) => void;
  onSelectFeature: (
    sceneKey: SceneViewModel["sceneKey"] | null,
    featureId: string | null,
  ) => void;
}

interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SVG_WIDTH = 1600;
const SVG_HEIGHT = 900;

function polygonPoints(points: Vec2[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function createProjector(
  panel: PanelRect,
  bounds: SceneViewModel["bounds"],
  scaleMode: SceneScaleMode,
  baseVerticalScale: number,
  zoom: number,
  verticalZoom: number,
) {
  const paddingX = 36;
  const paddingTop = 88;
  const paddingBottom = 36;
  const availableWidth = panel.width - paddingX * 2;
  const availableHeight = panel.height - paddingTop - paddingBottom;
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const exaggeratedSpanY = Math.max(bounds.maxY - bounds.minY, 1);
  const actualSpanY = exaggeratedSpanY / Math.max(baseVerticalScale, 1);
  const fitWidthScale = availableWidth / spanX;
  const fitHeightTrueScale = availableHeight / Math.max(actualSpanY, 1);
  const fitHeightDiagramScale = availableHeight / exaggeratedSpanY;
  const xScale =
    scaleMode === "true-scale"
      ? Math.min(fitWidthScale, fitHeightTrueScale) * zoom
      : fitWidthScale * zoom;
  const surveyDisplayedScale = Math.min(
    Math.max(Math.sqrt(Math.max(baseVerticalScale, 1)), 1.35),
    12,
  );
  const naturalSurveyYScale =
    ((fitWidthScale * zoom) / Math.max(baseVerticalScale, 1)) *
    surveyDisplayedScale *
    verticalZoom;
  const yScale =
    scaleMode === "true-scale"
      ? (xScale / Math.max(baseVerticalScale, 1)) * verticalZoom
      : scaleMode === "survey"
        ? Math.min(fitHeightDiagramScale * zoom * verticalZoom, naturalSurveyYScale)
        : fitHeightDiagramScale * zoom * verticalZoom;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const viewportCenterX = panel.x + paddingX + availableWidth / 2;
  const viewportCenterY = panel.y + paddingTop + availableHeight / 2;

  return (point: Vec2) => ({
    x: viewportCenterX + (point.x - centerX) * xScale,
    y: viewportCenterY - (point.y - centerY) * yScale,
  });
}

function renderLine(
  line: SceneLine,
  sceneKey: SceneViewModel["sceneKey"],
  project: ReturnType<typeof createProjector>,
  activeFeatureId: string | null,
  activeSceneKey: SceneViewModel["sceneKey"] | null,
  hoveredFeatureId: string | null,
  hoveredSceneKey: SceneViewModel["sceneKey"] | null,
  selectedFeatureId: string | null,
  selectedSceneKey: SceneViewModel["sceneKey"] | null,
  onHoverFeature: (
    sceneKey: SceneViewModel["sceneKey"] | null,
    featureId: string | null,
  ) => void,
  onSelectFeature: (
    sceneKey: SceneViewModel["sceneKey"] | null,
    featureId: string | null,
  ) => void,
) {
  const isActive =
    activeFeatureId === line.featureId && activeSceneKey === sceneKey;
  const isSelected =
    selectedFeatureId === line.featureId && selectedSceneKey === sceneKey;
  const showEmphasis = isActive || isSelected;
  return (
    <g key={line.id}>
      {showEmphasis ? (
        <polyline
          points={polygonPoints(line.points.map(project))}
          fill="none"
          stroke={isActive ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.18)"}
          strokeWidth={line.width + (isActive ? 7 : 5)}
          strokeDasharray={line.dashed ? "12 12" : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={isActive ? 0.92 : 0.75}
        />
      ) : null}
      <polyline
        points={polygonPoints(line.points.map(project))}
        fill="none"
        stroke={line.color}
        strokeWidth={isActive ? line.width + 1.85 : isSelected ? line.width + 1.1 : line.width}
        strokeDasharray={line.dashed ? "12 12" : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={activeFeatureId !== null && !isActive ? 0.16 : isSelected ? 1 : 0.96}
        filter={showEmphasis || (line.featureId === "actual-ray" && activeFeatureId == null) ? "url(#glow)" : undefined}
        onMouseEnter={() => onHoverFeature(sceneKey, line.featureId)}
        onMouseLeave={() => onHoverFeature(null, null)}
        onClick={(event) => {
          event.stopPropagation();
          onSelectFeature(sceneKey, line.featureId);
        }}
        style={{ cursor: "pointer" }}
      />
    </g>
  );
}

function renderSegment(
  segment: SceneSegment,
  sceneKey: SceneViewModel["sceneKey"],
  project: ReturnType<typeof createProjector>,
  activeFeatureId: string | null,
  activeSceneKey: SceneViewModel["sceneKey"] | null,
  hoveredFeatureId: string | null,
  hoveredSceneKey: SceneViewModel["sceneKey"] | null,
  selectedFeatureId: string | null,
  selectedSceneKey: SceneViewModel["sceneKey"] | null,
  onHoverFeature: (
    sceneKey: SceneViewModel["sceneKey"] | null,
    featureId: string | null,
  ) => void,
  onSelectFeature: (
    sceneKey: SceneViewModel["sceneKey"] | null,
    featureId: string | null,
  ) => void,
) {
  const start = project(segment.from);
  const end = project(segment.to);
  const isActive =
    activeFeatureId === segment.featureId && activeSceneKey === sceneKey;
  const isSelected =
    selectedFeatureId === segment.featureId && selectedSceneKey === sceneKey;
  const showEmphasis = isActive || isSelected;
  return (
    <g key={segment.id}>
      {showEmphasis ? (
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={isActive ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.16)"}
          strokeWidth={segment.width + (isActive ? 6 : 4.5)}
          strokeDasharray={segment.dashed ? "10 10" : undefined}
          strokeLinecap="round"
          opacity={isActive ? 0.9 : 0.72}
        />
      ) : null}
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={segment.color}
        strokeWidth={
          isActive ? segment.width + 1.5 : isSelected ? segment.width + 0.9 : segment.width
        }
        strokeDasharray={segment.dashed ? "10 10" : undefined}
        strokeLinecap="round"
        opacity={activeFeatureId !== null && !isActive ? 0.16 : isSelected ? 1 : 0.96}
        onMouseEnter={() => onHoverFeature(sceneKey, segment.featureId)}
        onMouseLeave={() => onHoverFeature(null, null)}
        onClick={(event) => {
          event.stopPropagation();
          onSelectFeature(sceneKey, segment.featureId);
        }}
        style={{ cursor: "pointer" }}
      />
    </g>
  );
}

function renderGrid(
  panel: PanelRect,
  bounds: SceneViewModel["bounds"],
  scaleMode: SceneScaleMode,
  baseVerticalScale: number,
  zoom: number,
  verticalZoom: number,
) {
  const lines: JSX.Element[] = [];
  const stepX = (bounds.maxX - bounds.minX) / 6;
  const stepY = (bounds.maxY - bounds.minY) / 6;
  const project = createProjector(
    panel,
    bounds,
    scaleMode,
    baseVerticalScale,
    zoom,
    verticalZoom,
  );

  for (let index = 0; index <= 6; index += 1) {
    const x = bounds.minX + stepX * index;
    const start = project({ x, y: bounds.minY });
    const end = project({ x, y: bounds.maxY });
    lines.push(
      <line
        key={`grid-x-${index}`}
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="rgba(136, 195, 255, 0.08)"
        strokeWidth={1}
      />,
    );
  }

  for (let index = 0; index <= 6; index += 1) {
    const y = bounds.minY + stepY * index;
    const start = project({ x: bounds.minX, y });
    const end = project({ x: bounds.maxX, y });
    lines.push(
      <line
        key={`grid-y-${index}`}
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="rgba(136, 195, 255, 0.08)"
        strokeWidth={1}
      />,
    );
  }

  return lines;
}

function niceScaleStep(value: number): number {
  if (value <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  const niceFraction =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;

  return niceFraction * 10 ** exponent;
}

function renderScaleGuides(
  scene: SceneViewModel,
  bounds: SceneViewModel["bounds"],
  project: ReturnType<typeof createProjector>,
) {
  const elements: JSX.Element[] = [];
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  const horizontalStep = niceScaleStep(spanX / 4);
  const verticalActualSpan = spanY / scene.suggestedVerticalScale;
  const verticalActualStep = niceScaleStep(verticalActualSpan / 3);
  const verticalStep = verticalActualStep * scene.suggestedVerticalScale;
  const horizontalStartWorld = {
    x: bounds.minX + spanX * 0.08,
    y: bounds.minY + spanY * 0.08,
  };
  const horizontalEndWorld = {
    x: horizontalStartWorld.x + horizontalStep,
    y: horizontalStartWorld.y,
  };
  const verticalBaseWorld = {
    x: bounds.maxX - spanX * 0.08,
    y: bounds.minY + spanY * 0.14,
  };
  const verticalTopWorld = {
    x: verticalBaseWorld.x,
    y: verticalBaseWorld.y + verticalStep,
  };
  const horizontalStart = project(horizontalStartWorld);
  const horizontalEnd = project(horizontalEndWorld);
  const verticalBase = project(verticalBaseWorld);
  const verticalTop = project(verticalTopWorld);
  const rulerStroke = "rgba(226, 236, 248, 0.72)";
  const tickSize = 8;

  elements.push(
    <g key={`${scene.title}-horizontal-ruler`}>
      <line
        x1={horizontalStart.x}
        y1={horizontalStart.y}
        x2={horizontalEnd.x}
        y2={horizontalEnd.y}
        stroke={rulerStroke}
        strokeWidth={1.2}
      />
      {Array.from({ length: 5 }, (_, index) => {
        const x =
          horizontalStart.x +
          ((horizontalEnd.x - horizontalStart.x) * index) / 4;
        return (
          <g key={`${scene.title}-horizontal-tick-${index}`}>
            <line
              x1={x}
              y1={horizontalStart.y - tickSize}
              x2={x}
              y2={horizontalStart.y + tickSize}
              stroke={rulerStroke}
              strokeWidth={1}
            />
            <text
              x={x}
              y={horizontalStart.y - 14}
              textAnchor="middle"
              fill="rgba(231, 240, 250, 0.78)"
              fontSize={11}
              fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
            >
              {formatDistance((horizontalStep * index) / 4)}
            </text>
          </g>
        );
      })}
      <text
        x={(horizontalStart.x + horizontalEnd.x) / 2}
        y={horizontalStart.y + 28}
        textAnchor="middle"
        fill="rgba(231, 240, 250, 0.78)"
        fontSize={11}
        fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
      >
        Horizontal scale
      </text>
    </g>,
  );

  elements.push(
    <g key={`${scene.title}-vertical-ruler`}>
      <line
        x1={verticalBase.x}
        y1={verticalBase.y}
        x2={verticalTop.x}
        y2={verticalTop.y}
        stroke={rulerStroke}
        strokeWidth={1.2}
      />
      {Array.from({ length: 5 }, (_, index) => {
        const y =
          verticalBase.y -
          ((verticalBase.y - verticalTop.y) * index) / 4;
        return (
          <g key={`${scene.title}-vertical-tick-${index}`}>
            <line
              x1={verticalBase.x - tickSize}
              y1={y}
              x2={verticalBase.x + tickSize}
              y2={y}
              stroke={rulerStroke}
              strokeWidth={1}
            />
            <text
              x={verticalBase.x - 16}
              y={y + 4}
              textAnchor="end"
              fill="rgba(231, 240, 250, 0.78)"
              fontSize={11}
              fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
            >
              {formatDistance((verticalActualStep * index) / 4)}
            </text>
          </g>
        );
      })}
      <text
        x={verticalBase.x - 18}
        y={verticalTop.y - 16}
        textAnchor="end"
        fill="rgba(231, 240, 250, 0.78)"
        fontSize={11}
        fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
      >
        Vertical scale
      </text>
    </g>,
  );

  return elements;
}

export function SceneSvg({
  scenes,
  annotated,
  showScaleGuides,
  showTerrainOverlay,
  activeFeatureId,
  activeSceneKey,
  hoveredFeatureId,
  hoveredSceneKey,
  selectedFeatureId,
  selectedSceneKey,
  framingMode,
  scaleMode,
  zoom,
  verticalZoom,
  onHoverFeature,
  onSelectFeature,
}: SceneSvgProps) {
  const isCompare = scenes.length > 1;
  const markerFontSize = isCompare ? 13 : 16;
  const titleFontSize = isCompare ? 20 : 22;
  const subtitleFontSize = isCompare ? 13 : 15;
  const labelFontSize = isCompare ? 12 : 14;
  const panelRects: PanelRect[] =
    scenes.length === 1
      ? [{ x: 28, y: 28, width: SVG_WIDTH - 56, height: SVG_HEIGHT - 56 }]
      : [
          { x: 26, y: 28, width: (SVG_WIDTH - 78) / 2, height: SVG_HEIGHT - 56 },
          {
            x: SVG_WIDTH / 2 + 13,
            y: 28,
            width: (SVG_WIDTH - 78) / 2,
            height: SVG_HEIGHT - 56,
          },
        ];

  return (
    <svg
      className="scene-svg"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      role="img"
      aria-label="Observation geometry visualization"
    >
      <defs>
        <linearGradient id="backdrop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#07131f" />
          <stop offset="55%" stopColor="#0a1f30" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
        <linearGradient id="panelFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(9, 24, 38, 0.88)" />
          <stop offset="100%" stopColor="rgba(9, 18, 30, 0.72)" />
        </linearGradient>
        <linearGradient id="surfaceFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(31, 87, 126, 0.28)" />
          <stop offset="100%" stopColor="rgba(4, 15, 25, 0.95)" />
        </linearGradient>
        <linearGradient id="atmosphereFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(104, 221, 255, 0.18)" />
          <stop offset="100%" stopColor="rgba(104, 221, 255, 0.02)" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#backdrop)" rx={30} />
      <circle cx="220" cy="160" r="220" fill="rgba(53, 164, 255, 0.08)" />
      <circle cx="1360" cy="90" r="180" fill="rgba(255, 163, 82, 0.06)" />

      {scenes.map((scene, index) => {
        const panel = panelRects[index];
        const visibleBounds =
          framingMode === "full" ? scene.bounds : scene.focusBounds;
        const project = createProjector(
          panel,
          visibleBounds,
          scaleMode,
          scene.suggestedVerticalScale,
          zoom,
          verticalZoom,
        );
        const panelStyle: CSSProperties = {};
        const shouldRenderDetailLabels = annotated;

        return (
          <g
            key={scene.title}
            style={panelStyle}
            onClick={() => onSelectFeature(null, null)}
          >
            <rect
              x={panel.x}
              y={panel.y}
              width={panel.width}
              height={panel.height}
              rx={28}
              fill="url(#panelFill)"
              stroke="rgba(141, 192, 255, 0.18)"
            />

            {renderGrid(
              panel,
              visibleBounds,
              scaleMode,
              scene.suggestedVerticalScale,
              zoom,
              verticalZoom,
            )}

            <polygon
              points={polygonPoints(scene.surfaceFill.points.map(project))}
              fill={scene.surfaceFill.fill}
              opacity={scene.surfaceFill.opacity}
            />

            {showTerrainOverlay && scene.terrainOverlay?.fill ? (
              <polygon
                points={polygonPoints(scene.terrainOverlay.fill.points.map(project))}
                fill={scene.terrainOverlay.fill.fill}
                opacity={scene.terrainOverlay.fill.opacity}
              />
            ) : null}

            {scene.atmosphereFill ? (
              <polygon
                points={polygonPoints(scene.atmosphereFill.points.map(project))}
                fill={scene.atmosphereFill.fill}
                opacity={scene.atmosphereFill.opacity}
              />
            ) : null}

            {showScaleGuides
              ? renderScaleGuides(scene, visibleBounds, project)
              : null}

            {scene.lines
              .filter(
                (line) => showTerrainOverlay || line.featureId !== "terrain-profile",
              )
              .map((line) =>
                renderLine(
                  line,
                  scene.sceneKey,
                  project,
                  activeFeatureId,
                  activeSceneKey,
                  hoveredFeatureId,
                  hoveredSceneKey,
                  selectedFeatureId,
                  selectedSceneKey,
                  onHoverFeature,
                  onSelectFeature,
                ),
              )}
            {scene.segments.map((segment) =>
              renderSegment(
                segment,
                scene.sceneKey,
                project,
                activeFeatureId,
                activeSceneKey,
                hoveredFeatureId,
                hoveredSceneKey,
                selectedFeatureId,
                selectedSceneKey,
                onHoverFeature,
                onSelectFeature,
              ),
            )}

            {scene.markers.map((marker) => {
              const point = project(marker.point);
              const isActive =
                activeFeatureId === marker.featureId &&
                activeSceneKey === scene.sceneKey;
              const isSelected =
                selectedFeatureId === marker.featureId &&
                selectedSceneKey === scene.sceneKey;

              return (
                <g
                  key={marker.id}
                  onMouseEnter={() => onHoverFeature(scene.sceneKey, marker.featureId)}
                  onMouseLeave={() => onHoverFeature(null, null)}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectFeature(scene.sceneKey, marker.featureId);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isActive ? 8.8 : isSelected ? 7.6 : 6}
                    fill={marker.color}
                    stroke="rgba(255,255,255,0.7)"
                    opacity={activeFeatureId !== null && !isActive ? 0.34 : 1}
                  />
                  {annotated && shouldRenderDetailLabels && !marker.hideLabel ? (
                    <text
                      x={point.x + (marker.labelOffset?.x ?? 10)}
                      y={point.y + (marker.labelOffset?.y ?? -10)}
                      fill="#e9f4ff"
                      fontSize={markerFontSize}
                      fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
                    >
                      {marker.label}
                    </text>
                  ) : null}
                </g>
              );
            })}

            <text
              x={panel.x + 30}
              y={panel.y + 34}
              fill="#f5f2e8"
              fontSize={titleFontSize}
              fontWeight="600"
              fontFamily="'Trebuchet MS', 'Segoe UI Variable Display', sans-serif"
            >
              {scene.title}
            </text>
            <text
              x={panel.x + 30}
              y={panel.y + 60}
              fill="rgba(219, 237, 255, 0.7)"
              fontSize={subtitleFontSize}
              fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
            >
              {scene.subtitle}
            </text>

            {annotated && shouldRenderDetailLabels
              ? scene.labels
                  .filter(
                    (label) => showTerrainOverlay || label.featureId !== "terrain-profile",
                  )
                  .map((label) => {
                    const point = project(label.point);
                    const isLabelActive =
                      activeFeatureId === label.featureId &&
                      activeSceneKey === scene.sceneKey;
                    return (
                      <text
                        key={label.id}
                        x={point.x}
                        y={point.y}
                        fill={
                          isLabelActive
                            ? "#ffffff"
                            : "rgba(230, 240, 255, 0.76)"
                      }
                      opacity={activeFeatureId !== null && !isLabelActive ? 0.45 : 1}
                      fontSize={labelFontSize}
                      fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
                    >
                        {label.text}
                      </text>
                    );
                  })
              : null}
          </g>
        );
      })}
    </svg>
  );
}
