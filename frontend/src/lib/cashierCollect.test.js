import { describe, expect, it } from "vitest";
import {
  buildDualCurrencyPagos,
  canSubmitCashierCollect,
  computeCashChange,
  computeDualCurrencyTotals,
  computeTotalCashChangeNio,
  computeUnifiedCashSettlement,
  computeUsdCashChangeInNio,
  canOfferUsdCashChange,
  computeOptimizedCashChangeBreakdown,
  dualCurrencyAmountFromPlan,
  isCashSingleCollect,
} from "@/lib/cashierCollect";

describe("cashierCollect", () => {
  it("computes change when customer pays more than due", () => {
    const result = computeCashChange(25000, 24265);
    expect(result.change).toBe(735);
    expect(result.isValid).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  it("flags shortfall when received is insufficient", () => {
    const result = computeCashChange(20000, 24265);
    expect(result.change).toBe(0);
    expect(result.shortfall).toBe(4265);
    expect(result.isValid).toBe(false);
  });

  it("detects cash single collect mode", () => {
    expect(isCashSingleCollect({ mode: "single", payment_method: "cash" })).toBe(true);
    expect(isCashSingleCollect({ payment_method: "cash", nio_amount: "20000", usd_amount: "" })).toBe(true);
    expect(isCashSingleCollect({ payment_method: "cash", nio_amount: "10000", usd_amount: "200" })).toBe(false);
    expect(isCashSingleCollect({ mode: "single", payment_method: "card" })).toBe(false);
  });

  it("computes dual currency remainder for mixed payment using buy rate", () => {
    const totals = computeDualCurrencyTotals({
      pendingNio: 20000,
      nioAmount: 0,
      usdAmount: 200,
      exchangeRate: 37.15,
      buyRate: 36.62,
    });
    expect(totals.covered).toBe(7324);
    expect(totals.remainingNio).toBe(12676);
    expect(totals.remainingUsd).toBeCloseTo(346.15, 1);
    expect(totals.isComplete).toBe(false);
  });

  it("computes usd overpayment change in cordobas", () => {
    const result = computeUsdCashChangeInNio(220, 200, 36.5);
    expect(result.changeUsd).toBe(20);
    expect(result.changeNio).toBe(730);
    expect(result.isValid).toBe(true);
  });

  it("builds mixed pagos payload from dual currency inputs", () => {
    const pagos = buildDualCurrencyPagos({
      method: "cash",
      nioAmount: 12700,
      usdAmount: 200,
      receivedNio: 13000,
      receivedUsd: 200,
      exchangeRate: 36.5,
    });
    expect(pagos).toHaveLength(2);
    expect(pagos[0].moneda).toBe("NIO");
    expect(pagos[1].moneda).toBe("USD");
    expect(pagos[1].tasa_cambio).toBe(36.5);
  });

  it("derives plan amounts by currency", () => {
    const amounts = dualCurrencyAmountFromPlan({
      lines: [
        { metodo: "cash", moneda: "USD", monto_origen: 200 },
        { metodo: "cash", moneda: "NIO", monto_origen: 12700 },
      ],
    }, 20000);
    expect(amounts.usd_amount).toBe("200");
    expect(amounts.nio_amount).toBe("12700");
  });

  it("sums total change across nio and usd cash lines", () => {
    const totals = computeTotalCashChangeNio({
      nioAmount: 12700,
      usdAmount: 200,
      receivedNio: 13000,
      receivedUsd: 250,
      exchangeRate: 36.5,
    });
    expect(totals.totalChangeNio).toBe(2125);
    expect(totals.isValid).toBe(true);
  });

  it("accepts nio overpayment that covers planned usd using buy rate", () => {
    const settlement = computeUnifiedCashSettlement({
      nioAmount: 12700,
      usdAmount: 200,
      receivedNio: 20281.73,
      receivedUsd: 0,
      exchangeRate: 37.15,
      buyRate: 36.62,
    });
    expect(settlement.dueNio).toBe(20024);
    expect(settlement.isValid).toBe(true);
    expect(settlement.changeNio).toBe(257.73);

    const totals = computeTotalCashChangeNio({
      nioAmount: 12700,
      usdAmount: 200,
      receivedNio: 20281.73,
      receivedUsd: 0,
      buyRate: 36.62,
    });
    expect(totals.isValid).toBe(true);
    expect(totals.totalChangeNio).toBe(257.73);
  });

  it("enables collect when unified nio received covers mixed due", () => {
    const allowed = canSubmitCashierCollect({
      pendingNio: 20024,
      nioAmount: 12700,
      usdAmount: 200,
      receivedNio: 20281.73,
      receivedUsd: 0,
      buyRate: 36.62,
      useDualCurrency: true,
    });
    expect(allowed).toBe(true);
  });

  it("checks drawer availability before offering USD change", () => {
    // Insuficiente en caja: 15 USD disponibles, se necesitan 20 USD
    expect(canOfferUsdCashChange({ changeUsd: 20, drawerUsdBalance: 15 })).toBe(false);
    // Suficiente en caja: 50 USD disponibles, se necesitan 20 USD
    expect(canOfferUsdCashChange({ changeUsd: 20, drawerUsdBalance: 50 })).toBe(true);
    // Exacto en caja: 20 USD disponibles, se necesitan 20 USD
    expect(canOfferUsdCashChange({ changeUsd: 20, drawerUsdBalance: 20 })).toBe(true);
    // Sin cambio requerido
    expect(canOfferUsdCashChange({ changeUsd: 0, drawerUsdBalance: 100 })).toBe(false);
  });

  it("optimizes change breakdown: default in NIO, optional in USD if sufficient drawer cash", () => {
    // Pago de $50 USD para cobro de $30 USD -> Vuelto $20 USD (TC 36.5 = C$ 730 NIO)
    // 1. Por defecto, siempre ofrece NIO aunque haya suficiente USD en caja
    const defaultNio = computeOptimizedCashChangeBreakdown({
      usdAmount: 30,
      receivedUsd: 50,
      exchangeRate: 36.5,
      drawerUsdBalance: 100,
      preferUsdChange: false,
    });
    expect(defaultNio.effectiveChangeNio).toBe(730);
    expect(defaultNio.effectiveChangeUsd).toBe(0);
    expect(defaultNio.canOfferUsdChange).toBe(true);
    expect(defaultNio.deliverInUsd).toBe(false);

    // 2. Si el cajero activa vuelto en USD y hay saldo en caja: entrega $20 USD
    const deliveredUsd = computeOptimizedCashChangeBreakdown({
      usdAmount: 30,
      receivedUsd: 50,
      exchangeRate: 36.5,
      drawerUsdBalance: 100,
      preferUsdChange: true,
    });
    expect(deliveredUsd.effectiveChangeUsd).toBe(20);
    expect(deliveredUsd.effectiveChangeNio).toBe(0);
    expect(deliveredUsd.deliverInUsd).toBe(true);

    // 3. Si el cajero prefiere USD pero no hay suficiente en caja: forzar vuelto en NIO
    const fallbackNio = computeOptimizedCashChangeBreakdown({
      usdAmount: 30,
      receivedUsd: 50,
      exchangeRate: 36.5,
      drawerUsdBalance: 10, // Solo hay $10
      preferUsdChange: true,
    });
    expect(fallbackNio.canOfferUsdChange).toBe(false);
    expect(fallbackNio.deliverInUsd).toBe(false);
    expect(fallbackNio.effectiveChangeNio).toBe(730);
    expect(fallbackNio.effectiveChangeUsd).toBe(0);
  });
});