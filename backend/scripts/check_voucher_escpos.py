#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.domains.sales.seller_voucher_escpos import (  # noqa: E402
    build_seller_voucher_escpos,
    build_seller_voucher_text_lines,
)

API = "http://127.0.0.1:3000/api"
OUT = ROOT / "voucher_escpos_debug.txt"


def main() -> None:
    session = requests.Session()
    login = session.post(f"{API}/auth/pin/login", json={"pin": "01011990"}, timeout=10)
    login.raise_for_status()
    session.cookies.set("session_token", login.json().get("session_token"))

    sale = session.get(f"{API}/sales", timeout=15).json()[0]
    settings = session.get(
        f"{API}/settings/billing/seller-voucher",
        params={"branch_id": sale.get("branch_id", "branch_main")},
        timeout=10,
    ).json()["seller_voucher"]

    lines = build_seller_voucher_text_lines(sale, voucher_settings=settings)
    esc = build_seller_voucher_escpos(sale, text_lines=lines, voucher_settings=settings)
    text = esc.decode("ascii", "ignore")
    OUT.write_text(text, encoding="utf-8")

    markers = [
        "MUNDO DE ACCESORIOS",
        "VOUCHER DE VENTA",
        "Vehiculo:",
        "Placa:",
        "ESCANEAR EN CAJA",
        "Valido hasta",
        "NO ES FACTURA",
        str(sale.get("invoice_number") or ""),
    ]
    report = [
        f"text_len={len(text)}",
        f"barcode_cmd={bytes([0x1D, 0x6B, 0x49]) in esc}",
        f"top_feed_8={esc.count(bytes([0x1B, 0x64, 8]))}",
    ]
    for marker in markers:
        report.append(f"{marker}={marker in text}")
    (ROOT / "voucher_escpos_report.txt").write_text("\n".join(report), encoding="utf-8")


if __name__ == "__main__":
    main()