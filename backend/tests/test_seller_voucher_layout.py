"""Voucher layout: Share Tech Mono PDF, breakdown parity, plan format."""

from __future__ import annotations

from backend.domains.sales.seller_voucher_escpos import (
    VOUCHER_WIDTH,
    build_seller_voucher_escpos,
    build_seller_voucher_text_lines,
    format_voucher_money,
)


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
        assert "Efectivo: C$ 8,000.00" in joined
        assert "Transferencia: C$ 3,753.00" in joined
        assert "Subtotal:" in joined
        assert "TOTAL:" in joined

    def test_long_product_name_wraps(self):
        lines = build_seller_voucher_text_lines(_sample_sale())
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