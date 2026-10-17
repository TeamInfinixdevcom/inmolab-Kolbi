import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "..");
const generatedSource = await readFile(join(root, "lib", "avatar-catalog.generated.ts"), "utf8");
const json = generatedSource.slice(generatedSource.indexOf("["), generatedSource.lastIndexOf("]") + 1);
const catalog = JSON.parse(json);
const sourceFiles = await readdir(join(root, "public", "perfiles"));
const expectedFiles = sourceFiles.filter((name) => /^avatar\s+prof\s+\d+\.png$/i.test(name));

test("el catálogo conserva un identificador central y todas las imágenes originales", async () => {
  assert.equal(catalog.length, expectedFiles.length);
  assert.ok(catalog.length > 0);
  assert.equal(new Set(catalog.map((avatar) => avatar.id)).size, catalog.length);

  for (const avatar of catalog) {
    assert.match(avatar.id, /^avatar-prof-\d+$/);
    const originalPath = join(root, "public", decodeURIComponent(avatar.src.replace(/^\//, "")));
    assert.equal((await stat(originalPath)).isFile(), true);
  }
});

test("el catálogo incluye y resuelve nombres de imagen con espacios", () => {
  const pathsWithSpaces = catalog.filter((avatar) => decodeURIComponent(avatar.src).includes(" "));
  assert.ok(pathsWithSpaces.length > 0);
  assert.ok(pathsWithSpaces.every((avatar) => avatar.src.includes("%20")));
});

test("el servidor valida el avatar y escribe únicamente en el documento del usuario autenticado", async () => {
  const route = await readFile(join(root, "app", "api", "avatar", "route.ts"), "utf8");
  assert.match(route, /if\s*\(!isAvatarId\(body\.avatarId\)\)/);
  assert.match(route, /\.collection\("inmobiliarios"\)\s*\.doc\(token\.uid\)/);
  assert.match(route, /\.set\(\{\s*avatarId:\s*body\.avatarId\s*\},\s*\{\s*merge:\s*true\s*\}\)/);
});

test("perfil, sidebar y mapa conservan el avatar compartido y marcadores DOM seguros", async () => {
  const [profile, sidebar, map] = await Promise.all([
    readFile(join(root, "app", "perfil", "page.tsx"), "utf8"),
    readFile(join(root, "components", "layout", "sidebar.tsx"), "utf8"),
    readFile(join(root, "components", "mapa", "real-map.tsx"), "utf8"),
  ]);

  assert.match(profile, /AvatarImage/);
  assert.match(profile, /\/api\/avatar/);
  assert.match(sidebar, /AvatarImage/);
  assert.match(sidebar, /avatarId/);
  assert.match(map, /getOptimizedAvatarSrc/);
  assert.match(map, /avatarPins\[marker\.id\]/);
  assert.match(map, /label\.textContent\s*=\s*emoji/);
  assert.doesNotMatch(map, /dangerouslySetInnerHTML|\.innerHTML\s*=/);
});
