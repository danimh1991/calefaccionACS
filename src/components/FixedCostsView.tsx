import { useEffect, useState } from "react";
import { api } from "../api";
import type { FixedConcept, FixedNeighborCharge, FixedRule } from "../types";
import { lastLayer, topLayer, useNavigation } from "../navigation";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const dailyMoney = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const frequencyLabel = { daily: "día", monthly: "mes", annual: "año" };
const emptyConcept = { name: "", parentId: "", calculationMode: "simple", costTreatment: "additional", notes: "" };
const emptyCharge = { effectiveFrom: "", effectiveTo: "", dailyRate: "", notes: "" };
type RuleRowForm = { conceptId: string; name: string; amount: string; frequency: string; vatRate: string; notes: string };

export function FixedCostsView({ token }: { token: string }) {
  const [concepts, setConcepts] = useState<FixedConcept[]>([]);
  const [charges, setCharges] = useState<FixedNeighborCharge[]>([]);
  const [suggestion, setSuggestion] = useState<{ dailyRate: number | null; effectiveFrom: string | null }>({ dailyRate: null, effectiveFrom: null });
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [conceptForm, setConceptForm] = useState(emptyConcept);
  const [ruleGroupId, setRuleGroupId] = useState("");
  const [ruleDates, setRuleDates] = useState({ effectiveFrom: "", effectiveTo: "" });
  const [ruleRows, setRuleRows] = useState<RuleRowForm[]>([]);
  const [chargeForm, setChargeForm] = useState(emptyCharge);
  const { location, pushLayer, closeLayer } = useNavigation();
  const top = topLayer(location);
  const conceptLayer = top?.kind === "fixed-concept-edit" ? top : undefined;
  const conceptModal = Boolean(conceptLayer);
  const conceptEdit = conceptLayer?.conceptId ?? null;
  const chargeLayer = lastLayer(location, "fixed-charge-edit");
  const chargeEdit = chargeLayer?.chargeId ?? null;
  const ruleLayer = lastLayer(location, "fixed-rule-edit");
  const showError = (reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo completar la operación.");
  const load = () => Promise.all([
    api<{ concepts: FixedConcept[] }>("/fixed-concepts", token),
    api<{ charges: FixedNeighborCharge[]; suggestion: { dailyRate: number | null; effectiveFrom: string | null } }>("/fixed-neighbor-charges", token),
  ]).then(([fixedResult, chargeResult]) => { setConcepts(fixedResult.concepts); setCharges(chargeResult.charges); setSuggestion(chargeResult.suggestion); }).catch(showError);
  useEffect(() => { void load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!conceptLayer) return;
    const concept = concepts.find((item) => item.id === conceptLayer.conceptId);
    setConceptForm(concept ? { name: concept.name, parentId: concept.parent_id ? String(concept.parent_id) : "", calculationMode: concept.calculation_mode, costTreatment: concept.cost_treatment, notes: concept.notes ?? "" } : emptyConcept);
  }, [conceptLayer?.conceptId, concepts]);
  useEffect(() => {
    if (!chargeLayer) { setChargeForm(emptyCharge); return; }
    const charge = charges.find((item) => item.id === chargeLayer.chargeId);
    if (charge) setChargeForm({ effectiveFrom: charge.effective_from, effectiveTo: charge.effective_to ?? "", dailyRate: String(charge.daily_rate), notes: charge.notes ?? "" });
  }, [chargeLayer?.chargeId, charges]);
  const success = (text: string) => { setMessage(text); setError(""); void load(); };
  const parents = concepts.filter((item) => item.parent_id === null);
  const ruleParents = parents.filter((item) => item.calculation_mode === "simple" || concepts.some((concept) => concept.parent_id === item.id));

  const saveConcept = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    try { await api(conceptEdit ? `/fixed-concepts/${conceptEdit}` : "/fixed-concepts", token, { method: conceptEdit ? "PUT" : "POST", body: JSON.stringify(conceptForm) }); setConceptForm(emptyConcept); closeLayer("fixed-concept-edit"); success("Concepto guardado."); } catch (reason) { showError(reason); }
  };
  const editConcept = (concept: FixedConcept) => pushLayer({ kind: "fixed-concept-edit", conceptId: concept.id });
  const removeConcept = async (concept: FixedConcept) => { if (!confirm(`¿Quitar “${concept.name}” y sus subconceptos?`)) return; try { await api(`/fixed-concepts/${concept.id}`, token, { method: "DELETE" }); success("Concepto retirado."); } catch (reason) { showError(reason); } };
  const selectRuleGroup = (value: string, editDate?: string) => {
    setRuleGroupId(value);
    const parent = concepts.find((item) => item.id === Number(value));
    if (!parent) { setRuleRows([]); setRuleDates({ effectiveFrom: "", effectiveTo: "" }); return; }
    const children = concepts.filter((item) => item.parent_id === parent.id);
    const leaves = children.length ? children : [parent];
    const matchingRule = editDate ? leaves.flatMap((item) => item.rules).find((rule) => rule.effective_from === editDate) : undefined;
    setRuleDates({ effectiveFrom: editDate ?? "", effectiveTo: matchingRule?.effective_to ?? "" });
    setRuleRows(leaves.map((concept) => {
      const rule = (editDate ? concept.rules.find((item) => item.effective_from === editDate) : undefined) ?? concept.rules[0];
      return { conceptId: String(concept.id), name: concept.name, amount: rule ? String(rule.amount) : "", frequency: rule?.frequency ?? "monthly", vatRate: rule ? String(rule.vat_rate) : "0", notes: rule?.notes ?? "" };
    }));
  };
  useEffect(() => {
    if (ruleLayer) selectRuleGroup(String(ruleLayer.groupId), ruleLayer.effectiveFrom);
    else selectRuleGroup("");
  }, [ruleLayer?.groupId, ruleLayer?.effectiveFrom, concepts]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveRule = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    try { await api("/fixed-rules/batch", token, { method: "POST", body: JSON.stringify({ ...ruleDates, rows: ruleRows }) }); closeLayer("fixed-rule-edit"); success(`${ruleRows.length} ${ruleRows.length === 1 ? "regla guardada" : "reglas guardadas"}. La regla anterior se ha cerrado automáticamente cuando correspondía.`); } catch (reason) { showError(reason); }
  };
  const editRule = (rule: FixedRule) => { const concept = concepts.find((item) => item.id === rule.concept_id); const groupId = concept?.parent_id ?? concept?.id; if (groupId) pushLayer({ kind: "fixed-rule-edit", groupId, effectiveFrom: rule.effective_from }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const removeRule = async (rule: FixedRule) => { if (!confirm("¿Eliminar esta regla de precio?")) return; try { await api(`/fixed-rules/${rule.id}`, token, { method: "DELETE" }); success("Regla eliminada."); } catch (reason) { showError(reason); } };
  const saveCharge = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    try { await api(chargeEdit ? `/fixed-neighbor-charges/${chargeEdit}` : "/fixed-neighbor-charges", token, { method: chargeEdit ? "PUT" : "POST", body: JSON.stringify(chargeForm) }); setChargeForm(emptyCharge); if (chargeEdit) closeLayer("fixed-charge-edit"); success("Fijo cobrado guardado. El tramo anterior se ha cerrado automáticamente cuando correspondía."); } catch (reason) { showError(reason); }
  };
  const editCharge = (charge: FixedNeighborCharge) => pushLayer({ kind: "fixed-charge-edit", chargeId: charge.id });
  const removeCharge = async (charge: FixedNeighborCharge) => { if (!confirm("¿Eliminar este tramo de fijo cobrado? Los días sin tarifa quedarán señalados en el resumen.")) return; try { await api(`/fixed-neighbor-charges/${charge.id}`, token, { method: "DELETE" }); success("Tramo de fijo cobrado eliminado."); } catch (reason) { showError(reason); } };
  const useSuggestion = () => { if (suggestion.dailyRate === null) return; setChargeForm((current) => ({ ...current, dailyRate: String(Number(suggestion.dailyRate?.toFixed(6))) })); };

  return <section><header className="page-header"><div><p className="eyebrow">Configuración</p><h1>Conceptos fijos</h1><p>Configura tanto los costes reales de la comunidad como el histórico del fijo cobrado a cada vivienda.</p></div><div className="header-actions"><button className="primary" onClick={() => pushLayer({ kind: "fixed-concept-edit", conceptId: null })}>Añadir concepto</button></div></header>
    {error && <div className="error-box">{error}</div>}{message && <div className="success-box">{message}</div>}
    <div className="two-column fixed-charge-section">
      <form className="panel" onSubmit={saveCharge}><div className="panel-title"><div><p className="eyebrow">Ingresos fijos</p><h2>{chargeEdit ? "Editar pago fijo por vivienda" : "Añadir pago fijo por vivienda"}</h2></div></div><p className="form-hint">Indica lo que se cobra realmente a cada vecino por día y durante qué fechas. Si cambia el precio, crea un nuevo tramo.</p><div className="suggestion-box"><span><small>Cifra sugerida con las últimas reglas{suggestion.effectiveFrom ? ` · ${formatDate(suggestion.effectiveFrom)}` : ""}</small><b>{suggestion.dailyRate === null ? "No disponible" : `${money.format(suggestion.dailyRate)} / vecino / día`}</b></span><button type="button" className="secondary" disabled={suggestion.dailyRate === null} onClick={useSuggestion}>Utilizar cifra sugerida</button></div><div className="form-grid"><label>Desde<input required type="date" value={chargeForm.effectiveFrom} onChange={(e) => setChargeForm({ ...chargeForm, effectiveFrom: e.target.value })} /></label><label>Hasta (opcional)<input type="date" value={chargeForm.effectiveTo} onChange={(e) => setChargeForm({ ...chargeForm, effectiveTo: e.target.value })} /></label><label>Precio por vecino/día (€)<input required min="0" step="0.000001" type="number" value={chargeForm.dailyRate} onChange={(e) => setChargeForm({ ...chargeForm, dailyRate: e.target.value })} /></label><label>Nota<input value={chargeForm.notes} onChange={(e) => setChargeForm({ ...chargeForm, notes: e.target.value })} /></label></div><div className="form-actions"><button className="primary">Guardar pago fijo</button>{chargeEdit && <button type="button" className="secondary" onClick={() => closeLayer("fixed-charge-edit")}>Cancelar</button>}</div></form>
      <article className="panel"><div className="panel-title"><div><p className="eyebrow">Histórico</p><h2>Fijo cobrado por vivienda</h2></div><span className="muted">{charges.length} tramo{charges.length === 1 ? "" : "s"}</span></div><div className="charge-history">{charges.length ? charges.map((charge) => <div className="rule-row" key={charge.id}><span><b>{formatDate(charge.effective_from)} — {charge.effective_to ? formatDate(charge.effective_to) : "vigente"}</b><small>{charge.notes || "Sin nota"}</small></span><span><small>Precio cobrado</small><b>{money.format(charge.daily_rate)} / vecino / día</b></span><div className="row-actions"><button type="button" onClick={() => editCharge(charge)}>Editar</button><button type="button" onClick={() => removeCharge(charge)}>×</button></div></div>) : <p className="empty-note">Todavía no hay ningún precio fijo configurado.</p>}</div></article>
    </div>
    <div className="fixed-rule-editor">
      <form className="panel grouped-rule-form" onSubmit={saveRule}><div className="panel-title"><div><p className="eyebrow">Coste y vigencia</p><h2>Reglas por concepto principal</h2></div></div><div className="form-grid rule-group-head"><label>Concepto principal<select required value={ruleGroupId} onChange={(e) => { const groupId = Number(e.target.value); if (groupId) pushLayer({ kind: "fixed-rule-edit", groupId }); else closeLayer("fixed-rule-edit"); }}><option value="">Selecciona…</option>{ruleParents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Desde<input required type="date" value={ruleDates.effectiveFrom} onChange={(e) => setRuleDates({ ...ruleDates, effectiveFrom: e.target.value })} /></label><label>Hasta (opcional)<input type="date" value={ruleDates.effectiveTo} onChange={(e) => setRuleDates({ ...ruleDates, effectiveTo: e.target.value })} /></label></div>{ruleRows.length > 0 ? <div className="batch-rule-list">{ruleRows.map((row, index) => <div className="batch-rule-row" key={row.conceptId}><strong>{row.name}</strong><label>Importe (€)<input required min="0" step="0.000001" type="number" value={row.amount} onChange={(e) => setRuleRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: e.target.value } : item))} /></label><label>Periodicidad<select value={row.frequency} onChange={(e) => setRuleRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, frequency: e.target.value } : item))}><option value="daily">Diario</option><option value="monthly">Mensual</option><option value="annual">Anual</option></select></label><label>IVA (%)<input required min="0" step="0.01" type="number" value={row.vatRate} onChange={(e) => setRuleRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, vatRate: e.target.value } : item))} /></label><label>Nota<input value={row.notes} onChange={(e) => setRuleRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, notes: e.target.value } : item))} /></label></div>)}</div> : <p className="empty-note">Selecciona un concepto principal para editar juntas todas sus subcategorías.</p>}<div className="form-actions"><button className="primary" disabled={!ruleRows.length}>Guardar todas las reglas</button>{ruleGroupId && <button type="button" className="secondary" onClick={() => closeLayer("fixed-rule-edit")}>Cancelar</button>}</div></form>
    </div>
    <section className="concept-section"><div className="panel-title"><div><p className="eyebrow">Configuración vigente e histórica</p><h2>{parents.length} conceptos principales</h2></div><span className="muted">Pulsa un concepto para ver subconceptos y reglas</span></div><div className="concept-list">{parents.map((parent) => { const open = top?.kind === "fixed-concept-detail" && top.conceptId === parent.id; return <ConceptBlock key={parent.id} parent={parent} concepts={concepts} open={open} onToggle={() => open ? closeLayer("fixed-concept-detail") : pushLayer({ kind: "fixed-concept-detail", conceptId: parent.id })} onEditConcept={editConcept} onRemoveConcept={removeConcept} onEditRule={editRule} onRemoveRule={removeRule} />; })}</div></section>
    {conceptModal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeLayer("fixed-concept-edit"); }}><form className="panel concept-modal" onSubmit={saveConcept}><div className="panel-title"><div><p className="eyebrow">Estructura</p><h2>{conceptEdit ? "Editar concepto" : "Añadir concepto"}</h2></div><button type="button" className="modal-close" aria-label="Cerrar" onClick={() => closeLayer("fixed-concept-edit")}>×</button></div><div className="form-stack"><label>Nombre<input autoFocus required value={conceptForm.name} onChange={(e) => setConceptForm({ ...conceptForm, name: e.target.value })} /></label>{!conceptEdit && <label>Dentro de otro concepto<select value={conceptForm.parentId} onChange={(e) => setConceptForm({ ...conceptForm, parentId: e.target.value, calculationMode: "simple" })}><option value="">Concepto principal</option>{parents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<label>Forma de cálculo<select disabled={Boolean(conceptForm.parentId)} value={conceptForm.calculationMode} onChange={(e) => setConceptForm({ ...conceptForm, calculationMode: e.target.value })}><option value="simple">Importe único</option><option value="separate">Separado en subconceptos</option></select></label><label>Tratamiento en el cierre<select value={conceptForm.costTreatment} onChange={(e) => setConceptForm({ ...conceptForm, costTreatment: e.target.value })}><option value="additional">Coste adicional a las facturas</option><option value="included">Ya incluido en las facturas</option></select></label><label>Nota informativa<textarea value={conceptForm.notes} onChange={(e) => setConceptForm({ ...conceptForm, notes: e.target.value })} /></label><div className="form-actions"><button type="button" className="secondary" onClick={() => closeLayer("fixed-concept-edit")}>Cancelar</button><button className="primary">Guardar concepto</button></div></div></form></div>}
  </section>;
}

function ConceptBlock({ parent, concepts, open, onToggle, onEditConcept, onRemoveConcept, onEditRule, onRemoveRule }: { parent: FixedConcept; concepts: FixedConcept[]; open: boolean; onToggle: () => void; onEditConcept: (c: FixedConcept) => void; onRemoveConcept: (c: FixedConcept) => void; onEditRule: (r: FixedRule) => void; onRemoveRule: (r: FixedRule) => void }) {
  const children = concepts.filter((item) => item.parent_id === parent.id); const leaves = children.length ? children : [parent];
  const latestDate = leaves.flatMap((item) => item.rules.map((rule) => rule.effective_from)).sort().at(-1) ?? null;
  const dailyTotal = latestDate ? leaves.reduce((sum, concept) => {
    const rule = concept.rules.find((item) => item.effective_from <= latestDate && (!item.effective_to || item.effective_to >= latestDate));
    return sum + (rule ? ruleDailyValue(rule, latestDate) : 0);
  }, 0) : null;
  return <details className="concept-block" open={open}><summary onClick={(event) => { event.preventDefault(); onToggle(); }}><span className="concept-summary-main"><b>{parent.name}</b><small>{children.length ? `${children.length} subconceptos` : parent.notes || "Importe único"}</small></span><span className="concept-daily-total"><small>Total por día{latestDate ? ` · ${formatDate(latestDate)}` : ""}</small><strong>{dailyTotal === null ? "Sin reglas" : `${dailyMoney.format(dailyTotal)} / día`}</strong></span><span className="concept-chevron" aria-hidden="true">⌄</span></summary><div className="concept-detail"><header><div><p>{parent.notes || "Sin nota"}</p><span className="concept-tag">{parent.cost_treatment === "included" ? "Incluido en factura" : "Coste adicional"}</span></div><div className="row-actions"><button type="button" onClick={() => onEditConcept(parent)}>Editar concepto</button><button type="button" onClick={() => onRemoveConcept(parent)}>Quitar</button></div></header>{leaves.map((concept) => <div className="subconcept" key={concept.id}><div className="subconcept-title"><span><b>{concept.name}</b>{concept !== parent && <small>{concept.notes}</small>}</span>{concept !== parent && <div className="row-actions"><button type="button" onClick={() => onEditConcept(concept)}>Editar</button></div>}</div>{concept.rules.length ? concept.rules.map((rule) => <div className="rule-row compact-rule" key={rule.id}><span><b>Desde {formatDate(rule.effective_from)}</b><small>{rule.effective_to ? ` hasta ${formatDate(rule.effective_to)}` : " · vigente"}{rule.notes ? ` · ${rule.notes}` : ""}</small></span><span><small>Coste comunidad</small><b>{money.format(rule.amount)} / {frequencyLabel[rule.frequency]} + {rule.vat_rate}% IVA</b></span><div className="row-actions"><button type="button" onClick={() => onEditRule(rule)}>Editar</button><button type="button" onClick={() => onRemoveRule(rule)}>×</button></div></div>) : <p className="empty-note">Sin reglas de importe.</p>}</div>)}</div></details>;
}
function ruleDailyValue(rule: FixedRule, dateValue: string) { const date = new Date(`${dateValue}T00:00:00Z`); const divisor = rule.frequency === "monthly" ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate() : rule.frequency === "annual" ? ((date.getUTCFullYear() % 4 === 0 && date.getUTCFullYear() % 100 !== 0) || date.getUTCFullYear() % 400 === 0 ? 366 : 365) : 1; return rule.amount * (1 + rule.vat_rate / 100) / divisor; }
function formatDate(value: string) { const date = new Date(`${value}T00:00:00Z`); return Number.isNaN(date.getTime()) ? value || "Fecha no válida" : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date); }
