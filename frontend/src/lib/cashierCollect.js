const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

export function resolveCashierPaymentRate(exchangeRate = 36.5, buyRate = null) {
  return Number(buyRate || exchangeRate) || 36.5;
}

export function formatCashierMoney(value, { prefix = "C$", decimals = 2 } = {}) {
  const amount = Number(value || 0);
  return `${prefix}${amount.toLocaleString("es-NI", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatUsdMoney(value, { decimals = 2 } = {}) {
  const amount = Number(value || 0);
  return `US$${amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function isCashOrTransferMethod(method) {
  const key = String(method || "").toLowerCase();
  return key === "cash" || key === "transfer" || key === "transferencia";
}

export function computeLineAmountNio(amount, currency, exchangeRate = 36.5, buyRate = null) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (String(currency || "NIO").toUpperCase() === "USD") {
    return round2(value * resolveCashierPaymentRate(exchangeRate, buyRate));
  }
  return round2(value);
}

export function computeDualCurrencyTotals({
  pendingNio = 0,
  nioAmount = 0,
  usdAmount = 0,
  exchangeRate = 36.5,
  buyRate = null,
}) {
  const pending = round2(pendingNio);
  const nio = round2(nioAmount);
  const usd = round2(usdAmount);
  const rate = resolveCashierPaymentRate(exchangeRate, buyRate);
  const covered = round2(nio + usd * rate);
  const remaining = round2(pending - covered);
  return {
    pending,
    nio,
    usd,
    rate,
    covered,
    remaining,
    remainingNio: remaining,
    remainingUsd: rate > 0 ? round2(Math.max(0, remaining) / rate) : 0,
    isComplete: Math.abs(remaining) <= 0.02,
    isOver: remaining < -0.02,
    overageNio: round2(Math.max(0, -remaining)),
  };
}

export function computeCashChange(receivedAmount, amountToCollect) {
  const received = Number(receivedAmount || 0);
  const due = Number(amountToCollect || 0);
  if (!Number.isFinite(received) || !Number.isFinite(due) || received <= 0 || due <= 0) {
    return { received: 0, due: 0, change: 0, shortfall: 0, isExact: false, isValid: false };
  }
  const change = Math.max(0, received - due);
  const shortfall = Math.max(0, due - received);
  return {
    received,
    due,
    change: round2(change),
    shortfall: round2(shortfall),
    isExact: Math.abs(received - due) < 0.009,
    isValid: received >= due - 0.009,
  };
}

export function computeUsdCashChangeInNio(receivedUsd, dueUsd, exchangeRate = 36.5, buyRate = null) {
  const received = Number(receivedUsd || 0);
  const due = Number(dueUsd || 0);
  const rate = resolveCashierPaymentRate(exchangeRate, buyRate);
  if (!Number.isFinite(received) || !Number.isFinite(due) || due <= 0) {
    return {
      received: 0,
      due: 0,
      changeUsd: 0,
      changeNio: 0,
      shortfallUsd: 0,
      isValid: false,
    };
  }
  if (received < due - 0.009) {
    return {
      received,
      due,
      changeUsd: 0,
      changeNio: 0,
      shortfallUsd: round2(due - received),
      isValid: false,
    };
  }
  const changeUsd = Math.max(0, received - due);
  return {
    received,
    due,
    changeUsd: round2(changeUsd),
    changeNio: round2(changeUsd * rate),
    shortfallUsd: 0,
    isValid: true,
  };
}

export function computeUnifiedCashSettlement({
  nioAmount = 0,
  usdAmount = 0,
  receivedNio = 0,
  receivedUsd = 0,
  exchangeRate = 36.5,
  buyRate = null,
}) {
  const rate = resolveCashierPaymentRate(exchangeRate, buyRate);
  const dueNio = round2(Number(nioAmount || 0) + Number(usdAmount || 0) * rate);
  const receivedTotalNio = round2(Number(receivedNio || 0) + Number(receivedUsd || 0) * rate);
  const hasAnyReceived = receivedTotalNio > 0.009;
  const shortfall = round2(Math.max(0, dueNio - receivedTotalNio));
  const changeNio = round2(Math.max(0, receivedTotalNio - dueNio));
  return {
    rate,
    dueNio,
    receivedTotalNio,
    shortfall,
    changeNio,
    hasAnyReceived,
    isValid: !hasAnyReceived || receivedTotalNio >= dueNio - 0.009,
  };
}

export function canSubmitCashierCollect({
  pendingNio = 0,
  nioAmount = 0,
  usdAmount = 0,
  receivedNio = 0,
  receivedUsd = 0,
  receivedAmount = 0,
  exchangeRate = 36.5,
  buyRate = null,
  useDualCurrency = false,
  allowPartial = false,
  authBlocked = false,
}) {
  if (authBlocked) return false;
  const dualTotals = computeDualCurrencyTotals({
    pendingNio,
    nioAmount,
    usdAmount,
    exchangeRate,
    buyRate,
  });
  const amountToCollect = dualTotals.covered > 0 ? dualTotals.covered : pendingNio;
  if (!allowPartial && amountToCollect > 0 && !dualTotals.isComplete) return false;
  if (!useDualCurrency) return amountToCollect > 0.009;
  const receivedNioValue = receivedNio || receivedAmount || 0;
  const settlement = computeUnifiedCashSettlement({
    nioAmount,
    usdAmount,
    receivedNio: receivedNioValue,
    receivedUsd,
    exchangeRate,
    buyRate,
  });
  if (!settlement.hasAnyReceived) {
    return dualTotals.isComplete || allowPartial;
  }
  return settlement.isValid;
}

export function computeTotalCashChangeNio({
  nioAmount = 0,
  usdAmount = 0,
  receivedNio = 0,
  receivedUsd = 0,
  exchangeRate = 36.5,
  buyRate = null,
}) {
  const nioTotals = computeCashChange(receivedNio, nioAmount);
  const usdTotals = computeUsdCashChangeInNio(receivedUsd, usdAmount, exchangeRate, buyRate);
  const unified = computeUnifiedCashSettlement({
    nioAmount,
    usdAmount,
    receivedNio,
    receivedUsd,
    exchangeRate,
    buyRate,
  });
  return {
    nio: nioTotals,
    usd: usdTotals,
    unified,
    totalChangeNio: unified.changeNio,
    isValid: unified.isValid,
  };
}

export function isCashSingleCollect(collectForm) {
  const nio = Number(collectForm?.nio_amount || 0);
  const usd = Number(collectForm?.usd_amount || 0);
  const legacySingle = collectForm?.mode === "single"
    && String(collectForm?.payment_method || "cash").toLowerCase() === "cash";
  return legacySingle || (
    isCashOrTransferMethod(collectForm?.payment_method)
    && usd <= 0.009
    && nio > 0
  );
}

export function buildDualCurrencyPagos({
  method = "cash",
  nioAmount = 0,
  usdAmount = 0,
  receivedNio = null,
  receivedUsd = null,
  exchangeRate = 36.5,
  buyRate = null,
  reference = "",
}) {
  const pagos = [];
  const nio = round2(nioAmount);
  const usd = round2(usdAmount);
  const rate = resolveCashierPaymentRate(exchangeRate, buyRate);
  if (nio > 0) {
    pagos.push({
      metodo: method,
      moneda: "NIO",
      monto_origen: nio,
      received_amount: receivedNio != null && receivedNio !== "" ? Number(receivedNio) : null,
      referencia_bancaria: reference || null,
    });
  }
  if (usd > 0) {
    pagos.push({
      metodo: method,
      moneda: "USD",
      monto_origen: usd,
      tasa_cambio: rate,
      received_amount: receivedUsd != null && receivedUsd !== "" ? Number(receivedUsd) : null,
      referencia_bancaria: reference || null,
    });
  }
  return pagos;
}

export function dualCurrencyAmountFromPlan(plan, pendingAmount = 0, buyRate = null) {
  const lines = Array.isArray(plan?.lines) ? plan.lines : [];
  if (!lines.length) {
    return {
      nio_amount: pendingAmount > 0 ? String(round2(pendingAmount)) : "",
      usd_amount: "",
    };
  }
  let nio = 0;
  let usd = 0;
  lines.forEach((line) => {
    const amount = Number(line?.monto_origen || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (String(line?.moneda || "NIO").toUpperCase() === "USD") {
      usd = round2(usd + amount);
    } else {
      nio = round2(nio + amount);
    }
  });
  if (nio <= 0 && usd <= 0 && pendingAmount > 0) {
    nio = round2(pendingAmount);
  }
  return {
    nio_amount: nio > 0 ? String(nio) : "",
    usd_amount: usd > 0 ? String(usd) : "",
    buy_rate: buyRate,
  };
}

export const CASHIER_QUICK_BILLS_NIO = [100, 500, 1000, 2000, 5000];