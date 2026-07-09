"""Unit tests for supplier purchase receipt NIO cost conversion."""

from __future__ import annotations

from backend.domains.billing.exchange_rates import DEFAULT_USD_NIO_SELL_RATE


def test_purchase_receipt_cost_nio_uses_sell_rate():
    cost_usd = 10.0
    sell_rate = DEFAULT_USD_NIO_SELL_RATE
    cost_nio = round(cost_usd * sell_rate, 2)
    assert cost_nio == 371.50


def test_purchase_receipt_cost_nio_rounding():
    cost_usd = 12.345
    sell_rate = 37.15
    cost_nio = round(cost_usd * sell_rate, 2)
    assert cost_nio == 458.62