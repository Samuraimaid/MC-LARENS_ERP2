#!/usr/bin/env python3
import sys
import requests

BASES = [
    "http://127.0.0.1:3000/api",
    "http://127.0.0.1:8001/api",
]

for API in BASES:
    print(f"\n=== {API} ===")
    s = requests.Session()
    try:
        login = s.post(f"{API}/auth/pin/login", json={"pin": "01011990"}, timeout=15)
        print("login", login.status_code, "cookie", bool(s.cookies.get("session_token")))
    except Exception as exc:
        print("login error", exc)
        continue

    billing = s.get(f"{API}/settings/billing", timeout=15)
    print("billing", billing.status_code, billing.headers.get("content-type"), billing.text[:120])

    preview = s.get(
        f"{API}/settings/billing/pdf-documents/preview",
        params={"kind": "invoice_pending"},
        timeout=30,
    )
    print(
        "preview",
        preview.status_code,
        preview.headers.get("content-type"),
        len(preview.content),
        preview.content[:20],
    )
    if preview.status_code == 200 and preview.content[:4] == b"%PDF":
        print("preview OK via", API)
        sys.exit(0)

print("FAILED")
sys.exit(1)