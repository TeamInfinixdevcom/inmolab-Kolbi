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
    projectId: "inmolab-kolbi-rules-test",
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
});
