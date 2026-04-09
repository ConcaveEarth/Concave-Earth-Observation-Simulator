import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { CompareLayoutMode } from "../../state/appState";
import type { SkyWrapPanelData } from "../../domain/analysis";
import { t, type LanguageMode } from "../../i18n";
import {
  createLinearProjector,
  createPanelRects,
  findPanelIndex as findViewportPanelIndex,
  getSvgPoint as getViewportSvgPoint,
} from "../viewport";

interface SkyWrapViewProps {
  panels: SkyWrapPanelData[];
  compareLayout: Exclude<CompareLayoutMode, "auto">;
  language: LanguageMode;
  fitContentHeight: boolean;
  zoom: number;
  verticalZoom: number;
  panX: number;
  panY: number;
  onPanBy: (deltaX: number, deltaY: number) => void;
  onAdjustZoom: (delta: number) => void;
  onAdjustVerticalZoom: (delta: number) => void;
}

const SINGLE_SVG_WIDTH = 1800;
const COMPARE_SVG_WIDTH = 2360;
const STACKED_SVG_WIDTH = 1800;
const SVG_HEIGHT = 1180;
const STACKED_HEIGHT = 1880;

function polylinePoints(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export function SkyWrapView({
  panels,
  compareLayout,
  language,
  fitContentHeight,
  zoom,
  verticalZoom,
  panX,
  panY,
  onPanBy,
  onAdjustZoom,
  onAdjustVerticalZoom,
}: SkyWrapViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    lastPoint: { x: number; y: number };
    xScale: number;
    yScale: number;
  } | null>(null);
  const isCompare = panels.length > 1;
  const isStacked = isCompare && compareLayout === "stacked";
  const { svgWidth, svgHeight, panelRects } = createPanelRects({
    isCompare,
    isStacked,
    singleWidth: SINGLE_SVG_WIDTH,
    compareWidth: COMPARE_SVG_WIDTH,
    stackedWidth: STACKED_SVG_WIDTH,
    singleHeight: SVG_HEIGHT,
    stackedHeight: STACKED_HEIGHT,
  });

  function getSvgPoint(event: { clientX: number; clientY: number }) {
    return getViewportSvgPoint(svgRef, svgWidth, svgHeight, event);
  }

  function findPanelIndex(point: { x: number; y: number } | null) {
    return findViewportPanelIndex(point, panelRects);
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

    const projection = createLinearProjector(panelRects[panelIndex], panels[panelIndex].bounds, {
      zoom,
      verticalZoom,
      panX,
      panY,
      padding: {
        paddingX: [30, 56],
        paddingTop: [60, 104],
        paddingBottom: [76, 132],
      },
    });

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
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={t(language, "skyWrap")}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      <defs>
        <linearGradient id="skyWrapBackdrop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(9, 27, 41, 0.84)" />
          <stop offset="100%" stopColor="rgba(7, 15, 24, 0.96)" />
        </linearGradient>
      </defs>

      {panelRects.map((panelRect, panelIndex) => {
        const panel = panels[panelIndex];

        if (!panel) {
          return null;
        }

        const { project } = createLinearProjector(panelRect, panel.bounds, {
          zoom,
          verticalZoom,
          panX,
          panY,
          padding: {
            paddingX: [30, 56],
            paddingTop: [60, 104],
            paddingBottom: [76, 132],
          },
        });

        const observerPoint = project({ x: 0, y: 0 });

        return (
          <g key={panel.sceneKey}>
            <rect
              x={panelRect.x}
              y={panelRect.y}
              width={panelRect.width}
              height={panelRect.height}
              rx={26}
              fill="url(#skyWrapBackdrop)"
              stroke="rgba(141, 192, 255, 0.16)"
            />

            <text
              x={panelRect.x + 24}
              y={panelRect.y + 34}
              fill="#f5f2e8"
              fontSize={21}
              fontWeight={600}
              fontFamily="Trebuchet MS, 'Segoe UI Variable Display', sans-serif"
            >
              {panel.title}
            </text>
            <text
              x={panelRect.x + 24}
              y={panelRect.y + 58}
              fill="rgba(219, 237, 255, 0.7)"
              fontSize={13}
              fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
            >
              {panel.subtitle}
            </text>

            {panel.gridCurves.map((curve) => (
              <polyline
                key={curve.id}
                points={polylinePoints(curve.points.map(project))}
                fill="none"
                stroke={curve.color}
                strokeWidth={1.2}
              />
            ))}

            {panel.rayCurves.map((curve) => {
              const projected = curve.points.map(project);
              const labelPoint = projected[Math.max(0, projected.length - 10)];

              return (
                <g key={curve.id}>
                  <polyline
                    points={polylinePoints(projected)}
                    fill="none"
                    stroke={curve.color}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    filter={`drop-shadow(0 0 6px ${curve.color}44)`}
                  />
                  <text
                    x={labelPoint.x + 8}
                    y={labelPoint.y - 6}
                    fill="rgba(248, 246, 236, 0.84)"
                    fontSize={12}
                    fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
                  >
                    {curve.label}
                  </text>
                </g>
              );
            })}

            <circle
              cx={observerPoint.x}
              cy={observerPoint.y}
              r={7}
              fill="#f5f2e8"
              stroke="rgba(255,255,255,0.84)"
              strokeWidth={1.5}
            />
            <text
              x={observerPoint.x + 12}
              y={observerPoint.y - 10}
              fill="#f5f2e8"
              fontSize={12}
              fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
            >
              {t(language, "observerMarker")}
            </text>

            <g transform={`translate(${panelRect.x + panelRect.width - 286}, ${panelRect.y + 26})`}>
              <rect
                x={0}
                y={0}
                width={262}
                height={86}
                rx={16}
                fill="rgba(7, 18, 28, 0.82)"
                stroke="rgba(141, 192, 255, 0.16)"
              />
              <text x={16} y={24} fill="#f6f0df" fontSize={13}>
                {`${t(language, "intrinsicBend")}: ${panel.stats.intrinsicLabel}`}
              </text>
              <text x={16} y={47} fill="#dfeeff" fontSize={13}>
                {`${t(language, "atmosphericBend")}: ${panel.stats.atmosphereLabel}`}
              </text>
              <text x={16} y={70} fill="#ffd07e" fontSize={13}>
                {`${t(language, "netBend")}: ${panel.stats.netLabel}`}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
