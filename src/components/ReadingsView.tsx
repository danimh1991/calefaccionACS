import { useEffect, useState } from "react";
import { api } from "../api";
import type { Bootstrap } from "../types";

type Service = "heating" | "cooling" | "water";
type Row = { dwelling_id: number; address: string; short_name: string; value: number | null };

export function ReadingsView({ service, title, data, token, onChanged }: { service: Service; title: string; data: Bootstrap; token: string; onChanged: () => void }) {
  const [date, setDate] = useState(data.readingDates[0]?.reading_date ?? new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setError(""); setMessage("");
    api<{ rows: Row[] }>(`/readings?service=${service}&date=${date}`, token).then((result) => setRows(result.rows)).catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar las lecturas."));
  }, [service, date, token]);

  const unit = service === "water" ? "litros" : "kWh";
  const save = async () => {
    if (rows.some((row) => row.value === null || !Number.isFinite(Number(row.value)))) { setError("Completa todas las lecturas antes de guardar."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      await api("/readings", token, { method: "PUT", body: JSON.stringify({ service, date, rows: rows.map((row) => ({ dwellingId: row.dwelling_id, value: Number(row.value) })) }) });
      setMessage(`${rows.length} lecturas guardadas.`); onChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron guardar las lecturas."); }
    finally { setSaving(false); }
  };

  return <section><header className="page-header"><div><p className="eyebrow">Entrada de datos</p><h1>{title}</h1><p>Los contadores son acumulados. El consumo del periodo se obtiene por diferencia entre dos fechas.</p></div><div className="header-actions"><label className="compact-label">Fecha de lectura<input type="date" list="reading-dates" value={date} onChange={(event) => setDate(event.target.value)} /></label><datalist id="reading-dates">{data.readingDates.map((item) => <option key={item.id} value={item.reading_date} />)}</datalist><button className="primary" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar lecturas"}</button></div></header>
    {error && <div className="error-box">{error}</div>}{message && <div className="success-box">{message}</div>}
    <article className="panel table-panel"><div className="panel-title"><div><p className="eyebrow">{formatDate(date)}</p><h2>{rows.length} viviendas</h2></div><span className="muted">Unidad: {unit}</span></div><div className="reading-grid"><div className="reading-head"><span>Vivienda</span><span>Lectura acumulada</span></div>{rows.map((row, index) => <label className="reading-row" key={row.dwelling_id}><span><b>{row.short_name}</b><small>{row.address}</small></span><input inputMode="decimal" type="number" min="0" step="1" value={row.value ?? ""} onChange={(event) => setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, value: event.target.value === "" ? null : Number(event.target.value) } : item))} /><em>{unit}</em></label>)}</div></article>
  </section>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
