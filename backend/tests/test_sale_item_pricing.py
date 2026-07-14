"""Catalog list price and original_unit_price resolution for sale items."""
from __future__ import annotations

from backend.domains.sales.sale_item_pricing import (
    resolve_catalog_list_price,
    resolve_sale_item_original_unit_price,
)


def test_resolve_catalog_list_price_prefers_precio1():
    product = {"price": 140.0, "precio1": 167.18}
    assert resolve_catalog_list_price(product) == 167.18


def test_resolve_original_from_catalog_when_payload_omits_it():
    product = {"price": 140.0, "precio1": 167.18}
    item = {"unit_price": 140.0, "quantity": 1}
    assert resolve_sale_item_original_unit_price(product, item, 140.0) == 167.18


def test_resolve_original_respects_explicit_higher_value():
    product = {"price": 252.0, "precio1": 252.0}
    item = {"unit_price": 200.0, "original_unit_price": 280.0}
    assert resolve_sale_item_original_unit_price(product, item, 200.0) == 280.0


def test_resolve_original_when_frontend_sent_same_as_unit_but_catalog_higher():
    product = {"price": 1400.0, "precio1": 1671.75}
    item = {"unit_price": 1400.0, "original_unit_price": 1400.0}
    assert resolve_sale_item_original_unit_price(product, item, 1400.0) == 1671.75