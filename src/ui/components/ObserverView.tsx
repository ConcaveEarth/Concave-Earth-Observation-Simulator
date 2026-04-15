import { useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { formatAngle, formatDistance } from "../../domain/units";
import type { UnitPreferences } from "../../domain/units";
import type { CompareLayoutMode } from "../../state/appState";
import type { ObserverViewPanelData } from "../../domain/analysis";
import { t, type LanguageMode } from "../../i18n";
import {
  createLinearProjector,
  createPanelRects,
  findPanelIndex as findViewportPanelIndex,
  getSvgPoint as getViewportSvgPoint,
  niceStep,
  type PanelRect,
} from "../viewport";

interface ObserverViewProps {
  panels: ObserverViewPanelData[];
  compareLayout: Exclude<CompareLayoutMode, "auto">;
  unitPreferences: UnitPreferences;
  language: LanguageMode;
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

interface SubviewRect {
  kind: "image" | "chart";
  rect: PanelRect;
}

const SINGLE_SVG_WIDTH = 2140;
const COMPARE_SVG_WIDTH = 2860;
const STACKED_SVG_WIDTH = 2140;
const SVG_HEIGHT = 1380;
const STACKED_HEIGHT = 2340;

function polylinePoints(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
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

function buildSubviewRects(panelRect: PanelRect): SubviewRect[] {
  const headerHeight = 86;
  const gutter = 22;
  const contentX = panelRect.x + 18;
  const contentY = panelRect.y + headerHeight;
  const contentWidth = panelRect.width - 36;
  const contentHeight = panelRect.height - headerHeight - 18;
  const imageWidth = contentWidth * 0.56;
  const chartWidth = contentWidth - imageWidth - gutter;

  return [
    {
      kind: "image",
      rect: {
        x: contentX,
        y: contentY,
        width: imageWidth,
        height: contentHeight,
      },
    },
    {
      kind: "chart",
      rect: {
        x: contentX + imageWidth + gutter,
        y: contentY,
        width: chartWidth,
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

function renderObserverScaleGuide(
  panel: ObserverViewPanelData,
  project: (point: { x: number; y: number }) => { x: number; y: number },
  rect: PanelRect,
  unitPreferences: UnitPreferences,
  language: LanguageMode,
) {
  const spanX = panel.bounds.maxX - panel.bounds.minX;
  const horizontalStep = niceStep(spanX, 4);
  const spanY = panel.bounds.maxY - panel.bounds.minY;
  const angleStep = niceAngleStep(spanY / 4);
  const startWorld = {
    x: panel.bounds.minX + spanX * 0.08,
    y: panel.bounds.minY + spanY * 0.08,
  };
  const endWorld = {
    x: startWorld.x + horizontalStep,
    y: startWorld.y,
  };
  const start = project(startWorld);
  const end = project(endWorld);
  const axisWorldX = panel.bounds.maxX - spanX * 0.03;
  const axisBaseWorld = {
    x: axisWorldX,
    y: panel.bounds.minY + spanY * 0.08,
  };
  const axisTopWorld = {
    x: axisWorldX,
    y: Math.min(panel.bounds.maxY, axisBaseWorld.y + angleStep * 4),
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
        {t(language, "apparentProfileSpanLabel")}
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
        x={rect.x + rect.width - 18}
        y={rect.y + 18}
        textAnchor="end"
        fill="rgba(231, 240, 250, 0.72)"
        fontSize={11}
        fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
      >
        {t(language, "angularElevationLabel")}
      </text>
    </g>
  );
}

export function ObserverView({
  panels,
  compareLayout,
  unitPreferences,
  language,
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
    const subview = findSubviewRect(point, panelSubviewRects[panelIndex]);

    if (!panel || !subview) {
      return null;
    }

    return {
      projector: createLinearProjector(subview.rect, panel.bounds, {
        zoom,
        verticalZoom,
        panX,
        panY,
        padding: {
          paddingX: subview.kind === "image" ? [24, 44] : [32, 64],
          paddingTop: subview.kind === "image" ? [28, 54] : [48, 86],
          paddingBottom: subview.kind === "image" ? [42, 76] : [74, 130],
        },
      }),
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
      aria-label={t(language, "observerView")}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      <defs>
        <linearGradient id="observerBackdrop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#07131f" />
          <stop offset="58%" stopColor="#0a1f30" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
        <linearGradient id="observerPaneFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(9, 24, 38, 0.9)" />
          <stop offset="100%" stopColor="rgba(9, 18, 30, 0.74)" />
        </linearGradient>
        <linearGradient id="observerImageFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(71, 151, 219, 0.2)" />
          <stop offset="100%" stopColor="rgba(16, 36, 58, 0.06)" />
        </linearGradient>
        <linearGradient id="observerSeaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(17, 40, 63, 0.72)" />
          <stop offset="100%" stopColor="rgba(5, 14, 22, 0.96)" />
        </linearGradient>
        <linearGradient id="observerChartFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(14, 29, 45, 0.78)" />
          <stop offset="100%" stopColor="rgba(9, 18, 29, 0.56)" />
        </linearGradient>
        <filter id="observerGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {panels.flatMap((panel, index) =>
          panelSubviewRects[index].map((subview) => (
            <clipPath
              key={`${panel.sceneKey}-${subview.kind}-clip`}
              id={`${panel.sceneKey}-${subview.kind}-clip`}
            >
              <rect
                x={subview.rect.x}
                y={subview.rect.y}
                width={subview.rect.width}
                height={subview.rect.height}
                rx={24}
              />
            </clipPath>
          )),
        )}
      </defs>

      <rect width={svgWidth} height={svgHeight} fill="url(#observerBackdrop)" rx={30} />
      <circle cx="220" cy="160" r="220" fill="rgba(53, 164, 255, 0.08)" />
      <circle cx={svgWidth - 240} cy="100" r="180" fill="rgba(255, 163, 82, 0.06)" />

      {panels.map((panel, index) => {
        const rect = panelRects[index];
        const [imageSubview, chartSubview] = panelSubviewRects[index];
        const imageProjection = createLinearProjector(imageSubview.rect, panel.bounds, {
          zoom,
          verticalZoom,
          panX,
          panY,
          padding: {
            paddingX: [24, 44],
            paddingTop: [28, 54],
            paddingBottom: [42, 76],
          },
        });
        const chartProjection = createLinearProjector(chartSubview.rect, panel.bounds, {
          zoom,
          verticalZoom,
          panX,
          panY,
          padding: {
            paddingX: [32, 64],
            paddingTop: [48, 86],
            paddingBottom: [74, 130],
          },
        });
        const imageProject = imageProjection.project;
        const chartProject = chartProjection.project;
        const horizonLeftImage = imageProject({
          x: panel.bounds.minX,
          y: panel.horizonElevationRad,
        });
        const horizonRightImage = imageProject({
          x: panel.bounds.maxX,
          y: panel.horizonElevationRad,
        });
        const eyeLeftImage = imageProject({
          x: panel.bounds.minX,
          y: panel.eyeLevelElevationRad,
        });
        const eyeRightImage = imageProject({
          x: panel.bounds.maxX,
          y: panel.eyeLevelElevationRad,
        });
        const imageSeaPolygon = [
          { x: imageSubview.rect.x, y: horizonLeftImage.y },
          { x: imageSubview.rect.x + imageSubview.rect.width, y: horizonRightImage.y },
          { x: imageSubview.rect.x + imageSubview.rect.width, y: imageSubview.rect.y + imageSubview.rect.height },
          { x: imageSubview.rect.x, y: imageSubview.rect.y + imageSubview.rect.height },
        ];
        const visibleImageSilhouette = panel.visibleSilhouette.map(imageProject);
        const ghostImageSilhouette = panel.ghostSilhouette.map(imageProject);
        const visibleChartSilhouette = panel.visibleSilhouette.map(chartProject);
        const ghostChartSilhouette = panel.ghostSilhouette.map(chartProject);
        const horizonLeftChart = chartProject({
          x: panel.bounds.minX,
          y: panel.horizonElevationRad,
        });
        const horizonRightChart = chartProject({
          x: panel.bounds.maxX,
          y: panel.horizonElevationRad,
        });
        const eyeLeftChart = chartProject({
          x: panel.bounds.minX,
          y: panel.eyeLevelElevationRad,
        });
        const eyeRightChart = chartProject({
          x: panel.bounds.maxX,
          y: panel.eyeLevelElevationRad,
        });

        return (
          <g key={panel.sceneKey}>
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={28}
              fill="url(#observerPaneFill)"
              stroke="rgba(141, 192, 255, 0.18)"
            />

            <text
              x={rect.x + 30}
              y={rect.y + 34}
              fill="#f5f2e8"
              fontSize={22}
              fontWeight={600}
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

            {[imageSubview, chartSubview].map((subview) => (
              <rect
                key={`${panel.sceneKey}-${subview.kind}`}
                x={subview.rect.x}
                y={subview.rect.y}
                width={subview.rect.width}
                height={subview.rect.height}
                rx={24}
                fill={subview.kind === "image" ? "url(#observerImageFill)" : "url(#observerChartFill)"}
                stroke="rgba(141, 192, 255, 0.12)"
              />
            ))}

            <text
              x={imageSubview.rect.x + 18}
              y={imageSubview.rect.y + 28}
              fill="rgba(240, 245, 252, 0.88)"
              fontSize={14}
              fontWeight={600}
            >
              {t(language, "observerReconstructionTitle")}
            </text>
            <text
              x={chartSubview.rect.x + 18}
              y={chartSubview.rect.y + 28}
              fill="rgba(240, 245, 252, 0.88)"
              fontSize={14}
              fontWeight={600}
            >
              {t(language, "observerView")}
            </text>
            <text
              x={chartSubview.rect.x + 18}
              y={chartSubview.rect.y + 48}
              fill="rgba(181, 205, 230, 0.72)"
              fontSize={12}
            >
              Angular trace of the reconstructed profile.
            </text>

            <g clipPath={`url(#${panel.sceneKey}-image-clip)`}>
              <polygon
                points={polylinePoints(imageSeaPolygon)}
                fill="url(#observerSeaFill)"
                opacity={0.96}
              />
              {showScaleGuides
                ? Array.from({ length: 5 }, (_, gridIndex) => {
                    const fraction = (gridIndex + 1) / 6;
                    const x = imageSubview.rect.x + fraction * imageSubview.rect.width;
                    const y = imageSubview.rect.y + fraction * imageSubview.rect.height;
                    return (
                      <g key={`${panel.sceneKey}-image-grid-${gridIndex}`}>
                        <line
                          x1={x}
                          y1={imageSubview.rect.y + 18}
                          x2={x}
                          y2={imageSubview.rect.y + imageSubview.rect.height - 18}
                          stroke="rgba(138, 177, 219, 0.08)"
                          strokeDasharray="4 12"
                        />
                        <line
                          x1={imageSubview.rect.x + 18}
                          y1={y}
                          x2={imageSubview.rect.x + imageSubview.rect.width - 18}
                          y2={y}
                          stroke="rgba(138, 177, 219, 0.06)"
                          strokeDasharray="4 12"
                        />
                      </g>
                    );
                  })
                : null}

              <line
                x1={eyeLeftImage.x}
                y1={eyeLeftImage.y}
                x2={eyeRightImage.x}
                y2={eyeRightImage.y}
                stroke="rgba(168, 178, 255, 0.74)"
                strokeWidth={1.25}
                strokeDasharray="10 10"
              />
              <line
                x1={horizonLeftImage.x}
                y1={horizonLeftImage.y}
                x2={horizonRightImage.x}
                y2={horizonRightImage.y}
                stroke="rgba(141, 255, 203, 0.96)"
                strokeWidth={2}
                strokeDasharray="14 10"
                filter="url(#observerGlow)"
              />

              {ghostImageSilhouette.length > 1 ? (
                <polyline
                  points={polylinePoints(ghostImageSilhouette)}
                  fill="none"
                  stroke="rgba(220, 231, 242, 0.34)"
                  strokeWidth={2.2}
                  strokeDasharray="10 10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {visibleImageSilhouette.length > 1 ? (
                <>
                  <polyline
                    points={polylinePoints(visibleImageSilhouette)}
                    fill="none"
                    stroke="rgba(255, 208, 126, 0.26)"
                    strokeWidth={10}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#observerGlow)"
                  />
                  <polyline
                    points={polylinePoints(visibleImageSilhouette)}
                    fill="none"
                    stroke="#ffd07e"
                    strokeWidth={3.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : null}

              {panel.samplePoints.map((sample, sampleIndex) => {
                if (sampleIndex % Math.max(1, Math.floor(panel.samplePoints.length / 18)) !== 0) {
                  return null;
                }
                const point = imageProject({
                  x: sample.point.x,
                  y: sample.apparentElevationRad ?? sample.actualElevationRad,
                });
                return (
                  <circle
                    key={`${sample.id}-image`}
                    cx={point.x}
                    cy={point.y}
                    r={sample.visible ? 3.1 : 2.3}
                    fill={sample.visible ? "#8ff1bf" : "rgba(255,255,255,0.26)"}
                  />
                );
              })}

              {annotated ? (
                <>
                  <text
                    x={eyeLeftImage.x + 14}
                    y={eyeLeftImage.y - 12}
                    fill="rgba(223, 231, 255, 0.88)"
                    fontSize={12}
                    fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
                  >
                    {t(language, "observerHorizontalLabel")}
                  </text>
                  <text
                    x={horizonLeftImage.x + 14}
                    y={horizonLeftImage.y - 12}
                    fill="rgba(168, 255, 210, 0.9)"
                    fontSize={12}
                    fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
                  >
                    {t(language, "apparentHorizonLabel")}
                  </text>
                </>
              ) : null}
            </g>

            <g clipPath={`url(#${panel.sceneKey}-chart-clip)`}>
              {showScaleGuides
                ? Array.from({ length: 5 }, (_, gridIndex) => {
                    const fraction = (gridIndex + 1) / 6;
                    const x = chartSubview.rect.x + fraction * chartSubview.rect.width;
                    const y = chartSubview.rect.y + fraction * chartSubview.rect.height;
                    return (
                      <g key={`${panel.sceneKey}-chart-grid-${gridIndex}`}>
                        <line
                          x1={x}
                          y1={chartSubview.rect.y + 18}
                          x2={x}
                          y2={chartSubview.rect.y + chartSubview.rect.height - 18}
                          stroke="rgba(138, 177, 219, 0.08)"
                          strokeDasharray="4 10"
                        />
                        <line
                          x1={chartSubview.rect.x + 18}
                          y1={y}
                          x2={chartSubview.rect.x + chartSubview.rect.width - 18}
                          y2={y}
                          stroke="rgba(138, 177, 219, 0.08)"
                          strokeDasharray="4 10"
                        />
                      </g>
                    );
                  })
                : null}

              <line
                x1={eyeLeftChart.x}
                y1={eyeLeftChart.y}
                x2={eyeRightChart.x}
                y2={eyeRightChart.y}
                stroke="rgba(168, 178, 255, 0.7)"
                strokeWidth={1.2}
                strokeDasharray="10 10"
              />
              <line
                x1={horizonLeftChart.x}
                y1={horizonLeftChart.y}
                x2={horizonRightChart.x}
                y2={horizonRightChart.y}
                stroke="rgba(141, 255, 203, 0.94)"
                strokeWidth={1.7}
                strokeDasharray="14 10"
              />

              {ghostChartSilhouette.length > 1 ? (
                <polyline
                  points={polylinePoints(ghostChartSilhouette)}
                  fill="none"
                  stroke="rgba(220, 231, 242, 0.44)"
                  strokeWidth={2.2}
                  strokeDasharray="10 10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {visibleChartSilhouette.length > 1 ? (
                <polyline
                  points={polylinePoints(visibleChartSilhouette)}
                  fill="none"
                  stroke="#ffd07e"
                  strokeWidth={2.9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#observerGlow)"
                />
              ) : null}

              {panel.samplePoints.map((sample, sampleIndex) => {
                if (sampleIndex % Math.max(1, Math.floor(panel.samplePoints.length / 16)) !== 0) {
                  return null;
                }
                const point = chartProject({
                  x: sample.point.x,
                  y: sample.apparentElevationRad ?? sample.actualElevationRad,
                });
                return (
                  <circle
                    key={`${sample.id}-chart`}
                    cx={point.x}
                    cy={point.y}
                    r={sample.visible ? 3 : 2.2}
                    fill={sample.visible ? "#ffd07e" : "rgba(215, 228, 241, 0.3)"}
                  />
                );
              })}

              {panel.markers.map((marker) => {
                const point = chartProject(marker.point);
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

              {showScaleGuides
                ? renderObserverScaleGuide(
                    panel,
                    chartProject,
                    chartSubview.rect,
                    unitPreferences,
                    language,
                  )
                : null}
            </g>

            <g transform={`translate(${rect.x + rect.width - 312}, ${rect.y + 22})`}>
              <rect
                x={0}
                y={0}
                width={286}
                height={108}
                rx={18}
                fill="rgba(7, 18, 28, 0.84)"
                stroke="rgba(141, 192, 255, 0.18)"
              />
              <text x={16} y={24} fill="rgba(171, 201, 228, 0.76)" fontSize={11.5}>
                {t(language, "visibleSamples")}
              </text>
              <text x={168} y={24} fill="#f5f2e8" fontSize={11.8} fontWeight={600}>
                {String(panel.stats.visibleSamples)}
              </text>
              <text x={16} y={44} fill="rgba(171, 201, 228, 0.76)" fontSize={11.5}>
                {t(language, "blockedSamples")}
              </text>
              <text x={168} y={44} fill="#f5f2e8" fontSize={11.8} fontWeight={600}>
                {String(panel.stats.blockedSamples)}
              </text>
              <text x={16} y={64} fill="rgba(171, 201, 228, 0.76)" fontSize={11.5}>
                {t(language, "apparentHorizonDip")}
              </text>
              <text x={168} y={64} fill="#f5f2e8" fontSize={11.8} fontWeight={600}>
                {panel.stats.horizonDipLabel}
              </text>
              <text x={16} y={84} fill="rgba(171, 201, 228, 0.76)" fontSize={11.5}>
                {t(language, "apparentProfileSpan")}
              </text>
              <text x={168} y={84} fill="#f5f2e8" fontSize={11.8} fontWeight={600}>
                {formatDistance(panel.stats.apparentProfileSpanM, unitPreferences.distance)}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
