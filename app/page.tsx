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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRBAC } from "@/components/auth/rbac-provider";
import { canAccessModule, hasPermission } from "@/lib/rbac";

const stats = [
  { label: "Inmobiliarios", value: "12", detail: "+2 este mes", icon: Users, tone: "blue", module: "inmobiliarios" as const },
  { label: "Propiedades", value: "24", detail: "+12% este mes", icon: Building2, tone: "violet", module: "propiedades" as const },
  { label: "Clientes", value: "86", detail: "+8% este mes", icon: UserRound, tone: "amber", module: "clientes" as const },
  { label: "Ocupación", value: "78%", detail: "+6.4% este mes", icon: Home, tone: "emerald", module: "propiedades" as const },
];

const activity = [
  { title: "Nueva propiedad registrada", detail: "Casa en Santa Ana · hace 24 min", icon: Building2, color: "bg-violet-100 text-violet-600" },
  { title: "Cliente actualizado", detail: "María Rodríguez · hace 1 h", icon: UserRound, color: "bg-amber-100 text-amber-600" },
  { title: "Visita confirmada", detail: "Apartamento Escazú · hace 2 h", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-600" },
  { title: "Nuevo inmobiliario", detail: "Carlos Méndez · ayer", icon: Users, color: "bg-blue-100 text-blue-600" },
];

const events = [
  { time: "09:30", title: "Visita a propiedad", detail: "Apartamento en Escazú", color: "bg-blue-500" },
  { time: "11:00", title: "Reunión de equipo", detail: "Sala de juntas · 45 min", color: "bg-violet-500" },
  { time: "15:30", title: "Llamada con cliente", detail: "Seguimiento de compra", color: "bg-amber-500" },
];

const chartValues = [34, 48, 42, 67, 56, 73, 62, 86, 72, 91, 78, 88];
const chartLabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function DashboardPage() {
  const { role } = useRBAC();
  const canManageTeam = hasPermission(role, "inmobiliarios", "manage");

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Lunes, 5 de octubre de 2026</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Buenos días, equipo <span aria-hidden>👋</span></h1>
          <p className="mt-2 text-muted-foreground">Este es el resumen de tu operación inmobiliaria.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
          <CalendarDays size={16} className="text-primary" /> Esta semana
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.filter(({ module }) => canAccessModule(role, module)).map(({ label, value, detail, icon: Icon, tone }) => (
          <Card key={label} className="overflow-hidden">
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
                <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600"><TrendingUp size={13} /> {detail}</p>
              </div>
              <span className={`rounded-xl p-3 ${tone === "blue" ? "bg-blue-50 text-blue-600" : tone === "violet" ? "bg-violet-50 text-violet-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}><Icon size={21} /></span>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>Rendimiento de propiedades</CardTitle><p className="mt-1 text-sm text-muted-foreground">Propiedades activas durante el año</p></div>
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">+18.6%</span>
          </CardHeader>
          <CardContent>
            <div className="flex h-56 items-end gap-2 border-b border-l px-3 pb-0 pt-5 sm:gap-3">
              {chartValues.map((height, index) => (
                <div key={chartLabels[index]} className="group flex h-full flex-1 flex-col justify-end gap-2">
                  <div className="relative w-full rounded-t-md bg-primary/15 transition-colors group-hover:bg-primary/35" style={{ height: `${height}%` }}>
                    <span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 text-[10px] font-semibold group-hover:block">{height}</span>
                  </div>
                  <span className="text-center text-[10px] text-muted-foreground">{chartLabels[index]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>Próximos eventos</CardTitle><p className="mt-1 text-sm text-muted-foreground">Tu agenda de hoy</p></div>
            <CalendarDays size={18} className="text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            {events.map(({ time, title, detail, color }) => (
              <div key={title} className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p></div>
                <span className="text-xs font-semibold text-muted-foreground">{time}</span>
              </div>
            ))}
            <button className="mt-2 flex w-full items-center justify-center gap-1 border-t pt-4 text-sm font-medium text-primary hover:underline">Ver calendario <ChevronRight size={15} /></button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Actividad reciente</CardTitle><p className="mt-1 text-sm text-muted-foreground">Últimos movimientos del equipo</p></div><ArrowUpRight size={18} className="text-muted-foreground" /></CardHeader>
          <CardContent className="divide-y">
            {activity.map(({ title, detail, icon: Icon, color }) => <div key={title} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className={`rounded-lg p-2 ${color}`}><Icon size={17} /></span><div><p className="text-sm font-medium">{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{detail}</p></div></div>)}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Accesos rápidos</CardTitle><p className="mt-1 text-sm text-muted-foreground">Acciones frecuentes</p></CardHeader>
          <CardContent className="space-y-2">
            <Link href="/propiedades" className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-muted">Consultar propiedades <ArrowUpRight size={16} className="text-muted-foreground" /></Link>
            <Link href="/clientes" className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-muted">Consultar clientes <ArrowUpRight size={16} className="text-muted-foreground" /></Link>
            {canManageTeam && <Link href="/inmobiliarios" className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-muted">Gestionar equipo <ArrowUpRight size={16} className="text-muted-foreground" /></Link>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
