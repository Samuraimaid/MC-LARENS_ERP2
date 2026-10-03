"""
Unit tests for Multi-Window ERP Navigation, Cross-Window Session Bus, and Concurrent Login Revocation.
MC-LARENS ERP2 - Multi-Window & Tab Productivity Suite
"""
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List
import unittest

from backend.domains.auth.session_policy import (
    default_session_policy,
    validate_session_freshness,
    idle_minutes_for_role,
    ttl_hours_for_role,
)
from backend.core.session_security import (
    invalidate_user_sessions,
    revoke_user_sessions_for_concurrent_login,
    invalidate_session_token,
    check_session_validity,
)


class MockCollection:
    def __init__(self, data: List[Dict[str, Any]] = None):
        self.docs = data or []

    async def find_one(self, query: Dict[str, Any], projection: Dict[str, Any] = None):
        for doc in self.docs:
            match = True
            for k, v in query.items():
                if isinstance(v, dict):
                    if "$ne" in v and doc.get(k) == v["$ne"]:
                        match = False
                        break
                    if "$lt" in v and not (doc.get(k, "") < v["$lt"]):
                        match = False
                        break
                elif doc.get(k) != v:
                    match = False
                    break
            if match:
                return dict(doc)
        return None

    async def insert_one(self, doc: Dict[str, Any]):
        self.docs.append(dict(doc))
        return type("Result", (), {"inserted_id": doc.get("session_token", "id_123")})()

    async def update_many(self, query: Dict[str, Any], update: Dict[str, Any]):
        count = 0
        set_vals = update.get("$set", {})
        for doc in self.docs:
            match = True
            for k, v in query.items():
                if isinstance(v, dict):
                    if "$ne" in v and doc.get(k) == v["$ne"]:
                        match = False
                        break
                elif doc.get(k) != v:
                    match = False
                    break
            if match:
                doc.update(set_vals)
                count += 1
        return type("Result", (), {"modified_count": count})()

    async def delete_many(self, query: Dict[str, Any]):
        initial_len = len(self.docs)
        self.docs = [d for d in self.docs if not all(d.get(k) == v for k, v in query.items() if not isinstance(v, dict))]
        return type("Result", (), {"deleted_count": initial_len - len(self.docs)})()


class MockDB:
    def __init__(self):
        self.sessions = MockCollection()
        self.users = MockCollection()


class TestMultiWindowAndSessionSecurity(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = MockDB()
        self.user_id = "usr_vendedor_01"
        self.role = "ventas"
        self.token = "sess_multiwin_test_token_12345"

        now = datetime.now(timezone.utc)
        self.session_doc = {
            "session_token": self.token,
            "user_id": self.user_id,
            "role": self.role,
            "created_at": now.isoformat(),
            "last_seen_at": now.isoformat(),
            "expires_at": (now + timedelta(hours=12)).isoformat(),
            "idle_minutes": 30,
            "ttl_hours": 12,
            "ip": "192.168.1.50",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0",
        }
        await self.db.sessions.insert_one(self.session_doc)

    async def test_multi_window_same_token_concurrent_validity(self):
        """Verifica que múltiples ventanas/pestañas con el mismo token operan concurrentemente sin conflicto."""
        # Simular Ventana 1 (Ventas), Ventana 2 (Inventario), Ventana 3 (Caja) en el mismo PC
        endpoints = ["/api/sales", "/api/inventory", "/api/cashier/status", "/api/customers"]
        
        for ep in endpoints:
            sess = await self.db.sessions.find_one({"session_token": self.token})
            self.assertIsNotNone(sess, f"La sesión debe existir al consultar desde {ep}")
            is_valid, code, msg = check_session_validity(sess, role=self.role)
            self.assertTrue(is_valid, f"La sesión debe ser 100% válida para {ep}")
            self.assertIsNone(code)

    async def test_logout_in_one_window_invalidates_all_windows(self):
        """Verifica que al hacer logout en una ventana, el token se destruye para todas las ventanas del PC."""
        # 1. Ventana 1 emite logout
        deleted = await invalidate_session_token(self.db, self.token, reason="logout")
        self.assertEqual(deleted, 1)

        # 2. Ventana 2 (Inventario) intenta hacer una consulta posterior
        sess_window_2 = await self.db.sessions.find_one({"session_token": self.token})
        self.assertIsNone(sess_window_2, "La sesión ya no debe existir en DB para ninguna ventana del PC")

    async def test_concurrent_login_from_another_pc_revokes_previous_session(self):
        """Verifica que si el usuario inicia sesión en otra máquina (PC B), la sesión del PC A se revoca con SESSION_CONFLICT."""
        new_pc_ip = "192.168.1.99"
        new_pc_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/128.0"

        # Simular login en PC B
        revoked_count = await revoke_user_sessions_for_concurrent_login(
            self.db,
            user_id=self.user_id,
            ip=new_pc_ip,
            user_agent=new_pc_ua,
        )
        self.assertEqual(revoked_count, 1)

        # Consultar la sesión previa desde el PC A
        sess_pc_a = await self.db.sessions.find_one({"session_token": self.token})
        self.assertIsNotNone(sess_pc_a)
        self.assertTrue(sess_pc_a.get("revoked"))
        self.assertEqual(sess_pc_a.get("revoked_reason"), "concurrent_login")
        self.assertEqual(sess_pc_a.get("revoked_by_ip"), new_pc_ip)

        # Validación de frescura y revocación
        is_fresh, code, msg = check_session_validity(sess_pc_a, role=self.role)
        self.assertFalse(is_fresh)
        self.assertEqual(code, "SESSION_CONFLICT")
        self.assertIn("otro dispositivo", msg)

    def test_session_bus_event_types(self):
        """Verifica los tipos y contratos de eventos esperados por el frontend sessionBus."""
        valid_events = ["LOGOUT", "SESSION_CONFLICT", "SESSION_IDLE_TIMEOUT", "SESSION_EXPIRED", "LOGIN_SUCCESS"]
        
        sample_payload = {
            "type": "SESSION_CONFLICT",
            "payload": {"message": "Tu sesión se inició en otro dispositivo o terminal."},
            "timestamp": 1727960000000,
            "senderId": "win_xyz123",
        }
        
        self.assertIn(sample_payload["type"], valid_events)
        self.assertIsInstance(sample_payload["timestamp"], int)
        self.assertTrue(sample_payload["senderId"].startswith("win_"))


if __name__ == "__main__":
    unittest.main()
