export type PeriodInputs = {
  startDate: string;
  endDate: string;
  dayAdjustment: number;
  dwellingCount: number;
  invoiceTotal: number;
  heatingUsage: number;
  coolingUsage: number;
  waterLitres: number;
  actualHeatingRate: number;
  actualCoolingRate: number;
  actualWaterRate: number;
  actualFixedDailyRate: number;
  calculatedWaterRate: number;
  calculatedFixedDailyRate: number;
  administrationDaily: number;
  sunflowersDaily: number;
};

export type DwellingUsage = {
  dwellingId: number;
  address: string;
  shortName: string;
  heating: number;
  cooling: number;
  waterLitres: number;
};

const MS_PER_DAY = 86_400_000;

export function dateDifferenceDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("El periodo debe tener fechas válidas y la fecha final debe ser posterior.");
  }
  return Math.round((end - start) / MS_PER_DAY);
}

export function calculatePeriod(inputs: PeriodInputs) {
  const days = dateDifferenceDays(inputs.startDate, inputs.endDate) + inputs.dayAdjustment;
  if (days <= 0) throw new Error("El número de días facturables debe ser mayor que cero.");

  const waterM3 = inputs.waterLitres / 1000;
  const thermalUsage = inputs.heatingUsage + inputs.coolingUsage;
  const administration = days * inputs.administrationDaily;
  const sunflowers = days * inputs.sunflowersDaily;
  const targetCost = inputs.invoiceTotal + administration + sunflowers;
  const calculatedFixedRevenue =
    days * inputs.dwellingCount * inputs.calculatedFixedDailyRate;
  const calculatedWaterRevenue = waterM3 * inputs.calculatedWaterRate;
  const remainingThermalCost =
    targetCost - calculatedFixedRevenue - calculatedWaterRevenue;
  const calculatedThermalRate = thermalUsage === 0 ? 0 : remainingThermalCost / thermalUsage;
  const actualRevenue =
    inputs.heatingUsage * inputs.actualHeatingRate +
    inputs.coolingUsage * inputs.actualCoolingRate +
    waterM3 * inputs.actualWaterRate +
    days * inputs.dwellingCount * inputs.actualFixedDailyRate;
  const calculatedRevenue =
    thermalUsage * calculatedThermalRate +
    calculatedWaterRevenue +
    calculatedFixedRevenue;

  return {
    days,
    waterM3,
    thermalUsage,
    administration,
    sunflowers,
    targetCost,
    calculatedThermalRate,
    actualRevenue,
    calculatedRevenue,
    actualBalance: actualRevenue - targetCost,
    calculatedBalance: calculatedRevenue - targetCost,
  };
}

export function calculateDwelling(
  usage: DwellingUsage,
  inputs: PeriodInputs,
  thermalRate: number,
  days: number,
) {
  const waterM3 = usage.waterLitres / 1000;
  const actual =
    usage.heating * inputs.actualHeatingRate +
    usage.cooling * inputs.actualCoolingRate +
    waterM3 * inputs.actualWaterRate +
    days * inputs.actualFixedDailyRate;
  const calculated =
    (usage.heating + usage.cooling) * thermalRate +
    waterM3 * inputs.calculatedWaterRate +
    days * inputs.calculatedFixedDailyRate;
  return { ...usage, waterM3, actual, calculated, difference: calculated - actual };
}
