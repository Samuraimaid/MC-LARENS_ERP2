import { describe, expect, it } from "vitest";
import { findProductsByScanCode, productMatchesSearch } from "./productLookup";

const products = [
  { product_id: "p1", sku: "AMP-4CH-1200", name: "Amplificador 4 canales", barcode: "7501234567890" },
  { product_id: "p2", sku: "SUB-12-1000", name: "Subwoofer 12 pulgadas" },
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
});