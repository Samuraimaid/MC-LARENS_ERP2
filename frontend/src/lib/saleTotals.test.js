import { describe, expect, it } from "vitest";
import {
  computeDraftSnapshotTotals,
  computeSaleTotals,
  defaultApplyIvaForCustomer,
} from "./saleTotals";

describe("defaultApplyIvaForCustomer", () => {
  it("defaults natural clients to no IVA", () => {
    expect(defaultApplyIvaForCustomer({ customer_type: "natural" }, false)).toBe(false);
    expect(defaultApplyIvaForCustomer({ customer_type: "natural" }, true)).toBe(false);
  });

  it("defaults company clients to no IVA when system taxes are disabled", () => {
    expect(defaultApplyIvaForCustomer({ customer_type: "empresa" }, false)).toBe(false);
  });

  it("applies IVA for company clients only when system taxes are enabled", () => {
    expect(defaultApplyIvaForCustomer({ customer_type: "empresa" }, true)).toBe(true);
  });
});

describe("computeSaleTotals", () => {
  it("excludes IVA by default for natural flow totals", () => {
    const totals = computeSaleTotals({
      cartItems: [{
        product_id: "p1",
        quantity: 1,
        unit_price: 100,
        original_unit_price: 100,
      }],
      currency: "USD",
      exchangeRate: 37.15,
      sellRate: 37.15,
      applyIVA: false,
      ivaRate: 15,
    });
    expect(totals.tax).toBe(0);
    expect(totals.total).toBe(100);
  });
  it("includes manual supervisor price edits in display discounts", () => {
    const totals = computeSaleTotals({
      cartItems: [{
        product_id: "p1",
        product_name: "Filtro",
        quantity: 2,
        unit_price: 8,
        original_unit_price: 10,
        discount: 0,
      }],
      currency: "USD",
      exchangeRate: 36.5,
      ivaRate: 15,
      applyIVA: true,
    });

    expect(totals.manualPriceDiscountTotal).toBe(4);
    expect(totals.displayTotalDiscounts).toBe(4);
    expect(totals.total).toBeCloseTo(16 * 1.15, 2);
  });

  it("supports fixed global discounts", () => {
    const totals = computeSaleTotals({
      cartItems: [{
        product_id: "p1",
        quantity: 1,
        unit_price: 100,
        original_unit_price: 100,
      }],
      currency: "USD",
      exchangeRate: 36.5,
      globalDiscount: 25,
      globalDiscountMode: "fixed",
      ivaRate: 15,
      applyIVA: true,
    });

    expect(totals.discountAmount).toBe(25);
    expect(totals.displayTotalDiscounts).toBe(25);
    expect(totals.total).toBeCloseTo(75 * 1.15, 2);
  });

  it("matches draft snapshot totals for mixed discounts", () => {
    const draft = {
      currency: "NIO",
      exchangeRate: 36.5,
      applyIVA: true,
      ivaRate: 15,
      globalDiscount: 10,
      globalDiscountMode: "percent",
      paymentMethod: "cash",
      cartItems: [{
        product_id: "p1",
        quantity: 1,
        unit_price: 9,
        original_unit_price: 10,
      }],
      appliedDiscounts: [],
    };

    const formTotals = computeSaleTotals({
      cartItems: draft.cartItems,
      currency: draft.currency,
      exchangeRate: draft.exchangeRate,
      ivaRate: draft.ivaRate,
      globalDiscount: draft.globalDiscount,
      globalDiscountMode: draft.globalDiscountMode,
      paymentMethod: draft.paymentMethod,
      applyIVA: draft.applyIVA,
    });
    const draftTotals = computeDraftSnapshotTotals(draft, {
      exchangeRate: 36.5,
      ivaRate: 15,
    });

    expect(draftTotals.displayTotalDiscounts).toBe(formTotals.displayTotalDiscounts);
    expect(draftTotals.total).toBe(formTotals.total);
  });

  it("honors supervisor discount on mixed cash+transfer after release", () => {
    const totals = computeSaleTotals({
      cartItems: [{
        product_id: "p1",
        quantity: 1,
        unit_price: 100,
        original_unit_price: 100,
      }],
      currency: "NIO",
      exchangeRate: 36.5,
      globalDiscount: 5,
      paymentMethod: "mixed",
      mixedPaymentMethods: ["cash", "transfer"],
      supervisorDiscountPreapproved: true,
      ivaRate: 15,
    });

    expect(totals.discountsBlockedByPayment).toBe(false);
    expect(totals.discountAmount).toBeGreaterThan(0);
  });
});