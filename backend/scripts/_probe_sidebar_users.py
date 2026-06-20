#!/usr/bin/env python3
import json
import requests

API = "http://127.0.0.1:8001/api"
s = requests.Session()
login = s.post(f"{API}/auth/pin/login", json={"pin": "01011990"}, timeout=30)
print("login", login.status_code, login.json().get("user", {}).get("role"))

me = s.get(f"{API}/permissions/me", timeout=30).json()
perms = me.get("effective_permissions") or {}


def has_permission(function_key, action="view"):
    for module_value in perms.values():
        if not isinstance(module_value, dict):
            continue
        function_perms = module_value.get(function_key)
        if isinstance(function_perms, dict):
            return bool(function_perms.get(action))
    return False


print("hasPermission(users, view)", has_permission("users", "view"))
print("administracion.users", perms.get("administracion", {}).get("users"))

# mimic fetchData
users_res = s.get(f"{API}/users", timeout=30)
branches_res = s.get(f"{API}/branches", timeout=30)
warehouses_res = s.get(f"{API}/warehouses", timeout=30)
print("/users", users_res.status_code)
print("/branches", branches_res.status_code)
print("/warehouses", warehouses_res.status_code)
if users_res.status_code == 200:
    pin_users = [u for u in users_res.json() if u.get("is_pin_user")]
    print("pin users for table", len(pin_users))