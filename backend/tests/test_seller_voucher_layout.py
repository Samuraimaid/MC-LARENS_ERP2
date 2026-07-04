"""Voucher layout: Share Tech Mono PDF, breakdown parity, plan format."""

from __future__ import annotations

from backend.domains.sales.seller_voucher_escpos import (
    VOUCHER_WIDTH,
    build_seller_voucher_escpos,
    build_seller_voucher_text_lines,
    format_voucher_money,
)
from backend.domains.sales.voucher_settings import normalize_seller_voucher_settings


def _sample_sale() -> dict:
    return {
        "invoice_number": "INV-20260627-0099",
        "created_at": "2026-06-27T13:35:09+00:00",
        "customer_name": "Mario Augusto Flores",
        "currency": "NIO",
        "exchange_rate": 36.5,
        "subtotal": 11753.0,
        "iva_amount": 1762.95,
        "iva_rate": 0.15,
        "discounts_applied_amount": 0,
        "total": 13515.95,
        "net_to_collect": 13515.95,
        "payment_method": "mixed",
        "planned_payment_plan": {
            "mode": "mixed",
            "lines": [
                {"metodo": "cash", "moneda": "NIO", "monto_origen": 8000.0},
                {"metodo": "transfer", "moneda": "NIO", "monto_origen": 3753.0},
            ],
        },
        "items": [
            {
                "product_name": 'Radio Android 10" Toyota Universal Bluetooth CarPlay',
                "quantity": 1,
                "unit_price": 252.0,
                "subtotal": 252.0,
                "with_installation": False,
            },
        ],
    }


class TestSellerVoucherLayout:
    def test_money_format_uses_symbol_and_commas(self):
        assert format_voucher_money(8000, "NIO") == "C$ 8,000.00"
        assert format_voucher_money(120.5, "USD") == "US$ 120.50"

    def test_lines_use_full_width_without_article_header(self):
        lines = build_seller_voucher_text_lines(_sample_sale())
        assert all(len(line) <= VOUCHER_WIDTH for line in lines if line)
        joined = "\n".join(lines)
        assert "Inst:" not in joined
        assert "ARTICULO" not in joined
        assert "Pago:" not in joined
        assert "2026-06-27 13:35" in joined or "2026-06-27" in joined
        assert "Plan acordado" not in joined
        assert "Metodo de pago acordado:" in joined
        assert "Efectivo: C$ 8,000.00" in joined
        assert "Transferencia: C$ 3,753.00" in joined
        assert "Subtotal:" in joined
        assert "TOTAL:" in joined

    def test_long_product_name_wraps(self):
        sale = {
            **_sample_sale(),
            "items": [
                {
                    **(_sample_sale()["items"][0]),
                    "product_name": (
                        'Radio Android 10" Toyota Universal Bluetooth CarPlay '
                        "con pantalla tactil y camara de reversa incluida"
                    ),
                },
            ],
        }
        lines = build_seller_voucher_text_lines(sale)
        start = next(i for i, line in enumerate(lines) if "Radio Android" in line)
        detail_idx = next(i for i, line in enumerate(lines) if line.strip().startswith("x"))
        assert detail_idx - start >= 2

    def test_escpos_has_single_header_and_footer(self):
        sale = _sample_sale()
        payload = build_seller_voucher_escpos(sale)
        text = payload.decode("ascii", errors="ignore")
        assert text.count("MUNDO DE ACCESORIOS") == 1
        assert text.count("ESCANEAR EN CAJA") == 1
        assert "C$ 8,000.00" in text
        assert b"\x1bM\x01" in payload
        assert b"\x1bd\x08" in payload

    def test_escpos_starts_with_top_margin_feed(self):
        payload = build_seller_voucher_escpos(_sample_sale())
        init_idx = payload.find(b"\x1b\x40")
        font_b_idx = payload.find(b"\x1bM\x01")
        top_feed_idx = payload.find(b"\x1bd\x08")
        assert init_idx == 0
        assert 0 < font_b_idx < top_feed_idx
        text = payload.decode("ascii", errors="ignore")
        assert "MUNDO DE ACCESORIOS" in text
        assert text.index("MUNDO DE ACCESORIOS") < text.index("VOUCHER DE VENTA")

    def _discount_breakdown_sale(self):
        return {
            **_sample_sale(),
            "subtotal": 9000.0,
            "discounts_applied_amount": 1500.0,
            "total": 12015.0,
            "net_to_collect": 12015.0,
            "iva_amount": 1350.0,
            "applied_discounts": [
                {"code": "VERANO10", "type": "percent", "value": 10},
            ],
            "items": [
                {
                    "product_name": "Radio Android Toyota",
                    "quantity": 1,
                    "unit_price": 252.0,
                    "original_unit_price": 280.0,
                    "discount": 10,
                    "installation_price": 0,
                    "with_installation": False,
                },
            ],
        }

    def test_breakdown_shows_line_global_and_code_discounts(self):
        sale = self._discount_breakdown_sale()
        lines = build_seller_voucher_text_lines(sale)
        joined = "\n".join(lines)
        assert "Subtotal sin descuentos:" in joined
        assert "Descuento linea 10%" in joined
        assert "Descuento precio" in joined
        assert "Descuento codigo VERANO10" in joined
        assert "Descuento global:" in joined
        assert "Subtotal:" in joined

    def test_breakdown_row_sections_hide_individual_lines(self):
        sale = self._discount_breakdown_sale()
        settings = normalize_seller_voucher_settings(
            {
                "sections": {
                    "breakdown_iva": False,
                    "breakdown_line_discount": False,
                    "breakdown_code_discount": False,
                },
            },
        )
        joined = "\n".join(build_seller_voucher_text_lines(sale, voucher_settings=settings))
        assert "Descuento linea 10%" not in joined
        assert "Descuento codigo VERANO10" not in joined
        assert "IVA (" not in joined
        assert "Subtotal sin descuentos:" in joined
        assert "TOTAL:" in joined

    def test_breakdown_master_switch_hides_all_breakdown_lines(self):
        sale = self._discount_breakdown_sale()
        settings = normalize_seller_voucher_settings({"sections": {"breakdown": False}})
        joined = "\n".join(build_seller_voucher_text_lines(sale, voucher_settings=settings))
        assert "Subtotal sin descuentos:" not in joined
        assert "IVA (" not in joined
        assert "TOTAL:" not in joined

    def test_total_amount_row_is_monospace_aligned(self):
        lines = build_seller_voucher_text_lines(_sample_sale())
        total_line = next(line for line in lines if line.strip().startswith("TOTAL:"))
        money = total_line.strip().split()[-1]
        assert total_line.rstrip().endswith(money)
        assert "  " in total_line

    def test_credit_sale_shows_agreed_payment_method_without_plan(self):
        sale = {
            **_sample_sale(),
            "payment_method": "credit",
            "payment_type": "credit",
            "credit_days": 30,
            "planned_payment_plan": None,
        }
        joined = "\n".join(build_seller_voucher_text_lines(sale))
        assert "Metodo de pago acordado:" in joined
        assert "Credito (30 dias)" in joined

    def test_title_lines_use_printer_centering_not_space_padding(self):
        from backend.domains.sales.seller_voucher_escpos import build_seller_voucher_lines

        rendered = build_seller_voucher_lines(_sample_sale())
        company = next(line for line in rendered if "MUNDO DE ACCESORIOS" in line.text)
        assert company.text == company.text.strip()
        assert company.centered is True