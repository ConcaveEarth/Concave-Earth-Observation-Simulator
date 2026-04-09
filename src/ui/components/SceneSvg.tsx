import { useMemo, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { SceneLine, SceneSegment, SceneViewModel, Vec2 } from "../../domain/types";
import { clamp, formatDistance } from "../../domain/units";
import type { UnitPreferences } from "../../domain/units";
import { t, type LanguageMode } from "../../i18n";
import type {
  CompareLayoutMode,
  LabelDensityMode,
  SceneFramingMode,
  SceneScaleMode,
} from "../../state/appState";

interface SceneSvgProps {
  scenes: SceneViewModel[];
  annotated: boolean;
  labelDensity: LabelDensityMode;
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
  compareLayout: Exclude<CompareLayoutMode, "auto">;
  fitContentHeight: boolean;
  zoom: number;
  verticalZoom: number;
  panX: number;
  panY: number;
  unitPreferences: UnitPreferences;
  language: LanguageMode;
  onHoverFeature: (
    sceneKey: SceneViewModel["sceneKey"] | null,
    featureId: string | null,
  ) => void;
  onSelectFeature: (
    sceneKey: SceneViewModel["sceneKey"] | null,
    featureId: string | null,
  ) => void;
  onPanBy: (deltaX: number, deltaY: number) => void;
  onAdjustZoom: (delta: number) => void;
  onAdjustVerticalZoom: (delta: number) => void;
}

interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function matchesSceneFeature(
  featureId: string,
  sceneKey: SceneViewModel["sceneKey"],
  targetFeatureId: string | null,
  targetSceneKey: SceneViewModel["sceneKey"] | null,
) {
  return targetFeatureId === featureId && (targetSceneKey === null || targetSceneKey === sceneKey);
}

const SINGLE_SVG_WIDTH = 1820;
const COMPARE_SVG_WIDTH = 2360;
const SVG_HEIGHT = 980;
const STACKED_SVG_WIDTH = 1820;
const textHalo = {
  stroke: "rgba(5, 12, 18, 0.96)",
  strokeWidth: 4,
  paintOrder: "stroke",
} as const;

interface Projection {
  panel: PanelRect;
  xScale: number;
  yScale: number;
  project: (point: Vec2) => Vec2;
}

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
  panX: number,
  panY: number,
): Projection {
  const paddingX = clamp(panel.width * 0.024, 18, 40);
  const paddingTop = clamp(panel.height * 0.12, 58, 100);
  const paddingBottom = clamp(panel.height * 0.14, 72, 132);
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
  const centerX = (bounds.minX + bounds.maxX) / 2 + panX;
  const centerY = (bounds.minY + bounds.maxY) / 2 + panY;
  const viewportCenterX = panel.x + paddingX + availableWidth / 2;
  const viewportCenterY = panel.y + paddingTop + availableHeight / 2;

  return {
    panel,
    xScale,
    yScale,
    project: (point: Vec2) => ({
      x: viewportCenterX + (point.x - centerX) * xScale,
      y: viewportCenterY - (point.y - centerY) * yScale,
    }),
  };
}

function renderLine(
  line: SceneLine,
  sceneKey: SceneViewModel["sceneKey"],
  project: Projection["project"],
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
  const isActive = matchesSceneFeature(line.featureId, sceneKey, activeFeatureId, activeSceneKey);
  const isSelected = matchesSceneFeature(
    line.featureId,
    sceneKey,
    selectedFeatureId,
    selectedSceneKey,
  );
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
  project: Projection["project"],
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
  const isActive = matchesSceneFeature(
    segment.featureId,
    sceneKey,
    activeFeatureId,
    activeSceneKey,
  );
  const isSelected = matchesSceneFeature(
    segment.featureId,
    sceneKey,
    selectedFeatureId,
    selectedSceneKey,
  );
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
  panX: number,
  panY: number,
) {
  const lines: JSX.Element[] = [];
  const stepX = (bounds.maxX - bounds.minX) / 6;
  const stepY = (bounds.maxY - bounds.minY) / 6;
  const projection = createProjector(
    panel,
    bounds,
    scaleMode,
    baseVerticalScale,
    zoom,
    verticalZoom,
    panX,
    panY,
  );
  const project = projection.project;

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
  project: Projection["project"],
  unitPreferences: UnitPreferences,
  language: LanguageMode,
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
              {formatDistance(
                (horizontalStep * index) / 4,
                unitPreferences.distance,
              )}
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
        {t(language, "horizontalScale")}
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
              {formatDistance(
                (verticalActualStep * index) / 4,
                unitPreferences.height === "ft" ? "ft" : "m",
              )}
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
        {t(language, "verticalScale")}
      </text>
    </g>,
  );

  return elements;
}

export function SceneSvg({
  scenes,
  annotated,
  labelDensity,
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
  compareLayout,
  fitContentHeight,
  zoom,
  verticalZoom,
  panX,
  panY,
  unitPreferences,
  language,
  onHoverFeature,
  onSelectFeature,
  onPanBy,
  onAdjustZoom,
  onAdjustVerticalZoom,
}: SceneSvgProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    lastPoint: Vec2;
    projection: Projection;
  } | null>(null);
  const isCompare = scenes.length > 1;
  const expandedLabels = labelDensity === "full";
  const isStacked = isCompare && compareLayout === "stacked";
  const svgWidth = isCompare
    ? isStacked
      ? STACKED_SVG_WIDTH
      : COMPARE_SVG_WIDTH
    : SINGLE_SVG_WIDTH;
  const svgHeight = isStacked ? 1560 : SVG_HEIGHT;
  const markerFontSize = expandedLabels ? 16 : isCompare ? 13 : 16;
  const titleFontSize = expandedLabels ? 22 : isCompare ? 20 : 22;
  const subtitleFontSize = expandedLabels ? 15 : isCompare ? 13 : 15;
  const labelFontSize = expandedLabels ? 14 : isCompare ? 12 : 14;
  const panelRects: PanelRect[] = !isCompare
    ? [{ x: 10, y: 18, width: svgWidth - 20, height: svgHeight - 36 }]
    : isStacked
      ? [
          { x: 10, y: 18, width: svgWidth - 20, height: (svgHeight - 54) / 2 },
          {
            x: 10,
            y: svgHeight / 2 + 9,
            width: svgWidth - 20,
            height: (svgHeight - 54) / 2,
          },
        ]
      : [
          { x: 10, y: 18, width: (svgWidth - 32) / 2, height: svgHeight - 36 },
          {
            x: svgWidth / 2 + 6,
            y: 18,
            width: (svgWidth - 32) / 2,
            height: svgHeight - 36,
          },
        ];
  const projections = useMemo(
    () =>
      scenes.map((scene, index) => {
        const panel = panelRects[index];
        const visibleBounds =
          framingMode === "full" ? scene.bounds : scene.focusBounds;

        return {
          scene,
          projection: createProjector(
            panel,
            visibleBounds,
            scaleMode,
            scene.suggestedVerticalScale,
            zoom,
            verticalZoom,
            panX,
            panY,
          ),
          visibleBounds,
        };
      }),
    [framingMode, panX, panY, panelRects, scaleMode, scenes, verticalZoom, zoom],
  );

  function getSvgPoint(event: { clientX: number; clientY: number }): Vec2 | null {
    const svg = svgRef.current;

    if (!svg) {
      return null;
    }

    const rect = svg.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return null;
    }

    return {
      x: ((event.clientX - rect.left) / rect.width) * svgWidth,
      y: ((event.clientY - rect.top) / rect.height) * svgHeight,
    };
  }

  function findProjectionAtPoint(point: Vec2 | null) {
    if (!point) {
      return null;
    }

    return (
      projections.find(({ projection }) => {
        const panel = projection.panel;
        return (
          point.x >= panel.x &&
          point.x <= panel.x + panel.width &&
          point.y >= panel.y &&
          point.y <= panel.y + panel.height
        );
      }) ?? null
    );
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as Element | null;
    const tagName = target?.tagName.toLowerCase();

    if (
      tagName &&
      ["polyline", "line", "circle", "text"].includes(tagName)
    ) {
      return;
    }

    const point = getSvgPoint(event);
    const hit = findProjectionAtPoint(point);

    if (!point || !hit) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      lastPoint: point,
      projection: hit.projection,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const point = getSvgPoint(event);

    if (!point) {
      return;
    }

    const deltaX = point.x - dragState.lastPoint.x;
    const deltaY = point.y - dragState.lastPoint.y;
    dragState.lastPoint = point;

    if (Math.abs(deltaX) < 0.2 && Math.abs(deltaY) < 0.2) {
      return;
    }

    onPanBy(
      -deltaX / Math.max(dragState.projection.xScale, 1e-6),
      deltaY / Math.max(dragState.projection.yScale, 1e-6),
    );
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleWheel(event: ReactWheelEvent<SVGSVGElement>) {
    const point = getSvgPoint(event);

    if (!findProjectionAtPoint(point)) {
      return;
    }
    const delta = Math.max(-0.35, Math.min(0.35, -event.deltaY / 700));

    if (event.shiftKey) {
      event.preventDefault();
      onAdjustVerticalZoom(delta);
      return;
    }

    if (fitContentHeight || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      onAdjustZoom(delta);
    }
  }

  return (
    <svg
      ref={svgRef}
      className="scene-svg"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Observation geometry visualization"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
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
        {projections.map(({ projection, scene }) => (
          <clipPath
            key={`clip-${scene.sceneKey}`}
            id={`scene-clip-${scene.sceneKey}`}
          >
            <rect
              x={projection.panel.x}
              y={projection.panel.y}
              width={projection.panel.width}
              height={projection.panel.height}
              rx={28}
            />
          </clipPath>
        ))}
      </defs>

      <rect width={svgWidth} height={svgHeight} fill="url(#backdrop)" rx={30} />
      <circle cx="220" cy="160" r="220" fill="rgba(53, 164, 255, 0.08)" />
      <circle
        cx={svgWidth - 240}
        cy="90"
        r="180"
        fill="rgba(255, 163, 82, 0.06)"
      />

      {projections.map(({ scene, projection, visibleBounds }) => {
        const panel = projection.panel;
        const project = projection.project;
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
            <g clipPath={`url(#scene-clip-${scene.sceneKey})`}>
              {renderGrid(
                panel,
                visibleBounds,
                scaleMode,
                scene.suggestedVerticalScale,
                zoom,
                verticalZoom,
                panX,
                panY,
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

              {scene.visibilityPolygons?.map((polygon) => (
                <polygon
                  key={polygon.id}
                  points={polygonPoints(polygon.points.map(project))}
                  fill={polygon.fill}
                  opacity={polygon.opacity}
                />
              ))}

              {showScaleGuides
                ? renderScaleGuides(
                    scene,
                    visibleBounds,
                    project,
                    unitPreferences,
                    language,
                  )
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
                const isActive = matchesSceneFeature(
                  marker.featureId,
                  scene.sceneKey,
                  activeFeatureId,
                  activeSceneKey,
                );
                const isSelected = matchesSceneFeature(
                  marker.featureId,
                  scene.sceneKey,
                  selectedFeatureId,
                  selectedSceneKey,
                );

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
                    {annotated &&
                    shouldRenderDetailLabels &&
                    !marker.hideLabel &&
                    (expandedLabels || marker.density !== "full") ? (
                      <text
                        x={point.x + (marker.labelOffset?.x ?? 10)}
                        y={point.y + (marker.labelOffset?.y ?? -10)}
                        fill="#e9f4ff"
                        fontSize={markerFontSize}
                        fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
                        {...textHalo}
                      >
                        {marker.label}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>

            <text
              x={panel.x + 30}
              y={panel.y + 34}
              fill="#f5f2e8"
              fontSize={titleFontSize}
              fontWeight="600"
              fontFamily="'Trebuchet MS', 'Segoe UI Variable Display', sans-serif"
              {...textHalo}
            >
              {scene.title}
            </text>
            <text
              x={panel.x + 30}
              y={panel.y + 60}
              fill="rgba(219, 237, 255, 0.7)"
              fontSize={subtitleFontSize}
              fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
              {...textHalo}
            >
              {scene.subtitle}
            </text>

            {annotated && shouldRenderDetailLabels
              ? scene.labels
                  .filter((label) => expandedLabels || label.density !== "full")
                  .filter(
                    (label) => showTerrainOverlay || label.featureId !== "terrain-profile",
                  )
                  .map((label) => {
                    const point = project(label.point);
                    const isLabelActive = matchesSceneFeature(
                      label.featureId,
                      scene.sceneKey,
                      activeFeatureId,
                      activeSceneKey,
                    );
                    return (
                      <text
                        key={label.id}
                        x={point.x}
                        y={point.y}
                        textAnchor={label.textAnchor ?? "start"}
                        fill={
                          isLabelActive
                            ? "#ffffff"
                            : "rgba(230, 240, 255, 0.76)"
                      }
                      opacity={activeFeatureId !== null && !isLabelActive ? 0.45 : 1}
                      fontSize={labelFontSize}
                      fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
                      {...textHalo}
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
