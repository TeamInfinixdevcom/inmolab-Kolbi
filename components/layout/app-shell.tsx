"use client";

import { Sidebar } from "./sidebar";
import { usePathname } from "next/navigation";
import { useRBAC } from "@/components/auth/rbac-provider";
import { canAccessModule, type Module } from "@/lib/rbac";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, loading, user } = useRBAC();
  const moduleByPath: Record<string, Module> = {
    "/": "dashboard",
    "/inmobiliarios": "inmobiliarios",
    "/propiedades": "propiedades",
    "/clientes": "clientes",
    "/eventos": "eventos",
    "/actividad": "actividad",
    "/mapa": "mapa",
    "/reportes": "reportes",
    "/condominios": "condominios",
  };
  const currentModule = moduleByPath[pathname];

  useEffect(() => {
    if (!loading && pathname !== "/login" && !user) router.replace("/login");
  }, [loading, pathname, router, user]);

  if (pathname === "/login") return <>{children}</>;
  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="min-h-screen lg:pl-64">
        <div className="mx-auto max-w-7xl p-6 pt-20 lg:p-10">
          {loading ? null : currentModule && !canAccessModule(role, currentModule) ? (
            <section className="rounded-xl border border-dashed p-12 text-center">
              <h1 className="text-2xl font-bold">Acceso restringido</h1>
              <p className="mt-2 text-muted-foreground">Tu rol ({role}) no tiene acceso a este módulo.</p>
            </section>
          ) : children}
        </div>
      </main>
    </div>
  );
}
