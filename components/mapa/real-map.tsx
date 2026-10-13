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

export type MapMarker = {
  id: string;
  title: string;
  detail: string;
  latitude: number;
  longitude: number;
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
          icon={propertyPin}
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
