import { round2 } from './suiteCore.mjs';

export function computeSaleTotalNio(unitPrice, exchangeRate = 36.5, discountPercent = 0) {
  const subtotal = Number(unitPrice) * (1 - Number(discountPercent) / 100);
  return round2(subtotal * Number(exchangeRate) * 1.15);
}

export function buildPlannedPaymentPlan(paymentMethod, totalNio, lines = null) {
  const method = String(paymentMethod || 'cash').toLowerCase();
  if (lines) return { mode: method === 'mixed' ? 'mixed' : method, lines };
  return {
    mode: method,
    lines: [{ metodo: method, moneda: 'NIO', monto_origen: round2(totalNio) }],
  };
}

export function buildSalePayload({
  customerId,
  vehicleId = null,
  productId,
  unitPrice,
  warehouseId = 'wh_main',
  quantity = 1,
  withInstallation = false,
  discountPercent = 0,
  paymentMethod = 'cash',
  mixedPaymentMethods = null,
  exchangeRate = 36.5,
  currency = 'NIO',
  planLines = null,
  creditDays = null,
  notes = '',
  idempotencyKey = '',
  deliveryInfo = null,
  logisticMode = null,
}) {
  const totalNio = computeSaleTotalNio(unitPrice, exchangeRate, discountPercent);
  const method = String(paymentMethod || 'cash').toLowerCase();
  const payload = {
    customer_id: customerId,
    vehicle_id: vehicleId,
    items: [{
      product_id: productId,
      quantity,
      discount: 0,
      unit_price: unitPrice,
      warehouse_id: warehouseId,
      with_installation: withInstallation,
    }],
    discount: discountPercent,
    payment_type: method,
    payment_method: method,
    apply_iva: true,
    iva_rate: 15,
    currency,
    exchange_rate: exchangeRate,
    notes,
  };
  // No enviar total_amount: el servidor recalcula y preview/create pueden divergir (bug conocido).
  if (planLines) {
    payload.planned_payment_plan = buildPlannedPaymentPlan(method, totalNio, planLines);
  }
  if (method === 'mixed' && mixedPaymentMethods) {
    payload.mixed_payment_methods = mixedPaymentMethods;
  }
  if (method === 'credit' && creditDays != null) {
    payload.credit_days = creditDays;
  }
  if (idempotencyKey) payload.idempotency_key = idempotencyKey;
  if (deliveryInfo) payload.delivery_info = deliveryInfo;
  if (logisticMode) payload.logistic_mode = logisticMode;
  return payload;
}

export function buildQuotationPayload(saleLike) {
  const payload = { ...saleLike };
  delete payload.idempotency_key;
  return payload;
}

export function buildMixedPlanLines(totalNio, splits) {
  return splits.map((row) => ({
    metodo: row.metodo,
    moneda: row.moneda || 'NIO',
    monto_origen: round2(row.monto_origen),
  }));
}

/** Usa preview-settlement del servidor para alinear total y plan de cobro. */
export async function resolveSalePayload(session, payload) {
  const preview = await session.post('/sales/preview-settlement', payload);
  if (!preview.ok) {
    return { payload, preview, error: preview.body || preview.text };
  }
  const settlement = preview.body || {};
  const net = round2(settlement.net_to_collect || settlement.total_legal || 0);
  const method = String(payload.payment_method || payload.payment_type || 'cash').toLowerCase();
  const resolved = {
    ...payload,
    apply_iva: settlement.apply_iva ?? payload.apply_iva,
    currency: settlement.currency || payload.currency || 'NIO',
    exchange_rate: settlement.exchange_rate || payload.exchange_rate,
  };
  delete resolved.total_amount;
  if (method !== 'credit') {
    resolved.planned_payment_plan = buildPlannedPaymentPlan(
      method,
      net,
      payload.planned_payment_plan?.lines || null,
    );
  }
  return { payload: resolved, preview, settlement, net_to_collect: net };
}

/**
 * Alinea el plan de cobro con el total real del servidor.
 * Si preview y create divergen, usa expected_total del error PAYMENT_PLAN_MISMATCH.
 */
export async function alignSalePayloadForCreate(session, payload) {
  const method = String(payload.payment_method || payload.payment_type || 'cash').toLowerCase();
  const item = payload.items?.[0];
  const estTotal = round2(Number(item?.unit_price || 10) * Number(item?.quantity || 1) * 1.15);
  const mixedMethods = payload.mixed_payment_methods || [];
  let defaultPlan = buildPlannedPaymentPlan(method, estTotal);
  if (method === 'mixed' && mixedMethods.length >= 2) {
    const half = round2(estTotal / 2);
    defaultPlan = {
      mode: 'mixed',
      lines: mixedMethods.map((metodo, idx) => ({
        metodo,
        moneda: 'NIO',
        monto_origen: idx === mixedMethods.length - 1 ? round2(estTotal - half) : half,
      })),
    };
  }
  const probe = {
    ...payload,
    idempotency_key: `probe-${Date.now()}`,
    planned_payment_plan: payload.planned_payment_plan || defaultPlan,
  };
  delete probe.total_amount;

  if (method === 'credit') {
    return { payload: probe };
  }

  const attempt = await session.post('/sales', probe);
  if (attempt.ok) {
    return { payload: probe, sale: attempt.body, created: true };
  }

  const detail = attempt.body?.detail;
  const expected = detail?.expected_total ?? detail?.settlement?.net_to_collect;
  if (expected != null && (detail?.error === 'PAYMENT_PLAN_MISMATCH' || detail?.error === 'TOTAL_MISMATCH')) {
    const total = round2(expected);
    let alignedPlan = buildPlannedPaymentPlan(method, total, payload.planned_payment_plan?.lines || null);
    if (method === 'mixed' && (payload.mixed_payment_methods || []).length >= 2) {
      const methods = payload.mixed_payment_methods;
      const half = round2(total / 2);
      alignedPlan = {
        mode: 'mixed',
        lines: methods.map((metodo, idx) => ({
          metodo,
          moneda: 'NIO',
          monto_origen: idx === methods.length - 1 ? round2(total - half) : half,
        })),
      };
    }
    const aligned = {
      ...payload,
      idempotency_key: payload.idempotency_key || `sale-${Date.now()}`,
      planned_payment_plan: alignedPlan,
    };
    delete aligned.total_amount;
    return {
      payload: aligned,
      expected_total: total,
      mismatch: { preview_total: detail.planned_total, expected_total: total, error: detail.error },
    };
  }

  return { payload, error: attempt.body || attempt.text, status: attempt.status };
}

export function productUnitPrice(product, currency = 'NIO', exchangeRate = 36.5) {
  if (!product) return 10;
  if (currency === 'USD') return Number(product.price_usd || product.cost_usd || product.price || 10);
  return Number(product.price || product.precio1 || product.price_usd * exchangeRate || 10);
}