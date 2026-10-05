"use client";

import { CalendarDays, Check, Edit3, Plus, Search, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { addDoc, collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRBAC } from "@/components/auth/rbac-provider";
import { db } from "@/lib/firebase";
import { hasPermission } from "@/lib/rbac";

type EventKind = "Reunión" | "Visita" | "Llamada" | "Seguimiento";
type EventStatus = "Pendiente" | "Completado" | "Cancelado";
type EventItem = { id: string; title: string; kind: EventKind; date: string; time: string; status: EventStatus; responsible: string; responsibleId: string; client: string; property: string; notes: string };
type Option = { id: string; name: string };
const empty = { title: "", kind: "Reunión" as EventKind, date: "", time: "", status: "Pendiente" as EventStatus, responsible: "", responsibleId: "", client: "", property: "", notes: "" };

export default function EventosPage() {
  const { role, user } = useRBAC();
  const canWrite = hasPermission(role, "eventos", "create");
  const canEdit = hasPermission(role, "eventos", "update");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [agents, setAgents] = useState<Option[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [properties, setProperties] = useState<Option[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const firestore = db;
      if (!firestore) { setLoading(false); return; }
      try {
        const [eventSnap, agentSnap, clientSnap, propertySnap] = await Promise.all(["eventos", "inmobiliarios", "clientes", "propiedades"].map((name) => getDocs(collection(firestore, name))));
        const a = agentSnap.docs.map((item) => ({ id: item.id, name: String(item.data().name ?? "") }));
        const c = clientSnap.docs.map((item) => ({ id: item.id, name: String(item.data().name ?? "") }));
        const p = propertySnap.docs.map((item) => ({ id: item.id, name: String(item.data().title ?? "") }));
        const e = eventSnap.docs.map((item) => ({ id: item.id, ...item.data() } as EventItem));
        if (active) { setEvents(e.sort((x, y) => `${x.date}${x.time}`.localeCompare(`${y.date}${y.time}`))); setAgents(a); setClients(c); setProperties(p); }
      } catch (loadError) { console.error("No se pudieron cargar los eventos.", loadError); if (active) setError("No se pudieron cargar los eventos."); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, []);

  function openEdit(item: EventItem) { setEditing(item.id); setForm({ title: item.title, kind: item.kind, date: item.date, time: item.time, status: item.status, responsible: item.responsible, responsibleId: item.responsibleId, client: item.client, property: item.property, notes: item.notes }); setShowForm(true); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!db) { setError("Firebase no está configurado."); return; }
    if (!form.title || !form.date || !form.time) { setError("Título, fecha y hora son obligatorios."); return; }
    const agent = agents.find((item) => item.id === form.responsibleId);
    const payload = { ...form, responsible: agent?.name ?? form.responsible, responsibleId: form.responsibleId || user?.uid || "" };
    try {
      if (editing) { await updateDoc(doc(db, "eventos", editing), payload); setEvents((current) => current.map((item) => item.id === editing ? { ...item, ...payload } : item)); }
      else { const created = await addDoc(collection(db, "eventos"), payload); setEvents((current) => [...current, { ...payload, id: created.id }]); }
      setShowForm(false); setEditing(null); setForm(empty); setError("");
    } catch (saveError) { console.error("No se pudo guardar el evento.", saveError); setError("No se pudo guardar el evento."); }
  }
  async function changeStatus(item: EventItem, status: EventStatus) {
    if (!db || !canEdit) return;
    try { await updateDoc(doc(db, "eventos", item.id), { status }); setEvents((current) => current.map((event) => event.id === item.id ? { ...event, status } : event)); }
    catch (statusError) { console.error("No se pudo actualizar el evento.", statusError); setError("No se pudo actualizar el evento."); }
  }
  const visible = events.filter((item) => `${item.title} ${item.kind} ${item.responsible} ${item.client} ${item.property}`.toLowerCase().includes(query.toLowerCase()));

  return <section className="space-y-6"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-primary">Agenda operativa</p><h1 className="mt-2 text-3xl font-bold">Eventos</h1><p className="mt-2 text-muted-foreground">Coordina reuniones, visitas, llamadas y seguimientos.</p></div>{canWrite && <Button onClick={() => { setEditing(null); setForm(empty); setShowForm(true); }}><Plus size={17} className="mr-2" /> Nuevo evento</Button>}</header>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {showForm && <Card><CardHeader className="flex-row justify-between"><CardTitle>{editing ? "Editar evento" : "Nuevo evento"}</CardTitle><Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X size={18} /></Button></CardHeader><CardContent><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm font-medium lg:col-span-2">Título<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" /></label>
      <label className="text-sm font-medium">Tipo<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as EventKind })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal"><option>Reunión</option><option>Visita</option><option>Llamada</option><option>Seguimiento</option></select></label>
      <label className="text-sm font-medium">Fecha<input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" /></label><label className="text-sm font-medium">Hora<input required type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" /></label>
      <label className="text-sm font-medium">Responsable<select value={form.responsibleId} onChange={(e) => setForm({ ...form, responsibleId: e.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal"><option value="">Mi usuario</option>{agents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-medium">Cliente<select value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal"><option value="">Sin asociar</option>{clients.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><label className="text-sm font-medium">Propiedad<select value={form.property} onChange={(e) => setForm({ ...form, property: e.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal"><option value="">Sin asociar</option>{properties.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
      <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Observaciones<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="mt-2 w-full rounded-md border bg-background p-3 font-normal" /></label><div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit">Guardar</Button></div>
    </form></CardContent></Card>}
    <Card><CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Calendario y listado</CardTitle><p className="mt-1 text-sm text-muted-foreground">{events.length} eventos registrados</p></div><div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-muted-foreground" /><input aria-label="Buscar eventos" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar..." className="h-9 rounded-md border bg-background pl-9 pr-3 text-sm" /></div></CardHeader><CardContent>{loading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando eventos...</p> : !db ? <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Firebase no está configurado.</p> : visible.length === 0 ? <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No hay eventos.</p> : <div className="space-y-3">{visible.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"><span className="rounded-lg bg-primary/10 p-3 text-primary"><CalendarDays size={20} /></span><div className="min-w-0 flex-1"><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.kind} · {item.date} · {item.time} · {item.responsible || "Sin responsable"}</p><p className="mt-1 text-xs text-muted-foreground">{item.client || "Sin cliente"} {item.property && `· ${item.property}`}</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{item.status}</span><div className="flex gap-1">{canEdit && <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Edit3 size={16} /></Button>}{canEdit && item.status === "Pendiente" && <><Button variant="ghost" size="icon" onClick={() => void changeStatus(item, "Completado")} aria-label="Completar"><Check size={16} className="text-emerald-600" /></Button><Button variant="ghost" size="icon" onClick={() => void changeStatus(item, "Cancelado")} aria-label="Cancelar"><X size={16} className="text-red-500" /></Button></>}</div></div>)}</div>}</CardContent></Card>
  </section>;
}
