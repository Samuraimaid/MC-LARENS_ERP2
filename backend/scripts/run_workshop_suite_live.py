#!/usr/bin/env python3
"""Invoke live workshop simulation suite via API or directly."""
from __future__ import annotations

import json
import sys

import httpx

API_BASE = "http://127.0.0.1:8001/api"
PIN_GERENCIA = "01011990"


def main() -> int:
    client = httpx.Client(timeout=300.0, follow_redirects=True)
    login = client.post(f"{API_BASE}/auth/pin/login", json={"pin": PIN_GERENCIA})
    print("login", login.status_code)
    if login.status_code != 200:
        print(login.text[:400])
        return 1

    response = client.post(f"{API_BASE}/qa/run-full-workshop-simulation-suite")
    print("suite_status", response.status_code)
    if response.status_code == 404:
        print("Endpoint no desplegado; ejecutando módulo local...")
        from backend.domains.qa.workshop_simulation_suite import run_workshop_simulation_suite

        report = run_workshop_simulation_suite(API_BASE)
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0 if report.get("success") else 2

    try:
        report = response.json()
    except Exception:
        print(response.text[:2000])
        return 2

    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report.get("success") else 2


if __name__ == "__main__":
    raise SystemExit(main())