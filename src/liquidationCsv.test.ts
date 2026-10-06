import { describe, expect, it } from "vitest";
import { createLiquidationCsv, liquidationFileName } from "./liquidationCsv";
import { createLiquidationExcel, liquidationExcelFileName } from "./liquidationExcel";
import type { Summary } from "./types";

const summary = {
  period: { name: "VERANO 2026", start_date: "2026-04-22", end_date: "2026-09-17", actual_heating_rate: .05, actual_cooling_rate: .04, actual_water_rate: 2.5, calculated_water_rate: 3 },
  readingRange: { startDate: "2026-04-22", endDate: "2026-09-17" },
  totals: { dwellings: 1, invoices: 20, heating: 10, cooling: 20 }, result: { days: 148, waterM3: 2.18, actualFixedRevenue: 12.24, additionalFixedCost: 5, targetCost: 25.1, actualRevenue: 25.1, calculatedRevenue: 25.1, calculatedBalance: 0, calculatedThermalRate: .04123456 },
  fixedCharge: { averageDailyRate: .36 },
  rows: [{ shortName: "BAJO.A", address: "CL CESAR; 59", heating: 10, cooling: 20, waterM3: 2.18, fixedCharged: 12.24, actual: 25.1, calculated: 25.1, difference: 0 }],
} as unknown as Summary;

describe("exportación de la liquidación", () => {
  it("genera un CSV español compatible con Excel y una fila total", () => {
    const csv = createLiquidationCsv(summary);
    expect(csv.startsWith("\uFEFFperiodo;")).toBe(true);
    expect(csv).toContain('BAJO.A;"CL CESAR; 59";10;20;2,18;12,24;25,1;25,1;0');
    expect(csv).toContain("TOTAL COMUNIDAD");
  });

  it("crea un nombre de archivo legible", () => {
    expect(liquidationFileName(summary)).toBe("liquidacion-verano-2026-2026-09-17.csv");
  });

  it("genera un libro Excel válido", async () => {
    const blob = await createLiquidationExcel(summary);
    const signature = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    expect([...signature]).toEqual([80, 75]);
    expect(liquidationExcelFileName(summary)).toBe("liquidacion-verano-2026-2026-09-17.xlsx");
  });
});
