import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

const source = await readFile(new URL("../lib/agenda.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const agenda = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("una tarea con fecha límite pasada y estado abierto se marca atrasada", () => {
  assert.equal(agenda.isTaskOverdue({ status: "Pendiente", dueDate: "2026-10-15" }, "2026-10-16"), true);
  assert.equal(agenda.isTaskOverdue({ status: "En progreso", dueDate: "2026-10-15" }, "2026-10-16"), true);
});

test("una tarea completada no se marca atrasada aunque venciera antes", () => {
  assert.equal(agenda.isTaskOverdue({ status: "Completada", dueDate: "2026-10-01" }, "2026-10-16"), false);
});

test("una tarea sin fecha límite no se marca atrasada", () => {
  assert.equal(agenda.isTaskOverdue({ status: "Pendiente", dueDate: "" }, "2026-10-16"), false);
});

test("valida fecha y hora reales y rechaza fechas imposibles", () => {
  assert.equal(agenda.isValidDateTime("2026-02-28", "23:59"), true);
  assert.equal(agenda.isValidDateTime("2026-02-30", "12:00"), false);
  assert.equal(agenda.isValidDateTime("2026-02-28", "24:00"), false);
});

test("clasifica correctamente eventos pasados y futuros usando fecha y hora local", () => {
  const now = { date: "2026-10-16", time: "12:00" };
  assert.equal(agenda.isEventInPast({ date: "2026-10-16", time: "11:59" }, now), true);
  assert.equal(agenda.isEventInPast({ date: "2026-10-16", time: "12:00" }, now), false);
  assert.equal(agenda.isEventInPast({ date: "2026-10-16", time: "12:01" }, now), false);
});

test("usa la zona horaria de Costa Rica para la fecha operativa", () => {
  assert.deepEqual(
    agenda.getCostaRicaDateTime(new Date("2026-10-16T05:30:00.000Z")),
    { date: "2026-10-15", time: "23:30" },
  );
});

test("muestra un reemplazo seguro si una actividad antigua carece de fecha", () => {
  assert.equal(agenda.formatActivityDate(undefined), "Fecha no disponible");
  assert.match(agenda.formatActivityDate({ toDate: () => new Date("2026-10-16T12:00:00.000Z") }), /2026/);
});
