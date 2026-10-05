import { describe, expect, it } from "vitest";
import { calculatePeriod, dateDifferenceDays } from "./calculations";

const winter = {
  startDate: "2025-10-30",
  endDate: "2026-04-22",
  dayAdjustment: -2,
  dwellingCount: 79,
  invoiceTotal: 13211.17,
  heatingUsage: 198953,
  coolingUsage: 0,
  waterLitres: 1190853,
  actualHeatingRate: 0.05,
  actualCoolingRate: 0,
  actualWaterRate: 3,
  actualFixedDailyRate: 0.44,
  calculatedWaterRate: 2.5,
  calculatedFixedDailyRate: 0.44,
  administrationDaily: 2,
  sunflowersDaily: 12.724824109589,
};

describe("motor de liquidación", () => {
  it("replica el periodo de invierno del Excel", () => {
    const result = calculatePeriod(winter);
    expect(result.days).toBe(172);
    expect(result.calculatedThermalRate).toBeCloseTo(0.0341185468268853, 12);
    expect(result.calculatedRevenue).toBeCloseTo(15743.8397468493, 8);
    expect(result.calculatedBalance).toBeCloseTo(0, 8);
  });

  it("calcula la diferencia natural entre fechas", () => {
    expect(dateDifferenceDays("2025-10-30", "2026-04-22")).toBe(174);
  });

  it("no oculta un periodo sin consumo térmico", () => {
    const result = calculatePeriod({ ...winter, heatingUsage: 0, coolingUsage: 0 });
    expect(result.calculatedThermalRate).toBe(0);
    expect(result.calculatedBalance).not.toBeCloseTo(0, 2);
  });
});
