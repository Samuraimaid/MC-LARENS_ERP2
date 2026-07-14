export const TIER_PRECIO1 = "precio1";
export const TIER_PRECIO2 = "precio2";
export const TIER_PRECIO_VIP = "precio_vip";
export const TIER_CASA_COMERCIAL = "precio_casa_comercial";

export const TIER_LABELS = {
  [TIER_PRECIO1]: "Precio 1",
  [TIER_PRECIO2]: "Precio 2",
  [TIER_PRECIO_VIP]: "Precio VIP",
  [TIER_CASA_COMERCIAL]: "Precio Casa Comercial",
};

export const DEFAULT_TIER_MULTIPLIERS = {
  [TIER_PRECIO1]: 1.0,
  [TIER_PRECIO2]: 0.95,
  [TIER_PRECIO_VIP]: 0.88,
  [TIER_CASA_COMERCIAL]: 0.82,
};

export const PRICING_PROFILES = {
  standard: "Estándar",
  vip: "VIP",
  casa_comercial: "Casa Comercial",
};

export const SELLER_TYPES = {
  piso: "Vendedor Piso",
  vip: "Vendedor VIP",
};

export const TIER_ORDER = [
  TIER_CASA_COMERCIAL,
  TIER_PRECIO_VIP,
  TIER_PRECIO2,
  TIER_PRECIO1,
];

export function roundTo2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function defaultTierValues(precio1) {
  const base = Math.max(0, Number(precio1) || 0);
  return Object.fromEntries(
    Object.entries(DEFAULT_TIER_MULTIPLIERS).map(([tier, mult]) => [tier, roundTo2(base * mult)]),
  );
}

export function normalizeProductTiers(product = {}) {
  const precio1 = Number(product.precio1 || product.price) || 0;
  const defaults = defaultTierValues(precio1);

  let precio2 = Number(product.precio2);
  if (!Number.isFinite(precio2) || precio2 < 0) precio2 = defaults[TIER_PRECIO2];
  else if (precio2 > precio1 && precio1 > 0) precio2 = defaults[TIER_PRECIO2];

  let precioVip = Number(product.precio_vip);
  if (!Number.isFinite(precioVip) || precioVip < 0) precioVip = defaults[TIER_PRECIO_VIP];
  else if (precioVip > precio1 && precio1 > 0) precioVip = defaults[TIER_PRECIO_VIP];

  let casa = Number(product.precio_casa_comercial ?? product.precio3);
  if (!Number.isFinite(casa) || casa < 0) casa = defaults[TIER_CASA_COMERCIAL];
  else if (casa > precio1 && precio1 > 0) casa = defaults[TIER_CASA_COMERCIAL];

  return {
    precio1: roundTo2(precio1),
    precio2: roundTo2(precio2),
    precio_vip: roundTo2(precioVip),
    precio_casa_comercial: roundTo2(casa),
    precio3: roundTo2(casa),
    price: roundTo2(precio1),
  };
}

export function resolveProductTierPrice(product, tier) {
  const normalized = normalizeProductTiers(product || {});
  const map = {
    [TIER_PRECIO1]: normalized.precio1,
    [TIER_PRECIO2]: normalized.precio2,
    [TIER_PRECIO_VIP]: normalized.precio_vip,
    [TIER_CASA_COMERCIAL]: normalized.precio_casa_comercial,
  };
  return Number(map[tier] ?? normalized.precio1 ?? 0);
}

export function detectPriceTier(product, unitPrice, tolerance = 0.02) {
  const normalized = normalizeProductTiers(product || {});
  const price = Number(unitPrice) || 0;
  let bestTier = TIER_PRECIO1;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const tier of TIER_ORDER) {
    const tierPrice = resolveProductTierPrice(normalized, tier);
    if (tierPrice <= 0) continue;
    const delta = Math.abs(price - tierPrice);
    if (delta <= tolerance && delta < bestDelta) {
      bestDelta = delta;
      bestTier = tier;
    }
  }
  return bestTier;
}

export function buildProductPricePayload(form, { precio1 } = {}) {
  const tier1 = Number(precio1 ?? form.precio1 ?? form.price) || 0;
  const defaults = defaultTierValues(tier1);
  const tier2 = Number(form.precio2) || defaults[TIER_PRECIO2];
  const tierVip = Number(form.precio_vip) || defaults[TIER_PRECIO_VIP];
  const tierCasa = Number(form.precio_casa_comercial ?? form.precio3) || defaults[TIER_CASA_COMERCIAL];
  return {
    price: tier1,
    precio1: tier1,
    precio2: tier2,
    precio_vip: tierVip,
    precio_casa_comercial: tierCasa,
    precio3: tierCasa,
  };
}

export function cartNeedsPrecio2Approval(cartItems, productsById, { isSupervisor = false } = {}) {
  if (isSupervisor) return false;
  return (cartItems || []).some((item) => {
    const product = typeof productsById?.get === "function"
      ? productsById.get(String(item.product_id))
      : productsById?.[item.product_id];
    return detectPriceTier(product, item.unit_price) === TIER_PRECIO2;
  });
}

export function resolveDefaultUnitPrice(product, pricingContext) {
  const tier = pricingContext?.default_price_tier || TIER_PRECIO1;
  return resolveProductTierPrice(product, tier);
}