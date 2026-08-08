import { describe, expect, it } from "vitest";
import {
  buildTierPriceCompare,
  canChangeActivePriceTier,
  canSellerEditLinePrice,
  formatRoleBadgeLabel,
  repriceCartItemsForTier,
  tierRequiresSupervisorApproval,
  TIER_PRECIO1,
  TIER_PRECIO2,
  TIER_PRECIO_VIP,
} from "./priceTiers";

describe("formatRoleBadgeLabel", () => {
  it("shows VENTAS VIP for vip floor sellers", () => {
    expect(formatRoleBadgeLabel({ role: "ventas", seller_type: "vip" })).toBe("VENTAS VIP");
    expect(formatRoleBadgeLabel({ role: "ventas", seller_type: "piso" })).toBe("VENTAS");
  });
});

describe("canSellerEditLinePrice", () => {
  it("allows floor sellers and blocks vip sellers", () => {
    expect(canSellerEditLinePrice({ role: "ventas", seller_type: "piso" })).toBe(true);
    expect(canSellerEditLinePrice({ role: "ventas", seller_type: "vip" })).toBe(false);
  });

  it("allows supervision roles regardless of seller_type", () => {
    expect(canSellerEditLinePrice({ role: "gerencia", seller_type: "piso" })).toBe(true);
    expect(canSellerEditLinePrice({ role: "supervisor", seller_type: "vip" })).toBe(true);
  });

  it("honors backend pricing context when present", () => {
    expect(
      canSellerEditLinePrice(
        { role: "ventas", seller_type: "vip" },
        { can_edit_line_prices: false },
      ),
    ).toBe(false);
    expect(
      canSellerEditLinePrice(
        { role: "ventas", seller_type: "piso" },
        { can_edit_line_prices: true },
      ),
    ).toBe(true);
  });
});

describe("buildTierPriceCompare", () => {
  it("shows comparison when tier is not precio1", () => {
    const product = { precio1: 200, precio2: 190, precio_vip: 176, precio_casa_comercial: 164 };
    const compare = buildTierPriceCompare(product, TIER_PRECIO_VIP);
    expect(compare.showCompare).toBe(true);
    expect(compare.tierPrice).toBe(176);
    expect(compare.discountPercent).toBe(12);
  });

  it("hides comparison for precio1", () => {
    const product = { precio1: 200 };
    const compare = buildTierPriceCompare(product, TIER_PRECIO1);
    expect(compare.showCompare).toBe(false);
  });
});

describe("repriceCartItemsForTier", () => {
  it("updates all line unit prices", () => {
    const product = { product_id: "p1", precio1: 100, precio_vip: 88 };
    const productsById = new Map([["p1", product]]);
    const cart = [{ product_id: "p1", unit_price: 100, quantity: 2 }];
    const repriced = repriceCartItemsForTier(cart, productsById, TIER_PRECIO_VIP);
    expect(repriced[0].unit_price).toBe(88);
    expect(repriced[0].price_tier).toBe(TIER_PRECIO_VIP);
  });
});

describe("canChangeActivePriceTier", () => {
  it("allows floor sellers and blocks vip", () => {
    const ctx = { allowed_price_tiers: ["precio1", "precio2", "precio_vip"] };
    expect(canChangeActivePriceTier({ role: "ventas", seller_type: "piso" }, ctx)).toBe(true);
    expect(canChangeActivePriceTier({ role: "ventas", seller_type: "vip" }, ctx)).toBe(false);
  });
});

describe("tierRequiresSupervisorApproval", () => {
  it("requires approval for precio2 for floor sellers, not for supervisors", () => {
    expect(tierRequiresSupervisorApproval(TIER_PRECIO2, { role: "ventas", seller_type: "piso" })).toBe(true);
    expect(tierRequiresSupervisorApproval(TIER_PRECIO2, { role: "gerencia" })).toBe(false);
    expect(tierRequiresSupervisorApproval(TIER_PRECIO1, { role: "ventas", seller_type: "piso" })).toBe(false);
  });
});