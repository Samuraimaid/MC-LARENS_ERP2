#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.domains.sales.seller_voucher_escpos import build_seller_voucher_escpos  # noqa: E402

API = "http://127.0.0.1:3000/api"


def main() -> None:
    session = requests.Session()
    login = session.post(f"{API}/auth/pin/login", json={"pin": "01011990"}, timeout=10)
    login.raise_for_status()
    session.cookies.set("session_token", login.json().get("session_token"))

    sale = session.get(f"{API}/sales", timeout=15).json()[0]
    sale_id = sale["sale_id"]
    settings = session.get(
        f"{API}/settings/billing/seller-voucher",
        params={"branch_id": sale.get("branch_id", "branch_main")},
        timeout=10,
    ).json()["seller_voucher"]

    api_lines = session.get(f"{API}/print/seller-voucher/{sale_id}", timeout=15).text.splitlines()
    esc = build_seller_voucher_escpos(sale, text_lines=api_lines, voucher_settings=settings)
    text = esc.decode("ascii", "ignore")

    markers = ["Vehiculo:", "Placa:", "MUNDO DE ACCESORIOS", "VOUCHER DE VENTA", "ESCANEAR EN CAJA"]
    report = [f"{m}={m in text}" for m in markers]
    report.append(f"align_center_cmd={bytes([0x1B, 0x61, 0x01]) in esc}")
    report.append("API_LINES_HAS_VEHICLE=" + str(any("Vehiculo:" in l for l in api_lines)))
    report.append("API_LINES_HAS_PLATE=" + str(any("Placa:" in l for l in api_lines)))
    (ROOT / "voucher_escpos_api_report.txt").write_text("\n".join(report), encoding="utf-8")
    (ROOT / "voucher_escpos_api_debug.txt").write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()