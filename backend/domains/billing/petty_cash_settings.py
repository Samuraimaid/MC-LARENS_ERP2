"""Per-branch petty cash fund configuration."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List

from backend.domains.export.pdf_document_settings import PETTY_CASH_CATEGORY_LABELS

DEFAULT_PETTY_CASH_BRANCH_ID = "branch_main"

DEFAULT_PETTY_CASH_SETTINGS: Dict[str, Any] = {
    "fund_amount": 5000.0,
    "currency": "NIO",
    "monthly_cap": 15000.0,
    "low_balance_threshold_pct": 20.0,
    "requires_approval_above": 500.0,
    "voucher_prefix": "CC",
    "allowed_categories": list(PETTY_CASH_CATEGORY_LABELS.keys()),
}


def petty_cash_settings_query(branch_id: Any = None) -> Dict[str, Any]:
    from backend.domains.billing.branch_settings import normalize_billing_branch_id

    return {
        "type": "petty_cash_settings",
        "branch_id": normalize_billing_branch_id(branch_id),
    }


def normalize_petty_cash_settings(raw: Any = None) -> Dict[str, Any]:
    source = raw if isinstance(raw, dict) else {}
    defaults = DEFAULT_PETTY_CASH_SETTINGS
    allowed = source.get("allowed_categories")
    if not isinstance(allowed, list) or not allowed:
        allowed = list(defaults["allowed_categories"])
    else:
        allowed = [str(item).strip().lower() for item in allowed if str(item).strip()]
        allowed = [item for item in allowed if item in PETTY_CASH_CATEGORY_LABELS] or list(defaults["allowed_categories"])

    fund_amount = float(source.get("fund_amount") if source.get("fund_amount") is not None else defaults["fund_amount"])
    monthly_cap = float(source.get("monthly_cap") if source.get("monthly_cap") is not None else defaults["monthly_cap"])
    threshold = float(
        source.get("low_balance_threshold_pct")
        if source.get("low_balance_threshold_pct") is not None
        else defaults["low_balance_threshold_pct"]
    )
    approval_above = float(
        source.get("requires_approval_above")
        if source.get("requires_approval_above") is not None
        else defaults["requires_approval_above"]
    )

    return {
        "fund_amount": max(0.0, round(fund_amount, 2)),
        "currency": str(source.get("currency") or defaults["currency"]).strip().upper() or "NIO",
        "monthly_cap": max(0.0, round(monthly_cap, 2)),
        "low_balance_threshold_pct": max(5.0, min(80.0, round(threshold, 2))),
        "requires_approval_above": max(0.0, round(approval_above, 2)),
        "voucher_prefix": str(source.get("voucher_prefix") or defaults["voucher_prefix"]).strip().upper()[:6] or "CC",
        "allowed_categories": allowed,
    }


def merge_petty_cash_settings(current: Dict[str, Any], payload: Dict[str, Any] | None) -> Dict[str, Any]:
    if not payload:
        return normalize_petty_cash_settings(current)
    merged = deepcopy(normalize_petty_cash_settings(current))
    for key in DEFAULT_PETTY_CASH_SETTINGS:
        if key in payload and payload[key] is not None:
            merged[key] = payload[key]
    return normalize_petty_cash_settings(merged)


def seed_petty_cash_settings_doc(*, branch_id: str, utc_now_iso: str | None = None) -> Dict[str, Any]:
    from backend.domains.billing.branch_settings import normalize_billing_branch_id

    return {
        "type": "petty_cash_settings",
        "branch_id": normalize_billing_branch_id(branch_id),
        **normalize_petty_cash_settings({}),
        "updated_at": utc_now_iso or datetime.now(timezone.utc).isoformat(),
    }