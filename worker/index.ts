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

function periodInputs(period: PeriodRow, totals: { dwellings: number; invoices: number; heating: number; cooling: number; water: number }): PeriodInputs {
  return {
    startDate: period.start_date,
    endDate: period.end_date,
    dayAdjustment: period.day_adjustment,
    dwellingCount: totals.dwellings,
    invoiceTotal: totals.invoices,
    heatingUsage: totals.heating,
    coolingUsage: totals.cooling,
    waterLitres: totals.water,
    actualHeatingRate: period.actual_heating_rate,
    actualCoolingRate: period.actual_cooling_rate,
    actualWaterRate: period.actual_water_rate,
    actualFixedDailyRate: period.actual_fixed_daily_rate,
    calculatedWaterRate: period.calculated_water_rate,
    calculatedFixedDailyRate: period.calculated_fixed_daily_rate,
    administrationDaily: period.administration_daily,
    sunflowersDaily: period.sunflowers_daily,
  };
}

async function bootstrap(env: Env) {
  const [dwellings, dates, invoices, periods] = await Promise.all([
    env.DB.prepare("SELECT id, address, short_name, sort_order, active FROM dwellings ORDER BY sort_order").all(),
    env.DB.prepare("SELECT id, reading_date, notes FROM reading_dates ORDER BY reading_date DESC").all(),
    env.DB.prepare("SELECT id, invoice_type, invoice_date, amount, description FROM invoices ORDER BY invoice_date DESC, id DESC").all(),
    env.DB.prepare("SELECT * FROM periods ORDER BY start_date DESC").all(),
  ]);
  return json({ dwellings: dwellings.results, readingDates: dates.results, invoices: invoices.results, periods: periods.results });
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

async function invoices(request: Request, env: Env, path: string) {
  if (request.method === "POST" && path === "/api/invoices") {
    const body = await request.json() as Record<string, unknown>;
    const type = text(body.invoiceType, "tipo de factura");
    if (!["electricity", "water", "other"].includes(type)) throw new Error("Tipo de factura no válido.");
    const result = await env.DB.prepare("INSERT INTO invoices (invoice_type, invoice_date, amount, description) VALUES (?, ?, ?, ?)")
      .bind(type, text(body.invoiceDate, "fecha"), number(body.amount, "importe"), typeof body.description === "string" ? body.description.trim() || null : null)
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

const PERIOD_FIELDS = [
  "name", "start_date", "end_date", "day_adjustment", "actual_heating_rate", "actual_cooling_rate",
  "actual_water_rate", "actual_fixed_daily_rate", "calculated_water_rate", "calculated_fixed_daily_rate",
  "fixed_electricity_daily", "fixed_water_daily", "administration_daily", "sunflowers_daily",
] as const;

function parsePeriod(body: Record<string, unknown>) {
  return {
    name: text(body.name, "nombre"),
    start_date: text(body.startDate, "fecha de inicio"),
    end_date: text(body.endDate, "fecha final"),
    day_adjustment: number(body.dayAdjustment, "ajuste de días"),
    actual_heating_rate: number(body.actualHeatingRate, "precio real de calefacción"),
    actual_cooling_rate: number(body.actualCoolingRate, "precio real de frío"),
    actual_water_rate: number(body.actualWaterRate, "precio real de agua"),
    actual_fixed_daily_rate: number(body.actualFixedDailyRate, "fijo real"),
    calculated_water_rate: number(body.calculatedWaterRate, "precio calculado de agua"),
    calculated_fixed_daily_rate: number(body.calculatedFixedDailyRate, "fijo calculado"),
    fixed_electricity_daily: number(body.fixedElectricityDaily, "fijo de luz"),
    fixed_water_daily: number(body.fixedWaterDaily, "fijo de agua"),
    administration_daily: number(body.administrationDaily, "administración"),
    sunflowers_daily: number(body.sunflowersDaily, "Sunflowers"),
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
  const inputs = periodInputs(period, totals);
  const result = calculatePeriod(inputs);
  const rows = usage.map((item) => calculateDwelling(item, inputs, result.calculatedThermalRate, result.days));
  const componentFixedDaily = totals.dwellings
    ? (period.fixed_electricity_daily + period.fixed_water_daily + period.administration_daily + period.sunflowers_daily) / totals.dwellings
    : 0;
  const warnings: string[] = [];
  if (Math.abs(componentFixedDaily - period.calculated_fixed_daily_rate) > 0.005) {
    warnings.push(`El fijo calculado aplicado (${period.calculated_fixed_daily_rate.toFixed(4)} €/vivienda/día) no coincide con el desglose (${componentFixedDaily.toFixed(4)} €).`);
  }
  if (period.day_adjustment !== 0) warnings.push(`Se aplican ${period.day_adjustment} días de ajuste al periodo.`);
  if (result.thermalUsage === 0) warnings.push("No hay consumo térmico para absorber el saldo restante.");
  return json({ period, totals, result, componentFixedDaily, warnings, rows });
}

async function api(request: Request, env: Env, url: URL) {
  const path = apiPath(url);
  if (path === "/api/health") return json({ ok: true, authenticated: authorised(request, env) });
  if (!authorised(request, env)) return json({ error: "Clave incorrecta." }, { status: 401 });
  if (path === "/api/bootstrap" && request.method === "GET") return bootstrap(env);
  if (path === "/api/readings") return readings(request, env, url);
  if (path === "/api/invoices" || path.startsWith("/api/invoices/")) return invoices(request, env, path);
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
