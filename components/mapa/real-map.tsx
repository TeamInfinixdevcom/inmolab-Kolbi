
"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
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

      {/* Propiedades existentes: se conservan sin cambios */}
      {markers.map((marker) => (
        <CircleMarker
          key={marker.id}
          center={[marker.latitude, marker.longitude]}
          radius={9}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: "#2563eb",
            fillOpacity: 1,
          }}
        >
          <Popup>
            <strong>{marker.title}</strong>
            <br />
            {marker.detail}
          </Popup>
        </CircleMarker>
      ))}

      {/* Punto temporal seleccionado por el usuario */}
      {selectedPosition && (
        <CircleMarker
          key={`${selectedPosition.latitude},${selectedPosition.longitude}`}
          center={[
            selectedPosition.latitude,
            selectedPosition.longitude,
          ]}
          radius={10}
          pathOptions={{
            color: "#ffffff",
            weight: 3,
            fillColor: "#16a34a",
            fillOpacity: 1,
          }}
        >
          <Popup>
            <strong>Ubicación seleccionada</strong>
            <br />
            Latitud: {selectedPosition.latitude}
            <br />
            Longitud: {selectedPosition.longitude}
          </Popup>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
