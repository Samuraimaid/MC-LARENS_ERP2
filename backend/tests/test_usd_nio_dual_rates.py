"""USD/NIO buy/sell dual rate helpers."""

from __future__ import annotations

from datetime import datetime, timezone

from backend.domains.billing.exchange_rates import (
    DEFAULT_USD_NIO_BUY_RATE,
    DEFAULT_USD_NIO_SELL_RATE,
    normalize_usd_nio_exchange_doc,
    resolve_usd_nio_rates,
)


def _always_match(_rule, _now):
    return True


def test_normalize_exchange_doc_defaults():
    doc = normalize_usd_nio_exchange_doc({})
    assert doc["buy_rate"] == DEFAULT_USD_NIO_BUY_RATE
    assert doc["sell_rate"] == DEFAULT_USD_NIO_SELL_RATE


def test_normalize_exchange_doc_preserves_custom_rates():
    doc = normalize_usd_nio_exchange_doc({"buy_rate": 36.62, "sell_rate": 37.15})
    assert doc["buy_rate"] == 36.62
    assert doc["sell_rate"] == 37.15


def test_resolve_rates_uses_rule_for_sell_only():
    now = datetime(2026, 7, 8, 12, 0, tzinfo=timezone.utc)
    exchange_doc = {
        "buy_rate": 36.62,
        "sell_rate": 37.15,
        "official_rate": 37.15,
        "rules": [{"id": "r1", "cadence": "daily", "rate": 37.50, "start_at": "2026-01-01T00:00:00+00:00"}],
    }
    resolved = resolve_usd_nio_rates(exchange_doc, now, rule_matcher=_always_match)
    assert resolved["buy_rate"] == 36.62
    assert resolved["sell_rate"] == 37.50
    assert resolved["sell_source"].startswith("billing_rule:")