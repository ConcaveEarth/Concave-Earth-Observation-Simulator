import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { formatAngle, formatDistance } from "../../domain/units";
import type { UnitPreferences } from "../../domain/units";
import type { CompareLayoutMode } from "../../state/appState";
import type { ObserverViewPanelData } from "../../domain/analysis";

interface ObserverViewProps {
  panels: ObserverViewPanelData[];
  compareLayout: Exclude<CompareLayoutMode, "auto">;
  unitPreferences: UnitPreferences;
  showScaleGuides: boolean;
  annotated: boolean;
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
const SVG_HEIGHT = 1180;
const STACKED_HEIGHT = 1880;

function polylinePoints(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function createProjector(
  panel: PanelRect,
  bounds: ObserverViewPanelData["bounds"],
  zoom: number,
  verticalZoom: number,
  panX: number,
  panY: number,
) {
  const paddingX = Math.min(Math.max(panel.width * 0.06, 66), 120);
  const paddingTop = Math.min(Math.max(panel.height * 0.14, 72), 118);
  const paddingBottom = Math.min(Math.max(panel.height * 0.16, 94), 148);
  const availableWidth = panel.width - paddingX * 2;
  const availableHeight = panel.height - paddingTop - paddingBottom;
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1e-6);
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

function niceAngleStep(value: number): number {
  if (value <= 0) {
    return 0.5 * (Math.PI / 180);
  }

  const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10];
  const degrees = (value * 180) / Math.PI;
  const chosen = candidates.find((candidate) => degrees / candidate <= 5) ?? 10;
  return (chosen * Math.PI) / 180;
}

function renderObserverScaleGuide(
  panel: ObserverViewPanelData,
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
  const spanY = panel.bounds.maxY - panel.bounds.minY;
  const angleStep = niceAngleStep(spanY / 4);
  const axisWorldX = panel.bounds.maxX - spanX * 0.04;
  const axisBaseWorld = {
    x: axisWorldX,
    y: panel.bounds.minY + spanY * 0.08,
  };
  const axisTopWorld = {
    x: axisWorldX,
    y: axisBaseWorld.y + angleStep * 4,
  };
  const axisBase = project(axisBaseWorld);
  const axisTop = project(axisTopWorld);

  return (
    <g key={`${panel.sceneKey}-observer-scale`}>
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
          <g key={`${panel.sceneKey}-observer-scale-x-${index}`}>
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
        Apparent profile span
      </text>

      <line
        x1={axisBase.x}
        y1={axisBase.y}
        x2={axisTop.x}
        y2={axisTop.y}
        stroke="rgba(229, 238, 249, 0.72)"
        strokeWidth={1.15}
      />
      {Array.from({ length: 5 }, (_, index) => {
        const worldPoint = {
          x: axisWorldX,
          y: axisBaseWorld.y + angleStep * index,
        };
        const point = project(worldPoint);
        return (
          <g key={`${panel.sceneKey}-observer-scale-y-${index}`}>
            <line
              x1={axisBase.x - 7}
              y1={point.y}
              x2={axisBase.x + 7}
              y2={point.y}
              stroke="rgba(229, 238, 249, 0.72)"
              strokeWidth={1}
            />
            <text
              x={axisBase.x - 12}
              y={point.y + 4}
              textAnchor="end"
              fill="rgba(231, 240, 250, 0.78)"
              fontSize={11}
              fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
            >
              {formatAngle(worldPoint.y)}
            </text>
          </g>
        );
      })}
      <text
        x={axisBase.x + 18}
        y={(axisBase.y + axisTop.y) / 2}
        fill="rgba(231, 240, 250, 0.72)"
        fontSize={11}
        fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
      >
        Angular elevation
      </text>
    </g>
  );
}

export function ObserverView({
  panels,
  compareLayout,
  unitPreferences,
  showScaleGuides,
  annotated,
  fitContentHeight,
  zoom,
  verticalZoom,
  panX,
  panY,
  onPanBy,
  onAdjustZoom,
  onAdjustVerticalZoom,
}: ObserverViewProps) {
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
      aria-label="Observer-eye reconstruction"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      <defs>
        <linearGradient id="observerBackdrop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#07131f" />
          <stop offset="60%" stopColor="#0a1f30" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
        <linearGradient id="observerSkyFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(65, 134, 204, 0.14)" />
          <stop offset="100%" stopColor="rgba(20, 38, 58, 0.08)" />
        </linearGradient>
        <linearGradient id="observerSeaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(15, 33, 55, 0.6)" />
          <stop offset="100%" stopColor="rgba(3, 9, 18, 0.95)" />
        </linearGradient>
        <linearGradient id="observerPanelFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(9, 24, 38, 0.88)" />
          <stop offset="100%" stopColor="rgba(9, 18, 30, 0.72)" />
        </linearGradient>
        <filter id="observerGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {panels.map((panel, index) => (
          <clipPath key={panel.sceneKey} id={`observer-clip-${panel.sceneKey}`}>
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

      <rect width={svgWidth} height={svgHeight} fill="url(#observerBackdrop)" rx={30} />
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
        const horizonLeft = project({ x: panel.bounds.minX, y: panel.horizonElevationRad });
        const horizonRight = project({ x: panel.bounds.maxX, y: panel.horizonElevationRad });
        const eyeLeft = project({ x: panel.bounds.minX, y: panel.eyeLevelElevationRad });
        const eyeRight = project({ x: panel.bounds.maxX, y: panel.eyeLevelElevationRad });
        const seaPolygon = [
          { x: rect.x, y: horizonLeft.y },
          { x: rect.x + rect.width, y: horizonRight.y },
          { x: rect.x + rect.width, y: rect.y + rect.height },
          { x: rect.x, y: rect.y + rect.height },
        ];

        return (
          <g key={panel.sceneKey}>
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={28}
              fill="url(#observerPanelFill)"
              stroke="rgba(141, 192, 255, 0.18)"
            />

            <g clipPath={`url(#observer-clip-${panel.sceneKey})`}>
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill="url(#observerSkyFill)"
                opacity={0.82}
              />
              <polygon
                points={polylinePoints(seaPolygon)}
                fill="url(#observerSeaFill)"
                opacity={0.98}
              />

              <line
                x1={eyeLeft.x}
                y1={eyeLeft.y}
                x2={eyeRight.x}
                y2={eyeRight.y}
                stroke="rgba(168, 178, 255, 0.78)"
                strokeWidth={1.4}
                strokeDasharray="10 10"
              />
              <line
                x1={horizonLeft.x}
                y1={horizonLeft.y}
                x2={horizonRight.x}
                y2={horizonRight.y}
                stroke="rgba(141, 255, 203, 0.94)"
                strokeWidth={2.1}
                strokeDasharray="14 10"
                filter="url(#observerGlow)"
              />

              {panel.ghostSilhouette.length > 1 ? (
                <polyline
                  points={polylinePoints(panel.ghostSilhouette.map(project))}
                  fill="none"
                  stroke="rgba(220, 231, 242, 0.42)"
                  strokeWidth={2.1}
                  strokeDasharray="12 10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {panel.visibleSilhouette.length > 1 ? (
                <polyline
                  points={polylinePoints(panel.visibleSilhouette.map(project))}
                  fill="none"
                  stroke="rgba(255, 208, 126, 0.98)"
                  strokeWidth={3.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#observerGlow)"
                />
              ) : null}

              {panel.samplePoints.map((sample, sampleIndex) => {
                if (sampleIndex % Math.max(1, Math.floor(panel.samplePoints.length / 16)) !== 0) {
                  return null;
                }

                const point = project(sample.point);
                return (
                  <circle
                    key={sample.id}
                    cx={point.x}
                    cy={point.y}
                    r={2.6}
                    fill={sample.visible ? "#ffd07e" : "#a7b9cb"}
                    opacity={sample.visible ? 0.82 : 0.4}
                  />
                );
              })}

              {panel.markers.map((marker) => {
                const point = project(marker.point);
                return (
                  <g key={marker.id}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={5.6}
                      fill={marker.color}
                      stroke="rgba(255,255,255,0.72)"
                    />
                    {annotated ? (
                      <text
                        x={point.x + 10}
                        y={point.y - 10}
                        fill="#e9f4ff"
                        fontSize={13}
                        fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
                      >
                        {marker.label}
                      </text>
                    ) : null}
                  </g>
                );
              })}

              {annotated ? (
                <>
                  <text
                    x={eyeLeft.x + 14}
                    y={eyeLeft.y - 10}
                    fill="rgba(223, 231, 255, 0.86)"
                    fontSize={12}
                    fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
                  >
                    Observer horizontal
                  </text>
                  <text
                    x={horizonLeft.x + 14}
                    y={horizonLeft.y - 10}
                    fill="rgba(168, 255, 210, 0.88)"
                    fontSize={12}
                    fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
                  >
                    Apparent horizon {panel.stats.horizonDipLabel}
                  </text>
                </>
              ) : null}

              {showScaleGuides
                ? renderObserverScaleGuide(panel, project, unitPreferences)
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
              {`${panel.stats.visibleSamples} visible - ${panel.stats.blockedSamples} blocked - ${panel.stats.visibilityFractionLabel}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
