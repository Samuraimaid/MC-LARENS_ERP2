"""Tests for four-tier product pricing."""
from __future__ import annotations

from backend.domains.pricing.price_tiers import (
    PRICING_PROFILE_CASA_COMERCIAL,
    PRICING_PROFILE_VIP,
    SELLER_TYPE_PISO,
    SELLER_TYPE_VIP,
    TIER_CASA_COMERCIAL,
    TIER_PRECIO1,
    TIER_PRECIO2,
    TIER_PRECIO_VIP,
    allowed_price_tiers,
    build_sale_pricing_context,
    default_tier_values,
    detect_price_tier,
    normalize_product_price_tiers,
    resolve_default_price_tier,
)


def test_default_tier_values_discount_order():
    tiers = default_tier_values(100.0)
    assert tiers[TIER_PRECIO1] == 100.0
    assert tiers[TIER_PRECIO2] == 95.0
    assert tiers[TIER_PRECIO_VIP] == 88.0
    assert tiers[TIER_CASA_COMERCIAL] == 82.0
    assert tiers[TIER_CASA_COMERCIAL] < tiers[TIER_PRECIO_VIP] < tiers[TIER_PRECIO2] < tiers[TIER_PRECIO1]


def test_normalize_migrates_legacy_precio3_above_base():
    product = {"price": 100.0, "precio1": 100.0, "precio2": 110.0, "precio3": 120.0}
    normalized = normalize_product_price_tiers(product)
    assert normalized["precio2"] == 95.0
    assert normalized["precio_casa_comercial"] == 82.0
    assert normalized["precio3"] == normalized["precio_casa_comercial"]


def test_detect_price_tier_matches_closest_tier():
    product = normalize_product_price_tiers({"price": 200.0, "precio1": 200.0})
    assert detect_price_tier(product, 190.0) == TIER_PRECIO2
    assert detect_price_tier(product, 176.0) == TIER_PRECIO_VIP
    assert detect_price_tier(product, 164.0) == TIER_CASA_COMERCIAL


def test_vip_customer_gets_vip_default_tier():
    customer = {"pricing_profile": PRICING_PROFILE_VIP}
    seller = {"role": "ventas", "seller_type": SELLER_TYPE_PISO}
    assert resolve_default_price_tier(customer=customer, seller=seller) == TIER_PRECIO_VIP


def test_casa_comercial_vip_seller_gets_casa_tier():
    customer = {"pricing_profile": PRICING_PROFILE_CASA_COMERCIAL}
    seller = {"role": "ventas", "seller_type": SELLER_TYPE_VIP}
    assert resolve_default_price_tier(customer=customer, seller=seller) == TIER_CASA_COMERCIAL


def test_piso_seller_cannot_use_casa_tier_for_casa_client():
    customer = {"pricing_profile": PRICING_PROFILE_CASA_COMERCIAL}
    seller = {"role": "ventas", "seller_type": SELLER_TYPE_PISO}
    allowed = allowed_price_tiers(customer=customer, seller=seller, role="ventas")
    assert TIER_CASA_COMERCIAL not in allowed
    assert TIER_PRECIO_VIP not in allowed


def test_build_sale_pricing_context_for_vip_seller_casa_client():
    customer = {"pricing_profile": PRICING_PROFILE_CASA_COMERCIAL}
    seller = {"role": "ventas", "seller_type": SELLER_TYPE_VIP}
    ctx = build_sale_pricing_context(customer=customer, seller=seller)
    assert ctx["default_price_tier"] == TIER_CASA_COMERCIAL
    assert ctx["can_serve_commercial_house"] is True
    assert TIER_CASA_COMERCIAL in ctx["allowed_price_tiers"]