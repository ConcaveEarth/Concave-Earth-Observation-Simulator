import { useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { CompareLayoutMode } from "../../state/appState";
import type {
  InversionLabCurve,
  InversionLabMarker,
  InversionLabPanelData,
} from "../../domain/analysis";
import { t, type LanguageMode } from "../../i18n";
import {
  createLinearProjector,
  createPanelRects,
  findPanelIndex as findViewportPanelIndex,
  getSvgPoint as getViewportSvgPoint,
  type PanelRect,
} from "../viewport";

interface InversionLabViewProps {
  panels: InversionLabPanelData[];
  compareLayout: Exclude<CompareLayoutMode, "auto">;
  language: LanguageMode;
  annotated: boolean;
  showGuides: boolean;
  fitContentHeight: boolean;
  zoom: number;
  verticalZoom: number;
  panX: number;
  panY: number;
  onPanBy: (deltaX: number, deltaY: number) => void;
  onAdjustZoom: (delta: number) => void;
  onAdjustVerticalZoom: (delta: number) => void;
}

const SINGLE_SVG_WIDTH = 2240;
const COMPARE_SVG_WIDTH = 2920;
const STACKED_SVG_WIDTH = 2240;
const SVG_HEIGHT = 1420;
const STACKED_HEIGHT = 2460;

interface SubviewRect {
  rect: PanelRect;
  kind: "local" | "global";
}

interface UniformProjector {
  xScale: number;
  yScale: number;
  project: (point: { x: number; y: number }) => { x: number; y: number };
}

function polylinePoints(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCurveFraction(featureId: string) {
  switch (featureId) {
    case "surface":
    case "inversion-boundary":
      return 0.2;
    case "actual-ray":
      return 0.62;
    case "mapped-direct":
    case "mapped-actual":
      return 0.56;
    case "apparent-line":
      return 0.72;
    case "observer-horizontal":
    case "observer-tangent":
    case "target-tangent":
      return 0.78;
    case "geometric-sightline":
      return 0.52;
    default:
      return 0.58;
  }
}

function pointOnPolyline(points: Array<{ x: number; y: number }>, fraction: number) {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  if (points.length === 1) {
    return points[0];
  }

  const segmentLengths = points.slice(1).map((point, index) =>
    Math.hypot(point.x - points[index].x, point.y - points[index].y),
  );
  const totalLength = segmentLengths.reduce((sum, value) => sum + value, 0);

  if (totalLength <= 1e-6) {
    return points[Math.round((points.length - 1) * fraction)];
  }

  const targetLength = totalLength * clamp(fraction, 0, 1);
  let traversed = 0;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];

    if (traversed + segmentLength >= targetLength) {
      const localT = (targetLength - traversed) / Math.max(segmentLength, 1e-6);
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * localT,
        y: points[index].y + (points[index + 1].y - points[index].y) * localT,
      };
    }

    traversed += segmentLength;
  }

  return points[points.length - 1];
}

function createUniformProjector(
  panel: PanelRect,
  bounds: InversionLabPanelData["globalView"]["bounds"],
  {
    zoom,
    panX,
    panY,
    paddingX = 28,
    paddingY = 32,
  }: {
    zoom: number;
    panX: number;
    panY: number;
    paddingX?: number;
    paddingY?: number;
  },
): UniformProjector {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1e-6);
  const centerX = (bounds.minX + bounds.maxX) / 2 + panX;
  const centerY = (bounds.minY + bounds.maxY) / 2 + panY;
  const visibleSpanX = spanX / Math.max(zoom, 0.1);
  const visibleSpanY = spanY / Math.max(zoom, 0.1);
  const usableWidth = Math.max(panel.width - paddingX * 2, 1);
  const usableHeight = Math.max(panel.height - paddingY * 2, 1);
  const scale = Math.min(usableWidth / visibleSpanX, usableHeight / visibleSpanY);
  const centerScreenX = panel.x + panel.width / 2;
  const centerScreenY = panel.y + panel.height / 2;

  return {
    xScale: scale,
    yScale: scale,
    project: (point) => ({
      x: centerScreenX + (point.x - centerX) * scale,
      y: centerScreenY - (point.y - centerY) * scale,
    }),
  };
}

function buildSubviewRects(panelRect: PanelRect): SubviewRect[] {
  const headerHeight = 84;
  const contentX = panelRect.x + 18;
  const contentY = panelRect.y + headerHeight;
  const contentWidth = panelRect.width - 36;
  const contentHeight = panelRect.height - headerHeight - 18;
  const insetPadding = 20;
  const localWidth = Math.min(contentWidth * 0.36, 520);
  const localHeight = Math.min(contentHeight * 0.42, 360);

  return [
    {
      kind: "local",
      rect: {
        x: contentX + insetPadding,
        y: contentY + insetPadding,
        width: localWidth,
        height: localHeight,
      },
    },
    {
      kind: "global",
      rect: {
        x: contentX,
        y: contentY,
        width: contentWidth,
        height: contentHeight,
      },
    },
  ];
}

function findSubviewRect(point: { x: number; y: number } | null, subviews: SubviewRect[]) {
  if (!point) {
    return null;
  }

  return (
    subviews.find(
      (entry) =>
        point.x >= entry.rect.x &&
        point.x <= entry.rect.x + entry.rect.width &&
        point.y >= entry.rect.y &&
        point.y <= entry.rect.y + entry.rect.height,
    ) ?? null
  );
}

function renderCurveLabel(
  curve: InversionLabCurve,
  projected: Array<{ x: number; y: number }>,
  index: number,
  tint = "rgba(239, 244, 251, 0.84)",
) {
  if (projected.length < 2) {
    return null;
  }

  const anchor = pointOnPolyline(projected, getCurveFraction(curve.featureId));
  const offsetX =
    curve.featureId === "mapped-direct" || curve.featureId === "mapped-actual" ? 10 : 8;
  const offsetY =
    curve.featureId === "surface" || curve.featureId === "inversion-boundary"
      ? -12
      : curve.featureId === "observer-horizontal"
        ? -10
        : -8;

  return (
    <text
      key={`${curve.id}-label-${index}`}
      x={anchor.x + offsetX}
      y={anchor.y + offsetY}
      fill={tint}
      fontSize={11.5}
      fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
    >
      {curve.label}
    </text>
  );
}

function renderMarkers(markers: InversionLabMarker[], project: UniformProjector["project"] | ReturnType<typeof createLinearProjector>["project"], annotated: boolean) {
  return markers.map((marker) => {
    const projected = project(marker.point);
    return (
      <g key={marker.id}>
        <circle
          cx={projected.x}
          cy={projected.y}
          r={6.5}
          fill={marker.color}
          stroke="rgba(255,255,255,0.88)"
          strokeWidth={1.4}
        />
        {annotated ? (
          <text
            x={projected.x + (marker.labelOffset?.x ?? 10)}
            y={projected.y + (marker.labelOffset?.y ?? -10)}
            fill="#f5f2e8"
            fontSize={12}
            fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
          >
            {marker.label}
          </text>
        ) : null}
      </g>
    );
  });
}

export function InversionLabView({
  panels,
  compareLayout,
  language,
  annotated,
  showGuides,
  fitContentHeight,
  zoom,
  verticalZoom,
  panX,
  panY,
  onPanBy,
  onAdjustZoom,
  onAdjustVerticalZoom,
}: InversionLabViewProps) {
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

  const panelSubviewRects = useMemo(
    () => panelRects.map((panelRect) => buildSubviewRects(panelRect)),
    [panelRects],
  );

  function getSvgPoint(event: { clientX: number; clientY: number }) {
    return getViewportSvgPoint(svgRef, svgWidth, svgHeight, event);
  }

  function getViewportProjection(point: { x: number; y: number } | null) {
    const panelIndex = findViewportPanelIndex(point, panelRects);

    if (panelIndex < 0 || !point) {
      return null;
    }

    const panel = panels[panelIndex];

    if (!panel) {
      return null;
    }

    const subview = findSubviewRect(point, panelSubviewRects[panelIndex]);

    if (!subview) {
      return null;
    }

    if (subview.kind === "local") {
      const projector = createLinearProjector(subview.rect, panel.localView.bounds, {
        zoom,
        verticalZoom,
        panX,
        panY,
        padding: {
          paddingX: [24, 46],
          paddingTop: [26, 48],
          paddingBottom: [34, 56],
        },
      });

      return {
        subview,
        projector,
      };
    }

    const projector = createUniformProjector(subview.rect, panel.globalView.bounds, {
      zoom,
      panX,
      panY,
    });

    return {
      subview,
      projector,
    };
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) {
      return;
    }

    const point = getSvgPoint(event);
    const activeProjection = getViewportProjection(point);

    if (!point || !activeProjection) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      lastPoint: point,
      xScale: activeProjection.projector.xScale,
      yScale: activeProjection.projector.yScale,
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

    if (!getViewportProjection(point)) {
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
      aria-label={t(language, "inversionLab")}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      <defs>
        <linearGradient id="inversionBackdrop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(8, 22, 35, 0.92)" />
          <stop offset="100%" stopColor="rgba(7, 14, 23, 0.98)" />
        </linearGradient>
        <linearGradient id="inversionSubviewFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(19, 37, 55, 0.62)" />
          <stop offset="100%" stopColor="rgba(10, 20, 31, 0.48)" />
        </linearGradient>
      </defs>

      {panelRects.map((panelRect, panelIndex) => {
        const panel = panels[panelIndex];

        if (!panel) {
          return null;
        }

        const [localSubview, globalSubview] = panelSubviewRects[panelIndex];
        const localProjector = createLinearProjector(localSubview.rect, panel.localView.bounds, {
          zoom,
          verticalZoom,
          panX,
          panY,
          padding: {
            paddingX: [24, 46],
            paddingTop: [26, 48],
            paddingBottom: [34, 56],
          },
        });
        const globalProjector = createUniformProjector(globalSubview.rect, panel.globalView.bounds, {
          zoom,
          panX,
          panY,
        });
        const globalCenter = globalProjector.project({ x: 0, y: 0 });
        const globalCoreRadius = panel.coreRadiusM * globalProjector.xScale;
        const globalHeaderX = Math.max(
          globalSubview.rect.x + 18,
          localSubview.rect.x + localSubview.rect.width + 36,
        );

        return (
          <g key={panel.sceneKey}>
            <rect
              x={panelRect.x}
              y={panelRect.y}
              width={panelRect.width}
              height={panelRect.height}
              rx={26}
              fill="url(#inversionBackdrop)"
              stroke="rgba(141, 192, 255, 0.16)"
            />

            <text
              x={panelRect.x + 24}
              y={panelRect.y + 34}
              fill="#f5f2e8"
              fontSize={20}
              fontWeight={600}
              fontFamily="Trebuchet MS, 'Segoe UI Variable Display', sans-serif"
            >
              {panel.title}
            </text>
            <text
              x={panelRect.x + 24}
              y={panelRect.y + 58}
              fill="rgba(219, 237, 255, 0.72)"
              fontSize={13}
              fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
            >
              {panel.subtitle}
            </text>

            <rect
              x={globalSubview.rect.x}
              y={globalSubview.rect.y}
              width={globalSubview.rect.width}
              height={globalSubview.rect.height}
              rx={22}
              fill="url(#inversionSubviewFill)"
              stroke="rgba(141, 192, 255, 0.1)"
            />

            <text
              x={globalHeaderX}
              y={globalSubview.rect.y + 28}
              fill="rgba(240, 245, 252, 0.86)"
              fontSize={14}
              fontWeight={600}
            >
              {t(language, "inversionGlobalView")}
            </text>
            <text
              x={globalHeaderX}
              y={globalSubview.rect.y + 48}
              fill="rgba(181, 205, 230, 0.72)"
              fontSize={12}
            >
              {t(language, "inversionReciprocalGrid")}
            </text>

            {showGuides
              ? panel.globalGuideRadiiM.map((radius, guideIndex) => (
                  <circle
                    key={`${panel.sceneKey}-global-ring-${guideIndex}`}
                    cx={globalCenter.x}
                    cy={globalCenter.y}
                    r={radius * globalProjector.xScale}
                    fill="none"
                    stroke="rgba(176, 202, 231, 0.16)"
                    strokeDasharray="5 10"
                  />
                ))
              : null}

            {showGuides
              ? Array.from({ length: 12 }, (_, index) => {
                  const angle = ((Math.PI * 2) / 12) * index;
                  const start = globalProjector.project({ x: 0, y: 0 });
                  const end = globalProjector.project({
                    x: panel.inversionRadiusM * Math.cos(angle),
                    y: panel.inversionRadiusM * Math.sin(angle),
                  });
                  return (
                    <line
                      key={`${panel.sceneKey}-global-spoke-${index}`}
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      stroke="rgba(176, 202, 231, 0.1)"
                      strokeDasharray="4 12"
                    />
                  );
                })
              : null}

            <circle
              cx={globalCenter.x}
              cy={globalCenter.y}
              r={globalCoreRadius}
              fill="rgba(7, 17, 28, 0.82)"
              stroke="rgba(221, 232, 246, 0.18)"
              strokeWidth={1.2}
            />

            {panel.globalView.curves.map((curve, curveIndex) => {
              const projected = curve.points.map(globalProjector.project);
              return (
                <g key={curve.id}>
                  <polyline
                    points={polylinePoints(projected)}
                    fill="none"
                    stroke={curve.color}
                    strokeWidth={curve.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={curve.dashed ? "9 9" : undefined}
                    opacity={curve.opacity ?? 1}
                    filter={`drop-shadow(0 0 6px ${curve.color}30)`}
                  />
                  {annotated
                    ? renderCurveLabel(curve, projected, curveIndex, "rgba(241, 246, 252, 0.8)")
                    : null}
                </g>
              );
            })}
            {renderMarkers(panel.globalView.markers, globalProjector.project, annotated)}

            <rect
              x={localSubview.rect.x}
              y={localSubview.rect.y}
              width={localSubview.rect.width}
              height={localSubview.rect.height}
              rx={22}
              fill="url(#inversionSubviewFill)"
              stroke="rgba(141, 192, 255, 0.22)"
            />
            <text
              x={localSubview.rect.x + 18}
              y={localSubview.rect.y + 28}
              fill="rgba(240, 245, 252, 0.9)"
              fontSize={14}
              fontWeight={600}
            >
              {t(language, "inversionLocalView")}
            </text>
            <text
              x={localSubview.rect.x + 18}
              y={localSubview.rect.y + 48}
              fill="rgba(181, 205, 230, 0.76)"
              fontSize={12}
            >
              {`${t(language, "vertical")}: x${panel.localVerticalScale.toFixed(1)}`}
            </text>

            {showGuides
              ? Array.from({ length: 5 }, (_, index) => index + 1).map((step) => {
                  const fraction = step / 6;
                  const x = localSubview.rect.x + fraction * localSubview.rect.width;
                  const y = localSubview.rect.y + fraction * localSubview.rect.height;
                  return (
                    <g key={`${panel.sceneKey}-local-grid-${step}`}>
                      <line
                        x1={x}
                        y1={localSubview.rect.y + 18}
                        x2={x}
                        y2={localSubview.rect.y + localSubview.rect.height - 18}
                        stroke="rgba(138, 177, 219, 0.08)"
                        strokeDasharray="4 10"
                      />
                      <line
                        x1={localSubview.rect.x + 18}
                        y1={y}
                        x2={localSubview.rect.x + localSubview.rect.width - 18}
                        y2={y}
                        stroke="rgba(138, 177, 219, 0.08)"
                        strokeDasharray="4 10"
                      />
                    </g>
                  );
                })
              : null}

            {panel.localView.curves.map((curve, curveIndex) => {
              const projected = curve.points.map(localProjector.project);
              return (
                <g key={curve.id}>
                  <polyline
                    points={polylinePoints(projected)}
                    fill="none"
                    stroke={curve.color}
                    strokeWidth={curve.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={curve.dashed ? "9 9" : undefined}
                    opacity={curve.opacity ?? 1}
                    filter={`drop-shadow(0 0 6px ${curve.color}33)`}
                  />
                  {annotated ? renderCurveLabel(curve, projected, curveIndex) : null}
                </g>
              );
            })}

            {renderMarkers(panel.localView.markers, localProjector.project, annotated)}

            <g transform={`translate(${panelRect.x + panelRect.width - 338}, ${panelRect.y + 22})`}>
              <rect
                x={0}
                y={0}
                width={314}
                height={132}
                rx={18}
                fill="rgba(7, 18, 28, 0.84)"
                stroke="rgba(141, 192, 255, 0.18)"
              />
              {panel.audit.map((item, index) => (
                <g key={`${panel.sceneKey}-audit-${item.label}`}>
                  <text
                    x={16}
                    y={24 + index * 18}
                    fill="rgba(171, 201, 228, 0.76)"
                    fontSize={11.5}
                  >
                    {item.label}
                  </text>
                  <text
                    x={196}
                    y={24 + index * 18}
                    fill="#f5f2e8"
                    fontSize={11.8}
                    fontWeight={600}
                  >
                    {item.value}
                  </text>
                </g>
              ))}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
