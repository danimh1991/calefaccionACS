import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type Tab = "summary" | "fixed" | "import" | "heating" | "water" | "cooling" | "invoices";
export type ReadingService = "heating" | "water" | "cooling";

export type NavigationLayer =
  | { kind: "summary-period-edit" }
  | { kind: "reading-calendar"; service: ReadingService }
  | { kind: "reading-history"; service: ReadingService; dwellingId: number }
  | { kind: "fixed-concept-detail"; conceptId: number }
  | { kind: "fixed-concept-edit"; conceptId: number | null }
  | { kind: "fixed-charge-edit"; chargeId: number }
  | { kind: "fixed-rule-edit"; groupId: number; effectiveFrom?: string }
  | { kind: "invoice-type-edit"; typeId: number };

export type NavigationLocation = { tab: Tab; layers: NavigationLayer[] };

type NavigationContextValue = {
  location: NavigationLocation;
  navigateTab: (tab: Tab) => void;
  pushLayer: (layer: NavigationLayer) => void;
  closeLayer: (kind?: NavigationLayer["kind"]) => void;
};

const HISTORY_KEY = "__calefaccionNavigation";
const HISTORY_VERSION = 1;
const defaultLocation: NavigationLocation = { tab: "summary", layers: [] };
const NavigationContext = createContext<NavigationContextValue | null>(null);

type StoredNavigation = { version: number; location: NavigationLocation };

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(readLocation);
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    const stored = parseStoredNavigation(window.history.state);
    if (stored) { locationRef.current = stored; setLocation(stored); }
    else window.history.replaceState(withLocation(window.history.state, defaultLocation), "");

    const onPopState = (event: PopStateEvent) => {
      const next = parseStoredNavigation(event.state);
      if (next) { locationRef.current = next; setLocation(next); }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const push = useCallback((next: NavigationLocation) => {
    if (sameLocation(locationRef.current, next)) return;
    window.history.pushState(withLocation(window.history.state, next), "");
    locationRef.current = next;
    setLocation(next);
  }, []);

  const navigateTab = useCallback((tab: Tab) => push(navigateToTab(locationRef.current, tab)), [push]);
  const pushLayer = useCallback((layer: NavigationLayer) => {
    push(appendLayer(locationRef.current, layer));
  }, [push]);
  const closeLayer = useCallback((kind?: NavigationLayer["kind"]) => {
    let index = location.layers.length - 1;
    if (kind) {
      while (index >= 0 && location.layers[index].kind !== kind) index -= 1;
    }
    if (index < 0) return;
    window.history.go(-(location.layers.length - index));
  }, [location.layers]);

  const value = useMemo(() => ({ location, navigateTab, pushLayer, closeLayer }), [location, navigateTab, pushLayer, closeLayer]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const value = useContext(NavigationContext);
  if (!value) throw new Error("useNavigation debe usarse dentro de NavigationProvider");
  return value;
}

export function topLayer(location: NavigationLocation) { return location.layers.at(-1); }
export function hasLayer(location: NavigationLocation, predicate: (layer: NavigationLayer) => boolean) { return location.layers.some(predicate); }
export function lastLayer<T extends NavigationLayer["kind"]>(location: NavigationLocation, kind: T) {
  return [...location.layers].reverse().find((layer): layer is Extract<NavigationLayer, { kind: T }> => layer.kind === kind);
}
export function navigateToTab(_location: NavigationLocation, tab: Tab): NavigationLocation { return { tab, layers: [] }; }
export function appendLayer(location: NavigationLocation, layer: NavigationLayer): NavigationLocation {
  return JSON.stringify(location.layers.at(-1)) === JSON.stringify(layer) ? location : { tab: location.tab, layers: [...location.layers, layer] };
}

function readLocation(): NavigationLocation {
  return parseStoredNavigation(window.history.state) ?? defaultLocation;
}

function withLocation(state: unknown, location: NavigationLocation) {
  const base = state && typeof state === "object" ? state as Record<string, unknown> : {};
  return { ...base, [HISTORY_KEY]: { version: HISTORY_VERSION, location } satisfies StoredNavigation };
}

export function parseStoredNavigation(state: unknown): NavigationLocation | null {
  if (!state || typeof state !== "object") return null;
  const stored = (state as Record<string, unknown>)[HISTORY_KEY] as StoredNavigation | undefined;
  if (!stored || stored.version !== HISTORY_VERSION || !isLocation(stored.location)) return null;
  return stored.location;
}

function isLocation(value: unknown): value is NavigationLocation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as NavigationLocation;
  return ["summary", "fixed", "import", "heating", "water", "cooling", "invoices"].includes(candidate.tab)
    && Array.isArray(candidate.layers) && candidate.layers.every(isLayer);
}

function isLayer(value: unknown): value is NavigationLayer {
  if (!value || typeof value !== "object" || typeof (value as { kind?: unknown }).kind !== "string") return false;
  const layer = value as Record<string, unknown>;
  if (["summary-period-edit"].includes(String(layer.kind))) return true;
  if (layer.kind === "reading-calendar") return ["heating", "water", "cooling"].includes(String(layer.service));
  if (layer.kind === "reading-history") return ["heating", "water", "cooling"].includes(String(layer.service)) && typeof layer.dwellingId === "number";
  if (layer.kind === "fixed-concept-detail") return typeof layer.conceptId === "number";
  if (layer.kind === "fixed-concept-edit") return layer.conceptId === null || typeof layer.conceptId === "number";
  if (layer.kind === "fixed-charge-edit") return typeof layer.chargeId === "number";
  if (layer.kind === "fixed-rule-edit") return typeof layer.groupId === "number" && (layer.effectiveFrom === undefined || typeof layer.effectiveFrom === "string");
  if (layer.kind === "invoice-type-edit") return typeof layer.typeId === "number";
  return false;
}

function sameLocation(left: NavigationLocation, right: NavigationLocation) {
  return JSON.stringify(left) === JSON.stringify(right);
}
