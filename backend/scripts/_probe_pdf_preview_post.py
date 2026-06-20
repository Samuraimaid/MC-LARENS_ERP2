#!/usr/bin/env python3
import sys
import requests

API = "http://127.0.0.1:3000/api"
s = requests.Session()
s.post(f"{API}/auth/pin/login", json={"pin": "01011990"}, timeout=30).raise_for_status()

r = s.post(
    f"{API}/settings/billing/pdf-documents/preview",
    json={
        "kind": "invoice_pending",
        "pdf_documents": {
            "watermark_enabled": True,
            "watermark_opacity": 0.14,
            "theme_colors": {"invoice_pending": "#1D4ED8"},
        },
    },
    timeout=30,
)
print("POST preview", r.status_code, r.headers.get("content-type"), len(r.content), r.content[:4])
if r.status_code != 200 or r.content[:4] != b"%PDF":
    sys.exit(1)
print("OK")