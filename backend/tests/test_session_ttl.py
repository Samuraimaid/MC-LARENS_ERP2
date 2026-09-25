"""
Tests unitarios para Case C2: Session Idle TTL e Invalidación de Sesiones.
MC-LARENS ERP2 - Fase 2 Seguridad P1.

Verifica:
1. Idle TTL para cajero (8-12h, default 10h = 600m) vs piso/ventas (5m).
2. Absolute TTL expiry para roles (cajero 12h, gerencia 4h).
3. Invalidación de sesiones al cerrar turno de caja (caja_cierre).
4. Invalidación de sesiones al cambiar rol/privilegios de usuario (role_change).
"""
from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.core.session_security import (
    check_session_validity,
    invalidate_session_token,
    invalidate_user_sessions,
)
from backend.domains.auth.session_policy import default_session_policy


class MockSessionCollection:
    def __init__(self):
        self.sessions: List[Dict[str, Any]] = []

    async def delete_many(self, query: Dict[str, Any]):
        initial_count = len(self.sessions)
        if "user_id" in query:
            target_uid = str(query["user_id"])
            self.sessions = [s for s in self.sessions if str(s.get("user_id")) != target_uid]
        elif "session_token" in query:
            target_tok = str(query["session_token"])
            self.sessions = [s for s in self.sessions if str(s.get("session_token")) != target_tok]
        deleted_count = initial_count - len(self.sessions)
        return type("DeleteResult", (), {"deleted_count": deleted_count})()


class MockDatabase:
    def __init__(self):
        self.sessions = MockSessionCollection()


def test_cashier_idle_window_8_to_12_hours():
    """Prueba que el cajero soporta periodos de inactividad de turno (hasta 10h = 600 min)."""
    print("Running test_cashier_idle_window_8_to_12_hours...")
    now = datetime.now(timezone.utc)
    policy = default_session_policy()

    # Sesion cajero con 4 horas de inactividad -> Valida
    sess_4h = {
        "user_id": "cajero_01",
        "expires_at": (now + timedelta(hours=6)).isoformat(),
        "last_seen_at": (now - timedelta(hours=4)).isoformat(),
    }
    ok, code, msg = check_session_validity(sess_4h, role="cajero", policy=policy, now=now)
    assert ok is True
    assert code is None

    # Sesion cajero con 8 horas de inactividad -> Valida (cubre jornada regular continua)
    sess_8h = {
        "user_id": "cajero_01",
        "expires_at": (now + timedelta(hours=4)).isoformat(),
        "last_seen_at": (now - timedelta(hours=8)).isoformat(),
    }
    ok, code, msg = check_session_validity(sess_8h, role="cajero", policy=policy, now=now)
    assert ok is True
    assert code is None

    # Sesion cajero con mas de 10 horas de inactividad (601 min) -> Expira por inactividad
    sess_10h_plus = {
        "user_id": "cajero_01",
        "expires_at": (now + timedelta(hours=2)).isoformat(),
        "last_seen_at": (now - timedelta(minutes=601)).isoformat(),
    }
    ok, code, msg = check_session_validity(sess_10h_plus, role="cajero", policy=policy, now=now)
    assert ok is False
    assert code == "SESSION_IDLE_TIMEOUT"
    assert "cajero" in (msg or "").lower() or "600" in (msg or "")


def test_ventas_floor_idle_5_min():
    """Prueba que piso/kiosco de ventas expira a los 5 minutos de inactividad."""
    print("Running test_ventas_floor_idle_5_min...")
    now = datetime.now(timezone.utc)
    policy = default_session_policy()

    # 4 minutos de inactividad -> Valida
    sess_4m = {
        "user_id": "vendedor_01",
        "expires_at": (now + timedelta(hours=8)).isoformat(),
        "last_seen_at": (now - timedelta(minutes=4)).isoformat(),
    }
    ok, code, msg = check_session_validity(sess_4m, role="ventas", policy=policy, now=now)
    assert ok is True
    assert code is None

    # 6 minutos de inactividad -> Expira por inactividad
    sess_6m = {
        "user_id": "vendedor_01",
        "expires_at": (now + timedelta(hours=8)).isoformat(),
        "last_seen_at": (now - timedelta(minutes=6)).isoformat(),
    }
    ok, code, msg = check_session_validity(sess_6m, role="ventas", policy=policy, now=now)
    assert ok is False
    assert code == "SESSION_IDLE_TIMEOUT"


def test_absolute_ttl_expiry():
    """Prueba que aun activa recientemente, si pasa el TTL absoluto expira."""
    print("Running test_absolute_ttl_expiry...")
    now = datetime.now(timezone.utc)
    policy = default_session_policy()

    # Sesion con actividad hace 1 segundo pero expires_at en el pasado
    sess_expired = {
        "user_id": "gerencia_01",
        "expires_at": (now - timedelta(seconds=1)).isoformat(),
        "last_seen_at": now.isoformat(),
    }
    ok, code, msg = check_session_validity(sess_expired, role="gerencia", policy=policy, now=now)
    assert ok is False
    assert code == "SESSION_EXPIRED"


async def test_invalidate_user_sessions_shift_close():
    """Prueba que al cerrar turno en caja se revocan las sesiones del cajero."""
    print("Running test_invalidate_user_sessions_shift_close...")
    db = MockDatabase()
    db.sessions.sessions = [
        {"session_token": "tok_cajero_1", "user_id": "usr_cashier_01"},
        {"session_token": "tok_cajero_2", "user_id": "usr_cashier_01"},
        {"session_token": "tok_other_user", "user_id": "usr_seller_02"},
    ]

    deleted = await invalidate_user_sessions(db, "usr_cashier_01", reason="caja_cierre")
    assert deleted == 2
    assert len(db.sessions.sessions) == 1
    assert db.sessions.sessions[0]["user_id"] == "usr_seller_02"


async def test_invalidate_user_sessions_role_change():
    """Prueba que al cambiar el rol/privilegios de un usuario se revocan sus sesiones."""
    print("Running test_invalidate_user_sessions_role_change...")
    db = MockDatabase()
    db.sessions.sessions = [
        {"session_token": "tok_elevated_1", "user_id": "usr_promoted_01"},
        {"session_token": "tok_other_user", "user_id": "usr_seller_02"},
    ]

    deleted = await invalidate_user_sessions(db, "usr_promoted_01", reason="role_change")
    assert deleted == 1
    assert len(db.sessions.sessions) == 1
    assert db.sessions.sessions[0]["user_id"] == "usr_seller_02"


async def test_invalidate_session_token_logout():
    """Prueba revocar un token individual de sesion."""
    print("Running test_invalidate_session_token_logout...")
    db = MockDatabase()
    db.sessions.sessions = [
        {"session_token": "tok_logout_target", "user_id": "usr_01"},
        {"session_token": "tok_stay_active", "user_id": "usr_01"},
    ]

    deleted = await invalidate_session_token(db, "tok_logout_target", reason="user_logout")
    assert deleted == 1
    assert len(db.sessions.sessions) == 1
    assert db.sessions.sessions[0]["session_token"] == "tok_stay_active"


def main():
    test_cashier_idle_window_8_to_12_hours()
    print("[OK] test_cashier_idle_window_8_to_12_hours")

    test_ventas_floor_idle_5_min()
    print("[OK] test_ventas_floor_idle_5_min")

    test_absolute_ttl_expiry()
    print("[OK] test_absolute_ttl_expiry")

    asyncio.run(test_invalidate_user_sessions_shift_close())
    print("[OK] test_invalidate_user_sessions_shift_close")

    asyncio.run(test_invalidate_user_sessions_role_change())
    print("[OK] test_invalidate_user_sessions_role_change")

    asyncio.run(test_invalidate_session_token_logout())
    print("[OK] test_invalidate_session_token_logout")

    print("\nALL C2 SESSION SECURITY TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    main()
