"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { Activity, BarChart3, Building2, CalendarDays, Home, LogOut, Map, Menu, Users, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useRBAC } from "@/components/auth/rbac-provider";
import { canAccessModule, type Module } from "@/lib/rbac";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

const navigation = [
  { href: "/", label: "Dashboard", icon: Home, module: "dashboard" },
  { href: "/inmobiliarios", label: "Inmobiliarios", icon: Users, module: "inmobiliarios" },
  { href: "/propiedades", label: "Propiedades", icon: Building2, module: "propiedades" },
  { href: "/eventos", label: "Eventos", icon: CalendarDays, module: "eventos" },
  { href: "/actividad", label: "Actividad", icon: Activity, module: "actividad" },
  { href: "/mapa", label: "Mapa", icon: Map, module: "mapa" },
  { href: "/reportes", label: "Reportes", icon: BarChart3, module: "reportes" },
  { href: "/condominios", label: "Condominios", icon: Building2, module: "condominios" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role } = useRBAC();
  const [open, setOpen] = useState(false);
  const visibleNavigation = navigation.filter(({ module }) => canAccessModule(role, module as Module));

  async function handleSignOut() {
    if (auth) await signOut(auth);
    setOpen(false);
    router.replace("/login");
  }

  return (
    <>
      <button className="fixed left-4 top-4 z-30 rounded-md p-2 hover:bg-muted lg:hidden" onClick={() => setOpen(!open)} aria-label="Abrir menú">
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && <div className="fixed inset-0 z-10 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r bg-card px-4 py-6 transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <Link href="/" className="mb-10 flex items-center gap-2 px-2 text-lg font-semibold" onClick={() => setOpen(false)}>
          <span className="rounded-lg bg-primary p-2 text-primary-foreground"><Building2 size={20} /></span>
          InmoLab <span className="text-primary">Kölbi</span>
        </Link>
        <nav className="space-y-1">
          {visibleNavigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground", pathname === href && "bg-primary/10 text-primary")}>
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
        <p className="mt-8 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Rol: {role}
        </p>
        <button type="button" onClick={() => void handleSignOut()} className="mt-auto flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          <LogOut size={18} /> Cerrar sesión
        </button>
      </aside>
    </>
  );
}
