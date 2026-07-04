"""Seller voucher configurable layout tests."""

from __future__ import annotations

from backend.domains.sales.seller_voucher_escpos import build_seller_voucher_escpos, build_seller_voucher_text_lines
from backend.domains.sales.voucher_settings import (
    DEFAULT_SELLER_VOUCHER_SETTINGS,
    merge_seller_voucher_settings,
    normalize_seller_voucher_settings,
)


def test_normalize_seller_voucher_settings_defaults():
    settings = normalize_seller_voucher_settings(None)
    assert settings["top_feed_lines"] == DEFAULT_SELLER_VOUCHER_SETTINGS["top_feed_lines"]
    assert settings["left_margin_chars"] == DEFAULT_SELLER_VOUCHER_SETTINGS["left_margin_chars"]
    assert settings["texts"]["scan_label"] == "ESCANEAR EN CAJA"
    assert settings["sections"]["breakdown_gross_subtotal"] is True
    assert settings["sections"]["breakdown_iva"] is True
    assert settings["sections"]["breakdown_total"] is True


def test_merge_seller_voucher_settings_updates_texts_and_sections():
    merged = merge_seller_voucher_settings(
        normalize_seller_voucher_settings({}),
        {
            "texts": {"scan_label": "ESCANEAR FACTURA"},
            "sections": {"payment_plan": False, "vehicle": False},
            "top_feed_lines": 10,
        },
    )
    assert merged["texts"]["scan_label"] == "ESCANEAR FACTURA"
    assert merged["sections"]["payment_plan"] is False
    assert merged["sections"]["breakdown_iva"] is True
    assert merged["top_feed_lines"] == 10


def test_merge_seller_voucher_settings_updates_breakdown_row_sections():
    merged = merge_seller_voucher_settings(
        normalize_seller_voucher_settings({}),
        {"sections": {"breakdown_iva": False, "breakdown_line_discount": False}},
    )
    assert merged["sections"]["breakdown_iva"] is False
    assert merged["sections"]["breakdown_line_discount"] is False
    assert merged["sections"]["breakdown_total"] is True


def test_custom_scan_label_in_escpos_footer():
    sale = {
        "invoice_number": "INV-20260704-0001",
        "customer_name": "Cliente",
        "total": 100.0,
        "currency": "NIO",
        "items": [],
    }
    settings = normalize_seller_voucher_settings(
        {"texts": {"scan_label": "ESCANEAR FACTURA"}, "sections": {"items": False, "breakdown": False}}
    )
    payload = build_seller_voucher_escpos(sale, voucher_settings=settings)
    text = payload.decode("ascii", errors="ignore")
    assert "ESCANEAR FACTURA" in text
    assert "ESCANEAR EN CAJA" not in text


def test_hidden_customer_section_omits_customer_line():
    sale = {
        "invoice_number": "INV-20260704-0002",
        "customer_name": "Cliente Oculto",
        "total": 50.0,
        "currency": "NIO",
        "items": [{"product_name": "Producto", "quantity": 1, "unit_price": 50}],
    }
    settings = normalize_seller_voucher_settings({"sections": {"customer": False}})
    lines = build_seller_voucher_text_lines(sale, voucher_settings=settings)
    joined = "\n".join(lines)
    assert "Cliente Oculto" not in joined
    assert "Producto" in joined