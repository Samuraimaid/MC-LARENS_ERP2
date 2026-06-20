#!/usr/bin/env python3
import json
import requests

API = "http://127.0.0.1:8001/api"
s = requests.Session()
s.post(f"{API}/auth/pin/login", json={"pin": "01011990"}, timeout=30)
r = s.get(f"{API}/permissions/roles", timeout=30)
print("roles perms status", r.status_code)
if r.status_code == 200:
    g = r.json().get("gerencia", {})
    for mod, funcs in g.items():
        if isinstance(funcs, dict) and "users" in funcs:
            print("gerencia users perms in module", mod, funcs["users"])

r2 = s.get(f"{API}/permissions/users/user_d2145542ae48", timeout=30)
print("user perms status", r2.status_code)
if r2.status_code == 200:
    body = r2.json()
    print("has_user_override", body.get("has_user_override"))
    eff = body.get("effective_permissions") or {}
    for mod, funcs in eff.items():
        if isinstance(funcs, dict) and "users" in funcs:
            print("effective users perms", funcs["users"])