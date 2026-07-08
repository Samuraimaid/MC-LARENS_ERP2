"""USD/NIO dual exchange rates: buy (compra) and sell (venta)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

DEFAULT_USD_NIO_BUY_RATE = 36.62
DEFAULT_USD_NIO_SELL_RATE = 37.15


def _safe_float(value: Any, fallback: float) -> float:
    try:
        parsed = float(value)
        return parsed if parsed > 0 else fallback
    except (TypeError, ValueError):
        return fallback


def normalize_usd_nio_exchange_doc(exchange_doc: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    data = exchange_doc if isinstance(exchange_doc, dict) else {}
    sell_rate = _safe_float(
        data.get("sell_rate") or data.get("official_rate"),
        DEFAULT_USD_NIO_SELL_RATE,
    )
    buy_rate = _safe_float(data.get("buy_rate"), DEFAULT_USD_NIO_BUY_RATE)
    official_rate = _safe_float(data.get("official_rate"), sell_rate)
    return {
        "buy_rate": buy_rate,
        "sell_rate": sell_rate,
        "official_rate": official_rate,
        "rules": list(data.get("rules") or []),
    }


def select_effective_sell_rate(
    exchange_doc: Optional[Dict[str, Any]],
    now: datetime,
    *,
    rule_matcher,
) -> Tuple[float, str]:
    """Resolve sell rate using scheduled billing rules when present."""
    normalized = normalize_usd_nio_exchange_doc(exchange_doc)
    sell_rate = normalized["sell_rate"]
    rules = normalized["rules"]
    if not rules:
        return sell_rate, "billing_sell"

    priority = {"custom": 4, "monthly": 3, "weekly": 2, "daily": 1}
    matched = []
    for rule in rules:
        try:
            if rule_matcher(rule, now):
                matched.append(rule)
        except Exception:
            continue

    if not matched:
        return sell_rate, "billing_sell"

    def _rule_sort_key(rule: Dict[str, Any]) -> Tuple[int, datetime]:
        cadence = priority.get(str(rule.get("cadence") or "").lower(), 0)
        start_raw = rule.get("start_at")
        start_at = None
        if isinstance(start_raw, datetime):
            start_at = start_raw
        elif isinstance(start_raw, str) and start_raw.strip():
            try:
                start_at = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
            except ValueError:
                start_at = None
        if start_at is None:
            start_at = datetime.min.replace(tzinfo=timezone.utc)
        return cadence, start_at

    matched.sort(key=_rule_sort_key, reverse=True)
    top = matched[0]
    rate = _safe_float(top.get("rate"), sell_rate)
    return rate, f"billing_rule:{str(top.get('id') or 'unknown')}"


def resolve_usd_nio_rates(
    exchange_doc: Optional[Dict[str, Any]],
    now: datetime,
    *,
    rule_matcher,
) -> Dict[str, Any]:
    normalized = normalize_usd_nio_exchange_doc(exchange_doc)
    sell_rate, sell_source = select_effective_sell_rate(
        normalized,
        now,
        rule_matcher=rule_matcher,
    )
    buy_rate = normalized["buy_rate"]
    return {
        "buy_rate": buy_rate,
        "sell_rate": sell_rate,
        "official_rate": normalized["official_rate"],
        "buy_source": "billing_buy",
        "sell_source": sell_source,
        "effective_rate": sell_rate,
        "effective_source": sell_source,
    }