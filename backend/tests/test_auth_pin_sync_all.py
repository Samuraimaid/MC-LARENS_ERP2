import asyncio
from typing import Optional
import unittest

ROLE_EQUIVALENCE = {}


def resolve_effective_role(role: Optional[str]) -> str:
    if not role:
        return ""
    return ROLE_EQUIVALENCE.get(role, role)


class MockUser:
    def __init__(self, user_id: str, role: str):
        self.user_id = user_id
        self.role = role


def mock_require_roles(user: Optional[MockUser], allowed_roles):
    if not user:
        return {"status_code": 401, "detail": "Unauthorized"}
    user_effective = resolve_effective_role(user.role)
    allowed_effective = [resolve_effective_role(r) for r in allowed_roles]
    if user_effective not in allowed_effective:
        return {"status_code": 403, "detail": "Forbidden"}
    return {"status_code": 200, "user": user}


async def mock_manual_sync_pin_users(user: Optional[MockUser]):
    auth_check = mock_require_roles(user, ["gerencia", "programador"])
    if auth_check["status_code"] != 200:
        return auth_check
    return {"status_code": 200, "status": "ok", "users_count": 76}


class TestAuthPinSyncAll(unittest.TestCase):
    def test_sync_all_unauthenticated_returns_401(self):
        res = asyncio.run(mock_manual_sync_pin_users(None))
        self.assertEqual(res["status_code"], 401)
        self.assertEqual(res["detail"], "Unauthorized")

    def test_sync_all_non_gerencia_returns_403(self):
        for role in ["vendedor", "cajero", "instalaciones", "bodegas", "entregador", "recursos_humanos"]:
            user = MockUser(user_id=f"user_{role}", role=role)
            res = asyncio.run(mock_manual_sync_pin_users(user))
            self.assertEqual(res["status_code"], 403, f"Role {role} should have been forbidden (403)")
            self.assertEqual(res["detail"], "Forbidden")

    def test_sync_all_gerencia_succeeds_200(self):
        user = MockUser(user_id="user_gerencia", role="gerencia")
        res = asyncio.run(mock_manual_sync_pin_users(user))
        self.assertEqual(res["status_code"], 200)
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["users_count"], 76)

    def test_sync_all_programador_succeeds_200(self):
        user = MockUser(user_id="user_prog", role="programador")
        res = asyncio.run(mock_manual_sync_pin_users(user))
        self.assertEqual(res["status_code"], 200)
        self.assertEqual(res["status"], "ok")


if __name__ == "__main__":
    unittest.main()
