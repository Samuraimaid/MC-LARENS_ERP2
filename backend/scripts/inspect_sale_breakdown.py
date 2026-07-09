#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

import requests

API = "http://127.0.0.1:3000/api"
OUT = Path(__file__).resolve().parents[2] / "sale_breakdown_inspect.txt"


def main() -> None:
    session = requests.Session()
    login = session.post(f"{API}/auth/pin/login", json={"pin": "01011990"}, timeout=10)
    login.raise_for_status()
    session.cookies.set("session_token", login.json().get("session_token"))

    sales = session.get(f"{API}/sales", timeout=15).json()
    lines_out: list[str] = []
    for sale in sales[:5]:
        lines_out.append(f"=== {sale.get('invoice_number')} ===")
        lines_out.append(
            json.dumps(
                {
                    "discount": sale.get("discount"),
                    "discounts_applied_amount": sale.get("discounts_applied_amount"),
                    "applied_discounts": sale.get("applied_discounts"),
                    "subtotal": sale.get("subtotal"),
                    "items": [
                        {
                            "product_name": (item or {}).get("product_name"),
                            "quantity": (item or {}).get("quantity"),
                            "unit_price": (item or {}).get("unit_price"),
                            "original_unit_price": (item or {}).get("original_unit_price"),
                            "discount": (item or {}).get("discount"),
                            "subtotal": (item or {}).get("subtotal"),
                        }
                        for item in (sale.get("items") or [])
                    ],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        voucher = session.get(f"{API}/print/seller-voucher/{sale.get('sale_id')}", timeout=15).text
        lines_out.append("--- voucher ---")
        lines_out.append(voucher)
        lines_out.append("")

    OUT.write_text("\n".join(lines_out), encoding="utf-8")


if __name__ == "__main__":
    main()