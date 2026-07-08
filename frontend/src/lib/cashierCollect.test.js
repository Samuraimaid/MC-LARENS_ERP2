import { describe, expect, it } from "vitest";
import {
  buildDualCurrencyPagos,
  computeCashChange,
  computeDualCurrencyTotals,
  computeTotalCashChangeNio,
  computeUsdCashChangeInNio,
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
});