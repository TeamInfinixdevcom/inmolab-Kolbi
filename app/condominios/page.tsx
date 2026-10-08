"use client";

import { Building2, Edit3, Plus, ToggleLeft, ToggleRight, UserRound, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { collection, doc, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRBAC } from "@/components/auth/rbac-provider";
import { db } from "@/lib/firebase";
import { creationAudit, updateAudit } from "@/lib/firestore-audit";
import { hasPermission, type Role } from "@/lib/rbac";

type DirectoryUser = { uid: string; displayName: string; email: string; role: Role };
type CondominiumStatus = "Activa" | "Inactiva";
type Condominium = {
  id: string;
  name: string;
  administrator: string;
  administratorEmail: string;
  assignedTo: string;
  assignedToName: string;
  assignedToEmail: string;
  status: CondominiumStatus;
  createdBy?: string;
  createdByRole?: Role;
};
type CondominiumForm = Omit<Condominium, "id" | "createdBy" | "createdByRole" | "assignedToName" | "assignedToEmail">;
const emptyForm: CondominiumForm = { name: "", administrator: "", administratorEmail: "", assignedTo: "", status: "Activa" };

export default function CondominiosPage() {
  const { role, user } = useRBAC();
  const canCreate = hasPermission(role, "condominios", "create");
  const canEditAll = role === "ADMIN";
  const [items, setItems] = useState<Condominium[]>([]);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [form, setForm] = useState<CondominiumForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const firestore = db;
    if (!firestore || !user) { setLoading(false); return; }
    try {
        const condominiumsQuery = collection(firestore, "condominios");
      const [snapshot, userSnapshot] = await Promise.all([
        getDocs(condominiumsQuery),
        role === "ADMIN" ? getDocs(collection(firestore, "users")) : Promise.resolve(null),
      ]);
      const loaded = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          ...data,
          status: data.status === "Inactiva" ? "Inactiva" : "Activa",
        } as Condominium;
      });
      if (role === "ADMIN" && userSnapshot) {
        const directory = userSnapshot.docs.map((item) => item.data()).filter((data): data is DirectoryUser =>
          typeof data.uid === "string" && typeof data.email === "string" && (data.role === "ADMIN" || data.role === "SUPERVISOR" || data.role === "AGENTE"),
        ).sort((a, b) => a.displayName.localeCompare(b.displayName));
        setUsers(directory);
      }
      setItems(loaded);
    } catch (loadError) {
      console.error("No se pudieron cargar los condominios.", loadError);
      setError("No se pudieron cargar los condominios. Verifica las reglas y la configuración de Firebase.");
    } finally {
      setLoading(false);
    }
  }, [role, user]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, assignedTo: role === "AGENTE" ? user?.uid ?? "" : "" });
    setError("");
    setShowForm(true);
  }

  function openEdit(item: Condominium) {
    setEditingId(item.id);
    setForm({ name: item.name, administrator: item.administrator, administratorEmail: item.administratorEmail, assignedTo: item.assignedTo, status: item.status });
    setError("");
    setShowForm(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const firestore = db;
    if (!firestore || !user) { setError("Firebase no está configurado."); return; }
    const assignedTo = role === "AGENTE" && !editingId ? user.uid : form.assignedTo;
    if (!form.name.trim() || !assignedTo) { setError("El nombre y el usuario responsable son obligatorios."); return; }
    const assignee = users.find((item) => item.uid === assignedTo);
    if (!assignee && canEditAll) { setError("Selecciona un usuario registrado."); return; }
    setSaving(true);
    setError("");
    try {
      if (!editingId) {
        const condominiumRef = doc(collection(firestore, "condominios"));
        const historyRef = doc(collection(condominiumRef, "historial"));
        const batch = writeBatch(firestore);
        batch.set(condominiumRef, {
          ...form,
          assignedTo,
          name: form.name.trim(),
          administrator: form.administrator.trim(),
          administratorEmail: form.administratorEmail.trim(),
          status: form.status,
          assignedToName: assignee?.displayName ?? user.displayName ?? user.email ?? "Usuario actual",
          assignedToEmail: assignee?.email ?? user.email ?? "",
          ...creationAudit(user.uid),
          createdByRole: role,
        });
        batch.set(historyRef, {
          action: "assignment_changed",
          previousAssignedTo: null,
          assignedTo,
          changedBy: user.uid,
          timestamp: serverTimestamp(),
        });
        await batch.commit();
      } else {
        const previous = items.find((item) => item.id === editingId);
        const assignmentChanged = previous?.assignedTo !== form.assignedTo;
        const batch = writeBatch(firestore);
        batch.update(doc(firestore, "condominios", editingId), {
          ...form,
          assignedTo,
          name: form.name.trim(),
          administrator: form.administrator.trim(),
          administratorEmail: form.administratorEmail.trim(),
          status: form.status,
          ...(canEditAll ? {
            assignedToName: assignee?.displayName ?? "",
            assignedToEmail: assignee?.email ?? "",
          } : {}),
          ...updateAudit(user.uid),
        });
        if (canEditAll && assignmentChanged) {
          batch.set(doc(collection(firestore, "condominios", editingId, "historial")), {
            action: "assignment_changed",
            previousAssignedTo: previous?.assignedTo ?? null,
            assignedTo: form.assignedTo,
            changedBy: user.uid,
            timestamp: serverTimestamp(),
          });
        }
        await batch.commit();
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (saveError) {
      console.error("No se pudo guardar el condominio.", saveError);
      setError("No se pudo guardar el condominio. Verifica los permisos de Firestore.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item: Condominium) {
    const firestore = db;
    const canEditItem = canEditAll || (role === "AGENTE" && (item.createdBy === user?.uid || (item.assignedTo === user?.uid && (item.createdByRole === "ADMIN" || item.createdByRole === "SUPERVISOR"))));
    if (!firestore || !user || !canEditItem) return;
    const status: CondominiumStatus = item.status === "Activa" ? "Inactiva" : "Activa";
    try {
      await writeBatch(firestore).update(doc(firestore, "condominios", item.id), {
        status,
        ...updateAudit(user.uid),
      }).commit();
      setItems((current) => current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, status } : currentItem));
    } catch (statusError) {
      console.error("No se pudo cambiar el estado del condominio.", statusError);
      setError("No se pudo cambiar el estado. Verifica los permisos de Firestore.");
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-medium text-primary">Gestión administrativa</p><h1 className="mt-2 text-3xl font-bold">Condominios</h1><p className="mt-2 text-muted-foreground">Consulta y administra la asignación de condominios.</p></div>
        {canCreate && <Button onClick={openCreate}><Plus size={17} className="mr-2" /> Nuevo condominio</Button>}
      </header>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {showForm && <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>{editingId ? "Editar condominio" : "Nuevo condominio"}</CardTitle><Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X size={18} /></Button></CardHeader><CardContent><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Nombre del condominio<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" /></label>
        <label className="text-sm font-medium">Administrador<input value={form.administrator} onChange={(event) => setForm({ ...form, administrator: event.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" /></label>
        <label className="text-sm font-medium">Email del administrador<input type="email" value={form.administratorEmail} onChange={(event) => setForm({ ...form, administratorEmail: event.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" /></label>
        <label className="text-sm font-medium">Estado<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CondominiumStatus })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal"><option value="Activa">Activa</option><option value="Inactiva">Inactiva</option></select></label>
        <label className="text-sm font-medium">Usuario responsable{role === "AGENTE" && !editingId ? <input value={user?.displayName ?? user?.email ?? "Usuario actual"} disabled className="mt-2 h-10 w-full rounded-md border bg-muted px-3 font-normal" /> : <select required disabled={!canEditAll} value={form.assignedTo} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal"><option value="">Seleccionar usuario</option>{users.map((item) => <option key={item.uid} value={item.uid}>{item.displayName} — {item.role}</option>)}</select>}</label>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar condominio"}</Button></div>
      </form></CardContent></Card>}
      <Card><CardHeader><CardTitle>Todos los condominios</CardTitle></CardHeader><CardContent>{loading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando condominios...</p> : items.length === 0 ? <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No hay condominios registrados.</p> : <div className="grid gap-4 md:grid-cols-2">{items.map((item) => { const canEditItem = canEditAll || (role === "AGENTE" && (item.createdBy === user?.uid || (item.assignedTo === user?.uid && (item.createdByRole === "ADMIN" || item.createdByRole === "SUPERVISOR")))); return <article key={item.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Building2 size={18} /></span><div><h2 className="font-semibold">{item.name}</h2><p className="text-sm text-muted-foreground">{item.administrator || "Sin administrador"}{item.administratorEmail && ` · ${item.administratorEmail}`}</p></div></div>{canEditItem && <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => void toggleStatus(item)} aria-label={`${item.status === "Activa" ? "Inactivar" : "Activar"} ${item.name}`}>{item.status === "Activa" ? <ToggleRight size={20} className="text-emerald-600" /> : <ToggleLeft size={20} />}</Button><Button variant="ghost" size="icon" onClick={() => openEdit(item)} aria-label={`Editar ${item.name}`}><Edit3 size={16} /></Button></div>}</div><div className="mt-4 flex items-center justify-between text-sm"><p className="flex items-center gap-2 text-muted-foreground"><UserRound size={15} /> Responsable: {item.assignedToName || item.assignedToEmail || "Sin datos"}</p><span className={`rounded-full px-2 py-1 text-xs font-medium ${item.status === "Activa" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{item.status}</span></div></article>; })}</div>}</CardContent></Card>
    </section>
  );
}
