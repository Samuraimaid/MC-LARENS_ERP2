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

const SUPERVISOR_PRICE_EDIT_ROLES = new Set([
  "gerencia",
  "supervisor",
  "jefe_vendedores",
  "jefe_tienda",
  "programador",
]);

export function normalizeSellerType(user) {
  const raw = String(user?.seller_type || "").trim().toLowerCase();
  if (raw === "vip" || raw === "piso") return raw;
  const role = String(user?.role || "").trim().toLowerCase();
  if (SUPERVISOR_PRICE_EDIT_ROLES.has(role)) return "vip";
  return "piso";
}

export function formatRoleBadgeLabel(user, rolesMap = null) {
  const role = String(user?.role || "sin_rol").trim().toLowerCase();
  if (role === "ventas" && normalizeSellerType(user) === "vip") {
    return "VENTAS VIP";
  }
  const mappedLabel = rolesMap?.[role]?.label;
  if (mappedLabel) {
    return String(mappedLabel).toUpperCase();
  }
  return String(role).replace(/_/g, " ").toUpperCase();
}

export function canSellerEditLinePrice(user, pricingContext = null) {
  if (pricingContext?.can_edit_line_prices === true) return true;
  if (pricingContext?.can_edit_line_prices === false) return false;
  const role = String(user?.role || "").trim().toLowerCase();
  if (SUPERVISOR_PRICE_EDIT_ROLES.has(role)) return true;
  if (role !== "ventas") return false;
  return normalizeSellerType(user) === "piso";
}

export function isSupervisorPricingRole(user) {
  const role = String(user?.role || "").trim().toLowerCase();
  return SUPERVISOR_PRICE_EDIT_ROLES.has(role);
}

export function canChangeActivePriceTier(user, pricingContext = null) {
  if (!pricingContext?.allowed_price_tiers?.length) return false;
  if (isSupervisorPricingRole(user)) return true;
  const role = String(user?.role || "").trim().toLowerCase();
  if (role === "ventas") return normalizeSellerType(user) === "piso";
  return false;
}

export function tierDiscountPercent(precio1, tierPrice) {
  const base = Number(precio1) || 0;
  const tier = Number(tierPrice) || 0;
  if (base <= 0 || tier <= 0) return 0;
  return roundTo2(((base - tier) / base) * 100);
}

export function buildTierPriceCompare(product, activeTier) {
  const tier = activeTier || TIER_PRECIO1;
  const precio1 = resolveProductTierPrice(product, TIER_PRECIO1);
  const tierPrice = resolveProductTierPrice(product, tier);
  const showCompare = tier !== TIER_PRECIO1 && precio1 > 0 && tierPrice > 0;
  return {
    tier,
    tierLabel: TIER_LABELS[tier] || tier,
    precio1,
    tierPrice,
    showCompare,
    discountPercent: showCompare ? tierDiscountPercent(precio1, tierPrice) : 0,
  };
}

export function repriceCartItemsForTier(cartItems, productsById, newTier) {
  return (cartItems || []).map((item) => {
    const product = typeof productsById?.get === "function"
      ? productsById.get(String(item.product_id))
      : productsById?.[item.product_id];
    const tierPrice = resolveProductTierPrice(product || item, newTier);
    const precio1 = resolveProductTierPrice(product || item, TIER_PRECIO1);
    return {
      ...item,
      unit_price: tierPrice,
      original_unit_price: precio1,
      price_tier: newTier,
      price_tier_label: TIER_LABELS[newTier] || newTier,
    };
  });
}

export function buildTierChangeAuditEvent({ user, fromTier, toTier }) {
  const role = String(user?.role || "").trim().toLowerCase();
  const sellerType = normalizeSellerType(user);
  return {
    event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    event_type: "tier_change",
    actor_id: String(user?.user_id || user?.id || ""),
    actor_name: String(user?.name || "Usuario"),
    actor_role: role,
    actor_seller_type: sellerType,
    timestamp: new Date().toISOString(),
    visible_on_print: false,
    details: {
      from_tier: fromTier,
      from_tier_label: TIER_LABELS[fromTier] || fromTier,
      to_tier: toTier,
      to_tier_label: TIER_LABELS[toTier] || toTier,
    },
  };
}

export function buildLinePriceAuditEvent({ user, productId, productName, oldPrice, newPrice }) {
  return {
    event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    event_type: "line_price_edit",
    actor_id: String(user?.user_id || user?.id || ""),
    actor_name: String(user?.name || "Usuario"),
    actor_role: String(user?.role || "").trim().toLowerCase(),
    timestamp: new Date().toISOString(),
    visible_on_print: false,
    details: {
      product_id: productId,
      product_name: productName,
      old_price: oldPrice,
      new_price: newPrice,
    },
  };
}

export function buildDiscountAuditEvent({ user, eventType, details = {} }) {
  return {
    event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    event_type: eventType,
    actor_id: String(user?.user_id || user?.id || ""),
    actor_name: String(user?.name || "Usuario"),
    actor_role: String(user?.role || "").trim().toLowerCase(),
    timestamp: new Date().toISOString(),
    visible_on_print: false,
    details,
  };
}