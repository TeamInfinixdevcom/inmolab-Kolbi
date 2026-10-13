"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
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
  if (value === null || value === undefined || value === "") return undefined;
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
  ) return null;

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
  const [selectedPosition, setSelectedPosition] = useState<MapPosition | null>(null);
  const [editing, setEditing] = useState<SavedReference | null>(null);

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
            latitude === undefined || longitude === undefined ||
            latitude < -90 || latitude > 90 ||
            longitude < -180 || longitude > 180
          ) return [];

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
        console.error("Error cargando propiedades:", loadError);
        setError("No se pudieron cargar las propiedades. Revisa Firestore.");
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
            latitude === undefined || longitude === undefined ||
            latitude < -90 || latitude > 90 ||
            longitude < -180 || longitude > 180
          ) return [];

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
        console.error("Error cargando marcadores:", loadError);
        setError((previous) => previous || "No se pudieron cargar los marcadores. Revisa Firestore.");
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
        id: `property-${id}`, title, detail, latitude, longitude,
      })),
      ...references.map(({ id, title, detail, latitude, longitude }) => ({
        id: `reference-${id}`, title: `Referencia: ${title}`, detail, latitude, longitude,
      })),
    ],
    [properties, references],
  );

  function canManage(reference: SavedReference) {
    return Boolean(user) && (role === "ADMIN" || reference.createdBy === user?.uid);
  }

  async function findLocation() {
    setError("");
    setNotice("");
    const coordinates = parseCoordinates(searchText);

    if (coordinates) {
      setSelectedPosition(coordinates);
      setNotice("Coordenadas encontradas. Podés guardar este punto.");
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
      if (!response.ok) throw new Error("Falló el servicio de búsqueda.");

      const results = (await response.json()) as Array<{
        lat: string; lon: string; display_name: string;
      }>;

      if (!results.length) {
        setError("No encontramos ese lugar en Costa Rica. Probá otra dirección o coordenadas.");
        return;
      }

      setSelectedPosition({
        latitude: Number(results[0].lat),
        longitude: Number(results[0].lon),
      });
      setSearchText(results[0].display_name);
      setNotice("Lugar encontrado. Podés guardar este punto.");
    } catch (searchError) {
      console.error("Error buscando ubicación:", searchError);
      setError("Falló la búsqueda. Probá pegando coordenadas o seleccionando el mapa.");
    } finally {
      setSearching(false);
    }
  }

  function startEditing(reference: SavedReference) {
    if (!canManage(reference)) return;
    setEditing(reference);
    setReferenceTitle(reference.title);
    setReferenceDetail(reference.detail);
    setSelectedPosition({
      latitude: reference.latitude,
      longitude: reference.longitude,
    });
    setSearchText("");
    setError("");
    setNotice("Editando marcador. Buscá otra ubicación o seleccioná un punto en el mapa para moverlo.");
  }

  function cancelEditing() {
    setEditing(null);
    setReferenceTitle("");
    setReferenceDetail("");
    setSelectedPosition(null);
    setSearchText("");
    setError("");
    setNotice("Edición cancelada.");
  }

  async function saveReference() {
    if (!db || !auth || !user) {
      setError("Iniciá sesión para guardar un marcador.");
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
      setError("Escribí un nombre para el marcador.");
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
      const data = {
        title: referenceTitle.trim(),
        detail: referenceDetail.trim(),
        latitude: selectedPosition.latitude,
        longitude: selectedPosition.longitude,
      };

      if (editing) {
        if (!canManage(editing)) {
          setError("No tenés permiso para editar este marcador.");
          return;
        }

        await updateDoc(doc(db, "mapa_marcadores", editing.id), data);
        setNotice("Marcador actualizado correctamente.");
      } else {
        await addDoc(collection(db, "mapa_marcadores"), {
          ...data,
          createdBy: user.uid,
          createdByName: user.displayName ?? user.email ?? "Usuario",
          createdAt: serverTimestamp(),
        });
        setNotice("Marcador guardado y compartido con los usuarios autorizados.");
      }

      setEditing(null);
      setReferenceTitle("");
      setReferenceDetail("");
      setSearchText("");
      setSelectedPosition(null);
    } catch (saveError) {
      console.error("No se pudo guardar el marcador:", saveError);
      setError("No se pudo guardar. Revisá tus permisos de Firestore.");
    } finally {
      setSaving(false);
    }
  }

  async function removeReference(reference: SavedReference) {
    if (!db || !user || !canManage(reference)) {
      setError("No tenés permiso para eliminar este marcador.");
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar el marcador "${reference.title}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setError("");
    setNotice("");
    try {
      await deleteDoc(doc(db, "mapa_marcadores", reference.id));
      if (editing?.id === reference.id) cancelEditing();
      setNotice("Marcador eliminado.");
    } catch (deleteError) {
      console.error("No se pudo eliminar el marcador:", deleteError);
      setError("No se pudo eliminar. Revisá tus permisos de Firestore.");
    }
  }

  const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Ubicaciones de referencia</p>
        <h1 className="mt-2 text-3xl font-bold">Mapa de Costa Rica</h1>
        <p className="mt-2 text-muted-foreground">
          Consultá propiedades y compartí ubicaciones sin crear propiedades duplicadas.
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Buscar ubicación</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => { event.preventDefault(); void findLocation(); }}
          >
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Coordenadas o dirección en Costa Rica"
              aria-label="Dirección o coordenadas"
              className={inputClass}
            />
            <Button type="submit" disabled={searching}>
              {searching ? "Buscando..." : "Buscar"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground">
            Pegá coordenadas de Google Maps, escribí una dirección o seleccioná un punto directamente en el mapa.
          </p>

          {selectedPosition && (
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">Ubicación seleccionada</p>
              <p>Latitud: {selectedPosition.latitude.toFixed(6)}</p>
              <p>Longitud: {selectedPosition.longitude.toFixed(6)}</p>
            </div>
          )}
          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}
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
                setNotice(editing
                  ? "Nueva ubicación seleccionada para el marcador."
                  : "Punto seleccionado en el mapa.");
                setError("");
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{editing ? "Editar marcador" : "Guardar punto de referencia"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                value={referenceTitle}
                onChange={(event) => setReferenceTitle(event.target.value)}
                placeholder="Nombre del punto"
                maxLength={100}
                aria-label="Nombre del punto"
                className={inputClass}
              />
              <textarea
                value={referenceDetail}
                onChange={(event) => setReferenceDetail(event.target.value)}
                placeholder="Descripción (opcional)"
                maxLength={300}
                aria-label="Descripción del punto"
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button
                className="w-full"
                onClick={() => void saveReference()}
                disabled={saving || authLoading || !selectedPosition || !user}
              >
                {saving ? "Guardando..." : editing ? "Guardar cambios" : "Guardar marcador"}
              </Button>
              {editing && (
                <Button variant="outline" className="w-full" onClick={cancelEditing}>
                  Cancelar edición
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Los marcadores son independientes de las propiedades y se comparten con los usuarios autorizados.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Propiedades ubicadas</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Cargando propiedades...</p>
              ) : properties.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Aún no hay propiedades con coordenadas.</p>
              ) : (
                <div className="max-h-56 space-y-3 overflow-y-auto">
                  {properties.map((property) => (
                    <button
                      type="button"
                      key={property.id}
                      className="w-full rounded-md border p-3 text-left hover:bg-muted"
                      onClick={() => setSelectedPosition({ latitude: property.latitude, longitude: property.longitude })}
                    >
                      <p className="font-medium">{property.title}</p>
                      <p className="text-sm text-muted-foreground">{property.address || property.city || property.detail}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{property.status}</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Marcadores compartidos ({references.length})</CardTitle></CardHeader>
            <CardContent>
              {references.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay puntos de referencia guardados.</p>
              ) : (
                <div className="max-h-96 space-y-3 overflow-y-auto">
                  {references.map((reference) => (
                    <div key={reference.id} className="rounded-md border p-3">
                      <button
                        type="button"
                        className="w-full text-left hover:text-primary"
                        onClick={() => setSelectedPosition({ latitude: reference.latitude, longitude: reference.longitude })}
                      >
                        <p className="font-medium">{reference.title}</p>
                        {reference.detail && <p className="text-sm text-muted-foreground">{reference.detail}</p>}
                        <p className="mt-1 text-xs text-muted-foreground">Guardado por {reference.createdByName}</p>
                      </button>
                      {canManage(reference) && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => startEditing(reference)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => void removeReference(reference)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      )}
                    </div>
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
