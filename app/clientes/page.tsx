"use client";

import { Building2, Check, Edit3, Eye, Mail, MapPin, Phone, Plus, Search, ToggleLeft, ToggleRight, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRBAC } from "@/components/auth/rbac-provider";
import { db } from "@/lib/firebase";
import { hasPermission } from "@/lib/rbac";
import { creationAudit, updateAudit } from "@/lib/firestore-audit";

type ClientStatus = "Activo" | "Inactivo";
type ClientType = "Comprador" | "Vendedor" | "Arrendatario";
type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: ClientType;
  status: ClientStatus;
  propertyId: string;
  propertyTitle: string;
  inmobiliarioId: string;
  inmobiliarioName: string;
  notes: string;
  createdAt?: string;
  createdBy?: string;
};
type PropertyOption = { id: string; title: string };
type AgentOption = { id: string; name: string };
type ClientForm = Omit<Client, "id" | "createdAt" | "propertyTitle" | "inmobiliarioName">;

const emptyForm: ClientForm = {
  name: "", email: "", phone: "", type: "Comprador", status: "Activo",
  propertyId: "", inmobiliarioId: "", notes: "",
};

export default function ClientesPage() {
  const { role, user } = useRBAC();
  const canCreate = hasPermission(role, "clientes", "create");
  const canUpdate = hasPermission(role, "clientes", "update");
  const [clients, setClients] = useState<Client[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Todos" | ClientStatus>("Todos");
  const [typeFilter, setTypeFilter] = useState<"Todos" | ClientType>("Todos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadData() {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const [clientSnapshot, propertySnapshot, agentSnapshot] = await Promise.all([
          getDocs(collection(db, "clientes")),
          getDocs(collection(db, "propiedades")),
          getDocs(collection(db, "inmobiliarios")),
        ]);
        const loadedProperties = propertySnapshot.docs.map((item) => ({ id: item.id, title: String(item.data().title ?? "") }));
        const loadedAgents = agentSnapshot.docs.map((item) => ({ id: item.id, name: String(item.data().name ?? "") }));
        const loadedClients = clientSnapshot.docs.map((item) => {
          const data = item.data();
          const propertyId = String(data.propertyId ?? "");
          const inmobiliarioId = String(data.inmobiliarioId ?? "");
          return {
            id: item.id,
            name: String(data.name ?? ""),
            email: String(data.email ?? ""),
            phone: String(data.phone ?? ""),
            type: data.type === "Vendedor" || data.type === "Arrendatario" ? data.type : "Comprador",
            status: data.status === "Inactivo" ? "Inactivo" : "Activo",
            propertyId,
            propertyTitle: loadedProperties.find((property) => property.id === propertyId)?.title ?? String(data.propertyTitle ?? "Sin asignar"),
            inmobiliarioId,
            inmobiliarioName: loadedAgents.find((agent) => agent.id === inmobiliarioId)?.name ?? String(data.inmobiliarioName ?? "Sin asignar"),
            notes: String(data.notes ?? ""),
            createdAt: String(data.createdAt ?? ""),
            createdBy: typeof data.createdBy === "string" ? data.createdBy : undefined,
          } as Client;
        });
        if (active) {
          setClients(loadedClients);
          setProperties(loadedProperties);
          setAgents(loadedAgents);
        }
      } catch (loadError) {
        console.error("No se pudieron cargar los clientes.", loadError);
        if (active) setError("No se pudieron cargar los clientes. Revisa la configuración y las reglas de Firestore.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadData();
    return () => { active = false; };
  }, []);

  const filteredClients = useMemo(() => clients.filter((client) => {
    const matchesQuery = `${client.name} ${client.email} ${client.phone} ${client.propertyTitle} ${client.inmobiliarioName}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (statusFilter === "Todos" || client.status === statusFilter) && (typeFilter === "Todos" || client.type === typeFilter);
  }), [clients, query, statusFilter, typeFilter]);

  function updateField<K extends keyof ClientForm>(field: K, value: ClientForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setSelected(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(client: Client) {
    setEditingId(client.id);
    setForm({
      name: client.name, email: client.email, phone: client.phone, type: client.type,
      status: client.status, propertyId: client.propertyId, inmobiliarioId: client.inmobiliarioId, notes: client.notes,
    });
    setSelected(null);
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) {
      setError("Firebase no está configurado. Completa las variables de entorno para guardar cambios.");
      return;
    }
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError("Completa nombre, correo y teléfono.");
      return;
    }
    setSaving(true);
    setError("");
    const property = properties.find((item) => item.id === form.propertyId);
    const agent = agents.find((item) => item.id === form.inmobiliarioId);
    const payload = {
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      propertyTitle: property?.title ?? "Sin asignar",
      inmobiliarioName: agent?.name ?? "Sin asignar",
    };
    try {
      if (editingId) {
        await updateDoc(doc(db, "clientes", editingId), { ...payload, ...updateAudit(user?.uid ?? "") });
        setClients((current) => current.map((client) => client.id === editingId ? { ...client, ...payload } : client));
      } else {
        const created = await addDoc(collection(db, "clientes"), { ...payload, ...creationAudit(user?.uid ?? "") });
        setClients((current) => [{ ...payload, id: created.id, createdBy: user?.uid }, ...current]);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (saveError) {
      console.error("No se pudo guardar el cliente.", saveError);
      setError("No se pudo guardar el cliente. Verifica los permisos de Firestore.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(client: Client) {
    if (!db || !canUpdate) return;
    const nextStatus: ClientStatus = client.status === "Activo" ? "Inactivo" : "Activo";
    try {
      await updateDoc(doc(db, "clientes", client.id), { status: nextStatus, ...updateAudit(user?.uid ?? "") });
      setClients((current) => current.map((item) => item.id === client.id ? { ...item, status: nextStatus } : item));
      if (selected?.id === client.id) setSelected({ ...client, status: nextStatus });
    } catch (statusError) {
      console.error("No se pudo cambiar el estado del cliente.", statusError);
      setError("No se pudo cambiar el estado. Verifica los permisos de Firestore.");
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-medium text-primary">Relaciones comerciales</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Clientes</h1><p className="mt-2 text-muted-foreground">Centraliza y da seguimiento a tus clientes.</p></div>
        {canCreate && <Button onClick={openCreate}><Plus size={17} className="mr-2" /> Nuevo cliente</Button>}
      </header>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {showForm && <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>{editingId ? "Editar cliente" : "Nuevo cliente"}</CardTitle><Button variant="ghost" size="icon" onClick={() => setShowForm(false)} aria-label="Cerrar formulario"><X size={18} /></Button></CardHeader><CardContent><form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium lg:col-span-2">Nombre completo<input required value={form.name} onChange={(event) => updateField("name", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
        <label className="text-sm font-medium">Tipo<select value={form.type} onChange={(event) => updateField("type", event.target.value as ClientType)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary"><option>Comprador</option><option>Vendedor</option><option>Arrendatario</option></select></label>
        <label className="text-sm font-medium">Correo electrónico<input required type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
        <label className="text-sm font-medium">Teléfono<input required value={form.phone} onChange={(event) => updateField("phone", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
        <label className="text-sm font-medium">Estado<select value={form.status} onChange={(event) => updateField("status", event.target.value as ClientStatus)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary"><option>Activo</option><option>Inactivo</option></select></label>
        <label className="text-sm font-medium">Propiedad asociada<select value={form.propertyId} onChange={(event) => updateField("propertyId", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary"><option value="">Sin asignar</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
        <label className="text-sm font-medium">Inmobiliario responsable<select value={form.inmobiliarioId} onChange={(event) => updateField("inmobiliarioId", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary"><option value="">Sin asignar</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>
        <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Notas<textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} rows={3} className="mt-2 w-full rounded-md border bg-background px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
        <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cliente"}</Button></div>
      </form></CardContent></Card>}

      <Card><CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Clientes registrados</CardTitle><p className="mt-1 text-sm text-muted-foreground">{clients.length} clientes en total</p></div><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-muted-foreground" /><input aria-label="Buscar clientes" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente..." className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary sm:w-52" /></div><select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"><option>Todos</option><option>Activo</option><option>Inactivo</option></select><select aria-label="Filtrar por tipo" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"><option>Todos</option><option>Comprador</option><option>Vendedor</option><option>Arrendatario</option></select></div></CardHeader><CardContent>
        {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando clientes...</p> : !db ? <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Firebase aún no está conectado. Configura las variables de entorno para cargar y administrar datos reales.</p> : filteredClients.length === 0 ? <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No hay clientes que coincidan con los filtros.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="pb-3 font-medium">Cliente</th><th className="pb-3 font-medium">Contacto</th><th className="pb-3 font-medium">Asociaciones</th><th className="pb-3 font-medium">Estado</th><th className="pb-3 text-right font-medium">Acciones</th></tr></thead><tbody className="divide-y">{filteredClients.map((client) => { const canEditClient = canUpdate && (role !== "AGENTE" || client.createdBy === user?.uid); return <tr key={client.id}><td className="py-4"><div className="flex items-center gap-3"><span className="rounded-full bg-primary/10 p-2 text-primary"><UserRound size={17} /></span><div><p className="font-medium">{client.name}</p><p className="text-xs text-muted-foreground">{client.type}</p></div></div></td><td className="py-4 text-muted-foreground"><div className="space-y-1"><p className="flex items-center gap-2"><Mail size={14} />{client.email}</p><p className="flex items-center gap-2"><Phone size={14} />{client.phone}</p></div></td><td className="py-4 text-xs text-muted-foreground"><p className="flex max-w-44 items-center gap-1 truncate"><Building2 size={13} />{client.propertyTitle}</p><p className="mt-1 flex max-w-44 items-center gap-1 truncate"><UserRound size={13} />{client.inmobiliarioName}</p></td><td className="py-4"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${client.status === "Activo" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{client.status === "Activo" && <Check size={12} />}{client.status}</span></td><td className="py-4 text-right"><div className="flex justify-end gap-1"><Button variant="outline" size="sm" onClick={() => setSelected(client)}><Eye size={14} className="mr-1.5" /> Ver</Button>{canEditClient && <><Button variant="ghost" size="icon" onClick={() => openEdit(client)} aria-label={`Editar ${client.name}`}><Edit3 size={16} /></Button><Button variant="ghost" size="icon" onClick={() => void toggleStatus(client)} aria-label={client.status === "Activo" ? "Desactivar cliente" : "Activar cliente"}>{client.status === "Activo" ? <ToggleRight size={20} className="text-emerald-600" /> : <ToggleLeft size={20} />}</Button></>}</div></td></tr>; })}</tbody></table></div>}
      </CardContent></Card>

      {selected && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Detalle del cliente"><Card className="max-h-[90vh] w-full max-w-xl overflow-y-auto"><CardHeader className="flex-row items-start justify-between"><div><p className="text-sm text-primary">{selected.type}</p><CardTitle className="mt-2 text-2xl">{selected.name}</CardTitle><p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground"><MapPin size={15} />Cliente asociado a la operación inmobiliaria</p></div><Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Cerrar detalle"><X size={18} /></Button></CardHeader><CardContent><div className="space-y-3 text-sm"><p className="flex items-center gap-2"><Mail size={16} className="text-muted-foreground" />{selected.email}</p><p className="flex items-center gap-2"><Phone size={16} className="text-muted-foreground" />{selected.phone}</p><p className="flex items-center gap-2"><Building2 size={16} className="text-muted-foreground" />Propiedad: <strong>{selected.propertyTitle}</strong></p><p className="flex items-center gap-2"><UserRound size={16} className="text-muted-foreground" />Inmobiliario: <strong>{selected.inmobiliarioName}</strong></p></div><p className="mt-6 whitespace-pre-wrap border-t pt-4 text-sm text-muted-foreground">{selected.notes || "Sin notas registradas."}</p></CardContent></Card></div>}
    </section>
  );
}
