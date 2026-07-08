"""Letter invoice PDF must show NIO amounts when sale currency is NIO (DB prices in USD)."""

from __future__ import annotations

from backend.domains.export.pdf_documents import (
    _compute_discount_breakdown,
    _line_gross_amount,
    _line_net_amount,
    _pdf_convert_amount,
    _pdf_normalize_items_for_currency,
    _pdf_settlement_subtotal,
)


def _sample_sale_item() -> dict:
    return {
        "product_name": "Canastero de Techo Universal",
        "quantity": 1,
        "unit_price": 273.972603,
        "original_unit_price": 280,
        "discount": 0,
        "subtotal": 273.972603,
    }


def _sample_totals() -> dict:
    return {
        "subtotal": 273.97,
        "tax": 1500,
        "iva_amount": 1500,
        "total": 11500,
        "total_legal": 11500,
        "discount": 0,
        "discounts_applied_amount": 0,
    }


class TestPdfInvoiceCurrency:
    def test_convert_usd_line_to_nio(self):
        rate = 36.5
        item = _pdf_normalize_items_for_currency([_sample_sale_item()], "NIO", rate)[0]
        assert _line_gross_amount(item) == 10000.0
        assert _line_net_amount(item) == 10000.0

    def test_settlement_subtotal_uses_legal_total_minus_iva(self):
        subtotal = _pdf_settlement_subtotal(_sample_totals(), "NIO", 36.5)
        assert subtotal == 10000.0

    def test_breakdown_matches_invoice_totals(self):
        rate = 36.5
        items = _pdf_normalize_items_for_currency([_sample_sale_item()], "NIO", rate)
        breakdown = _compute_discount_breakdown(
            items,
            _sample_totals(),
            currency="NIO",
            exchange_rate=rate,
        )
        assert breakdown["gross_before_line"] == 10000.0
        assert breakdown["subtotal"] == 10000.0

    def test_usd_sale_keeps_amounts(self):
        assert _pdf_convert_amount(280, "USD", 36.5) == 280.0