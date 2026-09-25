import { describe, expect, it } from "vitest";
import {
  assessPassword,
  assessPin,
  estimateEntropyBits,
  meterBarClass,
} from "./passwordStrength";

describe("passwordStrength (U15)", () => {
  it("empty password → coach tip about length/passphrase, not symbols", () => {
    const r = assessPassword("");
    expect(r.level).toBe("empty");
    expect(r.tip.toLowerCase()).toMatch(/longitud|frase|palabras/);
    expect(r.tip.toLowerCase()).not.toMatch(/debe.*s[ií]mbolo|must have symbol/);
    expect(r.items.some((i) => i.id === "len8")).toBe(true);
  });

  it("short password is Débil; live checklist updates", () => {
    const r = assessPassword("abc");
    expect(r.label).toBe("Débil");
    expect(r.items.find((i) => i.id === "len8").ok).toBe(false);
    expect(r.percent).toBeLessThan(50);
  });

  it("length beats a single symbol (passphrase scores higher)", () => {
    const withSymbol = assessPassword("Ab1!");
    const passphrase = assessPassword("casa azul mar costa");
    expect(passphrase.score).toBeGreaterThan(withSymbol.score);
    expect(["Regular", "Casi", "Fuerte"]).toContain(passphrase.label);
    expect(withSymbol.label).toBe("Débil");
  });

  it("meter labels are Débil → Regular → Casi → Fuerte", () => {
    const labels = new Set();
    const samples = [
      "x",
      "password1",
      "mi frase corta",
      "mi casa azul y el mar",
      "correct horse battery staple 99",
    ];
    samples.forEach((s) => labels.add(assessPassword(s).label));
    expect(labels.has("Débil")).toBe(true);
    // Strong passphrase should hit Fuerte or at least Casi
    const strong = assessPassword("correct horse battery staple 99");
    expect(["Casi", "Fuerte"]).toContain(strong.label);
  });

  it("checklist turns green as length milestones are met", () => {
    const a = assessPassword("abcdefgh"); // 8
    expect(a.items.find((i) => i.id === "len8").ok).toBe(true);
    expect(a.items.find((i) => i.id === "len12").ok).toBe(false);
    const b = assessPassword("abcdefghijkl"); // 12
    expect(b.items.find((i) => i.id === "len12").ok).toBe(true);
  });

  it("entropy grows with length", () => {
    expect(estimateEntropyBits("abcd")).toBeLessThan(estimateEntropyBits("abcdefghijkl"));
  });

  it("common / sequential passwords stay weak", () => {
    expect(assessPassword("password").score).toBeLessThanOrEqual(1);
    expect(assessPassword("12345678").score).toBeLessThanOrEqual(1);
  });

  it("PIN assess: exact length + soft weak-pattern tips", () => {
    const empty = assessPin("", { length: 8 });
    expect(empty.level).toBe("empty");
    const partial = assessPin("12", { length: 8 });
    expect(partial.label).toBe("Débil");
    expect(partial.items.find((i) => i.id === "length").ok).toBe(false);
    const seq = assessPin("12345678", { length: 8 });
    expect(seq.label).toBe("Regular");
    const good = assessPin("58201947", { length: 8 });
    expect(good.label).toBe("Fuerte");
    expect(good.items.find((i) => i.id === "length").ok).toBe(true);
  });

  it("PIN 4-digit kiosk mode", () => {
    const r = assessPin("7391", { length: 4 });
    expect(r.label).toBe("Fuerte");
    expect(assessPin("1111", { length: 4 }).label).toBe("Regular");
  });

  it("meterBarClass maps levels", () => {
    expect(meterBarClass("strong")).toMatch(/emerald/);
    expect(meterBarClass("almost")).toMatch(/teal/);
    expect(meterBarClass("fair")).toMatch(/amber/);
    expect(meterBarClass("weak")).toMatch(/rose/);
  });
});
