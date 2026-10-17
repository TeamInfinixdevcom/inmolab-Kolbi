import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = process.cwd();
const avatarDirectory = join(projectRoot, "public", "perfiles");
const outputFile = join(projectRoot, "lib", "avatar-catalog.generated.ts");
const files = await readdir(avatarDirectory, { withFileTypes: true });
const avatars = files.flatMap((entry) => {
  if (!entry.isFile()) return [];

  const match = /^avatar\s+prof\s+(\d+)\.png$/i.exec(entry.name);
  if (!match) return [];

  const number = Number(match[1]);
  return [{
    id: `avatar-prof-${number}`,
    name: `Avatar ${number}`,
    src: `/perfiles/${encodeURIComponent(entry.name)}`,
    number,
    filename: entry.name,
  }];
}).sort((left, right) => left.number - right.number || left.filename.localeCompare(right.filename));

if (avatars.length === 0) {
  throw new Error(`No se encontraron imágenes de avatar en ${avatarDirectory}`);
}

const identifiers = new Set();
for (const avatar of avatars) {
  if (identifiers.has(avatar.id)) {
    throw new Error(`ID de avatar duplicado: ${avatar.id}`);
  }
  identifiers.add(avatar.id);
}

const entries = avatars.map(({ id, name, src }) => ({ id, name, src }));
const contents = `// Archivo generado desde public/perfiles. No editar manualmente.\nexport const generatedAvatarCatalog = ${JSON.stringify(entries, null, 2)} as const;\n`;
await writeFile(outputFile, contents, "utf8");
console.log(`Catálogo de avatares actualizado: ${entries.length} imágenes.`);
