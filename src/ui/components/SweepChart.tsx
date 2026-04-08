import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components";
import { LineChart } from "echarts/charts";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import {
  formatSweepMetricValue,
  formatSweepParameterValue,
  type SweepChartData,
  type SweepMetric,
  type SweepParameter,
} from "../../domain/analysis";
import { clamp, type UnitPreferences } from "../../domain/units";
import { t, type LanguageMode } from "../../i18n";

echarts.use([
  LineChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
]);

interface SweepChartProps {
  data: SweepChartData;
  units: UnitPreferences;
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

function getParameterLabel(language: LanguageMode, parameter: SweepParameter) {
  switch (parameter) {
    case "observerHeight":
      return t(language, "observerHeightParameter");
    case "targetHeight":
      return t(language, "targetHeightParameter");
    case "atmosphere":
      return t(language, "atmosphereParameter");
    case "distance":
    default:
      return t(language, "distanceParameter");
  }
}

function getMetricLabel(language: LanguageMode, metric: SweepMetric) {
  switch (metric) {
    case "visibilityFraction":
      return t(language, "visibilityFractionMetric");
    case "apparentElevation":
      return t(language, "apparentElevationMetric");
    case "opticalHorizon":
      return t(language, "opticalHorizonMetric");
    case "hiddenHeight":
    default:
      return t(language, "hiddenHeightMetric");
  }
}

function buildViewport(
  min: number,
  max: number,
  zoom: number,
  pan: number,
) {
  const span = Math.max(max - min, 1e-6);
  const visibleSpan = clamp(span / Math.max(zoom, 0.35), span / 6, span);
  const halfVisibleSpan = visibleSpan / 2;
  const rawCenter = (min + max) / 2 + pan;
  const center = clamp(rawCenter, min + halfVisibleSpan, max - halfVisibleSpan);

  return {
    min: center - halfVisibleSpan,
    max: center + halfVisibleSpan,
    span: visibleSpan,
  };
}

export function SweepChart({
  data,
  units,
  language,
  fitContentHeight,
  zoom,
  verticalZoom,
  panX,
  panY,
  onPanBy,
  onAdjustZoom,
  onAdjustVerticalZoom,
}: SweepChartProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{
    pointerId: number;
    lastPoint: { x: number; y: number };
  } | null>(null);

  const xViewport = useMemo(
    () => buildViewport(data.range.min, data.range.max, zoom, panX),
    [data.range.max, data.range.min, panX, zoom],
  );
  const yViewport = useMemo(
    () => buildViewport(data.yMin, data.yMax, verticalZoom, panY),
    [data.yMax, data.yMin, panY, verticalZoom],
  );

  useEffect(() => {
    const node = chartRef.current;

    if (!node) {
      return;
    }

    const chart = echarts.getInstanceByDom(node) ?? echarts.init(node, undefined, {
      renderer: "canvas",
    });

    chart.setOption(
      {
        backgroundColor: "transparent",
        animationDuration: 380,
        title: {
          text: t(language, "parameterSweepTitle"),
          subtext: t(language, "parameterSweepBody"),
          left: 22,
          top: 16,
          textStyle: {
            color: "#f5f2e8",
            fontFamily: "Trebuchet MS, 'Segoe UI Variable Display', sans-serif",
            fontSize: 22,
            fontWeight: 600,
          },
          subtextStyle: {
            color: "rgba(219, 237, 255, 0.72)",
            fontFamily: "'Segoe UI Variable Text', 'Segoe UI', sans-serif",
            fontSize: 14,
          },
        },
        legend: {
          top: 22,
          right: 22,
          itemWidth: 10,
          itemHeight: 10,
          textStyle: {
            color: "rgba(231, 240, 250, 0.82)",
            fontFamily: "'Segoe UI Variable Text', 'Segoe UI', sans-serif",
            fontSize: 13,
          },
        },
        tooltip: {
          trigger: "axis",
          backgroundColor: "rgba(8, 20, 31, 0.96)",
          borderColor: "rgba(141, 192, 255, 0.24)",
          textStyle: {
            color: "#edf4ff",
          },
          formatter: (params: unknown) => {
            const items = Array.isArray(params) ? params : [];
            const axisPoint = items[0] as
              | {
                  axisValue: number;
                }
              | undefined;

            const lines = [
              `${getParameterLabel(language, data.parameter)}: ${formatSweepParameterValue(
                axisPoint?.axisValue ?? data.range.current,
                data.parameter,
                units,
              )}`,
            ];

            items.forEach((item) => {
              const typedItem = item as {
                seriesName: string;
                color: string;
                data: [number, number | null];
              };
              lines.push(
                `${typedItem.seriesName}: ${formatSweepMetricValue(
                  typedItem.data?.[1] ?? null,
                  data.metric,
                  units,
                )}`,
              );
            });

            return lines.join("<br/>");
          },
        },
        grid: {
          left: 82,
          right: 36,
          top: 98,
          bottom: 74,
          containLabel: false,
        },
        xAxis: {
          type: "value",
          min: xViewport.min,
          max: xViewport.max,
          name: getParameterLabel(language, data.parameter),
          nameLocation: "middle",
          nameGap: 50,
          axisLine: {
            lineStyle: {
              color: "rgba(228, 238, 249, 0.72)",
            },
          },
          splitLine: {
            lineStyle: {
              color: "rgba(136, 195, 255, 0.08)",
            },
          },
          axisLabel: {
            color: "rgba(231, 240, 250, 0.78)",
            fontFamily: "'Segoe UI Variable Text', 'Segoe UI', sans-serif",
            formatter: (value: number) =>
              formatSweepParameterValue(value, data.parameter, units),
          },
          nameTextStyle: {
            color: "rgba(231, 240, 250, 0.78)",
            fontFamily: "'Segoe UI Variable Text', 'Segoe UI', sans-serif",
            fontSize: 13,
          },
        },
        yAxis: {
          type: "value",
          min: yViewport.min,
          max: yViewport.max,
          name: getMetricLabel(language, data.metric),
          nameLocation: "middle",
          nameGap: 60,
          axisLine: {
            lineStyle: {
              color: "rgba(228, 238, 249, 0.72)",
            },
          },
          splitLine: {
            lineStyle: {
              color: "rgba(136, 195, 255, 0.08)",
            },
          },
          axisLabel: {
            color: "rgba(231, 240, 250, 0.78)",
            fontFamily: "'Segoe UI Variable Text', 'Segoe UI', sans-serif",
            formatter: (value: number) =>
              formatSweepMetricValue(value, data.metric, units),
          },
          nameTextStyle: {
            color: "rgba(231, 240, 250, 0.78)",
            fontFamily: "'Segoe UI Variable Text', 'Segoe UI', sans-serif",
            fontSize: 13,
          },
        },
        series: data.series.map((series, index) => ({
          type: "line",
          name: series.label,
          data: series.points.map((point) => [point.x, point.y]),
          showSymbol: series.points.length <= 40,
          symbolSize: 6,
          connectNulls: false,
          smooth: false,
          lineStyle: {
            color: series.color,
            width: 3,
            shadowBlur: 10,
            shadowColor: series.color,
            opacity: 0.96,
          },
          itemStyle: {
            color: series.color,
            borderColor: "rgba(255,255,255,0.72)",
            borderWidth: 1,
          },
          emphasis: {
            focus: "series",
          },
          markLine:
            index === 0
              ? {
                  symbol: "none",
                  silent: true,
                  label: {
                    show: false,
                  },
                  lineStyle: {
                    color: "rgba(255, 208, 126, 0.46)",
                    type: "dashed",
                    width: 1.25,
                  },
                  data: [{ xAxis: data.range.current }],
                }
              : undefined,
        })),
      },
      true,
    );

    const observer = new ResizeObserver(() => {
      chart.resize();
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [data, fitContentHeight, language, units, xViewport.max, xViewport.min, yViewport.max, yViewport.min]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    dragState.current = {
      pointerId: event.pointerId,
      lastPoint: { x: event.clientX, y: event.clientY },
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragState.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - drag.lastPoint.x;
    const deltaY = event.clientY - drag.lastPoint.y;
    drag.lastPoint = { x: event.clientX, y: event.clientY };

    const rect = chartRef.current?.getBoundingClientRect();

    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return;
    }

    onPanBy(
      -(deltaX / rect.width) * xViewport.span,
      (deltaY / rect.height) * yViewport.span,
    );
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragState.current?.pointerId === event.pointerId) {
      dragState.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
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
    <div
      ref={chartRef}
      className="scene-chart sweep-chart"
      role="img"
      aria-label={t(language, "parameterSweepTitle")}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    />
  );
}
