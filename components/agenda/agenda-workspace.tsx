"use client";

import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListChecks,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import { useRBAC } from "@/components/auth/rbac-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { creationAudit, updateAudit } from "@/lib/firestore-audit";
import { db } from "@/lib/firebase";
import { formatActivityDate, formatEventDateTime, getCostaRicaDateTime, isEventInPast, isTaskOverdue, isValidDateTime } from "@/lib/agenda";
import { hasPermission } from "@/lib/rbac";
import { statusBadgeClass } from "@/lib/status-colors";

type AgendaView = "tareas" | "eventos" | "actividad";
type TaskStatus = "Pendiente" | "En progreso" | "Completada";
type TaskPriority = "Baja" | "Media" | "Alta";
type EventStatus = "Pendiente" | "Completado" | "Cancelado";
type AgentOption = { id: string; name: string; email: string };
type PropertyOption = { id: string; name: string };
type TaskHistory = { id: string; type: string; date: string; user: string; note: string };
type TaskItem = {
  id: string;
  recordType: "task";
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  responsibleId: string;
  responsible: string;
  dueDate: string;
  history: TaskHistory[];
  createdBy?: string;
};
type ActivityItem = {
  id: string;
  type: string;
  description: string;
  subject: string;
  date: unknown;
  user: string;
  recordType?: string;
};
type EventItem = {
  id: string;
  title: string;
  description: string;
  kind: string;
  date: string;
  time: string;
  status: EventStatus;
  responsible: string;
  responsibleId: string;
  participantIds: string[];
  participantNames: string[];
  client: string;
  property: string;
  notes: string;
  createdBy?: string;
};

type TaskForm = Omit<TaskItem, "id" | "recordType" | "history" | "createdBy">;
type EventForm = Omit<EventItem, "id" | "createdBy">;
type ActivityForm = { type: string; subject: string; description: string };
type EventScope = "upcoming" | "past" | "all";

const taskStatuses: TaskStatus[] = ["Pendiente", "En progreso", "Completada"];
const taskPriorities: TaskPriority[] = ["Baja", "Media", "Alta"];
const eventStatuses: EventStatus[] = ["Pendiente", "Completado", "Cancelado"];
const activityTypes = ["Visita", "Llamada", "Reunión", "Gestión"];
const emptyTask: TaskForm = { title: "", description: "", status: "Pendiente", priority: "Media", responsibleId: "", responsible: "", dueDate: "" };
const emptyEvent = (): EventForm => ({
  title: "", description: "", kind: "Reunión", ...getCostaRicaDateTime(), status: "Pendiente",
  responsible: "", responsibleId: "", participantIds: [], participantNames: [], client: "", property: "", notes: "",
});
const emptyActivity: ActivityForm = { type: "Visita", subject: "", description: "" };

const fieldClass = "mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-primary";
const textareaClass = "mt-2 w-full rounded-md border bg-background px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-primary";

function text(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function taskStatus(value: unknown): TaskStatus {
  return value === "En progreso" || value === "Completada" ? value : "Pendiente";
}

function taskPriority(value: unknown): TaskPriority {
  return value === "Baja" || value === "Alta" ? value : "Media";
}

function taskColumnTone(status: TaskStatus): string {
  if (status === "En progreso") return "border-[#cfe1d2] bg-[#edf5ee] text-[#28583b]";
  if (status === "Completada") return "border-[#d1e3e1] bg-[#eef5f3] text-[#24534c]";
  return "border-[#e9dfc5] bg-[#faf6e9] text-[#705d2c]";
}

function taskPriorityTone(priority: TaskPriority): string {
  if (priority === "Alta") return "bg-[#f7e7de] text-[#8e4d32]";
  if (priority === "Baja") return "bg-[#e9f0e8] text-[#58705c]";
  return "bg-[#f5efd9] text-[#7b6425]";
}

function eventKindTone(kind: string): { badge: string; dot: string; border: string } {
  const value = kind.toLocaleLowerCase("es-CR");
  if (value.includes("visita")) return { badge: "border-[#cfe3d2] bg-[#e9f4e9] text-[#28613c]", dot: "bg-[#4e8e5b]", border: "border-l-[#4e8e5b]" };
  if (value.includes("llamada")) return { badge: "border-[#eadbb5] bg-[#f5efd9] text-[#735d1f]", dot: "bg-[#b08a37]", border: "border-l-[#b08a37]" };
  if (value.includes("seguimiento")) return { badge: "border-[#f0d6c5] bg-[#f8e9de] text-[#8d5635]", dot: "bg-[#c4774d]", border: "border-l-[#c4774d]" };
  return { badge: "border-[#d1e3e1] bg-[#eaf2ef] text-[#24534c]", dot: "bg-[#3e7767]", border: "border-l-[#3e7767]" };
}

function eventStatus(value: unknown): EventStatus {
  return value === "Completado" || value === "Cancelado" ? value : "Pendiente";
}

function taskHistory(value: unknown): TaskHistory[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const data = entry as Record<string, unknown>;
    return [{
      id: text(data.id) || `${text(data.date)}-${text(data.type)}`,
      type: text(data.type) || "Actualización",
      date: text(data.date),
      user: text(data.user) || "Usuario",
      note: text(data.note),
    }];
  });
}

function calendarDays(month: string): Array<{ date: string; inMonth: boolean }> {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, monthNumber - 1, 1 - mondayOffset));
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const value = date.toISOString().slice(0, 10);
    return { date: value, inMonth: value.slice(0, 7) === month };
  });
}

function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  return new Intl.DateTimeFormat("es-CR", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function moveMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7);
}

function monthDay(date: string): string {
  return String(Number(date.slice(8, 10)));
}

function eventDisplayName(event: EventItem): string {
  const names = event.participantNames.length > 0 ? event.participantNames : event.participantIds;
  return [...names, event.client].filter(Boolean).join(", ");
}

export function AgendaWorkspace({ initialView = "tareas" }: Readonly<{ initialView?: AgendaView }>) {
  const { role, user } = useRBAC();
  const canReadTasks = hasPermission(role, "actividad", "read");
  const canCreateTasks = hasPermission(role, "actividad", "create");
  const canUpdateTasks = hasPermission(role, "actividad", "update");
  const canReadEvents = hasPermission(role, "eventos", "read");
  const canCreateEvents = hasPermission(role, "eventos", "create");
  const canUpdateEvents = hasPermission(role, "eventos", "update");
  const [view, setView] = useState<AgendaView>(initialView);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(Boolean(db));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(db ? "" : "Firebase no está configurado.");
  const [notice, setNotice] = useState("");
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTask);
  const [eventForm, setEventForm] = useState<EventForm>(emptyEvent);
  const [activityForm, setActivityForm] = useState<ActivityForm>(emptyActivity);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [taskQuery, setTaskQuery] = useState("");
  const [eventQuery, setEventQuery] = useState("");
  const [activityQuery, setActivityQuery] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("Todas");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState("Todos");
  const [taskDueDateFilter, setTaskDueDateFilter] = useState("");
  const [eventScope, setEventScope] = useState<EventScope>("upcoming");
  const [calendarMonth, setCalendarMonth] = useState(() => getCostaRicaDateTime().date.slice(0, 7));
  const [selectedEventDate, setSelectedEventDate] = useState("");
  const [clock, setClock] = useState(() => getCostaRicaDateTime());

  useEffect(() => {
    const interval = window.setInterval(() => setClock(getCostaRicaDateTime()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!db) return;
    let active = true;
    const pendingSources = new Set(["actividad", "eventos", "responsables", "propiedades"]);
    const unsubscribeAll: Array<() => void> = [];
    const finishLoad = (source: string) => {
      pendingSources.delete(source);
      if (active && pendingSources.size === 0) setLoading(false);
    };
    const fail = (label: string, source: string) => (loadError: Error) => {
      console.error(`No se pudieron cargar ${label}.`, loadError);
      if (active) setError(`No se pudieron cargar ${label}. Revisa las reglas y la configuración de Firestore.`);
      finishLoad(source);
    };

    unsubscribeAll.push(onSnapshot(collection(db, "actividad"), (snapshot) => {
      const taskItems: TaskItem[] = [];
      const activityItems: ActivityItem[] = [];
      snapshot.docs.forEach((item) => {
        const data = item.data();
        if (data.recordType === "task") {
          taskItems.push({
            id: item.id,
            recordType: "task",
            title: text(data.title) || "Tarea sin título",
            description: text(data.description),
            status: taskStatus(data.status),
            priority: taskPriority(data.priority),
            responsibleId: text(data.responsibleId) || text(data.userId),
            responsible: text(data.responsible) || text(data.user) || "Sin responsable",
            dueDate: text(data.dueDate),
            history: taskHistory(data.history),
            createdBy: text(data.createdBy) || undefined,
          });
        } else {
          activityItems.push({
            id: item.id,
            type: text(data.type) || "Gestión",
            description: text(data.description),
            subject: text(data.subject),
            date: data.date ?? data.createdAt,
            user: text(data.user) || text(data.userId) || "Usuario",
            recordType: text(data.recordType) || undefined,
          });
        }
      });
      if (active) {
        setTasks(taskItems.sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
        setActivities(activityItems);
      }
      finishLoad("actividad");
    }, fail("tareas y actividad", "actividad")));

    unsubscribeAll.push(onSnapshot(collection(db, "eventos"), (snapshot) => {
      const loaded = snapshot.docs.map((item) => {
        const data = item.data();
        const participantIds = Array.isArray(data.participantIds) ? data.participantIds.map(text).filter(Boolean) : [];
        const participantNames = Array.isArray(data.participantNames) ? data.participantNames.map(text).filter(Boolean) : [];
        return {
          id: item.id,
          title: text(data.title) || "Evento sin título",
          description: text(data.description),
          kind: text(data.kind) || "Reunión",
          date: text(data.date),
          time: text(data.time),
          status: eventStatus(data.status),
          responsible: text(data.responsible) || "Sin responsable",
          responsibleId: text(data.responsibleId),
          participantIds,
          participantNames,
          client: text(data.client),
          property: text(data.property),
          notes: text(data.notes),
          createdBy: text(data.createdBy) || undefined,
        } satisfies EventItem;
      });
      if (active) setEvents(loaded.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)));
      finishLoad("eventos");
    }, fail("eventos", "eventos")));

    unsubscribeAll.push(onSnapshot(collection(db, "inmobiliarios"), (snapshot) => {
      if (active) setAgents(snapshot.docs.map((item) => ({
        id: item.id,
        name: text(item.data().name) || text(item.data().email) || "Usuario",
        email: text(item.data().email),
      })));
      finishLoad("responsables");
    }, fail("responsables", "responsables")));

    unsubscribeAll.push(onSnapshot(collection(db, "propiedades"), (snapshot) => {
      if (active) setProperties(snapshot.docs.map((item) => ({
        id: item.id,
        name: text(item.data().condominiumName) || text(item.data().title) || "Propiedad",
      })));
      finishLoad("propiedades");
    }, fail("propiedades", "propiedades")));

    return () => {
      active = false;
      unsubscribeAll.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const agentName = (id: string) => agents.find((agent) => agent.id === id)?.name
    ?? (id === user?.uid ? user.displayName ?? user.email ?? "Usuario actual" : "Responsable anterior");

  const visibleTasks = useMemo(() => tasks.filter((task) => {
    const matchesText = `${task.title} ${task.description} ${task.responsible} ${task.priority}`.toLowerCase().includes(taskQuery.toLowerCase());
    return matchesText
      && (taskStatusFilter === "Todas" || task.status === taskStatusFilter)
      && (taskAssigneeFilter === "Todos" || task.responsibleId === taskAssigneeFilter)
      && (!taskDueDateFilter || task.dueDate === taskDueDateFilter);
  }), [tasks, taskAssigneeFilter, taskDueDateFilter, taskQuery, taskStatusFilter]);

  const filteredEvents = useMemo(() => events.filter((event) => {
    const matchesDate = selectedEventDate
      ? event.date === selectedEventDate
      : eventScope === "all"
        || (eventScope === "past" ? isEventInPast(event, clock) : !isEventInPast(event, clock) && event.status !== "Cancelado");
    const haystack = `${event.title} ${event.kind} ${event.responsible} ${event.client} ${event.property} ${event.description} ${event.notes} ${event.participantNames.join(" ")}`.toLowerCase();
    return matchesDate && haystack.includes(eventQuery.toLowerCase());
  }), [clock, eventQuery, eventScope, events, selectedEventDate]);

  const calendarEvents = useMemo(() => events.filter((event) => eventScope === "all"
    || (eventScope === "past" ? isEventInPast(event, clock) : !isEventInPast(event, clock) && event.status !== "Cancelado")), [clock, eventScope, events]);
  const visibleActivities = useMemo(() => activities.filter((item) =>
    `${item.type} ${item.subject} ${item.description} ${item.user}`.toLowerCase().includes(activityQuery.toLowerCase()),
  ), [activities, activityQuery]);
  const monthDays = useMemo(() => calendarDays(calendarMonth), [calendarMonth]);

  function taskCanEdit(task: TaskItem): boolean {
    return canUpdateTasks && (role !== "AGENTE" || task.responsibleId === user?.uid);
  }

  function openNewTask() {
    setEditingTask(null);
    const id = user?.uid ?? "";
    setTaskForm({ ...emptyTask, responsibleId: id, responsible: agentName(id) });
    setError("");
    setNotice("");
    setShowTaskForm(true);
  }

  function openEditTask(task: TaskItem) {
    if (!taskCanEdit(task)) return;
    setEditingTask(task.id);
    setTaskForm({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      responsibleId: task.responsibleId,
      responsible: task.responsible,
      dueDate: task.dueDate,
    });
    setError("");
    setNotice("");
    setShowTaskForm(true);
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !user) { setError("Iniciá sesión para guardar tareas."); return; }
    if (!taskForm.title.trim()) { setError("El título de la tarea es obligatorio."); return; }
    if (!taskForm.responsibleId) { setError("Seleccioná un responsable."); return; }
    if (role === "AGENTE" && taskForm.responsibleId !== user.uid) { setError("Solo podés asignar tareas a tu usuario."); return; }
    if (taskForm.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(taskForm.dueDate)) { setError("La fecha límite no es válida."); return; }

    setSaving(true);
    setError("");
    setNotice("");
    const responsible = agentName(taskForm.responsibleId);
    const payload = {
      ...taskForm,
      recordType: "task",
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      responsible,
      dueDate: taskForm.dueDate || "",
    };
    const actorName = user.displayName ?? user.email ?? "Usuario actual";
    try {
      if (editingTask) {
        const task = tasks.find((item) => item.id === editingTask);
        if (!task || !taskCanEdit(task)) throw new Error("FORBIDDEN");
        const entry: TaskHistory = {
          id: crypto.randomUUID(),
          type: "Actualización",
          date: new Date().toISOString(),
          user: actorName,
          note: "Se actualizaron los datos de la tarea.",
        };
        await updateDoc(doc(db, "actividad", editingTask), { ...payload, ...updateAudit(user.uid), history: arrayUnion(entry) });
        setNotice("Tarea actualizada.");
      } else {
        const entry: TaskHistory = {
          id: crypto.randomUUID(),
          type: "Creación",
          date: new Date().toISOString(),
          user: actorName,
          note: "Tarea creada.",
        };
        await addDoc(collection(db, "actividad"), {
          ...payload,
          history: [entry],
          userId: user.uid,
          user: actorName,
          ...creationAudit(user.uid),
        });
        setNotice("Tarea creada.");
      }
      setShowTaskForm(false);
      setEditingTask(null);
      setTaskForm(emptyTask);
    } catch (saveError) {
      console.error("No se pudo guardar la tarea.", saveError);
      setError(saveError instanceof Error && saveError.message === "FORBIDDEN"
        ? "No tenés permiso para editar esta tarea."
        : "No se pudo guardar la tarea. Verifica los permisos de Firestore.");
    } finally {
      setSaving(false);
    }
  }

  async function changeTaskStatus(task: TaskItem, status: TaskStatus) {
    if (!db || !user || !taskCanEdit(task) || task.status === status) return;
    const reference = doc(db, "actividad", task.id);
    const entry: TaskHistory = {
      id: crypto.randomUUID(),
      type: "Estado actualizado",
      date: new Date().toISOString(),
      user: user.displayName ?? user.email ?? "Usuario actual",
      note: `Estado cambiado a ${status}.`,
    };
    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists()) throw new Error("NOT_FOUND");
        const latest = snapshot.data();
        if (latest.recordType !== "task") throw new Error("NOT_TASK");
        if (role === "AGENTE" && latest.responsibleId !== user.uid) throw new Error("FORBIDDEN");
        if (latest.status === status) return;
        transaction.update(reference, { status, ...updateAudit(user.uid), history: arrayUnion(entry) });
      });
    } catch (statusError) {
      console.error("No se pudo cambiar el estado de la tarea.", statusError);
      setError("No se pudo cambiar el estado. Actualizá la página y revisá tus permisos.");
    }
  }

  function openNewEvent() {
    setEditingEvent(null);
    const value = emptyEvent();
    if (user) {
      value.responsibleId = user.uid;
      value.responsible = agentName(user.uid);
    }
    setEventForm(value);
    setError("");
    setNotice("");
    setShowEventForm(true);
  }

  function openEditEvent(event: EventItem) {
    setEditingEvent(event.id);
    setEventForm({
      title: event.title,
      description: event.description,
      kind: event.kind,
      date: event.date,
      time: event.time,
      status: event.status,
      responsible: event.responsible,
      responsibleId: event.responsibleId,
      participantIds: event.participantIds,
      participantNames: event.participantNames,
      client: event.client,
      property: event.property,
      notes: event.notes,
    });
    setError("");
    setNotice("");
    setShowEventForm(true);
  }

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !user) { setError("Iniciá sesión para guardar eventos."); return; }
    if (!eventForm.title.trim() || !isValidDateTime(eventForm.date, eventForm.time)) {
      setError("Completá el título, una fecha válida y una hora válida.");
      return;
    }
    const responsibleId = eventForm.responsibleId || user.uid;
    if (role === "AGENTE" && editingEvent) {
      const current = events.find((item) => item.id === editingEvent);
      if (!current || current.createdBy !== user.uid) { setError("No tenés permiso para editar este evento."); return; }
    }

    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      ...eventForm,
      title: eventForm.title.trim(),
      description: eventForm.description.trim(),
      responsibleId,
      responsible: agentName(responsibleId),
      participantIds: eventForm.participantIds,
      participantNames: eventForm.participantIds.map(agentName),
      client: eventForm.client.trim(),
      property: eventForm.property.trim(),
      notes: eventForm.notes.trim(),
    };
    try {
      if (editingEvent) {
        const current = events.find((item) => item.id === editingEvent);
        if (!current || (role === "AGENTE" && current.createdBy !== user.uid)) throw new Error("FORBIDDEN");
        await updateDoc(doc(db, "eventos", editingEvent), { ...payload, ...updateAudit(user.uid) });
        setNotice("Evento actualizado.");
      } else {
        await addDoc(collection(db, "eventos"), { ...payload, ...creationAudit(user.uid) });
        setNotice("Evento programado.");
      }
      setShowEventForm(false);
      setEditingEvent(null);
    } catch (saveError) {
      console.error("No se pudo guardar el evento.", saveError);
      setError(saveError instanceof Error && saveError.message === "FORBIDDEN"
        ? "No tenés permiso para editar este evento."
        : "No se pudo guardar el evento. Verifica los permisos de Firestore.");
    } finally {
      setSaving(false);
    }
  }

  async function changeEventStatus(event: EventItem, status: EventStatus) {
    if (!db || !user || !canUpdateEvents || event.status === status) return;
    if (role === "AGENTE" && event.createdBy !== user.uid) { setError("No tenés permiso para actualizar este evento."); return; }
    try {
      await updateDoc(doc(db, "eventos", event.id), { status, ...updateAudit(user.uid) });
    } catch (statusError) {
      console.error("No se pudo actualizar el evento.", statusError);
      setError("No se pudo actualizar el evento. Verifica los permisos de Firestore.");
    }
  }

  async function submitActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db || !user) { setError("Iniciá sesión para registrar actividad."); return; }
    if (!activityForm.description.trim()) { setError("La descripción de la actividad es obligatoria."); return; }
    setSaving(true);
    setError("");
    try {
      await addDoc(collection(db, "actividad"), {
        ...activityForm,
        description: activityForm.description.trim(),
        subject: activityForm.subject.trim(),
        date: new Date().toISOString(),
        user: user.displayName ?? user.email ?? "Usuario actual",
        userId: user.uid,
        ...creationAudit(user.uid),
      });
      setActivityForm(emptyActivity);
      setShowActivityForm(false);
      setNotice("Actividad registrada en la bitácora.");
    } catch (saveError) {
      console.error("No se pudo registrar la actividad.", saveError);
      setError("No se pudo registrar la actividad. Verifica los permisos de Firestore.");
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ id: AgendaView; label: string; icon: typeof ListChecks; visible: boolean }> = [
    { id: "tareas", label: "Tareas", icon: ListChecks, visible: canReadTasks },
    { id: "eventos", label: "Eventos", icon: CalendarDays, visible: canReadEvents },
    { id: "actividad", label: "Bitácora de actividad", icon: Activity, visible: canReadTasks },
  ];
  const activeView = tabs.some((tab) => tab.id === view && tab.visible)
    ? view
    : tabs.find((tab) => tab.visible)?.id ?? "tareas";

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Planificación y seguimiento</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Agenda y actividad</h1>
        <p className="mt-2 text-muted-foreground">Organizá tareas, programá eventos y consultá el registro histórico de actividad.</p>
      </header>

      <div role="tablist" aria-label="Vistas de agenda" className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.filter((tab) => tab.visible).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeView === id}
            aria-controls={`agenda-panel-${id}`}
            onClick={() => { setView(id); setError(""); setNotice(""); }}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${activeView === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Icon size={16} />{label}
          </button>
        ))}
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}

      {activeView === "tareas" && (
        <div id="agenda-panel-tareas" role="tabpanel" className="space-y-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground">Las tareas se agrupan por estado. Las completadas conservan su historial.</p>
            {canCreateTasks && <Button onClick={openNewTask}><Plus size={16} className="mr-2" />Nueva tarea</Button>}
          </div>

          <Card>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative sm:col-span-2 lg:col-span-1"><Search size={15} className="absolute left-3 top-3 text-muted-foreground" /><input aria-label="Buscar tareas" value={taskQuery} onChange={(event) => setTaskQuery(event.target.value)} placeholder="Buscar tarea..." className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm" /></div>
              <select aria-label="Filtrar tareas por estado" value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="Todas">Todos los estados</option>{taskStatuses.map((status) => <option key={status}>{status}</option>)}</select>
              <select aria-label="Filtrar tareas por responsable" value={taskAssigneeFilter} onChange={(event) => setTaskAssigneeFilter(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="Todos">Todos los responsables</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select>
              <label className="text-xs text-muted-foreground">Fecha límite<input aria-label="Filtrar por fecha límite" type="date" value={taskDueDateFilter} onChange={(event) => setTaskDueDateFilter(event.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground" /></label>
            </CardContent>
          </Card>

          {showTaskForm && (
            <Card>
              <CardHeader className="flex-row items-center justify-between"><CardTitle>{editingTask ? "Editar tarea" : "Nueva tarea"}</CardTitle><Button type="button" variant="ghost" size="icon" onClick={() => setShowTaskForm(false)} aria-label="Cerrar formulario"><X size={18} /></Button></CardHeader>
              <CardContent>
                <form onSubmit={submitTask} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-sm font-medium sm:col-span-2">Título<input required maxLength={160} value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} className={fieldClass} /></label>
                  <label className="text-sm font-medium">Prioridad<select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value as TaskPriority })} className={fieldClass}>{taskPriorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
                  <label className="text-sm font-medium">Responsable<select required disabled={role === "AGENTE"} value={taskForm.responsibleId} onChange={(event) => setTaskForm({ ...taskForm, responsibleId: event.target.value, responsible: agentName(event.target.value) })} className={fieldClass}>
                    {!taskForm.responsibleId && <option value="">Seleccionar responsable</option>}
                    {taskForm.responsibleId && !agents.some((agent) => agent.id === taskForm.responsibleId) && <option value={taskForm.responsibleId}>{taskForm.responsible}</option>}
                    {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                  </select></label>
                  <label className="text-sm font-medium">Fecha límite<input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} className={fieldClass} /></label>
                  {editingTask && <label className="text-sm font-medium">Estado<select value={taskForm.status} onChange={(event) => setTaskForm({ ...taskForm, status: event.target.value as TaskStatus })} className={fieldClass}>{taskStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>}
                  <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Descripción<textarea rows={3} value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} className={textareaClass} /></label>
                  <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3"><Button type="button" variant="outline" onClick={() => setShowTaskForm(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar tarea"}</Button></div>
                </form>
              </CardContent>
            </Card>
          )}

          {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Cargando tareas...</p> : (
            <div className="grid items-start gap-4 md:grid-cols-3">
              {taskStatuses.map((status) => {
                const inColumn = visibleTasks.filter((task) => task.status === status);
                return <section key={status} aria-label={`Tareas ${status}`} className={`min-h-48 rounded-xl border p-3 ${taskColumnTone(status)}`}>
                  <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">{status}<span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-foreground/70">{inColumn.length}</span></h2>
                  <div className="space-y-3">
                    {inColumn.map((task) => {
                      const overdue = isTaskOverdue(task, clock.date);
                      const canEdit = taskCanEdit(task);
                      return <article key={task.id} className={`rounded-lg border border-l-4 bg-card p-3 text-foreground shadow-sm ${overdue ? "border-red-300" : status === "Pendiente" ? "border-l-[#b08a37]" : status === "En progreso" ? "border-l-[#4e8e5b]" : "border-l-[#3e7767]"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <button type="button" onClick={() => setSelectedTask(task)} className="text-left font-semibold hover:text-primary">{task.title}</button>
                          {canEdit && <button type="button" onClick={() => openEditTask(task)} aria-label={`Editar tarea ${task.title}`} className="rounded p-1 text-muted-foreground hover:bg-muted"><Pencil size={15} /></button>}
                        </div>
                        {task.description && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className={`rounded-full px-2 py-1 ${taskPriorityTone(task.priority)}`}>Prioridad {task.priority.toLowerCase()}</span>
                          {overdue && <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 font-medium text-red-700"><AlertTriangle size={13} />Atrasada</span>}
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                          <p>Responsable: {task.responsible || "Sin asignar"}</p>
                          {task.dueDate && <p>Fecha límite: {task.dueDate}</p>}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                          <button type="button" onClick={() => setSelectedTask(task)} className="text-xs font-medium text-primary hover:underline">Ver historial</button>
                          {canEdit && <select aria-label={`Cambiar estado de ${task.title}`} value={task.status} onChange={(event) => void changeTaskStatus(task, event.target.value as TaskStatus)} className="h-8 rounded-md border bg-background px-2 text-xs">{taskStatuses.map((item) => <option key={item}>{item}</option>)}</select>}
                        </div>
                      </article>;
                    })}
                    {inColumn.length === 0 && <p className="rounded-lg border border-dashed bg-background/60 p-5 text-center text-xs text-muted-foreground">No hay tareas en esta columna.</p>}
                  </div>
                </section>;
              })}
            </div>
          )}
        </div>
      )}

      {activeView === "eventos" && (
        <div id="agenda-panel-eventos" role="tabpanel" className="space-y-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2" aria-label="Filtrar agenda">
              {(["upcoming", "past", "all"] as EventScope[]).map((scope) => <button key={scope} type="button" aria-pressed={eventScope === scope} onClick={() => { setEventScope(scope); setSelectedEventDate(""); }} className={`rounded-md px-3 py-2 text-sm ${eventScope === scope ? "bg-primary text-primary-foreground" : "border bg-background text-muted-foreground"}`}>{scope === "upcoming" ? "Próximos" : scope === "past" ? "Pasados" : "Todos"}</button>)}
            </div>
            {canCreateEvents && <Button onClick={openNewEvent}><Plus size={16} className="mr-2" />Nuevo evento</Button>}
          </div>

          {showEventForm && (
            <Card>
              <CardHeader className="flex-row items-center justify-between"><CardTitle>{editingEvent ? "Editar evento" : "Programar evento"}</CardTitle><Button type="button" variant="ghost" size="icon" onClick={() => setShowEventForm(false)} aria-label="Cerrar formulario"><X size={18} /></Button></CardHeader>
              <CardContent>
                <form onSubmit={submitEvent} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-sm font-medium sm:col-span-2">Título<input required maxLength={160} value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} className={fieldClass} /></label>
                  <label className="text-sm font-medium">Tipo<select value={eventForm.kind} onChange={(event) => setEventForm({ ...eventForm, kind: event.target.value })} className={fieldClass}><option>Reunión</option><option>Visita</option><option>Llamada</option><option>Seguimiento</option></select></label>
                  <label className="text-sm font-medium">Fecha<input required type="date" value={eventForm.date} onChange={(event) => setEventForm({ ...eventForm, date: event.target.value })} className={fieldClass} /></label>
                  <label className="text-sm font-medium">Hora<input required type="time" value={eventForm.time} onChange={(event) => setEventForm({ ...eventForm, time: event.target.value })} className={fieldClass} /></label>
                  <label className="text-sm font-medium">Responsable<select disabled={role === "AGENTE"} value={eventForm.responsibleId} onChange={(event) => setEventForm({ ...eventForm, responsibleId: event.target.value, responsible: agentName(event.target.value) })} className={fieldClass}>
                    <option value={user?.uid ?? ""}>Mi usuario</option>
                    {eventForm.responsibleId && eventForm.responsibleId !== user?.uid && !agents.some((agent) => agent.id === eventForm.responsibleId) && <option value={eventForm.responsibleId}>{eventForm.responsible}</option>}
                    {agents.filter((agent) => agent.id !== user?.uid).map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                  </select></label>
                  <label className="text-sm font-medium">Participantes del equipo<select multiple value={eventForm.participantIds} onChange={(event) => setEventForm({ ...eventForm, participantIds: Array.from(event.currentTarget.selectedOptions, (option) => option.value) })} className="mt-2 min-h-24 w-full rounded-md border bg-background px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-primary">{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><span className="mt-1 block text-xs font-normal text-muted-foreground">Usá Ctrl o Cmd para seleccionar varias personas.</span></label>
                  <label className="text-sm font-medium">Persona externa (opcional)<input maxLength={120} value={eventForm.client} onChange={(event) => setEventForm({ ...eventForm, client: event.target.value })} className={fieldClass} /><span className="mt-1 block text-xs font-normal text-muted-foreground">Conserva el nombre en el evento sin crear un registro de cliente.</span></label>
                  <label className="text-sm font-medium">Propiedad<select value={eventForm.property} onChange={(event) => setEventForm({ ...eventForm, property: event.target.value })} className={fieldClass}><option value="">Sin asociar</option>{properties.map((property) => <option key={property.id} value={property.name}>{property.name}</option>)}</select></label>
                  {editingEvent && <label className="text-sm font-medium">Estado<select value={eventForm.status} onChange={(event) => setEventForm({ ...eventForm, status: event.target.value as EventStatus })} className={fieldClass}>{eventStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>}
                  <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Descripción<textarea rows={3} value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} className={textareaClass} /></label>
                  <label className="text-sm font-medium sm:col-span-2 lg:col-span-3">Observaciones<textarea rows={2} value={eventForm.notes} onChange={(event) => setEventForm({ ...eventForm, notes: event.target.value })} className={textareaClass} /></label>
                  <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3"><Button type="button" variant="outline" onClick={() => setShowEventForm(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar evento"}</Button></div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div><CardTitle>Calendario y agenda</CardTitle><p className="mt-1 text-sm text-muted-foreground">Las horas se muestran en la zona horaria de Costa Rica.</p></div>
              <div className="relative"><Search size={15} className="absolute left-3 top-3 text-muted-foreground" /><input aria-label="Buscar eventos" value={eventQuery} onChange={(event) => setEventQuery(event.target.value)} placeholder="Buscar evento..." className="h-10 rounded-md border bg-background pl-9 pr-3 text-sm" /></div>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
              <div>
                <div className="mb-3 flex items-center justify-between gap-2"><Button type="button" size="icon" variant="outline" onClick={() => { setCalendarMonth(moveMonth(calendarMonth, -1)); setSelectedEventDate(""); }} aria-label="Mes anterior"><ChevronLeft size={17} /></Button><h2 className="font-semibold capitalize">{monthLabel(calendarMonth)}</h2><Button type="button" size="icon" variant="outline" onClick={() => { setCalendarMonth(moveMonth(calendarMonth, 1)); setSelectedEventDate(""); }} aria-label="Mes siguiente"><ChevronRight size={17} /></Button></div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">{["L", "M", "X", "J", "V", "S", "D"].map((day, index) => <span key={`${day}-${index}`} className="py-2" aria-label={["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][index]}>{day}</span>)}</div>
                <div className="grid grid-cols-7 gap-1">
                  {monthDays.map(({ date, inMonth }) => {
                    const dayEvents = calendarEvents.filter((event) => event.date === date);
                    const count = dayEvents.length;
                    const eventDots = [...new Set(dayEvents.map((event) => eventKindTone(event.kind).dot))].slice(0, 3);
                    return <button key={date} type="button" aria-label={`${date}${count ? `, ${count} eventos` : ""}`} aria-pressed={selectedEventDate === date} onClick={() => setSelectedEventDate(selectedEventDate === date ? "" : date)} className={`relative min-h-10 rounded-md text-sm transition-colors ${selectedEventDate === date ? "bg-primary text-primary-foreground" : inMonth ? "hover:bg-[#edf4ec]" : "text-muted-foreground/50 hover:bg-muted"}`}>
                      {monthDay(date)}{count > 0 && <span aria-hidden="true" className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-0.5">{eventDots.map((dot, index) => <span key={`${date}-${index}`} className={`h-1.5 w-1.5 rounded-full ${selectedEventDate === date ? "bg-primary-foreground" : dot}`} />)}</span>}
                    </button>;
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground" aria-label="Colores por tipo de evento">
                  {["Reunión", "Visita", "Llamada", "Seguimiento"].map((kind) => <span key={kind} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`h-2 w-2 rounded-full ${eventKindTone(kind).dot}`} />{kind}</span>)}
                </div>
                {selectedEventDate && <button type="button" onClick={() => setSelectedEventDate("")} className="mt-3 text-xs font-medium text-primary hover:underline">Quitar filtro de día · {selectedEventDate}</button>}
              </div>

              <div className="space-y-3">
                <h2 className="font-semibold">{selectedEventDate ? `Eventos del ${selectedEventDate}` : eventScope === "upcoming" ? "Próximos eventos" : eventScope === "past" ? "Eventos pasados" : "Todos los eventos"}</h2>
                {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Cargando eventos...</p> : filteredEvents.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No hay eventos para esta selección.</p> : <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
                  {filteredEvents.map((event) => {
                    const canEditEvent = canUpdateEvents && (role !== "AGENTE" || event.createdBy === user?.uid);
                    const past = isEventInPast(event, clock);
                    const kindTone = eventKindTone(event.kind);
                    return <article key={event.id} className={`rounded-lg border border-l-4 p-4 ${kindTone.border}`}>
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                        <div><p className="font-semibold">{event.title}</p><p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"><Clock3 size={14} />{formatEventDateTime(event.date, event.time)}<span className={`rounded-full border px-2 py-0.5 text-[11px] ${kindTone.badge}`}>{event.kind}</span></p></div>
                        <span className={`w-fit rounded-full px-2.5 py-1 text-xs ${statusBadgeClass(event.status)}`}>{event.status}{past ? " · Pasado" : " · Próximo"}</span>
                      </div>
                      {event.description && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{event.description}</p>}
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <p>Responsable: {event.responsible}</p>
                        {eventDisplayName(event) && <p>Participantes: {eventDisplayName(event)}</p>}
                        {event.property && <p>Propiedad: {event.property}</p>}
                        {event.notes && <p>Observaciones: {event.notes}</p>}
                      </div>
                      {canEditEvent && <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3"><Button type="button" variant="outline" size="sm" onClick={() => openEditEvent(event)}><Pencil size={14} className="mr-1.5" />Editar</Button>{event.status === "Pendiente" && <><Button type="button" variant="outline" size="sm" onClick={() => void changeEventStatus(event, "Completado")}><Check size={14} className="mr-1.5" />Completar</Button><Button type="button" variant="outline" size="sm" onClick={() => void changeEventStatus(event, "Cancelado")}>Cancelar evento</Button></>}</div>}
                    </article>;
                  })}
                </div>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeView === "actividad" && (
        <div id="agenda-panel-actividad" role="tabpanel" className="space-y-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><p className="text-sm text-muted-foreground">Registros anteriores conservados como bitácora de solo adición.</p>{canCreateTasks && <Button onClick={() => { setActivityForm(emptyActivity); setShowActivityForm(true); }}><Plus size={16} className="mr-2" />Registrar actividad</Button>}</div>
          <div className="relative"><Search size={15} className="absolute left-3 top-3 text-muted-foreground" /><input aria-label="Buscar actividad" value={activityQuery} onChange={(event) => setActivityQuery(event.target.value)} placeholder="Buscar en la bitácora..." className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm sm:max-w-sm" /></div>
          {showActivityForm && <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Registrar actividad</CardTitle><Button type="button" variant="ghost" size="icon" onClick={() => setShowActivityForm(false)} aria-label="Cerrar formulario"><X size={18} /></Button></CardHeader><CardContent><form onSubmit={submitActivity} className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Tipo<select value={activityForm.type} onChange={(event) => setActivityForm({ ...activityForm, type: event.target.value })} className={fieldClass}>{activityTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label className="text-sm font-medium">Persona o asunto<input value={activityForm.subject} onChange={(event) => setActivityForm({ ...activityForm, subject: event.target.value })} className={fieldClass} /></label><label className="text-sm font-medium sm:col-span-2">Descripción<textarea required rows={3} value={activityForm.description} onChange={(event) => setActivityForm({ ...activityForm, description: event.target.value })} className={textareaClass} /></label><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setShowActivityForm(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Registrar"}</Button></div></form></CardContent></Card>}
          <Card><CardHeader><CardTitle>Historial de actividad</CardTitle></CardHeader><CardContent>{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Cargando actividad...</p> : visibleActivities.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No hay actividad para mostrar.</p> : <div className="space-y-4">{visibleActivities.map((item) => <article key={item.id} className="flex gap-3 border-b pb-4 last:border-0"><span className="mt-1 rounded-full bg-primary/10 p-2 text-primary"><Activity size={16} /></span><div className="min-w-0 flex-1"><div className="flex flex-col justify-between gap-1 sm:flex-row"><p className="font-semibold">{item.type}{item.subject && ` · ${item.subject}`}</p><time className="text-xs text-muted-foreground">{formatActivityDate(item.date)}</time></div><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.description || "Sin descripción."}</p><p className="mt-2 text-xs text-muted-foreground">Registrado por {item.user}</p></div></article>)}</div>}</CardContent></Card>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="task-detail-title">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
            <CardHeader className="flex-row items-start justify-between"><div><p className="text-sm text-primary">Detalle de tarea</p><CardTitle id="task-detail-title" className="mt-1">{selectedTask.title}</CardTitle></div><Button type="button" variant="ghost" size="icon" onClick={() => setSelectedTask(null)} aria-label="Cerrar detalle"><X size={18} /></Button></CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{selectedTask.description || "Sin descripción."}</p>
              <div className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2"><p>Estado: <strong>{selectedTask.status}</strong></p><p>Prioridad: <strong>{selectedTask.priority}</strong></p><p>Responsable: <strong>{selectedTask.responsible}</strong></p><p>Fecha límite: <strong>{selectedTask.dueDate || "Sin fecha"}</strong></p></div>
              <div><h3 className="font-semibold">Historial</h3>{selectedTask.history.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No hay cambios registrados.</p> : <ol className="mt-3 space-y-3">{[...selectedTask.history].reverse().map((entry) => <li key={entry.id} className="border-l-2 border-primary/30 pl-3"><p className="text-sm font-medium">{entry.type}</p><p className="text-xs text-muted-foreground">{entry.date ? formatActivityDate(entry.date) : "Fecha no disponible"} · {entry.user}</p>{entry.note && <p className="mt-1 text-sm text-muted-foreground">{entry.note}</p>}</li>)}</ol>}</div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
