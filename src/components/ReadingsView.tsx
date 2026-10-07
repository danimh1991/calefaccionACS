import { useEffect, useState } from "react";
import { api } from "../api";
import type { Bootstrap } from "../types";
import { ReadingCalendar } from "./ReadingCalendar";
import { topLayer, useNavigation } from "../navigation";

type Service = "heating" | "cooling" | "water";
type Row = { dwelling_id: number; address: string; short_name: string; value: number | null };
type History = { dwelling: { id: number; address: string; short_name: string }; rows: Array<{ reading_date: string; value: number }> };

export function ReadingsView({ service, title, data, token, onChanged }: { service: Service; title: string; data: Bootstrap; token: string; onChanged: () => void }) {
  const [date, setDate] = useState(data.readingDates[0]?.reading_date ?? new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<History | null>(null);
  const { location, pushLayer, closeLayer } = useNavigation();
  const layer = topLayer(location);
  const calendarOpen = layer?.kind === "reading-calendar" && layer.service === service;
  const historyDwellingId = layer?.kind === "reading-history" && layer.service === service ? layer.dwellingId : null;

  useEffect(() => {
    setError(""); setMessage("");
    api<{ rows: Row[] }>(`/readings?service=${service}&date=${date}`, token).then((result) => setRows(result.rows)).catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar las lecturas."));
  }, [service, date, token]);

  useEffect(() => {
    if (historyDwellingId === null || history?.dwelling.id === historyDwellingId) return;
    api<History>(`/readings/history?service=${service}&dwellingId=${historyDwellingId}`, token).then(setHistory).catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudo cargar el histórico."));
  }, [historyDwellingId, history?.dwelling.id, service, token]);

  const unit = service === "water" ? "litros" : "kWh";
  const markedDates = data.readingDates.filter((item) => item.services?.split(",").includes(service)).map((item) => item.reading_date);
  const showHistory = async (dwellingId: number) => {
    try { setHistory(await api<History>(`/readings/history?service=${service}&dwellingId=${dwellingId}`, token)); pushLayer({ kind: "reading-history", service, dwellingId }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar el histórico."); }
  };
  const save = async () => {
    if (rows.some((row) => row.value === null || !Number.isFinite(Number(row.value)))) { setError("Completa todas las lecturas antes de guardar."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      await api("/readings", token, { method: "PUT", body: JSON.stringify({ service, date, rows: rows.map((row) => ({ dwellingId: row.dwelling_id, value: Number(row.value) })) }) });
      setMessage(`${rows.length} lecturas guardadas.`); onChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron guardar las lecturas."); }
    finally { setSaving(false); }
  };

  return <section><header className="page-header"><div><p className="eyebrow">Entrada de datos</p><h1>{title}</h1><p>Los contadores son acumulados. El consumo del periodo se obtiene por diferencia entre dos fechas.</p></div><div className="header-actions"><label className="compact-label">Fecha de lectura<ReadingCalendar value={date} markedDates={markedDates} open={calendarOpen} onOpen={() => pushLayer({ kind: "reading-calendar", service })} onClose={() => closeLayer("reading-calendar")} onChange={setDate} /></label><button className="primary" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar lecturas"}</button></div></header>
    {error && <div className="error-box">{error}</div>}{message && <div className="success-box">{message}</div>}
    <article className="panel table-panel"><div className="panel-title"><div><p className="eyebrow">{formatDate(date)}</p><h2>{rows.length} viviendas</h2></div><span className="muted">Unidad: {unit} · Pulsa una vivienda para ver su histórico</span></div><div className="reading-grid"><div className="reading-head"><span>Vivienda</span><span>Lectura acumulada</span></div>{rows.map((row, index) => <label className="reading-row" key={row.dwelling_id}><button type="button" className="dwelling-link" onClick={() => void showHistory(row.dwelling_id)}><b>{row.short_name}</b><small>{row.address}</small></button><input inputMode="decimal" type="number" min="0" step="1" value={row.value ?? ""} onChange={(event) => setRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, value: event.target.value === "" ? null : Number(event.target.value) } : item))} /><em>{unit}</em></label>)}</div></article>
    {historyDwellingId !== null && history?.dwelling.id === historyDwellingId && <div className="modal-backdrop" onClick={() => closeLayer("reading-history")}><article className="panel history-modal" onClick={(event) => event.stopPropagation()}><div className="panel-title"><div><p className="eyebrow">Histórico · {title.replace("Lecturas de ", "")}</p><h2>{history.dwelling.short_name}</h2><p className="muted">{history.dwelling.address}</p></div><button className="secondary" onClick={() => closeLayer("reading-history")}>Cerrar</button></div><div className="history-list">{history.rows.map((item) => <div key={item.reading_date}><span>{formatDate(item.reading_date)}</span><b>{new Intl.NumberFormat("es-ES").format(item.value)} {unit}</b></div>)}</div></article></div>}
  </section>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
