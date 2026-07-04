"""Per-branch billing settings (PDF documents, voucher POS, IVA, exchange, cancel reasons)."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

DEFAULT_BILLING_BRANCH_ID = "branch_main"
DEFAULT_BILLING_IVA_RATE = 15.0


def normalize_billing_branch_id(branch_id: Any = None) -> str:
    value = str(branch_id or "").strip()
    return value or DEFAULT_BILLING_BRANCH_ID


def billing_settings_query(branch_id: Any = None) -> Dict[str, Any]:
    return {
        "type": "billing_settings",
        "branch_id": normalize_billing_branch_id(branch_id),
    }


def billing_legacy_settings_query() -> Dict[str, Any]:
    return {
        "type": "billing_settings",
        "$or": [
            {"branch_id": {"$exists": False}},
            {"branch_id": None},
            {"branch_id": ""},
        ],
    }


def billing_default_cancel_reasons(new_entity_id) -> List[Dict[str, Any]]:
    return [
        {"id": new_entity_id("reason"), "reason": "Error de digitación en factura", "active": True, "sort_order": 1},
        {"id": new_entity_id("reason"), "reason": "Precio o descuento aplicado incorrectamente", "active": True, "sort_order": 2},
        {"id": new_entity_id("reason"), "reason": "Cliente desistió de la compra", "active": True, "sort_order": 3},
        {"id": new_entity_id("reason"), "reason": "Pago rechazado o no confirmado", "active": True, "sort_order": 4},
        {"id": new_entity_id("reason"), "reason": "Producto sin disponibilidad real", "active": True, "sort_order": 5},
        {"id": new_entity_id("reason"), "reason": "Factura duplicada", "active": True, "sort_order": 6},
        {"id": new_entity_id("reason"), "reason": "Datos fiscales del cliente incorrectos", "active": True, "sort_order": 7},
        {"id": new_entity_id("reason"), "reason": "Otro Justifique", "active": True, "sort_order": 999},
    ]


def seed_billing_settings_doc(
    *,
    branch_id: str,
    legacy: Optional[Dict[str, Any]] = None,
    default_pdf_documents: Dict[str, Any],
    normalize_pdf_documents,
    normalize_seller_voucher_settings,
    default_cancel_reasons: List[Dict[str, Any]],
    utc_now_iso: str,
) -> Dict[str, Any]:
    source = legacy if isinstance(legacy, dict) else {}
    exchange = source.get("exchange") if isinstance(source.get("exchange"), dict) else {}
    return {
        "type": "billing_settings",
        "branch_id": normalize_billing_branch_id(branch_id),
        "exchange": {
            "official_rate": float(exchange.get("official_rate") or 36.5),
            "rules": list(exchange.get("rules") or []),
        },
        "iva_rate": float(source.get("iva_rate") or DEFAULT_BILLING_IVA_RATE),
        "cancel_reasons": deepcopy(source.get("cancel_reasons") or default_cancel_reasons),
        "pdf_documents": normalize_pdf_documents(source.get("pdf_documents") or default_pdf_documents),
        "seller_voucher": normalize_seller_voucher_settings(source.get("seller_voucher")),
        "updated_at": utc_now_iso,
    }


def finalize_billing_settings_doc(
    doc: Dict[str, Any],
    *,
    default_pdf_documents: Dict[str, Any],
    normalize_pdf_documents,
    normalize_seller_voucher_settings,
    default_cancel_reasons: List[Dict[str, Any]],
) -> Dict[str, Any]:
    resolved = dict(doc or {})
    resolved["type"] = "billing_settings"
    resolved["branch_id"] = normalize_billing_branch_id(resolved.get("branch_id"))
    exchange = resolved.setdefault("exchange", {})
    exchange.setdefault("official_rate", 36.5)
    exchange.setdefault("rules", [])
    resolved.setdefault("iva_rate", DEFAULT_BILLING_IVA_RATE)
    resolved.setdefault("cancel_reasons", deepcopy(default_cancel_reasons))
    resolved.setdefault(
        "pdf_documents",
        normalize_pdf_documents(resolved.get("pdf_documents") or default_pdf_documents),
    )
    resolved.setdefault(
        "seller_voucher",
        normalize_seller_voucher_settings(resolved.get("seller_voucher")),
    )
    return resolved


def utc_now() -> datetime:
    return datetime.now(timezone.utc)