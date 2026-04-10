import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Pane,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
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
  onCoordinateModeChange: (enabled: boolean) => void;
}

function createMarkerIcon(kind: "observer" | "target") {
  return L.divIcon({
    className: `route-map__marker route-map__marker--${kind}`,
    html: `<span>${kind === "observer" ? "O" : "T"}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const observerIcon = createMarkerIcon("observer");
const targetIcon = createMarkerIcon("target");

const WEB_MERCATOR_LAT_LIMIT = 85.05112878;

function clampFinite(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
}

function normalizeLongitude(lonDeg: number): number {
  if (!Number.isFinite(lonDeg)) {
    return 0;
  }

  return ((((lonDeg + 180) % 360) + 360) % 360) - 180;
}

function normalizeGeoPoint(point: { latDeg: number; lonDeg: number }) {
  return {
    latDeg: clampFinite(point.latDeg, -WEB_MERCATOR_LAT_LIMIT, WEB_MERCATOR_LAT_LIMIT, 0),
    lonDeg: normalizeLongitude(point.lonDeg),
  };
}

function MapViewportController({
  routeLatLngs,
}: {
  routeLatLngs: Array<[number, number]>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!routeLatLngs.length) {
      return;
    }

    const fitRouteToViewport = () => {
      map.invalidateSize({ animate: false, pan: false });

      const bounds = L.latLngBounds(routeLatLngs);
      if (!bounds.isValid()) {
        return;
      }

      if (routeLatLngs.length === 1) {
        map.setView(routeLatLngs[0], 6, { animate: false });
        return;
      }

      map.fitBounds(bounds.pad(0.32), {
        animate: false,
        maxZoom: 10,
        padding: [48, 48],
      });
    };

    let frameId: number | null = null;
    const delayedIds: number[] = [];

    const scheduleFit = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(fitRouteToViewport);
    };

    scheduleFit();
    delayedIds.push(window.setTimeout(scheduleFit, 120));
    delayedIds.push(window.setTimeout(scheduleFit, 420));

    const container = map.getContainer();
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => scheduleFit())
        : null;

    resizeObserver?.observe(container);
    window.addEventListener("resize", scheduleFit);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      delayedIds.forEach((id) => window.clearTimeout(id));
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleFit);
    };
  }, [map, routeLatLngs]);

  return null;
}

function MapClickPlacementController({
  activePlacement,
  onCoordinateChange,
}: {
  activePlacement: "observer" | "target";
  onCoordinateChange: RouteMapViewProps["onCoordinateChange"];
}) {
  useMapEvents({
    click(event) {
      onCoordinateChange(activePlacement, {
        latDeg: event.latlng.lat,
        lonDeg: event.latlng.lng,
      });
    },
  });

  return null;
}

function DragMarker({
  position,
  icon,
  label,
  onChange,
}: {
  position: { latDeg: number; lonDeg: number };
  icon: L.DivIcon;
  label: string;
  onChange: (coords: { latDeg: number; lonDeg: number }) => void;
}) {
  const eventHandlers = useMemo(
    () => ({
      dragend(event: L.LeafletEvent) {
        const marker = event.target as L.Marker;
        const latLng = marker.getLatLng();
        onChange({
          latDeg: latLng.lat,
          lonDeg: latLng.lng,
        });
      },
    }),
    [onChange],
  );

  return (
    <Marker
      position={[position.latDeg, position.lonDeg]}
      icon={icon}
      draggable
      eventHandlers={eventHandlers}
    >
      <Tooltip direction="top" offset={[0, -12]} opacity={0.96} permanent>
        {label}
      </Tooltip>
    </Marker>
  );
}

export function RouteMapView({
  panel,
  language,
  onCoordinateChange,
  onCoordinateModeChange,
}: RouteMapViewProps) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const [activePlacement, setActivePlacement] = useState<"observer" | "target">("target");
  const observerPoint = useMemo(
    () => normalizeGeoPoint(panel.observerPoint),
    [panel.observerPoint],
  );
  const targetPoint = useMemo(
    () => normalizeGeoPoint(panel.targetPoint),
    [panel.targetPoint],
  );
  const normalizedRoutePoints = useMemo(
    () =>
      panel.routePoints.length
        ? panel.routePoints.map(normalizeGeoPoint)
        : [observerPoint, targetPoint],
    [observerPoint, panel.routePoints, targetPoint],
  );
  const routeLatLngs = useMemo(
    () =>
      normalizedRoutePoints.map(
        (point) => [point.latDeg, point.lonDeg] as [number, number],
      ),
    [normalizedRoutePoints],
  );
  const tileEventHandlers = useMemo(
    () => ({
      tileerror() {
        setTilesFailed(true);
      },
      tileload() {
        setTilesFailed(false);
      },
    }),
    [],
  );

  return (
    <div className="route-map">
      <MapContainer
        className="route-map__map"
        center={[observerPoint.latDeg, observerPoint.lonDeg]}
        zoom={4}
        zoomControl
        scrollWheelZoom={false}
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          eventHandlers={tileEventHandlers}
        />

        <MapViewportController routeLatLngs={routeLatLngs} />
        <MapClickPlacementController
          activePlacement={activePlacement}
          onCoordinateChange={onCoordinateChange}
        />

        <Pane name="route-line" style={{ zIndex: 450 }}>
          <Polyline
            positions={routeLatLngs}
            pathOptions={{
              color: "#7dd7ff",
              weight: 5,
              opacity: 0.96,
            }}
          />
          <Polyline
            positions={routeLatLngs}
            pathOptions={{
              color: "rgba(125, 215, 255, 0.24)",
              weight: 11,
              opacity: 0.62,
            }}
          />
        </Pane>

        <DragMarker
          position={observerPoint}
          icon={observerIcon}
          label={t(language, "observerMarker")}
          onChange={(coords) => onCoordinateChange("observer", coords)}
        />
        <DragMarker
          position={targetPoint}
          icon={targetIcon}
          label={t(language, "targetMarker")}
          onChange={(coords) => onCoordinateChange("target", coords)}
        />
      </MapContainer>

      {tilesFailed ? (
        <div className="route-map__overlay route-map__tile-warning">
          Map tiles are unavailable right now. The route, bearings, and marker editing remain active.
        </div>
      ) : null}

      <div className="route-map__overlay route-map__overlay--title">
        <p className="route-map__eyebrow">{t(language, "routeMap")}</p>
        <h3>{panel.title}</h3>
        <p>{panel.subtitle}</p>
        {panel.usesPreviewSeed ? (
          <div className="route-map__status-pill">Preview route seeded from scenario distance</div>
        ) : null}
        <div className="route-map__placement">
          <span>Click map to place</span>
          <button
            className={
              activePlacement === "observer"
                ? "route-map__placement-button route-map__placement-button--active"
                : "route-map__placement-button"
            }
            type="button"
            onClick={() => setActivePlacement("observer")}
          >
            Observer
          </button>
          <button
            className={
              activePlacement === "target"
                ? "route-map__placement-button route-map__placement-button--active"
                : "route-map__placement-button"
            }
            type="button"
            onClick={() => setActivePlacement("target")}
          >
            Target
          </button>
          <button
            className={
              panel.coordinatesEnabled
                ? "route-map__placement-button route-map__placement-button--active"
                : "route-map__placement-button"
            }
            type="button"
            onClick={() => onCoordinateModeChange(!panel.coordinatesEnabled)}
          >
            {panel.coordinatesEnabled
              ? "Distance linked"
              : panel.usesPreviewSeed
                ? "Use preview route"
                : "Use route distance"}
          </button>
        </div>
      </div>

      <div className="route-map__overlay route-map__overlay--metrics">
        <div className="route-map__metric">
          <span>{t(language, "derivedDistance")}</span>
          <strong>{(panel.routeDistanceM / 1000).toFixed(1)} km</strong>
        </div>
        <div className="route-map__metric">
          <span>{t(language, "initialBearing")}</span>
          <strong>{panel.bearingDeg.toFixed(1)}°</strong>
        </div>
        <div className="route-map__metric">
          <span>{t(language, "routePointCount")}</span>
          <strong>{panel.routePoints.length}</strong>
        </div>
      </div>

      <div className="route-map__overlay route-map__overlay--hint">
        Drag the observer and target markers to update the route geometry.
      </div>
    </div>
  );
}
