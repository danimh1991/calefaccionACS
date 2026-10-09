import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import type { Bootstrap } from "./types";
import { SummaryView } from "./components/SummaryView";
import { ReadingsView } from "./components/ReadingsView";
import { InvoicesView } from "./components/InvoicesView";
import { FixedCostsView } from "./components/FixedCostsView";
import { ReceiptImportView } from "./components/ReceiptImportView";
import { HelpView } from "./components/HelpView";
import { NavigationProvider, useNavigation, type Tab } from "./navigation";

const tabs: Array<{ id: Tab; label: string; eyebrow: string }> = [
  { id: "summary", label: "Resumen del periodo", eyebrow: "Cierre" },
  { id: "fixed", label: "Conceptos fijos", eyebrow: "Configuración" },
  { id: "heating", label: "Calefacción", eyebrow: "Lecturas" },
  { id: "water", label: "Agua", eyebrow: "Lecturas" },
  { id: "cooling", label: "Frío", eyebrow: "Lecturas" },
  { id: "invoices", label: "Facturas", eyebrow: "Costes" },
  { id: "help", label: "Guía de uso", eyebrow: "Ayuda" },
];

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("calefaccion-pin") ?? "");
  const [draftPin, setDraftPin] = useState("");
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (candidate = token) => {
    setLoading(true);
    setError("");
    try {
      const next = await api<Bootstrap>("/bootstrap", candidate);
      setData(next);
      if (candidate) {
        sessionStorage.setItem("calefaccion-pin", candidate);
        setToken(candidate);
      }
    } catch (reason) {
      setData(null);
      if (!(reason instanceof ApiError && reason.status === 401)) {
        setError(reason instanceof Error ? reason.message : "No se pudo cargar la aplicación.");
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) return <div className="center-state"><div className="spinner" /><p>Cargando la comunidad…</p></div>;

  if (!data) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="brand-mark">C·A</div>
          <p className="eyebrow">César Cort Botí 59</p>
          <h1>Calefacción y ACS</h1>
          <p className="muted">Introduce el PIN de cuatro cifras para consultar y actualizar las liquidaciones.</p>
          <form onSubmit={(event) => { event.preventDefault(); if (draftPin.length === 4) void load(draftPin); }}>
            <label>PIN de acceso<input className="pin-input" aria-label="PIN de acceso" autoFocus type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4}" maxLength={4} value={draftPin} onChange={(event) => setDraftPin(event.target.value.replace(/\D/g, "").slice(0, 4))} /></label>
            <button className="primary" type="submit" disabled={draftPin.length !== 4}>Entrar</button>
          </form>
          {error && <p className="error-box">{error}</p>}
        </section>
      </main>
    );
  }

  const refresh = () => load(token);
  return <NavigationProvider><AuthenticatedApp data={data} token={token} error={error} refresh={refresh} clearError={() => setError("")} /></NavigationProvider>;
}

function AuthenticatedApp({ data, token, error, refresh, clearError }: { data: Bootstrap; token: string; error: string; refresh: () => void; clearError: () => void }) {
  const { location, navigateTab } = useNavigation();
  const tab = location.tab;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark small">C·A</div>
          <div><strong>Calefacción</strong><span>y ACS</span></div>
        </div>
        <nav aria-label="Secciones">
          {tabs.map((item) => (
            <button key={item.id} className={tab === item.id ? "nav-item active" : "nav-item"} onClick={() => navigateTab(item.id)}>
              <span>{item.eyebrow}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot"><span>{data.dwellings.length}</span> viviendas activas</div>
      </aside>
      <main className="content">
        {error && <div className="error-box global">{error}<button onClick={clearError}>Cerrar</button></div>}
        {tab === "summary" && <SummaryView data={data} token={token} onChanged={refresh} onImport={() => navigateTab("import")} onFixed={() => navigateTab("fixed")} />}
        {tab === "fixed" && <FixedCostsView token={token} />}
        {tab === "import" && <ReceiptImportView data={data} token={token} onChanged={refresh} onBack={() => window.history.back()} />}
        {tab === "heating" && <ReadingsView service="heating" title="Lecturas de calefacción" data={data} token={token} onChanged={refresh} />}
        {tab === "water" && <ReadingsView service="water" title="Lecturas de agua" data={data} token={token} onChanged={refresh} />}
        {tab === "cooling" && <ReadingsView service="cooling" title="Lecturas de frío" data={data} token={token} onChanged={refresh} />}
        {tab === "invoices" && <InvoicesView data={data} token={token} onChanged={refresh} />}
        {tab === "help" && <HelpView onNavigate={navigateTab} />}
      </main>
    </div>
  );
}
