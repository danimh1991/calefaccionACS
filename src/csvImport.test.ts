import { describe, expect, it } from "vitest";
import { parseReadingsCsv } from "./csvImport";

const dwellings = [{ id: 1, short_name: "BAJO.A", address: "CL CESAR CORT BOTI 59 - BAJO.A", sort_order: 1, active: 1 }];

describe("importador CSV", () => {
  it("lee fechas españolas y decimales con coma", () => {
    const [row] = parseReadingsCsv("fecha;piso;calefaccion;frio;agua;fijo\n17/09/2026;BAJO.A;7039;1256;78760;12,24", dwellings);
    expect(row).toMatchObject({ date: "2026-09-17", dwellingId: 1, heating: 7039, cooling: 1256, water: 78760, fixed: 12.24, errors: [] });
  });

  it("rechaza una cabecera distinta", () => {
    expect(() => parseReadingsCsv("fecha,piso,agua", dwellings)).toThrow(/cabecera/i);
  });

  it("señala viviendas y valores desconocidos", () => {
    const [row] = parseReadingsCsv("fecha;piso;calefaccion;frio;agua;fijo\n2026-09-17;99.Z;x;0;1;2", dwellings);
    expect(row.errors).toEqual(expect.arrayContaining(["Vivienda no reconocida", "Calefacción: valor no válido"]));
  });
});
