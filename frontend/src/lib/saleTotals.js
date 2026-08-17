import {
  normalizePaymentMethodCode,
  normalizePaymentMethodList,
  paymentMethodsAllowDiscounts,
} from "@/lib/paymentMethods";

export const normalizeGlobalDiscountMode = (value) => (value === "fixed" ? "fixed" : "percent");

export const isCompanyCustomerType = (customer) => {
  const type = String(customer?.customer_type || "").toLowerCase();
  return type === "empresa" || type === "company" || type === "juridica" || type === "juridico";
};

export const defaultApplyIvaForCustomer = (customer) => isCompanyCustomerType(customer);

export const normalizeCartItemForTotals = (item) => {
  const originalRaw = Number(item?.original_unit_price);
  const unitPrice = Number(item?.unit_price || 0);
  const materialsExtra = Number(item?.materials_extra || 0);
  return {
    ...item,
    quantity: item?.quantity || 1,
    discount: item?.discount || 0,
    unit_price: unitPrice,
    materials_extra: materialsExtra,
    original_unit_price: Number.isFinite(originalRaw) && originalRaw > 0 ? originalRaw : unitPrice,
    installation_type: item?.installation_type || "optional",
    installation_price: item?.installation_price || 0,
    with_installation: Boolean(item?.with_installation),
  };
};

const convertPrice = (priceUSD, currency, sellRate) => (
  currency === "NIO" ? priceUSD * sellRate : priceUSD
);

export const computeSaleTotals = ({
  cartItems = [],
  currency = "NIO",
  exchangeRate = 36.5,
  sellRate = null,
  ivaRate = 15,
  globalDiscount = 0,
  globalDiscountMode = "percent",
  appliedDiscounts = [],
  paymentMethod = "cash",
  mixedPaymentMethods = [],
  applyIVA = false,
  applyRetention = false,
  retentionRate = 2,
  hasSelectedVehicle = false,
  isCompanyCustomerFlow = false,
  supervisorDiscountPreapproved = false,
  deliveryCost = 0,
  isDelivery = false,
}) => {
  const pricingRate = Number(sellRate || exchangeRate) || 36.5;
  const normalizedMethod = normalizePaymentMethodCode(paymentMethod);
  const normalizedMixed = normalizePaymentMethodList(mixedPaymentMethods);
  const discountsBlockedByPayment = supervisorDiscountPreapproved
    ? false
    : !paymentMethodsAllowDiscounts(normalizedMethod, normalizedMixed);

  const normalizedItems = (Array.isArray(cartItems) ? cartItems : []).map(normalizeCartItemForTotals);

  const lineBreakdown = normalizedItems.map((item) => {
    const effectiveItemDiscount = discountsBlockedByPayment ? 0 : (item.discount || 0);
    const unitPriceInCurrency = convertPrice(item.unit_price, currency, pricingRate);
    const originalUnitPriceInCurrency = convertPrice(item.original_unit_price, currency, pricingRate);
    const materialsExtraInCurrency = convertPrice(item.materials_extra || 0, currency, pricingRate) * item.quantity;
    const currentLineBase = (unitPriceInCurrency * item.quantity * (1 - effectiveItemDiscount / 100)) + materialsExtraInCurrency;
    const originalLineBase = (originalUnitPriceInCurrency * item.quantity * (1 - effectiveItemDiscount / 100)) + materialsExtraInCurrency;
    const installType = item.installation_type || "optional";
    const wantsInstall = hasSelectedVehicle && (installType === "required" || Boolean(item.with_installation));
    const installTotal = installType !== "not_available" && wantsInstall
      ? convertPrice(item.installation_price || 0, currency, pricingRate) * item.quantity
      : 0;
    const manualPriceDiscount = Math.max(0, originalLineBase - currentLineBase);
    return {
      item,
      originalLineTotal: originalLineBase + installTotal,
      manualPriceDiscount,
    };
  });

  const subtotalWithoutDiscounts = lineBreakdown.reduce((sum, row) => sum + row.originalLineTotal, 0);
  const manualPriceDiscountEntries = lineBreakdown
    .filter((row) => row.manualPriceDiscount > 0.000001)
    .map((row) => ({
      productId: row.item.product_id,
      productName: row.item.product_name || "Producto",
      amount: row.manualPriceDiscount,
    }));
  const manualPriceDiscountTotal = manualPriceDiscountEntries.reduce((sum, row) => sum + row.amount, 0);
  const subtotalAfterItemPriceDiscounts = subtotalWithoutDiscounts - manualPriceDiscountTotal;

  let discountFromCodesRaw = 0;
  (Array.isArray(appliedDiscounts) ? appliedDiscounts : []).forEach((discount) => {
    if (discount.type === "percent") {
      discountFromCodesRaw += subtotalAfterItemPriceDiscounts * (discount.value / 100);
    } else if (discount.type === "fixed") {
      const fixedInCurrency = currency === "USD" ? discount.value / pricingRate : discount.value;
      discountFromCodesRaw += fixedInCurrency;
    }
  });

  const normalizedGlobalMode = normalizeGlobalDiscountMode(globalDiscountMode);
  const requestedGlobalDiscountRaw = Math.max(0, Number(globalDiscount) || 0);
  const discountAmountRaw = normalizedGlobalMode === "fixed"
    ? Math.min(requestedGlobalDiscountRaw, subtotalAfterItemPriceDiscounts)
    : subtotalAfterItemPriceDiscounts * (requestedGlobalDiscountRaw / 100);
  const totalDiscountsRaw = discountFromCodesRaw + discountAmountRaw;
  const discountFromCodes = discountsBlockedByPayment ? 0 : discountFromCodesRaw;
  const discountAmount = discountsBlockedByPayment ? 0 : discountAmountRaw;
  const totalDiscounts = discountFromCodes + discountAmount;
  const blockedDiscountsAmount = discountsBlockedByPayment ? totalDiscountsRaw : 0;
  const subtotalForRetention = subtotalAfterItemPriceDiscounts - totalDiscounts;
  const subtotalForRetentionNio = currency === "USD"
    ? subtotalForRetention * pricingRate
    : subtotalForRetention;
  const retentionThresholdMet = subtotalForRetentionNio >= 1000;
  const shouldApplyRetention = isCompanyCustomerFlow && applyRetention && retentionThresholdMet;
  const retention = shouldApplyRetention ? subtotalForRetention * (retentionRate / 100) : 0;
  const tax = applyIVA === false ? 0 : subtotalForRetention * (ivaRate / 100);
  const deliveryAmount = isDelivery ? Math.max(0, Number(deliveryCost) || 0) : 0;
  const total = subtotalForRetention + tax - retention + deliveryAmount;
  const displayTotalDiscounts = totalDiscounts + manualPriceDiscountTotal;
  const globalDiscountEffectivePercent = subtotalAfterItemPriceDiscounts > 0
    ? (discountAmountRaw / subtotalAfterItemPriceDiscounts) * 100
    : 0;

  return {
    subtotalWithoutDiscounts,
    subtotalAfterItemPriceDiscounts,
    manualPriceDiscountEntries,
    manualPriceDiscountTotal,
    subtotalForRetention,
    subtotalForRetentionNio,
    retentionThresholdMet,
    tax,
    discountAmount,
    discountAmountRaw,
    globalDiscountEffectivePercent,
    discountFromCodes,
    totalDiscounts,
    displayTotalDiscounts,
    blockedDiscountsAmount,
    discountsBlockedByPayment,
    retention,
    deliveryAmount,
    total,
  };
};

export const computeDraftSnapshotTotals = (draft, {
  exchangeRate = 36.5,
  ivaRate = 15,
  customer = null,
} = {}) => {
  if (!draft || typeof draft !== "object") {
    return {
      totalDiscounts: 0,
      manualPriceDiscountTotal: 0,
      displayTotalDiscounts: 0,
      retention: 0,
      total: 0,
    };
  }

  const currency = draft.currency || "NIO";
  const rate = Number(draft.exchangeRate || draft.exchange_rate || exchangeRate) || exchangeRate;
  const items = Array.isArray(draft.cartItems) ? draft.cartItems : [];
  const paymentMethod = normalizePaymentMethodCode(
    draft.paymentMethod || draft.payment_method || draft.payment_type || "cash"
  );
  const mixedMethods = normalizePaymentMethodList(
    draft.mixedPaymentMethods || draft.mixed_payment_methods || []
  );

  const totals = computeSaleTotals({
    cartItems: items,
    currency,
    exchangeRate: rate,
    ivaRate: Number(draft.ivaRate ?? draft.iva_rate ?? ivaRate) || ivaRate,
    globalDiscount: draft.globalDiscount ?? draft.global_discount ?? draft.discount ?? 0,
    globalDiscountMode: draft.globalDiscountMode || draft.global_discount_mode || "percent",
    appliedDiscounts: Array.isArray(draft.appliedDiscounts)
      ? draft.appliedDiscounts
      : (Array.isArray(draft.applied_discounts) ? draft.applied_discounts : []),
    paymentMethod,
    mixedPaymentMethods: mixedMethods,
    applyIVA: draft.applyIVA ?? draft.apply_iva ?? defaultApplyIvaForCustomer(customer),
    applyRetention: draft.applyRetention ?? draft.apply_retention ?? false,
    retentionRate: (() => {
      const rawRate = draft.retentionRate ?? draft.retention_rate ?? draft.retentionRateHint ?? draft.retention_rate_hint;
      if (rawRate === 0.01 || rawRate === 0.02) return rawRate * 100;
      if (rawRate === 1 || rawRate === 2) return rawRate;
      return 2;
    })(),
    hasSelectedVehicle: Boolean(draft.selectedVehicle),
    isCompanyCustomerFlow: Boolean(customer) && isCompanyCustomerType(customer),
  });

  return {
    totalDiscounts: totals.totalDiscounts,
    manualPriceDiscountTotal: totals.manualPriceDiscountTotal,
    displayTotalDiscounts: totals.displayTotalDiscounts,
    retention: totals.retention,
    total: totals.total,
  };
};