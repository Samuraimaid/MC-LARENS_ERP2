import { describe, expect, it } from "vitest";
import {
  expandSearchToken,
  findProductsByScanCode,
  getProductSearchableText,
  isEditDistanceAtMostOne,
  normalizeSearchInput,
  productMatchesSearch,
  tokenizeSearchQuery,
} from "./productLookup";

const products = [
  { product_id: "p1", sku: "AMP-4CH-1200", name: "Amplificador 4 canales", barcode: "7501234567890" },
  { product_id: "p2", sku: "SUB-12-1000", name: "Subwoofer 12 pulgadas" },
  {
    product_id: "p3",
    sku: "DLAA-LED-H4",
    name: "Kit LED H4",
    brand: "DLAA",
    description: "Faros LED",
    compatibility: {
      brands: ["Mitsubishi", "Toyota"],
      models: ["Lancer", "Corolla"],
      texto: "Compatible con Mitsubishi Lancer",
    },
    compatibilidad_texto: "Mitsubishi / Toyota",
  },
  {
    product_id: "p4",
    sku: "DS18-VIXH11",
    name: "Kit LED H11",
    brand: "DS18",
  },
  {
    product_id: "p5",
    sku: "FOX-2.0-IFP",
    name: "Amortiguador 2.0 IFP",
    brand: "FOX SHOCKS",
  },
];

describe("productLookup", () => {
  it("finds exact sku matches", () => {
    const matches = findProductsByScanCode(products, "AMP-4CH-1200");
    expect(matches).toHaveLength(1);
    expect(matches[0].product_id).toBe("p1");
  });

  it("finds exact barcode matches", () => {
    const matches = findProductsByScanCode(products, "7501234567890");
    expect(matches).toHaveLength(1);
    expect(matches[0].product_id).toBe("p1");
  });

  it("searches product fields in list filter", () => {
    expect(productMatchesSearch(products[1], "SUB-12")).toBe(true);
    expect(productMatchesSearch(products[1], "7501234567890")).toBe(false);
  });

  it("tokenizes on whitespace", () => {
    expect(tokenizeSearchQuery("  Dlaa   Mitsubishi  ")).toEqual(["dlaa", "mitsubishi"]);
    expect(tokenizeSearchQuery("")).toEqual([]);
  });

  it("normalizes spaced DS18 forms before tokenize", () => {
    expect(normalizeSearchInput("DS 18")).toBe("ds18");
    expect(normalizeSearchInput("DSS-18")).toBe("ds18");
    expect(tokenizeSearchQuery("DS 18 Mitsubishi")).toEqual(["ds18", "mitsubishi"]);
  });

  it("AND-matches multi-term across brand + compatibility", () => {
    expect(productMatchesSearch(products[2], "Dlaa Mitsubishi")).toBe(true);
    expect(productMatchesSearch(products[2], "dlaa lancer")).toBe(true);
    expect(productMatchesSearch(products[2], "DLAA Honda")).toBe(false);
    expect(productMatchesSearch(products[0], "Dlaa Mitsubishi")).toBe(false);
  });

  it("includes description and compatibilidad_texto in searchable blob", () => {
    const text = getProductSearchableText(products[2]);
    expect(text).toContain("faros led");
    expect(text).toContain("mitsubishi");
    expect(text).toContain("lancer");
  });

  it("expands brand aliases (DLLA→DLAA, DSS18→DS18)", () => {
    expect(expandSearchToken("dlla")).toEqual(expect.arrayContaining(["dlla", "dlaa"]));
    expect(expandSearchToken("dss18")).toEqual(expect.arrayContaining(["dss18", "ds18"]));
  });

  it("matches DLLA typo to DLAA brand products", () => {
    expect(productMatchesSearch(products[2], "DLLA")).toBe(true);
    expect(productMatchesSearch(products[2], "dlla mitsubishi")).toBe(true);
  });

  it("matches DSS18 / DS 18 typos to DS18 brand products", () => {
    expect(productMatchesSearch(products[3], "DSS18")).toBe(true);
    expect(productMatchesSearch(products[3], "DS 18")).toBe(true);
  });

  it("matches common FOX typos", () => {
    expect(productMatchesSearch(products[4], "foox")).toBe(true);
    expect(productMatchesSearch(products[4], "foxx")).toBe(true);
  });

  it("keeps multi-term AND with soft tokens", () => {
    expect(productMatchesSearch(products[2], "dlla lancer")).toBe(true);
    expect(productMatchesSearch(products[2], "dlla honda")).toBe(false);
  });

  it("edit-distance ≤1 includes transposition", () => {
    expect(isEditDistanceAtMostOne("dlaa", "dala")).toBe(true); // transposition
    expect(isEditDistanceAtMostOne("dlaa", "dlla")).toBe(true); // substitute
    expect(isEditDistanceAtMostOne("ds18", "dss18")).toBe(true); // insert
    expect(isEditDistanceAtMostOne("amplificador", "amplifcad")).toBe(false); // too far
  });

  it("fuzzy-matches long token typos (edit distance ≤1)", () => {
    // "lencer" → "lancer" (substitute)
    expect(productMatchesSearch(products[2], "dlaa lencer")).toBe(true);
  });

  it("does NOT fuzzy-match unrelated short codes (H11 vs H4)", () => {
    expect(productMatchesSearch(products[2], "H11")).toBe(false);
    expect(productMatchesSearch(products[3], "H4")).toBe(false);
    // Exact short code still matches
    expect(productMatchesSearch(products[2], "H4")).toBe(true);
    expect(productMatchesSearch(products[3], "H11")).toBe(true);
  });
});
