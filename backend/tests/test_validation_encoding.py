"""
Tests unitarios para S6: Input Validation y Output Encoding.
MC-LARENS ERP2 - Fase 2 Seguridad P1 (Top 12 #4 y #5).

Verifica:
1. Saneamiento y neutralización de HTML/scripts (strip_html_tags, encode_safe_html, sanitize_text).
2. Validación de identificadores seguros (validate_identifier, mitigación de path traversal y null bytes).
3. Validación de rangos numéricos finitos (validate_numeric_range, rechazo de NaN/Inf).
4. Validación estricta de payloads en endpoints tocados:
   - Ventas (validate_sale_input)
   - Cobro de caja (validate_cashier_collect_input)
   - Anulación de factura (validate_cashier_cancel_input)
   - Login por PIN (validate_pin_login_input)
5. Codificación segura en respuestas JSON (sanitize_output_for_json, build_secure_json_response).
"""
from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.core.validation_encoding import (
    HTTPException,
    build_secure_json_response,
    encode_safe_html,
    sanitize_output_for_json,
    sanitize_text,
    strip_html_tags,
    validate_cashier_cancel_input,
    validate_cashier_collect_input,
    validate_identifier,
    validate_numeric_range,
    validate_pin_login_input,
    validate_sale_input,
)


def test_html_stripping_and_encoding():
    print("Running test_html_stripping_and_encoding...")
    # 1. Strip script tags
    dirty_script = "<script>alert('pwned')</script>Normal Text"
    clean = strip_html_tags(dirty_script)
    assert "<script>" not in clean
    assert "alert" not in clean
    assert clean == "Normal Text"

    # 2. Strip img onerror
    dirty_img = "Hello <img src=x onerror='alert(1)'> World"
    clean_img = strip_html_tags(dirty_img)
    assert "<img" not in clean_img
    assert clean_img == "Hello  World"

    # 3. Strip dangerous javascript: pseudo-protocol
    dirty_proto = "javascript:alert(1)"
    clean_proto = strip_html_tags(dirty_proto)
    assert "javascript:" not in clean_proto

    # 4. Safe HTML encoding
    to_escape = "<b>McLarens & Sons</b> \"VIP\" 'test'"
    escaped = encode_safe_html(to_escape)
    assert "&lt;b&gt;" in escaped
    assert "&amp;" in escaped
    assert "&quot;" in escaped
    assert "&#x27;" in escaped


def test_sanitize_text():
    print("Running test_sanitize_text...")
    # Null bytes removal
    with_null = "Hello\x00World\x00\x00!"
    sanitized = sanitize_text(with_null)
    assert "\x00" not in sanitized
    assert sanitized == "HelloWorld!"

    # HTML tags removal and length clamping
    long_with_html = "<p>Comentario del cliente:</p> " + ("A" * 3000)
    clamped = sanitize_text(long_with_html, max_length=100)
    assert "<p>" not in clamped
    assert len(clamped) <= 100


def test_validate_identifier():
    print("Running test_validate_identifier...")
    # Valid identifiers
    assert validate_identifier("sale_12345", "sale_id") == "sale_12345"
    assert validate_identifier("user-admin.01", "user_id") == "user-admin.01"
    assert validate_identifier("prod_A100", "product_id") == "prod_A100"

    # Path traversal rejected
    traversal_failed = False
    try:
        validate_identifier("../../etc/passwd", "file_id")
    except HTTPException as e:
        traversal_failed = True
        assert e.status_code == 400
    assert traversal_failed

    # Control chars / null bytes rejected
    null_failed = False
    try:
        validate_identifier("sale_\x00_test", "sale_id")
    except HTTPException as e:
        null_failed = True
        assert e.status_code == 400
    assert null_failed

    # Spaces and special characters rejected
    invalid_char_failed = False
    try:
        validate_identifier("sale id with spaces", "sale_id")
    except HTTPException as e:
        invalid_char_failed = True
        assert e.status_code == 400
    assert invalid_char_failed


def test_validate_numeric_range():
    print("Running test_validate_numeric_range...")
    # Valid number
    assert validate_numeric_range(150.5, "price", min_val=0.0, max_val=1000.0) == 150.5

    # NaN rejected
    nan_failed = False
    try:
        validate_numeric_range(float("nan"), "amount")
    except HTTPException as e:
        nan_failed = True
        assert e.status_code == 400
    assert nan_failed

    # Infinity rejected
    inf_failed = False
    try:
        validate_numeric_range(float("inf"), "amount")
    except HTTPException as e:
        inf_failed = True
        assert e.status_code == 400
    assert inf_failed

    # Negative rejected when min_val=0
    neg_failed = False
    try:
        validate_numeric_range(-10.0, "amount", min_val=0.0)
    except HTTPException as e:
        neg_failed = True
        assert e.status_code == 400
    assert neg_failed


def test_validate_sale_input():
    print("Running test_validate_sale_input...")
    # Valid sale payload
    valid_payload = {
        "customer_id": "cust_12345",
        "items": [
            {"product_id": "prod_lamp_01", "quantity": 2, "unit_price": 50.0, "discount": 0.0},
            {"product_id": "prod_harness_02", "quantity": 1, "unit_price": 120.0, "discount": 10.0},
        ],
        "discount": 5.0,
        "notes": "Cliente regular <script>alert(1)</script>",
    }
    clean = validate_sale_input(valid_payload)
    assert clean["customer_id"] == "cust_12345"
    assert len(clean["items"]) == 2
    assert "<script>" not in clean["notes"]
    assert clean["notes"] == "Cliente regular"

    # Reject empty items
    empty_items_failed = False
    try:
        validate_sale_input({"customer_id": "cust_12345", "items": []})
    except HTTPException as e:
        empty_items_failed = True
        assert e.status_code == 400
    assert empty_items_failed

    # Reject non-positive quantity
    bad_qty_failed = False
    try:
        validate_sale_input({
            "customer_id": "cust_12345",
            "items": [{"product_id": "prod_1", "quantity": 0, "unit_price": 10.0}],
        })
    except HTTPException as e:
        bad_qty_failed = True
        assert e.status_code == 400
    assert bad_qty_failed

    # Reject negative unit_price
    bad_price_failed = False
    try:
        validate_sale_input({
            "customer_id": "cust_12345",
            "items": [{"product_id": "prod_1", "quantity": 1, "unit_price": -5.0}],
        })
    except HTTPException as e:
        bad_price_failed = True
        assert e.status_code == 400
    assert bad_price_failed


def test_validate_cashier_collect_input():
    print("Running test_validate_cashier_collect_input...")
    valid_collect = {
        "sesion_id": "caja_ses_99",
        "amount": 250.75,
        "reference": "BAC-TRF-123456",
        "notes": "Pago completo en efectivo <script>",
    }
    clean = validate_cashier_collect_input(valid_collect)
    assert clean["sesion_id"] == "caja_ses_99"
    assert clean["amount"] == 250.75
    assert "<script>" not in clean["notes"]

    # Reject negative amount
    neg_amount_failed = False
    try:
        validate_cashier_collect_input({"sesion_id": "caja_1", "amount": -100.0})
    except HTTPException as e:
        neg_amount_failed = True
        assert e.status_code == 400
    assert neg_amount_failed


def test_validate_cashier_cancel_input():
    print("Running test_validate_cashier_cancel_input...")
    valid_cancel = {
        "motivo": "Error de digitación por el vendedor",
        "justificacion_interna": "El cliente solicitó cambio de producto antes de despachar.",
    }
    clean = validate_cashier_cancel_input(valid_cancel)
    assert clean["motivo"] == "Error de digitación por el vendedor"
    assert "El cliente solicitó cambio" in clean["justificacion_interna"]

    # Reject justification shorter than 20 chars
    short_just_failed = False
    try:
        validate_cashier_cancel_input({"motivo": "Cancel", "justificacion_interna": "Corta"})
    except HTTPException as e:
        short_just_failed = True
        assert e.status_code == 400
    assert short_just_failed


def test_validate_pin_login_input():
    print("Running test_validate_pin_login_input...")
    # Valid PIN
    valid_login = validate_pin_login_input({"pin": "01011990", "user_id": "usr_cajero_01"})
    assert valid_login["pin"] == "01011990"
    assert valid_login["user_id"] == "usr_cajero_01"

    # Reject non-digit PIN
    non_digit_failed = False
    try:
        validate_pin_login_input({"pin": "abcd1234"})
    except HTTPException as e:
        non_digit_failed = True
        assert e.status_code == 400
    assert non_digit_failed

    # Reject short PIN (< 4 digits)
    short_pin_failed = False
    try:
        validate_pin_login_input({"pin": "12"})
    except HTTPException as e:
        short_pin_failed = True
        assert e.status_code == 400
    assert short_pin_failed


def test_output_encoding_and_secure_response():
    print("Running test_output_encoding_and_secure_response...")
    payload_to_encode = {
        "invoice_number": "FAC-00123",
        "notes": "Cliente VIP <script>alert('xss')</script>",
        "items": [
            {"product_name": "Led Strip <b style='color:red;'>Hot</b>", "price": 45.0}
        ],
    }
    sanitized = sanitize_output_for_json(payload_to_encode)
    assert "<script>" not in sanitized["notes"]
    assert "alert" not in sanitized["notes"]
    assert "Cliente VIP" in sanitized["notes"]
    assert "<b" not in sanitized["items"][0]["product_name"]

    response = build_secure_json_response(payload_to_encode)
    assert "application/json" in response.headers.get("content-type", "")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"


def main():
    test_html_stripping_and_encoding()
    print("[OK] test_html_stripping_and_encoding")

    test_sanitize_text()
    print("[OK] test_sanitize_text")

    test_validate_identifier()
    print("[OK] test_validate_identifier")

    test_validate_numeric_range()
    print("[OK] test_validate_numeric_range")

    test_validate_sale_input()
    print("[OK] test_validate_sale_input")

    test_validate_cashier_collect_input()
    print("[OK] test_validate_cashier_collect_input")

    test_validate_cashier_cancel_input()
    print("[OK] test_validate_cashier_cancel_input")

    test_validate_pin_login_input()
    print("[OK] test_validate_pin_login_input")

    test_output_encoding_and_secure_response()
    print("[OK] test_output_encoding_and_secure_response")

    print("\nALL S6 INPUT VALIDATION & OUTPUT ENCODING TESTS PASSED SUCCESSFULLY! (100% OK)")


if __name__ == "__main__":
    main()
