"""Invoice barcode/QR payloads and scan-code parsing."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional
from urllib.parse import parse_qs, urlparse

from backend.domains.sales.seller_voucher_escpos import (
    is_valid_invoice_barcode,
    normalize_invoice_scan_code,
)

INVOICE_CODE_PATTERN = re.compile(r"^INV-\d{8}-\d{4}$")
SALE_ID_PATTERN = re.compile(r"^sale_[a-f0-9]{8,16}$", re.IGNORECASE)


def build_invoice_qr_payload(
    *,
    sale_id: str,
    invoice_number: str,
    base_url: str = "",
) -> str:
    s_id = str(sale_id or "").strip()
    inv_num = normalize_invoice_scan_code(invoice_number)
    target_key = s_id or inv_num
    if base_url:
        return f"{base_url.rstrip('/')}/track/{target_key}"
    return f"https://mclarens.app/track/{target_key}"


def _try_parse_json_scan(raw: str) -> Optional[Dict[str, str]]:
    text = str(raw or "").strip()
    if not text.startswith("{"):
        return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    sale_id = str(data.get("invoice_id") or data.get("sale_id") or "").strip()
    invoice_number = normalize_invoice_scan_code(
        str(data.get("invoice_number") or data.get("invoice") or "")
    )
    if sale_id or invoice_number:
        return {
            "sale_id": sale_id,
            "invoice_number": invoice_number,
            "scan_type": "qr_json",
        }
    return None


def _try_parse_url_scan(raw: str) -> Optional[Dict[str, str]]:
    text = str(raw or "").strip()
    if "://" not in text:
        return None
    try:
        parsed = urlparse(text)
        query = parse_qs(parsed.query)
        sale_id = str((query.get("invoice_id") or query.get("sale_id") or [""])[0]).strip()
        invoice_number = normalize_invoice_scan_code(
            str((query.get("invoice_number") or query.get("invoice") or [""])[0])
        )
        if sale_id or invoice_number:
            return {
                "sale_id": sale_id,
                "invoice_number": invoice_number,
                "scan_type": "qr_url",
            }
    except Exception:
        return None
    return None


def parse_invoice_scan_input(raw: str) -> Dict[str, Any]:
    """Resolve sale lookup keys from barcode, QR JSON, QR URL or sale_id."""
    text = str(raw or "").strip()
    if not text:
        return {"sale_id": "", "invoice_number": "", "scan_type": "empty", "valid": False}

    json_hit = _try_parse_json_scan(text)
    if json_hit:
        json_hit["valid"] = bool(json_hit.get("sale_id") or json_hit.get("invoice_number"))
        return json_hit

    url_hit = _try_parse_url_scan(text)
    if url_hit:
        url_hit["valid"] = bool(url_hit.get("sale_id") or url_hit.get("invoice_number"))
        return url_hit

    normalized = normalize_invoice_scan_code(text)
    if is_valid_invoice_barcode(normalized):
        return {
            "sale_id": "",
            "invoice_number": normalized,
            "scan_type": "barcode",
            "valid": True,
        }

    lowered = text.lower()
    if SALE_ID_PATTERN.match(lowered):
        return {
            "sale_id": lowered,
            "invoice_number": "",
            "scan_type": "sale_id",
            "valid": True,
        }

    return {
        "sale_id": "",
        "invoice_number": normalized,
        "scan_type": "unknown",
        "valid": False,
    }