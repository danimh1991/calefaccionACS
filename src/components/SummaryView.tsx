import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import type { Bootstrap, Period, Summary } from "../types";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const number = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
const rate = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 4, maximumFractionDigits: 5 });

type Props = { data: Bootstrap; token: string; onChanged: () => void };

export function SummaryView({ data, token, onChanged }: Props) {
  const [periodId, setPeriodId] = useState(data.periods[0]?.id ?? 0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  const period = useMemo(() => data.periods.find((item) => item.id === periodId) ?? data.periods[0], [data.periods, periodId]);

  useEffect(() => {
    if (!period?.id) return;
    setLoading(true);
    setError("");
    api<Summary>(`/summary/${period.id}`, token)
      .then(setSummary)
      .catch((reason) => {
        const details = reason instanceof ApiError ? reason.details as { missing?: string[]; negative?: string[] } : null;
        const suffix = details?.missing?.length ? ` Viviendas: ${details.missing.join(", ")}.` : details?.negative?.length ? ` Viviendas: ${details.negative.join(", ")}.` : "";
        setError(`${reason instanceof Error ? reason.message : "No se pudo calcular el periodo."}${suffix}`);
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }, [period?.id, token]);

  if (!period) return <EmptyPeriods token={token} onChanged={onChanged} />;

  return (
    <section>
      <header className="page-header">
        <div><p className="eyebrow">Liquidación comunitaria</p><h1>Resumen del periodo</h1><p>Compara lo cobrado con el coste que debía repartirse.</p></div>
        <div className="header-actions">
          <label className="compact-label">Periodo<select value={period.id} onChange={(event) => setPeriodId(Number(event.target.value))}>{data.periods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <button className="secondary" onClick={() => setEditing((value) => !value)}>{editing ? "Cerrar ajustes" : "Editar periodo"}</button>
        </div>
      </header>

      {editing && <PeriodForm period={period} token={token} onSaved={() => { setEditing(false); onChanged(); }} />}
      {error && <div className="error-box">{error}</div>}
      {loading && <div className="loading-line">Calculando…</div>}
      {summary && <SummaryContent summary={summary} />}
    </section>
  );
}

function SummaryContent({ summary }: { summary: Summary }) {
  const { period, result, totals } = summary;
  return (
    <>
      {summary.warnings.length > 0 && <div className="warning-stack">{summary.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
      <div className="period-strip">
        <div><span>Inicio</span><strong>{formatDate(period.start_date)}</strong></div>
        <div><span>Fin</span><strong>{formatDate(period.end_date)}</strong></div>
        <div><span>Días facturables</span><strong>{result.days}</strong></div>
        <div><span>Viviendas</span><strong>{totals.dwellings}</strong></div>
      </div>
      <div className="metric-grid">
        <article className="metric-card actual"><p>Entrada real</p><strong>{money.format(result.actualRevenue)}</strong><span className={result.actualBalance >= 0 ? "positive" : "negative"}>{signedMoney(result.actualBalance)} frente al coste</span></article>
        <article className="metric-card calculated"><p>Entrada calculada</p><strong>{money.format(result.calculatedRevenue)}</strong><span className={Math.abs(result.calculatedBalance) < 0.01 ? "balanced" : "negative"}>{Math.abs(result.calculatedBalance) < 0.01 ? "Cuadre exacto" : signedMoney(result.calculatedBalance)}</span></article>
        <article className="metric-card"><p>Coste a repartir</p><strong>{money.format(result.targetCost)}</strong><span>Facturas y servicios del periodo</span></article>
      </div>
      <div className="two-column">
        <article className="panel">
          <div className="panel-title"><div><p className="eyebrow">Precios</p><h2>Real y calculado</h2></div><span className="rate-pill">{rate.format(result.calculatedThermalRate)} €/kWh</span></div>
          <div className="price-table">
            <div className="table-head"><span>Concepto</span><span>Real</span><span>Calculado</span></div>
            <div><span>Calefacción</span><b>{rate.format(period.actual_heating_rate)}</b><b>{rate.format(result.calculatedThermalRate)}</b></div>
            <div><span>Frío</span><b>{rate.format(period.actual_cooling_rate)}</b><b>{rate.format(result.calculatedThermalRate)}</b></div>
            <div><span>Agua</span><b>{rate.format(period.actual_water_rate)} €/m³</b><b>{rate.format(period.calculated_water_rate)} €/m³</b></div>
            <div><span>Fijo diario</span><b>{rate.format(period.actual_fixed_daily_rate)}</b><b>{rate.format(period.calculated_fixed_daily_rate)}</b></div>
          </div>
        </article>
        <article className="panel">
          <div className="panel-title"><div><p className="eyebrow">Costes</p><h2>Composición</h2></div></div>
          <dl className="cost-list">
            <div><dt>Facturas</dt><dd>{money.format(totals.invoices)}</dd></div>
            <div><dt>Administración</dt><dd>{money.format(result.administration)}</dd></div>
            <div><dt>Sunflowers</dt><dd>{money.format(result.sunflowers)}</dd></div>
            <div className="total"><dt>Total</dt><dd>{money.format(result.targetCost)}</dd></div>
          </dl>
        </article>
      </div>
      <article className="panel table-panel">
        <div className="panel-title"><div><p className="eyebrow">Detalle</p><h2>Liquidación por vivienda</h2></div><span className="muted">Agua: {number.format(result.waterM3)} m³ · Térmico: {number.format(result.thermalUsage)} kWh</span></div>
        <div className="table-scroll"><table><thead><tr><th>Vivienda</th><th>Calefacción</th><th>Frío</th><th>Agua</th><th>Real</th><th>Calculado</th><th>Diferencia</th></tr></thead><tbody>
          {summary.rows.map((row) => <tr key={row.dwellingId}><td><b>{row.shortName}</b><span>{row.address}</span></td><td>{number.format(row.heating)}</td><td>{number.format(row.cooling)}</td><td>{number.format(row.waterM3)} m³</td><td>{money.format(row.actual)}</td><td>{money.format(row.calculated)}</td><td className={row.difference >= 0 ? "positive" : "negative"}>{signedMoney(row.difference)}</td></tr>)}
        </tbody><tfoot><tr><td>Total comunidad</td><td>{number.format(totals.heating)}</td><td>{number.format(totals.cooling)}</td><td>{number.format(result.waterM3)} m³</td><td>{money.format(result.actualRevenue)}</td><td>{money.format(result.calculatedRevenue)}</td><td>{signedMoney(result.calculatedRevenue - result.actualRevenue)}</td></tr></tfoot></table></div>
      </article>
    </>
  );
}

function PeriodForm({ period, token, onSaved }: { period?: Period; token: string; onSaved: () => void }) {
  const [form, setForm] = useState(() => periodToForm(period));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (field: string, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await api(period ? `/periods/${period.id}` : "/periods", token, { method: period ? "PUT" : "POST", body: JSON.stringify(form) });
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar."); }
    finally { setSaving(false); }
  };
  const numeric = [
    ["dayAdjustment", "Ajuste de días", "1"], ["actualHeatingRate", "Calefacción real (€/kWh)", "0.0001"], ["actualCoolingRate", "Frío real (€/kWh)", "0.0001"],
    ["actualWaterRate", "Agua real (€/m³)", "0.01"], ["actualFixedDailyRate", "Fijo real (€/viv./día)", "0.0001"], ["calculatedWaterRate", "Agua calculada (€/m³)", "0.01"],
    ["calculatedFixedDailyRate", "Fijo calculado (€/viv./día)", "0.0001"], ["fixedElectricityDaily", "Fijo luz comunidad/día", "0.0001"], ["fixedWaterDaily", "Fijo agua comunidad/día", "0.0001"],
    ["administrationDaily", "Administración comunidad/día", "0.01"], ["sunflowersDaily", "Sunflowers comunidad/día", "0.0001"],
  ];
  return <form className="panel period-form" onSubmit={submit}><div className="panel-title"><div><p className="eyebrow">Parámetros editables</p><h2>{period ? "Ajustes del periodo" : "Nuevo periodo"}</h2></div></div><div className="form-grid">
    <label>Nombre<input value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
    <label>Inicio<input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></label>
    <label>Fin<input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} /></label>
    {numeric.map(([field, label, step]) => <label key={field}>{label}<input type="number" step={step} value={form[field]} onChange={(e) => set(field, e.target.value)} /></label>)}
  </div>{error && <p className="error-box">{error}</p>}<div className="form-actions"><button className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar periodo"}</button></div></form>;
}

function EmptyPeriods({ token, onChanged }: { token: string; onChanged: () => void }) {
  return <section><header className="page-header"><div><p className="eyebrow">Liquidación comunitaria</p><h1>Primer periodo</h1><p>Crea un periodo después de cargar las lecturas de sus fechas de inicio y fin.</p></div></header><PeriodForm token={token} onSaved={onChanged} /></section>;
}

function periodToForm(period?: Period): Record<string, string> {
  return period ? {
    name: period.name, startDate: period.start_date, endDate: period.end_date, dayAdjustment: String(period.day_adjustment), actualHeatingRate: String(period.actual_heating_rate), actualCoolingRate: String(period.actual_cooling_rate), actualWaterRate: String(period.actual_water_rate), actualFixedDailyRate: String(period.actual_fixed_daily_rate), calculatedWaterRate: String(period.calculated_water_rate), calculatedFixedDailyRate: String(period.calculated_fixed_daily_rate), fixedElectricityDaily: String(period.fixed_electricity_daily), fixedWaterDaily: String(period.fixed_water_daily), administrationDaily: String(period.administration_daily), sunflowersDaily: String(period.sunflowers_daily),
  } : { name: "", startDate: "", endDate: "", dayAdjustment: "-2", actualHeatingRate: "0.05", actualCoolingRate: "0.04", actualWaterRate: "3", actualFixedDailyRate: "0.44", calculatedWaterRate: "2.5", calculatedFixedDailyRate: "0.44", fixedElectricityDaily: "13.0503824", fixedWaterDaily: "0.76824", administrationDaily: "2", sunflowersDaily: "12.724824109589" };
}

function formatDate(value: string) { return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function signedMoney(value: number) { return `${value >= 0 ? "+" : "−"}${money.format(Math.abs(value))}`; }
