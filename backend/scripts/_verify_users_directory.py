#!/usr/bin/env python3
import sys
import requests

API = "http://127.0.0.1:8001/api"
s = requests.Session()
s.post(f"{API}/auth/pin/login", json={"pin": "01011990"}, timeout=30).raise_for_status()

r = s.get(f"{API}/users/directory", params={"search": "xin", "limit": 10}, timeout=30)
print("search xin", r.status_code, "total", r.json().get("total"), "rows", len(r.json().get("rows", [])))

r2 = s.get(f"{API}/users/directory", params={"role": "ventas", "limit": 5}, timeout=30)
print("role ventas", r2.status_code, "total", r2.json().get("total"))

r3 = s.get(f"{API}/users/directory", params={"branch_id": "branch_main", "limit": 5}, timeout=30)
print("branch main", r3.status_code, "total", r3.json().get("total"))

r4 = s.get(f"{API}/users/directory", params={"limit": 2, "offset": 2}, timeout=30)
body4 = r4.json()
print("offset 2", r4.status_code, "offset", body4.get("offset"), "rows", len(body4.get("rows", [])), "has_more", body4.get("has_more"))

r5 = s.get(f"{API}/users/directory", params={"has_overrides": "true", "limit": 10}, timeout=30)
print("has_overrides true", r5.status_code, "total", r5.json().get("total"))

if any(code != 200 for code in [r.status_code, r2.status_code, r3.status_code, r4.status_code, r5.status_code]):
    sys.exit(1)
print("OK users directory")