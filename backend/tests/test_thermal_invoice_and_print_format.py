"""Print format (IVA -> letter) and thermal invoice with change info."""

from __future__ import annotations

from backend.domains.export.pdf_documents import _build_payment_detail_rows
from backend.domains.sales.thermal_invoice_escpos import build_thermal_invoice_text_lines
from backend.server import _build_sale_settlement, _sale_has_iva, _sale_print_format


class TestPrintFormatFromIva:
    def test_iva_forces_letter_format(self):
        settlement = _build_sale_settlement(
            subtotal_base=1000.0,
            discount_percent=0.0,
            discounts_amount=0.0,
            promotions_amount=0.0,
            payment_method="cash",
            print_format="thermal80",
            apply_iva=True,
            iva_rate_percent=15.0,
            retention_profile="exento",
            retention_rate_hint=None,
        )
        assert settlement["iva_amount"] > 0
        assert settlement["print_format"] == "letter"

    def test_no_iva_keeps_thermal80(self):
        settlement = _build_sale_settlement(
            subtotal_base=1000.0,
            discount_percent=0.0,
            discounts_amount=0.0,
            promotions_amount=0.0,
            payment_method="cash",
            print_format="thermal80",
            apply_iva=False,
            iva_rate_percent=15.0,
            retention_profile="exento",
            retention_rate_hint=None,
        )
        assert settlement["iva_amount"] == 0
        assert settlement["print_format"] == "thermal80"

    def test_sale_has_iva_helper(self):
        assert _sale_has_iva({"iva_amount": 150.0}) is True
        assert _sale_has_iva({"iva_amount": 0, "apply_iva": False}) is False
        assert _sale_print_format({"iva_amount": 0, "apply_iva": False}) == "thermal80"
        assert _sale_print_format({"iva_amount": 120.0}) == "letter"


class TestThermalInvoiceChangeLines:
    def test_change_and_received_on_thermal_invoice(self):
        sale = {
            "invoice_number": "INV-20260706-0001",
            "created_at": "2026-07-06T10:00:00+00:00",
            "customer_name": "Cliente Test",
            "currency": "NIO",
            "exchange_rate": 36.5,
            "subtotal": 5000.0,
            "iva_amount": 0.0,
            "apply_iva": False,
            "total": 5000.0,
            "net_to_collect": 5000.0,
            "payment_method": "cash",
            "payment_status": "paid",
            "last_payment_summary": {
                "payment_method": "cash",
                "amount_collected": 5000.0,
                "received_amount": 5200.0,
                "change_amount": 200.0,
                "cashier_name": "Maria Cajera",
                "collected_at": "2026-07-06T10:05:00+00:00",
            },
            "items": [
                {
                    "product_name": "Cable USB",
                    "quantity": 1,
                    "unit_price": 5000.0,
                    "subtotal": 5000.0,
                }
            ],
        }
        lines = build_thermal_invoice_text_lines(sale)
        joined = "\n".join(lines)
        assert "Recibido:" in joined
        assert "Cambio:" in joined
        assert "C$ 200.00" in joined
        assert "Maria Cajera" in joined
        assert "COBRO REALIZADO" in joined or "Cobrado:" in joined


class TestLetterPdfPaymentRows:
    def test_payment_detail_rows_include_change(self):
        rows = _build_payment_detail_rows(
            {
                "payment_status": "paid",
                "received_amount": 5200.0,
                "change_amount": 200.0,
                "cashier_name": "Maria Cajera",
            },
            {},
            "NIO",
        )
        labels = [row[0] for row in rows]
        assert any(label.startswith("Recibido:") for label in labels)
        assert any(label.startswith("Cambio:") for label in labels)
        assert any(label.startswith("Cajero:") for label in labels)