#!/usr/bin/env python3
"""Valida flujo gerencia: precio, descuento global, plan de cobro → liberar → vendedor."""
from __future__ import annotations

import json
import random
import sys
import uuid
from typing import Any, Dict, List, Tuple

import requests

API_BASE = "http://127.0.0.1:8001/api"
PIN_VENTAS = "55667788"
PIN_GERENCIA = "01011990"
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


def pick_customer_with_vehicle(client: Client) -> Tuple[str, str]:
    customers = client.get("/customers").json()
    vehicles = client.get("/vehicles").json()
    by_customer: Dict[str, List[Dict[str, Any]]] = {}
    for vehicle in vehicles:
        cid = vehicle.get("customer_id")
        if cid:
            by_customer.setdefault(cid, []).append(vehicle)
    natural_types = {"", "natural", "persona", "persona_natural", "individual"}
    eligible = [
        customer for customer in customers
        if by_customer.get(customer.get("customer_id"))
        and str(customer.get("customer_type") or "natural").lower() in natural_types
    ]
    if not eligible:
        raise RuntimeError("No hay clientes con vehículo")
    customer = random.choice(eligible)
    vehicle = random.choice(by_customer[customer["customer_id"]])
    return customer["customer_id"], vehicle.get("vehicle_id") or vehicle.get("id")


def pick_product(client: Client) -> Dict[str, Any]:
    products = client.get("/products").json()
    inventory = client.get("/inventory").json()
    stock: Dict[str, float] = {}
    for row in inventory:
        if str(row.get("warehouse_id") or "") != WAREHOUSE_ID:
            continue
        pid = row.get("product_id")
        stock[pid] = stock.get(pid, 0) + float(row.get("quantity") or 0)
    services = [row for row in products if row.get("product_type") == "service"]
    if services:
        return random.choice(services)
    physical = [
        row for row in products
        if row.get("product_type") != "service" and stock.get(row.get("product_id"), 0) >= 2
    ]
    if not physical:
        raise RuntimeError("Stock insuficiente para prueba")
    return random.choice(physical)


def compute_total_nio(cart: List[Dict[str, Any]], rate: float, global_discount_percent: float = 0.0) -> float:
    subtotal_usd = 0.0
    for item in cart:
        subtotal_usd += float(item.get("unit_price") or 0) * int(item.get("quantity") or 1)
    subtotal_nio = subtotal_usd * rate
    discount = subtotal_nio * (global_discount_percent / 100.0)
    taxable = subtotal_nio - discount
    return round(taxable * 1.15, 2)


def normalize_plan_lines(snapshot: Dict[str, Any]) -> List[Dict[str, Any]]:
    lines = snapshot.get("paymentPlanLines")
    if not isinstance(lines, list):
        planned = snapshot.get("planned_payment_plan") or {}
        lines = planned.get("lines") if isinstance(planned, dict) else []
    return lines if isinstance(lines, list) else []


def main() -> int:
    gerencia = Client("gerencia")
    ventas = Client("ventas")
    gerencia.login(PIN_GERENCIA)
    ventas.login(PIN_VENTAS)

    rate = float(gerencia.get("/currencies/usd-nio-effective").json().get("rate") or 36.5)
    customer_id, vehicle_id = pick_customer_with_vehicle(gerencia)
    product = pick_product(gerencia)
    draft_id = f"sale_form_{uuid.uuid4().hex[:10]}"
    unit_price = float(product.get("price") or 0)
    cart = [{
        "product_id": product["product_id"],
        "product_name": product.get("name"),
        "quantity": 1,
        "unit_price": unit_price,
        "original_unit_price": unit_price,
        "discount": 0,
        "warehouse_id": WAREHOUSE_ID,
        "with_installation": False,
    }]

    snapshot = {
        "selectedCustomerId": customer_id,
        "selectedVehicle": vehicle_id,
        "vehicleFlowOption": "registered",
        "isVehiclePickerVisible": False,
        "selectedWarehouse": WAREHOUSE_ID,
        "cartItems": cart,
        "paymentMethod": "cash",
        "mixedPaymentMethods": [],
        "globalDiscountMode": "percent",
        "globalDiscount": 0,
        "applyIVA": True,
        "ivaRate": 15,
        "currency": "NIO",
        "exchangeRate": rate,
        "appliedDiscounts": [],
    }

    ventas.put(f"/drafts/sale/{draft_id}", {"name": "Prueba formulario supervisor", "snapshot": snapshot}).raise_for_status()
    gerencia.post(f"/drafts/sale/{draft_id}/review/watch").raise_for_status()

    edited_price = round(unit_price * 0.9, 6)
    cart[0]["unit_price"] = edited_price
    cart[0]["price_edit_count"] = 1
    snapshot["cartItems"] = cart
    snapshot["globalDiscount"] = 5
    total_nio = compute_total_nio(cart, rate, global_discount_percent=5)
    plan_lines = [{"metodo": "cash", "moneda": "NIO", "monto_origen": total_nio}]
    snapshot["paymentPlanLines"] = plan_lines
    snapshot["planned_payment_plan"] = {"mode": "cash", "lines": plan_lines}

    save_resp = gerencia.put(f"/drafts/sale/{draft_id}", {"name": "Prueba formulario supervisor", "snapshot": snapshot})
    save_resp.raise_for_status()
    saved_review = (save_resp.json() or {}).get("review") or {}
    if not saved_review.get("supervisor_changed"):
        print("FAIL: gerencia guardó cambios pero supervisor_changed=false")
        return 1

    release_resp = gerencia.post(f"/drafts/sale/{draft_id}/review/release")
    release_resp.raise_for_status()
    released_review = (release_resp.json() or {}).get("review") or {}
    if released_review.get("status") != "released":
        print("FAIL: borrador no quedó en status released")
        return 1

    bundle = ventas.get("/drafts/sale").json()
    seller_draft = next(
        (draft for draft in (bundle.get("drafts") or []) if str(draft.get("id")) == draft_id),
        None,
    )
    if not seller_draft:
        print("FAIL: vendedor no ve el borrador liberado en /drafts/sale")
        return 1
    seller_snapshot = seller_draft.get("snapshot") or {}
    if float(seller_snapshot.get("globalDiscount") or 0) != 5:
        print("FAIL: descuento global no persistió tras liberar:", seller_snapshot.get("globalDiscount"))
        return 1
    if float((seller_snapshot.get("cartItems") or [{}])[0].get("unit_price") or 0) != edited_price:
        print("FAIL: precio editado no persistió tras liberar")
        return 1
    restored_lines = normalize_plan_lines(seller_snapshot)
    if len(restored_lines) != 1:
        print("FAIL: plan de cobro no persistió tras liberar:", json.dumps(seller_snapshot, ensure_ascii=False)[:500])
        return 1
    if float(restored_lines[0].get("monto_origen") or 0) != total_nio:
        print("FAIL: monto del plan incorrecto:", restored_lines)
        return 1

    payload = {
        "customer_id": customer_id,
        "vehicle_id": vehicle_id,
        "items": [{
            "product_id": product["product_id"],
            "quantity": 1,
            "discount": 0,
            "unit_price": edited_price,
            "warehouse_id": WAREHOUSE_ID,
            "with_installation": False,
        }],
        "discount": 5,
        "supervisor_discount_preapproved": True,
        "payment_type": "cash",
        "payment_method": "cash",
        "mixed_payment_methods": [],
        "apply_iva": True,
        "iva_rate": 15,
        "currency": "NIO",
        "exchange_rate": rate,
        "total_amount": total_nio,
        "planned_payment_plan": {
            "mode": "cash",
            "lines": plan_lines,
        },
        "idempotency_key": f"live_form_{draft_id}",
    }
    create_resp = ventas.post("/sales", payload)
    print("create sale status:", create_resp.status_code)
    if create_resp.status_code != 200:
        print("create sale body:", create_resp.text[:800])
        return 1

    sale = create_resp.json()
    print(
        "OK supervisor draft form flow:",
        sale.get("invoice_number"),
        f"total={sale.get('total')}",
        f"plan_lines={len((sale.get('planned_payment_plan') or {}).get('lines') or [])}",
    )

    # Mixto cash+transfer con descuento de gerencia (paridad frontend/backend)
    draft_mixed = f"sale_mix_{uuid.uuid4().hex[:10]}"
    cart2 = [{
        "product_id": product["product_id"],
        "product_name": product.get("name"),
        "quantity": 1,
        "unit_price": unit_price,
        "original_unit_price": unit_price,
        "discount": 0,
        "warehouse_id": WAREHOUSE_ID,
        "with_installation": False,
    }]
    snapshot2 = {
        "selectedCustomerId": customer_id,
        "selectedVehicle": vehicle_id,
        "vehicleFlowOption": "registered",
        "isVehiclePickerVisible": False,
        "selectedWarehouse": WAREHOUSE_ID,
        "cartItems": cart2,
        "paymentMethod": "mixed",
        "mixedPaymentMethods": ["cash", "transfer"],
        "globalDiscountMode": "percent",
        "globalDiscount": 0,
        "applyIVA": True,
        "ivaRate": 15,
        "currency": "NIO",
        "exchangeRate": rate,
        "appliedDiscounts": [],
    }
    ventas.put(f"/drafts/sale/{draft_mixed}", {"name": "Mixto supervisor", "snapshot": snapshot2}).raise_for_status()
    gerencia.post(f"/drafts/sale/{draft_mixed}/review/watch").raise_for_status()
    snapshot2["globalDiscount"] = 5
    total_mix = compute_total_nio(cart2, rate, global_discount_percent=5)
    cash_part = round(total_mix * 0.55, 2)
    transfer_part = round(total_mix - cash_part, 2)
    plan_mix = [
        {"metodo": "cash", "moneda": "NIO", "monto_origen": cash_part},
        {"metodo": "transfer", "moneda": "NIO", "monto_origen": transfer_part},
    ]
    snapshot2["paymentPlanLines"] = plan_mix
    snapshot2["planned_payment_plan"] = {"mode": "mixed", "lines": plan_mix}
    gerencia.put(f"/drafts/sale/{draft_mixed}", {"name": "Mixto supervisor", "snapshot": snapshot2}).raise_for_status()
    gerencia.post(f"/drafts/sale/{draft_mixed}/review/release").raise_for_status()
    mix_payload = {
        "customer_id": customer_id,
        "vehicle_id": vehicle_id,
        "items": [{
            "product_id": product["product_id"],
            "quantity": 1,
            "discount": 0,
            "unit_price": unit_price,
            "warehouse_id": WAREHOUSE_ID,
            "with_installation": False,
        }],
        "discount": 5,
        "supervisor_discount_preapproved": True,
        "payment_type": "mixed",
        "payment_method": "mixed",
        "mixed_payment_methods": ["cash", "transfer"],
        "apply_iva": True,
        "iva_rate": 15,
        "currency": "NIO",
        "exchange_rate": rate,
        "total_amount": total_mix,
        "planned_payment_plan": {"mode": "mixed", "lines": plan_mix},
        "idempotency_key": f"live_mix_{draft_mixed}",
    }
    mix_resp = ventas.post("/sales", mix_payload)
    print("mixed create sale status:", mix_resp.status_code)
    if mix_resp.status_code != 200:
        print("mixed create sale body:", mix_resp.text[:800])
        return 1
    mix_sale = mix_resp.json()
    print(f"OK mixed supervisor flow: {mix_sale.get('invoice_number')} total={mix_sale.get('total')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())