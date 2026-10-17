import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
let testEnvironment;

const condominium = (createdBy, assignedTo, createdByRole) => ({
  name: "Condominio de prueba",
  createdBy,
  assignedTo,
  createdByRole,
  updatedBy: createdBy,
  status: "Activa",
});

before(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId: "demo-inmolab-kolbi-rules-test",
    firestore: {
      rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8"),
    },
  });

  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await Promise.all([
      database.doc("users/agent-a").set({
        uid: "agent-a",
        email: "agent-a@example.com",
        displayName: "Agente A",
        role: "AGENTE",
      }),
      database.doc("users/agent-b").set({
        uid: "agent-b",
        email: "agent-b@example.com",
        displayName: "Agente B",
        role: "AGENTE",
      }),
      database.doc("users/admin").set({
        uid: "admin",
        email: "admin@example.com",
        displayName: "Admin",
        role: "ADMIN",
      }),
      database.doc("users/supervisor").set({
        uid: "supervisor",
        email: "supervisor@example.com",
        displayName: "Supervisor",
        role: "SUPERVISOR",
      }),
      database.doc("inmobiliarios/agent-a").set({
        name: "Agente A",
        email: "agent-a@example.com",
        role: "AGENTE",
      }),
      database.doc("inmobiliarios/agent-b").set({
        name: "Agente B",
        email: "agent-b@example.com",
        role: "AGENTE",
      }),
    ]);
  });
});

after(async () => {
  await testEnvironment.cleanup();
});

test("AGENTE puede crear, leer, editar y eliminar su propio condominio", async () => {
  const database = testEnvironment.authenticatedContext("agent-a", { role: "AGENTE" }).firestore();
  const reference = database.doc("condominios/agent-owned");

  await assertSucceeds(reference.set(condominium("agent-a", "agent-a", "AGENTE")));
  await assertSucceeds(reference.update({ name: "Actualizado por A", updatedBy: "agent-a" }));
  await assertSucceeds(reference.delete());
});

test("otro AGENTE puede leer, pero no editar ni eliminar, un registro de AGENTE", async () => {
  const ownerDatabase = testEnvironment.authenticatedContext("agent-a", { role: "AGENTE" }).firestore();
  const otherDatabase = testEnvironment.authenticatedContext("agent-b", { role: "AGENTE" }).firestore();
  const reference = ownerDatabase.doc("condominios/agent-owned-read");

  await assertSucceeds(reference.set(condominium("agent-a", "agent-a", "AGENTE")));
  await assertSucceeds(otherDatabase.doc("condominios/agent-owned-read").get());
  await assertFails(otherDatabase.doc("condominios/agent-owned-read").update({
    name: "Apropiado por B",
    updatedBy: "agent-b",
  }));
  await assertFails(otherDatabase.doc("condominios/agent-owned-read").delete());
});

test("AGENTE asignado por ADMIN puede editar, pero no reasignar, y el acceso cambia", async () => {
  const adminDatabase = testEnvironment.authenticatedContext("admin", { role: "ADMIN" }).firestore();
  const agentADatabase = testEnvironment.authenticatedContext("agent-a", { role: "AGENTE" }).firestore();
  const agentBDatabase = testEnvironment.authenticatedContext("agent-b", { role: "AGENTE" }).firestore();
  const reference = adminDatabase.doc("condominios/admin-owned");

  await assertSucceeds(reference.set(condominium("admin", "agent-a", "ADMIN")));
  await assertSucceeds(agentADatabase.doc("condominios/admin-owned").update({
    name: "Editado por responsable",
    updatedBy: "agent-a",
  }));
  await assertFails(agentADatabase.doc("condominios/admin-owned").update({
    assignedTo: "agent-b",
    updatedBy: "agent-a",
  }));
  await assertFails(agentADatabase.doc("condominios/admin-owned").update({
    createdBy: "agent-a",
    updatedBy: "agent-a",
  }));
  await assertFails(agentADatabase.doc("condominios/admin-owned").delete());

  await assertSucceeds(reference.update({
    assignedTo: "agent-b",
    assignedToName: "Agente B",
    assignedToEmail: "agent-b@example.com",
    updatedBy: "admin",
  }));
  await assertFails(agentADatabase.doc("condominios/admin-owned").update({
    name: "A ya no es responsable",
    updatedBy: "agent-a",
  }));
  await assertSucceeds(agentBDatabase.doc("condominios/admin-owned").update({
    name: "Editado por B",
    updatedBy: "agent-b",
  }));
  await assertSucceeds(agentADatabase.doc("condominios/admin-owned").get());
  await assertFails(
    agentADatabase.doc("condominios/admin-owned").delete()
  );
});


test("AGENTE puede consultar condominios asignados a otros agentes", async () => {
  const adminDatabase = testEnvironment
    .authenticatedContext("admin", { role: "ADMIN" })
    .firestore();

  const agentADatabase = testEnvironment
    .authenticatedContext("agent-a", { role: "AGENTE" })
    .firestore();

  await assertSucceeds(
    adminDatabase.doc("condominios/assigned-to-b").set(
      condominium("admin", "agent-b", "ADMIN")
    )
  );

  const snapshot = await assertSucceeds(
    agentADatabase.collection("condominios").get()
  );

  assert.ok(
    snapshot.docs.some((document) => document.id === "assigned-to-b"),
    "El agente debe poder consultar un condominio asignado a otro agente"
  );
});

const task = (createdBy, responsibleId) => ({
  recordType: "task",
  title: "Confirmar visita",
  description: "Coordinar hora con el responsable.",
  status: "Pendiente",
  priority: "Alta",
  responsible: responsibleId === "agent-a" ? "Agente A" : "Agente B",
  responsibleId,
  dueDate: "2026-10-20",
  history: [{ id: "created", type: "Creación", date: "2026-10-16T12:00:00.000Z", user: createdBy, note: "Tarea creada." }],
  createdBy,
  updatedBy: createdBy,
});

test("ADMIN puede crear una tarea asignada y el AGENTE asignado puede actualizar su estado", async () => {
  const adminDatabase = testEnvironment.authenticatedContext("admin", { role: "ADMIN" }).firestore();
  const agentDatabase = testEnvironment.authenticatedContext("agent-a", { role: "AGENTE" }).firestore();
  const reference = adminDatabase.doc("actividad/task-assigned");

  await assertSucceeds(reference.set(task("admin", "agent-a")));
  await assertSucceeds(agentDatabase.doc("actividad/task-assigned").update({
    status: "En progreso",
    history: [...task("admin", "agent-a").history, { id: "started", type: "Estado actualizado", date: "2026-10-16T13:00:00.000Z", user: "Agente A", note: "Estado cambiado a En progreso." }],
    updatedBy: "agent-a",
  }));
  await assertFails(agentDatabase.doc("actividad/task-assigned").update({
    history: task("admin", "agent-a").history,
    updatedBy: "agent-a",
  }));
  await assertFails(adminDatabase.doc("actividad/task-assigned").update({
    history: [],
    updatedBy: "admin",
  }));
});

test("un agente no puede crear ni reasignar una tarea a otro agente", async () => {
  const agentADatabase = testEnvironment.authenticatedContext("agent-a", { role: "AGENTE" }).firestore();
  const otherAgentDatabase = testEnvironment.authenticatedContext("agent-b", { role: "AGENTE" }).firestore();
  const incorrectlyAssigned = agentADatabase.doc("actividad/task-created-for-b");

  await assertFails(incorrectlyAssigned.set(task("agent-a", "agent-b")));

  const assignedToA = agentADatabase.doc("actividad/task-owned-by-a");
  await assertSucceeds(assignedToA.set(task("agent-a", "agent-a")));
  await assertFails(assignedToA.update({
    responsible: "Agente B",
    responsibleId: "agent-b",
    updatedBy: "agent-a",
  }));
  await assertFails(otherAgentDatabase.doc("actividad/task-owned-by-a").update({
    status: "Completada",
    updatedBy: "agent-b",
  }));
});

test("la aplicación ya no puede crear marcadores de referencia", async () => {
  const adminDatabase = testEnvironment.authenticatedContext("admin", { role: "ADMIN" }).firestore();
  await assertFails(adminDatabase.doc("mapa_marcadores/new-reference").set({
    title: "Punto de prueba",
    detail: "",
    latitude: 9.9,
    longitude: -84.1,
    createdBy: "admin",
    createdByName: "Admin",
    createdAt: new Date(),
  }));
});

const scheduledEvent = (createdBy, responsibleId) => ({
  title: "Visita de prueba",
  description: "Revisar la propiedad.",
  kind: "Visita",
  date: "2026-10-20",
  time: "10:30",
  status: "Pendiente",
  responsible: responsibleId === "agent-a" ? "Agente A" : "Agente B",
  responsibleId,
  participantIds: [],
  participantNames: [],
  client: "Persona externa",
  property: "Condominio de prueba",
  notes: "",
  createdBy,
  updatedBy: createdBy,
});

test("AGENTE puede programar su evento, pero no asignarlo a otro agente ni editar eventos ajenos", async () => {
  const agentADatabase = testEnvironment.authenticatedContext("agent-a", { role: "AGENTE" }).firestore();
  const agentBDatabase = testEnvironment.authenticatedContext("agent-b", { role: "AGENTE" }).firestore();
  const ownEvent = agentADatabase.doc("eventos/agent-a-event");

  await assertSucceeds(ownEvent.set(scheduledEvent("agent-a", "agent-a")));
  await assertFails(agentADatabase.doc("eventos/assigned-to-b").set(scheduledEvent("agent-a", "agent-b")));
  await assertFails(agentBDatabase.doc("eventos/agent-a-event").update({
    status: "Completado",
    updatedBy: "agent-b",
  }));
  await assertSucceeds(ownEvent.update({ status: "Completado", updatedBy: "agent-a" }));
});
