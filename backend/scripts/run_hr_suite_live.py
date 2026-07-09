#!/usr/bin/env python3
"""Invoke live HR simulation suite via API or directly."""
from __future__ import annotations

import json
import sys

import httpx

API_BASE = "http://127.0.0.1:8001/api"
PIN_GERENCIA = "01011990"


def _pay_stub_output_has_key_strings(raw: bytes) -> bool:
    text = raw.decode("latin-1", errors="ignore").upper()
    return (
        "MUNDO DE ACCESORIOS" in text
        and "INSS" in text
        and "NETO A PAGAR" in text
    )


def _verify_pay_stub_formats(client: httpx.Client, stub_id: str) -> dict:
    checks: dict = {"stub_id": stub_id}
    thermal = client.get(f"{API_BASE}/hr/pay-stubs/{stub_id}/thermal")
    checks["thermal_status"] = thermal.status_code
    checks["thermal_bytes"] = len(thermal.content or b"")
    checks["thermal_keys_ok"] = (
        thermal.status_code == 200 and _pay_stub_output_has_key_strings(thermal.content or b"")
    )

    mobile = client.get(f"{API_BASE}/hr/pay-stubs/{stub_id}/pdf-mobile")
    checks["pdf_mobile_status"] = mobile.status_code
    checks["pdf_mobile_bytes"] = len(mobile.content or b"")
    checks["pdf_mobile_keys_ok"] = (
        mobile.status_code == 200 and _pay_stub_output_has_key_strings(mobile.content or b"")
    )
    checks["success"] = checks["thermal_keys_ok"] and checks["pdf_mobile_keys_ok"]
    return checks


def main() -> int:
    client = httpx.Client(timeout=300.0, follow_redirects=True)
    login = client.post(f"{API_BASE}/auth/pin/login", json={"pin": PIN_GERENCIA})
    print("login", login.status_code)
    if login.status_code != 200:
        print(login.text[:400])
        return 1

    response = client.post(f"{API_BASE}/qa/run-full-hr-simulation-suite")
    print("suite_status", response.status_code)
    if response.status_code == 404:
        print("Endpoint no desplegado; ejecutando módulo local...")
        from backend.domains.qa.hr_simulation_suite import run_hr_simulation_suite

        report = run_hr_simulation_suite(API_BASE)
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0 if report.get("success") else 2

    try:
        report = response.json()
    except Exception:
        print(response.text[:2000])
        return 2

    print(json.dumps(report, indent=2, ensure_ascii=False))

    stub_id = None
    for case in report.get("cases") or []:
        if case.get("case") == "mundo_accesorios_inss_commissions":
            stub_id = case.get("stub_id")
            break

    if stub_id:
        relogin = client.post(f"{API_BASE}/auth/pin/login", json={"pin": PIN_GERENCIA})
        if relogin.status_code != 200:
            print("relogin_failed", relogin.status_code, relogin.text[:200])
            return 2
        format_checks = _verify_pay_stub_formats(client, str(stub_id))
        print("pay_stub_format_checks", json.dumps(format_checks, indent=2, ensure_ascii=False))
        if not format_checks.get("success"):
            return 2

    return 0 if report.get("success") else 2


if __name__ == "__main__":
    raise SystemExit(main())