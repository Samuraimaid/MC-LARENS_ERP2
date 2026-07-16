"""Audit events for sales/quotations — internal only, excluded from print."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Mapping


PRINT_EXCLUDED_FIELDS = frozenset({
    "audit_events",
    "active_price_tier_audit",
})


def new_event_id() -> str:
    return f"evt_{uuid.uuid4().hex[:12]}"


def build_tier_change_event(
    *,
    actor: Mapping[str, Any],
    from_tier: str,
    to_tier: str,
    from_label: str = "",
    to_label: str = "",
) -> dict[str, Any]:
    return {
        "event_id": new_event_id(),
        "event_type": "tier_change",
        "actor_id": str(actor.get("user_id") or actor.get("id") or ""),
        "actor_name": str(actor.get("name") or "Usuario"),
        "actor_role": str(actor.get("role") or "").strip().lower(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "visible_on_print": False,
        "details": {
            "from_tier": from_tier,
            "from_tier_label": from_label or from_tier,
            "to_tier": to_tier,
            "to_tier_label": to_label or to_tier,
        },
    }


def build_line_price_event(
    *,
    actor: Mapping[str, Any],
    product_id: str,
    product_name: str,
    old_price: float,
    new_price: float,
) -> dict[str, Any]:
    return {
        "event_id": new_event_id(),
        "event_type": "line_price_edit",
        "actor_id": str(actor.get("user_id") or actor.get("id") or ""),
        "actor_name": str(actor.get("name") or "Usuario"),
        "actor_role": str(actor.get("role") or "").strip().lower(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "visible_on_print": False,
        "details": {
            "product_id": product_id,
            "product_name": product_name,
            "old_price": round(float(old_price or 0), 2),
            "new_price": round(float(new_price or 0), 2),
        },
    }


def build_discount_event(
    *,
    actor: Mapping[str, Any],
    event_type: str,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "event_id": new_event_id(),
        "event_type": event_type,
        "actor_id": str(actor.get("user_id") or actor.get("id") or ""),
        "actor_name": str(actor.get("name") or "Usuario"),
        "actor_role": str(actor.get("role") or "").strip().lower(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "visible_on_print": False,
        "details": dict(details or {}),
    }


def merge_audit_events(
    existing: list[dict[str, Any]] | None,
    incoming: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in list(existing or []) + list(incoming or []):
        if not isinstance(row, dict):
            continue
        event_id = str(row.get("event_id") or "")
        if event_id and event_id in seen:
            continue
        if event_id:
            seen.add(event_id)
        merged.append(row)
    return merged


def sanitize_document_for_print(doc: dict[str, Any] | None) -> dict[str, Any]:
    """Strip internal audit metadata before PDF/thermal rendering."""
    if not isinstance(doc, dict):
        return {}
    clean = dict(doc)
    for key in PRINT_EXCLUDED_FIELDS:
        clean.pop(key, None)
    items = clean.get("items")
    if isinstance(items, list):
        clean["items"] = [
            {k: v for k, v in item.items() if k not in ("price_edit_history", "price_edit_count")}
            if isinstance(item, dict) else item
            for item in items
        ]
    return clean


def latest_tier_change_summary(events: list[dict[str, Any]] | None) -> dict[str, Any] | None:
    if not events:
        return None
    tier_events = [e for e in events if str(e.get("event_type")) == "tier_change"]
    if not tier_events:
        return None
    latest = sorted(tier_events, key=lambda e: str(e.get("timestamp") or ""), reverse=True)[0]
    details = latest.get("details") or {}
    return {
        "actor_name": latest.get("actor_name"),
        "actor_role": latest.get("actor_role"),
        "timestamp": latest.get("timestamp"),
        "to_tier_label": details.get("to_tier_label") or details.get("to_tier"),
        "from_tier_label": details.get("from_tier_label") or details.get("from_tier"),
    }