"""Thermal invoice barcode/QR rendering."""

from __future__ import annotations

from backend.domains.sales.thermal_invoice_escpos import build_thermal_invoice_escpos


def test_thermal_invoice_includes_barcode_and_qr_commands():
    sale = {
        "sale_id": "sale_trace001",
        "invoice_number": "INV-20260708-0100",
        "created_at": "2026-07-08T12:00:00+00:00",
        "customer_name": "Cliente QA",
        "currency": "NIO",
        "exchange_rate": 37.15,
        "subtotal": 1000.0,
        "total": 1000.0,
        "net_to_collect": 1000.0,
        "payment_status": "paid",
        "items": [{
            "product_name": "Filtro Aire",
            "quantity": 1,
            "unit_price": 1000.0,
            "with_installation": True,
            "installation_price": 5.0,
        }],
        "last_payment_summary": {
            "payment_method": "cash",
            "amount_collected": 1000.0,
        },
    }
    payload = build_thermal_invoice_escpos(sale)
    assert b"\x1d\x6b" in payload
    assert b"\x1d(k" in payload
    assert b"INV-20260708-0100" in payload