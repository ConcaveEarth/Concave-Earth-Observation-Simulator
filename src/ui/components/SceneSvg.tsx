import type { CSSProperties } from "react";
import type { SceneLine, SceneSegment, SceneViewModel, Vec2 } from "../../domain/types";
import type { SceneFramingMode } from "../../state/appState";

interface SceneSvgProps {
  scenes: SceneViewModel[];
  annotated: boolean;
  hoveredFeatureId: string | null;
  framingMode: SceneFramingMode;
  zoom: number;
  verticalZoom: number;
  onHoverFeature: (featureId: string | null) => void;
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
  scene: SceneViewModel,
  panel: PanelRect,
  framingMode: SceneFramingMode,
  zoom: number,
  verticalZoom: number,
) {
  const padding = 44;
  const availableWidth = panel.width - padding * 2;
  const availableHeight = panel.height - padding * 2;
  const bounds = framingMode === "full" ? scene.bounds : scene.focusBounds;
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1);
  const xScale = (availableWidth / spanX) * zoom;
  const yScale = (availableHeight / spanY) * zoom * verticalZoom;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = bounds.minY + spanY * 0.36;
  const viewportCenterX = panel.x + padding + availableWidth / 2;
  const viewportCenterY = panel.y + padding + availableHeight * 0.58;

  return (point: Vec2) => ({
    x: viewportCenterX + (point.x - centerX) * xScale,
    y: viewportCenterY - (point.y - centerY) * yScale,
  });
}

function renderLine(
  line: SceneLine,
  project: ReturnType<typeof createProjector>,
  hoveredFeatureId: string | null,
  onHoverFeature: (featureId: string | null) => void,
) {
  const isActive = hoveredFeatureId === line.featureId;
  return (
    <polyline
      key={line.id}
      points={polygonPoints(line.points.map(project))}
      fill="none"
      stroke={line.color}
      strokeWidth={isActive ? line.width + 1.2 : line.width}
      strokeDasharray={line.dashed ? "12 12" : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={hoveredFeatureId !== null && !isActive ? 0.4 : 1}
      filter={line.featureId === "ray" ? "url(#glow)" : undefined}
      onMouseEnter={() => onHoverFeature(line.featureId)}
      onMouseLeave={() => onHoverFeature(null)}
    />
  );
}

function renderSegment(
  segment: SceneSegment,
  project: ReturnType<typeof createProjector>,
  hoveredFeatureId: string | null,
  onHoverFeature: (featureId: string | null) => void,
) {
  const start = project(segment.from);
  const end = project(segment.to);
  const isActive = hoveredFeatureId === segment.featureId;
  return (
    <line
      key={segment.id}
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      stroke={segment.color}
      strokeWidth={isActive ? segment.width + 1 : segment.width}
      strokeDasharray={segment.dashed ? "10 10" : undefined}
      strokeLinecap="round"
      opacity={hoveredFeatureId !== null && !isActive ? 0.35 : 1}
      onMouseEnter={() => onHoverFeature(segment.featureId)}
      onMouseLeave={() => onHoverFeature(null)}
    />
  );
}

function renderGrid(
  scene: SceneViewModel,
  panel: PanelRect,
  framingMode: SceneFramingMode,
  zoom: number,
  verticalZoom: number,
) {
  const lines: JSX.Element[] = [];
  const bounds = framingMode === "full" ? scene.bounds : scene.focusBounds;
  const stepX = (bounds.maxX - bounds.minX) / 6;
  const stepY = (bounds.maxY - bounds.minY) / 6;
  const project = createProjector(scene, panel, framingMode, zoom, verticalZoom);

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

export function SceneSvg({
  scenes,
  annotated,
  hoveredFeatureId,
  framingMode,
  zoom,
  verticalZoom,
  onHoverFeature,
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
        const project = createProjector(
          scene,
          panel,
          framingMode,
          zoom,
          verticalZoom,
        );
        const panelStyle: CSSProperties = {};
        const shouldRenderDetailLabels = !isCompare || zoom > 1.15 || verticalZoom > 1.2;

        return (
          <g key={scene.title} style={panelStyle}>
            <rect
              x={panel.x}
              y={panel.y}
              width={panel.width}
              height={panel.height}
              rx={28}
              fill="url(#panelFill)"
              stroke="rgba(141, 192, 255, 0.18)"
            />

            {renderGrid(scene, panel, framingMode, zoom, verticalZoom)}

            <polygon
              points={polygonPoints(scene.surfaceFill.points.map(project))}
              fill={scene.surfaceFill.fill}
              opacity={scene.surfaceFill.opacity}
            />

            {scene.atmosphereFill ? (
              <polygon
                points={polygonPoints(scene.atmosphereFill.points.map(project))}
                fill={scene.atmosphereFill.fill}
                opacity={scene.atmosphereFill.opacity}
              />
            ) : null}

            {scene.lines.map((line) =>
              renderLine(line, project, hoveredFeatureId, onHoverFeature),
            )}
            {scene.segments.map((segment) =>
              renderSegment(segment, project, hoveredFeatureId, onHoverFeature),
            )}

            {scene.markers.map((marker) => {
              const point = project(marker.point);
              const isActive = hoveredFeatureId === marker.featureId;

              return (
                <g
                  key={marker.id}
                  onMouseEnter={() => onHoverFeature(marker.featureId)}
                  onMouseLeave={() => onHoverFeature(null)}
                >
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isActive ? 8 : 6}
                    fill={marker.color}
                    stroke="rgba(255,255,255,0.7)"
                  />
                  {annotated ? (
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
              ? scene.labels.map((label) => {
                  const point = project(label.point);
                  return (
                    <text
                      key={label.id}
                      x={point.x}
                      y={point.y}
                      fill={
                        hoveredFeatureId === label.featureId
                          ? "#ffffff"
                          : "rgba(230, 240, 255, 0.76)"
                      }
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
