import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import {
  formatSweepMetricValue,
  formatSweepParameterValue,
  type SweepChartData,
  type SweepMetric,
  type SweepParameter,
} from "../../domain/analysis";
import type { UnitPreferences } from "../../domain/units";

interface SweepChartProps {
  data: SweepChartData;
  units: UnitPreferences;
  zoom: number;
  verticalZoom: number;
  panX: number;
  panY: number;
  onPanBy: (deltaX: number, deltaY: number) => void;
  onAdjustZoom: (delta: number) => void;
  onAdjustVerticalZoom: (delta: number) => void;
}

const SVG_WIDTH = 1880;
const SVG_HEIGHT = 1040;

function getParameterLabel(parameter: SweepParameter) {
  switch (parameter) {
    case "observerHeight":
      return "Observer height";
    case "targetHeight":
      return "Target height";
    case "atmosphere":
      return "Atmospheric coefficient";
    case "distance":
    default:
      return "Surface distance";
  }
}

function getMetricLabel(metric: SweepMetric) {
  switch (metric) {
    case "visibilityFraction":
      return "Visibility fraction";
    case "apparentElevation":
      return "Apparent elevation";
    case "opticalHorizon":
      return "Optical horizon";
    case "hiddenHeight":
    default:
      return "Hidden height";
  }
}

function linePoints(
  points: Array<{ x: number; y: number | null }>,
  project: (point: { x: number; y: number }) => { x: number; y: number },
) {
  return points
    .filter((point): point is { x: number; y: number } => point.y != null && Number.isFinite(point.y))
    .map((point) => {
      const projected = project(point);
      return `${projected.x},${projected.y}`;
    })
    .join(" ");
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

export function SweepChart({
  data,
  units,
  zoom,
  verticalZoom,
  panX,
  panY,
  onPanBy,
  onAdjustZoom,
  onAdjustVerticalZoom,
}: SweepChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const paddingLeft = 94;
  const paddingRight = 42;
  const paddingTop = 82;
  const paddingBottom = 118;
  const plotWidth = SVG_WIDTH - paddingLeft - paddingRight;
  const plotHeight = SVG_HEIGHT - paddingTop - paddingBottom;
  const xMin = data.range.min;
  const xMax = data.range.max;
  const yMin = data.yMin;
  const yMax = data.yMax;
  const xSpan = Math.max(xMax - xMin, 1e-6);
  const ySpan = Math.max(yMax - yMin, 1e-6);
  const xScale = (plotWidth / xSpan) * zoom;
  const yScale = (plotHeight / ySpan) * verticalZoom;
  const centerX = (xMin + xMax) / 2 + panX;
  const centerY = (yMin + yMax) / 2 + panY;
  const plotCenterX = paddingLeft + plotWidth / 2;
  const plotCenterY = paddingTop + plotHeight / 2;
  const project = (point: { x: number; y: number }) => ({
    x: plotCenterX + (point.x - centerX) * xScale,
    y: plotCenterY - (point.y - centerY) * yScale,
  });
  const currentX = project({ x: data.range.current, y: centerY }).x;
  const xStep = niceScaleStep(xSpan / 5);
  const yStep = niceScaleStep(ySpan / 4);

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
      x: ((event.clientX - rect.left) / rect.width) * SVG_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * SVG_HEIGHT,
    };
  }

  function pointInPlot(point: { x: number; y: number } | null) {
    return Boolean(
      point &&
        point.x >= paddingLeft &&
        point.x <= paddingLeft + plotWidth &&
        point.y >= paddingTop &&
        point.y <= paddingTop + plotHeight,
    );
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) {
      return;
    }

    const point = getSvgPoint(event);

    if (!pointInPlot(point)) {
      return;
    }

    const startPoint = point as { x: number; y: number };
    dragState.current = {
      pointerId: event.pointerId,
      lastPoint: startPoint,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  const dragState = useRef<{
    pointerId: number;
    lastPoint: { x: number; y: number };
  } | null>(null);

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragState.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const point = getSvgPoint(event);

    if (!point) {
      return;
    }

    const deltaX = point.x - drag.lastPoint.x;
    const deltaY = point.y - drag.lastPoint.y;
    drag.lastPoint = point;

    if (Math.abs(deltaX) < 0.2 && Math.abs(deltaY) < 0.2) {
      return;
    }

    onPanBy(-deltaX / Math.max(xScale, 1e-6), deltaY / Math.max(yScale, 1e-6));
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    if (dragState.current?.pointerId === event.pointerId) {
      dragState.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleWheel(event: ReactWheelEvent<SVGSVGElement>) {
    const point = getSvgPoint(event);

    if (!pointInPlot(point)) {
      return;
    }

    const delta = Math.max(-0.35, Math.min(0.35, -event.deltaY / 700));

    if (event.shiftKey) {
      event.preventDefault();
      onAdjustVerticalZoom(delta);
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      onAdjustZoom(delta);
    }
  }

  return (
    <svg
      ref={svgRef}
      className="scene-svg sweep-chart"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      role="img"
      aria-label="Parameter sweep chart"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      <defs>
        <linearGradient id="sweepBackdrop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#07131f" />
          <stop offset="55%" stopColor="#0a1f30" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
        <linearGradient id="sweepPanelFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(9, 24, 38, 0.88)" />
          <stop offset="100%" stopColor="rgba(9, 18, 30, 0.72)" />
        </linearGradient>
        <filter id="sweepGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="sweepPlotClip">
          <rect
            x={paddingLeft}
            y={paddingTop}
            width={plotWidth}
            height={plotHeight}
            rx={14}
          />
        </clipPath>
      </defs>

      <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#sweepBackdrop)" rx={30} />
      <rect
        x="10"
        y="18"
        width={SVG_WIDTH - 20}
        height={SVG_HEIGHT - 36}
        rx={28}
        fill="url(#sweepPanelFill)"
        stroke="rgba(141, 192, 255, 0.18)"
      />

      {Array.from({ length: 6 }, (_, index) => {
        const x = paddingLeft + (plotWidth * index) / 5;
        return (
          <line
            key={`sweep-grid-x-${index}`}
            x1={x}
            y1={paddingTop}
            x2={x}
            y2={paddingTop + plotHeight}
            stroke="rgba(136, 195, 255, 0.08)"
            strokeWidth={1}
          />
        );
      })}
      {Array.from({ length: 5 }, (_, index) => {
        const y = paddingTop + (plotHeight * index) / 4;
        return (
          <line
            key={`sweep-grid-y-${index}`}
            x1={paddingLeft}
            y1={y}
            x2={paddingLeft + plotWidth}
            y2={y}
            stroke="rgba(136, 195, 255, 0.08)"
            strokeWidth={1}
          />
        );
      })}

      <line
        x1={currentX}
        y1={paddingTop}
        x2={currentX}
        y2={paddingTop + plotHeight}
        stroke="rgba(255, 208, 126, 0.46)"
        strokeDasharray="10 10"
        strokeWidth={1.25}
      />

      {data.series.map((series) => (
        <g key={series.id} clipPath="url(#sweepPlotClip)">
          <polyline
            points={linePoints(series.points, project)}
            fill="none"
            stroke={series.color}
            strokeWidth={3}
            filter="url(#sweepGlow)"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {series.points
            .filter((point) => point.y != null && Number.isFinite(point.y))
            .map((point, index) => {
              if (index % Math.max(1, Math.floor(series.points.length / 10)) !== 0) {
                return null;
              }

              const projected = project({ x: point.x, y: point.y as number });
              return (
                <circle
                  key={`${series.id}-point-${index}`}
                  cx={projected.x}
                  cy={projected.y}
                  r={4}
                  fill={series.color}
                  stroke="rgba(255,255,255,0.72)"
                />
              );
            })}
        </g>
      ))}

      {Array.from({ length: 6 }, (_, index) => {
        const value = xMin + xStep * index;
        if (value > xMax + xStep * 0.05) {
          return null;
        }
        const projected = project({ x: value, y: yMin });
        return (
          <text
            key={`x-label-${index}`}
            x={projected.x}
            y={paddingTop + plotHeight + 28}
            textAnchor="middle"
            fill="rgba(231, 240, 250, 0.78)"
            fontSize={12}
            fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
          >
            {formatSweepParameterValue(value, data.parameter, units)}
          </text>
        );
      })}

      {Array.from({ length: 5 }, (_, index) => {
        const value = yMin + yStep * index;
        if (value > yMax + yStep * 0.05) {
          return null;
        }
        const projected = project({ x: xMin, y: value });
        return (
          <text
            key={`y-label-${index}`}
            x={paddingLeft - 16}
            y={projected.y + 4}
            textAnchor="end"
            fill="rgba(231, 240, 250, 0.78)"
            fontSize={12}
            fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
          >
            {formatSweepMetricValue(value, data.metric, units)}
          </text>
        );
      })}

      <line
        x1={paddingLeft}
        y1={paddingTop + plotHeight}
        x2={paddingLeft + plotWidth}
        y2={paddingTop + plotHeight}
        stroke="rgba(228, 238, 249, 0.72)"
        strokeWidth={1.2}
      />
      <line
        x1={paddingLeft}
        y1={paddingTop}
        x2={paddingLeft}
        y2={paddingTop + plotHeight}
        stroke="rgba(228, 238, 249, 0.72)"
        strokeWidth={1.2}
      />

      <text
        x="42"
        y="52"
        fill="#f5f2e8"
        fontSize={22}
        fontWeight="600"
        fontFamily="'Trebuchet MS', 'Segoe UI Variable Display', sans-serif"
      >
        Parameter Sweep
      </text>
      <text
        x="42"
        y="78"
        fill="rgba(219, 237, 255, 0.72)"
        fontSize={14}
        fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
      >
        Shared solver outputs traced across a controlled range for both model interpretations.
      </text>

      <text
        x={paddingLeft + plotWidth / 2}
        y={SVG_HEIGHT - 18}
        textAnchor="middle"
        fill="rgba(231, 240, 250, 0.78)"
        fontSize={13}
        fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
      >
        {getParameterLabel(data.parameter)}
      </text>
      <text
        x="22"
        y={paddingTop + plotHeight / 2}
        transform={`rotate(-90 22 ${paddingTop + plotHeight / 2})`}
        textAnchor="middle"
        fill="rgba(231, 240, 250, 0.78)"
        fontSize={13}
        fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
      >
        {getMetricLabel(data.metric)}
      </text>

      <g>
        {data.series.map((series, index) => (
          <g key={`${series.id}-legend`}>
            <circle
              cx={SVG_WIDTH - 260}
              cy={56 + index * 24}
              r={5}
              fill={series.color}
            />
            <text
              x={SVG_WIDTH - 246}
              y={60 + index * 24}
              fill="rgba(231, 240, 250, 0.82)"
              fontSize={13}
              fontFamily="'Segoe UI Variable Text', 'Segoe UI', sans-serif"
            >
              {series.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
