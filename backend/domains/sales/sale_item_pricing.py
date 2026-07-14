"""Resolve catalog list price and original unit price for sale line items."""
from __future__ import annotations

from typing import Any, Mapping


def resolve_catalog_list_price(product: Mapping[str, Any] | None) -> float:
    """Public list price (Precio 1) used as voucher/catalog reference."""
    from backend.domains.pricing.price_tiers import resolve_precio1

    return resolve_precio1(product)


def resolve_sale_item_original_unit_price(
    product: Mapping[str, Any] | None,
    item: Mapping[str, Any],
    resolved_unit_price: float,
) -> float:
    """
    Keep Precio 1 as original_unit_price when the sold price is lower.

    This ensures vouchers and cashier breakdown always show manual/price-tier
    discounts even if the frontend omitted original_unit_price.
    """
    unit_price = float(resolved_unit_price or 0.0)
    catalog_price = resolve_catalog_list_price(product)

    explicit = item.get("original_unit_price")
    if explicit is not None:
        try:
            original = float(explicit)
        except (TypeError, ValueError):
            original = unit_price
        else:
            if original > unit_price + 0.0001:
                return round(original, 4)
            if catalog_price > unit_price + 0.0001:
                return round(catalog_price, 4)
            return round(max(original, unit_price), 4)

    if catalog_price > unit_price + 0.0001:
        return round(catalog_price, 4)
    return round(unit_price, 4)