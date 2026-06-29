#!/usr/bin/env python3
"""Reproduce: vendedor → gerencia edita precio → libera → vendedor envía a caja."""
from __future__ import annotations

import json
import random
import sys
import uuid
from typing import Any, Dict, List

import requests

API_BASE = "http://127.0.0.1:8001/api"
PIN_VENTAS = "55667788"
PIN_GERENCIA = "01011990"
PIN_CAJERO = "11223344"
WAREHOUSE_ID = "wh_main"


class Client:
    def __init__(self, label: str):
        self.label = label
        self.s = requests.Session()

    def login(self, pin: str) -> Dict[str, Any]:
        r = self.s.post(f"{API_BASE}/auth/pin/login", json={"pin": pin}, timeout=30)
        r.raise_for_status()
        return r.json().get("user") or {}

    def get(self, path: str, params: Dict[str, Any] | None = None) -> requests.Response:
        return self.s.get(f"{API_BASE}{path}", params=params, timeout=60)

    def post(self, path: str, body: Any = None) -> requests.Response:
        return self.s.post(f"{API_BASE}{path}", json=body, timeout=120)

    def put(self, path: str, body: Any = None) -> requests.Response:
        return self.s.put(f"{API_BASE}{path}", json=body, timeout=120)


def pick_customer_with_vehicle(gerencia: Client) -> tuple[str, str]:
    customers = gerencia.get("/customers").json()
    vehicles = gerencia.get("/vehicles").json()
    by_customer: Dict[str, List[Dict[str, Any]]] = {}
    for v in vehicles:
        cid = v.get("customer_id")
        if cid:
            by_customer.setdefault(cid, []).append(v)
    natural_types = {"", "natural", "persona", "persona_natural", "individual"}
    eligible = [
        c for c in customers
        if by_customer.get(c.get("customer_id"))
        and str(c.get("customer_type") or "natural").lower() in natural_types
    ]
    if not eligible:
        raise RuntimeError("No hay clientes con vehículo")
    customer = random.choice(eligible)
    vehicle = random.choice(by_customer[customer["customer_id"]])
    return customer["customer_id"], vehicle.get("vehicle_id") or vehicle.get("id")


def pick_products(gerencia: Client, count: int = 2) -> List[Dict[str, Any]]:
    products = gerencia.get("/products").json()
    inventory = gerencia.get("/inventory").json()
    stock: Dict[str, float] = {}
    for row in inventory:
        pid = row.get("product_id")
        stock[pid] = stock.get(pid, 0) + float(row.get("quantity") or 0)
    physical = [
        p for p in products
        if p.get("product_type") != "service" and stock.get(p.get("product_id"), 0) >= 5
    ]
    if len(physical) < count:
        raise RuntimeError("Stock insuficiente para prueba")
    chosen = random.sample(physical, count)
    return [
        {
            "product_id": p["product_id"],
            "product_name": p.get("name"),
            "quantity": 1,
            "unit_price": float(p.get("price") or 0),
            "original_unit_price": float(p.get("price") or 0),
            "discount": 0,
            "warehouse_id": WAREHOUSE_ID,
            "with_installation": False,
        }
        for p in chosen
    ]


def compute_frontend_total_nio(cart: List[Dict[str, Any]], exchange_rate: float, iva_rate: float = 15.0) -> float:
    subtotal_usd = 0.0
    for item in cart:
        price = float(item.get("unit_price") or 0)
        qty = int(item.get("quantity") or 1)
        subtotal_usd += price * qty
    subtotal_nio = subtotal_usd * exchange_rate
    tax = subtotal_nio * (iva_rate / 100.0)
    return round(subtotal_nio + tax, 2)


def main() -> int:
    gerencia = Client("gerencia")
    ventas = Client("ventas")
    cajero = Client("cajero")

    gerencia.login(PIN_GERENCIA)
    rate_doc = gerencia.get("/currencies/usd-nio-effective").json()
    rate = float(rate_doc.get("rate") or 36.5)
    customer_id, vehicle_id = pick_customer_with_vehicle(gerencia)
    cart = pick_products(gerencia, 2)
    draft_id = f"sale_test_{uuid.uuid4().hex[:10]}"

    snapshot = {
        "selectedCustomerId": customer_id,
        "selectedVehicle": vehicle_id,
        "vehicleFlowOption": "registered",
        "isVehiclePickerVisible": False,
        "selectedWarehouse": WAREHOUSE_ID,
        "cartItems": cart,
        "paymentMethod": "cash",
        "globalDiscountMode": "percent",
        "globalDiscount": 0,
        "applyIVA": True,
        "ivaRate": 15,
        "currency": "NIO",
        "exchangeRate": rate,
        "appliedDiscounts": [],
    }

    ventas.login(PIN_VENTAS)
    r = ventas.put(f"/drafts/sale/{draft_id}", {"name": "Prueba precio supervisor", "snapshot": snapshot})
    print("save draft ventas:", r.status_code)
    r.raise_for_status()

    gerencia.login(PIN_GERENCIA)
    gerencia.post(f"/drafts/sale/{draft_id}/review/watch").raise_for_status()
    edited = float(cart[0]["unit_price"]) * 0.9
    cart[0]["unit_price"] = round(edited, 6)
    cart[0]["price_edit_count"] = 1
    snapshot["cartItems"] = cart
    r = gerencia.put(f"/drafts/sale/{draft_id}", {"name": "Prueba precio supervisor", "snapshot": snapshot})
    r.raise_for_status()
    gerencia.post(f"/drafts/sale/{draft_id}/review/release").raise_for_status()
    print("gerencia editó precio y liberó borrador")

    ventas.login(PIN_VENTAS)
    total_amount = compute_frontend_total_nio(cart, rate)
    payload = {
        "customer_id": customer_id,
        "vehicle_id": vehicle_id,
        "items": [
            {
                "product_id": i["product_id"],
                "quantity": i["quantity"],
                "discount": i.get("discount", 0),
                "unit_price": i["unit_price"],
                "warehouse_id": WAREHOUSE_ID,
                "with_installation": False,
            }
            for i in cart
        ],
        "discount": 0,
        "supervisor_discount_preapproved": True,
        "payment_type": "cash",
        "payment_method": "cash",
        "apply_iva": True,
        "iva_rate": 15,
        "currency": "NIO",
        "exchange_rate": rate,
        "total_amount": total_amount,
        "planned_payment_plan": {
            "mode": "cash",
            "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": total_amount}],
        },
        "idempotency_key": f"live_test_{draft_id}",
    }
    r = ventas.post("/sales", payload)
    print("create sale status:", r.status_code)
    print("create sale body:", r.text[:800])
    if r.status_code != 200:
        return 1

    sale = r.json()
    sale_id = sale.get("sale_id")
    invoice = sale.get("invoice_number")
    print(f"OK sale created: {invoice} ({sale_id}) total={sale.get('total')} currency={sale.get('currency')}")

    cajero.login(PIN_CAJERO)
    tabs = cajero.get("/caja/facturas", params={"tab": "cotizacion"})
    print("caja tab status:", tabs.status_code)
    payload = tabs.json() if tabs.status_code == 200 else {}
    rows = payload.get("rows") if isinstance(payload, dict) else payload
    rows = rows if isinstance(rows, list) else []
    visible = any(str(row.get("sale_id")) == str(sale_id) for row in rows)
    print("visible in caja cotizacion:", visible)
    if not visible:
        print("caja rows sample:", json.dumps(rows[:3], ensure_ascii=False)[:500])
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())