import { describe, expect, it } from "vitest";
import {
  expandBombilloAliases,
} from "./productRecommendations";
import {
  getVehicleBombillos,
  isBombilloCompatible,
  isBombilloProduct,
  isBombilloRelatedQuery,
  productBombilloSizes,
  sortProductsByBombilloCompat,
  getBombilloCompatStatus,
} from "./bombilloCompat";

describe("bombilloCompat", () => {
  it("expands H11 family aliases", () => {
    const set = expandBombilloAliases("H11");
    expect(set.has("H11")).toBe(true);
    expect(set.has("H16")).toBe(true);
    expect(set.has("H8")).toBe(true);
  });

  it("reads vehicle bombillos via catalog label/year", () => {
    const info = getVehicleBombillos({
      brand: "TOYOTA",
      year: 2018,
      model: "Hilux [2016-2020]",
    });
    expect(info.hasData).toBe(true);
    expect(info.sizes.has("H16") || info.sizes.has("H3")).toBe(true);
    expect(info.erpKey).toContain("TOYOTA::");
  });

  it("returns hasData false when catalog entry has no bombillos", () => {
    const info = getVehicleBombillos({
      brand: "TOYOTA",
      year: 2013,
      model: "Hilux [2012-2015]",
    });
    expect(info.hasData).toBe(false);
  });

  it("infers DS18 kit sizes from SKU", () => {
    const sizes = productBombilloSizes({ sku: "VTLH11", brand: "DS18", name: "Kit LED" });
    expect(sizes.has("H11")).toBe(true);
    expect(isBombilloProduct({ sku: "VTLH11", brand: "DS18" })).toBe(true);
  });

  it("matches H16 vehicle socket to H11 LED kit via aliases", () => {
    const vehicleSet = new Set(["H16", "H3"]);
    const kit = { sku: "VIXH11", brand: "DS18", name: "Bombillo LED H11" };
    expect(isBombilloCompatible(kit, vehicleSet)).toBe(true);
  });

  it("never marks xenon/HID as compatible LED", () => {
    const vehicleSet = new Set(["H11"]);
    const xenon = { sku: "D2S-KIT", brand: "X", name: "Xenon D2S", bombillo: "D2S" };
    expect(isBombilloCompatible(xenon, vehicleSet)).toBe(false);
  });

  it("detects bulb-related queries", () => {
    expect(isBombilloRelatedQuery("bombillos LED")).toBe(true);
    expect(isBombilloRelatedQuery("H11")).toBe(true);
    expect(isBombilloRelatedQuery("amplificador 4ch")).toBe(false);
  });

  it("sorts compatible bulbs first and incompatible last", () => {
    const vehicle = { brand: "TOYOTA", year: 2018, model: "Hilux [2016-2020]" };
    const products = [
      { product_id: "amp", sku: "AMP-1", brand: "X", name: "Amplificador" },
      { product_id: "bad", sku: "VTLH4", brand: "DS18", name: "Bombillo LED H4", bombillo: "H4" },
      { product_id: "good", sku: "VTLH11", brand: "DS18", name: "Bombillo LED H11", bombillo: "H11" },
    ];
    const sorted = sortProductsByBombilloCompat(products, vehicle, "bombillo led");
    expect(sorted.map((p) => p.product_id)).toEqual(["good", "amp", "bad"]);
  });

  it("does not color non-bulb products on general search", () => {
    const vehicle = { brand: "TOYOTA", year: 2018, model: "Hilux [2016-2020]" };
    const amp = { product_id: "amp", sku: "AMP-1", brand: "X", name: "Amplificador" };
    expect(getBombilloCompatStatus(amp, vehicle, { query: "amplificador" })).toBe(null);
  });
});
