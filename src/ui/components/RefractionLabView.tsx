import { useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { ObserverViewPanelData, RayBundlePanelData } from "../../domain/analysis";
import { formatAngle, formatDistance, type UnitPreferences } from "../../domain/units";
import { t, type LanguageMode } from "../../i18n";
import type { CompareLayoutMode } from "../../state/appState";
import {
  createLinearProjector,
  createPanelRects,
  findPanelIndex as findViewportPanelIndex,
  getSvgPoint as getViewportSvgPoint,
  niceStep,
  type PanelRect,
} from "../viewport";

interface RefractionLabViewProps {
  observerPanels: ObserverViewPanelData[];
  bundlePanels: RayBundlePanelData[];
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

const SINGLE_SVG_WIDTH = 2260;
const COMPARE_SVG_WIDTH = 2940;
const STACKED_SVG_WIDTH = 2260;
const SVG_HEIGHT = 1480;
const STACKED_HEIGHT = 2420;

interface SubviewRect {
  kind: "observer" | "ray";
  rect: PanelRect;
}

function polylinePoints(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function buildSubviewRects(panelRect: PanelRect): SubviewRect[] {
  const headerHeight = 86;
  const gutter = 20;
  const contentX = panelRect.x + 18;
  const contentY = panelRect.y + headerHeight;
  const contentWidth = panelRect.width - 36;
  const contentHeight = panelRect.height - headerHeight - 18;
  const observerWidth = contentWidth * 0.42;
  const rayWidth = contentWidth - observerWidth - gutter;

  return [
    {
      kind: "observer",
      rect: {
        x: contentX,
        y: contentY,
        width: observerWidth,
        height: contentHeight,
      },
    },
    {
      kind: "ray",
      rect: {
        x: contentX + observerWidth + gutter,
        y: contentY,
        width: rayWidth,
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
  unitPreferences: UnitPreferences,
  language: LanguageMode,
) {
  const spanX = panel.bounds.maxX - panel.bounds.minX;
  const horizontalStep = niceStep(spanX, 4);
  const startWorld = {
    x: panel.bounds.minX + spanX * 0.1,
    y: panel.bounds.minY + (panel.bounds.maxY - panel.bounds.minY) * 0.08,
  };
  const endWorld = { x: startWorld.x + horizontalStep, y: startWorld.y };
  const start = project(startWorld);
  const end = project(endWorld);

  return (
    <g>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="rgba(229, 238, 249, 0.72)"
        strokeWidth={1.1}
      />
      {Array.from({ length: 5 }, (_, index) => {
        const x = start.x + ((end.x - start.x) * index) / 4;
        return (
          <g key={`observer-scale-${panel.sceneKey}-${index}`}>
            <line
              x1={x}
              y1={start.y - 6}
              x2={x}
              y2={start.y + 6}
              stroke="rgba(229, 238, 249, 0.72)"
              strokeWidth={1}
            />
            <text
              x={x}
              y={start.y - 12}
              textAnchor="middle"
              fill="rgba(231, 240, 250, 0.8)"
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
        y={start.y + 24}
        textAnchor="middle"
        fill="rgba(231, 240, 250, 0.74)"
        fontSize={11}
        fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
      >
        {t(language, "apparentProfileSpanLabel")}
      </text>
    </g>
  );
}

function renderRayScaleGuide(
  panel: RayBundlePanelData,
  project: (point: { x: number; y: number }) => { x: number; y: number },
  unitPreferences: UnitPreferences,
  language: LanguageMode,
) {
  const spanX = panel.bounds.maxX - panel.bounds.minX;
  const horizontalStep = niceStep(spanX, 4);
  const startWorld = {
    x: panel.bounds.minX + spanX * 0.08,
    y: panel.bounds.minY + (panel.bounds.maxY - panel.bounds.minY) * 0.08,
  };
  const endWorld = { x: startWorld.x + horizontalStep, y: startWorld.y };
  const start = project(startWorld);
  const end = project(endWorld);

  return (
    <g>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="rgba(229, 238, 249, 0.72)"
        strokeWidth={1.1}
      />
      {Array.from({ length: 5 }, (_, index) => {
        const x = start.x + ((end.x - start.x) * index) / 4;
        return (
          <g key={`bundle-scale-${panel.sceneKey}-${index}`}>
            <line
              x1={x}
              y1={start.y - 6}
              x2={x}
              y2={start.y + 6}
              stroke="rgba(229, 238, 249, 0.72)"
              strokeWidth={1}
            />
            <text
              x={x}
              y={start.y - 12}
              textAnchor="middle"
              fill="rgba(231, 240, 250, 0.8)"
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
        y={start.y + 24}
        textAnchor="middle"
        fill="rgba(231, 240, 250, 0.74)"
        fontSize={11}
        fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
      >
        {t(language, "sampledBundleSpanLabel")}
      </text>
    </g>
  );
}

function renderObserverMarkers(
  panel: ObserverViewPanelData,
  project: (point: { x: number; y: number }) => { x: number; y: number },
  annotated: boolean,
) {
  return panel.markers.map((marker) => {
    const projected = project(marker.point);
    return (
      <g key={marker.id}>
        <circle
          cx={projected.x}
          cy={projected.y}
          r={5.6}
          fill={marker.color}
          stroke="rgba(255,255,255,0.84)"
          strokeWidth={1.2}
        />
        {annotated ? (
          <text
            x={projected.x + 10}
            y={projected.y - 10}
            fill="#f5f2e8"
            fontSize={11.5}
            fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
          >
            {marker.label}
          </text>
        ) : null}
      </g>
    );
  });
}

function renderRayMarkers(
  panel: RayBundlePanelData,
  project: (point: { x: number; y: number }) => { x: number; y: number },
  annotated: boolean,
) {
  return panel.markers.map((marker) => {
    const projected = project(marker.point);
    return (
      <g key={marker.id}>
        <circle
          cx={projected.x}
          cy={projected.y}
          r={5.6}
          fill={marker.color}
          stroke="rgba(255,255,255,0.84)"
          strokeWidth={1.2}
        />
        {annotated ? (
          <text
            x={projected.x + 10}
            y={projected.y - 10}
            fill="#f5f2e8"
            fontSize={11.5}
            fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
          >
            {marker.id === "observer" ? t("en" as LanguageMode, "observerHeight") : marker.id === "target" ? t("en" as LanguageMode, "targetHeight") : marker.featureId}
          </text>
        ) : null}
      </g>
    );
  });
}

export function RefractionLabView({
  observerPanels,
  bundlePanels,
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
}: RefractionLabViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    lastPoint: { x: number; y: number };
    xScale: number;
    yScale: number;
  } | null>(null);
  const isCompare = observerPanels.length > 1;
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

    const observerPanel = observerPanels[panelIndex];
    const bundlePanel = bundlePanels[panelIndex];

    if (!observerPanel || !bundlePanel) {
      return null;
    }

    const subview = findSubviewRect(point, panelSubviewRects[panelIndex]);

    if (!subview) {
      return null;
    }

    const projector =
      subview.kind === "observer"
        ? createLinearProjector(subview.rect, observerPanel.bounds, {
            zoom,
            verticalZoom,
            panX,
            panY,
            padding: {
              paddingX: [26, 48],
              paddingTop: [36, 62],
              paddingBottom: [54, 92],
            },
          })
        : createLinearProjector(subview.rect, bundlePanel.bounds, {
            zoom,
            verticalZoom,
            panX,
            panY,
            padding: {
              paddingX: [24, 42],
              paddingTop: [48, 82],
              paddingBottom: [92, 150],
            },
          });

    return { projector };
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
      aria-label={t(language, "refractionLab")}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      <defs>
        <linearGradient id="refractionLabBackdrop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#07131f" />
          <stop offset="58%" stopColor="#091c2d" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
        <linearGradient id="refractionLabPanelFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(9, 24, 38, 0.9)" />
          <stop offset="100%" stopColor="rgba(9, 18, 30, 0.74)" />
        </linearGradient>
        <linearGradient id="refractionLabSubviewFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(17, 34, 52, 0.82)" />
          <stop offset="100%" stopColor="rgba(9, 18, 29, 0.6)" />
        </linearGradient>
        <linearGradient id="refractionLabSkyFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(67, 140, 212, 0.2)" />
          <stop offset="100%" stopColor="rgba(20, 38, 58, 0.06)" />
        </linearGradient>
        <linearGradient id="refractionLabSeaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(14, 34, 58, 0.68)" />
          <stop offset="100%" stopColor="rgba(4, 12, 20, 0.96)" />
        </linearGradient>
        <linearGradient id="refractionLabSurfaceFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(31, 87, 126, 0.24)" />
          <stop offset="100%" stopColor="rgba(4, 15, 25, 0.95)" />
        </linearGradient>
        <filter id="refractionGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width={svgWidth} height={svgHeight} fill="url(#refractionLabBackdrop)" rx={30} />
      <circle cx="240" cy="170" r="220" fill="rgba(53, 164, 255, 0.08)" />
      <circle cx={svgWidth - 260} cy="110" r="180" fill="rgba(255, 163, 82, 0.06)" />

      {panelRects.map((panelRect, panelIndex) => {
        const observerPanel = observerPanels[panelIndex];
        const bundlePanel = bundlePanels[panelIndex];

        if (!observerPanel || !bundlePanel) {
          return null;
        }

        const [observerSubview, raySubview] = panelSubviewRects[panelIndex];
        const observerProjection = createLinearProjector(
          observerSubview.rect,
          observerPanel.bounds,
          {
            zoom,
            verticalZoom,
            panX,
            panY,
            padding: {
              paddingX: [26, 48],
              paddingTop: [36, 62],
              paddingBottom: [54, 92],
            },
          },
        );
        const rayProjection = createLinearProjector(raySubview.rect, bundlePanel.bounds, {
          zoom,
          verticalZoom,
          panX,
          panY,
          padding: {
            paddingX: [24, 42],
            paddingTop: [48, 82],
            paddingBottom: [92, 150],
          },
        });
        const observerProject = observerProjection.project;
        const rayProject = rayProjection.project;
        const projectedVisible = observerPanel.visibleSilhouette.map(observerProject);
        const projectedGhost = observerPanel.ghostSilhouette.map(observerProject);
        const horizonStart = observerProject({
          x: observerPanel.bounds.minX,
          y: observerPanel.horizonElevationRad,
        });
        const horizonEnd = observerProject({
          x: observerPanel.bounds.maxX,
          y: observerPanel.horizonElevationRad,
        });
        const eyeLevelStart = observerProject({
          x: observerPanel.bounds.minX,
          y: observerPanel.eyeLevelElevationRad,
        });
        const eyeLevelEnd = observerProject({
          x: observerPanel.bounds.maxX,
          y: observerPanel.eyeLevelElevationRad,
        });
        const observerSkyBottom = Math.min(
          observerSubview.rect.y + observerSubview.rect.height,
          horizonStart.y,
        );

        const projectedSurface = bundlePanel.surfacePoints.map(rayProject);
        const surfacePolygon = [
          ...projectedSurface,
          { x: projectedSurface[projectedSurface.length - 1].x, y: raySubview.rect.y + raySubview.rect.height },
          { x: projectedSurface[0].x, y: raySubview.rect.y + raySubview.rect.height },
        ];
        const observerStemBase = rayProject(bundlePanel.observerStem.base);
        const observerStemTop = rayProject(bundlePanel.observerStem.top);
        const targetStemBase = rayProject(bundlePanel.targetStem.base);
        const targetStemTop = rayProject(bundlePanel.targetStem.top);

        return (
          <g key={observerPanel.sceneKey}>
            <rect
              x={panelRect.x}
              y={panelRect.y}
              width={panelRect.width}
              height={panelRect.height}
              rx={28}
              fill="url(#refractionLabPanelFill)"
              stroke="rgba(141, 192, 255, 0.18)"
            />

            <text
              x={panelRect.x + 24}
              y={panelRect.y + 34}
              fill="#f5f2e8"
              fontSize={20}
              fontWeight={600}
              fontFamily="Trebuchet MS, 'Segoe UI Variable Display', sans-serif"
            >
              {observerPanel.title}
            </text>
            <text
              x={panelRect.x + 24}
              y={panelRect.y + 58}
              fill="rgba(219, 237, 255, 0.72)"
              fontSize={13}
              fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
            >
              {observerPanel.subtitle}
            </text>

            {[observerSubview, raySubview].map((subview) => (
              <rect
                key={`${observerPanel.sceneKey}-${subview.kind}`}
                x={subview.rect.x}
                y={subview.rect.y}
                width={subview.rect.width}
                height={subview.rect.height}
                rx={24}
                fill="url(#refractionLabSubviewFill)"
                stroke="rgba(141, 192, 255, 0.1)"
              />
            ))}

            <text
              x={observerSubview.rect.x + 18}
              y={observerSubview.rect.y + 28}
              fill="rgba(240, 245, 252, 0.86)"
              fontSize={14}
              fontWeight={600}
            >
              {t(language, "refractionObserverPane")}
            </text>
            <text
              x={raySubview.rect.x + 18}
              y={raySubview.rect.y + 28}
              fill="rgba(240, 245, 252, 0.86)"
              fontSize={14}
              fontWeight={600}
            >
              {t(language, "refractionRayPane")}
            </text>
            <text
              x={raySubview.rect.x + 18}
              y={raySubview.rect.y + 48}
              fill="rgba(181, 205, 230, 0.72)"
              fontSize={12}
            >
              {t(language, "refractionBundlePaneHint")}
            </text>

            {showScaleGuides ? (
              <>
                {Array.from({ length: 5 }, (_, index) => index + 1).map((step) => {
                  const fraction = step / 6;
                  const x = raySubview.rect.x + fraction * raySubview.rect.width;
                  const y = raySubview.rect.y + fraction * raySubview.rect.height;
                  const observerX = observerSubview.rect.x + fraction * observerSubview.rect.width;
                  const observerY = observerSubview.rect.y + fraction * observerSubview.rect.height;
                  return (
                    <g key={`${observerPanel.sceneKey}-refraction-grid-${step}`}>
                      <line
                        x1={observerX}
                        y1={observerSubview.rect.y + 18}
                        x2={observerX}
                        y2={observerSubview.rect.y + observerSubview.rect.height - 18}
                        stroke="rgba(138, 177, 219, 0.08)"
                        strokeDasharray="4 10"
                      />
                      <line
                        x1={observerSubview.rect.x + 18}
                        y1={observerY}
                        x2={observerSubview.rect.x + observerSubview.rect.width - 18}
                        y2={observerY}
                        stroke="rgba(138, 177, 219, 0.08)"
                        strokeDasharray="4 10"
                      />
                      <line
                        x1={x}
                        y1={raySubview.rect.y + 18}
                        x2={x}
                        y2={raySubview.rect.y + raySubview.rect.height - 18}
                        stroke="rgba(138, 177, 219, 0.08)"
                        strokeDasharray="4 10"
                      />
                      <line
                        x1={raySubview.rect.x + 18}
                        y1={y}
                        x2={raySubview.rect.x + raySubview.rect.width - 18}
                        y2={y}
                        stroke="rgba(138, 177, 219, 0.08)"
                        strokeDasharray="4 10"
                      />
                    </g>
                  );
                })}
              </>
            ) : null}

            <rect
              x={observerSubview.rect.x + 1}
              y={observerSubview.rect.y + 1}
              width={observerSubview.rect.width - 2}
              height={Math.max(observerSkyBottom - observerSubview.rect.y, 0)}
              rx={24}
              fill="url(#refractionLabSkyFill)"
            />
            <rect
              x={observerSubview.rect.x + 1}
              y={observerSkyBottom}
              width={observerSubview.rect.width - 2}
              height={Math.max(observerSubview.rect.y + observerSubview.rect.height - observerSkyBottom, 0)}
              fill="url(#refractionLabSeaFill)"
            />

            <line
              x1={eyeLevelStart.x}
              y1={eyeLevelStart.y}
              x2={eyeLevelEnd.x}
              y2={eyeLevelEnd.y}
              stroke="rgba(162, 182, 255, 0.7)"
              strokeWidth={1.1}
              strokeDasharray="10 10"
            />
            <line
              x1={horizonStart.x}
              y1={horizonStart.y}
              x2={horizonEnd.x}
              y2={horizonEnd.y}
              stroke="rgba(152, 232, 190, 0.94)"
              strokeWidth={1.5}
            />

            {projectedGhost.length > 1 ? (
              <polyline
                points={polylinePoints(projectedGhost)}
                fill="none"
                stroke="rgba(214, 223, 236, 0.38)"
                strokeWidth={2}
                strokeDasharray="8 8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {projectedVisible.length > 1 ? (
              <>
                <polyline
                  points={polylinePoints(projectedVisible)}
                  fill="none"
                  stroke="rgba(255, 210, 126, 0.32)"
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#refractionGlow)"
                />
                <polyline
                  points={polylinePoints(projectedVisible)}
                  fill="none"
                  stroke="#ffd07e"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            ) : null}

            {observerPanel.samplePoints.map((sample) => {
              const projected = observerProject(sample.point);
              return (
                <circle
                  key={sample.id}
                  cx={projected.x}
                  cy={projected.y}
                  r={sample.visible ? 3.6 : 2.6}
                  fill={sample.visible ? "#8ff1bf" : "rgba(255,255,255,0.24)"}
                />
              );
            })}

            {renderObserverMarkers(observerPanel, observerProject, annotated)}

            <polygon
              points={polylinePoints(surfacePolygon)}
              fill="url(#refractionLabSurfaceFill)"
            />

            <line
              x1={observerStemBase.x}
              y1={observerStemBase.y}
              x2={observerStemTop.x}
              y2={observerStemTop.y}
              stroke="rgba(239, 244, 251, 0.85)"
              strokeWidth={2}
            />
            <line
              x1={targetStemBase.x}
              y1={targetStemBase.y}
              x2={targetStemTop.x}
              y2={targetStemTop.y}
              stroke="rgba(247, 143, 143, 0.88)"
              strokeWidth={2}
            />

            {bundlePanel.traces.map((trace) => {
              const projected = trace.points.map(rayProject);
              return (
                <polyline
                  key={trace.id}
                  points={polylinePoints(projected)}
                  fill="none"
                  stroke={trace.color}
                  strokeWidth={trace.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={trace.dashed ? "8 8" : undefined}
                  filter={trace.featureId === "ray-actual" ? "url(#refractionGlow)" : undefined}
                  opacity={trace.featureId === "trace-visible" ? 0.96 : 0.82}
                />
              );
            })}

            {bundlePanel.samplePoints.map((sample) => {
              const projected = rayProject(sample.point);
              return (
                <circle
                  key={sample.id}
                  cx={projected.x}
                  cy={projected.y}
                  r={sample.visible ? 3.5 : 2.6}
                  fill={sample.visible ? "#8ff1bf" : "rgba(255,255,255,0.24)"}
                />
              );
            })}

            {renderRayMarkers(bundlePanel, rayProject, annotated)}

            {showScaleGuides ? (
              <>
                {renderObserverScaleGuide(observerPanel, observerProject, unitPreferences, language)}
                {renderRayScaleGuide(bundlePanel, rayProject, unitPreferences, language)}
              </>
            ) : null}

            <g transform={`translate(${panelRect.x + panelRect.width - 338}, ${panelRect.y + 22})`}>
              <rect
                x={0}
                y={0}
                width={314}
                height={122}
                rx={18}
                fill="rgba(7, 18, 28, 0.84)"
                stroke="rgba(141, 192, 255, 0.18)"
              />
              <text x={16} y={24} fill="rgba(171, 201, 228, 0.76)" fontSize={11.5}>
                {t(language, "visibleSamples")}
              </text>
              <text x={194} y={24} fill="#f5f2e8" fontSize={11.8} fontWeight={600}>
                {String(bundlePanel.stats.visibleSamples)}
              </text>
              <text x={16} y={44} fill="rgba(171, 201, 228, 0.76)" fontSize={11.5}>
                {t(language, "blockedSamples")}
              </text>
              <text x={194} y={44} fill="#f5f2e8" fontSize={11.8} fontWeight={600}>
                {String(bundlePanel.stats.blockedSamples)}
              </text>
              <text x={16} y={64} fill="rgba(171, 201, 228, 0.76)" fontSize={11.5}>
                {t(language, "apparentHorizonDip")}
              </text>
              <text x={194} y={64} fill="#f5f2e8" fontSize={11.8} fontWeight={600}>
                {observerPanel.stats.horizonDipLabel}
              </text>
              <text x={16} y={84} fill="rgba(171, 201, 228, 0.76)" fontSize={11.5}>
                {t(language, "bundleSpan")}
              </text>
              <text x={194} y={84} fill="#f5f2e8" fontSize={11.8} fontWeight={600}>
                {formatDistance(bundlePanel.stats.bundleSpanM, unitPreferences.distance)}
              </text>
              <text x={16} y={104} fill="rgba(171, 201, 228, 0.76)" fontSize={11.5}>
                {t(language, "visibleTopElevation")}
              </text>
              <text x={194} y={104} fill="#f5f2e8" fontSize={11.8} fontWeight={600}>
                {observerPanel.stats.topVisibleElevationRad == null
                  ? "N/A"
                  : formatAngle(observerPanel.stats.topVisibleElevationRad)}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
