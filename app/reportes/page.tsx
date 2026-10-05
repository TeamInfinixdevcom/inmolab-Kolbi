"use client";

import { BarChart3, Download, FileText, RefreshCw, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRBAC } from "@/components/auth/rbac-provider";
import { db } from "@/lib/firebase";
import { hasPermission } from "@/lib/rbac";

type ReportRow = {
  id: string;
  name: string;
  region: string;
  status: string;
  executive: string;
  segment: string;
  date: string;
  occupancy: number;
  naps: number;
  ports: number;
  capacity: number;
};

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function ReportesPage() {
  const { role } = useRBAC();
  const canRead = hasPermission(role, "reportes", "read");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [filters, setFilters] = useState({ period: "Todo", region: "Todas", status: "Todos", executive: "Todos", segment: "Todos" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!db) { setLoading(false); return; }
      try {
        const snapshot = await getDocs(collection(db, "inmobiliarios"));
        const loaded = snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            name: String(data.Nombre ?? data.name ?? ""),
            region: String(data.Region ?? data.region ?? data.Provincia ?? ""),
            status: String(data.Estado_CondiciónInmobiliario ?? data.status ?? "Sin estado"),
            executive: String(data.Ejecutivo_Responsable ?? data.executive ?? ""),
            segment: String(data.Segmento ?? data.segment ?? ""),
            date: String(data.Fecha_operación ?? data.createdAt ?? ""),
            occupancy: number(data["% Ocupacion"] ?? data.occupancy),
            naps: number(data.C_NAPs ?? data.Cantidad_NAPs),
            ports: number(data.C_PUERTOS ?? data.Puertos_Dispersion),
            capacity: number(data.Viviendas_construidas ?? data.Lotes_total),
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
    executive: [...new Set(rows.map((row) => row.executive).filter(Boolean))],
    segment: [...new Set(rows.map((row) => row.segment).filter(Boolean))],
  }), [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    const date = row.date ? new Date(row.date) : null;
    const now = new Date();
    const periodMatch = filters.period === "Todo" || (date && !Number.isNaN(date.getTime()) && (filters.period === "Mes" ? date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() : date.getFullYear() === now.getFullYear()));
    return periodMatch && (filters.region === "Todas" || row.region === filters.region) && (filters.status === "Todos" || row.status === filters.status) && (filters.executive === "Todos" || row.executive === filters.executive) && (filters.segment === "Todos" || row.segment === filters.segment);
  }), [filters, rows]);

  const metrics = useMemo(() => {
    const total = (key: keyof ReportRow) => filtered.reduce((sum, row) => sum + number(row[key]), 0);
    const active = filtered.filter((row) => /activo|active/i.test(row.status)).length;
    return {
      agents: active || filtered.length,
      properties: filtered.reduce((sum, row) => sum + (row.capacity > 0 ? 1 : 0), 0),
      clients: filtered.length,
      occupancy: filtered.length ? total("occupancy") / filtered.length : 0,
      naps: total("naps"),
      ports: total("ports"),
      capacity: total("capacity"),
    };
  }, [filtered]);

  const regions = useMemo(() => {
    const grouped = new Map<string, number>();
    filtered.forEach((row) => grouped.set(row.region || "Sin región", (grouped.get(row.region || "Sin región") ?? 0) + 1));
    return [...grouped.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  function exportCsv() {
    const header = ["Nombre", "Region", "Estado", "Ejecutivo", "Segmento", "Fecha", "Ocupacion", "NAPs", "Puertos", "Capacidad"];
    const csv = [header, ...filtered.map((row) => [row.name, row.region, row.status, row.executive, row.segment, row.date, row.occupancy, row.naps, row.ports, row.capacity])]
      .map((line) => line.map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "reporte-inmolab.csv"; link.click(); URL.revokeObjectURL(url);
  }

  if (!canRead) return <section className="rounded-xl border border-dashed p-12 text-center"><h1 className="text-2xl font-bold">Acceso restringido</h1><p className="mt-2 text-muted-foreground">Tu rol no tiene acceso a los reportes.</p></section>;

  return <section className="space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-primary">Inteligencia operativa</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Reportes y métricas</h1><p className="mt-2 text-muted-foreground">Analiza cobertura, ocupación y capacidad del negocio.</p></div><div className="flex gap-2"><Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download size={16} className="mr-2" /> CSV</Button><Button variant="outline" onClick={() => window.location.reload()}><RefreshCw size={16} className="mr-2" /> Actualizar</Button></div></header>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5"><label className="text-xs font-semibold uppercase text-muted-foreground">Período<select value={filters.period} onChange={(e) => setFilters({ ...filters, period: e.target.value })} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm font-normal"><option>Todo</option><option>Mes</option><option>Año</option></select></label>{(["region", "status", "executive", "segment"] as const).map((key) => <label key={key} className="text-xs font-semibold uppercase text-muted-foreground">{key === "region" ? "Región" : key === "status" ? "Estado" : key === "executive" ? "Ejecutivo" : "Segmento"}<select value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm font-normal"><option>{key === "region" ? "Todas" : "Todos"}</option>{options[key].map((option) => <option key={option}>{option}</option>)}</select></label>)}</CardContent></Card>
    {loading ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Cargando métricas...</CardContent></Card> : !db ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Firebase no está configurado. Conecta Firestore para consultar reportes.</CardContent></Card> : <>{filtered.length === 0 ? <Card><CardContent className="py-16 text-center"><FileText className="mx-auto text-muted-foreground" size={30} /><p className="mt-3 text-sm text-muted-foreground">No hay datos para los filtros seleccionados.</p></CardContent></Card> : <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Inmobiliarios" value={metrics.agents} /><Metric label="Propiedades" value={metrics.properties} /><Metric label="Clientes" value={metrics.clients} /><Metric label="Ocupación" value={`${metrics.occupancy.toFixed(1)}%`} /></section>
      <section className="grid gap-4 sm:grid-cols-3"><Metric label="NAPs" value={metrics.naps.toLocaleString("es-CR")} /><Metric label="Puertos" value={metrics.ports.toLocaleString("es-CR")} /><Metric label="Capacidad" value={metrics.capacity.toLocaleString("es-CR")} /></section>
      <section className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp size={18} className="text-primary" /> Ocupación y cobertura</CardTitle></CardHeader><CardContent><div className="space-y-4"><Progress label="Ocupación" value={metrics.occupancy} /><Progress label="Cobertura de capacidad" value={metrics.capacity ? Math.min(100, metrics.ports / metrics.capacity * 100) : 0} /><Progress label="Disponibilidad NAP" value={metrics.naps ? Math.min(100, metrics.naps / Math.max(metrics.capacity, 1) * 100) : 0} /></div></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 size={18} className="text-primary" /> Distribución por región</CardTitle></CardHeader><CardContent className="space-y-3">{regions.map(([region, count]) => <div key={region}><div className="mb-1 flex justify-between text-sm"><span>{region}</span><span className="font-semibold">{count}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(5, count / filtered.length * 100)}%` }} /></div></div>)}</CardContent></Card></section>
      <Card><CardHeader><CardTitle>Datos filtrados</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="border-b text-xs uppercase text-muted-foreground"><tr>{["Nombre", "Región", "Estado", "Ejecutivo", "Segmento", "Ocupación", "NAPs", "Puertos"].map((heading) => <th key={heading} className="pb-3 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y">{filtered.map((row) => <tr key={row.id}><td className="py-3 font-medium">{row.name || "Sin nombre"}</td><td className="py-3">{row.region || "—"}</td><td className="py-3">{row.status}</td><td className="py-3">{row.executive || "—"}</td><td className="py-3">{row.segment || "—"}</td><td className="py-3">{row.occupancy}%</td><td className="py-3">{row.naps}</td><td className="py-3">{row.ports}</td></tr>)}</tbody></table></div></CardContent></Card>
    </>}</>}
  </section>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-2 flex items-center gap-1 text-xs text-emerald-600"><TrendingUp size={13} /> Datos Firestore</p></CardContent></Card>;
}

function Progress({ label, value }: { label: string; value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return <div><div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="font-semibold">{safeValue.toFixed(1)}%</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${safeValue}%` }} /></div></div>;
}
