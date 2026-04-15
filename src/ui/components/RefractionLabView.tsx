import { useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { ObserverViewPanelData, RayBundlePanelData } from "../../domain/analysis";
import {
  getAtmosphereCurvatureMagnitudeAtHeight,
  getIntrinsicCurvatureMagnitude,
} from "../../domain/curvature";
import { getObserverTotalHeightM, getTargetTopElevationM } from "../../domain/scenario";
import type { VisibilitySolveResult, Vec2 } from "../../domain/types";
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
  results: VisibilitySolveResult[];
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

interface CurvatureSeries {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  points: Vec2[];
}

interface CurvatureViewData {
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  maxHeightM: number;
  series: CurvatureSeries[];
  seaLevelNetLabel: string;
  topFrameNetLabel: string;
}

function polylinePoints(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function formatCurvatureRatio(valuePerM: number, radiusM: number) {
  const ratio = valuePerM * radiusM;
  if (Math.abs(ratio) < 1e-6) {
    return "0.00 / R";
  }
  return `${ratio.toFixed(2)} / R`;
}

function createCurvatureBounds(series: CurvatureSeries[]) {
  const allPoints = series.flatMap((entry) => entry.points);
  const xs = allPoints.map((point) => point.x);
  const ys = [...allPoints.map((point) => point.y), 0];
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xSpan = Math.max(maxX - minX, 1);
  const ySpan = Math.max(maxY - minY, 0.4);
  const yPad = Math.max(ySpan * 0.16, 0.12);

  return {
    minX,
    maxX: maxX + xSpan * 0.04,
    minY: minY - yPad,
    maxY: maxY + yPad,
  };
}

function createCurvatureView(
  result: VisibilitySolveResult,
  language: LanguageMode,
): CurvatureViewData {
  const observerTopM = getObserverTotalHeightM(result.scenario);
  const targetTopM = getTargetTopElevationM(result.scenario);
  const atmosphereTopM =
    result.model.atmosphere.mode === "layered"
      ? result.model.atmosphere.transitionHeightM + result.model.atmosphere.inversionDepthM
      : 0;
  const structuralTopM = Math.max(observerTopM, targetTopM, atmosphereTopM, 150);
  const maxHeightM = Math.min(
    Math.max(
      structuralTopM < 300
        ? 300
        : structuralTopM < 2_000
          ? 2_000
          : structuralTopM < 12_000
            ? 12_000
            : Math.ceil((structuralTopM * 1.2) / 5_000) * 5_000,
      300,
    ),
    80_000,
  );
  const sampleCount = maxHeightM <= 2_000 ? 36 : 48;
  const heights = Array.from({ length: sampleCount }, (_, index) =>
    (maxHeightM * index) / (sampleCount - 1),
  );
  const intrinsicPerM =
    result.model.geometryMode === "concave"
      ? getIntrinsicCurvatureMagnitude(result.model, result.scenario)
      : 0;
  const intrinsicPoints = heights.map((heightM) => ({
    x: heightM,
    y: intrinsicPerM * result.scenario.radiusM,
  }));
  const atmospherePoints = heights.map((heightM) => ({
    x: heightM,
    y:
      -getAtmosphereCurvatureMagnitudeAtHeight(result.model, result.scenario, heightM) *
      result.scenario.radiusM,
  }));
  const netPoints = heights.map((heightM, index) => ({
    x: heightM,
    y: intrinsicPoints[index].y + atmospherePoints[index].y,
  }));

  const series: CurvatureSeries[] = [
    {
      id: "intrinsic",
      label: t(language, "intrinsicBend"),
      color: "#8d95ff",
      dashed: true,
      points: intrinsicPoints,
    },
    {
      id: "atmosphere",
      label: t(language, "atmosphericBend"),
      color: "#7be2ff",
      dashed: true,
      points: atmospherePoints,
    },
    {
      id: "net",
      label: t(language, "netBend"),
      color: "#ffd07e",
      points: netPoints,
    },
  ];

  return {
    bounds: createCurvatureBounds(series),
    maxHeightM,
    series,
    seaLevelNetLabel: formatCurvatureRatio(
      intrinsicPerM -
        getAtmosphereCurvatureMagnitudeAtHeight(result.model, result.scenario, 0),
      result.scenario.radiusM,
    ),
    topFrameNetLabel: formatCurvatureRatio(
      intrinsicPerM -
        getAtmosphereCurvatureMagnitudeAtHeight(result.model, result.scenario, maxHeightM),
      result.scenario.radiusM,
    ),
  };
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
  language: LanguageMode,
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
            {marker.id === "observer"
              ? t(language, "observerHeight")
              : marker.id === "target"
                ? t(language, "targetHeight")
                : marker.featureId}
          </text>
        ) : null}
      </g>
    );
  });
}

function renderCurvatureInset(
  curvatureView: CurvatureViewData,
  rect: PanelRect,
  unitPreferences: UnitPreferences,
  language: LanguageMode,
) {
  const insetRect: PanelRect = {
    x: rect.x + 22,
    y: rect.y + rect.height * 0.67,
    width: rect.width - 44,
    height: Math.max(rect.height * 0.27, 170),
  };
  const projector = createLinearProjector(insetRect, curvatureView.bounds, {
    zoom: 1,
    verticalZoom: 1,
    panX: 0,
    panY: 0,
    padding: {
      paddingX: [40, 18],
      paddingTop: [18, 18],
      paddingBottom: [28, 34],
    },
  });
  const project = projector.project;
  const baselineStart = project({ x: curvatureView.bounds.minX, y: 0 });
  const baselineEnd = project({ x: curvatureView.bounds.maxX, y: 0 });
  const xTickStep = niceStep(curvatureView.maxHeightM, 4);
  const ySpan = curvatureView.bounds.maxY - curvatureView.bounds.minY;
  const yTickStep = Math.max(niceStep(ySpan, 4), 0.25);

  return (
    <g>
      <rect
        x={insetRect.x}
        y={insetRect.y}
        width={insetRect.width}
        height={insetRect.height}
        rx={18}
        fill="rgba(7, 19, 31, 0.82)"
        stroke="rgba(141, 192, 255, 0.16)"
      />
      <text
        x={insetRect.x + 14}
        y={insetRect.y + 20}
        fill="rgba(240, 245, 252, 0.9)"
        fontSize={12}
        fontWeight={600}
      >
        {t(language, "refractionCurvaturePane")}
      </text>
      <text
        x={insetRect.x + 14}
        y={insetRect.y + 36}
        fill="rgba(181, 205, 230, 0.74)"
        fontSize={10.5}
      >
        {t(language, "refractionCurvaturePaneHint")}
      </text>

      <line
        x1={baselineStart.x}
        y1={baselineStart.y}
        x2={baselineEnd.x}
        y2={baselineEnd.y}
        stroke="rgba(196, 211, 233, 0.26)"
        strokeWidth={1}
        strokeDasharray="5 7"
      />

      {Array.from({ length: 5 }, (_, index) => index).map((step) => {
        const heightM = Math.min(curvatureView.maxHeightM, step * xTickStep);
        const point = project({ x: heightM, y: curvatureView.bounds.minY });
        return (
          <g key={`curvature-x-${heightM}`}>
            <line
              x1={point.x}
              y1={insetRect.y + insetRect.height - 26}
              x2={point.x}
              y2={insetRect.y + insetRect.height - 18}
              stroke="rgba(229, 238, 249, 0.62)"
              strokeWidth={1}
            />
            <text
              x={point.x}
              y={insetRect.y + insetRect.height - 6}
              textAnchor="middle"
              fill="rgba(231, 240, 250, 0.76)"
              fontSize={10.5}
            >
              {formatDistance(heightM, unitPreferences.height)}
            </text>
          </g>
        );
      })}

      {Array.from({ length: 5 }, (_, index) => index - 2).map((step) => {
        const value = step * yTickStep;
        if (value < curvatureView.bounds.minY || value > curvatureView.bounds.maxY) {
          return null;
        }
        const point = project({ x: curvatureView.bounds.minX, y: value });
        return (
          <g key={`curvature-y-${value}`}>
            <line
              x1={insetRect.x + 12}
              y1={point.y}
              x2={insetRect.x + 20}
              y2={point.y}
              stroke="rgba(229, 238, 249, 0.62)"
              strokeWidth={1}
            />
            <text
              x={insetRect.x + 8}
              y={point.y + 4}
              textAnchor="end"
              fill="rgba(231, 240, 250, 0.72)"
              fontSize={10.5}
            >
              {formatCurvatureRatio(value / 1, 1)}
            </text>
          </g>
        );
      })}

      {curvatureView.series.map((series) => {
        const projected = series.points.map(project);
        const end = projected[projected.length - 1];
        return (
          <g key={series.id}>
            <polyline
              points={polylinePoints(projected)}
              fill="none"
              stroke={series.color}
              strokeWidth={series.id === "net" ? 2.2 : 1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={series.dashed ? "7 7" : undefined}
            />
            <text
              x={end.x + 8}
              y={end.y - 6}
              fill={series.color}
              fontSize={10.5}
              fontWeight={600}
            >
              {series.label}
            </text>
          </g>
        );
      })}

      <text
        x={insetRect.x + insetRect.width - 12}
        y={insetRect.y + 20}
        textAnchor="end"
        fill="rgba(231, 240, 250, 0.76)"
        fontSize={10.5}
      >
        {`${t(language, "netBend")}: ${curvatureView.seaLevelNetLabel}`}
      </text>
      <text
        x={insetRect.x + insetRect.width - 12}
        y={insetRect.y + 36}
        textAnchor="end"
        fill="rgba(171, 201, 228, 0.72)"
        fontSize={10.5}
      >
        {`${t(language, "topFrameNetBend")}: ${curvatureView.topFrameNetLabel}`}
      </text>
      <text
        x={insetRect.x + insetRect.width / 2}
        y={insetRect.y + insetRect.height - 6}
        textAnchor="middle"
        fill="rgba(231, 240, 250, 0.68)"
        fontSize={10.5}
      >
        {t(language, "sampleHeightAxis")}
      </text>
      <text
        x={insetRect.x + 12}
        y={insetRect.y + 12}
        fill="rgba(231, 240, 250, 0.68)"
        fontSize={10.5}
      >
        {t(language, "curvatureRatioAxis")}
      </text>
    </g>
  );
}

export function RefractionLabView({
  observerPanels,
  bundlePanels,
  results,
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
  const curvatureViews = useMemo(
    () => results.map((result) => createCurvatureView(result, language)),
    [results, language],
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
        const curvatureView = curvatureViews[panelIndex];

        if (!observerPanel || !bundlePanel || !curvatureView) {
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

            {renderRayMarkers(bundlePanel, rayProject, annotated, language)}

            {showScaleGuides ? (
              <>
                {renderObserverScaleGuide(observerPanel, observerProject, unitPreferences, language)}
                {renderRayScaleGuide(bundlePanel, rayProject, unitPreferences, language)}
              </>
            ) : null}

            {renderCurvatureInset(
              curvatureView,
              raySubview.rect,
              unitPreferences,
              language,
            )}

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
