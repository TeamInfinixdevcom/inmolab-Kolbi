"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MapMarker } from "@/components/mapa/real-map";
import { db } from "@/lib/firebase";

const RealMap = dynamic(() => import("@/components/mapa/real-map").then((module) => module.RealMap), { ssr: false });

type Property = MapMarker & { city: string; address: string; status: string };

function coordinate(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : undefined;
}

export default function MapaPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!db) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    const unsubscribe = onSnapshot(collection(db, "propiedades"), (snapshot) => {
        const loaded = snapshot.docs.flatMap((item) => {
          const data = item.data();
          const latitude = coordinate(data.latitude ?? data.lat);
          const longitude = coordinate(data.longitude ?? data.lng);
          if (latitude === undefined || longitude === undefined) return [];
          return [{
            id: item.id,
            title: String(data.title ?? "Condominio"),
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
      }, (loadError) => {
        console.error("No se pudo cargar el mapa.", loadError);
        setError("No se pudo cargar el mapa. Revisa las reglas de Firestore.");
        setLoading(false);
      });

    return unsubscribe;
  }, []);

  const markers = useMemo(() => properties.map(({ id, title, detail, latitude, longitude }) => ({ id, title, detail, latitude, longitude })), [properties]);

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Condominios ganados</p>
        <h1 className="mt-2 text-3xl font-bold">Mapa de Costa Rica</h1>
        <p className="mt-2 text-muted-foreground">Ubica las propiedades con coordenadas registradas.</p>
      </header>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardContent className="h-[480px] p-0">
            <RealMap markers={markers} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Condominios ubicados</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Cargando ubicaciones...</p> : properties.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay propiedades con latitud y longitud.</p> : <div className="space-y-3">{properties.map((property) => <div key={property.id} className="rounded-md border p-3"><p className="font-medium">{property.title}</p><p className="text-sm text-muted-foreground">{property.address || property.city}</p><p className="mt-1 text-xs text-muted-foreground">{property.status}</p></div>)}</div>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
