#!/usr/bin/env python3
import sys
import requests

API = "http://127.0.0.1:8001/api"
s = requests.Session()
s.post(f"{API}/auth/pin/login", json={"pin": "01011990"}, timeout=30).raise_for_status()
sales = s.get(f"{API}/sales", timeout=30).json()
if not sales:
    print("NO_SALES")
    sys.exit(1)
sale = sales[0]
sid = sale["sale_id"]
r = s.get(f"{API}/print/invoice-pdf/{sid}", timeout=30)
print("status", r.status_code, "bytes", len(r.content), "invoice", sale.get("invoice_number"))
if r.status_code != 200 or r.content[:4] != b"%PDF":
    sys.exit(1)
print("OK")