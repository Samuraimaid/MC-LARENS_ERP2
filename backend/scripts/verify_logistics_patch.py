"""Quick verification for purchase-receipt and transfer-request patches."""

from __future__ import annotations

import sys

import requests

BASE = "http://localhost:8001/api"


def main() -> int:
    session_resp = requests.post(
        f"{BASE}/test/create-session",
        json={
            "email": "test.admin@mundodeaccesorios.com",
            "name": "Test Admin",
            "role": "gerencia",
        },
        timeout=15,
    )
    print("session", session_resp.status_code)
    if session_resp.status_code != 200:
        print(session_resp.text)
        return 1

    cookies = {"session_token": session_resp.json().get("session_token")}

    transfer_resp = requests.post(
        f"{BASE}/inventory/transfer-request",
        json={
            "product_id": "prod_demo_001",
            "from_warehouse_id": "wh_main",
            "to_warehouse_id": "wh_topcar_calvario",
            "quantity": 1,
            "reason": "verify json body",
            "sale_pending": True,
        },
        cookies=cookies,
        timeout=15,
    )
    print("transfer-request", transfer_resp.status_code, transfer_resp.text[:400])

    products_resp = requests.get(f"{BASE}/products", cookies=cookies, timeout=15)
    product_id = None
    if products_resp.status_code == 200:
        products = products_resp.json()
        if isinstance(products, list) and products:
            product_id = products[0].get("product_id")

    if not product_id:
        print("skip purchase-receipt: no product found")
        return 0 if transfer_resp.status_code == 200 else 1

    purchase_resp = requests.post(
        f"{BASE}/inventory/purchase-receipt",
        json={
            "supplier_name": "Proveedor QA",
            "warehouse_id": "wh_main",
            "items": [
                {"product_id": product_id, "quantity": 1, "cost_usd": 10.0},
            ],
        },
        cookies=cookies,
        timeout=15,
    )
    print("purchase-receipt", purchase_resp.status_code, purchase_resp.text[:500])
    return 0 if transfer_resp.status_code == 200 and purchase_resp.status_code == 200 else 1


if __name__ == "__main__":
    raise SystemExit(main())