import { tickStep } from "d3-array";
import { scaleLinear } from "d3-scale";
import type { RefObject } from "react";

export interface ViewBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ViewPoint {
  x: number;
  y: number;
}

export interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PanelRectConfig {
  isCompare: boolean;
  isStacked: boolean;
  singleWidth: number;
  compareWidth: number;
  stackedWidth: number;
  singleHeight: number;
  stackedHeight: number;
}

interface ProjectorPadding {
  paddingX: [number, number];
  paddingTop: [number, number];
  paddingBottom: [number, number];
}

interface ProjectorOptions {
  zoom: number;
  verticalZoom: number;
  panX: number;
  panY: number;
  padding: ProjectorPadding;
}

export function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function createPanelRects({
  isCompare,
  isStacked,
  singleWidth,
  compareWidth,
  stackedWidth,
  singleHeight,
  stackedHeight,
}: PanelRectConfig): { svgWidth: number; svgHeight: number; panelRects: PanelRect[] } {
  const svgWidth = isCompare
    ? isStacked
      ? stackedWidth
      : compareWidth
    : singleWidth;
  const svgHeight = isStacked ? stackedHeight : singleHeight;
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

  return { svgWidth, svgHeight, panelRects };
}

export function getSvgPoint(
  svgRef: RefObject<SVGSVGElement | null>,
  svgWidth: number,
  svgHeight: number,
  event: { clientX: number; clientY: number },
) {
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

export function findPanelIndex(point: ViewPoint | null, panelRects: PanelRect[]) {
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

export function createLinearProjector(
  panel: PanelRect,
  bounds: ViewBounds,
  options: ProjectorOptions,
) {
  const paddingX = clampValue(panel.width * 0.024, options.padding.paddingX[0], options.padding.paddingX[1]);
  const paddingTop = clampValue(panel.height * 0.11, options.padding.paddingTop[0], options.padding.paddingTop[1]);
  const paddingBottom = clampValue(
    panel.height * 0.16,
    options.padding.paddingBottom[0],
    options.padding.paddingBottom[1],
  );

  const rangeX: [number, number] = [
    panel.x + paddingX,
    panel.x + panel.width - paddingX,
  ];
  const rangeY: [number, number] = [
    panel.y + panel.height - paddingBottom,
    panel.y + paddingTop,
  ];

  const spanX = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1e-6);
  const centerX = (bounds.minX + bounds.maxX) / 2 + options.panX;
  const centerY = (bounds.minY + bounds.maxY) / 2 + options.panY;
  const visibleSpanX = spanX / Math.max(options.zoom, 0.1);
  const visibleSpanY = spanY / Math.max(options.verticalZoom, 0.1);
  const domainX: [number, number] = [
    centerX - visibleSpanX / 2,
    centerX + visibleSpanX / 2,
  ];
  const domainY: [number, number] = [
    centerY - visibleSpanY / 2,
    centerY + visibleSpanY / 2,
  ];

  const x = scaleLinear().domain(domainX).range(rangeX);
  const y = scaleLinear().domain(domainY).range(rangeY);

  return {
    xScale: Math.abs((rangeX[1] - rangeX[0]) / Math.max(visibleSpanX, 1e-6)),
    yScale: Math.abs((rangeY[1] - rangeY[0]) / Math.max(visibleSpanY, 1e-6)),
    project: (point: ViewPoint) => ({
      x: x(point.x),
      y: y(point.y),
    }),
  };
}

export function niceStep(value: number, targetTicks = 4) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  const step = tickStep(0, value, targetTicks);
  return step > 0 ? step : 1;
}
