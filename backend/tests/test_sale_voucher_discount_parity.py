"""Sale create payload must preserve original_unit_price for voucher breakdown."""

from __future__ import annotations

from backend.domains.sales.sale_item_pricing import resolve_sale_item_original_unit_price


def test_sale_item_keeps_catalog_original_when_payload_omits_it():
    product = {"product_id": "prod_1", "name": "Radio Android", "price": 252.0, "precio1": 252.0}
    item = {"product_id": "prod_1", "quantity": 1, "unit_price": 200.0, "discount": 0}
    price = float(item.get("unit_price") or 0.0)
    original_price_value = resolve_sale_item_original_unit_price(product, item, price)
    assert original_price_value == 252.0


def test_sale_item_respects_explicit_original_unit_price():
    product = {"product_id": "prod_1", "name": "Radio Android", "price": 252.0, "precio1": 252.0}
    item = {
        "product_id": "prod_1",
        "quantity": 1,
        "unit_price": 200.0,
        "original_unit_price": 280.0,
        "discount": 0,
    }
    price = float(item.get("unit_price") or 0.0)
    original_price_value = resolve_sale_item_original_unit_price(product, item, price)
    assert original_price_value == 280.0