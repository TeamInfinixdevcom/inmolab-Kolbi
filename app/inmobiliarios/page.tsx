"use client";

import {
  Check,
  Edit3,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRBAC } from "@/components/auth/rbac-provider";
import { db } from "@/lib/firebase";
import { hasPermission } from "@/lib/rbac";
import { ImportExcel } from "@/components/inmobiliarios/import-excel";

type Inmobiliario = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "Activo" | "Inactivo";
  createdAt?: string;
};

type FormValues = Omit<Inmobiliario, "id" | "createdAt">;

const emptyForm: FormValues = { name: "", email: "", phone: "", status: "Activo" };
const collectionName = "inmobiliarios";

export default function InmobiliariosPage() {
  const { role } = useRBAC();
  const canCreate = hasPermission(role, "inmobiliarios", "create");
  const canUpdate = hasPermission(role, "inmobiliarios", "update");
  const canDelete = hasPermission(role, "inmobiliarios", "delete");
  const canImport = role === "ADMIN";
  const [items, setItems] = useState<Inmobiliario[]>([]);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadInmobiliarios() {
      if (!db) {
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDocs(collection(db, collectionName));
        const loaded = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Inmobiliario[];
        loaded.sort((a, b) => a.name.localeCompare(b.name));
        if (active) setItems(loaded);
      } catch (loadError) {
        console.error("No se pudieron cargar los inmobiliarios.", loadError);
        if (active) setError("No se pudieron cargar los inmobiliarios. Revisa la configuración y las reglas de Firestore.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInmobiliarios();
    return () => {
      active = false;
    };
  }, []);

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEditForm(item: Inmobiliario) {
    setEditingId(item.id);
    setForm({ name: item.name, email: item.email, phone: item.phone, status: item.status });
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    if (!saving) setShowForm(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) {
      setError("Firebase no está configurado. Completa las variables de entorno para guardar cambios.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await updateDoc(doc(db, collectionName, editingId), form);
        setItems((current) => current.map((item) => item.id === editingId ? { ...item, ...form } : item));
      } else {
        const createdAt = new Date().toISOString();
        const created = await addDoc(collection(db, collectionName), { ...form, createdAt });
        setItems((current) => [...current, { ...form, createdAt, id: created.id }].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
    } catch (saveError) {
      console.error("No se pudo guardar el inmobiliario.", saveError);
      setError("No se pudo guardar el inmobiliario. Verifica los permisos de Firestore.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: Inmobiliario) {
    if (!db || !window.confirm(`¿Eliminar a ${item.name}?`)) return;

    try {
      await deleteDoc(doc(db, collectionName, item.id));
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    } catch (deleteError) {
      console.error("No se pudo eliminar el inmobiliario.", deleteError);
      setError("No se pudo eliminar el inmobiliario. Verifica los permisos de Firestore.");
    }
  }

  const visibleItems = items.filter((item) =>
    `${item.name} ${item.email} ${item.phone}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Equipo comercial</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Inmobiliarios</h1>
          <p className="mt-2 text-muted-foreground">Administra los integrantes de tu equipo inmobiliario.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canImport && <ImportExcel onComplete={() => window.location.reload()} />}
          {canCreate && <Button onClick={openCreateForm}><Plus size={17} className="mr-2" /> Nuevo inmobiliario</Button>}
        </div>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{editingId ? "Editar inmobiliario" : "Nuevo inmobiliario"}</CardTitle>
            <Button variant="ghost" size="icon" onClick={closeForm} aria-label="Cerrar formulario"><X size={18} /></Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">Nombre completo<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Correo electrónico<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Teléfono<input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Estado<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as FormValues["status"] })} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary"><option>Activo</option><option>Inactivo</option></select></label>
              <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar inmobiliario"}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>Equipo registrado</CardTitle><p className="mt-1 text-sm text-muted-foreground">{items.length} inmobiliarios en total</p></div>
          <div className="relative w-full sm:w-64"><Search size={16} className="absolute left-3 top-2.5 text-muted-foreground" /><input aria-label="Buscar inmobiliarios" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre..." className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary" /></div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando inmobiliarios...</p> : !db ? <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Firebase aún no está conectado. Configura las variables de entorno para cargar y administrar datos reales.</p> : visibleItems.length === 0 ? <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No hay inmobiliarios que mostrar.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="pb-3 font-medium">Inmobiliario</th><th className="pb-3 font-medium">Contacto</th><th className="pb-3 font-medium">Estado</th>{(canUpdate || canDelete) && <th className="pb-3 text-right font-medium">Acciones</th>}</tr></thead><tbody className="divide-y">{visibleItems.map((item) => <tr key={item.id}><td className="py-4"><div className="flex items-center gap-3"><span className="rounded-full bg-primary/10 p-2 text-primary"><UserRound size={17} /></span><span className="font-medium">{item.name}</span></div></td><td className="py-4 text-muted-foreground"><div className="space-y-1"><p className="flex items-center gap-2"><Mail size={14} />{item.email}</p><p className="flex items-center gap-2"><Phone size={14} />{item.phone}</p></div></td><td className="py-4"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${item.status === "Activo" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{item.status === "Activo" && <Check size={12} />}{item.status}</span></td>{(canUpdate || canDelete) && <td className="py-4 text-right"><div className="flex justify-end gap-1">{canUpdate && <Button variant="ghost" size="icon" onClick={() => openEditForm(item)} aria-label={`Editar ${item.name}`}><Edit3 size={16} /></Button>}{canDelete && <Button variant="ghost" size="icon" onClick={() => void handleDelete(item)} aria-label={`Eliminar ${item.name}`}><Trash2 size={16} className="text-red-500" /></Button>}</div></td>}</tr>)}</tbody></table></div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
