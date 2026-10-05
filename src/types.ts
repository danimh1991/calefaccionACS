export type Dwelling = { id: number; address: string; short_name: string; sort_order: number; active: number };
export type ReadingDate = { id: number; reading_date: string; notes: string | null };
export type InvoiceType = { id: number; name: string; slug: string; active: number; sort_order: number };
export type Invoice = { id: number; invoice_type: string; invoice_type_name: string; invoice_type_id: number; invoice_date: string; amount: number; description: string | null };
export type Period = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  day_adjustment: number;
  actual_heating_rate: number;
  actual_cooling_rate: number;
  actual_water_rate: number;
  actual_fixed_daily_rate: number;
  calculated_water_rate: number;
  calculated_fixed_daily_rate: number;
  fixed_electricity_daily: number;
  fixed_water_daily: number;
  administration_daily: number;
  sunflowers_daily: number;
};
export type Bootstrap = { dwellings: Dwelling[]; readingDates: ReadingDate[]; invoices: Invoice[]; periods: Period[]; invoiceTypes: InvoiceType[] };
export type FixedRule = { id: number; concept_id: number; effective_from: string; effective_to: string | null; amount: number; frequency: "daily" | "monthly" | "annual"; vat_rate: number; notes: string | null };
export type FixedNeighborCharge = { id: number; effective_from: string; effective_to: string | null; daily_rate: number; notes: string | null };
export type FixedConcept = { id: number; name: string; parent_id: number | null; parent_name: string | null; calculation_mode: "simple" | "separate"; cost_treatment: "included" | "additional"; notes: string | null; active: number; sort_order: number; rules: FixedRule[] };
export type Summary = {
  period: Period;
  totals: { dwellings: number; invoices: number; heating: number; cooling: number; water: number };
  result: {
    days: number;
    waterM3: number;
    thermalUsage: number;
    fixedCostTotal: number;
    actualFixedRevenue: number;
    additionalFixedCost: number;
    targetCost: number;
    calculatedThermalRate: number;
    actualRevenue: number;
    calculatedRevenue: number;
    actualBalance: number;
    calculatedBalance: number;
  };
  fixedCharge: {
    perDwellingTotal: number;
    revenue: number;
    averageDailyRate: number;
    currentDailyRate: number | null;
    uncoveredDays: number;
    rangesApplied: Array<{ id: number; effectiveFrom: string; effectiveTo: string | null; dailyRate: number; days: number }>;
  };
  fixed: {
    costTotal: number;
    additionalCost: number;
    breakdown: Array<{ conceptId: number; name: string; parentId: number | null; parentName: string | null; treatment: "included" | "additional"; notes: string | null; costTotal: number; uncoveredDays: number }>;
  };
  warnings: string[];
  rows: Array<{
    dwellingId: number;
    address: string;
    shortName: string;
    heating: number;
    cooling: number;
    waterLitres: number;
    waterM3: number;
    actual: number;
    calculated: number;
    difference: number;
  }>;
};
