import type { Dwelling } from "./types";

export type CsvImportRow = {
  line: number;
  dwellingId: number | null;
  dwellingName: string;
  date: string;
  heating: number | null;
  cooling: number | null;
  water: number | null;
  fixed: number | null;
  errors: string[];
};

const requiredHeaders = ["fecha", "piso", "calefaccion", "frio", "agua", "fijo"];

export function parseReadingsCsv(source: string, dwellings: Dwelling[]): CsvImportRow[] {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) throw new Error("El CSV está vacío.");
  const headers = lines[0].split(";").map(normalize);
  if (headers.length !== requiredHeaders.length || requiredHeaders.some((header, index) => headers[index] !== header)) {
    throw new Error(`La cabecera debe ser exactamente: ${requiredHeaders.join(";")}`);
  }
  return lines.slice(1).map((line, index) => {
    const cells = line.split(";").map((cell) => cell.trim());
    const errors: string[] = [];
    if (cells.length !== requiredHeaders.length) errors.push("La fila no tiene las 6 columnas esperadas");
    const date = parseDate(cells[0] ?? "");
    if (!date) errors.push("Fecha no válida");
    const dwelling = findDwelling(cells[1] ?? "", dwellings);
    if (!dwelling) errors.push("Vivienda no reconocida");
    const values = cells.slice(2, 6).map(parseNumber);
    ["Calefacción", "Frío", "Agua", "Fijo"].forEach((label, valueIndex) => {
      if (values[valueIndex] === null || values[valueIndex]! < 0) errors.push(`${label}: valor no válido`);
    });
    return {
      line: index + 2,
      dwellingId: dwelling?.id ?? null,
      dwellingName: dwelling?.short_name ?? cells[1] ?? "",
      date: date ?? "",
      heating: values[0], cooling: values[1], water: values[2], fixed: values[3], errors,
    };
  });
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function findDwelling(value: string, dwellings: Dwelling[]) {
  const target = normalize(value);
  return dwellings.find((item) => normalize(item.short_name) === target || normalize(item.address) === target);
}

function parseDate(value: string) {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const spanish = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const result = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : spanish ? `${spanish[3]}-${spanish[2].padStart(2, "0")}-${spanish[1].padStart(2, "0")}` : "";
  if (!result || new Date(`${result}T00:00:00Z`).toISOString().slice(0, 10) !== result) return null;
  return result;
}

function parseNumber(value: string) {
  const normalized = value.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return normalized !== "" && Number.isFinite(parsed) ? parsed : null;
}
