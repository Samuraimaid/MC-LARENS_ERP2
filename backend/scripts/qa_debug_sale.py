"""One-off debug helper for QA sale creation failures."""
import json
import sys
import uuid

import httpx

from backend.domains.qa.full_simulation_suite import (
    DEFAULT_BUY_RATE,
    DEFAULT_SELL_RATE,
    PIN_VENTAS,
    WAREHOUSE_ID,
    _build_mixed_plan,
    _compute_items_subtotal_usd,
    _pick_products,
    _round2,
)

BASE = "http://127.0.0.1:8001/api"


def main() -> int:
    client = httpx.Client(timeout=60.0)
    login = client.post(f"{BASE}/auth/pin/login", json={"pin": PIN_VENTAS})
    print("login", login.status_code, login.text[:200])

    customer = client.post(
        f"{BASE}/customers",
        json={
            "name": "QA Debug",
            "customer_type": "natural",
            "tax_id": f"001-DBG-{uuid.uuid4().hex[:6]}",
            "phone": "7700",
            "email": "dbg@qa.local",
            "address": "Managua",
        },
    )
    print("customer", customer.status_code, customer.text[:300])
    cust = customer.json()

    products = _pick_products(client.get(f"{BASE}/products").json(), 5)
    items = []
    for index, product in enumerate(products[:5]):
        items.append(
            {
                "product_id": product["product_id"],
                "quantity": 1,
                "discount": 5.0 if index < 3 else 0.0,
                "unit_price": float(product.get("price") or 10),
                "warehouse_id": WAREHOUSE_ID,
                "with_installation": False,
            }
        )

    sub_usd = _compute_items_subtotal_usd(products, items)
    total_nio = _round2(sub_usd * DEFAULT_SELL_RATE)
    plan = _build_mixed_plan(total_nio, DEFAULT_BUY_RATE, 0)
    payload = {
        "customer_id": cust["customer_id"],
        "items": items,
        "discount": 0,
        "payment_type": plan["mode"],
        "payment_method": plan["mode"],
        "mixed_payment_methods": plan.get("mixed_methods") or [],
        "apply_iva": False,
        "iva_rate": 15,
        "currency": "NIO",
        "exchange_rate": DEFAULT_SELL_RATE,
        "total_amount": total_nio,
        "planned_payment_plan": {"mode": plan["mode"], "lines": plan["lines"]},
        "supervisor_discount_preapproved": True,
        "notes": "dbg",
        "idempotency_key": uuid.uuid4().hex,
    }
    response = client.post(f"{BASE}/sales", json=payload)
    print("sale", response.status_code)
    print(response.text[:3000])
    return 0 if response.status_code < 400 else 1


if __name__ == "__main__":
    sys.exit(main())