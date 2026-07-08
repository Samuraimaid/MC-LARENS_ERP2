"""Configurable seller voucher (POS 80mm) layout stored in billing settings."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict

DEFAULT_SELLER_VOUCHER_TEXTS: Dict[str, str] = {
    "company_name": "MUNDO DE ACCESORIOS",
    "subtitle": "VOUCHER DE VENTA (NO FISCAL)",
    "scan_label": "ESCANEAR EN CAJA",
    "footer_valid": "Valido hasta cobro en caja",
    "footer_disclaimer": "NO ES FACTURA FISCAL",
}

DEFAULT_SELLER_VOUCHER_SECTIONS: Dict[str, bool] = {
    "header_rules": True,
    "company_name": True,
    "subtitle": True,
    "invoice_number": True,
    "date": True,
    "customer": True,
    "vehicle": True,
    "plate": True,
    "items": True,
    "breakdown": True,
    "breakdown_gross_subtotal": True,
    "breakdown_line_discount": True,
    "breakdown_price_discount": True,
    "breakdown_code_discount": True,
    "breakdown_global_discount": True,
    "breakdown_blocked_discount": True,
    "breakdown_subtotal": True,
    "breakdown_retention": True,
    "breakdown_iva": True,
    "breakdown_total": True,
    "payment_plan": True,
    "barcode": True,
    "scan_label": True,
    "footer_valid": True,
    "footer_disclaimer": True,
}

DEFAULT_SELLER_VOUCHER_SETTINGS: Dict[str, Any] = {
    "body_font_size": 6,
    "title_font_size": 7,
    "chars_per_line": 64,
    "top_feed_lines": 8,
    "left_margin_chars": 2,
    "barcode_module_width": 4,
    "barcode_pdf_bar_width": 0.66,
    "texts": deepcopy(DEFAULT_SELLER_VOUCHER_TEXTS),
    "sections": deepcopy(DEFAULT_SELLER_VOUCHER_SECTIONS),
}

_SECTION_KEYS = tuple(DEFAULT_SELLER_VOUCHER_SECTIONS.keys())
_TEXT_KEYS = tuple(DEFAULT_SELLER_VOUCHER_TEXTS.keys())


def _clamp_int(value: Any, *, default: int, minimum: int, maximum: int) -> int:
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, numeric))


def _clamp_float(value: Any, *, default: float, minimum: float, maximum: float) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, numeric))


def _clean_text(value: Any, *, default: str, max_len: int = 80) -> str:
    text = str(value if value is not None else default).strip()
    if not text:
        return default
    return text[:max_len]


def normalize_seller_voucher_settings(raw: Any = None) -> Dict[str, Any]:
    source = raw if isinstance(raw, dict) else {}
    texts_in = source.get("texts") if isinstance(source.get("texts"), dict) else {}
    sections_in = source.get("sections") if isinstance(source.get("sections"), dict) else {}

    texts = {
        key: _clean_text(texts_in.get(key), default=DEFAULT_SELLER_VOUCHER_TEXTS[key])
        for key in _TEXT_KEYS
    }
    sections = {
        key: bool(sections_in.get(key, DEFAULT_SELLER_VOUCHER_SECTIONS[key]))
        for key in _SECTION_KEYS
    }

    body_font_size = _clamp_int(source.get("body_font_size"), default=6, minimum=5, maximum=10)
    title_font_size = _clamp_int(source.get("title_font_size"), default=7, minimum=6, maximum=12)
    if title_font_size < body_font_size:
        title_font_size = body_font_size

    chars_per_line = _clamp_int(source.get("chars_per_line"), default=64, minimum=32, maximum=64)
    top_feed_lines = _clamp_int(source.get("top_feed_lines"), default=8, minimum=0, maximum=20)
    left_margin_chars = _clamp_int(source.get("left_margin_chars"), default=2, minimum=0, maximum=8)
    barcode_module_width = _clamp_int(source.get("barcode_module_width"), default=4, minimum=2, maximum=6)
    barcode_pdf_bar_width = _clamp_float(
        source.get("barcode_pdf_bar_width"),
        default=0.66,
        minimum=0.2,
        maximum=1.2,
    )

    return {
        "body_font_size": body_font_size,
        "title_font_size": title_font_size,
        "chars_per_line": chars_per_line,
        "top_feed_lines": top_feed_lines,
        "left_margin_chars": left_margin_chars,
        "barcode_module_width": barcode_module_width,
        "barcode_pdf_bar_width": barcode_pdf_bar_width,
        "texts": texts,
        "sections": sections,
    }


def merge_seller_voucher_settings(
    current: Dict[str, Any],
    payload: Dict[str, Any] | None,
) -> Dict[str, Any]:
    if not payload:
        return normalize_seller_voucher_settings(current)
    merged = deepcopy(normalize_seller_voucher_settings(current))
    for key in (
        "body_font_size",
        "title_font_size",
        "chars_per_line",
        "top_feed_lines",
        "left_margin_chars",
        "barcode_module_width",
        "barcode_pdf_bar_width",
    ):
        if key in payload and payload[key] is not None:
            merged[key] = payload[key]
    if isinstance(payload.get("texts"), dict):
        merged["texts"] = {
            **merged["texts"],
            **{k: v for k, v in payload["texts"].items() if k in _TEXT_KEYS and v is not None},
        }
    if isinstance(payload.get("sections"), dict):
        merged["sections"] = {
            **merged["sections"],
            **{
                k: bool(v)
                for k, v in payload["sections"].items()
                if k in _SECTION_KEYS and v is not None
            },
        }
    return normalize_seller_voucher_settings(merged)


def sample_vehicle_for_voucher_preview() -> Dict[str, Any]:
    return {
        "vehicle_id": "vehicle_preview_sample",
        "brand": "TOYOTA",
        "model": "Corolla",
        "year": 2020,
        "plate": "M 123 456",
    }


DEFAULT_THERMAL_INVOICE_TEXTS: Dict[str, str] = {
    "company_name": "MUNDO DE ACCESORIOS",
    "subtitle": "COMPROBANTE DE COBRO (NO FISCAL)",
    "payment_header": "COBRO REALIZADO",
    "scan_label": "ESCANEAR PARA GARANTIAS",
    "footer_paid": "COMPROBANTE PAGADO",
    "footer_disclaimer": "NO ES FACTURA FISCAL",
}

DEFAULT_THERMAL_INVOICE_SECTIONS: Dict[str, bool] = {
    "header_rules": True,
    "company_name": True,
    "subtitle": True,
    "invoice_number": True,
    "date": True,
    "customer": True,
    "vehicle": True,
    "plate": True,
    "items": True,
    "breakdown": True,
    "breakdown_gross_subtotal": True,
    "breakdown_line_discount": True,
    "breakdown_price_discount": True,
    "breakdown_code_discount": True,
    "breakdown_global_discount": True,
    "breakdown_blocked_discount": True,
    "breakdown_subtotal": True,
    "breakdown_retention": True,
    "breakdown_iva": False,
    "breakdown_total": True,
    "payment_header": True,
    "payment_method": True,
    "amount_collected": True,
    "received_amount": True,
    "change_amount": True,
    "cashier_name": True,
    "collected_date": True,
    "barcode": True,
    "qr_code": True,
    "scan_label": True,
    "footer_paid": True,
    "footer_disclaimer": True,
}

DEFAULT_THERMAL_INVOICE_SETTINGS: Dict[str, Any] = {
    "body_font_size": 6,
    "title_font_size": 7,
    "chars_per_line": 64,
    "top_feed_lines": 8,
    "left_margin_chars": 2,
    "barcode_module_width": 4,
    "barcode_pdf_bar_width": 0.66,
    "texts": deepcopy(DEFAULT_THERMAL_INVOICE_TEXTS),
    "sections": deepcopy(DEFAULT_THERMAL_INVOICE_SECTIONS),
}

_THERMAL_INVOICE_SECTION_KEYS = tuple(DEFAULT_THERMAL_INVOICE_SECTIONS.keys())
_THERMAL_INVOICE_TEXT_KEYS = tuple(DEFAULT_THERMAL_INVOICE_TEXTS.keys())


def normalize_thermal_invoice_settings(raw: Any = None) -> Dict[str, Any]:
    source = raw if isinstance(raw, dict) else {}
    texts_in = source.get("texts") if isinstance(source.get("texts"), dict) else {}
    sections_in = source.get("sections") if isinstance(source.get("sections"), dict) else {}

    texts = {
        key: _clean_text(texts_in.get(key), default=DEFAULT_THERMAL_INVOICE_TEXTS[key])
        for key in _THERMAL_INVOICE_TEXT_KEYS
    }
    sections = {
        key: bool(sections_in.get(key, DEFAULT_THERMAL_INVOICE_SECTIONS[key]))
        for key in _THERMAL_INVOICE_SECTION_KEYS
    }

    body_font_size = _clamp_int(source.get("body_font_size"), default=6, minimum=5, maximum=10)
    title_font_size = _clamp_int(source.get("title_font_size"), default=7, minimum=6, maximum=12)
    if title_font_size < body_font_size:
        title_font_size = body_font_size

    chars_per_line = _clamp_int(source.get("chars_per_line"), default=64, minimum=32, maximum=64)
    top_feed_lines = _clamp_int(source.get("top_feed_lines"), default=8, minimum=0, maximum=20)
    left_margin_chars = _clamp_int(source.get("left_margin_chars"), default=2, minimum=0, maximum=8)
    barcode_module_width = _clamp_int(source.get("barcode_module_width"), default=4, minimum=2, maximum=6)
    barcode_pdf_bar_width = _clamp_float(
        source.get("barcode_pdf_bar_width"),
        default=0.66,
        minimum=0.2,
        maximum=1.2,
    )

    return {
        "body_font_size": body_font_size,
        "title_font_size": title_font_size,
        "chars_per_line": chars_per_line,
        "top_feed_lines": top_feed_lines,
        "left_margin_chars": left_margin_chars,
        "barcode_module_width": barcode_module_width,
        "barcode_pdf_bar_width": barcode_pdf_bar_width,
        "texts": texts,
        "sections": sections,
    }


def merge_thermal_invoice_settings(
    current: Dict[str, Any],
    payload: Dict[str, Any] | None,
) -> Dict[str, Any]:
    if not payload:
        return normalize_thermal_invoice_settings(current)
    merged = deepcopy(normalize_thermal_invoice_settings(current))
    for key in (
        "body_font_size",
        "title_font_size",
        "chars_per_line",
        "top_feed_lines",
        "left_margin_chars",
        "barcode_module_width",
        "barcode_pdf_bar_width",
    ):
        if key in payload and payload[key] is not None:
            merged[key] = payload[key]
    if isinstance(payload.get("texts"), dict):
        merged["texts"] = {
            **merged["texts"],
            **{k: v for k, v in payload["texts"].items() if k in _THERMAL_INVOICE_TEXT_KEYS and v is not None},
        }
    if isinstance(payload.get("sections"), dict):
        merged["sections"] = {
            **merged["sections"],
            **{
                k: bool(v)
                for k, v in payload["sections"].items()
                if k in _THERMAL_INVOICE_SECTION_KEYS and v is not None
            },
        }
    return normalize_thermal_invoice_settings(merged)


def sample_sale_for_thermal_invoice_preview() -> Dict[str, Any]:
    vehicle = sample_vehicle_for_voucher_preview()
    return {
        "invoice_number": "INV-20260704-0002",
        "created_at": "2026-07-04T10:30:00+00:00",
        "collected_at": "2026-07-04T11:15:00+00:00",
        "customer_name": "Cliente de Prueba",
        "vehicle_id": vehicle["vehicle_id"],
        "currency": "NIO",
        "exchange_rate": 36.5,
        "subtotal": 5000.0,
        "iva_amount": 0.0,
        "iva_rate": 0.0,
        "apply_iva": False,
        "discounts_applied_amount": 0.0,
        "total": 5000.0,
        "net_to_collect": 5000.0,
        "payment_method": "cash",
        "payment_status": "paid",
        "last_payment_summary": {
            "payment_method": "cash",
            "amount_collected": 5000.0,
            "received_amount": 5200.0,
            "change_amount": 200.0,
            "cashier_name": "Cajero Demo",
            "collected_at": "2026-07-04T11:15:00+00:00",
        },
        "items": [
            {
                "product_name": "Cable USB para radio",
                "quantity": 2,
                "unit_price": 2500.0,
                "subtotal": 5000.0,
                "with_installation": False,
            },
        ],
    }


def sample_sale_for_voucher_preview() -> Dict[str, Any]:
    vehicle = sample_vehicle_for_voucher_preview()
    return {
        "invoice_number": "INV-20260704-0001",
        "created_at": "2026-07-04T10:30:00+00:00",
        "customer_name": "Cliente de Prueba",
        "vehicle_id": vehicle["vehicle_id"],
        "currency": "NIO",
        "exchange_rate": 36.5,
        "subtotal": 7578.20,
        "iva_amount": 1136.73,
        "iva_rate": 0.15,
        "discounts_applied_amount": 700.0,
        "total": 8714.93,
        "net_to_collect": 8714.93,
        "payment_method": "cash",
        "planned_payment_plan": {
            "mode": "cash",
            "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": 8714.93}],
        },
        "applied_discounts": [{"code": "VERANO10", "type": "percent", "value": 10}],
        "items": [
            {
                "product_name": "Radio Android Toyota Universal",
                "quantity": 1,
                "unit_price": 252.0,
                "original_unit_price": 280.0,
                "discount": 10,
                "subtotal": 252.0,
                "with_installation": False,
            },
        ],
    }