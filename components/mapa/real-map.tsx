"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { LatLngExpression } from "leaflet";
import { getAvatarById, getOptimizedAvatarSrc, isAvatarId } from "@/lib/avatar-catalog";

export type MapMarker = {
  id: string;
  title: string;
  detail: string;
  latitude: number;
  longitude: number;
  inmobiliarioId?: string;
  inmobiliarioName?: string;
  avatarId?: string;
};

export type MapPosition = {
  latitude: number;
  longitude: number;
};

type RealMapProps = {
  markers: MapMarker[];
  selectedPosition?: MapPosition | null;
  focusPosition?: MapPosition | null;
  onMapClick?: (position: MapPosition) => void;
};

const costaRicaCenter: LatLngExpression = [9.7489, -83.7534];

function pinElement(color: string, emoji: string, avatarSrc?: string) {
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "relative",
    width: "44px",
    height: "54px",
    filter: "drop-shadow(0 3px 3px rgba(0,0,0,.30))",
  });
  container.setAttribute("aria-hidden", "true");

  const body = document.createElement("div");
  Object.assign(body.style, {
    position: "absolute",
    left: "5px",
    top: "2px",
    width: "34px",
    height: "34px",
    background: color,
    border: "2px solid white",
    borderRadius: "50% 50% 50% 0",
    transform: "rotate(-45deg)",
    boxShadow: "inset -2px -2px 4px rgba(0,0,0,.15)",
  });

  const label = document.createElement("span");
  Object.assign(label.style, {
    position: "absolute",
    left: "10px",
    top: "7px",
    width: "24px",
    height: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "17px",
    lineHeight: "1",
    background: "white",
    borderRadius: "50%",
  });
  label.textContent = emoji;

  if (avatarSrc) {
    const image = document.createElement("img");
    image.src = avatarSrc;
    image.alt = "";
    image.width = 24;
    image.height = 24;
    image.decoding = "async";
    image.loading = "lazy";
    Object.assign(image.style, {
      position: "absolute",
      left: "10px",
      top: "7px",
      width: "24px",
      height: "24px",
      objectFit: "cover",
      border: "2px solid white",
      borderRadius: "50%",
    });
    image.addEventListener("error", () => image.remove(), { once: true });
    container.append(body, label, image);
  } else {
    container.append(body, label);
  }

  const shadow = document.createElement("div");
  Object.assign(shadow.style, {
    position: "absolute",
    bottom: "0",
    left: "19px",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "rgba(0,0,0,.20)",
    filter: "blur(2px)",
  });
  container.append(shadow);
  return container;
}

function createPinIcon(emoji: string, color: string) {
  return L.divIcon({
    className: "inmolab-pin-container",
    html: pinElement(color, emoji),
    iconSize: [44, 54],
    iconAnchor: [22, 48],
    popupAnchor: [0, -45],
  });
}

function createAvatarPin(avatarId: string) {
  const avatar = getAvatarById(avatarId);
  const avatarSrc = getOptimizedAvatarSrc(avatarId, 64);
  if (!avatar || !avatarSrc) return createPinIcon("🏠", "#00843d");

  return L.divIcon({
    className: "inmolab-avatar-pin",
    html: pinElement("#00843d", "🏠", avatarSrc),
    iconSize: [44, 54],
    iconAnchor: [22, 48],
    popupAnchor: [0, -45],
  });
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick?: (position: MapPosition) => void;
}) {
  useMapEvents({
    click(event) {
      onMapClick?.({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  return null;
}

function MapPositionController({
  position,
}: {
  position?: MapPosition | null;
}) {
  const map = useMap();
  const latitude = position?.latitude;
  const longitude = position?.longitude;

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;

    map.flyTo(
      [latitude, longitude],
      16,
      { duration: 0.8 },
    );
  }, [latitude, longitude, map]);

  return null;
}

export function RealMap({
  markers,
  selectedPosition,
  focusPosition,
  onMapClick,
}: Readonly<RealMapProps>) {
  const propertyPin = useMemo(() => createPinIcon("🏠", "#00843d"), []);
  const selectedPin = useMemo(() => createPinIcon("📌", "#16a34a"), []);
  const avatarPins = useMemo(() => {
    const pins: Record<string, L.DivIcon> = {};
    for (const marker of markers) {
      if (isAvatarId(marker.avatarId)) {
        pins[marker.id] = createAvatarPin(marker.avatarId);
      }
    }
    return pins;
  }, [markers]);

  return (
    <MapContainer
      center={costaRicaCenter}
      zoom={8}
      scrollWheelZoom
      className="h-full min-h-[430px] w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapClickHandler onMapClick={onMapClick} />
      <MapPositionController position={focusPosition ?? selectedPosition} />

      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.latitude, marker.longitude]}
          icon={avatarPins[marker.id] ?? propertyPin}
        >
          <Popup>
            <strong>{marker.title}</strong>
            <br />
            {marker.detail}
          </Popup>
        </Marker>
      ))}

      {/* Ubicación seleccionada: pin verde */}
      {selectedPosition && (
        <Marker
          key={`${selectedPosition.latitude},${selectedPosition.longitude}`}
          position={[
            selectedPosition.latitude,
            selectedPosition.longitude,
          ]}
          icon={selectedPin}
        >
          <Popup>
            <strong>Ubicación seleccionada</strong>
            <br />
            Latitud: {selectedPosition.latitude.toFixed(6)}
            <br />
            Longitud: {selectedPosition.longitude.toFixed(6)}
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}





