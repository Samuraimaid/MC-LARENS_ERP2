"""Four-tier product pricing: Precio 1, 2, VIP and Casa Comercial."""
from __future__ import annotations

from typing import Any, Mapping

TIER_PRECIO1 = "precio1"
TIER_PRECIO2 = "precio2"
TIER_PRECIO_VIP = "precio_vip"
TIER_CASA_COMERCIAL = "precio_casa_comercial"

# Legacy field kept in sync with precio_casa_comercial.
LEGACY_CASA_FIELD = "precio3"

TIER_ORDER = (
    TIER_CASA_COMERCIAL,
    TIER_PRECIO_VIP,
    TIER_PRECIO2,
    TIER_PRECIO1,
)

TIER_LABELS_ES: dict[str, str] = {
    TIER_PRECIO1: "Precio 1",
    TIER_PRECIO2: "Precio 2",
    TIER_PRECIO_VIP: "Precio VIP",
    TIER_CASA_COMERCIAL: "Precio Casa Comercial",
}

TIER_PRODUCT_FIELDS: dict[str, str] = {
    TIER_PRECIO1: "precio1",
    TIER_PRECIO2: "precio2",
    TIER_PRECIO_VIP: "precio_vip",
    TIER_CASA_COMERCIAL: "precio_casa_comercial",
}

DEFAULT_TIER_MULTIPLIERS: dict[str, float] = {
    TIER_PRECIO1: 1.0,
    TIER_PRECIO2: 0.95,
    TIER_PRECIO_VIP: 0.88,
    TIER_CASA_COMERCIAL: 0.82,
}

PRICING_PROFILE_STANDARD = "standard"
PRICING_PROFILE_VIP = "vip"
PRICING_PROFILE_CASA_COMERCIAL = "casa_comercial"

SELLER_TYPE_PISO = "piso"
SELLER_TYPE_VIP = "vip"

APPROVAL_TYPE_PRECIO2 = "sale_precio2"


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed >= 0 else default


def resolve_precio1(product: Mapping[str, Any] | None) -> float:
    if not product:
        return 0.0
    for key in ("precio1", "price"):
        value = _safe_float(product.get(key), 0.0)
        if value > 0:
            return round(value, 4)
    return 0.0


def default_tier_values(precio1: float) -> dict[str, float]:
    base = max(0.0, float(precio1 or 0.0))
    if base <= 0:
        return {tier: 0.0 for tier in TIER_PRODUCT_FIELDS}
    return {
        TIER_PRECIO1: round(base * DEFAULT_TIER_MULTIPLIERS[TIER_PRECIO1], 2),
        TIER_PRECIO2: round(base * DEFAULT_TIER_MULTIPLIERS[TIER_PRECIO2], 2),
        TIER_PRECIO_VIP: round(base * DEFAULT_TIER_MULTIPLIERS[TIER_PRECIO_VIP], 2),
        TIER_CASA_COMERCIAL: round(base * DEFAULT_TIER_MULTIPLIERS[TIER_CASA_COMERCIAL], 2),
    }


def normalize_product_price_tiers(product: dict[str, Any], *, fill_missing: bool = True) -> dict[str, Any]:
    """Normalize tier fields, migrate precio3 -> precio_casa_comercial, keep price=precio1."""
    precio1 = resolve_precio1(product)
    defaults = default_tier_values(precio1)

    if fill_missing or not product.get("precio1"):
        product["precio1"] = defaults[TIER_PRECIO1]

    legacy_casa = product.get(LEGACY_CASA_FIELD)
    casa_raw = product.get("precio_casa_comercial", legacy_casa)
    casa_value = _safe_float(casa_raw, -1.0)
    if casa_value < 0 and fill_missing:
        casa_value = defaults[TIER_CASA_COMERCIAL]
    elif casa_value > precio1 and precio1 > 0:
        # Old schema stored precio3 above base — replace with default discount tier.
        casa_value = defaults[TIER_CASA_COMERCIAL]

    precio2_raw = product.get("precio2")
    precio2_value = _safe_float(precio2_raw, -1.0)
    if precio2_value < 0 and fill_missing:
        precio2_value = defaults[TIER_PRECIO2]
    elif precio2_value > precio1 and precio1 > 0:
        precio2_value = defaults[TIER_PRECIO2]

    vip_raw = product.get("precio_vip")
    vip_value = _safe_float(vip_raw, -1.0)
    if vip_value < 0 and fill_missing:
        vip_value = defaults[TIER_PRECIO_VIP]
    elif vip_value > precio1 and precio1 > 0:
        vip_value = defaults[TIER_PRECIO_VIP]

    product["precio1"] = round(precio1, 2)
    product["precio2"] = round(precio2_value, 2)
    product["precio_vip"] = round(vip_value, 2)
    product["precio_casa_comercial"] = round(casa_value, 2)
    product[LEGACY_CASA_FIELD] = product["precio_casa_comercial"]
    product["price"] = product["precio1"]
    product["price_tiers"] = {
        TIER_PRECIO1: product["precio1"],
        TIER_PRECIO2: product["precio2"],
        TIER_PRECIO_VIP: product["precio_vip"],
        TIER_CASA_COMERCIAL: product["precio_casa_comercial"],
    }
    return product


def tier_unit_price(product: Mapping[str, Any], tier: str) -> float:
    product = dict(product or {})
    normalize_product_price_tiers(product, fill_missing=True)
    key = TIER_PRODUCT_FIELDS.get(str(tier or "").strip().lower())
    if not key:
        return resolve_precio1(product)
    return _safe_float(product.get(key), resolve_precio1(product))


def detect_price_tier(product: Mapping[str, Any], unit_price: float, *, tolerance: float = 0.02) -> str:
    product = dict(product or {})
    normalize_product_price_tiers(product, fill_missing=True)
    try:
        price = float(unit_price or 0.0)
    except (TypeError, ValueError):
        return TIER_PRECIO1

    best_tier = TIER_PRECIO1
    best_delta = float("inf")
    for tier in TIER_ORDER:
        tier_price = tier_unit_price(product, tier)
        if tier_price <= 0:
            continue
        delta = abs(price - tier_price)
        if delta <= tolerance and delta < best_delta:
            best_delta = delta
            best_tier = tier
    return best_tier


def normalize_pricing_profile(customer: Mapping[str, Any] | None) -> str:
    if not customer:
        return PRICING_PROFILE_STANDARD
    explicit = str(customer.get("pricing_profile") or "").strip().lower()
    if explicit in {PRICING_PROFILE_STANDARD, PRICING_PROFILE_VIP, PRICING_PROFILE_CASA_COMERCIAL}:
        return explicit
    if customer.get("is_commercial_house") or customer.get("is_casa_comercial"):
        return PRICING_PROFILE_CASA_COMERCIAL
    if customer.get("is_vip_client") or customer.get("is_vip"):
        return PRICING_PROFILE_VIP
    segments = customer.get("customer_segments") or []
    if isinstance(segments, list):
        lowered = {str(s).strip().lower() for s in segments}
        if "casa_comercial" in lowered or "commercial_house" in lowered:
            return PRICING_PROFILE_CASA_COMERCIAL
        if "vip" in lowered:
            return PRICING_PROFILE_VIP
    return PRICING_PROFILE_STANDARD


def normalize_seller_type(user: Mapping[str, Any] | None) -> str:
    if not user:
        return SELLER_TYPE_PISO
    raw = str(user.get("seller_type") or "").strip().lower()
    if raw in {SELLER_TYPE_PISO, SELLER_TYPE_VIP}:
        return raw
    role = str(user.get("role") or "").strip().lower()
    if role in {"gerencia", "supervisor", "jefe_vendedores", "jefe_tienda"}:
        return SELLER_TYPE_VIP
    return SELLER_TYPE_PISO


def is_supervisor_role(role: str) -> bool:
    return str(role or "").strip().lower() in {
        "gerencia",
        "supervisor",
        "jefe_vendedores",
        "jefe_tienda",
        "programador",
    }


def resolve_default_price_tier(
    *,
    customer: Mapping[str, Any] | None,
    seller: Mapping[str, Any] | None,
) -> str:
    profile = normalize_pricing_profile(customer)
    seller_type = normalize_seller_type(seller)

    if profile == PRICING_PROFILE_CASA_COMERCIAL and seller_type == SELLER_TYPE_VIP:
        return TIER_CASA_COMERCIAL
    if profile == PRICING_PROFILE_VIP:
        return TIER_PRECIO_VIP
    return TIER_PRECIO1


def allowed_price_tiers(
    *,
    customer: Mapping[str, Any] | None,
    seller: Mapping[str, Any] | None,
    role: str = "",
) -> set[str]:
    tiers = {TIER_PRECIO1, TIER_PRECIO2}
    seller_type = normalize_seller_type(seller)
    profile = normalize_pricing_profile(customer)

    if profile == PRICING_PROFILE_VIP:
        tiers.add(TIER_PRECIO_VIP)
    if profile == PRICING_PROFILE_CASA_COMERCIAL and seller_type == SELLER_TYPE_VIP:
        tiers.add(TIER_CASA_COMERCIAL)
        tiers.add(TIER_PRECIO_VIP)

    if is_supervisor_role(role):
        return set(TIER_PRODUCT_FIELDS.keys())
    return tiers


def tier_requires_supervisor_approval(tier: str) -> bool:
    return str(tier or "").strip().lower() == TIER_PRECIO2


def build_sale_pricing_context(
    *,
    customer: Mapping[str, Any] | None,
    seller: Mapping[str, Any] | None,
) -> dict[str, Any]:
    role = str((seller or {}).get("role") or "")
    default_tier = resolve_default_price_tier(customer=customer, seller=seller)
    allowed = sorted(allowed_price_tiers(customer=customer, seller=seller, role=role))
    profile = normalize_pricing_profile(customer)
    seller_type = normalize_seller_type(seller)
    return {
        "pricing_profile": profile,
        "seller_type": seller_type,
        "default_price_tier": default_tier,
        "default_price_tier_label": TIER_LABELS_ES.get(default_tier, default_tier),
        "allowed_price_tiers": allowed,
        "tier_labels": TIER_LABELS_ES,
        "can_serve_commercial_house": seller_type == SELLER_TYPE_VIP,
        "precio2_requires_approval": True,
    }