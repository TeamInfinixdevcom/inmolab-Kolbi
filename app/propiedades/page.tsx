"use client";

import {
  Bath,
  BedDouble,
  Building2,
  Check,
  Edit3,
  Eye,
  MapPin,
  Maximize2,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRBAC } from "@/components/auth/rbac-provider";
import { db } from "@/lib/firebase";
import { hasPermission } from "@/lib/rbac";

type PropertyStatus = "Activa" | "Inactiva";
type PropertyOperation = "Venta" | "Alquiler";

type Property = {
  id: string;
  title: string;
  type: string;
  operation: PropertyOperation;
  price: number;
  city: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  status: PropertyStatus;
  inmobiliarioId: string;
  inmobiliarioName: string;
  description: string;
  createdAt?: string;
};

type Inmobiliario = { id: string; name: string };
type PropertyForm = Omit<Property, "id" | "createdAt" | "inmobiliarioName">;

const emptyForm: PropertyForm = {
  title: "",
  type: "Casa",
  operation: "Venta",
  price: 0,
  city: "",
  address: "",
  bedrooms: 0,
  bathrooms: 0,
  area: 0,
  status: "Activa",
  inmobiliarioId: "",
  description: "",
};

const propertyCollection = "propiedades";

export default function PropiedadesPage() {
  const { role } = useRBAC();
  const canCreate = hasPermission(role, "propiedades", "create");
  const canUpdate = hasPermission(role, "propiedades", "update");
  const [properties, setProperties] = useState<Property[]>([]);
  const [inmobiliarios, setInmobiliarios] = useState<Inmobiliario[]>([]);
  const [form, setForm] = useState<PropertyForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Property | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Todas" | PropertyStatus>("Todas");
  const [operationFilter, setOperationFilter] = useState<"Todas" | PropertyOperation>("Todas");
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
        const [propertySnapshot, agentSnapshot] = await Promise.all([
          getDocs(collection(db, propertyCollection)),
          getDocs(collection(db, "inmobiliarios")),
        ]);
        const agents = agentSnapshot.docs.map((item) => ({ id: item.id, name: String(item.data().name ?? "") }));
        const loaded = propertySnapshot.docs.map((item) => {
          const data = item.data();
          const inmobiliarioId = String(data.inmobiliarioId ?? "");
          return {
            id: item.id,
            title: String(data.title ?? ""),
            type: String(data.type ?? "Casa"),
            operation: data.operation === "Alquiler" ? "Alquiler" : "Venta",
            price: Number(data.price ?? 0),
            city: String(data.city ?? ""),
            address: String(data.address ?? ""),
            bedrooms: Number(data.bedrooms ?? 0),
            bathrooms: Number(data.bathrooms ?? 0),
            area: Number(data.area ?? 0),
            status: data.status === "Inactiva" ? "Inactiva" : "Activa",
            inmobiliarioId,
            inmobiliarioName: agents.find((agent) => agent.id === inmobiliarioId)?.name ?? String(data.inmobiliarioName ?? "Sin asignar"),
            description: String(data.description ?? ""),
            createdAt: String(data.createdAt ?? ""),
          } as Property;
        });
        if (active) {
          setInmobiliarios(agents);
          setProperties(loaded);
        }
      } catch (loadError) {
        console.error("No se pudieron cargar las propiedades.", loadError);
        if (active) setError("No se pudieron cargar las propiedades. Revisa la configuración y las reglas de Firestore.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadData();
    return () => { active = false; };
  }, []);

  const filteredProperties = useMemo(() => properties.filter((property) => {
    const matchesQuery = `${property.title} ${property.city} ${property.type} ${property.inmobiliarioName}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (statusFilter === "Todas" || property.status === statusFilter) && (operationFilter === "Todas" || property.operation === operationFilter);
  }), [operationFilter, properties, query, statusFilter]);

  function updateField<K extends keyof PropertyForm>(field: K, value: PropertyForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setSelected(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(property: Property) {
    setEditingId(property.id);
    setForm({
      title: property.title,
      type: property.type,
      operation: property.operation,
      price: property.price,
      city: property.city,
      address: property.address,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      area: property.area,
      status: property.status,
      inmobiliarioId: property.inmobiliarioId,
      description: property.description,
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
    if (!form.title.trim() || !form.city.trim() || form.price <= 0 || form.area <= 0) {
      setError("Completa título, ciudad, precio y área con valores válidos.");
      return;
    }
    setSaving(true);
    setError("");
    const agent = inmobiliarios.find((item) => item.id === form.inmobiliarioId);
    const payload = { ...form, title: form.title.trim(), city: form.city.trim(), inmobiliarioName: agent?.name ?? "Sin asignar" };
    try {
      if (editingId) {
        await updateDoc(doc(db, propertyCollection, editingId), payload);
        setProperties((current) => current.map((property) => property.id === editingId ? { ...property, ...payload } : property));
      } else {
        const createdAt = new Date().toISOString();
        const created = await addDoc(collection(db, propertyCollection), { ...payload, createdAt });
        setProperties((current) => [{ ...payload, createdAt, id: created.id }, ...current]);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (saveError) {
      console.error("No se pudo guardar la propiedad.", saveError);
      setError("No se pudo guardar la propiedad. Verifica los permisos de Firestore.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(property: Property) {
    if (!db || !canUpdate) return;
    const nextStatus: PropertyStatus = property.status === "Activa" ? "Inactiva" : "Activa";
    try {
      await updateDoc(doc(db, propertyCollection, property.id), { status: nextStatus });
      setProperties((current) => current.map((item) => item.id === property.id ? { ...item, status: nextStatus } : item));
      if (selected?.id === property.id) setSelected({ ...property, status: nextStatus });
    } catch (statusError) {
      console.error("No se pudo cambiar el estado de la propiedad.", statusError);
      setError("No se pudo cambiar el estado. Verifica los permisos de Firestore.");
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-medium text-primary">Inventario inmobiliario</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Propiedades</h1><p className="mt-2 text-muted-foreground">Consulta y organiza tu inventario de propiedades.</p></div>
        {canCreate && <Button onClick={openCreate}><Plus size={17} className="mr-2" /> Nueva propiedad</Button>}
      </header>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {showForm && <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>{editingId ? "Editar propiedad" : "Nueva propiedad"}</CardTitle><Button variant="ghost" size="icon" onClick={() => setShowForm(false)} aria-label="Cerrar formulario"><X size={18} /></Button></CardHeader><CardContent><form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm font-medium lg:col-span-2">Título<input required value={form.title} onChange={(event) => updateField("title", event.target.value)} placeholder="Casa moderna en Escazú" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
        <label className="text-sm font-medium">Tipo<select value={form.type} onChange={(event) => updateField("type", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary"><option>Casa</option><option>Apartamento</option><option>Condominio</option><option>Terreno</option><option>Local comercial</option></select></label>
        <label className="text-sm font-medium">Operación<select value={form.operation} onChange={(event) => updateField("operation", event.target.value as PropertyOperation)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary"><option>Venta</option><option>Alquiler</option></select></label>
        <label className="text-sm font-medium">Precio<input required min="1" type="number" value={form.price || ""} onChange={(event) => updateField("price", Number(event.target.value))} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
        <label className="text-sm font-medium">Área (m²)<input required min="1" type="number" value={form.area || ""} onChange={(event) => updateField("area", Number(event.target.value))} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
        <label className="text-sm font-medium">Ciudad<input required value={form.city} onChange={(event) => updateField("city", event.target.value)} placeholder="San José" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
        <label className="text-sm font-medium lg:col-span-2">Dirección<input value={form.address} onChange={(event) => updateField("address", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
        <label className="text-sm font-medium">Inmobiliario<select value={form.inmobiliarioId} onChange={(event) => updateField("inmobiliarioId", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary"><option value="">Sin asignar</option>{inmobiliarios.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>
        <label className="text-sm font-medium">Habitaciones<input min="0" type="number" value={form.bedrooms} onChange={(event) => updateField("bedrooms", Number(event.target.value))} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
        <label className="text-sm font-medium">Baños<input min="0" type="number" value={form.bathrooms} onChange={(event) => updateField("bathrooms", Number(event.target.value))} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
        <label className="text-sm font-medium">Estado<select value={form.status} onChange={(event) => updateField("status", event.target.value as PropertyStatus)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary"><option>Activa</option><option>Inactiva</option></select></label>
        <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Descripción<textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} rows={3} className="mt-2 w-full rounded-md border bg-background px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
        <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar propiedad"}</Button></div>
      </form></CardContent></Card>}

      <Card><CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Inventario</CardTitle><p className="mt-1 text-sm text-muted-foreground">{properties.length} propiedades registradas</p></div><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-muted-foreground" /><input aria-label="Buscar propiedades" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar propiedad..." className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary sm:w-52" /></div><select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"><option>Todas</option><option>Activa</option><option>Inactiva</option></select><select aria-label="Filtrar por operación" value={operationFilter} onChange={(event) => setOperationFilter(event.target.value as typeof operationFilter)} className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"><option>Todas</option><option>Venta</option><option>Alquiler</option></select></div></CardHeader><CardContent>
        {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando propiedades...</p> : !db ? <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Firebase aún no está conectado. Configura las variables de entorno para cargar y administrar datos reales.</p> : filteredProperties.length === 0 ? <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No hay propiedades que coincidan con los filtros.</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredProperties.map((property) => <article key={property.id} className="rounded-xl border p-4 transition-shadow hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Building2 size={18} /></span><div><h2 className="font-semibold">{property.title}</h2><p className="text-xs text-muted-foreground">{property.type} · {property.operation}</p></div></div><span className={`rounded-full px-2 py-1 text-[11px] font-medium ${property.status === "Activa" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{property.status}</span></div><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"><span className="flex items-center gap-1"><MapPin size={13} />{property.city}</span><span className="flex items-center gap-1"><Maximize2 size={13} />{property.area} m²</span><span className="flex items-center gap-1"><BedDouble size={13} />{property.bedrooms}</span><span className="flex items-center gap-1"><Bath size={13} />{property.bathrooms}</span></div><p className="mt-4 text-lg font-bold">₡{property.price.toLocaleString("es-CR")}</p><p className="mt-1 truncate text-xs text-muted-foreground">Asignada a: {property.inmobiliarioName}</p><div className="mt-4 flex gap-2 border-t pt-3"><Button variant="outline" size="sm" onClick={() => setSelected(property)}><Eye size={14} className="mr-1.5" /> Ver detalle</Button>{canUpdate && <><Button variant="ghost" size="sm" onClick={() => openEdit(property)}><Edit3 size={14} className="mr-1.5" /> Editar</Button><Button variant="ghost" size="icon" onClick={() => void toggleStatus(property)} aria-label={property.status === "Activa" ? "Desactivar propiedad" : "Activar propiedad"}>{property.status === "Activa" ? <ToggleRight size={20} className="text-emerald-600" /> : <ToggleLeft size={20} />}</Button></>}</div></article>)}</div>}
      </CardContent></Card>

      {selected && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Detalle de propiedad"><Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto"><CardHeader className="flex-row items-start justify-between"><div><p className="text-sm text-primary">{selected.type} · {selected.operation}</p><CardTitle className="mt-2 text-2xl">{selected.title}</CardTitle><p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground"><MapPin size={15} />{selected.address ? `${selected.address}, ` : ""}{selected.city}</p></div><Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Cerrar detalle"><X size={18} /></Button></CardHeader><CardContent><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Precio</p><p className="mt-1 font-semibold">₡{selected.price.toLocaleString("es-CR")}</p></div><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Área</p><p className="mt-1 font-semibold">{selected.area} m²</p></div><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Habitaciones</p><p className="mt-1 font-semibold">{selected.bedrooms}</p></div><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Baños</p><p className="mt-1 font-semibold">{selected.bathrooms}</p></div></div><p className="mt-6 whitespace-pre-wrap text-sm text-muted-foreground">{selected.description || "Sin descripción registrada."}</p><div className="mt-6 flex items-center gap-2 border-t pt-4 text-sm"><Check size={16} className="text-emerald-600" /> Inmobiliario responsable: <strong>{selected.inmobiliarioName}</strong></div></CardContent></Card></div>}
    </section>
  );
}
