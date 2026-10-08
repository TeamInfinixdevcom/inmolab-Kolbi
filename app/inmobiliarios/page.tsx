"use client";

import { Edit3, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRBAC } from "@/components/auth/rbac-provider";
import { auth } from "@/lib/firebase";
import { hasPermission, type Role } from "@/lib/rbac";

type ManagedUser = { uid: string; name: string; email: string; role: Role; disabled: boolean };
type UserForm = { name: string; email: string; password: string; role: Role };
const emptyForm: UserForm = { name: "", email: "", password: "", role: "AGENTE" };

async function authHeaders() {
  if (!auth?.currentUser) throw new Error("Sesión no disponible.");
  return { Authorization: `Bearer ${await auth.currentUser.getIdToken()}`, "Content-Type": "application/json" };
}

export default function InmobiliariosPage() {
  const { role } = useRBAC();
  const canManage = hasPermission(role, "inmobiliarios", "manage");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadUsers() {
    try {
      const response = await fetch("/api/users", { headers: await authHeaders() });
      const data = await response.json() as { users?: ManagedUser[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar los usuarios.");
      setUsers(data.users ?? []);
    } catch (loadError) {
      console.error("No se pudieron cargar los usuarios.", loadError);
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canManage) void loadUsers();
    else setLoading(false);
  }, [canManage]);

  function openCreate() {
    setEditingUid(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEdit(user: ManagedUser) {
    setEditingUid(user.uid);
    setForm({ name: user.name, email: user.email, password: "", role: user.role });
    setError("");
    setShowForm(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/users", {
        method: editingUid ? "PATCH" : "POST",
        headers: await authHeaders(),
        body: JSON.stringify(editingUid ? { ...form, uid: editingUid } : form),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar el usuario.");
      setShowForm(false);
      setForm(emptyForm);
      await loadUsers();
    } catch (saveError) {
      console.error("No se pudo guardar el usuario.", saveError);
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el usuario.");
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(user: ManagedUser) {
    if (!window.confirm(`¿Eliminar la cuenta de ${user.name || user.email}?`)) return;
    try {
      const response = await fetch("/api/users", { method: "DELETE", headers: await authHeaders(), body: JSON.stringify({ uid: user.uid }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo eliminar el usuario.");
      await loadUsers();
    } catch (deleteError) {
      console.error("No se pudo eliminar el usuario.", deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el usuario.");
    }
  }

  const visibleUsers = useMemo(() => users.filter((user) => `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(query.toLowerCase())), [query, users]);

  if (!canManage) {
    return <section className="rounded-lg border border-dashed p-10 text-center"><h1 className="text-2xl font-bold">Usuarios</h1><p className="mt-2 text-sm text-muted-foreground">Solo ADMIN puede administrar las cuentas de acceso.</p></section>;
  }

  return <section className="space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-primary">Control de acceso</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Usuarios</h1><p className="mt-2 text-muted-foreground">Solo ADMIN puede crear, editar y eliminar cuentas.</p></div><Button onClick={openCreate}><Plus size={17} className="mr-2" /> Nuevo usuario</Button></header>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {showForm && <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>{editingUid ? "Editar usuario" : "Nuevo usuario"}</CardTitle><Button variant="ghost" size="icon" onClick={() => setShowForm(false)} aria-label="Cerrar formulario"><X size={18} /></Button></CardHeader><CardContent><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Nombre completo<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" /></label><label className="text-sm font-medium">Correo electrónico<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" /></label><label className="text-sm font-medium">Contraseña{editingUid && <span className="font-normal text-muted-foreground"> (vacío = conservar)</span>}<input required={!editingUid} minLength={6} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" /></label><label className="text-sm font-medium">Rol<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal"><option value="AGENTE">AGENTE</option><option value="SUPERVISOR">SUPERVISOR</option><option value="ADMIN">ADMIN</option></select></label><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar usuario"}</Button></div></form></CardContent></Card>}
    <Card><CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Cuentas registradas</CardTitle><p className="mt-1 text-sm text-muted-foreground">{users.length} usuarios</p></div><div className="relative w-full sm:w-64"><Search size={16} className="absolute left-3 top-2.5 text-muted-foreground" /><input aria-label="Buscar usuarios" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar usuario..." className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" /></div></CardHeader><CardContent>{loading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando usuarios...</p> : visibleUsers.length === 0 ? <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No hay usuarios.</p> : <div className="divide-y">{visibleUsers.map((user) => <div key={user.uid} className="flex items-center justify-between gap-3 py-4"><div className="flex items-center gap-3"><span className="rounded-full bg-primary/10 p-2 text-primary"><UserRound size={18} /></span><div><p className="font-semibold">{user.name || "Sin nombre"}</p><p className="text-sm text-muted-foreground">{user.email} · {user.role}{user.disabled ? " · Deshabilitado" : ""}</p></div></div><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(user)} aria-label={`Editar ${user.email}`}><Edit3 size={16} /></Button><Button variant="ghost" size="icon" onClick={() => void removeUser(user)} aria-label={`Eliminar ${user.email}`}><Trash2 size={16} /></Button></div></div>)}</div>}</CardContent></Card>
  </section>;
}
