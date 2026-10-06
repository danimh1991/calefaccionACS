import { describe, expect, it } from "vitest";
import { parseReceipt, type ReceiptLine } from "./receiptParser";
import type { Dwelling } from "./types";

const dwellings: Dwelling[] = [{ id: 79, address: "CL CESAR CORT BOTI 59 - BAJO.A", short_name: "BAJO.A", sort_order: 79, active: 1 }];
const lines: ReceiptLine[] = [
  { text: "PERIODO: 14/08/2026 al 17/09/2026", cells: ["PERIODO:", "14/08/2026", "al", "17/09/2026"] },
  { text: "TITULAR: CL CESAR CORT BOTI 59 - BAJO.A 28055 MADRID", cells: ["TITULAR:", "CL CESAR CORT BOTI 59 - BAJO.A", "28055 MADRID"] },
  { text: "Término fijo 34,00 0,36000000 €/TF 0,00 12,24 € 0,00 € 12,24 €", cells: ["Término fijo", "34,00", "0,36000000 €/TF", "0,00", "12,24 €", "0,00 €", "12,24 €"] },
  { text: "Energía (kWh) 67600607 7039 7039 0", cells: ["Energía (kWh)", "67600607", "7039", "7039", "0"] },
  { text: "ACS (L) 79535325 76580 78760 2180", cells: ["ACS (L)", "79535325", "76580", "78760", "2180"] },
  { text: "Refrigeración (kWh) 67600607 1096 1256 160", cells: ["Refrigeración (kWh)", "67600607", "1096", "1256", "160"] },
];

describe("lector de recibos PDF", () => {
  it("extrae vivienda, fecha y las tres lecturas actuales", () => {
    expect(parseReceipt(lines, dwellings)).toMatchObject({ dwellingId: 79, dwellingName: "BAJO.A", date: "2026-09-17", periodStart: "2026-08-14", periodEnd: "2026-09-17", fixedDailyRate: 0.36, heating: 7039, water: 78760, cooling: 1256, errors: [] });
  });

  it("informa de una vivienda que no existe", () => {
    const result = parseReceipt(lines, []);
    expect(result.dwellingId).toBeNull();
    expect(result.errors[0]).toContain("BAJO.A");
  });
});
