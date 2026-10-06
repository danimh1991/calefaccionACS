import ExcelJS from "exceljs";
import type { Summary } from "./types";
import { liquidationFileName } from "./liquidationCsv";

export async function createLiquidationExcel(summary: Summary) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Calefacción y ACS";
  workbook.created = new Date();
  addSummarySheet(workbook, summary);
  addDetailSheet(workbook, summary);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function liquidationExcelFileName(summary: Summary) {
  return liquidationFileName(summary).replace(/\.csv$/, ".xlsx");
}

function addSummarySheet(workbook: ExcelJS.Workbook, summary: Summary) {
  const sheet = workbook.addWorksheet("Resumen");
  sheet.mergeCells("A1:D1"); sheet.getCell("A1").value = "Liquidación del periodo"; sheet.getCell("A1").font = { bold: true, size: 18, color: { argb: "FF17373A" } };
  const rows: Array<[string, string | number, string, string | number]> = [
    ["Periodo", summary.period.name, "Días facturables", summary.result.days],
    ["Inicio del periodo", summary.period.start_date, "Fin del periodo", summary.period.end_date],
    ["Lectura inicial", summary.readingRange.startDate, "Lectura final", summary.readingRange.endDate],
    ["Viviendas", summary.totals.dwellings, "Fijo cobrado", summary.result.actualFixedRevenue],
    ["Facturas", summary.totals.invoices, "Costes fijos adicionales", summary.result.additionalFixedCost],
    ["Coste total a repartir", summary.result.targetCost, "Total cobrado", summary.result.actualRevenue],
    ["Total calculado", summary.result.calculatedRevenue, "Saldo calculado", summary.result.calculatedBalance],
    ["Tarifa cobrada calefacción €/kWh", summary.period.actual_heating_rate, "Tarifa calculada térmica €/kWh", summary.result.calculatedThermalRate],
    ["Tarifa cobrada frío €/kWh", summary.period.actual_cooling_rate, "Tarifa calculada agua €/m³", summary.period.calculated_water_rate],
    ["Tarifa cobrada agua €/m³", summary.period.actual_water_rate, "Fijo medio €/vivienda/día", summary.fixedCharge.averageDailyRate],
  ];
  rows.forEach((row) => sheet.addRow(row));
  sheet.columns = [{ width: 34 }, { width: 22 }, { width: 34 }, { width: 22 }];
  for (let row = 2; row <= sheet.rowCount; row += 1) {
    sheet.getCell(row, 1).font = { bold: true, color: { argb: "FF53666A" } }; sheet.getCell(row, 3).font = { bold: true, color: { argb: "FF53666A" } };
  }
  ["D2", "B5"].forEach((cell) => { sheet.getCell(cell).numFmt = "0"; });
  ["D5", "B6", "D6", "B7", "D7", "B8", "D8"].forEach((cell) => { sheet.getCell(cell).numFmt = '#,##0.00 [$€-es-ES]'; });
  ["B9", "D9", "B10", "D10", "B11", "D11"].forEach((cell) => { sheet.getCell(cell).numFmt = "0.00000000"; });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function addDetailSheet(workbook: ExcelJS.Workbook, summary: Summary) {
  const sheet = workbook.addWorksheet("Por vivienda", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Vivienda", key: "dwelling", width: 14 }, { header: "Dirección", key: "address", width: 42 },
    { header: "Calefacción (kWh)", key: "heating", width: 20 }, { header: "Frío (kWh)", key: "cooling", width: 16 },
    { header: "Agua (m³)", key: "water", width: 16 }, { header: "Fijo cobrado (€)", key: "fixed", width: 18 },
    { header: "Total cobrado (€)", key: "actual", width: 19 }, { header: "Total calculado (€)", key: "calculated", width: 20 },
    { header: "Diferencia (€)", key: "difference", width: 17 },
  ];
  summary.rows.forEach((row) => sheet.addRow({ dwelling: row.shortName, address: row.address, heating: row.heating, cooling: row.cooling, water: row.waterM3, fixed: row.fixedCharged, actual: row.actual, calculated: row.calculated, difference: row.difference }));
  const total = sheet.addRow({ dwelling: "TOTAL COMUNIDAD", heating: summary.totals.heating, cooling: summary.totals.cooling, water: summary.result.waterM3, fixed: summary.result.actualFixedRevenue, actual: summary.result.actualRevenue, calculated: summary.result.calculatedRevenue, difference: summary.result.calculatedRevenue - summary.result.actualRevenue });
  sheet.autoFilter = { from: "A1", to: "I1" };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E6667" } }; sheet.getRow(1).alignment = { vertical: "middle" }; sheet.getRow(1).height = 24;
  total.font = { bold: true, color: { argb: "FFFFFFFF" } }; total.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF133F43" } };
  [3, 4, 5].forEach((column) => { sheet.getColumn(column).numFmt = "#,##0.000"; });
  [6, 7, 8, 9].forEach((column) => { sheet.getColumn(column).numFmt = '#,##0.00 [$€-es-ES]'; });
}
