import type { Summary } from "./types";

const headers = [
  "periodo", "inicio_periodo", "fin_periodo", "lectura_inicial", "lectura_final", "vivienda", "direccion",
  "calefaccion_kwh", "frio_kwh", "agua_m3", "fijo_cobrado_eur", "total_cobrado_eur", "total_calculado_eur",
  "diferencia_eur", "tarifa_cobrada_calefaccion_eur_kwh", "tarifa_cobrada_frio_eur_kwh",
  "tarifa_cobrada_agua_eur_m3", "tarifa_calculada_termica_eur_kwh", "tarifa_calculada_agua_eur_m3",
];

export function createLiquidationCsv(summary: Summary) {
  const common = [summary.period.name, summary.period.start_date, summary.period.end_date, summary.readingRange.startDate, summary.readingRange.endDate];
  const rates = [summary.period.actual_heating_rate, summary.period.actual_cooling_rate, summary.period.actual_water_rate, summary.result.calculatedThermalRate, summary.period.calculated_water_rate];
  const rows: Array<Array<string | number>> = summary.rows.map((row) => [
    ...common, row.shortName, row.address, decimal(row.heating, 3), decimal(row.cooling, 3), decimal(row.waterM3, 3),
    decimal(row.fixedCharged, 2), decimal(row.actual, 2), decimal(row.calculated, 2), decimal(row.difference, 2),
    ...rates.map((value) => decimal(value, 8)),
  ]);
  rows.push([
    ...common, "TOTAL COMUNIDAD", "", decimal(summary.totals.heating, 3), decimal(summary.totals.cooling, 3), decimal(summary.result.waterM3, 3),
    decimal(summary.result.actualFixedRevenue, 2), decimal(summary.result.actualRevenue, 2), decimal(summary.result.calculatedRevenue, 2),
    decimal(summary.result.calculatedRevenue - summary.result.actualRevenue, 2), ...rates.map((value) => decimal(value, 8)),
  ]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

export function liquidationFileName(summary: Summary) {
  const period = summary.period.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "periodo";
  return `liquidacion-${period}-${summary.readingRange.endDate}.csv`;
}

function decimal(value: number, maximumFractionDigits: number) {
  return new Intl.NumberFormat("es-ES", { useGrouping: false, maximumFractionDigits }).format(value);
}

function csvCell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
