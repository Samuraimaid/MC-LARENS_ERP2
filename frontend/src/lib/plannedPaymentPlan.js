import { normalizePaymentMethodCode, normalizePaymentMethodList } from "@/lib/paymentMethods";

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const round4 = (value) => Math.round((Number(value) || 0) * 10000) / 10000;

/** Tolerancia base para líneas solo en córdobas. */
export const PLAN_ROUNDING_TOLERANCE_NIO = 0.01;

/** Máximo de decimales visibles/guardados en montos del plan. */
export const PLAN_AMOUNT_DECIMALS = 2;

export function formatPlanLineAmount(amount) {
  const value = round2(amount);
  if (!Number.isFinite(value) || value <= 0) return "";
  return value.toFixed(PLAN_AMOUNT_DECIMALS);
}

export function computePlanRoundingTolerance(lines = [], exchangeRate = 36.5) {
  const rows = Array.isArray(lines) ? lines : [];
  const rate = Number(exchangeRate) || 36.5;
  const hasUsdAmount = rows.some((line) => (
    String(line?.moneda || "NIO").toUpperCase() === "USD" && !isPlanLineAmountEmpty(line)
  ));
  if (!hasUsdAmount) return PLAN_ROUNDING_TOLERANCE_NIO;
  return round2(PLAN_ROUNDING_TOLERANCE_NIO * rate);
}

export function isPlanWithinTolerance(planned, target, tolerance = PLAN_ROUNDING_TOLERANCE_NIO) {
  return Math.abs(round2(planned) - round2(target)) <= tolerance + 1e-9;
}

export function normalizePlanLineAmounts(lines = []) {
  return (Array.isArray(lines) ? lines : []).map((line) => {
    if (isPlanLineAmountEmpty(line)) {
      return { ...line, monto_origen: "" };
    }
    return { ...line, monto_origen: formatPlanLineAmount(line.monto_origen) };
  });
}

function planLinesEqual(left = [], right = []) {
  const a = Array.isArray(left) ? left : [];
  const b = Array.isArray(right) ? right : [];
  if (a.length !== b.length) return false;
  return a.every((line, index) => (
    String(line?.metodo) === String(b[index]?.metodo)
    && String(line?.moneda) === String(b[index]?.moneda)
    && String(line?.monto_origen ?? "") === String(b[index]?.monto_origen ?? "")
  ));
}

export function buildDefaultPlanLine(method = "cash", currency = "NIO") {
  return {
    metodo: normalizePaymentMethodCode(method),
    moneda: String(currency || "NIO").toUpperCase() === "USD" ? "USD" : "NIO",
    monto_origen: "",
  };
}

export function computeLineAmountNio(line, exchangeRate = 36.5) {
  const currency = String(line?.moneda || "NIO").toUpperCase();
  const amount = Number(line?.monto_origen || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (currency === "USD") return round2(amount * (Number(exchangeRate) || 36.5));
  return round2(amount);
}

export function computePlanTotalNio(lines = [], exchangeRate = 36.5) {
  return round2(
    (Array.isArray(lines) ? lines : []).reduce(
      (sum, line) => sum + computeLineAmountNio(line, exchangeRate),
      0,
    ),
  );
}

export function isPlanLineAmountEmpty(line) {
  const raw = String(line?.monto_origen ?? "").trim();
  if (!raw) return true;
  const amount = Number(raw);
  return !Number.isFinite(amount) || amount <= 0;
}

function formatRemainderForCurrency(remainingNio, currency, exchangeRate) {
  if (remainingNio <= 0) return "";
  const code = String(currency || "NIO").toUpperCase();
  if (code === "USD") {
    return formatPlanLineAmount(remainingNio / (Number(exchangeRate) || 36.5));
  }
  return formatPlanLineAmount(remainingNio);
}

/** Convierte monto_origen al cambiar moneda de la línea (NIO <-> USD). */
export function convertPlanLineAmountCurrency(line, nextCurrency, exchangeRate = 36.5) {
  const to = String(nextCurrency || "NIO").toUpperCase() === "USD" ? "USD" : "NIO";
  const from = String(line?.moneda || "NIO").toUpperCase() === "USD" ? "USD" : "NIO";
  if (from === to) {
    return { ...line, moneda: to };
  }

  const raw = String(line?.monto_origen ?? "").trim();
  if (!raw || isPlanLineAmountEmpty(line)) {
    return { ...line, moneda: to, monto_origen: "" };
  }

  const amount = Number(raw);
  const rate = Number(exchangeRate) || 36.5;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ...line, moneda: to };
  }

  if (from === "NIO" && to === "USD") {
    return { ...line, moneda: "USD", monto_origen: formatPlanLineAmount(amount / rate) };
  }
  return { ...line, moneda: "NIO", monto_origen: formatPlanLineAmount(amount * rate) };
}

/** Aplica patch a una línea del plan mixto con conversión y rebalanceo. */
export function applyMixedPlanLinePatch(lines, index, patch, exchangeRate, targetTotal) {
  const rows = Array.isArray(lines) ? lines : [];
  const line = rows[index];
  if (!line) return rows;

  if ("moneda" in patch && String(patch.moneda) !== String(line.moneda)) {
    let next = rows.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const converted = convertPlanLineAmountCurrency(row, patch.moneda, exchangeRate);
      return { ...converted, ...patch, moneda: converted.moneda, monto_origen: converted.monto_origen };
    });
    if (Number(targetTotal) > 0) {
      next = applyMixedPlanRemainder(next, index, exchangeRate, targetTotal);
      next = rebalanceMixedPlanRemainders(next, exchangeRate, targetTotal);
    }
    return next;
  }

  let next = rows.map((row, rowIndex) => (
    rowIndex === index ? { ...row, ...patch } : row
  ));
  if (
    Number(targetTotal) > 0
    && ("monto_origen" in patch || "moneda" in patch)
  ) {
    next = applyMixedPlanRemainder(next, index, exchangeRate, targetTotal);
  }
  return next;
}

/** Auto-completa la primera línea vacía posterior con el faltante del total (pago mixto). */
export function applyMixedPlanRemainder(lines, editedIndex, exchangeRate, targetTotal) {
  const rows = Array.isArray(lines) ? lines : [];
  const target = round2(targetTotal);
  const allocated = computePlanTotalNio(rows, exchangeRate);
  const remainingNio = round2(target - allocated);

  const nextEmptyIndex = rows.findIndex(
    (line, index) => index > editedIndex && isPlanLineAmountEmpty(line),
  );
  if (nextEmptyIndex < 0) return rows;

  const fillValue = formatRemainderForCurrency(
    remainingNio,
    rows[nextEmptyIndex]?.moneda,
    exchangeRate,
  );

  return rows.map((line, index) => (
    index === nextEmptyIndex
      ? { ...line, monto_origen: fillValue }
      : line
  ));
}

export function planLineIdentity(line) {
  const method = normalizePaymentMethodCode(line?.metodo);
  const currency = String(line?.moneda || "NIO").toUpperCase() === "USD" ? "USD" : "NIO";
  return `${method}|${currency}`;
}

export function findDuplicatePlanLineIndex(lines = [], excludeIndex = -1) {
  const seen = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    if (index === excludeIndex) continue;
    const key = planLineIdentity(lines[index]);
    if (seen.has(key)) return index;
    seen.set(key, index);
  }
  return -1;
}

export function validatePlanLineUniqueness(lines = []) {
  const duplicateIndex = findDuplicatePlanLineIndex(lines);
  if (duplicateIndex < 0) return { ok: true };
  const duplicate = lines[duplicateIndex];
  const method = normalizePaymentMethodCode(duplicate?.metodo);
  const currency = String(duplicate?.moneda || "NIO").toUpperCase();
  const labels = { cash: "Efectivo", transfer: "Transferencia", card: "Tarjeta", credit: "Crédito" };
  return {
    ok: false,
    message: `Ya existe una línea con ${labels[method] || method} en ${currency === "USD" ? "dólares" : "córdobas"}`,
  };
}

export function canAddMixedPlanLine(lines = [], mixedMethods = []) {
  const methods = normalizePaymentMethodList(mixedMethods);
  const currencies = ["NIO", "USD"];
  return methods.some((method) => (
    currencies.some((currency) => !lines.some((line) => (
      normalizePaymentMethodCode(line.metodo) === method
      && String(line.moneda || "NIO").toUpperCase() === currency
    )))
  ));
}

export function rebalanceMixedPlanRemainders(lines = [], exchangeRate = 36.5, targetTotal = 0) {
  let next = [...lines];
  for (let index = 0; index < next.length; index += 1) {
    if (!isPlanLineAmountEmpty(next[index])) {
      next = applyMixedPlanRemainder(next, index, exchangeRate, targetTotal);
    }
  }
  return absorbPlanRoundingDifference(next, exchangeRate, targetTotal);
}

/** Ajusta la última línea con monto para absorber diferencias de redondeo (≤ tolerancia). */
export function absorbPlanRoundingDifference(
  lines = [],
  exchangeRate = 36.5,
  targetTotal = 0,
  tolerance = computePlanRoundingTolerance(lines, exchangeRate),
) {
  const rows = normalizePlanLineAmounts(lines);
  const target = round2(targetTotal);
  const planned = computePlanTotalNio(rows, exchangeRate);
  const delta = round2(target - planned);

  if (Math.abs(delta) <= 1e-9) return rows;
  if (Math.abs(delta) > tolerance) return rows;

  let adjustIndex = -1;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (!isPlanLineAmountEmpty(rows[index])) {
      adjustIndex = index;
      break;
    }
  }
  if (adjustIndex < 0) return rows;

  const line = rows[adjustIndex];
  const currency = String(line.moneda || "NIO").toUpperCase();
  const rate = Number(exchangeRate) || 36.5;
  const nextNio = round2(computeLineAmountNio(line, rate) + delta);
  if (nextNio <= 0) return rows;

  const nextMonto = currency === "USD"
    ? formatPlanLineAmount(nextNio / rate)
    : formatPlanLineAmount(nextNio);

  const adjusted = rows.map((row, index) => (
    index === adjustIndex ? { ...row, monto_origen: nextMonto } : row
  ));
  const adjustedTotal = computePlanTotalNio(adjusted, exchangeRate);
  if (Math.abs(round2(adjustedTotal - target)) > tolerance) {
    return rows;
  }
  return adjusted;
}

export function finalizePlanLinesForSubmit(lines = [], exchangeRate = 36.5, targetTotal = 0) {
  return absorbPlanRoundingDifference(
    normalizePlanLineAmounts(lines),
    exchangeRate,
    targetTotal,
  );
}

/** Escala montos del plan conservando proporciones (p. ej. borrador liberado por gerencia). */
export function rescalePlanLinesToTotal(lines = [], exchangeRate = 36.5, targetTotal = 0) {
  const rows = (Array.isArray(lines) ? lines : []).filter((line) => !isPlanLineAmountEmpty(line));
  if (!rows.length) return rows;
  const target = round2(targetTotal);
  const tolerance = computePlanRoundingTolerance(rows, exchangeRate);
  const current = computePlanTotalNio(rows, exchangeRate);
  if (isPlanWithinTolerance(current, target, tolerance)) {
    return absorbPlanRoundingDifference(normalizePlanLineAmounts(rows), exchangeRate, target);
  }
  if (current <= 0) {
    return syncMixedPlanLines(rows, rows.map((line) => line.metodo), exchangeRate, target);
  }
  const ratio = target / current;
  const scaled = rows.map((line) => {
    const nextNio = round2(computeLineAmountNio(line, exchangeRate) * ratio);
    const moneda = String(line.moneda || "NIO").toUpperCase() === "USD" ? "USD" : "NIO";
    const monto = moneda === "USD"
      ? formatPlanLineAmount(nextNio / (Number(exchangeRate) || 36.5))
      : formatPlanLineAmount(nextNio);
    return { ...line, moneda, monto_origen: monto };
  });
  return absorbPlanRoundingDifference(scaled, exchangeRate, target);
}

export function buildPlanLinesForSubmit({
  lines = [],
  paymentMethod = "cash",
  mixedMethods = [],
  exchangeRate = 36.5,
  targetTotal = 0,
  currency = "NIO",
  preserveMixedStructure = false,
}) {
  const method = normalizePaymentMethodCode(paymentMethod);
  const saleCurrency = String(currency || "NIO").toUpperCase() === "USD" ? "USD" : "NIO";
  const target = round2(targetTotal);
  if (method !== "mixed") {
    const amount = saleCurrency === "USD"
      ? formatPlanLineAmount(target / (Number(exchangeRate) || 36.5))
      : formatPlanLineAmount(target);
    return finalizePlanLinesForSubmit([{
      metodo: method,
      moneda: saleCurrency,
      monto_origen: amount,
    }], exchangeRate, target);
  }
  const methods = normalizePaymentMethodList(mixedMethods);
  let working = (Array.isArray(lines) ? lines : []).filter((line) => (
    methods.includes(normalizePaymentMethodCode(line?.metodo))
  ));
  if (!working.length) {
    working = syncMixedPlanLines([], methods, exchangeRate, target, saleCurrency);
  } else if (preserveMixedStructure) {
    working = rescalePlanLinesToTotal(working, exchangeRate, target);
  } else {
    working = syncMixedPlanLines(working, methods, exchangeRate, target, saleCurrency);
  }
  return finalizePlanLinesForSubmit(working, exchangeRate, target);
}

/** Sincroniza líneas del plan mixto al marcar/desmarcar métodos y autocompleta faltantes. */
export function syncMixedPlanLines(
  prevLines = [],
  mixedMethods = [],
  exchangeRate = 36.5,
  targetTotal = 0,
  currency = "NIO",
) {
  const methods = normalizePaymentMethodList(mixedMethods);
  if (!methods.length) return [];

  const saleCurrency = String(currency || "NIO").toUpperCase() === "USD" ? "USD" : "NIO";
  const filtered = (Array.isArray(prevLines) ? prevLines : []).filter((line) => (
    methods.includes(normalizePaymentMethodCode(line?.metodo))
  ));
  const missing = methods.filter(
    (method) => !filtered.some((line) => normalizePaymentMethodCode(line?.metodo) === method),
  );
  const additions = missing.map((method) => buildDefaultPlanLine(method, saleCurrency));
  let next = [...filtered, ...additions];
  if (!next.length) {
    next = methods.map((method) => buildDefaultPlanLine(method, saleCurrency));
  }
  if (Number(targetTotal) > 0) {
    next = rebalanceMixedPlanRemainders(next, exchangeRate, targetTotal);
  }
  return absorbPlanRoundingDifference(next, exchangeRate, targetTotal);
}

export function validatePlanAgainstTotal(
  lines,
  exchangeRate,
  targetTotal,
  tolerance = computePlanRoundingTolerance(lines, exchangeRate),
) {
  const normalizedLines = normalizePlanLineAmounts(lines);
  const adjustedLines = absorbPlanRoundingDifference(
    normalizedLines,
    exchangeRate,
    targetTotal,
    tolerance,
  );
  const planned = computePlanTotalNio(adjustedLines, exchangeRate);
  const target = round2(targetTotal);
  const adjusted = !planLinesEqual(normalizedLines, adjustedLines);

  if (!isPlanWithinTolerance(planned, target, tolerance)) {
    return {
      ok: false,
      planned,
      target,
      adjustedLines,
      adjusted,
      tolerance,
      message: `El plan debe sumar C$ ${target.toFixed(2)} (actual: C$ ${planned.toFixed(2)})`,
    };
  }
  return {
    ok: true,
    planned,
    target,
    adjustedLines,
    adjusted,
    tolerance,
    roundingAdjusted: adjusted && planned === target,
  };
}

export function buildSinglePaymentPlan({ method, total, currency = "NIO", exchangeRate = 36.5 }) {
  const normalizedMethod = normalizePaymentMethodCode(method);
  const saleCurrency = String(currency || "NIO").toUpperCase();
  const target = round2(total);
  const line = {
    metodo: normalizedMethod,
    moneda: saleCurrency,
    monto_origen: saleCurrency === "USD"
      ? formatPlanLineAmount(target / (Number(exchangeRate) || 36.5))
      : formatPlanLineAmount(target),
    tasa_cambio: saleCurrency === "USD" ? round4(exchangeRate) : 1,
    monto_cordobas: target,
  };
  return {
    mode: normalizedMethod,
    currency: saleCurrency,
    exchange_rate: round4(exchangeRate),
    net_to_collect: target,
    planned_total_nio: target,
    lines: [line],
    locked: true,
  };
}

export function buildMixedPaymentPlan({ methods = [], lines = [], total, exchangeRate = 36.5, currency = "NIO" }) {
  const normalizedMethods = normalizePaymentMethodList(methods);
  const normalizedLines = (Array.isArray(lines) ? lines : []).map((line, index) => {
    const amountNio = computeLineAmountNio(line, exchangeRate);
    return {
      line_no: index + 1,
      metodo: normalizePaymentMethodCode(line.metodo),
      moneda: String(line.moneda || "NIO").toUpperCase() === "USD" ? "USD" : "NIO",
      monto_origen: round2(line.monto_origen),
      tasa_cambio: String(line.moneda || "NIO").toUpperCase() === "USD" ? round4(exchangeRate) : 1,
      monto_cordobas: amountNio,
    };
  });
  const target = round2(total);
  return {
    mode: "mixed",
    currency: String(currency || "NIO").toUpperCase(),
    exchange_rate: round4(exchangeRate),
    net_to_collect: target,
    planned_total_nio: computePlanTotalNio(lines, exchangeRate),
    mixed_methods: normalizedMethods,
    lines: normalizedLines,
    locked: true,
  };
}

export function planToCollectForm(plan, pendingAmount = 0) {
  if (!plan || !Array.isArray(plan.lines) || !plan.lines.length) {
    return null;
  }
  const pending = round2(pendingAmount || plan.net_to_collect || 0);
  if (String(plan.mode || "").toLowerCase() === "mixed" || plan.lines.length > 1) {
    return {
      mode: "mixed",
      amount: String(pending),
      payment_method: "cash",
      pagos: plan.lines.map((line) => ({
        metodo: line.metodo,
        moneda: line.moneda,
        monto_origen: String(line.monto_origen ?? ""),
        tasa_cambio: line.tasa_cambio,
        referencia_bancaria: "",
        card_type: "",
        bank_name: "",
        transaction_number: "",
      })),
    };
  }
  const line = plan.lines[0];
  return {
    mode: "single",
    amount: String(line.monto_cordobas ?? pending),
    payment_method: line.metodo || "cash",
    pagos: [buildDefaultPaymentRowFromPlan(line)],
  };
}

function buildDefaultPaymentRowFromPlan(line) {
  return {
    metodo: line.metodo || "cash",
    moneda: line.moneda || "NIO",
    monto_origen: String(line.monto_origen ?? ""),
    referencia_bancaria: "",
    card_type: "",
    bank_name: "",
    transaction_number: "",
  };
}

export function resolveCustomerCreditDays(customer) {
  const raw = customer?.credit_days ?? customer?.credit_terms?.days;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}