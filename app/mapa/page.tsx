
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { MapMarker, MapPosition } from "@/components/mapa/real-map";
import { auth, db } from "@/lib/firebase";
import { useRBAC } from "@/components/auth/rbac-provider";

const RealMap = dynamic(
  () => import("@/components/mapa/real-map").then((module) => module.RealMap),
  { ssr: false },
);

type Property = MapMarker & {
  city: string;
  address: string;
  status: string;
};

type SavedReference = MapMarker & {
  createdBy: string;
  createdByName: string;
};

function coordinate(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCoordinates(value: string): MapPosition | null {
  const parts = value.trim().split(/[,\s]+/).filter(Boolean);
  if (parts.length !== 2) return null;

  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

export default function MapaPage() {
  const { user, role, loading: authLoading } = useRBAC();

  const [properties, setProperties] = useState<Property[]>([]);
  const [references, setReferences] = useState<SavedReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchText, setSearchText] = useState("");
  const [referenceTitle, setReferenceTitle] = useState("");
  const [referenceDetail, setReferenceDetail] = useState("");
  const [selectedPosition, setSelectedPosition] =
    useState<MapPosition | null>(null);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      setError("Firebase no está configurado.");
      return;
    }

    const unsubscribeProperties = onSnapshot(
      collection(db, "propiedades"),
      (snapshot) => {
        const loaded = snapshot.docs.flatMap((item) => {
          const data = item.data();
          const latitude = coordinate(data.latitude ?? data.lat);
          const longitude = coordinate(data.longitude ?? data.lng);

          if (
            latitude === undefined ||
            longitude === undefined ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
          ) {
            return [];
          }

          return [{
            id: item.id,
            title: String(data.title ?? "Propiedad"),
            detail: String(data.address ?? data.city ?? "Costa Rica"),
            latitude,
            longitude,
            city: String(data.city ?? ""),
            address: String(data.address ?? ""),
            status: String(data.status ?? "Activa"),
          }];
        });

        setProperties(loaded);
        setLoading(false);
      },
      (loadError) => {
        console.error("No se pudieron cargar las propiedades del mapa.", loadError);
        setError(
          "No se pudieron cargar las propiedades. Revisa las reglas de Firestore.",
        );
        setLoading(false);
      },
    );

    const unsubscribeReferences = onSnapshot(
      collection(db, "mapa_marcadores"),
      (snapshot) => {
        const loaded = snapshot.docs.flatMap((item) => {
          const data = item.data();
          const latitude = coordinate(data.latitude);
          const longitude = coordinate(data.longitude);

          if (
            latitude === undefined ||
            longitude === undefined ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
          ) {
            return [];
          }

          return [{
            id: item.id,
            title: String(data.title ?? "Punto de referencia"),
            detail: String(data.detail ?? ""),
            latitude,
            longitude,
            createdBy: String(data.createdBy ?? ""),
            createdByName: String(data.createdByName ?? "Usuario"),
          }];
        });

        setReferences(loaded);
      },
      (loadError) => {
        console.error("No se pudieron cargar los marcadores compartidos.", loadError);
        setError((previous) =>
          previous ||
          "No se pudieron cargar los marcadores. Revisa las reglas de Firestore.",
        );
      },
    );

    return () => {
      unsubscribeProperties();
      unsubscribeReferences();
    };
  }, []);

  const markers = useMemo(
    () => [
      ...properties.map(({ id, title, detail, latitude, longitude }) => ({
        id: `property-${id}`,
        title,
        detail,
        latitude,
        longitude,
      })),
      ...references.map(({ id, title, detail, latitude, longitude }) => ({
        id: `reference-${id}`,
        title: `Referencia: ${title}`,
        detail,
        latitude,
        longitude,
      })),
    ],
    [properties, references],
  );

  async function findLocation() {
    setError("");
    setNotice("");

    const coordinates = parseCoordinates(searchText);

    if (coordinates) {
      setSelectedPosition(coordinates);
      setNotice("Coordenadas encontradas. Podés guardar este punto de referencia.");
      return;
    }

    if (!searchText.trim()) {
      setError("Escribí una dirección o pegá unas coordenadas.");
      return;
    }

    setSearching(true);

    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", searchText.trim());
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "cr");

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error("Falló el servicio de búsqueda.");
      }

      const results = (await response.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
      }>;

      if (results.length === 0) {
        setError(
          "No encontramos ese lugar en Costa Rica. Probá otra dirección o pegá las coordenadas.",
        );
        return;
      }

      const latitude = Number(results[0].lat);
      const longitude = Number(results[0].lon);

      setSelectedPosition({ latitude, longitude });
      setSearchText(results[0].display_name);
      setNotice("Lugar encontrado. Podés guardar este punto de referencia.");
    } catch (searchError) {
      console.error("Error al buscar ubicación.", searchError);
      setError(
        "Falló la búsqueda. Podés pegar las coordenadas o seleccionar un punto en el mapa.",
      );
    } finally {
      setSearching(false);
    }
  }

  async function saveReference() {
    if (!db || !auth || !user) {
      setError("Iniciá sesión para guardar un punto de referencia.");
      return;
    }

    if (auth.currentUser?.uid !== user.uid) {
      setError("La sesión cambió. Actualizá la página e intentá de nuevo.");
      return;
    }

    if (!selectedPosition) {
      setError("Primero buscá o seleccioná una ubicación en el mapa.");
      return;
    }

    if (!referenceTitle.trim()) {
      setError("Escribí un nombre para el punto de referencia.");
      return;
    }

    if (!["ADMIN", "SUPERVISOR", "AGENTE"].includes(role)) {
      setError("Tu rol no tiene permiso para guardar marcadores.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await addDoc(collection(db, "mapa_marcadores"), {
        title: referenceTitle.trim(),
        detail: referenceDetail.trim(),
        latitude: selectedPosition.latitude,
        longitude: selectedPosition.longitude,
        createdBy: user.uid,
        createdByName: user.displayName ?? user.email ?? "Usuario",
        createdAt: serverTimestamp(),
      });

      setReferenceTitle("");
      setReferenceDetail("");
      setSearchText("");
      setSelectedPosition(null);
      setNotice("Punto de referencia guardado y compartido con los usuarios autorizados.");
    } catch (saveError) {
      console.error("No se pudo guardar el punto de referencia.", saveError);
      setError(
        "No se pudo guardar. Verificá las reglas de Firestore para mapa_marcadores.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Ubicaciones de referencia</p>
        <h1 className="mt-2 text-3xl font-bold">Mapa de Costa Rica</h1>
        <p className="mt-2 text-muted-foreground">
          Consultá propiedades y guardá ubicaciones sin crear propiedades duplicadas.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Buscar ubicación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void findLocation();
            }}
          >
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Ej. 9.989623734141432, -84.14770970478676"
              aria-label="Dirección o coordenadas"
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={searching}>
              {searching ? "Buscando..." : "Buscar"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground">
            Pegá coordenadas de Google Maps, escribí una dirección de Costa Rica
            o seleccioná un punto directamente en el mapa.
          </p>

          {selectedPosition && (
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">Ubicación seleccionada</p>
              <p>Latitud: {selectedPosition.latitude}</p>
              <p>Longitud: {selectedPosition.longitude}</p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
            >
              {notice}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardContent className="h-[620px] p-0">
            <RealMap
              markers={markers}
              selectedPosition={selectedPosition}
              onMapClick={(position) => {
                setSelectedPosition(position);
                setNotice("Punto seleccionado en el mapa.");
                setError("");
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Guardar punto de referencia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                value={referenceTitle}
                onChange={(event) => setReferenceTitle(event.target.value)}
                placeholder="Nombre del punto"
                maxLength={100}
                aria-label="Nombre del punto"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />

              <input
                value={referenceDetail}
                onChange={(event) => setReferenceDetail(event.target.value)}
                placeholder="Descripción (opcional)"
                maxLength={300}
                aria-label="Descripción del punto"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />

              <Button
                className="w-full"
                onClick={() => void saveReference()}
                disabled={saving || authLoading || !selectedPosition || !user}
              >
                {saving ? "Guardando..." : "Guardar marcador"}
              </Button>

              <p className="text-xs text-muted-foreground">
                El marcador se guarda por separado de las propiedades y queda
                asociado a tu usuario.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Propiedades ubicadas</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Cargando propiedades...
                </p>
              ) : properties.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Aún no hay propiedades con coordenadas.
                </p>
              ) : (
                <div className="max-h-56 space-y-3 overflow-y-auto">
                  {properties.map((property) => (
                    <button
                      type="button"
                      key={property.id}
                      className="w-full rounded-md border p-3 text-left hover:bg-muted"
                      onClick={() =>
                        setSelectedPosition({
                          latitude: property.latitude,
                          longitude: property.longitude,
                        })
                      }
                    >
                      <p className="font-medium">{property.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {property.address || property.city || property.detail}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {property.status}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Marcadores compartidos ({references.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {references.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aún no hay puntos de referencia guardados.
                </p>
              ) : (
                <div className="max-h-56 space-y-3 overflow-y-auto">
                  {references.map((reference) => (
                    <button
                      type="button"
                      key={reference.id}
                      className="w-full rounded-md border p-3 text-left hover:bg-muted"
                      onClick={() =>
                        setSelectedPosition({
                          latitude: reference.latitude,
                          longitude: reference.longitude,
                        })
                      }
                    >
                      <p className="font-medium">{reference.title}</p>
                      {reference.detail && (
                        <p className="text-sm text-muted-foreground">
                          {reference.detail}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Guardado por {reference.createdByName}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
