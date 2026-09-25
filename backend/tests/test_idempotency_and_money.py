"""
Pruebas Unitarias para S1 (Idempotencia) y C1 (Validación de Dinero en Servidor).
MC-LARENS ERP2 - Suite de Verificación Automática.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import os
import sys
from typing import Any, Dict

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.core.idempotency import (
    build_idempotency_scope,
    check_idempotency,
    clear_idempotency_on_failure,
    complete_idempotency_operation,
    extract_idempotency_key,
    start_idempotency_operation,
)
from backend.core.money_validate import (
    enforce_server_settlement_total,
    recalculate_item_subtotal,
    validate_sale_item_money,
)


class MockRequest:
    def __init__(self, headers: Dict[str, str]):
        self.headers = headers


class MockCollection:
    def __init__(self):
        self.docs = {}

    async def find_one(self, filter_dict, projection=None):
        scope = filter_dict.get("scope")
        key = filter_dict.get("key")
        k = f"{scope}:{key}"
        doc = self.docs.get(k)
        if doc:
            return dict(doc)
        return None

    async def insert_one(self, doc):
        scope = doc.get("scope")
        key = doc.get("key")
        k = f"{scope}:{key}"
        if k in self.docs:
            raise Exception("DuplicateKeyError: E11000")
        self.docs[k] = dict(doc)

    async def update_one(self, filter_dict, update_dict, upsert=False):
        scope = filter_dict.get("scope")
        key = filter_dict.get("key")
        k = f"{scope}:{key}"
        doc = self.docs.get(k, {})
        if "$set" in update_dict:
            doc.update(update_dict["$set"])
        if "$setOnInsert" in update_dict and k not in self.docs:
            doc.update(update_dict["$setOnInsert"])
        self.docs[k] = doc

    async def delete_one(self, filter_dict):
        scope = filter_dict.get("scope")
        key = filter_dict.get("key")
        k = f"{scope}:{key}"
        self.docs.pop(k, None)


class MockDB:
    def __init__(self):
        self.idempotency_records = MockCollection()


def test_extract_idempotency_key():
    # 1. From standard Idempotency-Key header
    req = MockRequest({"Idempotency-Key": "idemp-header-123"})
    assert extract_idempotency_key(req) == "idemp-header-123"

    # 2. From X-Idempotency-Key header
    req2 = MockRequest({"X-Idempotency-Key": "x-idemp-456"})
    assert extract_idempotency_key(req2) == "x-idemp-456"

    # 3. From payload key fallback
    assert extract_idempotency_key(None, payload_key="body-key-789") == "body-key-789"

    # 4. From draft_id fallback
    assert extract_idempotency_key(None, draft_id="draft-abc") == "draft:draft-abc"

    # 5. Empty
    assert extract_idempotency_key(None) is None


def test_money_validation_items():
    # Valid item
    qty, disc, price = validate_sale_item_money({"quantity": 3, "discount": 15.0, "unit_price": 25.5})
    assert qty == 3
    assert disc == 15.0
    assert price == 25.5

    # Negative quantity
    try:
        validate_sale_item_money({"quantity": -1, "discount": 0})
        assert False, "Should have raised exception on negative qty"
    except Exception as exc:
        assert "mayor a cero" in str(exc)

    # Quantity 0
    try:
        validate_sale_item_money({"quantity": 0, "discount": 0})
        assert False, "Should have raised exception on zero qty"
    except Exception as exc:
        assert "mayor a cero" in str(exc)

    # Excessive quantity
    try:
        validate_sale_item_money({"quantity": 99999, "discount": 0})
        assert False, "Should have raised exception on excessive qty"
    except Exception as exc:
        assert "Cantidad excesiva" in str(exc)

    # Negative discount
    try:
        validate_sale_item_money({"quantity": 1, "discount": -10.0})
        assert False, "Should have raised exception on negative discount"
    except Exception as exc:
        assert "no puede ser negativo" in str(exc)

    # Discount > 100%
    try:
        validate_sale_item_money({"quantity": 1, "discount": 105.0})
        assert False, "Should have raised exception on discount > 100"
    except Exception as exc:
        assert "no puede superar el 100%" in str(exc)

    # Negative unit price
    try:
        validate_sale_item_money({"quantity": 1, "discount": 0, "unit_price": -5.0})
        assert False, "Should have raised exception on negative unit_price"
    except Exception as exc:
        assert "no puede ser negativo" in str(exc)


def test_server_settlement_total_enforcement():
    # Matching total within tolerance (e.g. 100.00 vs 100.02)
    assert enforce_server_settlement_total(100.00, 100.02) == 100.00

    # Total when client sends None -> server total governs
    assert enforce_server_settlement_total(250.75, None) == 250.75

    # Tampered client total (e.g. client sends 80.00 when server expects 100.00)
    try:
        enforce_server_settlement_total(100.00, 80.00)
        assert False, "Should have rejected tampered client total"
    except Exception as exc:
        # Check details
        assert "TOTAL_MISMATCH" in str(exc)


def test_recalculate_item_subtotal():
    # Base: 100 * 2 = 200, discount 10% = 180, install 15 * 2 = 30 -> 210.0
    subtotal = recalculate_item_subtotal(unit_price=100.0, quantity=2, discount_pct=10.0, installation_price=15.0)
    assert subtotal == 210.0


async def async_test_idempotency_flow():
    db = MockDB()
    scope = build_idempotency_scope("/api/sales", user_id="user_123")
    key = "idem-key-test-abc"

    # Step 1: Initial check should be empty
    is_dup, res = await check_idempotency(db, scope, key)
    assert is_dup is False
    assert res is None

    # Step 2: Start operation
    acquired = await start_idempotency_operation(db, scope, key, user_id="user_123")
    assert acquired is True

    # Step 3: Check while in progress -> should raise 409
    try:
        await check_idempotency(db, scope, key)
        assert False, "Should have raised 409 when in progress"
    except Exception as exc:
        assert "Operación en proceso" in str(exc) or "409" in str(exc)

    # Step 4: Complete operation
    mock_sale = {"sale_id": "sale_789", "total_amount": 150.0, "status": "completed"}
    await complete_idempotency_operation(db, scope, key, mock_sale, status_code=200, user_id="user_123")

    # Step 5: Second attempt with identical key -> returns cached response!
    is_dup2, res2 = await check_idempotency(db, scope, key)
    assert is_dup2 is True
    assert res2["sale_id"] == "sale_789"
    assert res2["total_amount"] == 150.0


def run_all():
    print("Running test_extract_idempotency_key...")
    test_extract_idempotency_key()

    print("Running test_money_validation_items...")
    test_money_validation_items()

    print("Running test_server_settlement_total_enforcement...")
    test_server_settlement_total_enforcement()

    print("Running test_recalculate_item_subtotal...")
    test_recalculate_item_subtotal()

    print("Running async_test_idempotency_flow...")
    asyncio.run(async_test_idempotency_flow())

    print("\nALL S1 & C1 TESTS PASSED SUCCESSFULLY! (100% OK)")


if __name__ == "__main__":
    run_all()
