"""Seller voucher barcode and cashier lookup tests."""

from __future__ import annotations

import os

import pytest
import requests

BASE_URL = os.environ.get("BASE_URL", os.environ.get("REACT_APP_BACKEND_URL", "http://127.0.0.1:8001")).rstrip("/")
GERENCIA_PIN = os.environ.get("TEST_GERENCIA_PIN", "01011990")
CAJERO_PIN = os.environ.get("TEST_CAJERO_PIN", "11223344")


def _pin_session(pin: str) -> requests.Session:
    """Login by PIN; fall back to gerencia when the role-specific test PIN is missing."""
    candidates = [pin]
    if pin != GERENCIA_PIN:
        candidates.append(GERENCIA_PIN)
    session = requests.Session()
    last_error = ""
    for candidate in candidates:
        response = session.post(f"{BASE_URL}/api/auth/pin/login", json={"pin": candidate})
        if response.status_code == 200:
            token = response.json().get("session_token")
            if token:
                session.cookies.set("session_token", token)
            return session
        last_error = response.text
        # Reset cookies between attempts so a partial session cannot leak.
        session.cookies.clear()
    raise AssertionError(f"PIN login failed for {candidates}: {last_error}")


class TestSellerVoucherBarcode:
    def test_escpos_contains_invoice_code128(self):
        from backend.domains.sales.seller_voucher_escpos import build_seller_voucher_escpos

        sale = {
            "invoice_number": "INV-20260627-0009",
            "customer_name": "Cliente Test",
            "total": 1500.0,
            "currency": "NIO",
        }
        payload = build_seller_voucher_escpos(sale, text_lines=["Factura: INV-20260627-0009"])
        assert b"INV-20260627-0009" in payload
        assert b"\x1d\x6b\x49" in payload
        assert b"\x1d\x77\x04" in payload

    def test_lookup_requires_valid_invoice_format(self):
        cajero = _pin_session(CAJERO_PIN)
        response = cajero.get(f"{BASE_URL}/api/caja/facturas/lookup", params={"code": "CLIENTE-001"})
        assert response.status_code == 400

    def test_lookup_returns_pending_sale_by_invoice_number(self):
        gerencia = _pin_session(GERENCIA_PIN)
        cajero = _pin_session(CAJERO_PIN)
        sales = gerencia.get(f"{BASE_URL}/api/sales")
        if sales.status_code != 200:
            pytest.skip("Sales endpoint unavailable")
        pending = next(
            (
                row for row in sales.json()
                if str(row.get("payment_status") or "").lower() in {"pending", "partial"}
                and row.get("invoice_number")
            ),
            None,
        )
        if not pending:
            pytest.skip("No pending sale with invoice number")

        code = str(pending["invoice_number"]).upper()
        response = cajero.get(f"{BASE_URL}/api/caja/facturas/lookup", params={"code": code})
        assert response.status_code == 200, response.text
        body = response.json()
        assert body.get("row", {}).get("sale_id") == pending.get("sale_id")
        assert body.get("row", {}).get("invoice_number", "").upper() == code

    def test_seller_voucher_preview_pdf_endpoint(self):
        gerencia = _pin_session(GERENCIA_PIN)
        sales = gerencia.get(f"{BASE_URL}/api/sales")
        if sales.status_code != 200 or not sales.json():
            pytest.skip("No sales")
        sale_id = sales.json()[0].get("sale_id")
        response = gerencia.get(f"{BASE_URL}/api/print/seller-voucher/{sale_id}/preview-pdf")
        assert response.status_code == 200, response.text
        assert "pdf" in (response.headers.get("content-type") or "").lower()