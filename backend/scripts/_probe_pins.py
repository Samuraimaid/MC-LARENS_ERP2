#!/usr/bin/env python3
import requests

API = "http://127.0.0.1:8001/api"
for pin in ["55667788", "01011990", "11223344"]:
    try:
        r = requests.post(f"{API}/auth/pin/login", json={"pin": pin}, timeout=15)
        print(pin, r.status_code, r.text[:300])
    except Exception as e:
        print(pin, "ERR", e)