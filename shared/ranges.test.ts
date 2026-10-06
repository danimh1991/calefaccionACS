import { describe, expect, it } from "vitest";
import { previousDay, resolveRuleEnd } from "./ranges";

describe("rangos de vigencia", () => {
  it("cierra una regla el día anterior a la siguiente", () => {
    expect(resolveRuleEnd(null, "2026-10-15")).toBe("2026-10-14");
  });

  it("respeta un final anterior a la siguiente regla", () => {
    expect(resolveRuleEnd("2026-10-10", "2026-10-15")).toBe("2026-10-10");
  });

  it("rechaza rangos que se solapan", () => {
    expect(() => resolveRuleEnd("2026-10-15", "2026-10-15")).toThrow("solapa");
  });

  it("calcula correctamente el día anterior al cambiar de mes", () => {
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
  });
});
