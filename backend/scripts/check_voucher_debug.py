#!/usr/bin/env python3
"""Debug seller voucher settings vs printed lines."""
from __future__ import annotations

import json
import sys

import requests

API = "http://127.0.0.1:3000/api"
OUT = "voucher_debug_out.txt"


def main() -> int:
    lines: list[str] = []

    def log(msg: str) -> None:
        lines.append(msg)

    session = requests.Session()
    try:
        login = session.post(f"{API}/auth/pin/login", json={"pin": "01011990"}, timeout=10)
        log(f"login_status={login.status_code}")
        if login.status_code != 200:
            log(login.text[:500])
            Path_write(lines)
            return 1

        token = login.json().get("session_token")
        if token:
            session.cookies.set("session_token", token)

        settings_resp = session.get(
            f"{API}/settings/billing/seller-voucher",
            params={"branch_id": "branch_main"},
            timeout=10,
        )
        log(f"settings_status={settings_resp.status_code}")
        if settings_resp.status_code == 200:
            sections = settings_resp.json().get("seller_voucher", {}).get("sections", {})
            enabled = sorted(k for k, v in sections.items() if v)
            disabled = sorted(k for k, v in sections.items() if not v)
            log("ENABLED=" + json.dumps(enabled, ensure_ascii=False))
            log("DISABLED=" + json.dumps(disabled, ensure_ascii=False))
            log("FULL_SETTINGS=" + json.dumps(settings_resp.json().get("seller_voucher", {}), ensure_ascii=False))

        sales_resp = session.get(f"{API}/sales", timeout=15)
        log(f"sales_status={sales_resp.status_code}")
        if sales_resp.status_code == 200 and sales_resp.json():
            sale = sales_resp.json()[0]
            sale_id = sale.get("sale_id")
            log(f"sale_id={sale_id} vehicle_id={sale.get('vehicle_id')}")
            voucher_resp = session.get(f"{API}/print/seller-voucher/{sale_id}", timeout=15)
            log(f"voucher_status={voucher_resp.status_code}")
            log("VOUCHER_LINES_BEGIN")
            log(voucher_resp.text)
            log("VOUCHER_LINES_END")
    except Exception as exc:
        log(f"ERROR={exc}")

    Path_write(lines)
    return 0


def Path_write(lines: list[str]) -> None:
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    (root / OUT).write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())