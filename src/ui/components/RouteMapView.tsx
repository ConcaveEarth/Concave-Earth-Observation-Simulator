import { useEffect, useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Pane,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
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

function MapViewportController({
  routePoints,
}: {
  routePoints: RouteMapPanelData["routePoints"];
}) {
  const map = useMap();

  useEffect(() => {
    if (!routePoints.length) {
      return;
    }

    const bounds = L.latLngBounds(
      routePoints.map((point) => [point.latDeg, point.lonDeg] as [number, number]),
    );

    map.invalidateSize();
    map.fitBounds(bounds.pad(0.32), {
      animate: false,
      padding: [36, 36],
    });
  }, [map, routePoints]);

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
}: RouteMapViewProps) {
  const routeLatLngs = useMemo(
    () => panel.routePoints.map((point) => [point.latDeg, point.lonDeg] as [number, number]),
    [panel.routePoints],
  );

  return (
    <div className="route-map">
      <MapContainer
        className="route-map__map"
        center={[panel.observerPoint.latDeg, panel.observerPoint.lonDeg]}
        zoom={4}
        zoomControl
        scrollWheelZoom={false}
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <MapViewportController routePoints={panel.routePoints} />

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
          position={panel.observerPoint}
          icon={observerIcon}
          label={t(language, "observerMarker")}
          onChange={(coords) => onCoordinateChange("observer", coords)}
        />
        <DragMarker
          position={panel.targetPoint}
          icon={targetIcon}
          label={t(language, "targetMarker")}
          onChange={(coords) => onCoordinateChange("target", coords)}
        />
      </MapContainer>

      <div className="route-map__overlay route-map__overlay--title">
        <p className="route-map__eyebrow">{t(language, "routeMap")}</p>
        <h3>{panel.title}</h3>
        <p>{panel.subtitle}</p>
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
