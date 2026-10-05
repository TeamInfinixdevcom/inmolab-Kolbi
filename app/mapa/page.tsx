"use client";

import { MapPin, Navigation, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase";

type Agent = { id: string; name: string; status: string; province: string; canton: string; district: string; latitude?: number; longitude?: number };

export default function MapaPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      if (!db) { setLoading(false); return; }
      try { const snapshot = await getDocs(collection(db, "inmobiliarios")); const loaded = snapshot.docs.map((item) => { const data = item.data(); return { id: item.id, name: String(data.name ?? ""), status: String(data.status ?? "Activo"), province: String(data.Provincia ?? data.province ?? ""), canton: String(data.Canton ?? data.canton ?? ""), district: String(data.Distrito ?? data.district ?? ""), latitude: Number(data.latitude ?? data.lat) || undefined, longitude: Number(data.longitude ?? data.lng) || undefined }; }); if (active) setAgents(loaded); }
      catch (loadError) { console.error("No se pudo cargar el mapa.", loadError); if (active) setError("No se pudo cargar el mapa."); } finally { if (active) setLoading(false); }
    } void load(); return () => { active = false; };
  }, []);
  return <section className="space-y-6"><header><p className="text-sm font-medium text-primary">Cobertura territorial</p><h1 className="mt-2 text-3xl font-bold">Mapa de inmobiliarios</h1><p className="mt-2 text-muted-foreground">Consulta la distribución territorial de tu equipo.</p></header>{error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}<div className="grid gap-6 lg:grid-cols-3"><Card className="min-h-[480px] lg:col-span-2"><CardContent className="relative h-full min-h-[480px] overflow-hidden rounded-xl bg-[radial-gradient(circle_at_30%_30%,#dbeafe,transparent_35%),linear-gradient(135deg,#eff6ff,#ecfdf5)] p-6"><div className="absolute inset-0 opacity-30 [background-image:linear-gradient(#94a3b8_1px,transparent_1px),linear-gradient(90deg,#94a3b8_1px,transparent_1px)] [background-size:48px_48px]" /><div className="relative flex h-full min-h-[430px] items-center justify-center text-center"><div><Navigation size={42} className="mx-auto text-primary" /><p className="mt-2 font-semibold">Vista territorial</p><p className="mt-1 max-w-xs text-sm text-muted-foreground">Los marcadores se posicionan con coordenadas cuando están disponibles.</p></div>{agents.map((agent, index) => <button key={agent.id} onClick={() => setSelected(agent)} className="absolute rounded-full border-4 border-white bg-primary p-2 text-white shadow-lg" style={{ left: `${18 + (index * 23) % 68}%`, top: `${18 + (index * 31) % 62}%` }} title={agent.name}><MapPin size={18} /></button>)}</div></CardContent></Card><Card><CardHeader><CardTitle>Equipo geolocalizado</CardTitle></CardHeader><CardContent>{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Cargando ubicaciones...</p> : !db ? <p className="py-8 text-center text-sm text-muted-foreground">Firebase no está configurado.</p> : agents.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No hay inmobiliarios con ubicación.</p> : <div className="space-y-2">{agents.map((agent) => <button key={agent.id} onClick={() => setSelected(agent)} className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted"><span className={`h-2.5 w-2.5 rounded-full ${agent.status === "Activo" ? "bg-emerald-500" : "bg-slate-400"}`} /><span className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{agent.name}</p><p className="truncate text-xs text-muted-foreground">{[agent.province, agent.canton, agent.district].filter(Boolean).join(" · ") || "Ubicación no registrada"}</p></span><Search size={15} className="text-muted-foreground" /></button>)}</div>}</CardContent></Card></div>{selected && <Card><CardHeader><CardTitle>{selected.name}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{[selected.province, selected.canton, selected.district].filter(Boolean).join(" · ") || "Sin división territorial registrada"}</p><p className="mt-2 text-xs text-muted-foreground">{selected.latitude && selected.longitude ? `Coordenadas: ${selected.latitude}, ${selected.longitude}` : "Sin coordenadas; se muestra ubicación aproximada."}</p></CardContent></Card>}</section>;
}
