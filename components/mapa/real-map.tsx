"use client";

import { useEffect } from "react";
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
import { HAIR_COLORS, SHIRT_COLORS, SKIN_TONES, defaultMiiAppearance } from "@/components/avatar/mii-avatar";

export type MapMarker = {
  id: string;
  title: string;
  detail: string;
  latitude: number;
  longitude: number;
  inmobiliarioId?: string;
  inmobiliarioName?: string;
  avatarConfig?: { skinTone: number; hairColor: number; shirtColor: number; hairStyle?: number };
};

export type MapPosition = {
  latitude: number;
  longitude: number;
};

type RealMapProps = {
  markers: MapMarker[];
  selectedPosition?: MapPosition | null;
  onMapClick?: (position: MapPosition) => void;
};

const costaRicaCenter: LatLngExpression = [9.7489, -83.7534];

function createPinIcon(emoji: string, color: string) {
  return L.divIcon({
    className: "inmolab-pin-container",
    html: `
      <div style="
        position: relative;
        width: 44px;
        height: 54px;
        filter: drop-shadow(0 3px 3px rgba(0,0,0,.30));
      ">
        <div style="
          position: absolute;
          left: 5px;
          top: 2px;
          width: 34px;
          height: 34px;
          background: ${color};
          border: 2px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: inset -2px -2px 4px rgba(0,0,0,.15);
        "></div>
        <span style="
          position: absolute;
          left: 10px;
          top: 7px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          line-height: 1;
          background: white;
          border-radius: 50%;
        ">${emoji}</span>
        <div style="
          position: absolute;
          bottom: 0;
          left: 19px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(0,0,0,.20);
          filter: blur(2px);
        "></div>
      </div>
    `,
    iconSize: [44, 54],
    iconAnchor: [22, 48],
    popupAnchor: [0, -45],
  });
}

function createMiiPin(appearance?: { skinTone: number; hairColor: number; shirtColor: number; hairStyle?: number }) {
  const defaults = defaultMiiAppearance(1);
  const skin = SKIN_TONES[appearance?.skinTone ?? defaults.skinTone]?.value ?? SKIN_TONES[defaults.skinTone].value;
  const hair = HAIR_COLORS[appearance?.hairColor ?? defaults.hairColor]?.value ?? HAIR_COLORS[defaults.hairColor].value;
  const shirt = SHIRT_COLORS[appearance?.shirtColor ?? defaults.shirtColor]?.value ?? SHIRT_COLORS[defaults.shirtColor].value;
  const hairStyle = appearance?.hairStyle ?? defaults.hairStyle;

  const hairPath =
    hairStyle === 1
      ? `<path d="M24 40 L17 15 L35 22 L37 3 L49 17 L59 2 L65 19 L80 10 L78 30 L76 43 L70 30 Q52 18 31 37 L29 50Z" fill="${hair}"/>`
      : hairStyle === 2
        ? `<path d="M24 40 Q13 8 43 5 Q70 -2 79 20 Q84 31 76 43 L77 78 Q70 88 67 65 L70 30 Q52 18 31 37 L30 66 Q25 83 22 64Z" fill="${hair}"/>`
        : `<path d="M24 40 Q13 8 43 5 Q70 -2 79 20 Q84 31 76 43 L70 30 Q52 18 31 37 L29 50Z" fill="${hair}"/>`;

  return L.divIcon({
    className: "inmolab-mii-pin",
    html: `
      <div style="width:48px;height:56px;position:relative;filter:drop-shadow(0 3px 3px rgba(0,0,0,.3))">
        <div style="position:absolute;left:4px;top:2px;width:40px;height:40px;background:#2563eb;border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg)"></div>
        <svg viewBox="0 0 100 110" width="34" height="38" style="position:absolute;left:7px;top:3px" aria-hidden="true">
          <path d="M18 106 Q20 76 36 74 L64 74 Q80 76 82 106Z" fill="${shirt}"/>
          <rect x="43" y="65" width="14" height="15" rx="5" fill="${skin}"/>
          <path d="M25 36 Q25 10 50 10 Q75 10 75 36 L70 60 Q64 72 50 73 Q36 72 30 60Z" fill="${skin}"/>
          ${hairPath}
          <ellipse cx="39" cy="43" rx="7" ry="8" fill="white"/><ellipse cx="61" cy="43" rx="7" ry="8" fill="white"/>
          <circle cx="40" cy="44" r="3.5" fill="#49352d"/><circle cx="60" cy="44" r="3.5" fill="#49352d"/>
          <path d="M41 57 Q50 64 59 57" fill="none" stroke="#8d3f36" stroke-width="3" stroke-linecap="round"/>
        </svg>
        <div style="position:absolute;bottom:0;left:21px;width:6px;height:6px;border-radius:50%;background:rgba(0,0,0,.2);filter:blur(2px)"></div>
      </div>
    `,
    iconSize: [48, 56],
    iconAnchor: [24, 50],
    popupAnchor: [0, -47],
  });
}

const propertyPin = createPinIcon("🏠", "#2563eb");
const referencePin = createPinIcon("📍", "#7c3aed");
const selectedPin = createPinIcon("📌", "#16a34a");

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

  useEffect(() => {
    if (!position) return;

    map.flyTo(
      [position.latitude, position.longitude],
      16,
      { duration: 0.8 },
    );
  }, [map, position?.latitude, position?.longitude]);

  return null;
}

export function RealMap({
  markers,
  selectedPosition,
  onMapClick,
}: Readonly<RealMapProps>) {
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
      <MapPositionController position={selectedPosition} />

      {/* Propiedades: pin azul con casa */}
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.latitude, marker.longitude]}
          icon={marker.avatarConfig ? createMiiPin(marker.avatarConfig) : propertyPin}
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





