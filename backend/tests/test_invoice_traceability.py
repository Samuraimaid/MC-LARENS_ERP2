"""Invoice barcode/QR traceability parsing."""

from __future__ import annotations

import json

from backend.domains.sales.invoice_traceability import (
    build_invoice_qr_payload,
    parse_invoice_scan_input,
)


def test_build_qr_payload_json():
    payload = build_invoice_qr_payload(sale_id="sale_abc123", invoice_number="inv-20260708-0001")
    data = json.loads(payload)
    assert data["invoice_id"] == "sale_abc123"
    assert data["invoice_number"] == "INV-20260708-0001"


def test_parse_barcode_scan():
    parsed = parse_invoice_scan_input("INV-20260708-0042")
    assert parsed["valid"] is True
    assert parsed["scan_type"] == "barcode"
    assert parsed["invoice_number"] == "INV-20260708-0042"


def test_parse_qr_json_scan():
    raw = json.dumps({"invoice_id": "sale_deadbeef", "invoice_number": "INV-20260708-0099"})
    parsed = parse_invoice_scan_input(raw)
    assert parsed["valid"] is True
    assert parsed["scan_type"] == "qr_json"
    assert parsed["sale_id"] == "sale_deadbeef"


def test_parse_sale_id_scan():
    parsed = parse_invoice_scan_input("sale_abc123456789")
    assert parsed["valid"] is True
    assert parsed["scan_type"] == "sale_id"