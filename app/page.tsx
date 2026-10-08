"use client";

import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Home,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRBAC } from "@/components/auth/rbac-provider";
import { canAccessModule, hasPermission } from "@/lib/rbac";
import { db } from "@/lib/firebase";

type Property = {
  id: string;
  name: string;
  status: "Activa" | "Inactiva";
  activeServices: number;
  builtHouses: number;
  createdAt: string;
  createdBy: string;
  history: Array<{ date: string; user: string; note: string; changes: string[] }>;
};
type DashboardEvent = { id: string; title: string; kind: string; date: string; time: string; property: string; client: string };
type Client = { id: string };
type Agent = { id: string };

const colors = ["bg-blue-500", "bg-violet-500", "bg-amber-500", "bg-emerald-500"];
const icons = [Building2, UserRound, CheckCircle2, Users];

function dateLabel(date: string) {
  return date ? new Date(date).toLocaleString("es-CR") : "Fecha no disponible";
}

export default function DashboardPage() {
  const { role } = useRBAC();
  const canManageTeam = hasPermission(role, "inmobiliarios", "manage");
  const [properties, setProperties] = useState<Property[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  useEffect(() => {
    if (!db) {
      setLoading(false);
      setDataError("Firebase no está configurado.");
      return;
    }
    let pending = 4;
    const finish = () => {
      pending -= 1;
      if (pending === 0) setLoading(false);
    };
    const firestore = db;
    const subscribe = <T,>(name: string, setter: (items: T[]) => void, map: (id: string, data: Record<string, unknown>) => T) => onSnapshot(
      collection(firestore, name),
      (snapshot) => {
        setter(snapshot.docs.map((item) => map(item.id, item.data())));
        finish();
      },
      (error) => {
        console.error(`No se pudo cargar ${name} en el dashboard.`, error);
        setDataError("Algunos datos no están disponibles para este usuario.");
        finish();
      },
    );
    const unsubscribers = [
      subscribe("propiedades", setProperties, (id, data) => ({
        id,
        name: String(data.condominiumName ?? data.title ?? "Condominio"),
        status: (data.status === "Inactiva" ? "Inactiva" : "Activa") as Property["status"],
        activeServices: Number(data.activeServices ?? 0),
        builtHouses: Number(data.builtHouses ?? 0),
        createdAt: String(data.createdAt ?? ""),
        createdBy: String(data.createdBy ?? "Usuario"),
        history: Array.isArray(data.history) ? data.history as Property["history"] : [],
      })),
      subscribe("clientes", setClients, (id) => ({ id })),
      subscribe("inmobiliarios", setAgents, (id) => ({ id })),
      subscribe("eventos", setEvents, (id, data) => ({
        id,
        title: String(data.title ?? "Evento"),
        kind: String(data.kind ?? "Gestión"),
        date: String(data.date ?? ""),
        time: String(data.time ?? ""),
        property: String(data.property ?? ""),
        client: String(data.client ?? ""),
      })),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const activeProperties = properties.filter((property) => property.status === "Activa").length;
  const totalBuiltHouses = properties.reduce((sum, property) => sum + property.builtHouses, 0);
  const totalActiveServices = properties.reduce((sum, property) => sum + property.activeServices, 0);
  const occupancy = totalBuiltHouses ? Math.round((totalActiveServices / totalBuiltHouses) * 100) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events.filter((event) => event.date >= today).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 4);

  const chartValues = useMemo(() => {
    const values = Array.from({ length: 12 }, () => 0);
    properties.forEach((property) => {
      const date = new Date(property.createdAt);
      if (!Number.isNaN(date.getTime())) values[date.getMonth()] += 1;
    });
    const max = Math.max(...values, 1);
    return values.map((value) => ({ value, height: value ? Math.max(8, Math.round((value / max) * 100)) : 3 }));
  }, [properties]);
  const chartLabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const activities = properties.flatMap((property) => property.history.map((entry) => ({
    title: property.name,
    detail: `${entry.note || entry.changes.join(", ") || "Actualización"} · ${entry.user} · ${dateLabel(entry.date)}`,
  }))).sort((a, b) => b.detail.localeCompare(a.detail)).slice(0, 4);
  const stats = [
    { label: "Usuarios", value: agents.length, detail: "Cuentas activas registradas", icon: Users, tone: "blue", module: "inmobiliarios" as const },
    { label: "Condominios", value: properties.length, detail: `${activeProperties} activos`, icon: Building2, tone: "violet", module: "propiedades" as const },
    { label: "Clientes", value: clients.length, detail: "Registros consultables", icon: UserRound, tone: "amber", module: "clientes" as const },
    { label: "Servicios activos", value: `${occupancy}%`, detail: `${totalActiveServices} de ${totalBuiltHouses} casas`, icon: Home, tone: "emerald", module: "propiedades" as const },
  ];

  return <div className="space-y-8">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-primary">{new Date().toLocaleDateString("es-CR", { dateStyle: "full" })}</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Buenos días, equipo <span aria-hidden>👋</span></h1><p className="mt-2 text-muted-foreground">Resumen actualizado directamente desde Firestore.</p></div><div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground"><CalendarDays size={16} className="text-primary" /> Tiempo real</div></header>
    {dataError && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{dataError}</div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.filter(({ module }) => canAccessModule(role, module)).map(({ label, value, detail, icon: Icon, tone }) => <Card key={label} className="overflow-hidden"><CardContent className="flex items-start justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight">{loading ? "..." : value}</p><p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600"><TrendingUp size={13} /> {detail}</p></div><span className={`rounded-xl p-3 ${tone === "blue" ? "bg-blue-50 text-blue-600" : tone === "violet" ? "bg-violet-50 text-violet-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}><Icon size={21} /></span></CardContent></Card>)}</section>
    <section className="grid gap-6 lg:grid-cols-5"><Card className="lg:col-span-3"><CardHeader><CardTitle>Condominios registrados por mes</CardTitle><p className="mt-1 text-sm text-muted-foreground">Datos calculados con la fecha real de creación</p></CardHeader><CardContent><div className="flex h-56 items-end gap-2 border-b border-l px-3 pb-0 pt-5 sm:gap-3">{chartValues.map(({ value, height }, index) => <div key={chartLabels[index]} className="group flex h-full flex-1 flex-col justify-end gap-2"><div className="relative w-full rounded-t-md bg-primary/15 transition-colors group-hover:bg-primary/35" style={{ height: `${height}%` }}><span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 text-[10px] font-semibold group-hover:block">{value}</span></div><span className="text-center text-[10px] text-muted-foreground">{chartLabels[index]}</span></div>)}</div></CardContent></Card>
      <Card className="lg:col-span-2"><CardHeader><div><CardTitle>Próximos eventos</CardTitle><p className="mt-1 text-sm text-muted-foreground">Agenda real de Firestore</p></div></CardHeader><CardContent className="space-y-1">{upcomingEvents.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No hay eventos próximos.</p> : upcomingEvents.map((event, index) => <div key={event.id} className="flex items-start gap-3 rounded-lg p-3 hover:bg-muted"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${colors[index % colors.length]}`} /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{event.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{event.property || event.client || event.kind}</p></div><span className="text-xs font-semibold text-muted-foreground">{event.date} {event.time}</span></div>)}</CardContent></Card></section>
    <section className="grid gap-6 lg:grid-cols-5"><Card className="lg:col-span-3"><CardHeader><CardTitle>Actividad reciente</CardTitle><p className="mt-1 text-sm text-muted-foreground">Últimas actualizaciones de condominios</p></CardHeader><CardContent className="divide-y">{activities.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No hay actividad registrada.</p> : activities.map((activity, index) => { const Icon = icons[index % icons.length]; return <div key={`${activity.title}-${activity.detail}`} className="flex items-center gap-3 py-3"><span className={`rounded-lg p-2 ${colors[index % colors.length].replace("bg-", "bg-").replace("-500", "-100")} text-primary`}><Icon size={17} /></span><div><p className="text-sm font-medium">{activity.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{activity.detail}</p></div></div>; })}</CardContent></Card><Card className="lg:col-span-2"><CardHeader><CardTitle>Accesos rápidos</CardTitle><p className="mt-1 text-sm text-muted-foreground">Acciones frecuentes</p></CardHeader><CardContent className="space-y-2"><Link href="/propiedades" className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium hover:bg-muted">Consultar condominios <ArrowUpRight size={16} className="text-muted-foreground" /></Link><Link href="/clientes" className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium hover:bg-muted">Consultar clientes <ArrowUpRight size={16} className="text-muted-foreground" /></Link>{canManageTeam && <Link href="/inmobiliarios" className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium hover:bg-muted">Administrar usuarios <ArrowUpRight size={16} className="text-muted-foreground" /></Link>}<Link href="/eventos" className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium hover:bg-muted">Ver eventos <ArrowUpRight size={16} className="text-muted-foreground" /></Link></CardContent></Card></section>
  </div>;
}
