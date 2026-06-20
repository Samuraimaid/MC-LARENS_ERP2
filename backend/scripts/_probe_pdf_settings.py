#!/usr/bin/env python3
import sys
import requests

API = "http://127.0.0.1:8001/api"
s = requests.Session()
s.post(f"{API}/auth/pin/login", json={"pin": "01011990"}, timeout=30).raise_for_status()

r = s.get(f"{API}/settings/billing", timeout=30)
print("GET billing", r.status_code)
if r.status_code != 200:
    print(r.text[:500])
    sys.exit(1)

data = r.json()
pdf_docs = data.get("pdf_documents")
if not pdf_docs:
    print("MISSING pdf_documents in GET /settings/billing — reinicia el backend")
    sys.exit(1)

print("pdf_documents keys", sorted(pdf_docs.keys()))
put = s.put(
    f"{API}/settings/billing/pdf-documents",
    json={"watermark_opacity": 0.12, "theme_colors": {"invoice_paid": "#22C55E"}},
    timeout=30,
)
print("PUT pdf-documents", put.status_code)
if put.status_code != 200:
    print(put.text[:500])
    sys.exit(1)

saved = put.json().get("pdf_documents") or {}
print("saved opacity", saved.get("watermark_opacity"), "paid color", saved.get("theme_colors", {}).get("invoice_paid"))
print("OK")