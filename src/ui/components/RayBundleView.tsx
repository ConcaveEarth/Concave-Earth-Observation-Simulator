import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { formatDistance } from "../../domain/units";
import type { UnitPreferences } from "../../domain/units";
import type { CompareLayoutMode } from "../../state/appState";
import type { RayBundlePanelData } from "../../domain/analysis";

interface RayBundleViewProps {
  panels: RayBundlePanelData[];
  compareLayout: Exclude<CompareLayoutMode, "auto">;
  unitPreferences: UnitPreferences;
  showScaleGuides: boolean;
  fitContentHeight: boolean;
  zoom: number;
  verticalZoom: number;
  panX: number;
  panY: number;
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

const SINGLE_SVG_WIDTH = 1800;
const COMPARE_SVG_WIDTH = 2360;
const STACKED_SVG_WIDTH = 1800;
const SVG_HEIGHT = 1240;
const STACKED_HEIGHT = 1960;

function polygonPoints(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function createProjector(
  panel: PanelRect,
  bounds: RayBundlePanelData["bounds"],
  zoom: number,
  verticalZoom: number,
  panX: number,
  panY: number,
) {
  const paddingX = Math.min(Math.max(panel.width * 0.024, 24), 42);
  const paddingTop = Math.min(Math.max(panel.height * 0.11, 62), 96);
  const paddingBottom = Math.min(Math.max(panel.height * 0.16, 110), 184);
  const availableWidth = panel.width - paddingX * 2;
  const availableHeight = panel.height - paddingTop - paddingBottom;
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1);
  const xScale = (availableWidth / spanX) * zoom;
  const yScale = (availableHeight / spanY) * verticalZoom;
  const centerX = (bounds.minX + bounds.maxX) / 2 + panX;
  const centerY = (bounds.minY + bounds.maxY) / 2 + panY;
  const viewportCenterX = panel.x + paddingX + availableWidth / 2;
  const viewportCenterY = panel.y + paddingTop + availableHeight / 2;

  return {
    xScale,
    yScale,
    project: (point: { x: number; y: number }) => ({
      x: viewportCenterX + (point.x - centerX) * xScale,
      y: viewportCenterY - (point.y - centerY) * yScale,
    }),
  };
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

function renderBundleScaleGuide(
  panel: RayBundlePanelData,
  project: (point: { x: number; y: number }) => { x: number; y: number },
  unitPreferences: UnitPreferences,
) {
  const spanX = panel.bounds.maxX - panel.bounds.minX;
  const horizontalStep = niceScaleStep(spanX / 4);
  const startWorld = {
    x: panel.bounds.minX + spanX * 0.08,
    y: panel.bounds.minY + (panel.bounds.maxY - panel.bounds.minY) * 0.08,
  };
  const endWorld = {
    x: startWorld.x + horizontalStep,
    y: startWorld.y,
  };
  const start = project(startWorld);
  const end = project(endWorld);

  return (
    <g key={`${panel.sceneKey}-bundle-scale`}>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="rgba(229, 238, 249, 0.72)"
        strokeWidth={1.15}
      />
      {Array.from({ length: 5 }, (_, index) => {
        const x = start.x + ((end.x - start.x) * index) / 4;
        return (
          <g key={`${panel.sceneKey}-bundle-scale-${index}`}>
            <line
              x1={x}
              y1={start.y - 7}
              x2={x}
              y2={start.y + 7}
              stroke="rgba(229, 238, 249, 0.72)"
              strokeWidth={1}
            />
            <text
              x={x}
              y={start.y - 12}
              textAnchor="middle"
              fill="rgba(231, 240, 250, 0.78)"
              fontSize={11}
              fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
            >
              {formatDistance((horizontalStep * index) / 4, unitPreferences.distance)}
            </text>
          </g>
        );
      })}
      <text
        x={(start.x + end.x) / 2}
        y={start.y + 26}
        textAnchor="middle"
        fill="rgba(231, 240, 250, 0.72)"
        fontSize={11}
        fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
      >
        Sampled bundle span
      </text>
    </g>
  );
}

export function RayBundleView({
  panels,
  compareLayout,
  unitPreferences,
  showScaleGuides,
  fitContentHeight,
  zoom,
  verticalZoom,
  panX,
  panY,
  onPanBy,
  onAdjustZoom,
  onAdjustVerticalZoom,
}: RayBundleViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    lastPoint: { x: number; y: number };
    xScale: number;
    yScale: number;
  } | null>(null);
  const isCompare = panels.length > 1;
  const isStacked = isCompare && compareLayout === "stacked";
  const svgWidth = isCompare
    ? isStacked
      ? STACKED_SVG_WIDTH
      : COMPARE_SVG_WIDTH
    : SINGLE_SVG_WIDTH;
  const svgHeight = isStacked ? STACKED_HEIGHT : SVG_HEIGHT;
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

  function getSvgPoint(event: { clientX: number; clientY: number }) {
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

  function findPanelIndex(point: { x: number; y: number } | null) {
    if (!point) {
      return -1;
    }

    return panelRects.findIndex(
      (panel) =>
        point.x >= panel.x &&
        point.x <= panel.x + panel.width &&
        point.y >= panel.y &&
        point.y <= panel.y + panel.height,
    );
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) {
      return;
    }

    const point = getSvgPoint(event);
    const panelIndex = findPanelIndex(point);

    if (!point || panelIndex < 0) {
      return;
    }

    const projection = createProjector(
      panelRects[panelIndex],
      panels[panelIndex].bounds,
      zoom,
      verticalZoom,
      panX,
      panY,
    );

    dragStateRef.current = {
      pointerId: event.pointerId,
      lastPoint: point,
      xScale: projection.xScale,
      yScale: projection.yScale,
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
      -deltaX / Math.max(dragState.xScale, 1e-6),
      deltaY / Math.max(dragState.yScale, 1e-6),
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

    if (findPanelIndex(point) < 0) {
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
      role="img"
      aria-label="Ray bundle visualization"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      <defs>
        <linearGradient id="bundleBackdrop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#07131f" />
          <stop offset="55%" stopColor="#0a1f30" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
        <linearGradient id="bundlePanelFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(9, 24, 38, 0.88)" />
          <stop offset="100%" stopColor="rgba(9, 18, 30, 0.72)" />
        </linearGradient>
        <linearGradient id="bundleSurfaceFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(31, 87, 126, 0.24)" />
          <stop offset="100%" stopColor="rgba(4, 15, 25, 0.95)" />
        </linearGradient>
        <filter id="bundleGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {panels.map((panel, index) => (
          <clipPath key={panel.sceneKey} id={`bundle-clip-${panel.sceneKey}`}>
            <rect
              x={panelRects[index].x}
              y={panelRects[index].y}
              width={panelRects[index].width}
              height={panelRects[index].height}
              rx={28}
            />
          </clipPath>
        ))}
      </defs>

      <rect width={svgWidth} height={svgHeight} fill="url(#bundleBackdrop)" rx={30} />
      <circle cx="220" cy="160" r="220" fill="rgba(53, 164, 255, 0.08)" />
      <circle
        cx={svgWidth - 240}
        cy="90"
        r="180"
        fill="rgba(255, 163, 82, 0.06)"
      />

      {panels.map((panel, index) => {
        const rect = panelRects[index];
        const projection = createProjector(
          rect,
          panel.bounds,
          zoom,
          verticalZoom,
          panX,
          panY,
        );
        const project = projection.project;
        const projectedSurface = panel.surfacePoints.map(project);
        const surfacePolygon = [
          ...projectedSurface,
          { x: projectedSurface[projectedSurface.length - 1].x, y: rect.y + rect.height },
          { x: projectedSurface[0].x, y: rect.y + rect.height },
        ];

        return (
          <g key={panel.sceneKey}>
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={28}
              fill="url(#bundlePanelFill)"
              stroke="rgba(141, 192, 255, 0.18)"
            />

            <g clipPath={`url(#bundle-clip-${panel.sceneKey})`}>
              <polygon
                points={polygonPoints(surfacePolygon)}
                fill="url(#bundleSurfaceFill)"
                opacity={0.96}
              />

              {panel.traces.map((trace) => (
                <polyline
                  key={trace.id}
                  points={polygonPoints(trace.points.map(project))}
                  fill="none"
                  stroke={trace.color}
                  strokeWidth={trace.width}
                  strokeDasharray={trace.dashed ? "10 10" : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={trace.featureId === "bundle-visible-rays" ? "url(#bundleGlow)" : undefined}
                />
              ))}

              <line
                x1={project(panel.observerStem.base).x}
                y1={project(panel.observerStem.base).y}
                x2={project(panel.observerStem.top).x}
                y2={project(panel.observerStem.top).y}
                stroke="rgba(214, 239, 255, 0.92)"
                strokeWidth={2.2}
              />
              <line
                x1={project(panel.targetStem.base).x}
                y1={project(panel.targetStem.base).y}
                x2={project(panel.targetStem.visibleStart).x}
                y2={project(panel.targetStem.visibleStart).y}
                stroke="rgba(255, 124, 124, 0.94)"
                strokeWidth={3}
              />
              <line
                x1={project(panel.targetStem.visibleStart).x}
                y1={project(panel.targetStem.visibleStart).y}
                x2={project(panel.targetStem.top).x}
                y2={project(panel.targetStem.top).y}
                stroke="rgba(255, 208, 126, 0.96)"
                strokeWidth={3}
              />

              {panel.samplePoints.map((sample) => {
                const point = project(sample.point);
                return (
                  <circle
                    key={sample.id}
                    cx={point.x}
                    cy={point.y}
                    r={3.2}
                    fill={sample.visible ? "#ffd07e" : "#a7b9cb"}
                    opacity={sample.visible ? 0.98 : 0.52}
                  />
                );
              })}

              {panel.markers.map((marker) => {
                const point = project(marker.point);
                return (
                  <circle
                    key={marker.id}
                    cx={point.x}
                    cy={point.y}
                    r={6.2}
                    fill={marker.color}
                    stroke="rgba(255,255,255,0.72)"
                  />
                );
              })}

              <text
                x={project(panel.observerStem.top).x + 10}
                y={project(panel.observerStem.top).y - 12}
                fill="#e9f4ff"
                fontSize={13}
                fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
              >
                Observer
              </text>
              <text
                x={project(panel.targetStem.top).x + 10}
                y={project(panel.targetStem.top).y - 10}
                fill="#e9f4ff"
                fontSize={13}
                fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
              >
                Target samples
              </text>

              {showScaleGuides
                ? renderBundleScaleGuide(panel, project, unitPreferences)
                : null}
            </g>

            <text
              x={rect.x + 30}
              y={rect.y + 34}
              fill="#f5f2e8"
              fontSize={22}
              fontWeight="600"
              fontFamily="'Trebuchet MS', 'Segoe UI Variable Display', sans-serif"
            >
              {panel.title}
            </text>
            <text
              x={rect.x + 30}
              y={rect.y + 60}
              fill="rgba(219, 237, 255, 0.7)"
              fontSize={14}
              fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
            >
              {panel.subtitle}
            </text>
            <text
              x={rect.x + rect.width - 30}
              y={rect.y + 34}
              textAnchor="end"
              fill="rgba(226, 239, 251, 0.82)"
              fontSize={13}
              fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
            >
              {`${panel.stats.visibleSamples} visible • ${panel.stats.blockedSamples} blocked • ${panel.stats.visibilityFractionLabel}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
