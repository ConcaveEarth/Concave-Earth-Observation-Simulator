import { useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { RouteMapPanelData } from "../../domain/analysis";
import type { LanguageMode } from "../../i18n";
import { t } from "../../i18n";

interface RouteMapViewProps {
  panel: RouteMapPanelData;
  language: LanguageMode;
  onCoordinateChange: (
    point: "observer" | "target",
    coords: { latDeg: number; lonDeg: number },
  ) => void;
}

const SVG_WIDTH = 2048;
const SVG_HEIGHT = 900;
const MAP_X = 84;
const MAP_Y = 108;
const MAP_WIDTH = SVG_WIDTH - 168;
const MAP_HEIGHT = SVG_HEIGHT - 188;

const LANDMASSES: Array<Array<{ lon: number; lat: number }>> = [
  [
    { lon: -168, lat: 12 },
    { lon: -154, lat: 55 },
    { lon: -126, lat: 72 },
    { lon: -98, lat: 68 },
    { lon: -88, lat: 48 },
    { lon: -104, lat: 18 },
    { lon: -142, lat: 8 },
  ],
  [
    { lon: -82, lat: 12 },
    { lon: -76, lat: -6 },
    { lon: -68, lat: -20 },
    { lon: -60, lat: -40 },
    { lon: -54, lat: -54 },
    { lon: -42, lat: -28 },
    { lon: -46, lat: 2 },
    { lon: -58, lat: 12 },
  ],
  [
    { lon: -12, lat: 34 },
    { lon: 18, lat: 60 },
    { lon: 80, lat: 72 },
    { lon: 136, lat: 56 },
    { lon: 148, lat: 28 },
    { lon: 124, lat: 6 },
    { lon: 84, lat: 18 },
    { lon: 60, lat: 10 },
    { lon: 24, lat: 6 },
    { lon: 2, lat: 20 },
  ],
  [
    { lon: -20, lat: 34 },
    { lon: 10, lat: 34 },
    { lon: 30, lat: 18 },
    { lon: 36, lat: -4 },
    { lon: 28, lat: -34 },
    { lon: 10, lat: -36 },
    { lon: -6, lat: -8 },
  ],
  [
    { lon: 112, lat: -10 },
    { lon: 154, lat: -14 },
    { lon: 154, lat: -42 },
    { lon: 118, lat: -44 },
  ],
];

function projectLonLat(lonDeg: number, latDeg: number) {
  return {
    x: MAP_X + ((lonDeg + 180) / 360) * MAP_WIDTH,
    y: MAP_Y + ((90 - latDeg) / 180) * MAP_HEIGHT,
  };
}

function unprojectPoint(point: { x: number; y: number }) {
  const lonDeg = ((point.x - MAP_X) / MAP_WIDTH) * 360 - 180;
  const latDeg = 90 - ((point.y - MAP_Y) / MAP_HEIGHT) * 180;
  return {
    lonDeg: Math.max(-180, Math.min(180, lonDeg)),
    latDeg: Math.max(-90, Math.min(90, latDeg)),
  };
}

function polygonPoints(points: Array<{ lon: number; lat: number }>) {
  return points
    .map((point) => {
      const projected = projectLonLat(point.lon, point.lat);
      return `${projected.x},${projected.y}`;
    })
    .join(" ");
}

function polylinePoints(points: Array<{ lonDeg: number; latDeg: number }>) {
  return points
    .map((point) => {
      const projected = projectLonLat(point.lonDeg, point.latDeg);
      return `${projected.x},${projected.y}`;
    })
    .join(" ");
}

export function RouteMapView({
  panel,
  language,
  onCoordinateChange,
}: RouteMapViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    point: "observer" | "target";
  } | null>(null);

  const routeMidpoint = useMemo(() => {
    const middle = panel.routePoints[Math.floor(panel.routePoints.length / 2)] ?? panel.routePoints[0];
    return middle ? projectLonLat(middle.lonDeg, middle.latDeg) : { x: MAP_X + MAP_WIDTH / 2, y: MAP_Y + MAP_HEIGHT / 2 };
  }, [panel.routePoints]);

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

  function handlePointerDown(
    event: ReactPointerEvent<SVGCircleElement>,
    point: "observer" | "target",
  ) {
    dragRef.current = {
      pointerId: event.pointerId,
      point,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const dragState = dragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const point = getSvgPoint(event);

    if (!point) {
      return;
    }

    const next = unprojectPoint(point);
    onCoordinateChange(dragState.point, next);
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }

  const observer = projectLonLat(panel.observerPoint.lonDeg, panel.observerPoint.latDeg);
  const target = projectLonLat(panel.targetPoint.lonDeg, panel.targetPoint.latDeg);

  return (
    <svg
      ref={svgRef}
      className="scene-svg"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={t(language, "routeMap")}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <defs>
        <linearGradient id="routeMapBackdrop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#081521" />
          <stop offset="100%" stopColor="#0f2437" />
        </linearGradient>
        <linearGradient id="routeOcean" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(71, 127, 190, 0.22)" />
          <stop offset="100%" stopColor="rgba(14, 41, 66, 0.88)" />
        </linearGradient>
      </defs>

      <rect width={SVG_WIDTH} height={SVG_HEIGHT} rx={28} fill="url(#routeMapBackdrop)" />
      <rect
        x={MAP_X}
        y={MAP_Y}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        rx={30}
        fill="url(#routeOcean)"
        stroke="rgba(141, 192, 255, 0.2)"
      />

      {[-120, -60, 0, 60, 120].map((lon) => {
        const start = projectLonLat(lon, -80);
        const end = projectLonLat(lon, 80);
        return (
          <line
            key={`lon-${lon}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="rgba(136, 195, 255, 0.08)"
            strokeWidth={1}
          />
        );
      })}
      {[-60, -30, 0, 30, 60].map((lat) => {
        const start = projectLonLat(-180, lat);
        const end = projectLonLat(180, lat);
        return (
          <line
            key={`lat-${lat}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="rgba(136, 195, 255, 0.08)"
            strokeWidth={1}
          />
        );
      })}

      {LANDMASSES.map((polygon, index) => (
        <polygon
          key={`land-${index}`}
          points={polygonPoints(polygon)}
          fill="rgba(216, 198, 144, 0.2)"
          stroke="rgba(246, 226, 173, 0.18)"
          strokeWidth={1.2}
        />
      ))}

      <polyline
        points={polylinePoints(panel.routePoints)}
        fill="none"
        stroke="rgba(125, 215, 255, 0.96)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="drop-shadow(0 0 10px rgba(125, 215, 255, 0.35))"
      />

      <circle
        cx={observer.x}
        cy={observer.y}
        r={11}
        fill="#ffd07e"
        stroke="rgba(255,255,255,0.84)"
        strokeWidth={2}
        onPointerDown={(event) => handlePointerDown(event, "observer")}
      />
      <circle
        cx={target.x}
        cy={target.y}
        r={11}
        fill="#7dd7ff"
        stroke="rgba(255,255,255,0.84)"
        strokeWidth={2}
        onPointerDown={(event) => handlePointerDown(event, "target")}
      />

      <text x={observer.x + 16} y={observer.y - 10} fill="#f6f0df" fontSize={16}>
        {t(language, "observerMarker")}
      </text>
      <text x={target.x + 16} y={target.y - 10} fill="#e7f5ff" fontSize={16}>
        {t(language, "targetMarker")}
      </text>

      <text x={90} y={54} fill="#f5f2e8" fontSize={24} fontWeight="600">
        {panel.title}
      </text>
      <text x={90} y={82} fill="rgba(219, 237, 255, 0.72)" fontSize={14}>
        {panel.subtitle}
      </text>

      <g transform={`translate(${routeMidpoint.x}, ${MAP_Y + 44})`}>
        <rect
          x={-120}
          y={-26}
          width={240}
          height={60}
          rx={16}
          fill="rgba(7, 20, 32, 0.84)"
          stroke="rgba(141, 192, 255, 0.18)"
        />
        <text x={0} y={-2} textAnchor="middle" fill="#f6f0df" fontSize={14}>
          {`${t(language, "derivedDistance")}: ${(panel.routeDistanceM / 1000).toFixed(1)} km`}
        </text>
        <text x={0} y={18} textAnchor="middle" fill="rgba(223, 239, 255, 0.78)" fontSize={13}>
          {`${t(language, "initialBearing")}: ${panel.bearingDeg.toFixed(1)}°`}
        </text>
      </g>
    </svg>
  );
}
