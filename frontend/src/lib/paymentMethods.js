const PAYMENT_METHOD_ALIASES = {
  efectivo: "cash",
  cash: "cash",
  transferencia: "transfer",
  transfer: "transfer",
  tarjeta: "card",
  card: "card",
  credito: "credit",
  credit: "credit",
  mixed: "mixed",
  mixto: "mixed",
};

const PAYMENT_METHOD_LABELS = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  credit: "Crédito",
};

export const PAYMENT_METHOD_CODES = ["cash", "transfer", "card", "credit", "mixed"];

export const normalizePaymentMethodCode = (value) => {
  const method = String(value || "").trim().toLowerCase();
  return PAYMENT_METHOD_ALIASES[method] || (PAYMENT_METHOD_CODES.includes(method) ? method : "cash");
};

export const normalizePaymentMethodList = (values) => {
  const list = Array.isArray(values) ? values : [];
  const normalized = [];
  list.forEach((value) => {
    const method = normalizePaymentMethodCode(value);
    if (method === "mixed") return;
    if (!normalized.includes(method)) {
      normalized.push(method);
    }
  });
  return normalized;
};

export const getPaymentMethodsForDiscounts = (paymentMethod, mixedPaymentMethods = []) => {
  const normalizedMethod = normalizePaymentMethodCode(paymentMethod);
  if (normalizedMethod === "mixed") {
    return normalizePaymentMethodList(mixedPaymentMethods);
  }
  return normalizedMethod ? [normalizedMethod] : [];
};

export const paymentMethodsAllowDiscounts = (paymentMethod, mixedPaymentMethods = []) => {
  const methods = getPaymentMethodsForDiscounts(paymentMethod, mixedPaymentMethods);
  return methods.length > 0 && methods.every((method) => method === "cash" || method === "transfer");
};

export const getPaymentMethodSummaryLabel = (paymentMethod, mixedPaymentMethods = []) => {
  const normalizedMethod = normalizePaymentMethodCode(paymentMethod);
  if (normalizedMethod !== "mixed") {
    return PAYMENT_METHOD_LABELS[normalizedMethod] || normalizedMethod;
  }
  const normalizedMixed = normalizePaymentMethodList(mixedPaymentMethods);
  return normalizedMixed.length
    ? normalizedMixed.map((method) => PAYMENT_METHOD_LABELS[method] || method).join(" + ")
    : "Pago mixto";
};
