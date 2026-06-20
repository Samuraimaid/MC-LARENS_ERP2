#!/usr/bin/env python3
"""Verify role vs user permission workflow (delta storage)."""
from __future__ import annotations

import json
import sys

import requests

API = "http://127.0.0.1:8001/api"


def login_gerencia() -> requests.Session:
    session = requests.Session()
    response = session.post(f"{API}/auth/pin/login", json={"pin": "01011990"}, timeout=30)
    response.raise_for_status()
    return session


def pick_ventas_user(session: requests.Session) -> str:
    users = session.get(f"{API}/users", timeout=30).json()
    for row in users:
        if row.get("role") == "ventas" and row.get("is_pin_user"):
            return str(row["user_id"])
    raise RuntimeError("No ventas pin user found")


def main() -> int:
    session = login_gerencia()
    user_id = pick_ventas_user(session)

    before = session.get(f"{API}/permissions/users/{user_id}", timeout=30).json()
    role_perms = before["role_permissions"]
    effective = before["effective_permissions"]

    # Toggle one permission off if currently on, else on.
    target = json.loads(json.dumps(effective))
    module_key = "ventas"
    function_key = "sales"
    action = "create"
    current = bool(target[module_key][function_key][action])
    target[module_key][function_key][action] = not current

    put = session.put(
        f"{API}/permissions/users/{user_id}",
        json={"effective_permissions": target},
        timeout=30,
    )
    if put.status_code != 200:
        print("FAIL put user permissions", put.status_code, put.text[:300])
        return 1

    body = put.json()
    overlay = body.get("user_permissions") or {}
    if not overlay:
        print("FAIL expected sparse user_permissions overlay")
        return 1

    after = session.get(f"{API}/permissions/users/{user_id}", timeout=30).json()
    saved_value = bool(after["effective_permissions"][module_key][function_key][action])
    if saved_value != (not current):
        print("FAIL effective permission not persisted", saved_value, not current)
        return 1

    role_value = bool(role_perms[module_key][function_key][action])
    if saved_value == role_value:
        print("FAIL user effective equals role after intentional override")
        return 1

    # Reset
    delete = session.delete(f"{API}/permissions/users/{user_id}", timeout=30)
    if delete.status_code != 200:
        print("FAIL reset user permissions", delete.status_code, delete.text[:200])
        return 1

    final = session.get(f"{API}/permissions/users/{user_id}", timeout=30).json()
    if final.get("has_user_overrides"):
        print("FAIL overrides remain after reset")
        return 1

    final_value = bool(final["effective_permissions"][module_key][function_key][action])
    if final_value != role_value:
        print("FAIL user did not inherit role after reset", final_value, role_value)
        return 1

    print(f"OK: permisos por usuario guardan solo delta para {user_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())