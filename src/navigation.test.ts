import { describe, expect, it } from "vitest";
import { appendLayer, navigateToTab, parseStoredNavigation, type NavigationLocation } from "./navigation";

const key = "__calefaccionNavigation";

describe("historial de navegación", () => {
  it("apila estados secundarios en orden LIFO sin mutar el estado anterior", () => {
    const base: NavigationLocation = { tab: "fixed", layers: [] };
    const detail = appendLayer(base, { kind: "fixed-concept-detail", conceptId: 4 });
    const modal = appendLayer(detail, { kind: "fixed-concept-edit", conceptId: 7 });

    expect(base.layers).toEqual([]);
    expect(modal.layers).toEqual([
      { kind: "fixed-concept-detail", conceptId: 4 },
      { kind: "fixed-concept-edit", conceptId: 7 },
    ]);
    expect(modal.layers.at(-1)).toEqual({ kind: "fixed-concept-edit", conceptId: 7 });
    expect(appendLayer(modal, { kind: "fixed-concept-edit", conceptId: 7 })).toBe(modal);
  });

  it("cambiar de sección crea una ubicación limpia", () => {
    const current: NavigationLocation = { tab: "fixed", layers: [{ kind: "fixed-concept-edit", conceptId: null }] };
    expect(navigateToTab(current, "water")).toEqual({ tab: "water", layers: [] });
  });

  it("restaura sólo estados propios y válidos", () => {
    const location: NavigationLocation = { tab: "heating", layers: [{ kind: "reading-history", service: "heating", dwellingId: 12 }] };
    expect(parseStoredNavigation({ unrelated: true, [key]: { version: 1, location } })).toEqual(location);
    expect(parseStoredNavigation({ [key]: { version: 1, location: { tab: "heating", layers: [{ kind: "reading-history", service: "bad", dwellingId: 12 }] } } })).toBeNull();
    expect(parseStoredNavigation({ [key]: { version: 2, location } })).toBeNull();
  });

  it("reconoce la guía de uso como una sección navegable", () => {
    const location: NavigationLocation = { tab: "help", layers: [] };
    expect(parseStoredNavigation({ [key]: { version: 1, location } })).toEqual(location);
  });

  it("restaura la creación de un nuevo periodo como estado independiente", () => {
    const location: NavigationLocation = { tab: "summary", layers: [{ kind: "summary-period-create" }] };
    expect(parseStoredNavigation({ [key]: { version: 1, location } })).toEqual(location);
  });
});
