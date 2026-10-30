"use client";

import {
  Building2,
  Check,
  Copy,
  Edit3,
  Eye,
  Mail,
  MapPin,
  Plus,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useRBAC } from "@/components/auth/rbac-provider";
import { db } from "@/lib/firebase";
import { hasPermission, isRole } from "@/lib/rbac";
import { statusBadgeClass } from "@/lib/status-colors";
import { creationAudit, updateAudit } from "@/lib/firestore-audit";
import type { MapPosition } from "@/components/mapa/real-map";
import { parseCoordinatePair } from "@/lib/coordinates";

const RealMap = dynamic(
  () => import("@/components/mapa/real-map").then((module) => module.RealMap),
  { ssr: false },
);

type PropertyStatus = "Activa" | "Inactiva";
type AcquisitionMethod = "" | "Pago" | "Invitación (costo ₡0)";
type OccupancyFilter = "Todas" | "Sin datos" | "Baja" | "Media" | "Alta";

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
  activeOperatorNames: string[];
  acquisitionMethod: AcquisitionMethod;
  condominiumId: string;
  administrator: string;
  administratorEmail: string;
  administratorPhone: string;
  activeServices: number;
  builtHouses: number;
  nap: string;
  totalNaps: number;
  occupiedNaps: number;
  occupancyPercentage: number | null;
  removedServices: number;
  registrationNote: string;
  observations: string;
  status: PropertyStatus;
  latitude: string;
  longitude: string;
  inmobiliarioId: string;
  inmobiliarioName: string;
  createdAt?: string;
  createdBy?: string;
  createdById?: string;
  createdByName?: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedById?: string;
  updatedByName?: string;
  history: HistoryEntry[];
};

type PropertyForm = Omit<
  Property,
  | "id"
  | "createdAt"
  | "createdBy"
  | "createdById"
  | "createdByName"
  | "updatedAt"
  | "updatedBy"
  | "updatedById"
  | "updatedByName"
  | "history"
  | "inmobiliarioName"
  | "activeOperators"
  | "occupancyPercentage"
>;

type Inmobiliario = { id: string; name: string; email: string };

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
  activeOperatorNames: ["Kolbi"],
  acquisitionMethod: "",
  condominiumId: "",
  administrator: "",
  administratorEmail: "",
  administratorPhone: "",
  activeServices: 0,
  builtHouses: 0,
  nap: "",
  totalNaps: 0,
  occupiedNaps: 0,
  removedServices: 0,
  registrationNote: "",
  observations: "",
  status: "Activa",
  latitude: "",
  longitude: "",
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
  activeOperatorNames: "Operadores activos",
  acquisitionMethod: "Método de adquisición",
  condominiumId: "ID del condominio",
  administrator: "Administrador",
  administratorEmail: "Correo del administrador",
  administratorPhone: "Teléfono del administrador",
  activeServices: "Servicios activos",
  builtHouses: "Casas construidas",
  nap: "NAP",
  totalNaps: "NAP totales",
  occupiedNaps: "NAP ocupados",
  removedServices: "Servicios retirados",
  registrationNote: "Nota/actividad del registro",
  observations: "Observaciones",
  status: "Estado",
  latitude: "Latitud",
  longitude: "Longitud",
  inmobiliarioId: "Responsable",
};

function text(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nonNegativeNumber(value: unknown): number {
  return Math.max(0, number(value));
}

function operatorNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Map(names.map((name) => [name.toLocaleLowerCase("es-CR"), name])).values()];
}

function getOccupancyPercentage(totalNaps: number, occupiedNaps: number): number | null {
  if (totalNaps <= 0) return null;
  return (occupiedNaps / totalNaps) * 100;
}

function formatOccupancy(percentage: number | null): string {
  return percentage === null ? "No aplica" : `${percentage.toLocaleString("es-CR", { maximumFractionDigits: 1 })} %`;
}

function occupancyBand(percentage: number | null): Exclude<OccupancyFilter, "Todas"> {
  if (percentage === null) return "Sin datos";
  if (percentage < 50) return "Baja";
  if (percentage < 80) return "Media";
  return "Alta";
}

function occupancyBarClass(percentage: number | null): string {
  if (percentage === null) return "bg-slate-300";
  if (percentage < 50) return "bg-red-500";
  if (percentage < 80) return "bg-amber-500";
  return "bg-emerald-500";
}

function pendingPropertyDetails(property: Property): string[] {
  return [
    !property.condominiumId && "ID",
    !property.administratorPhone && "teléfono",
    property.totalNaps <= 0 && "NAP totales",
  ].filter((detail): detail is string => Boolean(detail));
}

function readHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is HistoryEntry => Boolean(entry && typeof entry === "object" && "date" in entry));
}

function mapProperty(id: string, data: Record<string, unknown>, agents: Inmobiliario[]): Property {
  const inmobiliarioId = text(data.inmobiliarioId);
  const actorName = (uid: string, savedName: unknown) => {
    const actor = agents.find((agent) => agent.id === uid);
    const name = text(savedName).trim();
    if (name && !(name.includes("@") && actor?.name)) return name;
    return actor?.name || actor?.email || name;
  };
  const createdBy = text(data.createdById ?? data.createdBy);
  const updatedBy = text(data.updatedById ?? data.updatedBy);
  const activeOperatorNames = operatorNames(
    data.activeOperatorNames ?? (Array.isArray(data.activeOperators) ? data.activeOperators : []),
  );
  const totalNaps = nonNegativeNumber(data.totalNaps);
  const occupiedNaps = nonNegativeNumber(data.occupiedNaps);
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
    activeOperators: Math.max(nonNegativeNumber(data.activeOperators), activeOperatorNames.length),
    activeOperatorNames,
    acquisitionMethod: data.acquisitionMethod === "Pago" || data.acquisitionMethod === "Invitación (costo ₡0)"
      ? data.acquisitionMethod
      : "",
    condominiumId: text(data.condominiumId),
    administrator: text(data.administrator),
    administratorEmail: text(data.administratorEmail),
    administratorPhone: text(data.administratorPhone),
    activeServices: number(data.activeServices),
    builtHouses: number(data.builtHouses),
    nap: text(data.nap),
    totalNaps,
    occupiedNaps,
    occupancyPercentage: getOccupancyPercentage(totalNaps, occupiedNaps),
    removedServices: number(data.removedServices),
    registrationNote: text(data.registrationNote),
    observations: text(data.observations ?? data.description),
    status: data.status === "Inactiva" ? "Inactiva" : "Activa",
    latitude: text(data.latitude),
    longitude: text(data.longitude),
    inmobiliarioId,
    inmobiliarioName: (agents.find((agent) => agent.id === inmobiliarioId)?.name ?? text(data.inmobiliarioName)) || "Sin asignar",
    createdAt: text(data.createdAt),
    createdBy: text(data.createdBy),
    createdById: text(data.createdById),
    createdByName: actorName(createdBy, data.createdByName) || "Usuario sin nombre disponible",
    updatedAt: text(data.updatedAt),
    updatedBy: text(data.updatedBy),
    updatedById: text(data.updatedById),
    updatedByName: actorName(updatedBy, data.updatedByName) || "Usuario sin nombre disponible",
    history: readHistory(data.history),
  };
}

function changedFields(previous: Property, next: PropertyForm): string[] {
  return (Object.keys(fieldLabels) as Array<keyof PropertyForm>)
    .filter((field) => Array.isArray(previous[field]) && Array.isArray(next[field])
      ? previous[field].join("\u0000") !== next[field].join("\u0000")
      : previous[field] !== next[field])
    .map((field) => fieldLabels[field]);
}

export default function PropiedadesPage() {
  const { role, user } = useRBAC();
  const canCreate = hasPermission(role, "propiedades", "create");
  const canUpdate = hasPermission(role, "propiedades", "update");
  const canAssign = role === "ADMIN";
  const [properties, setProperties] = useState<Property[]>([]);
  const [inmobiliarios, setInmobiliarios] = useState<Inmobiliario[]>([]);
  const [form, setForm] = useState<PropertyForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Property | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Todas" | PropertyStatus>("Todas");
  const [regionFilter, setRegionFilter] = useState("Todas");
  const [operatorFilter, setOperatorFilter] = useState("Todas");
  const [occupancyFilter, setOccupancyFilter] = useState<OccupancyFilter>("Todas");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [coordinateInput, setCoordinateInput] = useState("");
  const [coordinateError, setCoordinateError] = useState("");
  const [operatorInput, setOperatorInput] = useState("");
  const [copiedPropertyId, setCopiedPropertyId] = useState<string | null>(null);
  const [deletingPropertyId, setDeletingPropertyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
        const agentsById = new Map(agentSnapshot.docs.map((item) => [item.id, {
          id: item.id,
          name: text(item.data().name),
          email: text(item.data().email),
        }] as const));
        if (role === "ADMIN" && user) {
          try {
            const token = await user.getIdToken();
            const response = await fetch("/api/users", {
              headers: { Authorization: `Bearer ${token}` },
              cache: "no-store",
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error("No se pudo consultar el directorio de usuarios.");
            if (Array.isArray(result.users)) {
              for (const item of result.users as Array<Record<string, unknown>>) {
                if (typeof item.uid !== "string" || typeof item.email !== "string" || !isRole(item.role) || item.disabled === true) continue;
                const existing = agentsById.get(item.uid);
                agentsById.set(item.uid, {
                  id: item.uid,
                  name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : existing?.name || item.email,
                  email: item.email,
                });
              }
            }
          } catch (directoryError) {
            console.error("No se pudo cargar el directorio completo de usuarios.", directoryError);
            if (active) setError("No se pudo cargar el directorio completo de usuarios.");
          }
        }
        const agents = [...agentsById.values()].sort((a, b) => a.name.localeCompare(b.name));
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
  }, [role, user]);

  const regions = useMemo(() => [...new Set(properties.map((property) => property.region.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es-CR")), [properties]);
  const operators = useMemo(() => [...new Set(properties.flatMap((property) => property.activeOperatorNames))]
    .sort((a, b) => a.localeCompare(b, "es-CR")), [properties]);

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
      property.administratorPhone,
      property.nap,
      property.condominiumId,
      property.activeOperatorNames.join(" "),
      property.inmobiliarioName,
    ].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase())
      && (statusFilter === "Todas" || property.status === statusFilter)
      && (regionFilter === "Todas" || property.region === regionFilter)
      && (operatorFilter === "Todas" || property.activeOperatorNames.includes(operatorFilter))
      && (occupancyFilter === "Todas" || occupancyBand(property.occupancyPercentage) === occupancyFilter);
  }), [occupancyFilter, operatorFilter, properties, query, regionFilter, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredProperties.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const paginatedProperties = filteredProperties.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize,
  );

  const selectedMapPosition = useMemo<MapPosition | null>(() => {
    if (!form.latitude.trim() || !form.longitude.trim()) return null;
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
    ) return null;
    return { latitude, longitude };
  }, [form.latitude, form.longitude]);

  function updateField<K extends keyof PropertyForm>(field: K, value: PropertyForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function addOperator() {
    const name = operatorInput.trim();
    if (!name) return;
    setForm((current) => ({
      ...current,
      activeOperatorNames: operatorNames([...current.activeOperatorNames, name]),
    }));
    setOperatorInput("");
  }

  function removeOperator(name: string) {
    setForm((current) => ({
      ...current,
      activeOperatorNames: current.activeOperatorNames.filter((operator) => operator !== name),
    }));
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => current === message ? null : current), 2800);
  }

  async function copyCondominiumId(property: Property) {
    if (!property.condominiumId) return;
    try {
      await navigator.clipboard.writeText(property.condominiumId);
      setCopiedPropertyId(property.id);
      showNotice("ID del condominio copiado.");
      window.setTimeout(() => setCopiedPropertyId((current) => current === property.id ? null : current), 2000);
    } catch (copyError) {
      console.error("No se pudo copiar el ID del condominio.", copyError);
      setError("No se pudo copiar el ID del condominio.");
    }
  }

  async function deleteProperty(property: Property) {
    const canDelete = role === "ADMIN"
      || property.createdBy === user?.uid
      || property.createdById === user?.uid;
    if (!db || !user || !canDelete) return;
    if (!window.confirm(`¿Deseás eliminar la propiedad "${property.condominiumName || "Sin nombre"}"? Esta acción no se puede deshacer.`)) return;

    setDeletingPropertyId(property.id);
    setError("");
    try {
      await deleteDoc(doc(db, propertyCollection, property.id));
      if (selected?.id === property.id) setSelected(null);
      showNotice("Propiedad eliminada correctamente.");
    } catch (deleteError) {
      console.error("No se pudo eliminar la propiedad.", deleteError);
      setError("No se pudo eliminar la propiedad. Verifica los permisos de Firestore.");
    } finally {
      setDeletingPropertyId(null);
    }
  }

  function updateCoordinates(value: string) {
    setCoordinateInput(value);
    if (!value.trim()) {
      setCoordinateError("");
      setForm((current) => ({ ...current, latitude: "", longitude: "" }));
      return;
    }

    const coordinates = parseCoordinatePair(value);
    if (!coordinates) {
      setCoordinateError("Pegá las coordenadas en formato latitud, longitud. Ejemplo: 9.985405, -84.105392");
      setForm((current) => ({ ...current, latitude: "", longitude: "" }));
      return;
    }

    setCoordinateError("");
    setForm((current) => ({
      ...current,
      latitude: String(coordinates.latitude),
      longitude: String(coordinates.longitude),
    }));
  }

  function applyMapCoordinates(position: MapPosition) {
    const latitude = position.latitude.toFixed(6);
    const longitude = position.longitude.toFixed(6);
    setCoordinateInput(`${latitude}, ${longitude}`);
    setCoordinateError("");
    setForm((current) => ({ ...current, latitude, longitude }));
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, inmobiliarioId: user?.uid ?? "" });
    setCoordinateInput("");
    setCoordinateError("");
    setOperatorInput("");
    setShowLocationPicker(false);
    setSelected(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(property: Property) {
    setEditingId(property.id);
    const existingCoordinates = property.latitude && property.longitude
      ? `${property.latitude}, ${property.longitude}`
      : "";
    setCoordinateInput(existingCoordinates);
    setCoordinateError(existingCoordinates && !parseCoordinatePair(existingCoordinates)
      ? "Las coordenadas guardadas no son válidas. Corregilas o borralas antes de guardar."
      : "");
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
      activeOperatorNames: property.activeOperatorNames,
      acquisitionMethod: property.acquisitionMethod,
      condominiumId: property.condominiumId,
      administrator: property.administrator,
      administratorEmail: property.administratorEmail,
      administratorPhone: property.administratorPhone,
      activeServices: property.activeServices,
      builtHouses: property.builtHouses,
      nap: property.nap,
      totalNaps: property.totalNaps,
      occupiedNaps: property.occupiedNaps,
      removedServices: property.removedServices,
      registrationNote: property.registrationNote,
      observations: property.observations,
      status: property.status,
      latitude: property.latitude,
      longitude: property.longitude,
      inmobiliarioId: property.inmobiliarioId || property.createdById || property.createdBy || user?.uid || "",
    });
    setShowLocationPicker(false);
    setOperatorInput("");
    setSelected(null);
    setError("");
    setShowForm(true);
  }

  function actor() {
    const userProfile = inmobiliarios.find((item) => item.id === user?.uid);
    return {
      userId: user?.uid ?? "",
      user: userProfile?.name || user?.displayName || user?.email || "Usuario actual",
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
    if (form.occupiedNaps > form.totalNaps) {
      setError("Los NAP ocupados no pueden ser mayores que los NAP totales.");
      return;
    }

    const coordinateText = coordinateInput.trim();
    const coordinates = coordinateText ? parseCoordinatePair(coordinateInput) : null;
    if (coordinateText && !coordinates) {
      setError("Revisá las coordenadas. Pegá latitud y longitud separadas por una coma.");
      return;
    }
    const latitude = coordinates?.latitude;
    const longitude = coordinates?.longitude;

    setSaving(true);
    setError("");
    const currentActor = actor();
    const previous = editingId ? properties.find((property) => property.id === editingId) : undefined;
    if (canAssign && !form.inmobiliarioId) {
      setError("Selecciona un usuario responsable.");
      setSaving(false);
      return;
    }
    const responsibleId = canAssign
      ? form.inmobiliarioId
      : editingId
        ? previous?.inmobiliarioId || form.inmobiliarioId
        : currentActor.userId;
    const responsibleProfile = inmobiliarios.find((item) => item.id === responsibleId);
    const normalizedOperators = operatorNames(form.activeOperatorNames);
    const payload = {
      ...form,
      activeOperatorNames: normalizedOperators,
      activeOperators: normalizedOperators.length,
      acquisitionMethod: form.acquisitionMethod,
      condominiumId: form.condominiumId.trim(),
      totalNaps: nonNegativeNumber(form.totalNaps),
      occupiedNaps: nonNegativeNumber(form.occupiedNaps),
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      title: form.condominiumName.trim(),
      condominiumName: form.condominiumName.trim(),
      administrator: form.administrator.trim(),
      administratorEmail: form.administratorEmail.trim(),
      administratorPhone: form.administratorPhone.trim(),
      registrationNote: form.registrationNote.trim(),
      observations: form.observations.trim(),
      inmobiliarioId: responsibleId,
      inmobiliarioName: responsibleProfile?.name || responsibleProfile?.email || (responsibleId === currentActor.userId ? currentActor.user : previous?.inmobiliarioName || "Sin asignar"),
      updatedAt: currentActor.date,
      updatedBy: currentActor.userId,
      updatedById: currentActor.userId,
      updatedByName: currentActor.user,
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
        await updateDoc(doc(db, propertyCollection, editingId), { ...payload, ...updateAudit(currentActor.userId), history: arrayUnion(entry) });
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
          ...creationAudit(currentActor.userId),
          createdAt: currentActor.date,
          createdBy: currentActor.userId,
          createdById: currentActor.userId,
          createdByName: currentActor.user,
          history: [entry],
        });
      }
      setShowForm(false);
      showNotice(editingId ? "Cambios guardados correctamente." : "Condominio guardado correctamente.");
      setEditingId(null);
      setForm(emptyForm);
      setCoordinateInput("");
      setCoordinateError("");
      setOperatorInput("");
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
        ...updateAudit(currentActor.userId),
        updatedAt: currentActor.date,
        updatedBy: currentActor.userId,
        updatedById: currentActor.userId,
        updatedByName: currentActor.user,
        history: arrayUnion(entry),
      });
      showNotice(`Condominio ${nextStatus.toLowerCase()}.`);
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
      {notice && <div role="status" aria-live="polite" className="apple-toast fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2 rounded-2xl border border-primary/15 bg-card px-4 py-3 text-sm font-medium text-foreground"><span className="rounded-full bg-primary/10 p-1 text-primary"><Check size={15} /></span>{notice}</div>}

      {showForm && (
        <Card className="apple-surface">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{editingId ? "Editar condominio" : "Nuevo condominio"}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)} aria-label="Cerrar formulario"><X size={18} /></Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-medium lg:col-span-2">Nombre del condominio<input required value={form.condominiumName} onChange={(event) => updateField("condominiumName", event.target.value)} placeholder="Condominio Las Flores" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Región<input value={form.region} onChange={(event) => updateField("region", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">ID del condominio<input value={form.condominiumId} onChange={(event) => updateField("condominiumId", event.target.value)} placeholder="Ej. CON-001" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Método de adquisición<select value={form.acquisitionMethod} onChange={(event) => updateField("acquisitionMethod", event.target.value as AcquisitionMethod)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary"><option value="">Sin registrar</option><option value="Pago">Pago</option><option value="Invitación (costo ₡0)">Invitación (costo ₡0)</option></select></label>
              <label className="text-sm font-medium">Fecha de operación<input type="date" value={form.operationDate} onChange={(event) => updateField("operationDate", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Central<input value={form.central} onChange={(event) => updateField("central", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">ADO_Distrito<input value={form.adoDistrict} onChange={(event) => updateField("adoDistrict", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Tipo<input value={form.type} onChange={(event) => updateField("type", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Provincia<input value={form.province} onChange={(event) => updateField("province", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Cantón<input value={form.canton} onChange={(event) => updateField("canton", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Distrito<input value={form.district} onChange={(event) => updateField("district", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Estado/Condición Inmobiliario<input value={form.inmobiliarioCondition} onChange={(event) => updateField("inmobiliarioCondition", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <fieldset className="rounded-lg border p-4 sm:col-span-2 lg:col-span-3">
                <legend className="px-1 text-sm font-medium">Operadores activos</legend>
                <p className="mb-3 text-xs text-muted-foreground">Registrá a Kolbi y a los competidores activos en este condominio.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input value={operatorInput} onChange={(event) => setOperatorInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addOperator(); } }} placeholder="Ej. Liberty" className="h-10 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
                  <Button type="button" variant="outline" onClick={addOperator} disabled={!operatorInput.trim()}><Plus size={16} className="mr-1" /> Agregar operador</Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {form.activeOperatorNames.length === 0 ? <p className="text-sm text-muted-foreground">No hay operadores registrados.</p> : form.activeOperatorNames.map((operator) => <span key={operator} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">{operator}<button type="button" onClick={() => removeOperator(operator)} aria-label={`Eliminar ${operator}`} className="ml-1 rounded-full text-primary/80 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary">×</button></span>)}
                </div>
              </fieldset>
              <label className="text-sm font-medium">Administrador<input required value={form.administrator} onChange={(event) => updateField("administrator", event.target.value)} placeholder="Nombre completo" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Correo del administrador<input required type="email" value={form.administratorEmail} onChange={(event) => updateField("administratorEmail", event.target.value)} placeholder="admin@condominio.com" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Teléfono de contacto<input type="tel" inputMode="tel" autoComplete="tel" value={form.administratorPhone} onChange={(event) => updateField("administratorPhone", event.target.value)} placeholder="Ej. 8888-8888" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Servicios activos<input min="0" type="number" value={form.activeServices} onChange={(event) => updateField("activeServices", Number(event.target.value))} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">Casas construidas<input min="0" type="number" value={form.builtHouses} onChange={(event) => updateField("builtHouses", Number(event.target.value))} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">NAP<input value={form.nap} onChange={(event) => updateField("nap", event.target.value)} placeholder="Código o referencia NAP" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">NAP totales<input min="0" type="number" value={form.totalNaps} onChange={(event) => updateField("totalNaps", nonNegativeNumber(event.target.value))} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">NAP ocupados<input min="0" max={form.totalNaps || undefined} type="number" value={form.occupiedNaps} onChange={(event) => updateField("occupiedNaps", nonNegativeNumber(event.target.value))} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <div className="rounded-md border bg-primary/5 px-3 py-2 text-sm"><p className="text-muted-foreground">Porcentaje de ocupación</p><p className="mt-1 text-lg font-bold text-primary">{formatOccupancy(getOccupancyPercentage(form.totalNaps, form.occupiedNaps))}</p><p className="text-xs text-muted-foreground">NAP ocupados ÷ NAP totales</p></div>
              <label className="text-sm font-medium">Servicios retirados<input min="0" type="number" value={form.removedServices} onChange={(event) => updateField("removedServices", Number(event.target.value))} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium">
                Responsable
                {canAssign
                  ? <select required value={form.inmobiliarioId} onChange={(event) => updateField("inmobiliarioId", event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary">
                      <option value="">Seleccionar usuario responsable</option>
                      {form.inmobiliarioId && !inmobiliarios.some((agent) => agent.id === form.inmobiliarioId) && <option value={form.inmobiliarioId}>{editingId ? properties.find((property) => property.id === editingId)?.inmobiliarioName : user?.displayName || user?.email || "Responsable actual"} (actual)</option>}
                      {inmobiliarios.map((agent) => <option key={agent.id} value={agent.id}>{agent.name || agent.email}{agent.email && agent.name ? ` · ${agent.email}` : ""}</option>)}
                    </select>
                  : <input readOnly value={editingId ? (properties.find((property) => property.id === editingId)?.inmobiliarioName || "Usuario responsable") : (inmobiliarios.find((agent) => agent.id === form.inmobiliarioId)?.name || user?.displayName || user?.email || "Usuario actual")} className="mt-2 h-10 w-full rounded-md border bg-muted px-3 font-normal text-muted-foreground" />}
              </label>
              <label className="text-sm font-medium">Estado<select value={form.status} onChange={(event) => updateField("status", event.target.value as PropertyStatus)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary"><option>Activa</option><option>Inactiva</option></select></label>
              <section aria-labelledby="property-location-title" className="space-y-3 rounded-lg border p-4 sm:col-span-2 lg:col-span-3">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h3 id="property-location-title" className="text-sm font-semibold">Ubicación en el mapa</h3>
                    <p className="text-xs text-muted-foreground">Opcional. Elegí un punto para que el condominio aparezca en el mapa con tu avatar.</p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => setShowLocationPicker((visible) => !visible)}>
                    <MapPin size={16} className="mr-2" />{showLocationPicker ? "Ocultar mapa" : "Elegir en el mapa"}
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium sm:col-span-2">Pegar coordenadas de Google Maps<input type="text" inputMode="text" value={coordinateInput} onChange={(event) => updateCoordinates(event.target.value)} placeholder="9.985405049140589, -84.10539207560959" aria-invalid={Boolean(coordinateError)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">Latitud: <strong>{form.latitude ? Number(form.latitude).toFixed(6) : "—"}</strong></div>
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">Longitud: <strong>{form.longitude ? Number(form.longitude).toFixed(6) : "—"}</strong></div>
                </div>
                {coordinateError && <p role="alert" className="text-sm text-red-600">{coordinateError}</p>}
                {showLocationPicker && (
                  <div className="h-[430px] overflow-hidden rounded-lg border">
                    <RealMap
                      markers={[]}
                      selectedPosition={selectedMapPosition}
                      onMapClick={applyMapCoordinates}
                    />
                  </div>
                )}
              </section>
              <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Nota/actividad del registro<textarea value={form.registrationNote} onChange={(event) => updateField("registrationNote", event.target.value)} rows={3} placeholder="Describe la gestión o actividad realizada..." className="mt-2 w-full rounded-md border bg-background px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Observaciones<textarea value={form.observations} onChange={(event) => updateField("observations", event.target.value)} rows={3} placeholder="Gustos, necesidades o información relevante..." className="mt-2 w-full rounded-md border bg-background px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar condominio"}</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="apple-surface">
        <CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>Condominios registrados</CardTitle><p className="mt-1 text-sm text-muted-foreground">{properties.length} registros</p></div>
          <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-6">
            <div className="relative xl:col-span-2"><Search size={16} className="absolute left-3 top-2.5 text-muted-foreground" /><input aria-label="Buscar condominios" value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); }} placeholder="Buscar condominio..." className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary xl:w-56" /></div>
            <select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); setCurrentPage(1); }} className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"><option>Todas</option><option>Activa</option><option>Inactiva</option></select>
            <select aria-label="Filtrar por región" value={regionFilter} onChange={(event) => { setRegionFilter(event.target.value); setCurrentPage(1); }} className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"><option value="Todas">Todas las regiones</option>{regions.map((region) => <option key={region} value={region}>{region}</option>)}</select>
            <select aria-label="Filtrar por operador" value={operatorFilter} onChange={(event) => { setOperatorFilter(event.target.value); setCurrentPage(1); }} className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"><option value="Todas">Todos los operadores</option>{operators.map((operator) => <option key={operator} value={operator}>{operator}</option>)}</select>
            <select aria-label="Filtrar por ocupación" value={occupancyFilter} onChange={(event) => { setOccupancyFilter(event.target.value as OccupancyFilter); setCurrentPage(1); }} className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"><option value="Todas">Toda ocupación</option><option value="Sin datos">Sin datos</option><option value="Baja">Baja (0–49 %)</option><option value="Media">Media (50–79 %)</option><option value="Alta">Alta (80–100 %)</option></select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="rounded-xl border p-4"><div className="flex items-center gap-2"><span className="apple-skeleton h-9 w-9 rounded-lg" /><div className="space-y-2"><div className="apple-skeleton h-4 w-36 rounded" /><div className="apple-skeleton h-3 w-52 rounded" /></div></div><div className="apple-skeleton mt-5 h-24 rounded-lg" /><div className="mt-4 grid grid-cols-2 gap-2"><div className="apple-skeleton h-10 rounded" /><div className="apple-skeleton h-10 rounded" /><div className="apple-skeleton h-10 rounded" /><div className="apple-skeleton h-10 rounded" /></div></div>)}</div> : !db ? <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Firebase aún no está conectado.</p> : filteredProperties.length === 0 ? <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No hay condominios que coincidan con los filtros.</p> : <><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{paginatedProperties.map((property, index) => (
            <article key={property.id} className="apple-property-card rounded-xl border p-4" style={{ animationDelay: `${Math.min(index * 45, 220)}ms` }}>
              <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Building2 size={18} /></span><div><h2 className="font-semibold">{property.condominiumName || "Sin nombre"}</h2><p className="text-xs text-muted-foreground">Administrador: {property.administrator || "Sin asignar"}</p>{property.administratorPhone && <p className="text-xs text-muted-foreground">Contacto: {property.administratorPhone}</p>}{property.administratorEmail && <a href={`mailto:${property.administratorEmail}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Mail size={12} />{property.administratorEmail}</a>}</div></div><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(property.status)}`}>{property.status}</span></div>
              {property.condominiumId && <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs"><span className="truncate text-muted-foreground">ID: <strong className="text-foreground">{property.condominiumId}</strong></span><Button type="button" variant="ghost" size="sm" onClick={() => void copyCondominiumId(property)} aria-label={`Copiar ID de ${property.condominiumName}`} className="h-7 shrink-0 px-2">{copiedPropertyId === property.id ? "Copiado" : <><Copy size={14} className="mr-1" /> Copiar</>}</Button></div>}
              <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium uppercase tracking-wide text-primary">Ocupación</p><span className="text-xs font-medium text-muted-foreground">{occupancyBand(property.occupancyPercentage)}</span></div><p className="mt-1 text-2xl font-bold text-primary">{formatOccupancy(property.occupancyPercentage)}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Porcentaje de ocupación" aria-valuemin={0} aria-valuemax={100} aria-valuenow={property.occupancyPercentage ?? 0}><div className={`h-full rounded-full transition-[width] ${occupancyBarClass(property.occupancyPercentage)}`} style={{ width: `${Math.min(100, Math.max(0, property.occupancyPercentage ?? 0))}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{property.occupiedNaps} de {property.totalNaps} NAP ocupados</p></div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div><p className="text-muted-foreground">Servicios activos</p><p className="font-semibold">{property.activeServices}</p></div><div><p className="text-muted-foreground">Casas construidas</p><p className="font-semibold">{property.builtHouses}</p></div><div><p className="text-muted-foreground">NAP</p><p className="font-semibold">{property.nap || "—"}</p></div><div><p className="text-muted-foreground">Operadores</p><p className="font-semibold">{property.activeOperators}</p></div></div>
              {property.activeOperatorNames.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Operadores activos: {property.activeOperatorNames.join(", ")}</p>}
              {pendingPropertyDetails(property).length > 0 && <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Pendiente: {pendingPropertyDetails(property).join(", ")}.</p>}
              <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">Última actualización: {property.updatedByName || property.createdByName || "Usuario sin nombre disponible"}</p>
              <div className="mt-4 flex justify-between gap-2"><Button variant="outline" size="sm" onClick={() => setSelected(property)}><Eye size={15} className="mr-1" /> Bitácora</Button><div className="flex gap-1">{canUpdate && (role !== "AGENTE" || property.createdBy === user?.uid) && <><Button variant="ghost" size="icon" onClick={() => openEdit(property)} aria-label={`Editar ${property.condominiumName}`}><Edit3 size={16} /></Button><Button variant="ghost" size="icon" onClick={() => void toggleStatus(property)} aria-label="Cambiar estado">{property.status === "Activa" ? <ToggleRight size={20} className="text-[#4e8e5b]" /> : <ToggleLeft size={20} className="text-[#858c86]" />}</Button></>}{(role === "ADMIN" || property.createdBy === user?.uid || property.createdById === user?.uid) && <Button variant="ghost" size="icon" onClick={() => void deleteProperty(property)} disabled={deletingPropertyId === property.id} aria-label={`Eliminar ${property.condominiumName}`} title="Eliminar propiedad"><Trash2 size={16} className="text-destructive" /></Button>}</div></div>
            </article>
          ))}</div><PaginationControls page={safeCurrentPage} pageCount={pageCount} pageSize={pageSize} itemCount={filteredProperties.length} onPageChange={setCurrentPage} /></>}
        </CardContent>
      </Card>

      {selected && <Card className="apple-surface"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Bitácora · {selected.condominiumName || "Condominio"}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Creado por {selected.createdByName || "Usuario sin nombre disponible"}{selected.createdAt && ` · ${new Date(selected.createdAt).toLocaleString("es-CR")}`}</p></div><Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Cerrar bitácora"><X size={18} /></Button></CardHeader><CardContent><div className="space-y-5">{selected.history.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Este registro no tiene historial todavía.</p> : [...selected.history].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => <div key={entry.id} className="flex gap-3 border-b pb-4 last:border-0"><span className="mt-1 rounded-full bg-primary/10 p-2 text-primary"><Check size={15} /></span><div className="min-w-0 flex-1"><div className="flex flex-col justify-between gap-1 sm:flex-row"><p className="font-semibold">{entry.type === "created" ? "Registro inicial" : "Actualización"}</p><time className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleString("es-CR")}</time></div><p className="mt-1 text-sm">Por {entry.user || "Usuario actual"}</p>{entry.changes.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Cambios: {entry.changes.join(", ")}</p>}{entry.note && <p className="mt-2 text-sm text-muted-foreground">{entry.note}</p>}{entry.observations && <p className="mt-1 text-sm text-muted-foreground">Observaciones: {entry.observations}</p>}</div></div>)}</div></CardContent></Card>}
    </section>
  );
}
