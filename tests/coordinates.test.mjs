import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/coordinates.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const coordinates = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("interpreta las coordenadas copiadas de Google Maps como latitud y longitud", () => {
  assert.deepEqual(
    coordinates.parseCoordinatePair("9.985405049140589, -84.10539207560959"),
    { latitude: 9.985405049140589, longitude: -84.10539207560959 },
  );
});

test("acepta espacios antes y después de la coma", () => {
  assert.deepEqual(
    coordinates.parseCoordinatePair("  9.9281 ,  -84.0907  "),
    { latitude: 9.9281, longitude: -84.0907 },
  );
});

test("rechaza pares incompletos y coordenadas fuera del rango geográfico", () => {
  assert.equal(coordinates.parseCoordinatePair("9.9281"), null);
  assert.equal(coordinates.parseCoordinatePair("91, -84"), null);
  assert.equal(coordinates.parseCoordinatePair("9, -181"), null);
});
