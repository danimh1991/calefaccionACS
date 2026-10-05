import type { Dwelling } from "./types";

export type ReceiptLine = { text: string; cells: string[] };
export type ParsedReceipt = {
  dwellingId: number | null;
  dwellingName: string;
  address: string;
  date: string;
  heating: number | null;
  water: number | null;
  cooling: number | null;
  errors: string[];
};

const plain = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const unitKey = (value: string) => plain(value).replace(/[^A-Z0-9]/g, "");

function toIso(value: string) {
  const [day, month, year] = value.split("/");
  return `${year}-${month}-${day}`;
}

function numericCells(line: ReceiptLine) {
  return line.cells.flatMap((cell) => cell.trim().split(/\s+/)).filter((cell) => /^-?\d+(?:[.,]\d+)*$/.test(cell)).map((cell) => {
    const normalized = cell.includes(",") ? cell.replace(/\./g, "").replace(",", ".") : cell;
    return Number(normalized);
  }).filter(Number.isFinite);
}

function currentReading(lines: ReceiptLine[], matcher: (text: string) => boolean) {
  const line = lines.find((item) => matcher(plain(item.text)));
  if (!line) return null;
  const numbers = numericCells(line);
  return numbers.length >= 2 ? numbers[numbers.length - 2] : null;
}

export function parseReceipt(lines: ReceiptLine[], dwellings: Dwelling[]): ParsedReceipt {
  const allText = lines.map((line) => line.text).join("\n");
  const normalized = plain(allText);
  const addressLine = lines.find((line) => /TITULAR\s*:/.test(plain(line.text)))?.text
    ?? lines.find((line) => /CL\s+CESAR\s+CORT\s+BOTI\s+59\s*-/.test(plain(line.text)))?.text
    ?? "";
  const dwellingByAddress = dwellings.find((item) => plain(addressLine).includes(plain(item.address)));
  const unitMatch = plain(addressLine).match(/CESAR\s+CORT\s+BOTI\s+59\s*-\s*([A-Z0-9]+(?:\.[A-Z0-9]+)?)/);
  const dwellingName = dwellingByAddress?.short_name ?? unitMatch?.[1] ?? "";
  const dwelling = dwellingByAddress ?? dwellings.find((item) => unitKey(item.short_name) === unitKey(dwellingName));
  const periodLine = lines.find((line) => /PERIODO\s*:/.test(plain(line.text)))?.text ?? "";
  const periodDates = periodLine.match(/\d{2}\/\d{2}\/\d{4}/g) ?? [];
  const emissionMatch = normalized.match(/FECHA\s+DE\s+EMISION\s*:\s*(\d{2}\/\d{2}\/\d{4})/);
  const rawDate = periodDates.at(-1) ?? emissionMatch?.[1] ?? "";
  const heating = currentReading(lines, (text) => /ENERGIA\s*\(KWH\)/.test(text));
  const water = currentReading(lines, (text) => /^\s*ACS\s*\(L\)/.test(text));
  const cooling = currentReading(lines, (text) => /REFRIGERACION\s*\(KWH\)/.test(text));
  const errors: string[] = [];
  if (!dwellingName) errors.push("No se encontró la vivienda");
  else if (!dwelling) errors.push(`La vivienda “${dwellingName}” no existe en el listado`);
  if (!rawDate) errors.push("No se encontró la fecha final del periodo");
  if (heating === null) errors.push("No se encontró la lectura actual de energía");
  if (water === null) errors.push("No se encontró la lectura actual de ACS");
  if (cooling === null) errors.push("No se encontró la lectura actual de refrigeración");
  return { dwellingId: dwelling?.id ?? null, dwellingName, address: addressLine, date: rawDate ? toIso(rawDate) : "", heating, water, cooling, errors };
}
