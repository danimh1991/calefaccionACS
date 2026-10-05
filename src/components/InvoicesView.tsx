import { useState } from "react";
import { api } from "../api";
import type { Bootstrap } from "../types";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const labels = { electricity: "Luz", water: "Agua", other: "Otros" };

export function InvoicesView({ data, token, onChanged }: { data: Bootstrap; token: string; onChanged: () => void }) {
  const [form, setForm] = useState({ invoiceType: "electricity", invoiceDate: "", amount: "", description: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try { await api("/invoices", token, { method: "POST", body: JSON.stringify(form) }); setForm({ invoiceType: "electricity", invoiceDate: "", amount: "", description: "" }); onChanged(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar la factura."); }
    finally { setSaving(false); }
  };
  const remove = async (id: number) => { if (!confirm("¿Eliminar esta factura?")) return; await api(`/invoices/${id}`, token, { method: "DELETE" }); onChanged(); };
  return <section><header className="page-header"><div><p className="eyebrow">Costes del periodo</p><h1>Facturas</h1><p>El cierre incluye las facturas con fecha posterior al inicio y hasta la fecha final, incluida.</p></div></header>
    <div className="two-column invoices-layout"><form className="panel invoice-form" onSubmit={submit}><div className="panel-title"><div><p className="eyebrow">Nueva entrada</p><h2>Añadir factura</h2></div></div><label>Tipo<select value={form.invoiceType} onChange={(e) => setForm({ ...form, invoiceType: e.target.value })}><option value="electricity">Luz</option><option value="water">Agua</option><option value="other">Otros</option></select></label><label>Fecha<input required type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} /></label><label>Importe (€)<input required type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label><label>Descripción opcional<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>{error && <p className="error-box">{error}</p>}<button className="primary" disabled={saving}>{saving ? "Guardando…" : "Añadir factura"}</button></form>
      <article className="panel"><div className="panel-title"><div><p className="eyebrow">Histórico</p><h2>{data.invoices.length} facturas</h2></div></div><div className="invoice-list">{data.invoices.map((invoice) => <div key={invoice.id}><span className={`invoice-kind ${invoice.invoice_type}`}>{labels[invoice.invoice_type]}</span><span><b>{formatDate(invoice.invoice_date)}</b><small>{invoice.description || "Sin descripción"}</small></span><strong>{money.format(invoice.amount)}</strong><button aria-label="Eliminar factura" onClick={() => void remove(invoice.id)}>×</button></div>)}</div></article>
    </div>
  </section>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
