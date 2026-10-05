import { calculateDwelling, calculatePeriod, type DwellingUsage, type PeriodInputs } from "../shared/calculations";

type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_PIN?: string;
};

const BASE_PATH = "/calefaccionacs";

type PeriodRow = {
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

type FixedConceptRow = {
  id: number;
  name: string;
  parent_id: number | null;
  parent_name: string | null;
  calculation_mode: "simple" | "separate";
  cost_treatment: "included" | "additional";
  notes: string | null;
  active: number;
  sort_order: number;
};

type FixedRuleRow = {
  id: number;
  concept_id: number;
  effective_from: string;
  effective_to: string | null;
  amount: number;
  frequency: "daily" | "monthly" | "annual";
  vat_rate: number;
  notes: string | null;
};

type FixedNeighborChargeRow = {
  id: number;
  effective_from: string;
  effective_to: string | null;
  daily_rate: number;
  notes: string | null;
};

const json = (data: unknown, init: ResponseInit = {}) =>
  Response.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init.headers ?? {}) },
  });

function apiPath(url: URL) {
  return url.pathname.startsWith(BASE_PATH)
    ? url.pathname.slice(BASE_PATH.length) || "/"
    : url.pathname;
}

function authorised(request: Request, env: Env) {
  if (!env.APP_PIN) return true;
  return request.headers.get("Authorization") === `Bearer ${env.APP_PIN}`;
}

function number(value: unknown, field: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Valor no válido para ${field}.`);
  return parsed;
}

function text(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Falta ${field}.`);
  return value.trim();
}

function periodInputs(
  period: PeriodRow,
  totals: { dwellings: number; invoices: number; heating: number; cooling: number; water: number },
  fixed: { costTotal: number; additionalCost: number },
  fixedCharge: { perDwellingTotal: number; revenue: number },
): PeriodInputs {
  return {
    startDate: period.start_date,
    endDate: period.end_date,
    dwellingCount: totals.dwellings,
    invoiceTotal: totals.invoices,
    fixedCostTotal: fixed.costTotal,
    actualFixedRevenue: fixedCharge.revenue,
    actualFixedPerDwelling: fixedCharge.perDwellingTotal,
    additionalFixedCost: fixed.additionalCost,
    heatingUsage: totals.heating,
    coolingUsage: totals.cooling,
    waterLitres: totals.water,
    actualHeatingRate: period.actual_heating_rate,
    actualCoolingRate: period.actual_cooling_rate,
    actualWaterRate: period.actual_water_rate,
    calculatedWaterRate: period.calculated_water_rate,
  };
}

async function bootstrap(env: Env) {
  const [dwellings, dates, invoices, periods, invoiceTypes] = await Promise.all([
    env.DB.prepare("SELECT id, address, short_name, sort_order, active FROM dwellings ORDER BY sort_order").all(),
    env.DB.prepare("SELECT id, reading_date, notes FROM reading_dates ORDER BY reading_date DESC").all(),
    env.DB.prepare(`SELECT i.id, COALESCE(t.slug, i.invoice_type) AS invoice_type, COALESCE(t.name, i.invoice_type) AS invoice_type_name,
      i.invoice_type_id, i.invoice_date, i.amount, i.description
      FROM invoices i LEFT JOIN invoice_types t ON t.id = i.invoice_type_id
      ORDER BY i.invoice_date DESC, i.id DESC`).all(),
    env.DB.prepare("SELECT * FROM periods ORDER BY start_date DESC").all(),
    env.DB.prepare("SELECT id, name, slug, active, sort_order FROM invoice_types ORDER BY sort_order, name").all(),
  ]);
  return json({ dwellings: dwellings.results, readingDates: dates.results, invoices: invoices.results, periods: periods.results, invoiceTypes: invoiceTypes.results });
}

async function readings(request: Request, env: Env, url: URL) {
  if (request.method === "GET") {
    const service = url.searchParams.get("service");
    const date = url.searchParams.get("date");
    if (!service || !date) return json({ error: "Faltan servicio o fecha." }, { status: 400 });
    const result = await env.DB.prepare(`
      SELECT d.id AS dwelling_id, d.address, d.short_name, r.value
      FROM dwellings d
      LEFT JOIN reading_dates rd ON rd.reading_date = ?
      LEFT JOIN readings r ON r.dwelling_id = d.id AND r.reading_date_id = rd.id AND r.service = ?
      WHERE d.active = 1
      ORDER BY d.sort_order
    `).bind(date, service).all();
    return json({ rows: result.results });
  }

  if (request.method === "PUT") {
    const body = await request.json() as { service?: string; date?: string; notes?: string; rows?: Array<{ dwellingId: number; value: number }> };
    const service = text(body.service, "servicio");
    if (!["heating", "cooling", "water"].includes(service)) throw new Error("Servicio no válido.");
    const date = text(body.date, "fecha");
    const rows = body.rows ?? [];
    await env.DB.prepare("INSERT INTO reading_dates (reading_date, notes) VALUES (?, ?) ON CONFLICT(reading_date) DO UPDATE SET notes=excluded.notes")
      .bind(date, body.notes ?? null).run();
    const dateRow = await env.DB.prepare("SELECT id FROM reading_dates WHERE reading_date = ?").bind(date).first<{ id: number }>();
    if (!dateRow) throw new Error("No se pudo crear la fecha de lectura.");
    const statements = rows.map((row) => env.DB.prepare(`
      INSERT INTO readings (dwelling_id, reading_date_id, service, value)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(dwelling_id, reading_date_id, service)
      DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
    `).bind(number(row.dwellingId, "vivienda"), dateRow.id, service, number(row.value, "lectura")));
    if (statements.length) await env.DB.batch(statements);
    return json({ ok: true, saved: statements.length });
  }

  return json({ error: "Método no permitido." }, { status: 405 });
}

async function readingHistory(env: Env, url: URL) {
  const dwellingId = number(url.searchParams.get("dwellingId"), "vivienda");
  const service = text(url.searchParams.get("service"), "servicio");
  if (!["heating", "cooling", "water"].includes(service)) throw new Error("Servicio no válido.");
  const dwelling = await env.DB.prepare("SELECT id, address, short_name FROM dwellings WHERE id = ?").bind(dwellingId).first();
  if (!dwelling) return json({ error: "Vivienda no encontrada." }, { status: 404 });
  const rows = await env.DB.prepare(`SELECT rd.reading_date, r.value
    FROM readings r JOIN reading_dates rd ON rd.id = r.reading_date_id
    WHERE r.dwelling_id = ? AND r.service = ? ORDER BY rd.reading_date DESC`)
    .bind(dwellingId, service).all();
  return json({ dwelling, rows: rows.results });
}

async function invoices(request: Request, env: Env, path: string) {
  if (request.method === "POST" && path === "/api/invoices") {
    const body = await request.json() as Record<string, unknown>;
    const typeId = number(body.invoiceTypeId, "tipo de factura");
    const type = await env.DB.prepare("SELECT id, slug FROM invoice_types WHERE id = ? AND active = 1").bind(typeId).first<{ id: number; slug: string }>();
    if (!type) throw new Error("Tipo de factura no válido.");
    const legacyType = ["electricity", "water"].includes(type.slug) ? type.slug : "other";
    const result = await env.DB.prepare("INSERT INTO invoices (invoice_type, invoice_type_id, invoice_date, amount, description) VALUES (?, ?, ?, ?, ?)")
      .bind(legacyType, type.id, text(body.invoiceDate, "fecha"), number(body.amount, "importe"), typeof body.description === "string" ? body.description.trim() || null : null)
      .run();
    return json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  }
  const match = path.match(/^\/api\/invoices\/(\d+)$/);
  if (request.method === "DELETE" && match) {
    await env.DB.prepare("DELETE FROM invoices WHERE id = ?").bind(Number(match[1])).run();
    return json({ ok: true });
  }
  return json({ error: "Método no permitido." }, { status: 405 });
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function invoiceTypes(request: Request, env: Env, path: string) {
  if (request.method === "POST" && path === "/api/invoice-types") {
    const body = await request.json() as Record<string, unknown>;
    const name = text(body.name, "nombre");
    const baseSlug = slugify(name) || `tipo-${Date.now()}`;
    const result = await env.DB.prepare("INSERT INTO invoice_types (name, slug, sort_order) VALUES (?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM invoice_types), 1))")
      .bind(name, `${baseSlug}-${Date.now().toString(36)}`).run();
    return json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  }
  const match = path.match(/^\/api\/invoice-types\/(\d+)$/);
  if (!match) return json({ error: "Tipo de factura no encontrado." }, { status: 404 });
  const id = Number(match[1]);
  if (request.method === "PUT") {
    const body = await request.json() as Record<string, unknown>;
    await env.DB.prepare("UPDATE invoice_types SET name = ?, updated_at=CURRENT_TIMESTAMP WHERE id = ?").bind(text(body.name, "nombre"), id).run();
    return json({ ok: true });
  }
  if (request.method === "DELETE") {
    await env.DB.prepare("UPDATE invoice_types SET active = 0, updated_at=CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }
  return json({ error: "Método no permitido." }, { status: 405 });
}

const PERIOD_FIELDS = [
  "name", "start_date", "end_date", "actual_heating_rate", "actual_cooling_rate",
  "actual_water_rate", "calculated_water_rate",
] as const;

function parsePeriod(body: Record<string, unknown>) {
  return {
    name: text(body.name, "nombre"),
    start_date: text(body.startDate, "fecha de inicio"),
    end_date: text(body.endDate, "fecha final"),
    actual_heating_rate: number(body.actualHeatingRate, "precio real de calefacción"),
    actual_cooling_rate: number(body.actualCoolingRate, "precio real de frío"),
    actual_water_rate: number(body.actualWaterRate, "precio real de agua"),
    calculated_water_rate: number(body.calculatedWaterRate, "precio calculado de agua"),
  };
}

async function periods(request: Request, env: Env, path: string) {
  if (request.method === "POST" && path === "/api/periods") {
    const values = parsePeriod(await request.json() as Record<string, unknown>);
    const columns = PERIOD_FIELDS.join(", ");
    const placeholders = PERIOD_FIELDS.map(() => "?").join(", ");
    const result = await env.DB.prepare(`INSERT INTO periods (${columns}) VALUES (${placeholders})`)
      .bind(...PERIOD_FIELDS.map((field) => values[field])).run();
    return json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  }

  const match = path.match(/^\/api\/periods\/(\d+)$/);
  if (!match) return json({ error: "Periodo no encontrado." }, { status: 404 });
  const id = Number(match[1]);
  if (request.method === "PUT") {
    const values = parsePeriod(await request.json() as Record<string, unknown>);
    await env.DB.prepare(`UPDATE periods SET ${PERIOD_FIELDS.map((field) => `${field} = ?`).join(", ")}, updated_at=CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(...PERIOD_FIELDS.map((field) => values[field]), id).run();
    return json({ ok: true });
  }
  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM periods WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }
  return json({ error: "Método no permitido." }, { status: 405 });
}

async function fixedData(env: Env) {
  const [concepts, rules] = await Promise.all([
    env.DB.prepare(`SELECT c.id, c.name, c.parent_id, p.name AS parent_name, c.calculation_mode,
      c.cost_treatment, c.notes, c.active, c.sort_order
      FROM fixed_concepts c LEFT JOIN fixed_concepts p ON p.id = c.parent_id
      WHERE c.active = 1 ORDER BY COALESCE(c.parent_id, c.id), c.parent_id IS NOT NULL, c.sort_order, c.name`).all<FixedConceptRow>(),
    env.DB.prepare("SELECT * FROM fixed_concept_rules ORDER BY concept_id, effective_from DESC").all<FixedRuleRow>(),
  ]);
  return concepts.results.map((concept) => ({ ...concept, rules: rules.results.filter((rule) => rule.concept_id === concept.id) }));
}

function daysInMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
}

function daysInYear(value: Date) {
  const year = value.getUTCFullYear();
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

function dailyValue(amount: number, frequency: FixedRuleRow["frequency"], vatRate: number, day: Date) {
  const divisor = frequency === "monthly" ? daysInMonth(day) : frequency === "annual" ? daysInYear(day) : 1;
  return amount * (1 + vatRate / 100) / divisor;
}

async function calculateFixedCosts(env: Env, startDate: string, endDate: string) {
  const concepts = await fixedData(env);
  const childParents = new Set(concepts.filter((item) => item.parent_id !== null).map((item) => item.parent_id));
  const leaves = concepts.filter((item) => !childParents.has(item.id));
  const breakdown = leaves.map((concept) => ({
    conceptId: concept.id,
    name: concept.name,
    parentId: concept.parent_id,
    parentName: concept.parent_name,
    treatment: concept.cost_treatment,
    notes: concept.notes,
    costTotal: 0,
    uncoveredDays: 0,
  }));
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor <= end) {
    const day = cursor.toISOString().slice(0, 10);
    for (let index = 0; index < leaves.length; index += 1) {
      const concept = leaves[index];
      const rule = concept.rules.find((item) => item.effective_from <= day && (!item.effective_to || item.effective_to >= day));
      if (!rule) { breakdown[index].uncoveredDays += 1; continue; }
      const cost = dailyValue(rule.amount, rule.frequency, rule.vat_rate, cursor);
      breakdown[index].costTotal += cost;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return {
    costTotal: breakdown.reduce((sum, item) => sum + item.costTotal, 0),
    additionalCost: breakdown.filter((item) => item.treatment === "additional").reduce((sum, item) => sum + item.costTotal, 0),
    breakdown,
  };
}

async function suggestedFixedNeighborRate(env: Env) {
  const concepts = await fixedData(env);
  const childParents = new Set(concepts.filter((item) => item.parent_id !== null).map((item) => item.parent_id));
  const leaves = concepts.filter((item) => !childParents.has(item.id));
  const effectiveFrom = leaves.flatMap((item) => item.rules.map((rule) => rule.effective_from)).sort().at(-1) ?? null;
  const dwelling = await env.DB.prepare("SELECT COUNT(*) AS total FROM dwellings WHERE active=1").first<{ total: number }>();
  const dwellingCount = Number(dwelling?.total ?? 0);
  if (!effectiveFrom || !dwellingCount) return { dailyRate: null, effectiveFrom };
  const day = new Date(`${effectiveFrom}T00:00:00Z`);
  const total = leaves.reduce((sum, concept) => {
    const rule = concept.rules.find((item) => item.effective_from <= effectiveFrom && (!item.effective_to || item.effective_to >= effectiveFrom));
    return sum + (rule ? dailyValue(rule.amount, rule.frequency, rule.vat_rate, day) : 0);
  }, 0);
  return { dailyRate: total / dwellingCount, effectiveFrom };
}

async function fixedNeighborChargeData(env: Env) {
  const result = await env.DB.prepare("SELECT id, effective_from, effective_to, daily_rate, notes FROM fixed_neighbor_charges ORDER BY effective_from DESC, id DESC").all<FixedNeighborChargeRow>();
  return result.results;
}

async function calculateFixedNeighborCharges(env: Env, startDate: string, endDate: string, dwellingCount: number) {
  const ranges = await fixedNeighborChargeData(env);
  const applied = new Map<number, { row: FixedNeighborChargeRow; days: number }>();
  let perDwellingTotal = 0;
  let uncoveredDays = 0;
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor <= end) {
    const day = cursor.toISOString().slice(0, 10);
    const range = ranges.find((item) => item.effective_from <= day && (!item.effective_to || item.effective_to >= day));
    if (!range) uncoveredDays += 1;
    else {
      perDwellingTotal += range.daily_rate;
      const current = applied.get(range.id);
      applied.set(range.id, { row: range, days: (current?.days ?? 0) + 1 });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000);
  return {
    perDwellingTotal,
    revenue: perDwellingTotal * dwellingCount,
    averageDailyRate: days ? perDwellingTotal / days : 0,
    currentDailyRate: ranges[0]?.daily_rate ?? null,
    uncoveredDays,
    rangesApplied: [...applied.values()].map(({ row, days: appliedDays }) => ({
      id: row.id,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      dailyRate: row.daily_rate,
      days: appliedDays,
    })),
  };
}

function parseFixedNeighborCharge(body: Record<string, unknown>) {
  const effectiveFrom = text(body.effectiveFrom, "fecha de inicio");
  const effectiveTo = typeof body.effectiveTo === "string" && body.effectiveTo ? body.effectiveTo : null;
  if (effectiveTo && effectiveTo < effectiveFrom) throw new Error("La fecha final no puede ser anterior a la inicial.");
  const dailyRate = number(body.dailyRate, "precio por vecino y día");
  if (dailyRate < 0) throw new Error("El precio por vecino y día no puede ser negativo.");
  return { effectiveFrom, effectiveTo, dailyRate, notes: typeof body.notes === "string" ? body.notes.trim() || null : null };
}

async function ensureFixedNeighborChargeDoesNotOverlap(env: Env, values: ReturnType<typeof parseFixedNeighborCharge>, excludeId?: number) {
  const overlap = await env.DB.prepare(`SELECT id FROM fixed_neighbor_charges
    WHERE id != ? AND effective_from <= COALESCE(?, '9999-12-31')
      AND COALESCE(effective_to, '9999-12-31') >= ? LIMIT 1`)
    .bind(excludeId ?? -1, values.effectiveTo, values.effectiveFrom).first();
  if (overlap) throw new Error("Ese rango se solapa con otro fijo cobrado. Ajusta las fechas antes de guardarlo.");
}

async function fixedNeighborCharges(request: Request, env: Env, path: string) {
  if (request.method === "GET" && path === "/api/fixed-neighbor-charges") {
    const [charges, suggestion] = await Promise.all([fixedNeighborChargeData(env), suggestedFixedNeighborRate(env)]);
    return json({ charges, suggestion });
  }
  if (request.method === "POST" && path === "/api/fixed-neighbor-charges") {
    const values = parseFixedNeighborCharge(await request.json() as Record<string, unknown>);
    const overlaps = await env.DB.prepare(`SELECT id, effective_from, effective_to FROM fixed_neighbor_charges
      WHERE effective_from <= COALESCE(?, '9999-12-31')
        AND COALESCE(effective_to, '9999-12-31') >= ? ORDER BY effective_from`).bind(values.effectiveTo, values.effectiveFrom).all<Pick<FixedNeighborChargeRow, "id" | "effective_from" | "effective_to">>();
    const previousOpenRange = overlaps.results.length === 1 && overlaps.results[0].effective_to === null && overlaps.results[0].effective_from < values.effectiveFrom
      ? overlaps.results[0] : null;
    if (overlaps.results.length && !previousOpenRange) throw new Error("Ese rango se solapa con otro fijo cobrado. Ajusta las fechas antes de guardarlo.");
    if (previousOpenRange) await env.DB.prepare("UPDATE fixed_neighbor_charges SET effective_to=date(?, '-1 day'), updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(values.effectiveFrom, previousOpenRange.id).run();
    const result = await env.DB.prepare("INSERT INTO fixed_neighbor_charges (effective_from, effective_to, daily_rate, notes) VALUES (?, ?, ?, ?)")
      .bind(values.effectiveFrom, values.effectiveTo, values.dailyRate, values.notes).run();
    return json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  }
  const match = path.match(/^\/api\/fixed-neighbor-charges\/(\d+)$/);
  if (!match) return json({ error: "Tramo de fijo cobrado no encontrado." }, { status: 404 });
  const id = Number(match[1]);
  if (request.method === "PUT") {
    const values = parseFixedNeighborCharge(await request.json() as Record<string, unknown>);
    await ensureFixedNeighborChargeDoesNotOverlap(env, values, id);
    await env.DB.prepare("UPDATE fixed_neighbor_charges SET effective_from=?, effective_to=?, daily_rate=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(values.effectiveFrom, values.effectiveTo, values.dailyRate, values.notes, id).run();
    return json({ ok: true });
  }
  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM fixed_neighbor_charges WHERE id=?").bind(id).run();
    return json({ ok: true });
  }
  return json({ error: "Método no permitido." }, { status: 405 });
}

function parseRule(body: Record<string, unknown>) {
  const frequency = text(body.frequency, "periodicidad");
  if (!["daily", "monthly", "annual"].includes(frequency)) throw new Error("Periodicidad no válida.");
  return {
    concept_id: number(body.conceptId, "concepto"),
    effective_from: text(body.effectiveFrom, "fecha de vigencia"),
    effective_to: typeof body.effectiveTo === "string" && body.effectiveTo ? body.effectiveTo : null,
    amount: number(body.amount, "importe"),
    frequency,
    vat_rate: number(body.vatRate ?? 0, "IVA"),
    notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
  };
}

async function fixedConcepts(request: Request, env: Env, path: string) {
  if (request.method === "GET" && path === "/api/fixed-concepts") return json({ concepts: await fixedData(env) });
  if (request.method === "POST" && path === "/api/fixed-concepts") {
    const body = await request.json() as Record<string, unknown>;
    const mode = body.calculationMode === "separate" ? "separate" : "simple";
    const treatment = body.costTreatment === "included" ? "included" : "additional";
    const parentId = body.parentId ? number(body.parentId, "concepto principal") : null;
    const result = await env.DB.prepare(`INSERT INTO fixed_concepts
      (name, parent_id, calculation_mode, cost_treatment, notes, sort_order)
      VALUES (?, ?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM fixed_concepts WHERE parent_id = ? OR (parent_id IS NULL AND ? IS NULL)), 1))`)
      .bind(text(body.name, "nombre"), parentId, mode, treatment, typeof body.notes === "string" ? body.notes.trim() || null : null, parentId, parentId).run();
    return json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  }
  const match = path.match(/^\/api\/fixed-concepts\/(\d+)$/);
  if (!match) return json({ error: "Concepto no encontrado." }, { status: 404 });
  const id = Number(match[1]);
  if (request.method === "PUT") {
    const body = await request.json() as Record<string, unknown>;
    await env.DB.prepare(`UPDATE fixed_concepts SET name=?, calculation_mode=?, cost_treatment=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(text(body.name, "nombre"), body.calculationMode === "separate" ? "separate" : "simple", body.costTreatment === "included" ? "included" : "additional", typeof body.notes === "string" ? body.notes.trim() || null : null, id).run();
    return json({ ok: true });
  }
  if (request.method === "DELETE") {
    await env.DB.prepare("UPDATE fixed_concepts SET active=0, updated_at=CURRENT_TIMESTAMP WHERE id=? OR parent_id=?").bind(id, id).run();
    return json({ ok: true });
  }
  return json({ error: "Método no permitido." }, { status: 405 });
}

async function fixedRules(request: Request, env: Env, path: string) {
  if (request.method === "POST" && path === "/api/fixed-rules/batch") {
    const body = await request.json() as Record<string, unknown>;
    const effectiveFrom = text(body.effectiveFrom, "fecha de vigencia");
    const effectiveTo = typeof body.effectiveTo === "string" && body.effectiveTo ? body.effectiveTo : null;
    if (effectiveTo && effectiveTo < effectiveFrom) throw new Error("La fecha final no puede ser anterior a la inicial.");
    const rows = Array.isArray(body.rows) ? body.rows as Array<Record<string, unknown>> : [];
    if (!rows.length) throw new Error("No hay subcategorías que guardar.");
    const parsed = rows.map((row) => {
      const frequency = text(row.frequency, "periodicidad");
      if (!["daily", "monthly", "annual"].includes(frequency)) throw new Error("Periodicidad no válida.");
      const amount = number(row.amount, "importe");
      const vatRate = number(row.vatRate ?? 0, "IVA");
      if (amount < 0 || vatRate < 0) throw new Error("Los importes y el IVA no pueden ser negativos.");
      return { conceptId: number(row.conceptId, "concepto"), amount, frequency, vatRate, notes: typeof row.notes === "string" ? row.notes.trim() || null : null };
    });
    const placeholders = parsed.map(() => "?").join(",");
    const valid = await env.DB.prepare(`SELECT id FROM fixed_concepts WHERE active=1 AND calculation_mode='simple' AND id IN (${placeholders})`)
      .bind(...parsed.map((row) => row.conceptId)).all<{ id: number }>();
    if (new Set(valid.results.map((row) => row.id)).size !== parsed.length) throw new Error("Alguna subcategoría ya no está disponible.");
    const statements = parsed.flatMap((row) => [
      env.DB.prepare("UPDATE fixed_concept_rules SET effective_to=date(?, '-1 day'), updated_at=CURRENT_TIMESTAMP WHERE concept_id=? AND effective_from < ? AND (effective_to IS NULL OR effective_to >= ?)")
        .bind(effectiveFrom, row.conceptId, effectiveFrom, effectiveFrom),
      env.DB.prepare(`INSERT INTO fixed_concept_rules (concept_id, effective_from, effective_to, amount, frequency, vat_rate, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(concept_id, effective_from) DO UPDATE SET effective_to=excluded.effective_to, amount=excluded.amount,
        frequency=excluded.frequency, vat_rate=excluded.vat_rate, notes=excluded.notes, updated_at=CURRENT_TIMESTAMP`)
        .bind(row.conceptId, effectiveFrom, effectiveTo, row.amount, row.frequency, row.vatRate, row.notes),
    ]);
    await env.DB.batch(statements);
    return json({ ok: true, saved: parsed.length });
  }
  if (request.method === "POST" && path === "/api/fixed-rules") {
    const values = parseRule(await request.json() as Record<string, unknown>);
    const concept = await env.DB.prepare("SELECT calculation_mode FROM fixed_concepts WHERE id=? AND active=1").bind(values.concept_id).first<{ calculation_mode: string }>();
    if (!concept || concept.calculation_mode !== "simple") throw new Error("Añade la regla a un concepto simple o a un subconcepto.");
    await env.DB.prepare("UPDATE fixed_concept_rules SET effective_to=date(?, '-1 day'), updated_at=CURRENT_TIMESTAMP WHERE concept_id=? AND effective_from < ? AND (effective_to IS NULL OR effective_to >= ?)")
      .bind(values.effective_from, values.concept_id, values.effective_from, values.effective_from).run();
    const result = await env.DB.prepare(`INSERT INTO fixed_concept_rules
      (concept_id, effective_from, effective_to, amount, frequency, vat_rate, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(concept_id, effective_from) DO UPDATE SET effective_to=excluded.effective_to, amount=excluded.amount,
      frequency=excluded.frequency, vat_rate=excluded.vat_rate, notes=excluded.notes, updated_at=CURRENT_TIMESTAMP`)
      .bind(...Object.values(values)).run();
    return json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  }
  const match = path.match(/^\/api\/fixed-rules\/(\d+)$/);
  if (!match) return json({ error: "Regla no encontrada." }, { status: 404 });
  const id = Number(match[1]);
  if (request.method === "PUT") {
    const values = parseRule(await request.json() as Record<string, unknown>);
    await env.DB.prepare(`UPDATE fixed_concept_rules SET effective_from=?, effective_to=?, amount=?, frequency=?, vat_rate=?,
      notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(values.effective_from, values.effective_to, values.amount, values.frequency, values.vat_rate, values.notes, id).run();
    return json({ ok: true });
  }
  if (request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM fixed_concept_rules WHERE id=?").bind(id).run();
    return json({ ok: true });
  }
  return json({ error: "Método no permitido." }, { status: 405 });
}

async function summary(env: Env, id: number) {
  const period = await env.DB.prepare("SELECT * FROM periods WHERE id = ?").bind(id).first<PeriodRow>();
  if (!period) return json({ error: "Periodo no encontrado." }, { status: 404 });

  const usageResult = await env.DB.prepare(`
    SELECT d.id AS dwelling_id, d.address, d.short_name,
      MAX(CASE WHEN rd.reading_date = ? AND r.service = 'heating' THEN r.value END) AS heating_start,
      MAX(CASE WHEN rd.reading_date = ? AND r.service = 'heating' THEN r.value END) AS heating_end,
      MAX(CASE WHEN rd.reading_date = ? AND r.service = 'cooling' THEN r.value END) AS cooling_start,
      MAX(CASE WHEN rd.reading_date = ? AND r.service = 'cooling' THEN r.value END) AS cooling_end,
      MAX(CASE WHEN rd.reading_date = ? AND r.service = 'water' THEN r.value END) AS water_start,
      MAX(CASE WHEN rd.reading_date = ? AND r.service = 'water' THEN r.value END) AS water_end
    FROM dwellings d
    LEFT JOIN readings r ON r.dwelling_id = d.id
    LEFT JOIN reading_dates rd ON rd.id = r.reading_date_id AND rd.reading_date IN (?, ?)
    WHERE d.active = 1
    GROUP BY d.id
    ORDER BY d.sort_order
  `).bind(
    period.start_date, period.end_date,
    period.start_date, period.end_date,
    period.start_date, period.end_date,
    period.start_date, period.end_date,
  ).all<Record<string, string | number | null>>();

  const missing: string[] = [];
  const usage: DwellingUsage[] = usageResult.results.map((row) => {
    const fields = ["heating_start", "heating_end", "cooling_start", "cooling_end", "water_start", "water_end"];
    if (fields.some((field) => row[field] === null || row[field] === undefined)) missing.push(String(row.short_name));
    const diff = (end: string, start: string) => Number(row[end] ?? 0) - Number(row[start] ?? 0);
    return {
      dwellingId: Number(row.dwelling_id),
      address: String(row.address),
      shortName: String(row.short_name),
      heating: diff("heating_end", "heating_start"),
      cooling: diff("cooling_end", "cooling_start"),
      waterLitres: diff("water_end", "water_start"),
    };
  });
  if (missing.length) return json({ error: "Faltan lecturas de inicio o final.", missing }, { status: 422 });
  const negative = usage.filter((item) => item.heating < 0 || item.cooling < 0 || item.waterLitres < 0).map((item) => item.shortName);
  if (negative.length) return json({ error: "Hay consumos negativos; revisa los contadores.", negative }, { status: 422 });

  const invoiceRow = await env.DB.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM invoices WHERE invoice_date > ? AND invoice_date <= ?")
    .bind(period.start_date, period.end_date).first<{ total: number }>();
  const totals = {
    dwellings: usage.length,
    invoices: Number(invoiceRow?.total ?? 0),
    heating: usage.reduce((sum, item) => sum + item.heating, 0),
    cooling: usage.reduce((sum, item) => sum + item.cooling, 0),
    water: usage.reduce((sum, item) => sum + item.waterLitres, 0),
  };
  const [fixed, fixedCharge] = await Promise.all([
    calculateFixedCosts(env, period.start_date, period.end_date),
    calculateFixedNeighborCharges(env, period.start_date, period.end_date, totals.dwellings),
  ]);
  const inputs = periodInputs(period, totals, fixed, fixedCharge);
  const result = calculatePeriod(inputs);
  const rows = usage.map((item) => calculateDwelling(item, inputs, result.calculatedThermalRate, result.days));
  const warnings: string[] = [];
  const uncovered = fixed.breakdown.filter((item) => item.uncoveredDays > 0);
  if (uncovered.length) warnings.push(`Hay conceptos fijos sin regla durante parte del periodo: ${uncovered.map((item) => item.name).join(", ")}.`);
  if (fixedCharge.uncoveredDays) warnings.push(`Falta una tarifa de fijo cobrado para ${fixedCharge.uncoveredDays} días del periodo.`);
  if (result.thermalUsage === 0) warnings.push("No hay consumo térmico para absorber el saldo restante.");
  return json({ period, totals, result, fixed, fixedCharge, warnings, rows });
}

async function api(request: Request, env: Env, url: URL) {
  const path = apiPath(url);
  if (path === "/api/health") return json({ ok: true, authenticated: authorised(request, env) });
  if (!authorised(request, env)) return json({ error: "PIN incorrecto." }, { status: 401 });
  if (path === "/api/bootstrap" && request.method === "GET") return bootstrap(env);
  if (path === "/api/readings/history" && request.method === "GET") return readingHistory(env, url);
  if (path === "/api/readings") return readings(request, env, url);
  if (path === "/api/invoices" || path.startsWith("/api/invoices/")) return invoices(request, env, path);
  if (path === "/api/invoice-types" || path.startsWith("/api/invoice-types/")) return invoiceTypes(request, env, path);
  if (path === "/api/fixed-concepts" || path.startsWith("/api/fixed-concepts/")) return fixedConcepts(request, env, path);
  if (path === "/api/fixed-rules" || path.startsWith("/api/fixed-rules/")) return fixedRules(request, env, path);
  if (path === "/api/fixed-neighbor-charges" || path.startsWith("/api/fixed-neighbor-charges/")) return fixedNeighborCharges(request, env, path);
  if (path === "/api/periods" || /^\/api\/periods\/\d+$/.test(path)) return periods(request, env, path);
  const summaryMatch = path.match(/^\/api\/summary\/(\d+)$/);
  if (summaryMatch && request.method === "GET") return summary(env, Number(summaryMatch[1]));
  return json({ error: "Ruta no encontrada." }, { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (apiPath(url).startsWith("/api/")) return await api(request, env, url);
      if (url.pathname.startsWith(BASE_PATH) && !["127.0.0.1", "localhost"].includes(url.hostname)) {
        const assetUrl = new URL(request.url);
        assetUrl.pathname = url.pathname.slice(BASE_PATH.length) || "/";
        return env.ASSETS.fetch(new Request(assetUrl, request));
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado.";
      return json({ error: message }, { status: 400 });
    }
  },
} satisfies ExportedHandler<Env>;
