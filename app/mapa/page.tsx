"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarImage } from "@/components/avatar/avatar-image";
import type { MapMarker, MapPosition } from "@/components/mapa/real-map";
import { db } from "@/lib/firebase";
import { DEFAULT_AVATAR_ID, isAvatarId } from "@/lib/avatar-catalog";

const RealMap = dynamic(
  () => import("@/components/mapa/real-map").then((module) => module.RealMap),
  { ssr: false },
);

type Property = MapMarker & {
  status: string;
  inmobiliarioId: string;
  inmobiliarioName: string;
};

function coordinate(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function MapaPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [inmobiliarioAvatars, setInmobiliarioAvatars] = useState<Record<string, string | undefined>>({});
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [focusedPosition, setFocusedPosition] = useState<MapPosition | null>(null);
  const [loading, setLoading] = useState(Boolean(db));
  const [error, setError] = useState(db ? "" : "Firebase no está configurado.");

  useEffect(() => {
    if (!db) return;

    const unsubscribeInmobiliarios = onSnapshot(
      collection(db, "inmobiliarios"),
      (snapshot) => {
        const avatars: Record<string, string | undefined> = {};

        snapshot.docs.forEach((item) => {
          const storedAvatarId = item.data().avatarId;
          avatars[item.id] = storedAvatarId === undefined || storedAvatarId === null
            ? DEFAULT_AVATAR_ID
            : isAvatarId(storedAvatarId) ? storedAvatarId : undefined;
        });

        setInmobiliarioAvatars(avatars);
      },
      (loadError) => {
        console.error("Error cargando avatares de inmobiliarios:", loadError);
      },
    );

    const unsubscribeProperties = onSnapshot(
      collection(db, "propiedades"),
      (snapshot) => {
        const loaded = snapshot.docs.flatMap((item) => {
          const data = item.data();
          const latitude = coordinate(data.latitude ?? data.lat);
          const longitude = coordinate(data.longitude ?? data.lng);

          if (
            latitude === undefined || longitude === undefined ||
            latitude < -90 || latitude > 90 ||
            longitude < -180 || longitude > 180
          ) return [];

          const detail = [data.district, data.canton, data.province]
            .map((part) => String(part ?? "").trim())
            .filter(Boolean)
            .join(", ") || String(data.address ?? data.city ?? "Costa Rica");

          return [{
            id: item.id,
            title: String(data.condominiumName ?? data.title ?? "Propiedad"),
            detail,
            latitude,
            longitude,
            status: String(data.status ?? "Activa"),
            inmobiliarioId: String(data.inmobiliarioId ?? data.createdById ?? data.createdBy ?? ""),
            inmobiliarioName: String(data.inmobiliarioName ?? data.createdByName ?? ""),
          }];
        });
        setProperties(loaded);
        setLoading(false);
      },
      (loadError) => {
        console.error("Error cargando propiedades:", loadError);
        setError("No se pudieron cargar las propiedades. Revisa Firestore.");
        setLoading(false);
      },
    );

    return () => {
      unsubscribeProperties();
      unsubscribeInmobiliarios();
    };
  }, []);

  const markers = useMemo(
    () => properties.map((property) => ({
      ...property,
      avatarId: property.inmobiliarioId
        ? inmobiliarioAvatars[property.inmobiliarioId]
        : undefined,
    })),
    [properties, inmobiliarioAvatars],
  );
  const selectedProperty = properties.find((property) => property.id === selectedPropertyId) ?? properties[0] ?? null;
  const selectedAvatarId = selectedProperty?.inmobiliarioId
    ? inmobiliarioAvatars[selectedProperty.inmobiliarioId] ?? DEFAULT_AVATAR_ID
    : DEFAULT_AVATAR_ID;

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Ubicaciones de propiedades</p>
        <h1 className="mt-2 text-3xl font-bold">Mapa de Costa Rica</h1>
        <p className="mt-2 text-muted-foreground">
          El mapa muestra las propiedades que tienen una ubicación guardada en su registro.
        </p>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader>
            <CardTitle>Propiedades ubicadas ({properties.length})</CardTitle>
          </CardHeader>
          <CardContent className="h-[620px] p-0">
            <RealMap markers={markers} focusPosition={focusedPosition} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Propiedad seleccionada</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Cargando propiedades...</p>
            ) : properties.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Aún no hay propiedades con coordenadas. Asigná la ubicación al crear o editar una propiedad.
              </p>
            ) : (
              <>
                {selectedProperty && <div className="mb-4 flex items-center gap-4 rounded-xl border border-[#d9e6dc] bg-[#f5f7ef] p-4">
                  <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-md ring-2 ring-[#d7c89f]">
                    <AvatarImage
                      avatarId={selectedAvatarId}
                      size={96}
                      alt={`Avatar de ${selectedProperty.inmobiliarioName || "la persona responsable"}`}
                      className="rounded-full"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#617868]">Responsable</p>
                    <p className="mt-1 truncate font-semibold text-[#173b2e]">{selectedProperty.inmobiliarioName || "Agente inmobiliario"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{selectedProperty.title}</p>
                    <span className="mt-2 inline-flex rounded-full bg-[#e1eddf] px-2.5 py-1 text-xs font-medium text-[#245c3c]">{selectedProperty.status}</span>
                  </div>
                </div>}
                <h3 className="mb-2 text-sm font-semibold">Propiedades ubicadas ({properties.length})</h3>
                <div className="max-h-[390px] space-y-2 overflow-y-auto">
                  {properties.map((property) => (
                    <button
                      type="button"
                      key={property.id}
                      aria-pressed={selectedProperty?.id === property.id}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedProperty?.id === property.id ? "border-[#6d9279] bg-[#edf4ec]" : "hover:bg-muted/60"}`}
                      onClick={() => {
                        setSelectedPropertyId(property.id);
                        setFocusedPosition({ latitude: property.latitude, longitude: property.longitude });
                      }}
                    >
                      <p className="font-medium">{property.title}</p>
                      <p className="text-sm text-muted-foreground">{property.detail}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {property.inmobiliarioName ? `${property.inmobiliarioName} · ` : ""}{property.status}
                      </p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
