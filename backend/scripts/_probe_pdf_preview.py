#!/usr/bin/env python3
import sys
import requests

API = "http://127.0.0.1:8001/api"
s = requests.Session()
s.post(f"{API}/auth/pin/login", json={"pin": "01011990"}, timeout=30).raise_for_status()

for kind in ["invoice_pending", "invoice_paid", "quotation"]:
    r = s.get(f"{API}/settings/billing/pdf-documents/preview", params={"kind": kind}, timeout=30)
    print(kind, r.status_code, len(r.content), r.content[:4])
    if r.status_code != 200 or r.content[:4] != b"%PDF":
        sys.exit(1)
print("OK")