import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireServerRole } from "@/lib/server-rbac";
import type { ChartDatum, GraphSummary, TeamGraphSummary } from "@/lib/graficas-types";

export const dynamic = "force-dynamic";

type RecordData = Record<string, unknown>;
type OwnedRecords = {
  properties: RecordData[];
  events: RecordData[];
  tasks: RecordData[];
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function assignedId(data: RecordData, kind: keyof OwnedRecords): string {
  if (kind === "properties") {
    return text(data.inmobiliarioId) || text(data.createdById) || text(data.createdBy);
  }
  return text(data.responsibleId) || text(data.createdById) || text(data.createdBy);
}

function groupBy(items: RecordData[], getLabel: (item: RecordData) => string, order?: string[]): ChartDatum[] {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const label = getLabel(item) || "Sin categoría";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  if (order) order.forEach((label) => { if (!counts.has(label)) counts.set(label, 0); });
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => {
      if (order) return order.indexOf(left.label) - order.indexOf(right.label);
      return right.value - left.value || left.label.localeCompare(right.label, "es-CR");
    });
}

function summarize(records: OwnedRecords): GraphSummary {
  const propertyStatus = groupBy(
    records.properties,
    (item) => item.status === "Inactiva" ? "Inactivas" : "Activas",
    ["Activas", "Inactivas"],
  );
  const eventStatus = groupBy(
    records.events,
    (item) => item.status === "Completado" ? "Completados" : item.status === "Cancelado" ? "Cancelados" : "Pendientes",
    ["Pendientes", "Completados", "Cancelados"],
  );
  const taskStatus = groupBy(
    records.tasks,
    (item) => item.status === "Completada" ? "Completadas" : item.status === "En progreso" ? "En progreso" : "Pendientes",
    ["Pendientes", "En progreso", "Completadas"],
  );
  const allRegions = groupBy(
    records.properties,
    (item) => text(item.region) || text(item.province) || text(item.canton),
  );
  const propertiesByRegion = allRegions.length <= 8
    ? allRegions
    : [
      ...allRegions.slice(0, 7),
      { label: "Otras regiones", value: allRegions.slice(7).reduce((sum, item) => sum + item.value, 0) },
    ];
  const eventsByType = groupBy(records.events, (item) => text(item.kind));

  return {
    properties: records.properties.length,
    events: records.events.length,
    tasks: records.tasks.length,
    propertyStatus,
    eventStatus,
    taskStatus,
    propertiesByRegion,
    eventsByType,
  };
}

function recordsOwnedBy(data: OwnedRecords, uid: string): OwnedRecords {
  return {
    properties: data.properties.filter((item) => assignedId(item, "properties") === uid),
    events: data.events.filter((item) => assignedId(item, "events") === uid),
    tasks: data.tasks.filter((item) => item.recordType === "task" && assignedId(item, "tasks") === uid),
  };
}

function countAssigned(data: OwnedRecords, uid: string) {
  return recordsOwnedBy(data, uid);
}

export async function GET(request: Request) {
  try {
    const { token, role } = await requireServerRole(request);
    const db = adminDb();
    const [propertySnapshot, eventSnapshot, activitySnapshot] = await Promise.all([
      db.collection("propiedades").get(),
      db.collection("eventos").get(),
      db.collection("actividad").get(),
    ]);
    const records: OwnedRecords = {
      properties: propertySnapshot.docs.map((item) => item.data()),
      events: eventSnapshot.docs.map((item) => item.data()),
      tasks: activitySnapshot.docs.map((item) => item.data()).filter((item) => item.recordType === "task"),
    };
    const includeTeam = role === "ADMIN" || role === "SUPERVISOR";

    let team: TeamGraphSummary[] | null = null;
    if (includeTeam) {
      const userSnapshot = await db.collection("inmobiliarios").get();
      team = userSnapshot.docs.map((userDocument) => {
        const metrics = countAssigned(records, userDocument.id);
        const data = userDocument.data();
        return {
          uid: userDocument.id,
          name: text(data.name) || "Usuario sin nombre",
          role: text(data.role) || "AGENTE",
          properties: metrics.properties.length,
          events: metrics.events.length,
          tasks: metrics.tasks.length,
        };
      }).sort((left, right) => left.name.localeCompare(right.name, "es-CR"));
    }

    return NextResponse.json({
      general: summarize(records),
      personal: summarize(recordsOwnedBy(records, token.uid)),
      team,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Autenticación requerida." }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "No tenés permiso para consultar las gráficas." }, { status: 403 });
    }
    console.error("No se pudieron cargar las gráficas:", error);
    return NextResponse.json({ error: "No se pudieron cargar las gráficas." }, { status: 500 });
  }
}
