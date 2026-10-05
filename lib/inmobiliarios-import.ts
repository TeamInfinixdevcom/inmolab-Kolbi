export const INMOBILIARIO_COLUMNS = [
  "ID", "Nombre", "Region", "Fecha_operación", "Central", "ADO_Distrito", "CTRL-ADO",
  "Contrato", "Tipo", "NAP", "Cantidad_NAPs", "Provincia", "Canton", "Distrito",
  "Segmento", "Modelo", "Estado_CondiciónInmobiliario",
  "Observaciones_Condicion_Inmobiliario", "Ejecutivo_Responsable",
  "Puertos_Dispersion", "Operadores", "Viviendas_construidas", "Lotes_total",
  "Cobertura_3G", "Cobertura_4G", "Cobertura_5G", "C_NAPs", "C_PUERTOS",
  "% Ocupacion", "OTRAS_CAUSAS_33", "OCUPADOS", "LIBRES", "PENDIENTES", "ESTUDIO",
  "VOZ_Internet_TV", "VOZ_Internet", "Internet_TV", "VOZ_TV", "VOZ", "Internet", "TV",
  "Observación", "VOZ_Internet_TV_ingreso", "VOZ_Internet_Ingreso",
  "Internet_TV_ingreso", "VOZ_TV_ingreso", "VOZ_ingreso", "Internet_ingreso", "TV_ingreso",
] as const;

export type InmobiliarioImportRow = Record<(typeof INMOBILIARIO_COLUMNS)[number], string | number | null>;

export const NUMBER_COLUMNS = new Set([
  "Cantidad_NAPs", "Puertos_Dispersion", "Operadores", "Viviendas_construidas", "Lotes_total",
  "C_NAPs", "C_PUERTOS", "% Ocupacion", "OTRAS_CAUSAS_33", "OCUPADOS", "LIBRES", "PENDIENTES",
  "ESTUDIO", "VOZ_Internet_TV", "VOZ_Internet", "Internet_TV", "VOZ_TV", "VOZ", "Internet", "TV",
  "VOZ_Internet_TV_ingreso", "VOZ_Internet_Ingreso", "Internet_TV_ingreso", "VOZ_TV_ingreso",
  "VOZ_ingreso", "Internet_ingreso", "TV_ingreso",
]);

export const PERCENTAGE_COLUMNS = new Set(["Cobertura_3G", "Cobertura_4G", "Cobertura_5G", "% Ocupacion"]);

export function normalizeCell(value: unknown, column: string): string | number | null {
  if (value === undefined || value === null || value === "") return null;
  if (column === "Fecha_operación") {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === "number") {
      const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
      return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
    }
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
  }
  if (NUMBER_COLUMNS.has(column)) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const text = String(value).trim().replace(/,/g, "");
    const percent = text.endsWith("%");
    const parsed = Number(percent ? text.slice(0, -1) : text);
    if (Number.isFinite(parsed)) return PERCENTAGE_COLUMNS.has(column) && percent ? parsed / 100 : parsed;
  }
  return String(value);
}

export function validateCell(value: string | number | null, column: string): string | null {
  if (value === null) return null;
  if (column === "Fecha_operación" && typeof value === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "fecha inválida";
  if (NUMBER_COLUMNS.has(column) && typeof value !== "number") return "debe ser numérico";
  return null;
}
