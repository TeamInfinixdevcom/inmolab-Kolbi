"use client";

import { useState } from "react";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { useRBAC } from "@/components/auth/rbac-provider";
import { creationAudit } from "@/lib/firestore-audit";
import {
  INMOBILIARIO_COLUMNS,
  normalizeCell,
  validateCell,
  type InmobiliarioImportRow,
} from "@/lib/inmobiliarios-import";

type ImportRow = { rowNumber: number; values: InmobiliarioImportRow; errors: string[] };

function isValidExtension(file: File) {
  return /\.(xls|xlsx)$/i.test(file.name);
}

export function ImportExcel({ onComplete }: { onComplete: () => void }) {
  const { user } = useRBAC();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileError, setFileError] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState("");

  function reset() {
    setRows([]);
    setFileError("");
    setResult("");
    setProgress(0);
  }

  async function handleFile(file: File | undefined) {
    reset();
    if (!file) return;
    if (!isValidExtension(file)) {
      setFileError("Selecciona un archivo .xls o .xlsx.");
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error("El archivo no contiene hojas.");
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: null, raw: true });
      const header = (matrix[0] ?? []).map((value) => String(value ?? ""));
      if (header.length !== INMOBILIARIO_COLUMNS.length || header.some((value, index) => value !== INMOBILIARIO_COLUMNS[index])) {
        setFileError("Los encabezados no coinciden exactamente con el formato requerido.");
        return;
      }
      const seen = new Set<string>();
      const parsed = matrix.slice(1).map((source, index) => {
        const values = Object.fromEntries(INMOBILIARIO_COLUMNS.map((column, columnIndex) => [column, normalizeCell(source[columnIndex], column)])) as InmobiliarioImportRow;
        const errors: string[] = [];
        if (values.ID === null || String(values.ID).trim() === "") errors.push("ID obligatorio");
        if (values.Nombre === null || String(values.Nombre).trim() === "") errors.push("Nombre obligatorio");
        const id = values.ID === null ? "" : String(values.ID).trim();
        if (id && seen.has(id)) errors.push("ID duplicado en el archivo");
        if (id) seen.add(id);
        for (const [column, value] of Object.entries(values)) {
          const error = validateCell(value, column);
          if (error) errors.push(`${column}: ${error}`);
        }
        return { rowNumber: index + 2, values, errors };
      }).filter((row) => Object.values(row.values).some((value) => value !== null));
      if (db) {
        const snapshot = await getDocs(collection(db, "inmobiliarios"));
        const existing = new Set(snapshot.docs.flatMap((item) => [item.id, item.data().ID ? String(item.data().ID) : ""]));
        parsed.forEach((row) => {
          const id = row.values.ID === null ? "" : String(row.values.ID);
          if (id && existing.has(id)) row.errors.push("ID ya existe en Firestore");
        });
      }
      setRows(parsed);
    } catch (error) {
      console.error("No se pudo leer el archivo de inmobiliarios.", error);
      setFileError("No se pudo leer el archivo. Verifica que sea un Excel válido.");
    }
  }

  async function validateExistingIds(currentRows: ImportRow[]) {
    if (!db) return currentRows;
    const snapshot = await getDocs(collection(db, "inmobiliarios"));
    const existing = new Set(snapshot.docs.flatMap((item) => [item.id, item.data().ID ? String(item.data().ID) : ""]));
    const validated = currentRows.map((row) => {
      const id = row.values.ID === null ? "" : String(row.values.ID);
      return { ...row, errors: existing.has(id) ? [...row.errors.filter((error) => !error.includes("Firestore")), "ID ya existe en Firestore"] : row.errors.filter((error) => !error.includes("Firestore")) };
    });
    setRows(validated);
    return validated;
  }

  async function save() {
    const firestore = db;
    if (!firestore) {
      setFileError("Firebase no está configurado.");
      return;
    }
    setSaving(true);
    setFileError("");
    try {
      const latest = await validateExistingIds(rows);
      if (latest.some((row) => row.errors.length > 0)) {
        setFileError("Corrige los errores antes de guardar.");
        return;
      }
      for (let start = 0; start < latest.length; start += 500) {
        const batch = writeBatch(firestore);
        const chunk = latest.slice(start, start + 500);
        chunk.forEach((row) => batch.set(doc(firestore, "inmobiliarios", String(row.values.ID)), {
          ...row.values,
          ...creationAudit(user?.uid ?? ""),
        }));
        await batch.commit();
        setProgress(Math.round(((start + chunk.length) / latest.length) * 100));
      }
      setResult(`${latest.length} filas importadas correctamente.`);
      onComplete();
    } catch (error) {
      console.error("No se pudo importar el archivo de inmobiliarios.", error);
      setFileError("No se pudo completar la importación. No se guardaron filas de forma parcial.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => { reset(); setOpen(true); }}><Upload size={16} className="mr-2" /> Importar Excel</Button>
      {open && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"><Card className="max-h-[92vh] w-full max-w-6xl overflow-y-auto"><CardHeader className="flex-row items-center justify-between"><CardTitle>Importar Excel de inmobiliarios</CardTitle><Button variant="ghost" size="icon" onClick={() => !saving && setOpen(false)} aria-label="Cancelar importación"><X size={18} /></Button></CardHeader><CardContent className="space-y-4">
        <input type="file" accept=".xls,.xlsx" onChange={(event) => void handleFile(event.target.files?.[0])} className="block w-full rounded-md border p-2 text-sm" />
        {fileError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{fileError}</div>}
        {rows.length > 0 && <><p className="text-sm text-muted-foreground">Vista previa: {rows.length} filas. {rows.filter((row) => row.errors.length > 0).length} con errores.</p><div className="max-h-96 overflow-auto rounded-lg border"><table className="min-w-[1200px] text-left text-xs"><thead className="sticky top-0 bg-muted"><tr><th className="p-2">Fila</th><th className="p-2">ID</th><th className="p-2">Nombre</th><th className="p-2">Región</th><th className="p-2">Fecha</th><th className="p-2">Estado</th><th className="p-2">Errores</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.rowNumber} className={row.errors.length ? "bg-red-50" : ""}><td className="p-2">{row.rowNumber}</td><td className="p-2">{String(row.values.ID ?? "")}</td><td className="p-2">{String(row.values.Nombre ?? "")}</td><td className="p-2">{String(row.values.Region ?? "")}</td><td className="p-2">{String(row.values.Fecha_operación ?? "")}</td><td className="p-2">{String(row.values.Estado_CondiciónInmobiliario ?? "")}</td><td className="p-2 text-red-700">{row.errors.join(", ") || "OK"}</td></tr>)}</tbody></table></div><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={reset} disabled={saving}>Limpiar</Button><Button onClick={() => void save()} disabled={saving || rows.some((row) => row.errors.length > 0)}>{saving ? `Importando ${progress}%...` : "Validar y guardar"}</Button></div></>}
        {result && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{result}</div>}
      </CardContent></Card></div>}
    </>
  );
}
