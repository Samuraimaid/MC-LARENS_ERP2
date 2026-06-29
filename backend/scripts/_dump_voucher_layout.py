#!/usr/bin/env python3
import requests
from backend.domains.sales.seller_voucher_escpos import build_seller_voucher_escpos

s = requests.Session()
r = s.post("http://127.0.0.1:8001/api/auth/pin/login", json={"pin": "01011990"})
token = r.json().get("session_token")
if token:
    s.cookies.set("session_token", token)
sales = s.get("http://127.0.0.1:8001/api/sales").json()
sale = sales[0]
lines = s.get(f"http://127.0.0.1:8001/api/print/seller-voucher/{sale['sale_id']}").text.splitlines()
payload = build_seller_voucher_escpos(sale, text_lines=lines)
text = "".join(chr(b) if 32 <= b < 127 or b in (10, 13) else "\n" for b in payload)
with open("/app/backend/data/_voucher_escpos.txt", "w", encoding="utf-8") as fh:
    fh.write(text)
print("written", len(payload), "bytes")