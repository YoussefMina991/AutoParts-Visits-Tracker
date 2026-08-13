/**
 * OPENSTREETMAP LEAFLET INTEGRATION
 *
 * Drop-in replacement for the Google Maps component.
 * Uses react-leaflet + OpenStreetMap tiles (100% free, no API key needed).
 *
 * USAGE:
 * ======
 * Basic map:
 * <MapView
 *   initialCenter={{ lat: 30.0444, lng: 31.2357 }}
 *   initialZoom={12}
 *   className="h-[500px]"
 * >
 *   {children}  ← place Markers / Circles here
 * </MapView>
 *
 * With a marker:
 * import { MapMarker } from "@/components/Map";
 * <MapView ...>
 *   <MapMarker lat={30.0444} lng={31.2357} label="الفرع الرئيسي" color="#00d4ff" />
 * </MapView>
 *
 * With a geofence circle:
 * import { GeofenceCircle } from "@/components/Map";
 * <MapView ...>
 *   <GeofenceCircle lat={30.0444} lng={31.2357} radiusMeters={200} />
 * </MapView>
 */

import { useEffect, useRef, ReactNode } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import { cn } from "@/lib/utils";

// ─── Fix leaflet default marker icons (needed in Vite/webpack) ──────────────
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// ─── Types ───────────────────────────────────────────────────────────────────
export interface MapCenter {
  lat: number;
  lng: number;
}

// ─── FlyTo helper (allows parent to imperatively move the map) ───────────────
function FlyController({ center, zoom }: { center: MapCenter | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo([center.lat, center.lng], zoom ?? map.getZoom(), { duration: 0.8 });
    }
  }, [center, zoom, map]);
  return null;
}

// ─── Main MapView ─────────────────────────────────────────────────────────────
interface MapViewProps {
  className?: string;
  initialCenter?: MapCenter;
  initialZoom?: number;
  flyTo?: MapCenter | null;
  flyToZoom?: number;
  children?: ReactNode;
}

export function MapView({
  className,
  initialCenter = { lat: 30.0444, lng: 31.2357 }, // Cairo default
  initialZoom = 12,
  flyTo = null,
  flyToZoom,
  children,
}: MapViewProps) {
  return (
    <MapContainer
      center={[initialCenter.lat, initialCenter.lng]}
      zoom={initialZoom}
      className={cn("w-full h-[500px]", className)}
      style={{ background: "#0e1417" }}
      zoomControl={true}
      attributionControl={false}
    >
      {/* OpenStreetMap dark-style tiles (Carto Dark Matter — free) */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      {/* Small attribution */}
      <div
        className="leaflet-control leaflet-bottom leaflet-right"
        style={{ pointerEvents: "none" }}
      >
        <span style={{ fontSize: "9px", color: "#4a5568", padding: "2px 4px" }}>
          © OpenStreetMap © CARTO
        </span>
      </div>

      {flyTo && <FlyController center={flyTo} zoom={flyToZoom} />}
      {children}
    </MapContainer>
  );
}

// ─── Marker Component ─────────────────────────────────────────────────────────
interface MapMarkerProps {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  popupContent?: string;
  onClick?: () => void;
}

export function MapMarker({
  lat,
  lng,
  label,
  color = "#00d4ff",
  popupContent,
  onClick,
}: MapMarkerProps) {
  const customIcon = L.divIcon({
    className: "",
    html: `
      <div style="
        display:flex;align-items:center;gap:6px;
        background:rgba(14,20,33,0.92);
        border:1.5px solid ${color};
        border-radius:10px;
        padding:5px 10px;
        font-size:12px;
        font-weight:700;
        color:${color};
        white-space:nowrap;
        box-shadow:0 4px 16px ${color}44;
        font-family:'Cairo',sans-serif;
        direction:rtl;
        cursor:pointer;
      ">
        <span style="font-size:15px;">📍</span>
        ${label ?? ""}
      </div>
    `,
    iconAnchor: [16, 32],
  });

  return (
    <Marker
      position={[lat, lng]}
      icon={label ? customIcon : new L.Icon.Default()}
      eventHandlers={{ click: onClick ? onClick : () => {} }}
    >
      {popupContent && (
        <Popup>
          <span style={{ fontFamily: "'Cairo', sans-serif", color: "#e2e8f0" }}>
            {popupContent}
          </span>
        </Popup>
      )}
    </Marker>
  );
}

// ─── Geofence Circle ──────────────────────────────────────────────────────────
interface GeofenceCircleProps {
  lat: number;
  lng: number;
  radiusMeters?: number;
  color?: string;
  inRange?: boolean;
}

export function GeofenceCircle({
  lat,
  lng,
  radiusMeters = 200,
  color = "#00d4ff",
  inRange = false,
}: GeofenceCircleProps) {
  return (
    <>
      {/* Outer glow */}
      <Circle
        center={[lat, lng]}
        radius={radiusMeters}
        pathOptions={{
          color: inRange ? "#34d399" : color,
          fillColor: inRange ? "#34d399" : color,
          fillOpacity: 0.06,
          weight: 1.5,
          dashArray: "6 4",
        }}
      />
      {/* Inner solid dot */}
      <Circle
        center={[lat, lng]}
        radius={8}
        pathOptions={{
          color: inRange ? "#34d399" : color,
          fillColor: inRange ? "#34d399" : color,
          fillOpacity: 1,
          weight: 0,
        }}
      />
    </>
  );
}

// ─── Route Polyline (With Start/End points) ──────────────────────────────────
interface MapPolylineProps {
  positions: [number, number][];
  color?: string;
  weight?: number;
}

export function MapPolyline({ positions, color = "#34d399", weight = 4 }: MapPolylineProps) {
  if (!positions || positions.length === 0) return null;

  const startPoint = positions[0];
  const endPoint = positions[positions.length - 1];
  
  // Custom tiny markers for start and end
  const createSmallMarker = (bgColor: string, text: string) => L.divIcon({
    className: "",
    html: `
      <div style="
        width:24px;height:24px;
        background:${bgColor};
        border:2px solid #fff;
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        color:#fff;
        font-size:10px;
        font-weight:bold;
        box-shadow:0 2px 4px rgba(0,0,0,0.3);
      ">
        ${text}
      </div>
    `,
    iconAnchor: [12, 12],
  });

  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{
          color: color,
          weight: weight,
          opacity: 0.8,
          lineJoin: "round",
          lineCap: "round",
          dashArray: "1 8", // Adds a slight dashed/dotted effect if wanted, but plain solid is better for route, let's keep it solid
        }}
        // Override pathOptions for solid line
        dashArray=""
      />
      {positions.length > 0 && (
        <Marker position={startPoint} icon={createSmallMarker("#10b981", "B")} /> // B for Begin/البداية
      )}
      {positions.length > 1 && (
        <Marker position={endPoint} icon={createSmallMarker("#ef4444", "E")} /> // E for End/النهاية
      )}
    </>
  );
}
