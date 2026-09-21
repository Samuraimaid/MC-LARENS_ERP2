import { describe, expect, it } from "vitest";
import {
  findProductsByScanCode,
  getProductSearchableText,
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
});
