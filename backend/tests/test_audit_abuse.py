"""
Tests unitarios para S4 (Audit Logging sin secretos) y C4 (Detección de señales de abuso).
MC-LARENS ERP2 - Fase 2 Seguridad P1.
"""
from __future__ import annotations

import asyncio
import os
import sys
import time
from typing import Any, Dict, List

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.core.audit_log import (
    AbuseSignalTracker,
    record_abuse_signal,
    record_critical_mutation,
    sanitize_for_audit,
)


class MockCollection:
    def __init__(self):
        self.docs: List[Dict[str, Any]] = []

    async def insert_one(self, doc: Dict[str, Any]):
        self.docs.append(dict(doc))
        return type("InsertResult", (), {"inserted_id": doc.get("audit_id") or doc.get("event_id")})()

    async def create_index(self, keys, **kwargs):
        pass


class MockDatabase:
    def __init__(self):
        self.critical_audit_logs = MockCollection()
        self.security_abuse_events = MockCollection()


def test_sanitize_for_audit_scrubs_secrets():
    print("Running test_sanitize_for_audit_scrubs_secrets...")
    raw_payload = {
        "user_id": "usr_12345",
        "pin": "01011990",
        "nested": {
            "session_token": "sess_abcdef1234567890",
            "password": "supersecretpassword",
            "auth_header": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz",
            "normal_field": "Laptop Stand",
            "cvv": "123",
            "card_number": "4111111111111111",
        },
        "list_items": [
            {"product_name": "Speaker", "token": "tok_xyz"},
            {"pin_code": "9999", "amount": 150.0},
        ],
        "bearer_in_text": "Authorization was Bearer token_secret_string here",
    }

    cleaned = sanitize_for_audit(raw_payload)

    # Verificaciones de no fuga de secretos
    assert cleaned["user_id"] == "usr_12345"
    assert cleaned["pin"] == "[REDACTED]"
    assert cleaned["nested"]["session_token"] == "[REDACTED]"
    assert cleaned["nested"]["password"] == "[REDACTED]"
    assert cleaned["nested"]["auth_header"] == "[REDACTED]"
    assert cleaned["nested"]["normal_field"] == "Laptop Stand"
    assert cleaned["nested"]["cvv"] == "[REDACTED]"
    assert cleaned["nested"]["card_number"] == "[REDACTED]"
    assert cleaned["list_items"][0]["token"] == "[REDACTED]"
    assert cleaned["list_items"][1]["pin_code"] == "[REDACTED]"
    assert cleaned["list_items"][1]["amount"] == 150.0
    assert "token_secret_string" not in cleaned["bearer_in_text"]
    assert "Bearer [REDACTED]" in cleaned["bearer_in_text"]
    print("[OK] Sanitization strictly scrubs PINs, tokens, and Bearer headers.")


def test_record_critical_mutation_success_and_fail():
    print("Running test_record_critical_mutation_success_and_fail...")
    db = MockDatabase()

    async def run():
        # 1. Mutación exitosa
        rec_ok = await record_critical_mutation(
            db,
            user_id="user_cajero_1",
            action="CREATE_SALE",
            resource_id="sale_987",
            path="/api/sales",
            status="ok",
            ip="192.168.1.50",
            details={"total": 250.0, "pin": "01011990", "item": "Alarma VIP"},
        )
        assert rec_ok["status"] == "ok"
        assert rec_ok["action"] == "CREATE_SALE"
        assert rec_ok["resource_id"] == "sale_987"
        assert rec_ok["details"]["pin"] == "[REDACTED]"
        assert rec_ok["details"]["total"] == 250.0

        # Verificar guardado en DB
        assert len(db.critical_audit_logs.docs) == 1
        saved_ok = db.critical_audit_logs.docs[0]
        assert saved_ok["action"] == "CREATE_SALE"
        assert saved_ok["status"] == "ok"
        assert saved_ok["details"]["pin"] == "[REDACTED]"

        # 2. Mutación fallida
        rec_fail = await record_critical_mutation(
            db,
            user_id="user_cajero_1",
            action="COLLECT_INVOICE",
            resource_id="sale_987",
            path="/caja/facturas/sale_987/cobrar",
            status="fail",
            ip="192.168.1.50",
            reason="La factura no pertenece a la misma sucursal",
            details={"session_token": "secret_token_123"},
        )
        assert rec_fail["status"] == "fail"
        assert rec_fail["reason"] == "La factura no pertenece a la misma sucursal"
        assert rec_fail["details"]["session_token"] == "[REDACTED]"
        assert len(db.critical_audit_logs.docs) == 2

    asyncio.run(run())
    print("[OK] Critical mutations logged and persisted on both success & failure.")


def test_abuse_signal_tracker_thresholds():
    print("Running test_abuse_signal_tracker_thresholds...")
    db = MockDatabase()
    tracker = AbuseSignalTracker()

    async def run():
        # 1. Probar 401_BURST (umbral 5 en 60s)
        ip = "203.0.113.10"
        for i in range(1, 5):
            is_abuse, count, alert = await tracker.record_signal(
                "401_BURST", identifier=ip, ip=ip, db=db, details={"attempt": i}
            )
            assert is_abuse is False
            assert count == i
            assert alert is None

        # 5to intento: debe disparar alerta de abuso
        is_abuse, count, alert = await tracker.record_signal(
            "401_BURST", identifier=ip, ip=ip, db=db, details={"attempt": 5, "pin": "9999"}
        )
        assert is_abuse is True
        assert count == 5
        assert alert is not None
        assert alert["signal_type"] == "401_BURST"
        assert alert["count"] == 5
        assert alert["details"]["pin"] == "[REDACTED]"

        # Verificar persistencia en base de datos
        assert len(db.security_abuse_events.docs) == 1
        saved_abuse = db.security_abuse_events.docs[0]
        assert saved_abuse["signal_type"] == "401_BURST"
        assert saved_abuse["count"] == 5

        # 2. Probar FINALIZE_FAIL (umbral 3 en 60s)
        user_key = "usr_tamperer"
        is_abuse, count, _ = await tracker.record_signal("FINALIZE_FAIL", user_key, db=db)
        assert is_abuse is False
        assert count == 1

        is_abuse, count, _ = await tracker.record_signal("FINALIZE_FAIL", user_key, db=db)
        assert is_abuse is False
        assert count == 2

        is_abuse, count, alert2 = await tracker.record_signal(
            "FINALIZE_FAIL", user_key, db=db, details={"reason": "TOTAL_MISMATCH"}
        )
        assert is_abuse is True
        assert count == 3
        assert alert2["signal_type"] == "FINALIZE_FAIL"
        assert len(db.security_abuse_events.docs) == 2

        # 3. Probar limpieza y ventana temporal
        tracker.reset_key("FINALIZE_FAIL", user_key)
        assert tracker.get_count("FINALIZE_FAIL", user_key) == 0

    asyncio.run(run())
    print("[OK] Abuse signal tracker detects 401 bursts and finalize failures accurately.")


if __name__ == "__main__":
    test_sanitize_for_audit_scrubs_secrets()
    test_record_critical_mutation_success_and_fail()
    test_abuse_signal_tracker_thresholds()
    print("\nALL S4 & C4 AUDIT AND ABUSE TESTS PASSED SUCCESSFULLY! (100% OK)")
