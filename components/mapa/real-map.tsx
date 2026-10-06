"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

export type MapMarker = {
  id: string;
  title: string;
  detail: string;
  latitude: number;
  longitude: number;
};

const costaRicaCenter: LatLngExpression = [9.7489, -83.7534];

export function RealMap({ markers }: Readonly<{ markers: MapMarker[] }>) {
  return (
    <MapContainer center={costaRicaCenter} zoom={8} scrollWheelZoom className="h-full min-h-[430px] w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((marker) => (
        <CircleMarker
          key={marker.id}
          center={[marker.latitude, marker.longitude]}
          radius={9}
          pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}
        >
          <Popup>
            <strong>{marker.title}</strong>
            <br />
            {marker.detail}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}