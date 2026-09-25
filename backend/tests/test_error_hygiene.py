"""
Pruebas Unitarias para S3 (Error Hygiene sin Stack en Producción).
MC-LARENS ERP2 - Suite de Verificación Automática.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.core.error_handler import (
    build_sanitized_error_payload,
    http_exception_handler,
    unhandled_exception_handler,
    HTTPException,
)


class MockRequest:
    def __init__(self, path="/api/sales", method="POST"):
        self.url = type("URL", (), {"path": path})()
        self.method = method


def test_build_sanitized_error_payload():
    payload = build_sanitized_error_payload(
        error_code="TEST_ERROR",
        message="Mensaje seguro de error",
        status_code=400,
        path="/api/test",
    )
    assert payload["error"] == "TEST_ERROR"
    assert payload["message"] == "Mensaje seguro de error"
    assert payload["status_code"] == 400
    assert payload["path"] == "/api/test"


async def async_test_unhandled_exception_no_stack():
    req = MockRequest(path="/api/critical/money-operation", method="POST")

    # Simular una falla crítica con datos sensibles en la traza
    try:
        raise ZeroDivisionError("division by zero in database calculation at /app/backend/internal_engine.py:442")
    except Exception as exc:
        simulated_exc = exc

    response = await unhandled_exception_handler(req, simulated_exc)

    # Verificar que el status sea 500
    assert response.status_code == 500

    body_bytes = getattr(response, "body", None)
    if body_bytes:
        raw_content = body_bytes.decode()
        data = json.loads(raw_content)
    else:
        # Fallback a inspección directa de content si no fue renderizado por Starlette
        data = getattr(response, "content", {})
        raw_content = json.dumps(data)

    # Verificaciones de Higiene Estricta
    assert data["error"] == "INTERNAL_SERVER_ERROR"
    assert data["status_code"] == 500
    assert "Ha ocurrido un error interno" in data["message"]

    # NUNCA debe haber trazas, nombres de archivo internos ni palabras de traceback
    assert "Traceback" not in raw_content
    assert "division by zero in database calculation" not in raw_content
    assert ".py:" not in raw_content
    assert "internal_engine" not in raw_content


async def async_test_http_exception_clean_format():
    req = MockRequest(path="/api/auth/pin/login", method="POST")

    # 1. HTTPException con detalle de texto
    exc1 = HTTPException(status_code=401, detail="PIN incorrecto")
    resp1 = await http_exception_handler(req, exc1)
    assert resp1.status_code == 401

    # 2. HTTPException con diccionario estructurado (ej. 409 TOTAL_MISMATCH)
    exc2 = HTTPException(
        status_code=409,
        detail={"error": "TOTAL_MISMATCH", "expected": 100.0, "submitted": 80.0},
    )
    resp2 = await http_exception_handler(req, exc2)
    assert resp2.status_code == 409


def run_all():
    print("Running test_build_sanitized_error_payload...")
    test_build_sanitized_error_payload()

    print("Running async_test_unhandled_exception_no_stack...")
    asyncio.run(async_test_unhandled_exception_no_stack())

    print("Running async_test_http_exception_clean_format...")
    asyncio.run(async_test_http_exception_clean_format())

    print("\nALL S3 ERROR HYGIENE TESTS PASSED SUCCESSFULLY! (100% OK)")


if __name__ == "__main__":
    run_all()
