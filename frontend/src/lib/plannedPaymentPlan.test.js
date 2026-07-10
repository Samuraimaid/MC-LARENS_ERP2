import { describe, expect, it } from "vitest";
import {
  absorbPlanRoundingDifference,
  applyMixedPlanLinePatch,
  applyMixedPlanRemainder,
  buildDefaultPlanLine,
  buildMixedPaymentPlan,
  buildPlanLinesForSubmit,
  buildSinglePaymentPlan,
  rescalePlanLinesToTotal,
  canAddMixedPlanLine,
  computePendingPlanBalanceNio,
  computePlanRoundingTolerance,
  computePlanTotalNio,
  computeLineAmountNio,
  convertPlanLineAmountCurrency,
  finalizePlanLinesForSubmit,
  formatPlanLineAmount,
  normalizePlanLineAmounts,
  syncMixedPlanLines,
  validatePlanAgainstTotal,
  validatePlanLineUniqueness,
} from "./plannedPaymentPlan";

describe("plannedPaymentPlan", () => {
  it("requires exact total match", () => {
    const lines = [
      { metodo: "cash", moneda: "USD", monto_origen: 200 },
      { metodo: "cash", moneda: "NIO", monto_origen: 7700 },
    ];
    const result = validatePlanAgainstTotal(lines, 36.5, 15000);
    expect(result.ok).toBe(true);
    expect(computePlanTotalNio(lines, 36.5)).toBe(15000);
  });

  it("builds single plan payload", () => {
    const plan = buildSinglePaymentPlan({ method: "cash", total: 1200, currency: "NIO", exchangeRate: 36.5 });
    expect(plan.lines).toHaveLength(1);
    expect(plan.net_to_collect).toBe(1200);
  });

  it("converts plan line amount when currency changes to USD", () => {
    const converted = convertPlanLineAmountCurrency(
      { metodo: "cash", moneda: "NIO", monto_origen: "3650.00" },
      "USD",
      36.5,
    );
    expect(converted.moneda).toBe("USD");
    expect(Number(converted.monto_origen)).toBeCloseTo(100, 2);
    expect(computeLineAmountNio(converted, 36.5)).toBe(3650);
  });

  it("rebalances remainder in USD after first line switches to dollars", () => {
    const lines = [
      { metodo: "cash", moneda: "NIO", monto_origen: "3650.00" },
      { metodo: "transfer", moneda: "USD", monto_origen: "" },
    ];
    const updated = applyMixedPlanLinePatch(
      lines,
      0,
      { moneda: "USD" },
      36.5,
      6322.12,
    );
    expect(updated[0].moneda).toBe("USD");
    expect(Number(updated[0].monto_origen)).toBeCloseTo(100, 2);
    expect(updated[1].monto_origen).toBe("73.21");
    expect(computePlanTotalNio(updated, 36.5)).toBe(6322.17);
    expect(validatePlanAgainstTotal(updated, 36.5, 6322.12).ok).toBe(true);
  });

  it("auto-fills remainder when second mixed method is added", () => {
    const synced = syncMixedPlanLines(
      [{ metodo: "cash", moneda: "NIO", monto_origen: "3793.27" }],
      ["cash", "transfer"],
      36.5,
      6322.12,
    );
    expect(synced).toHaveLength(2);
    expect(synced[1].metodo).toBe("transfer");
    expect(synced[1].monto_origen).toBe("2528.85");
    expect(computePlanTotalNio(synced, 36.5)).toBe(6322.12);
  });

  it("returns empty plan lines when mixed methods are cleared", () => {
    expect(syncMixedPlanLines(
      [{ metodo: "cash", moneda: "NIO", monto_origen: "100" }],
      [],
      36.5,
      1000,
    )).toEqual([]);
  });

  it("computes pending balance in córdobas for mixed USD + NIO plan", () => {
    const lines = [
      { metodo: "cash", moneda: "USD", monto_origen: "100.00" },
      { metodo: "cash", moneda: "NIO", monto_origen: "" },
    ];
    expect(computePendingPlanBalanceNio(lines, 6129.75, 36.62)).toBeCloseTo(2467.75, 2);
  });

  it("auto-fills current empty line when currency is selected", () => {
    const lines = [
      { metodo: "cash", moneda: "USD", monto_origen: "100.00" },
      { metodo: "cash", moneda: "USD", monto_origen: "" },
    ];
    const updated = applyMixedPlanLinePatch(lines, 1, { moneda: "NIO" }, 36.62, 6129.75);
    expect(updated[1].moneda).toBe("NIO");
    expect(updated[1].monto_origen).toBe("2467.75");
    expect(validatePlanAgainstTotal(updated, 36.62, 6129.75).ok).toBe(true);
  });

  it("auto-fills newly added line with pending balance in selected currency", () => {
    const lines = [{ metodo: "cash", moneda: "USD", monto_origen: "100.00" }];
    const newLine = buildDefaultPlanLine("transfer", "NIO");
    const updated = applyMixedPlanRemainder(
      [...lines, newLine],
      1,
      36.62,
      6129.75,
      { fillCurrentIfEmpty: true },
    );
    expect(updated[1].monto_origen).toBe("2467.75");
    expect(computePlanTotalNio(updated, 36.62)).toBe(6129.75);
  });

  it("auto-fills next empty line in USD using buy rate", () => {
    const lines = [
      { metodo: "cash", moneda: "NIO", monto_origen: "2467.75" },
      { metodo: "cash", moneda: "USD", monto_origen: "" },
    ];
    const updated = applyMixedPlanRemainder(lines, 0, 36.62, 6129.75, { fillCurrentIfEmpty: true });
    expect(Number(updated[1].monto_origen)).toBeCloseTo(100, 2);
    expect(validatePlanAgainstTotal(updated, 36.62, 6129.75).ok).toBe(true);
  });

  it("auto-fills next empty mixed line with remaining total", () => {
    const lines = [
      { metodo: "cash", moneda: "NIO", monto_origen: "" },
      { metodo: "card", moneda: "NIO", monto_origen: "" },
    ];
    const updated = applyMixedPlanRemainder(
      lines.map((line, index) => (index === 0 ? { ...line, monto_origen: "3793.27" } : line)),
      0,
      36.5,
      6322.12,
    );
    expect(updated[1].monto_origen).toBe("2528.85");
    expect(computePlanTotalNio(updated, 36.5)).toBe(6322.12);
  });

  it("rejects duplicate method and currency", () => {
    const result = validatePlanLineUniqueness([
      { metodo: "cash", moneda: "NIO", monto_origen: 1000 },
      { metodo: "cash", moneda: "NIO", monto_origen: 500 },
    ]);
    expect(result.ok).toBe(false);
  });

  it("allows same method with different currency", () => {
    const result = validatePlanLineUniqueness([
      { metodo: "cash", moneda: "NIO", monto_origen: 1000 },
      { metodo: "cash", moneda: "USD", monto_origen: 50 },
    ]);
    expect(result.ok).toBe(true);
  });

  it("detects when mixed plan can add another line", () => {
    const lines = [{ metodo: "cash", moneda: "NIO", monto_origen: 1000 }];
    expect(canAddMixedPlanLine(lines, ["cash", "card"])).toBe(true);
    expect(canAddMixedPlanLine(
      [
        { metodo: "cash", moneda: "NIO", monto_origen: 1000 },
        { metodo: "cash", moneda: "USD", monto_origen: 20 },
        { metodo: "card", moneda: "NIO", monto_origen: 500 },
        { metodo: "card", moneda: "USD", monto_origen: 10 },
      ],
      ["cash", "card"],
    )).toBe(false);
  });

  it("builds mixed plan payload", () => {
    const plan = buildMixedPaymentPlan({
      methods: ["cash", "card"],
      lines: [
        { metodo: "cash", moneda: "NIO", monto_origen: 1000 },
        { metodo: "card", moneda: "NIO", monto_origen: 500 },
      ],
      total: 1500,
      exchangeRate: 36.5,
      currency: "NIO",
    });
    expect(plan.mode).toBe("mixed");
    expect(plan.planned_total_nio).toBe(1500);
  });

  it("accepts plan within rounding tolerance and auto-adjusts last line", () => {
    const lines = [
      { metodo: "cash", moneda: "NIO", monto_origen: "3793.27" },
      { metodo: "transfer", moneda: "NIO", monto_origen: "2528.84" },
    ];
    const validation = validatePlanAgainstTotal(lines, 36.5, 6322.12);
    expect(validation.ok).toBe(true);
    expect(validation.adjusted).toBe(true);
    expect(computePlanTotalNio(validation.adjustedLines, 36.5)).toBe(6322.12);
    expect(validation.adjustedLines[1].monto_origen).toBe("2528.85");
  });

  it("rejects plan outside rounding tolerance", () => {
    const lines = [
      { metodo: "cash", moneda: "NIO", monto_origen: 1000 },
      { metodo: "card", moneda: "NIO", monto_origen: 400 },
    ];
    const validation = validatePlanAgainstTotal(lines, 36.5, 1500);
    expect(validation.ok).toBe(false);
  });

  it("formats plan amounts with at most two decimals", () => {
    expect(formatPlanLineAmount(73.208767)).toBe("73.21");
    expect(formatPlanLineAmount("103.6205")).toBe("103.62");
    const normalized = normalizePlanLineAmounts([
      { metodo: "cash", moneda: "USD", monto_origen: "103.6205" },
      { metodo: "transfer", moneda: "NIO", monto_origen: "2528.846" },
    ]);
    expect(normalized[0].monto_origen).toBe("103.62");
    expect(normalized[1].monto_origen).toBe("2528.85");
  });

  it("uses wider tolerance when plan includes USD lines", () => {
    const nioOnly = [{ metodo: "cash", moneda: "NIO", monto_origen: "100" }];
    const withUsd = [{ metodo: "cash", moneda: "USD", monto_origen: "100" }];
    expect(computePlanRoundingTolerance(nioOnly, 36.5)).toBe(0.01);
    expect(computePlanRoundingTolerance(withUsd, 36.5)).toBe(0.37);
  });

  it("finalizes plan lines for submit with absorbed remainder", () => {
    const lines = [
      { metodo: "cash", moneda: "NIO", monto_origen: "3793.27" },
      { metodo: "transfer", moneda: "NIO", monto_origen: "2528.84" },
    ];
    const finalized = finalizePlanLinesForSubmit(lines, 36.5, 6322.12);
    expect(computePlanTotalNio(finalized, 36.5)).toBe(6322.12);
    expect(finalized[1].monto_origen).toBe("2528.85");
    expect(absorbPlanRoundingDifference(lines, 36.5, 6322.12)[1].monto_origen).toBe("2528.85");
  });

  it("rescales mixed plan lines preserving proportions", () => {
    const lines = [
      { metodo: "cash", moneda: "NIO", monto_origen: "600.00" },
      { metodo: "transfer", moneda: "NIO", monto_origen: "400.00" },
    ];
    const scaled = rescalePlanLinesToTotal(lines, 36.5, 1100);
    expect(computePlanTotalNio(scaled, 36.5)).toBe(1100);
    expect(Number(scaled[0].monto_origen)).toBeCloseTo(660, 1);
    expect(Number(scaled[1].monto_origen)).toBeCloseTo(440, 1);
  });

  it("builds submit lines for released mixed drafts", () => {
    const lines = [
      { metodo: "cash", moneda: "NIO", monto_origen: "600.00" },
      { metodo: "transfer", moneda: "NIO", monto_origen: "400.00" },
    ];
    const built = buildPlanLinesForSubmit({
      lines,
      paymentMethod: "mixed",
      mixedMethods: ["cash", "transfer"],
      exchangeRate: 36.5,
      targetTotal: 1100,
      currency: "NIO",
      preserveMixedStructure: true,
    });
    expect(computePlanTotalNio(built, 36.5)).toBe(1100);
  });
});