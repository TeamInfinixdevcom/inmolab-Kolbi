"use client";

import { BarChart3, Building2, CalendarDays, CheckCircle2, PieChart, RefreshCw, UserRound, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRBAC } from "@/components/auth/rbac-provider";
import { auth } from "@/lib/firebase";
import type { ChartDatum, GraphSummary, GraphsResponse, TeamGraphSummary } from "@/lib/graficas-types";

type GraphTab = "general" | "personal" | "equipo";
type TeamMetric = "properties" | "events" | "tasks";

const chartColors = ["#315f49", "#4e8e5b", "#b08a37", "#c4774d", "#698c7b", "#93a99b"];
const teamMetricLabels: Record<TeamMetric, string> = {
  properties: "Propiedades asignadas",
  events: "Eventos a cargo",
  tasks: "Tareas asignadas",
};

export default function GraficasPage() {
  const { role, user } = useRBAC();
  const [data, setData] = useState<GraphsResponse | null>(null);
  const [tab, setTab] = useState<GraphTab>("general");
  const [teamMetric, setTeamMetric] = useState<TeamMetric>("properties");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canSeeTeam = role === "ADMIN" || role === "SUPERVISOR";

  const loadGraphs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!user || !auth?.currentUser) throw new Error("No se encontró una sesión activa.");
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/graficas", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json() as GraphsResponse & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudieron cargar las gráficas.");
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las gráficas.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void loadGraphs(); }, [loadGraphs]);

  const tabs: Array<{ id: GraphTab; label: string; icon: typeof PieChart }> = [
    { id: "general", label: "General", icon: PieChart },
    { id: "personal", label: "Mi panel", icon: UserRound },
    ...(canSeeTeam ? [{ id: "equipo" as const, label: "Equipo", icon: Users }] : []),
  ];

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Inteligencia operativa</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Gráficas</h1>
          <p className="mt-2 text-muted-foreground">Vista general y seguimiento de tu actividad.</p>
        </div>
        <Button variant="outline" onClick={() => void loadGraphs()} disabled={loading}>
          <RefreshCw size={16} className={`mr-2 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </Button>
      </header>

      <div role="tablist" aria-label="Vistas de gráficas" className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`ios-interactive inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Cargando gráficas...</CardContent></Card>
      ) : error ? null : !data ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">No hay datos disponibles.</CardContent></Card>
      ) : tab === "general" ? (
        <SummaryPanel summary={data.general} title="Resumen general" description="Totales agregados de toda la operación." />
      ) : tab === "personal" ? (
        <SummaryPanel summary={data.personal} title="Mi actividad" description="Datos asignados a tu cuenta." />
      ) : canSeeTeam ? (
        <TeamPanel team={data.team ?? []} metric={teamMetric} onMetricChange={setTeamMetric} />
      ) : null}
    </section>
  );
}

function SummaryPanel({ summary, title, description }: { summary: GraphSummary; title: string; description: string }) {
  return (
    <div className="space-y-6" role="tabpanel">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryMetric label="Propiedades" value={summary.properties} icon={Building2} />
        <SummaryMetric label="Eventos" value={summary.events} icon={CalendarDays} />
        <SummaryMetric label="Tareas" value={summary.tasks} icon={CheckCircle2} />
      </section>
      <section className="grid gap-6 xl:grid-cols-3">
        <DoughnutCard title="Estado de propiedades" items={summary.propertyStatus} />
        <DoughnutCard title="Estado de eventos" items={summary.eventStatus} />
        <DoughnutCard title="Estado de tareas" items={summary.taskStatus} />
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <HorizontalBars title="Propiedades por región" items={summary.propertiesByRegion} />
        <HorizontalBars title="Eventos por tipo" items={summary.eventsByType} />
      </section>
    </div>
  );
}

function SummaryMetric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Building2 }) {
  return (
    <Card className="border-t-4 border-t-[#3e7767]">
      <CardContent className="flex items-start justify-between p-5">
        <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value.toLocaleString("es-CR")}</p></div>
        <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><Icon size={20} /></span>
      </CardContent>
    </Card>
  );
}

function DoughnutCard({ title, items }: { title: string; items: ChartDatum[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const circumference = 2 * Math.PI * 36;
  let offset = 0;

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${title}: ${total} registros`}>
            <circle cx="50" cy="50" r="36" fill="none" stroke="#edf1ed" strokeWidth="13" />
            {items.map((item, index) => {
              const length = total ? item.value / total * circumference : 0;
              const currentOffset = offset;
              offset += length;
              return <circle key={item.label} cx="50" cy="50" r="36" fill="none" stroke={chartColors[index % chartColors.length]} strokeWidth="13" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-currentOffset} />;
            })}
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center"><strong className="text-2xl">{total.toLocaleString("es-CR")}</strong><span className="text-[10px] text-muted-foreground">registros</span></span>
        </div>
        <ul className="w-full space-y-2">
          {items.map((item, index) => (
            <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} /><span className="truncate">{item.label}</span></span>
              <span className="font-semibold tabular-nums">{item.value.toLocaleString("es-CR")}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function HorizontalBars({ title, items }: { title: string; items: ChartDatum[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 size={18} className="text-[#b08a37]" /> {title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">Aún no hay datos para mostrar.</p> : items.map((item, index) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate">{item.label}</span><span className="font-semibold tabular-nums">{item.value.toLocaleString("es-CR")}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${item.value ? Math.max(3, item.value / max * 100) : 0}%`, backgroundColor: chartColors[index % chartColors.length] }} /></div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TeamPanel({ team, metric, onMetricChange }: { team: TeamGraphSummary[]; metric: TeamMetric; onMetricChange: (metric: TeamMetric) => void }) {
  const bars = team.map((person) => ({ label: person.name, value: person[metric] }));
  return (
    <div className="space-y-6" role="tabpanel">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div><h2 className="text-xl font-semibold">Actividad del equipo</h2><p className="mt-1 text-sm text-muted-foreground">Comparación por persona. Se muestran nombres y conteos, sin datos de contacto.</p></div>
        <label className="text-xs font-semibold uppercase text-muted-foreground">Métrica<select value={metric} onChange={(event) => onMetricChange(event.target.value as TeamMetric)} className="mt-1 h-9 rounded-md border bg-background px-3 text-sm font-normal normal-case text-foreground"><option value="properties">Propiedades</option><option value="events">Eventos</option><option value="tasks">Tareas</option></select></label>
      </div>
      <HorizontalBars title={teamMetricLabels[metric]} items={bars} />
      <Card>
        <CardHeader><CardTitle>Detalle por integrante</CardTitle></CardHeader>
        <CardContent>
          {team.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No hay usuarios registrados.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-b text-xs uppercase text-muted-foreground"><tr><th className="pb-3 font-medium">Integrante</th><th className="pb-3 font-medium">Rol</th><th className="pb-3 text-right font-medium">Propiedades</th><th className="pb-3 text-right font-medium">Eventos</th><th className="pb-3 text-right font-medium">Tareas</th></tr></thead><tbody className="divide-y">{team.map((person) => <tr key={person.uid}><td className="py-3 font-medium">{person.name}</td><td className="py-3 text-muted-foreground">{person.role}</td><td className="py-3 text-right tabular-nums">{person.properties}</td><td className="py-3 text-right tabular-nums">{person.events}</td><td className="py-3 text-right tabular-nums">{person.tasks}</td></tr>)}</tbody></table></div>}
        </CardContent>
      </Card>
    </div>
  );
}
