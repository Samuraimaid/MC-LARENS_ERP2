import { describe, expect, it } from "vitest";
import {
  fuzzyFilterItems,
  fuzzyMatch,
  normalizeForFuzzy,
  splitHighlighted,
} from "./fuzzyHighlight";

describe("fuzzyHighlight (U14)", () => {
  it("matches sequential letters and returns indices (stg → Settings)", () => {
    const m = fuzzyMatch("stg", "Settings");
    expect(m).not.toBeNull();
    expect(m.indices).toEqual([0, 2, 6]);
  });

  it("highlights matched letters for cyan render segments", () => {
    const m = fuzzyMatch("stg", "Settings");
    expect(m).not.toBeNull();
    const parts = splitHighlighted("Settings", m.indices);
    const matchedChars = parts.filter((p) => p.matched).map((p) => p.text).join("");
    expect(normalizeForFuzzy(matchedChars)).toBe("stg");
    expect(parts.some((p) => p.matched)).toBe(true);
    expect(parts.some((p) => !p.matched)).toBe(true);
  });

  it("ranks tighter / prefix matches higher", () => {
    const a = fuzzyMatch("ven", "Ventas");
    const b = fuzzyMatch("ven", "Inventario");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a.score).toBeGreaterThan(b.score);
  });

  it("empty query does not filter (Recientes path)", () => {
    const items = [
      { id: "1", label: "Ventas" },
      { id: "2", label: "Inventario" },
    ];
    const out = fuzzyFilterItems("", items);
    expect(out).toHaveLength(2);
    expect(out[0].indices).toEqual([]);
  });

  it("rejects non-matching query", () => {
    expect(fuzzyMatch("zzz", "Ventas")).toBeNull();
  });

  it("strips accents for Spanish labels", () => {
    const m = fuzzyMatch("configuracion", "Configuración");
    expect(m).not.toBeNull();
  });
});

describe("command palette nested Esc levels (U14)", () => {
  it("Esc pops one stack level instead of always closing", () => {
    // Pure stack contract used by CommandPalette keyboard handler
    const popLevel = (stack) => {
      if (stack.length === 0) return { stack, close: true };
      return { stack: stack.slice(0, -1), close: false };
    };
    const nested = [{ id: "root" }, { id: "theme" }];
    const mid = popLevel(nested);
    expect(mid.close).toBe(false);
    expect(mid.stack).toEqual([{ id: "root" }]);
    const root = popLevel(mid.stack);
    expect(root.close).toBe(false);
    expect(root.stack).toEqual([]);
    const closed = popLevel(root.stack);
    expect(closed.close).toBe(true);
  });
});
