"use client";

import { Activity, CalendarDays, CheckCircle2, Phone, Plus, Users } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { addDoc, collection, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRBAC } from "@/components/auth/rbac-provider";
import { db } from "@/lib/firebase";
import { hasPermission } from "@/lib/rbac";
import { creationAudit } from "@/lib/firestore-audit";

type ActivityItem = { id: string; type: "Visita" | "Llamada" | "Reunión" | "Gestión"; description: string; date: string; user: string; userId?: string; subject: string; createdBy?: string };
const icons = { Visita: CalendarDays, Llamada: Phone, Reunión: Users, Gestión: Activity };

export default function ActividadPage() {
  const { role, user } = useRBAC();
  const canCreate = hasPermission(role, "actividad", "create");
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ type: "Visita" as ActivityItem["type"], description: "", subject: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      if (!db) { setLoading(false); return; }
      try { const snapshot = await getDocs(collection(db, "actividad")); const loaded = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ActivityItem)); if (active) setItems(loaded.sort((a, b) => b.date.localeCompare(a.date))); }
      catch (loadError) { console.error("No se pudo cargar la actividad.", loadError); if (active) setError("No se pudo cargar la actividad."); }
      finally { if (active) setLoading(false); }
    } void load(); return () => { active = false; };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!db) { setError("Firebase no está configurado."); return; }
    if (!form.description.trim()) { setError("La descripción es obligatoria."); return; }
    const item = { ...form, description: form.description.trim(), date: new Date().toISOString(), user: user?.displayName ?? user?.email ?? "Usuario actual", userId: user?.uid ?? "", ...creationAudit(user?.uid ?? "") };
    try { const created = await addDoc(collection(db, "actividad"), item); setItems((current) => [{ ...item, id: created.id }, ...current]); setShow(false); setForm({ type: "Visita", description: "", subject: "" }); setError(""); }
    catch (saveError) { console.error("No se pudo registrar la actividad.", saveError); setError("No se pudo registrar la actividad."); }
  }
  return <section className="space-y-6"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-primary">Seguimiento operativo</p><h1 className="mt-2 text-3xl font-bold">Actividad</h1><p className="mt-2 text-muted-foreground">Timeline de visitas, llamadas, reuniones y gestiones.</p></div>{canCreate && <Button onClick={() => setShow(true)}><Plus size={17} className="mr-2" /> Registrar actividad</Button>}</header>{error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{show && <Card><CardHeader><CardTitle>Registrar actividad</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Tipo<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ActivityItem["type"] })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal"><option>Visita</option><option>Llamada</option><option>Reunión</option><option>Gestión</option></select></label><label className="text-sm font-medium">Inmobiliario/cliente<input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" /></label><label className="text-sm font-medium sm:col-span-2">Descripción<textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-2 w-full rounded-md border bg-background p-3 font-normal" /></label><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setShow(false)}>Cancelar</Button><Button type="submit">Registrar</Button></div></form></CardContent></Card>}<Card><CardHeader><CardTitle>Timeline</CardTitle></CardHeader><CardContent>{loading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando actividad...</p> : !db ? <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Firebase no está configurado.</p> : items.length === 0 ? <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No hay actividad registrada.</p> : <div className="space-y-5">{items.map((item) => { const Icon = icons[item.type] ?? CheckCircle2; return <div key={item.id} className="flex gap-4"><span className="rounded-full bg-primary/10 p-3 text-primary"><Icon size={18} /></span><div className="flex-1 border-b pb-4"><div className="flex flex-col justify-between gap-1 sm:flex-row"><p className="font-semibold">{item.type}{item.subject && ` · ${item.subject}`}</p><time className="text-xs text-muted-foreground">{new Date(item.date).toLocaleString("es-CR")}</time></div><p className="mt-1 text-sm text-muted-foreground">{item.description}</p><p className="mt-2 text-xs text-muted-foreground">Registrado por {item.user}</p></div></div>; })}</div>}</CardContent></Card></section>;
}
