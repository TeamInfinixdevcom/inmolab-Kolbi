"use client";

import { BarChart3, Download, FileText, RefreshCw, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRBAC } from "@/components/auth/rbac-provider";
import { db } from "@/lib/firebase";
import { hasPermission } from "@/lib/rbac";
import { statusBadgeClass } from "@/lib/status-colors";

type ReportRow = {
  id: string;
  name: string;
  region: string;
  province: string;
  canton: string;
  district: string;
  status: string;
  responsible: string;
  type: string;
  date: string;
  activeServices: number;
  builtHouses: number;
  removedServices: number;
  nap: string;
  latitude: number | null;
  longitude: number | null;
};

const metricTones = {
  forest: "border-t-[#315f49]",
  leaf: "border-t-[#4e8e5b]",
  gold: "border-t-[#b08a37]",
  clay: "border-t-[#c4774d]",
} as const;
const regionBarTones = ["bg-[#3e7767]", "bg-[#4e8e5b]", "bg-[#b08a37]", "bg-[#c4774d]"];

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function dateValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as { toDate?: () => Date; seconds?: number };
  if (typeof record.toDate === "function") {
    const date = record.toDate();
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
  if (typeof record.seconds === "number") return new Date(record.seconds * 1000).toISOString();
  return "";
}

function coordinate(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export default function ReportesPage() {
  const { role } = useRBAC();
  const canRead = hasPermission(role, "reportes", "read");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [filters, setFilters] = useState({ period: "Todo", region: "Todas", status: "Todos", responsible: "Todos", type: "Todos" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!db) { setLoading(false); return; }
      try {
        const snapshot = await getDocs(collection(db, "propiedades"));
        const loaded = snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            name: text(data.condominiumName ?? data.title) || "Sin nombre",
            region: text(data.region) || text(data.province) || text(data.canton) || "Sin región",
            province: text(data.province),
            canton: text(data.canton),
            district: text(data.district),
            status: data.status === "Inactiva" ? "Inactiva" : "Activa",
            responsible: text(data.inmobiliarioName) || text(data.createdByName) || text(data.inmobiliarioId) || text(data.createdById) || text(data.createdBy) || "Sin asignar",
            type: text(data.type) || "Sin tipo",
            date: text(data.operationDate) || dateValue(data.createdAt),
            activeServices: number(data.activeServices),
            builtHouses: number(data.builtHouses),
            removedServices: number(data.removedServices),
            nap: text(data.nap),
            latitude: coordinate(data.latitude ?? data.lat, -90, 90),
            longitude: coordinate(data.longitude ?? data.lng, -180, 180),
          } satisfies ReportRow;
        });
        if (active) setRows(loaded);
      } catch (loadError) {
        console.error("No se pudieron cargar los reportes.", loadError);
        if (active) setError("No se pudieron cargar los reportes. Revisa la configuración y las reglas de Firestore.");
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);

  const options = useMemo(() => ({
    region: [...new Set(rows.map((row) => row.region).filter(Boolean))],
    status: [...new Set(rows.map((row) => row.status).filter(Boolean))],
    responsible: [...new Set(rows.map((row) => row.responsible).filter(Boolean))],
    type: [...new Set(rows.map((row) => row.type).filter(Boolean))],
  }), [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    const date = row.date ? new Date(row.date) : null;
    const now = new Date();
    const validDate = date && !Number.isNaN(date.getTime());
    const periodMatch = filters.period === "Todo" || Boolean(validDate && (
      filters.period === "Mes"
        ? date!.getMonth() === now.getMonth() && date!.getFullYear() === now.getFullYear()
        : date!.getFullYear() === now.getFullYear()
    ));
    return periodMatch && (filters.region === "Todas" || row.region === filters.region) &&
      (filters.status === "Todos" || row.status === filters.status) &&
      (filters.responsible === "Todos" || row.responsible === filters.responsible) &&
      (filters.type === "Todos" || row.type === filters.type);
  }), [filters, rows]);

  const metrics = useMemo(() => {
    const total = (key: "activeServices" | "builtHouses" | "removedServices") =>
      filtered.reduce((sum, row) => sum + row[key], 0);
    const active = filtered.filter((row) => row.status === "Activa").length;
    const mapped = filtered.filter((row) => row.latitude !== null && row.longitude !== null).length;
    const withNap = filtered.filter((row) => row.nap.length > 0).length;
    const activeServices = total("activeServices");
    const builtHouses = total("builtHouses");
    return {
      properties: filtered.length,
      active,
      mapped,
      withNap,
      builtHouses,
      activeServices,
      removedServices: total("removedServices"),
      serviceCoverage: builtHouses ? activeServices / builtHouses * 100 : 0,
      mappedCoverage: filtered.length ? mapped / filtered.length * 100 : 0,
      napCoverage: filtered.length ? withNap / filtered.length * 100 : 0,
    };
  }, [filtered]);

  const regions = useMemo(() => {
    const grouped = new Map<string, number>();
    filtered.forEach((row) => grouped.set(row.region, (grouped.get(row.region) ?? 0) + 1));
    return [...grouped.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  function exportCsv() {
    const header = ["Condominio", "Región", "Provincia", "Cantón", "Distrito", "Estado", "Responsable", "Tipo", "Fecha de operación", "Casas construidas", "Servicios activos", "Servicios retirados", "NAP", "Latitud", "Longitud"];
    const csv = [header, ...filtered.map((row) => [row.name, row.region, row.province, row.canton, row.district, row.status, row.responsible, row.type, row.date, row.builtHouses, row.activeServices, row.removedServices, row.nap, row.latitude ?? "", row.longitude ?? ""])]
      .map((line) => line.map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "reporte-propiedades-inmolab.csv"; link.click(); URL.revokeObjectURL(url);
  }

  if (!canRead) return <section className="rounded-xl border border-dashed p-12 text-center"><h1 className="text-2xl font-bold">Acceso restringido</h1><p className="mt-2 text-muted-foreground">Tu rol no tiene acceso a los reportes.</p></section>;

  const filterLabels = { region: "Región", status: "Estado", responsible: "Responsable", type: "Tipo" } as const;
  return <section className="space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-primary">Inteligencia operativa</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Reportes y métricas</h1><p className="mt-2 text-muted-foreground">Resumen actualizado de las propiedades registradas.</p></div><div className="flex gap-2"><Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download size={16} className="mr-2" /> CSV</Button><Button variant="outline" onClick={() => window.location.reload()}><RefreshCw size={16} className="mr-2" /> Actualizar</Button></div></header>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <Card className="border-[#e8e1ce] bg-[#fbfaf6]"><CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5"><label className="text-xs font-semibold uppercase text-muted-foreground">Período<select value={filters.period} onChange={(e) => setFilters({ ...filters, period: e.target.value })} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm font-normal"><option>Todo</option><option>Mes</option><option>Año</option></select></label>{(Object.keys(filterLabels) as Array<keyof typeof filterLabels>).map((key) => <label key={key} className="text-xs font-semibold uppercase text-muted-foreground">{filterLabels[key]}<select value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm font-normal"><option>{key === "region" ? "Todas" : "Todos"}</option>{options[key].map((option) => <option key={option}>{option}</option>)}</select></label>)}</CardContent></Card>
    {loading ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Cargando métricas...</CardContent></Card> : !db ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Firebase no está configurado. Conecta Firestore para consultar reportes.</CardContent></Card> : <>{filtered.length === 0 ? <Card><CardContent className="py-16 text-center"><FileText className="mx-auto text-muted-foreground" size={30} /><p className="mt-3 text-sm text-muted-foreground">No hay propiedades para los filtros seleccionados.</p></CardContent></Card> : <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Propiedades" value={metrics.properties} tone="forest" /><Metric label="Activas" value={metrics.active} tone="leaf" /><Metric label="Con ubicación en mapa" value={metrics.mapped} tone="gold" /><Metric label="Con NAP registrado" value={metrics.withNap} tone="clay" /></section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Casas construidas" value={metrics.builtHouses.toLocaleString("es-CR")} tone="forest" /><Metric label="Servicios activos" value={metrics.activeServices.toLocaleString("es-CR")} tone="leaf" /><Metric label="Servicios retirados" value={metrics.removedServices.toLocaleString("es-CR")} tone="clay" /><Metric label="Cobertura estimada" value={`${metrics.serviceCoverage.toFixed(1)}%`} tone="gold" /></section>
      <section className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp size={18} className="text-[#3e7767]" /> Cobertura y datos registrados</CardTitle></CardHeader><CardContent><div className="space-y-4"><Progress label="Servicios activos sobre casas construidas" value={metrics.serviceCoverage} tone="leaf" /><Progress label="Propiedades ubicadas en el mapa" value={metrics.mappedCoverage} tone="gold" /><Progress label="Propiedades con NAP" value={metrics.napCoverage} tone="forest" /></div><p className="mt-4 text-xs text-muted-foreground">La cobertura se calcula como servicios activos ÷ casas construidas.</p></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 size={18} className="text-[#b08a37]" /> Propiedades por región</CardTitle></CardHeader><CardContent className="space-y-3">{regions.map(([region, count], index) => <div key={region}><div className="mb-1 flex justify-between text-sm"><span>{region}</span><span className="font-semibold">{count}</span></div><div className="h-2 rounded-full bg-muted"><div className={`h-2 rounded-full ${regionBarTones[index % regionBarTones.length]}`} style={{ width: `${Math.max(5, count / filtered.length * 100)}%` }} /></div></div>)}</CardContent></Card></section>
      <Card><CardHeader><CardTitle>Propiedades filtradas</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead className="border-b bg-[#fbfaf6] text-xs uppercase text-muted-foreground"><tr>{["Condominio", "Región", "Estado", "Responsable", "Tipo", "Casas", "Servicios activos", "NAP", "Ubicación"].map((heading) => <th key={heading} className="pb-3 pt-2 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y">{filtered.map((row) => <tr key={row.id} className="transition-colors hover:bg-[#f5f7ef]"><td className="py-3 font-medium">{row.name}</td><td className="py-3">{row.region}</td><td className="py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(row.status)}`}>{row.status}</span></td><td className="py-3">{row.responsible}</td><td className="py-3">{row.type}</td><td className="py-3">{row.builtHouses}</td><td className="py-3">{row.activeServices}</td><td className="py-3">{row.nap || "—"}</td><td className="py-3">{row.latitude !== null && row.longitude !== null ? `${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}` : "Sin coordenadas"}</td></tr>)}</tbody></table></div></CardContent></Card>
    </>}</>}
  </section>;
}

function Metric({ label, value, tone = "leaf" }: { label: string; value: string | number; tone?: keyof typeof metricTones }) {
  return <Card className={`border-t-4 ${metricTones[tone]}`}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-2 flex items-center gap-1 text-xs text-[#3e7767]"><TrendingUp size={13} /> Datos de propiedades</p></CardContent></Card>;
}

function Progress({ label, value, tone = "leaf" }: { label: string; value: number; tone?: keyof typeof metricTones }) {
  const safeValue = Math.max(0, Math.min(100, value));
  const progressTone = tone === "gold" ? "bg-[#b08a37]" : tone === "clay" ? "bg-[#c4774d]" : tone === "forest" ? "bg-[#315f49]" : "bg-[#4e8e5b]";
  return <div><div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="font-semibold">{safeValue.toFixed(1)}%</span></div><div className="h-2 rounded-full bg-muted"><div className={`h-2 rounded-full ${progressTone}`} style={{ width: `${safeValue}%` }} /></div></div>;
}
