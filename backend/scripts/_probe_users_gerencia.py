#!/usr/bin/env python3
import json
import requests

API = "http://127.0.0.1:8001/api"
s = requests.Session()
r = s.post(f"{API}/auth/pin/login", json={"pin": "01011990"}, timeout=30)
print("login", r.status_code)
if r.status_code != 200:
    print(r.text[:500])
    raise SystemExit(1)

user = r.json().get("user") or {}
print("user_id", user.get("user_id"), "role", user.get("role"), "name", user.get("name"))

for path in ["/users", "/permissions/me", "/branches", "/users/pin/kiosk-table"]:
    rr = s.get(f"{API}{path}", timeout=30)
    print(f"{path} -> {rr.status_code}")
    if rr.status_code != 200:
        print(rr.text[:300])
    elif path == "/users":
        data = rr.json()
        print("users count", len(data))
        print("is_pin_user true", sum(1 for x in data if x.get("is_pin_user")))
        print("is_pin_user false", sum(1 for x in data if not x.get("is_pin_user")))
        if data:
            print("first user keys", list(data[0].keys()))
            print("first user", json.dumps(data[0], ensure_ascii=False)[:400])
    elif path == "/permissions/me":
        perms = rr.json().get("effective_permissions") or {}
        users_perm = None
        for mod in perms.values():
            if isinstance(mod, dict) and "users" in mod:
                users_perm = mod["users"]
                break
        print("users permissions", users_perm)