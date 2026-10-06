import { useMemo, useState } from "react";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { api } from "../api";
import { parseReceipt, type ParsedReceipt, type ReceiptLine } from "../receiptParser";
import { parseReadingsCsv } from "../csvImport";
import type { Bootstrap } from "../types";

type ImportRow = ParsedReceipt & { page: number; fixed: number | null; source: "pdf" | "csv" };
type PdfTextItem = { str: string; transform: number[] };

export function ReceiptImportView({ data, token, onChanged, onBack }: { data: Bootstrap; token: string; onChanged: () => void; onBack: () => void }) {
  const [rows, setRows] = useState<ImportRow[]>([]); const [fileName, setFileName] = useState("");
  const [source, setSource] = useState<"pdf" | "csv" | null>(null);
  const [progress, setProgress] = useState(""); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  const activeDwellings = data.dwellings.filter((item) => item.active);
  const uniqueDwellingIds = new Set(rows.map((row) => row.dwellingId).filter((id): id is number => id !== null));
  const missing = activeDwellings.filter((item) => !uniqueDwellingIds.has(item.id));
  const invalid = rows.filter((row) => row.errors.length > 0);
  const duplicates = useMemo(() => {
    const seen = new Set<string>(); const repeated = new Set<string>();
    rows.forEach((row) => { if (!row.dwellingId || !row.date) return; const key = `${row.dwellingId}:${row.date}`; if (seen.has(key)) repeated.add(key); seen.add(key); });
    return repeated;
  }, [rows]);
  const ready = rows.length > 0 && invalid.length === 0 && missing.length === 0 && duplicates.size === 0;

  const readPdf = async (file: File) => {
    setSource("pdf"); setFileName(file.name); setRows([]); setError(""); setMessage(""); setProgress("Abriendo el PDF…");
    try {
      const { GlobalWorkerOptions, getDocument } = await import("pdfjs-dist");
      GlobalWorkerOptions.workerSrc = workerUrl;
      const document = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const parsed: ImportRow[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        setProgress(`Leyendo página ${pageNumber} de ${document.numPages}…`);
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        const lines = groupLines(content.items.filter((item): item is typeof item & PdfTextItem => "str" in item && "transform" in item).map((item) => ({ str: item.str, x: item.transform[4], y: item.transform[5] })));
        if (!lines.length) parsed.push({ page: pageNumber, dwellingId: null, dwellingName: "", address: "", date: "", periodStart: "", periodEnd: "", heating: null, water: null, cooling: null, fixedDailyRate: null, fixed: null, source: "pdf", errors: ["La página no contiene texto seleccionable"] });
        else { const receipt = parseReceipt(lines, activeDwellings); parsed.push({ page: pageNumber, ...receipt, fixed: receipt.fixedDailyRate, source: "pdf" }); }
      }
      const counts = new Map<string, number>();
      parsed.forEach((row) => { if (!row.dwellingId || !row.date) return; const key = `${row.dwellingId}:${row.date}`; counts.set(key, (counts.get(key) ?? 0) + 1); });
      parsed.forEach((row) => { if (row.dwellingId && row.date && (counts.get(`${row.dwellingId}:${row.date}`) ?? 0) > 1) row.errors.push("Vivienda repetida para la misma fecha"); });
      const fixedRules = new Set(parsed.filter((row) => row.periodStart && row.periodEnd && row.fixedDailyRate !== null).map((row) => `${row.periodStart}|${row.periodEnd}|${row.fixedDailyRate}`));
      if (fixedRules.size > 1) parsed.forEach((row) => row.errors.push("El periodo o la tarifa de Término fijo no coincide con el resto del PDF"));
      setRows(parsed); setProgress("");
    } catch (reason) { setProgress(""); setError(reason instanceof Error ? reason.message : "No se pudo leer el PDF."); }
  };

  const readCsv = async (file: File) => {
    setSource("csv"); setFileName(file.name); setRows([]); setError(""); setMessage(""); setProgress("Leyendo el CSV…");
    try {
      const parsed = parseReadingsCsv(await file.text(), activeDwellings).map((row) => ({
        page: row.line, dwellingId: row.dwellingId, dwellingName: row.dwellingName, address: "", date: row.date,
        periodStart: "", periodEnd: row.date, heating: row.heating, water: row.water, cooling: row.cooling, fixedDailyRate: null, fixed: row.fixed, source: "csv" as const, errors: row.errors,
      }));
      const counts = new Map<string, number>();
      parsed.forEach((row) => { if (row.dwellingId && row.date) counts.set(`${row.dwellingId}:${row.date}`, (counts.get(`${row.dwellingId}:${row.date}`) ?? 0) + 1); });
      parsed.forEach((row) => { if (row.dwellingId && row.date && (counts.get(`${row.dwellingId}:${row.date}`) ?? 0) > 1) row.errors.push("Vivienda repetida para la misma fecha"); });
      setRows(parsed); setProgress("");
    } catch (reason) { setProgress(""); setError(reason instanceof Error ? reason.message : "No se pudo leer el CSV."); }
  };

  const save = async () => {
    if (!ready) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const byDate = new Map<string, ImportRow[]>();
      rows.forEach((row) => byDate.set(row.date, [...(byDate.get(row.date) ?? []), row]));
      for (const [date, dateRows] of byDate) {
        await Promise.all([
          saveService("heating", date, dateRows, token),
          saveService("water", date, dateRows, token),
          saveService("cooling", date, dateRows, token),
        ]);
      }
      let fixedMessage = "";
      if (source === "csv") {
        await api("/imported-fixed-charges", token, { method: "PUT", body: JSON.stringify({ rows: rows.map((row) => ({ dwellingId: row.dwellingId, date: row.date, amount: row.fixed })) }) });
        fixedMessage = ` y ${rows.length} importes fijos registrados`;
      } else {
        const first = rows[0];
        const fixedResult = await api<{ changed: boolean }>("/fixed-neighbor-charges/import", token, { method: "POST", body: JSON.stringify({ periodStart: first.periodStart, periodEnd: first.periodEnd, dailyRate: first.fixedDailyRate }) });
        fixedMessage = fixedResult.changed ? " y una nueva regla de fijo creada" : "; el fijo ya coincidía con la regla vigente";
      }
      setMessage(`${rows.length} registros importados, ${rows.length * 3} lecturas guardadas${fixedMessage}.`); onChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron guardar las lecturas."); }
    finally { setSaving(false); }
  };

  return <section><header className="page-header"><div><p className="eyebrow">Resumen del periodo · Entrada de datos</p><h1>Importar lecturas</h1><p>Usa el PDF habitual o un CSV con la cabecera <code>fecha;piso;calefaccion;frio;agua;fijo</code>. Los archivos se procesan en este navegador y no se almacenan.</p></div><div className="header-actions"><button className="secondary" onClick={onBack}>Volver al resumen</button><label className="file-button secondary-file">Seleccionar CSV<input type="file" accept="text/csv,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readCsv(file); event.target.value = ""; }} /></label><label className="file-button">Seleccionar PDF<input type="file" accept="application/pdf,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readPdf(file); event.target.value = ""; }} /></label></div></header>
    {progress && <div className="loading-line">{progress}</div>}{error && <div className="error-box">{error}</div>}{message && <div className="success-box">{message}</div>}
    {!rows.length && !progress && <article className="panel import-empty"><div className="import-choice-icons"><div className="import-icon csv-icon">CSV</div><div className="import-icon">PDF</div></div><h2>Selecciona un PDF o un CSV</h2><p>El PDF toma las lecturas del “Detalle de consumo” y revisa la tarifa de “Término fijo”. El CSV importa las tres lecturas acumuladas y el fijo realmente facturado a cada vivienda.</p></article>}
    {rows.length > 0 && <><div className="import-metrics"><article className="metric-card"><p>Archivo</p><strong>{fileName}</strong><span>{rows.length} páginas leídas</span></article><article className="metric-card calculated"><p>Viviendas correctas</p><strong>{rows.length - invalid.length}</strong><span>de {activeDwellings.length} esperadas</span></article><article className={`metric-card ${invalid.length || missing.length ? "actual" : "calculated"}`}><p>Revisión</p><strong>{invalid.length + missing.length}</strong><span>{invalid.length ? `${invalid.length} páginas con incidencias` : missing.length ? `${missing.length} viviendas ausentes` : "Lista para importar"}</span></article></div>
      {(invalid.length > 0 || missing.length > 0) && <div className="warning-stack"><p>No se guardará nada hasta que todas las páginas se puedan asociar correctamente.</p>{missing.length > 0 && <p>Faltan: {missing.map((item) => item.short_name).join(", ")}.</p>}</div>}
      <article className="panel table-panel"><div className="panel-title"><div><p className="eyebrow">Revisión previa</p><h2>Lecturas detectadas</h2></div><button className="primary" disabled={!ready || saving} onClick={() => void save()}>{saving ? "Guardando…" : "Importar todos los datos"}</button></div><div className="table-scroll"><table className="import-table"><thead><tr><th>{source === "csv" ? "Línea" : "Página"}</th><th>Vivienda</th><th>Fecha</th><th>Calefacción</th><th>Frío</th><th>Agua</th><th>{source === "csv" ? "Fijo facturado" : "Término fijo"}</th><th>Estado</th></tr></thead><tbody>{rows.map((row) => <tr key={row.page} className={row.errors.length ? "invalid-row" : ""}><td>{row.page}</td><td><b>{row.dwellingName || "Sin identificar"}</b><span>{row.address}</span></td><td>{row.date ? formatDate(row.date) : "—"}</td><td>{formatReading(row.heating, "kWh")}</td><td>{formatReading(row.cooling, "kWh")}</td><td>{formatReading(row.water, "L")}</td><td>{row.fixed === null ? "—" : source === "csv" ? money.format(row.fixed) : `${rate.format(row.fixed)} €/día`}</td><td>{row.errors.length ? <span className="import-error">{row.errors.join(" · ")}</span> : <span className="import-ok">Correcto</span>}</td></tr>)}</tbody></table></div></article></>}
  </section>;
}

async function saveService(service: "heating" | "water" | "cooling", date: string, rows: ImportRow[], token: string) {
  const field = service === "heating" ? "heating" : service === "water" ? "water" : "cooling";
  await api("/readings", token, { method: "PUT", body: JSON.stringify({ service, date, rows: rows.map((row) => ({ dwellingId: row.dwellingId, value: row[field] })) }) });
}

function groupLines(items: Array<{ str: string; x: number; y: number }>): ReceiptLine[] {
  const groups: Array<{ y: number; items: Array<{ str: string; x: number }> }> = [];
  [...items].sort((a, b) => b.y - a.y || a.x - b.x).forEach((item) => {
    const group = groups.find((candidate) => Math.abs(candidate.y - item.y) <= 2.5);
    if (group) group.items.push({ str: item.str, x: item.x });
    else groups.push({ y: item.y, items: [{ str: item.str, x: item.x }] });
  });
  return groups.sort((a, b) => b.y - a.y).map((group) => {
    const cells = group.items.sort((a, b) => a.x - b.x).map((item) => item.str.trim()).filter(Boolean);
    return { cells, text: cells.join(" ") };
  });
}

const readingNumber = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 });
const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const rate = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 4, maximumFractionDigits: 8 });
function formatReading(value: number | null, unit: string) { return value === null ? "—" : `${readingNumber.format(value)} ${unit}`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
