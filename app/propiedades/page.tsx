"use client";

import {
  Building2,
  Check,
  Edit3,
  Eye,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRBAC } from "@/components/auth/rbac-provider";
import { db } from "@/lib/firebase";
import { hasPermission } from "@/lib/rbac";

type PropertyStatus = "Activa" | "Inactiva";

type HistoryEntry = {
  id: string;
  type: "created" | "updated";
  date: string;
  userId: string;
  user: string;
  note: string;
  observations: string;
  changes: string[];
};

type Property = {
  id: string;
  condominiumName: string;
  region: string;
  operationDate: string;
  central: string;
  adoDistrict: string;
  type: string;
  province: string;
  canton: string;
  district: string;
  inmobiliarioCondition: string;
  activeOperators: number;
  administrator: string;
  administratorEmail: string;
  activeServices: number;
  builtHouses: number;
  nap: string;
  removedServices: number;
  registrationNote: string;
  observations: string;
  status: PropertyStatus;
  inmobiliarioId: string;
  inmobiliarioName: string;
  createdAt?: string;
  createdBy?: string;
  createdById?: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedById?: string;
  history: HistoryEntry[];
};

type PropertyForm = Omit<
  Property,
  | "id"
  | "createdAt"
  | "createdBy"
  | "createdById"
  | "updatedAt"
  | "updatedBy"
  | "updatedById"
  | "history"
  | "inmobiliarioName"
>;

type Inmobiliario = { id: string; name: string };

const emptyForm: PropertyForm = {
  condominiumName: "",
  region: "",
  operationDate: "",
  central: "",
  adoDistrict: "",
  type: "",
  province: "",
  canton: "",
  district: "",
  inmobiliarioCondition: "",
  activeOperators: 0,
  administrator: "",
  administratorEmail: "",
  activeServices: 0,
  builtHouses: 0,
  nap: "",
  removedServices: 0,
  registrationNote: "",
  observations: "",
  status: "Activa",
  inmobiliarioId: "",
};

const propertyCollection = "propiedades";
const fieldLabels: Record<keyof PropertyForm, string> = {
  condominiumName: "Nombre del condominio",
  region: "Región",
  operationDate: "Fecha de operación",
  central: "Central",
  adoDistrict: "ADO_Distrito",
  type: "Tipo",
  province: "Provincia",
  canton: "Cantón",
  district: "Distrito",
  inmobiliarioCondition: "Estado/Condición Inmobiliario",
  activeOperators: "Operadores activos",
  administrator: "Administrador",
  administratorEmail: "Correo del administrador",
  activeServices: "Servicios activos",
  builtHouses: "Casas construidas",
  nap: "NAP",
  removedServices: "Servicios retirados",
  registrationNote: "Nota/actividad del registro",
  observations: "Observaciones",
  status: "Estado",
  inmobiliarioId: "Responsable",
};

function text(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is HistoryEntry => Boolean(entry && typeof entry === "object" && "date" in entry));
}

function mapProperty(id: string, data: Record<string, unknown>, agents: Inmobiliario[]): Property {
  const inmobiliarioId = text(data.inmobiliarioId);
  return {
    id,
    condominiumName: text(data.condominiumName ?? data.title),
    region: text(data.region),
    operationDate: text(data.operationDate),
    central: text(data.central),
    adoDistrict: text(data.adoDistrict),
    type: text(data.type),
    province: text(data.province),
    canton: text(data.canton),
    district: text(data.district),
    inmobiliarioCondition: text(data.inmobiliarioCondition),
    activeOperators: number(data.activeOperators),
    administrator: text(data.administrator),
    administratorEmail: text(data.administratorEmail),
    activeServices: number(data.activeServices),
    builtHouses: number(data.builtHouses),
    nap: text(data.nap),
    removedServices: number(data.removedServices),
    registrationNote: text(data.registrationNote),
    observations: text(data.observations ?? data.description),
    status: data.status === "Inactiva" ? "Inactiva" : "Activa",
    inmobiliarioId,
    inmobiliarioName: (agents.find((agent) => agent.id === inmobiliarioId)?.name ?? text(data.inmobiliarioName)) || "Sin asignar",
    createdAt: text(data.createdAt),
    createdBy: text(data.createdBy),
    createdById: text(data.createdById),
    updatedAt: text(data.updatedAt),
    updatedBy: text(data.updatedBy),
    updatedById: text(data.updatedById),
    history: readHistory(data.history),
  };
}

function changedFields(previous: Property, next: PropertyForm): string[] {
  return (Object.keys(fieldLabels) as Array<keyof PropertyForm>)
    .filter((field) => previous[field] !== next[field])
    .map((field) => fieldLabels[field]);
}

export default function PropiedadesPage() {
  const { role, user } = useRBAC();
  const canCreate = hasPermission(role, "propiedades", "create");
  const canUpdate = hasPermission(role, "propiedades", "update");
  const [properties, setProperties] = useState<Property[]>([]);
  const [inmobiliarios, setInmobiliarios] = useState<Inmobiliario[]>([]);
  const [form, setForm] = useState<PropertyForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Property | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Todas" | PropertyStatus>("Todas");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let unsubscribeProperties: (() => void) | undefined;

    async function loadData() {
      if (!db) {
        setLoading(false);
        return;
      }
      try {
        const agentSnapshot = await getDocs(collection(db, "inmobiliarios"));
        const agents = agentSnapshot.docs.map((item) => ({ id: item.id, name: text(item.data().name) }));
        if (!active) return;
        setInmobiliarios(agents);
        unsubscribeProperties = onSnapshot(collection(db, propertyCollection), (snapshot) => {
          setProperties(snapshot.docs.map((item) => mapProperty(item.id, item.data(), agents)));
          setLoading(false);
        }, (loadError) => {
          console.error("No se pudieron cargar los condominios.", loadError);
          setError("No se pudieron cargar los condominios. Revisa la configuración y las reglas de Firestore.");
          setLoading(false);
        });
      } catch (loadError) {
        console.error("No se pudieron cargar los condominios.", loadError);
        if (active) setError("No se pudieron cargar los condominios.");
      }
    }

    void loadData();
    return () => {
      active = false;
      unsubscribeProperties?.();
    };
  }, []);

  const filteredProperties = useMemo(() => properties.filter((property) => {
    const haystack = [
      property.condominiumName,
      property.region,
      property.central,
      property.adoDistrict,
      property.province,
      property.canton,
      property.district,
      property.administrator,
      property.administratorEmail,
      property.nap,
      property.inmobiliarioName,
    ].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase())
      && (statusFilter === "Todas" || property.status === statusFilter);
  }), [properties, query, statusFilter]);

  function updateField<K extends keyof PropertyForm>(field: K, value: PropertyForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, inmobiliarioId: user?.uid ?? "" });
    setSelected(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(property: Property) {
    setEditingId(property.id);
    setForm({
      condominiumName: property.condominiumName,
      region: property.region,
      operationDate: property.operationDate,
      central: property.central,
      adoDistrict: property.adoDistrict,
      type: property.type,
      province: property.province,
      canton: property.canton,
      district: property.district,
      inmobiliarioCondition: property.inmobiliarioCondition,
      activeOperators: property.activeOperators,
      administrator: property.administrator,
      administratorEmail: property.administratorEmail,
      activeServices: property.activeServices,
      builtHouses: property.builtHouses,
      nap: property.nap,
      removedServices: property.removedServices,
      registrationNote: property.registrationNote,
      observations: property.observations,
      status: property.status,
      inmobiliarioId: property.inmobiliarioId,
    });
    setSelected(null);
    setError("");
    setShowForm(true);
  }

  function actor() {
    return {
      userId: user?.uid ?? "",
      user: user?.email ?? "Usuario actual",
      date: new Date().toISOString(),
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db) {
      setError("Firebase no está configurado. Completa las variables de entorno para guardar cambios.");
      return;
    }
    if (!form.condominiumName.trim() || !form.administrator.trim() || !form.administratorEmail.trim()) {
      setError("Completa el nombre del condominio, el administrador y su correo.");
      return;
    }

    setSaving(true);
    setError("");
    const agent = inmobiliarios.find((item) => item.id === form.inmobiliarioId);
    const currentActor = actor();
    const previous = editingId ? properties.find((property) => property.id === editingId) : undefined;
    const payload = {
      ...form,
      condominiumName: form.condominiumName.trim(),
      administrator: form.administrator.trim(),
      administratorEmail: form.administratorEmail.trim(),
      registrationNote: form.registrationNote.trim(),
      observations: form.observations.trim(),
      inmobiliarioId: editingId ? form.inmobiliarioId : currentActor.userId,
      inmobiliarioName: editingId ? (agent?.name ?? previous?.inmobiliarioName ?? currentActor.user) : currentActor.user,
      updatedAt: currentActor.date,
      updatedBy: currentActor.user,
      updatedById: currentActor.userId,
    };

    try {
      if (editingId) {
        if (!previous) throw new Error("No se encontró el condominio que se quiere actualizar.");
        const changes = changedFields(previous, form);
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          type: "updated",
          ...currentActor,
          note: form.registrationNote.trim(),
          observations: form.observations.trim(),
          changes: changes.length ? changes : ["Actualización de bitácora"],
        };
        await updateDoc(doc(db, propertyCollection, editingId), { ...payload, history: arrayUnion(entry) });
      } else {
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          type: "created",
          ...currentActor,
          note: form.registrationNote.trim(),
          observations: form.observations.trim(),
          changes: ["Registro inicial del condominio"],
        };
        await addDoc(collection(db, propertyCollection), {
          ...payload,
          createdAt: currentActor.date,
          createdBy: currentActor.user,
          createdById: currentActor.userId,
          history: [entry],
        });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (saveError) {
      console.error("No se pudo guardar el condominio.", saveError);
      setError("No se pudo guardar el condominio. Verifica los permisos de Firestore.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(property: Property) {
    if (!db || !canUpdate) return;
    const currentActor = actor();
    const nextStatus: PropertyStatus = property.status === "Activa" ? "Inactiva" : "Activa";
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      type: "updated",
      ...currentActor,
      note: `Estado cambiado a ${nextStatus}.`,
      observations: "",
      changes: ["Estado"],
    };
    try {
      await updateDoc(doc(db, propertyCollection, property.id), {
        status: nextStatus,
        updatedAt: currentActor.date,
        updatedBy: currentActor.user,
        updatedById: currentActor.userId,
        history: arrayUnion(entry),
      });
    } catch (statusError) {
      console.error("No se pudo cambiar el estado del condominio.", statusError);
      setError("No se pudo cambiar el estado. Verifica los permisos de Firestore.");
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Registro colaborativo</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Condominios</h1>
          <p className="mt-2 text-muted-foreground">Consulta, actualiza y revisa la bitácora de cada condominio.</p>
        </div>
        {canCreate && <Button onClick={openCreate}><Plus size={17} className="mr-2" /> Nuevo condominio</Button>}
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{editingId ? "Editar condominio" : "Nuevo condominio"}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)} aria-label="Cerrar formulario"><X size={18} /></Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-medium lg:col-span-2">Nombre del condominio<input required value={form.condominiumName} onChange={(event) => updateField("condominiumName", event.target.value)} placeholder="Condominio Las Flores" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Región<input value={form.region} onChange={(event) => updateField("region", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Fecha de operación<input type="date" value={form.operationDate} onChange={(event) => updateField("operationDate", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Central<input value={form.central} onChange={(event) => updateField("central", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">ADO_Distrito<input value={form.adoDistrict} onChange={(event) => updateField("adoDistrict", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Tipo<input value={form.type} onChange={(event) => updateField("type", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Provincia<input value={form.province} onChange={(event) => updateField("province", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Cantón<input value={form.canton} onChange={(event) => updateField("canton", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Distrito<input value={form.district} onChange={(event) => updateField("district", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Estado/Condición Inmobiliario<input value={form.inmobiliarioCondition} onChange={(event) => updateField("inmobiliarioCondition", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Operadores activos<input min="0" type="number" value={form.activeOperators} onChange={(event) => updateField("activeOperators", Number(event.target.value))} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Administrador<input required value={form.administrator} onChange={(event) => updateField("administrator", event.target.value)} placeholder="Nombre completo" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Correo del administrador<input required type="email" value={form.administratorEmail} onChange={(event) => updateField("administratorEmail", event.target.value)} placeholder="admin@condominio.com" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Servicios activos<input min="0" type="number" value={form.activeServices} onChange={(event) => updateField("activeServices", Number(event.target.value))} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Casas construidas<input min="0" type="number" value={form.builtHouses} onChange={(event) => updateField("builtHouses", Number(event.target.value))} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">NAP<input value={form.nap} onChange={(event) => updateField("nap", event.target.value)} placeholder="Código o referencia NAP" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Servicios retirados<input min="0" type="number" value={form.removedServices} onChange={(event) => updateField("removedServices", Number(event.target.value))} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Responsable<input readOnly value={editingId ? (properties.find((property) => property.id === editingId)?.inmobiliarioName || "Usuario creador") : (user?.email ?? "Usuario actual")} className="mt-2 h-10 w-full rounded-md border bg-muted px-3 font-normal text-muted-foreground" /></label>
              <label className="text-sm font-medium">Estado<select value={form.status} onChange={(event) => updateField("status", event.target.value as PropertyStatus)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary"><option>Activa</option><option>Inactiva</option></select></label>
              <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Nota/actividad del registro<textarea value={form.registrationNote} onChange={(event) => updateField("registrationNote", event.target.value)} rows={3} placeholder="Describe la gestión o actividad realizada..." className="mt-2 w-full rounded-md border bg-background px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Observaciones<textarea value={form.observations} onChange={(event) => updateField("observations", event.target.value)} rows={3} placeholder="Gustos, necesidades o información relevante..." className="mt-2 w-full rounded-md border bg-background px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar condominio"}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>Condominios registrados</CardTitle><p className="mt-1 text-sm text-muted-foreground">{properties.length} registros</p></div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-muted-foreground" /><input aria-label="Buscar condominios" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar condominio..." className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary sm:w-56" /></div>
            <select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"><option>Todas</option><option>Activa</option><option>Inactiva</option></select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando condominios...</p> : !db ? <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Firebase aún no está conectado.</p> : filteredProperties.length === 0 ? <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No hay condominios que coincidan con los filtros.</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredProperties.map((property) => (
            <article key={property.id} className="rounded-xl border p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Building2 size={18} /></span><div><h2 className="font-semibold">{property.condominiumName || "Sin nombre"}</h2><p className="text-xs text-muted-foreground">Administrador: {property.administrator || "Sin asignar"}</p></div></div><span className={`rounded-full px-2 py-1 text-xs font-medium ${property.status === "Activa" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{property.status}</span></div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div><p className="text-muted-foreground">Servicios activos</p><p className="font-semibold">{property.activeServices}</p></div><div><p className="text-muted-foreground">Casas construidas</p><p className="font-semibold">{property.builtHouses}</p></div><div><p className="text-muted-foreground">NAP</p><p className="font-semibold">{property.nap || "—"}</p></div><div><p className="text-muted-foreground">Retirados</p><p className="font-semibold">{property.removedServices}</p></div></div>
              <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">Última actualización: {property.updatedBy || property.createdBy || "Sin registrar"}</p>
              <div className="mt-4 flex justify-between gap-2"><Button variant="outline" size="sm" onClick={() => setSelected(property)}><Eye size={15} className="mr-1" /> Bitácora</Button>{canUpdate && <><Button variant="ghost" size="icon" onClick={() => openEdit(property)} aria-label={`Editar ${property.condominiumName}`}><Edit3 size={16} /></Button><Button variant="ghost" size="icon" onClick={() => void toggleStatus(property)} aria-label="Cambiar estado">{property.status === "Activa" ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}</Button></>}</div>
            </article>
          ))}</div>}
        </CardContent>
      </Card>

      {selected && <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Bitácora · {selected.condominiumName || "Condominio"}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Creado por {selected.createdBy || "Sin registrar"}{selected.createdAt && ` · ${new Date(selected.createdAt).toLocaleString("es-CR")}`}</p></div><Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Cerrar bitácora"><X size={18} /></Button></CardHeader><CardContent><div className="space-y-5">{selected.history.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Este registro no tiene historial todavía.</p> : [...selected.history].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => <div key={entry.id} className="flex gap-3 border-b pb-4 last:border-0"><span className="mt-1 rounded-full bg-primary/10 p-2 text-primary"><Check size={15} /></span><div className="min-w-0 flex-1"><div className="flex flex-col justify-between gap-1 sm:flex-row"><p className="font-semibold">{entry.type === "created" ? "Registro inicial" : "Actualización"}</p><time className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleString("es-CR")}</time></div><p className="mt-1 text-sm">Por {entry.user || "Usuario actual"}</p>{entry.changes.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Cambios: {entry.changes.join(", ")}</p>}{entry.note && <p className="mt-2 text-sm text-muted-foreground">{entry.note}</p>}{entry.observations && <p className="mt-1 text-sm text-muted-foreground">Observaciones: {entry.observations}</p>}</div></div>)}</div></CardContent></Card>}
    </section>
  );
}
