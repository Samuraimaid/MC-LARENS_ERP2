#!/usr/bin/env python3
"""Live E2E suite: venta para llevar, monedas mixtas, métodos de pago, descuentos y caja."""
from __future__ import annotations

import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

API_BASE = "http://127.0.0.1:8001/api"
PIN_VENTAS = "55667788"
PIN_GERENCIA = "01011990"
PIN_CAJERO = "11223344"
WAREHOUSE_ID = "wh_main"
REPORT_DIR = Path(__file__).resolve().parents[2] / "backend" / "data"
RUN_TAG = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


class Client:
    def __init__(self, label: str):
        self.label = label
        self.s = requests.Session()

    def login(self, pin: str) -> Dict[str, Any]:
        r = self.s.post(f"{API_BASE}/auth/pin/login", json={"pin": pin}, timeout=30)
        r.raise_for_status()
        token = r.json().get("session_token")
        if token:
            self.s.cookies.set("session_token", token)
        return r.json().get("user") or {}

    def get(self, path: str, params: Dict[str, Any] | None = None) -> requests.Response:
        return self.s.get(f"{API_BASE}{path}", params=params, timeout=60)

    def post(self, path: str, body: Any = None) -> requests.Response:
        return self.s.post(f"{API_BASE}{path}", json=body, timeout=120)

    def patch(self, path: str, body: Any = None) -> requests.Response:
        return self.s.patch(f"{API_BASE}{path}", json=body, timeout=120)


REPORT: Dict[str, Any] = {"run_tag": RUN_TAG, "passed": [], "failed": []}


def ok(name: str, detail: str = "") -> None:
    row = {"name": name, "detail": detail}
    REPORT["passed"].append(row)
    print(f"PASS {name}" + (f" — {detail}" if detail else ""))


def fail(name: str, detail: str) -> None:
    row = {"name": name, "detail": detail}
    REPORT["failed"].append(row)
    print(f"FAIL {name} — {detail}")


def pick_catalog(gerencia: Client) -> Tuple[Dict[str, Any], str, Dict[str, Any], float, List[Dict[str, Any]]]:
    customers = gerencia.get("/customers").json()
    vehicles = gerencia.get("/vehicles").json()
    products = gerencia.get("/products").json()
    inventory = gerencia.get("/inventory").json()
    rate = float(gerencia.get("/currencies/usd-nio-effective").json().get("rate") or 36.5)

    by_customer: Dict[str, List[Dict[str, Any]]] = {}
    for vehicle in vehicles:
        cid = vehicle.get("customer_id")
        if cid:
            by_customer.setdefault(cid, []).append(vehicle)

    customer = next((c for c in customers if by_customer.get(c.get("customer_id"))), None)
    if not customer:
        raise RuntimeError("Sin cliente con vehículo")
    vehicle_id = by_customer[customer["customer_id"]][0].get("vehicle_id")

    stock: Dict[str, float] = {}
    for row in inventory:
        if str(row.get("warehouse_id") or "") != WAREHOUSE_ID:
            continue
        pid = row.get("product_id")
        stock[pid] = stock.get(pid, 0) + float(row.get("quantity") or 0)

    product_pool = [
        row for row in products
        if row.get("product_type") != "service" and stock.get(row.get("product_id"), 0) >= 2
    ]
    product_pool.sort(key=lambda row: stock.get(row.get("product_id"), 0), reverse=True)
    if not product_pool:
        raise RuntimeError("Sin producto físico con stock")
    return customer, vehicle_id, product_pool[0], rate, product_pool


def sale_item(product: Dict[str, Any], *, carry_out: bool = True) -> Dict[str, Any]:
    return {
        "product_id": product["product_id"],
        "quantity": 1,
        "discount": 0,
        "unit_price": float(product.get("price") or 0),
        "warehouse_id": WAREHOUSE_ID,
        "with_installation": not carry_out,
    }


def compute_total_nio(unit_price: float, rate: float, discount_percent: float = 0) -> float:
    subtotal = unit_price * (1 - discount_percent / 100.0)
    return round(subtotal * rate * 1.15, 2)


def ensure_cash_session(cajero: Client, gerencia: Client) -> str:
    active = cajero.get("/caja/sesion-activa").json()
    if active.get("active") and active.get("session", {}).get("session_id"):
        return str(active["session"]["session_id"])
    rate = float(gerencia.get("/currencies/usd-nio-effective").json().get("rate") or 36.5)
    opened = cajero.post("/caja/apertura", body={
        "caja_id": "CAJA-01",
        "tipo_cambio_usd_nio": rate,
        "denominaciones": [{"moneda": "NIO", "tipo": "billete", "valor_nominal": 100, "cantidad": 20}],
        "observaciones": f"Live suite {RUN_TAG}",
    })
    if opened.status_code == 200:
        return str(opened.json().get("session_id"))
    fallback = gerencia.get("/caja/sesion-activa").json()
    if fallback.get("active"):
        return str(fallback["session"]["session_id"])
    raise RuntimeError(f"No se pudo abrir caja: {opened.status_code}")


def create_sale(ventas: Client, payload: Dict[str, Any], *, product_pool: Optional[List[Dict[str, Any]]] = None) -> Optional[Dict[str, Any]]:
    scenario = payload.get("_scenario", "sale")
    candidates = product_pool or [payload["items"][0]]
    last_error = ""
    for product in candidates:
        attempt = {
            **payload,
            "items": [{
                **payload["items"][0],
                "product_id": product["product_id"],
                "unit_price": float(product.get("price") or payload["items"][0].get("unit_price") or 0),
            }],
            "idempotency_key": payload.get("idempotency_key") or f"live_{uuid.uuid4().hex[:10]}",
        }
        if "total_amount" in attempt and "planned_payment_plan" in attempt:
            unit_price = float(attempt["items"][0]["unit_price"])
            discount = float(attempt.get("discount") or 0)
            total = compute_total_nio(unit_price, float(attempt.get("exchange_rate") or 36.5), discount)
            attempt["total_amount"] = total
            plan = attempt["planned_payment_plan"]
            if plan.get("lines") and len(plan["lines"]) == 1:
                attempt["planned_payment_plan"] = {
                    **plan,
                    "lines": [{**plan["lines"][0], "monto_origen": total}],
                }
        response = ventas.post("/sales", attempt)
        if response.status_code == 200:
            sale = response.json()
            ok(scenario, f"{sale.get('invoice_number')} total={sale.get('total')}")
            return sale
        last_error = response.text[:400]
    fail(scenario, f"create failed: {last_error}")
    return None


def pagos_from_locked_plan(sale: Dict[str, Any], *, extra_fields: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    plan = sale.get("planned_payment_plan") or {}
    rows = []
    for line in plan.get("lines") or []:
        row = {
            "metodo": line.get("metodo"),
            "moneda": line.get("moneda"),
            "monto_origen": line.get("monto_origen"),
        }
        if extra_fields and line.get("metodo") in extra_fields:
            row[extra_fields[line["metodo"]]] = extra_fields[line["metodo"]]
        rows.append(row)
    return rows


def collect_sale(
    cajero: Client,
    gerencia: Client,
    sale: Dict[str, Any],
    *,
    pagos: List[Dict[str, Any]],
    scenario: str,
) -> bool:
    sale_id = sale["sale_id"]
    total = float(sale.get("net_to_collect") or sale.get("total") or 0)
    session_id = ensure_cash_session(cajero, gerencia)
    response = cajero.post(f"/caja/facturas/{sale_id}/cobrar", body={
        "sesion_id": session_id,
        "amount": total,
        "payment_method": "mixed" if len(pagos) > 1 else pagos[0]["metodo"],
        "pagos": pagos,
        "idempotency_key": f"collect_{uuid.uuid4().hex[:8]}",
    })
    if response.status_code != 200:
        fail(f"{scenario}_collect", f"{response.status_code}: {response.text[:400]}")
        return False
    ok(f"{scenario}_collect", f"sale_id={sale_id}")
    return True


def scenario_carry_out_cash(
    ventas: Client,
    cajero: Client,
    gerencia: Client,
    customer_id: str,
    vehicle_id: str,
    product: Dict[str, Any],
    rate: float,
) -> None:
    name = "carry_out_cash_nio"
    total = compute_total_nio(float(product.get("price") or 0), rate)
    sale = create_sale(ventas, {
        "_scenario": name,
        "customer_id": customer_id,
        "vehicle_id": vehicle_id,
        "items": [sale_item(product, carry_out=True)],
        "discount": 0,
        "payment_type": "cash",
        "payment_method": "cash",
        "apply_iva": True,
        "iva_rate": 15,
        "currency": "NIO",
        "exchange_rate": rate,
        "total_amount": total,
        "planned_payment_plan": {
            "mode": "cash",
            "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": total}],
        },
    })
    if not sale:
        return
    if sale.get("with_installation") is True:
        fail(name, "Se esperaba venta para llevar (sin instalación)")
    collect_sale(cajero, gerencia, sale, scenario=name, pagos=[
        {"metodo": "cash", "moneda": "NIO", "monto_origen": total},
    ])


def scenario_mixed_usd_nio(
    ventas: Client,
    cajero: Client,
    gerencia: Client,
    customer_id: str,
    vehicle_id: str,
    product: Dict[str, Any],
    rate: float,
) -> None:
    name = "mixed_usd_nio_transfer"
    total = compute_total_nio(float(product.get("price") or 0), rate)
    cash_usd = round(total * 0.4 / rate, 2)
    transfer_nio = round(total - round(cash_usd * rate, 2), 2)
    sale = create_sale(ventas, {
        "_scenario": name,
        "customer_id": customer_id,
        "vehicle_id": vehicle_id,
        "items": [sale_item(product)],
        "discount": 0,
        "payment_type": "mixed",
        "payment_method": "mixed",
        "mixed_payment_methods": ["cash", "transfer"],
        "apply_iva": True,
        "iva_rate": 15,
        "currency": "NIO",
        "exchange_rate": rate,
        "total_amount": total,
        "planned_payment_plan": {
            "mode": "mixed",
            "lines": [
                {"metodo": "cash", "moneda": "USD", "monto_origen": cash_usd},
                {"metodo": "transfer", "moneda": "NIO", "monto_origen": transfer_nio},
            ],
        },
    })
    if not sale:
        return
    plan = sale.get("planned_payment_plan") or {}
    planned = float(plan.get("planned_total_nio") or 0)
    if abs(planned - total) > 0.37:
        fail(name, f"Plan fuera de tolerancia USD: planned={planned} target={total}")
    plan_pagos = pagos_from_locked_plan(sale)
    for row in plan_pagos:
        if row.get("metodo") == "transfer":
            row["referencia_bancaria"] = f"TR-{uuid.uuid4().hex[:6]}"
    collect_sale(cajero, gerencia, sale, scenario=name, pagos=plan_pagos)


def scenario_transfer_only(
    ventas: Client,
    cajero: Client,
    gerencia: Client,
    customer_id: str,
    vehicle_id: str,
    product: Dict[str, Any],
    rate: float,
) -> None:
    name = "transfer_only_nio"
    total = compute_total_nio(float(product.get("price") or 0), rate)
    sale = create_sale(ventas, {
        "_scenario": name,
        "customer_id": customer_id,
        "vehicle_id": vehicle_id,
        "items": [sale_item(product)],
        "discount": 0,
        "payment_type": "transfer",
        "payment_method": "transfer",
        "apply_iva": True,
        "iva_rate": 15,
        "currency": "NIO",
        "exchange_rate": rate,
        "total_amount": total,
        "planned_payment_plan": {
            "mode": "transfer",
            "lines": [{"metodo": "transfer", "moneda": "NIO", "monto_origen": total}],
        },
    })
    if not sale:
        return
    collect_sale(cajero, gerencia, sale, scenario=name, pagos=[
        {
            "metodo": "transfer",
            "moneda": "NIO",
            "monto_origen": total,
            "referencia_bancaria": f"TR-{uuid.uuid4().hex[:6]}",
        },
    ])


def scenario_discount_cash(
    ventas: Client,
    cajero: Client,
    gerencia: Client,
    customer_id: str,
    vehicle_id: str,
    product: Dict[str, Any],
    rate: float,
) -> None:
    name = "discount_cash_5pct"
    discount_pct = 5.0
    total = compute_total_nio(float(product.get("price") or 0), rate, discount_pct)
    sale = create_sale(ventas, {
        "_scenario": name,
        "customer_id": customer_id,
        "vehicle_id": vehicle_id,
        "items": [sale_item(product)],
        "discount": discount_pct,
        "supervisor_discount_preapproved": True,
        "payment_type": "cash",
        "payment_method": "cash",
        "apply_iva": True,
        "iva_rate": 15,
        "currency": "NIO",
        "exchange_rate": rate,
        "total_amount": total,
        "planned_payment_plan": {
            "mode": "cash",
            "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": total}],
        },
    })
    if not sale:
        return
    discounts = float(sale.get("discounts_applied_amount") or sale.get("discount") or 0)
    if discounts <= 0:
        fail(name, f"Descuento no aplicado en venta: {sale.get('discount')}")
    else:
        ok(f"{name}_discount", f"discounts_applied={discounts}")
    collect_sale(cajero, gerencia, sale, scenario=name, pagos=[
        {"metodo": "cash", "moneda": "NIO", "monto_origen": total},
    ])


def scenario_mixed_three_methods(
    ventas: Client,
    cajero: Client,
    gerencia: Client,
    customer_id: str,
    vehicle_id: str,
    product: Dict[str, Any],
    rate: float,
) -> None:
    name = "mixed_cash_transfer_card"
    total = compute_total_nio(float(product.get("price") or 0), rate)
    cash_part = round(total * 0.5, 2)
    transfer_part = round(total * 0.25, 2)
    card_part = round(total - cash_part - transfer_part, 2)
    sale = create_sale(ventas, {
        "_scenario": name,
        "customer_id": customer_id,
        "vehicle_id": vehicle_id,
        "items": [sale_item(product)],
        "discount": 0,
        "payment_type": "mixed",
        "payment_method": "mixed",
        "mixed_payment_methods": ["cash", "transfer", "card"],
        "apply_iva": True,
        "iva_rate": 15,
        "currency": "NIO",
        "exchange_rate": rate,
        "total_amount": total,
        "planned_payment_plan": {
            "mode": "mixed",
            "lines": [
                {"metodo": "cash", "moneda": "NIO", "monto_origen": cash_part},
                {"metodo": "transfer", "moneda": "NIO", "monto_origen": transfer_part},
                {"metodo": "card", "moneda": "NIO", "monto_origen": card_part},
            ],
        },
    })
    if not sale:
        return
    collect_sale(cajero, gerencia, sale, scenario=name, pagos=[
        {"metodo": "cash", "moneda": "NIO", "monto_origen": cash_part},
        {
            "metodo": "transfer",
            "moneda": "NIO",
            "monto_origen": transfer_part,
            "referencia_bancaria": f"TR-{uuid.uuid4().hex[:6]}",
        },
        {
            "metodo": "card",
            "moneda": "NIO",
            "monto_origen": card_part,
            "card_type": "debit",
            "bank_name": "BAC",
            "transaction_number": f"CARD{uuid.uuid4().hex[:8]}",
            "referencia_bancaria": "REF-CARD",
        },
    ])


def scenario_partial_cash_two_step(
    ventas: Client,
    cajero: Client,
    gerencia: Client,
    customer_id: str,
    vehicle_id: str,
    product: Dict[str, Any],
    rate: float,
    product_pool: Optional[List[Dict[str, Any]]] = None,
) -> None:
    name = "partial_cash_two_step"
    total = compute_total_nio(float(product.get("price") or 0), rate)
    sale = create_sale(ventas, {
        "_scenario": name,
        "customer_id": customer_id,
        "vehicle_id": vehicle_id,
        "items": [sale_item(product)],
        "discount": 0,
        "payment_type": "cash",
        "payment_method": "cash",
        "apply_iva": True,
        "iva_rate": 15,
        "currency": "NIO",
        "exchange_rate": rate,
        "total_amount": total,
        "planned_payment_plan": {
            "mode": "cash",
            "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": total}],
        },
    }, product_pool=product_pool)
    if not sale:
        return

    sale_id = sale["sale_id"]
    pending = float(sale.get("net_to_collect") or sale.get("total") or total)
    partial = round(max(min(pending * 0.35, pending - 1), 1), 2)
    session_id = ensure_cash_session(cajero, gerencia)

    first = cajero.post(f"/caja/facturas/{sale_id}/cobrar", body={
        "sesion_id": session_id,
        "amount": partial,
        "payment_method": "cash",
        "idempotency_key": f"partial_a_{uuid.uuid4().hex[:8]}",
    })
    if first.status_code != 200:
        fail(f"{name}_first", f"{first.status_code}: {first.text[:400]}")
        return
    remaining = float(first.json().get("amount_pending") or 0)
    if remaining <= 0:
        fail(f"{name}_first", "Abono parcial no dejó saldo pendiente")
        return
    ok(f"{name}_partial", f"abono C${partial:.2f} pendiente C${remaining:.2f}")

    second = cajero.post(f"/caja/facturas/{sale_id}/cobrar", body={
        "sesion_id": session_id,
        "amount": remaining,
        "payment_method": "cash",
        "idempotency_key": f"partial_b_{uuid.uuid4().hex[:8]}",
    })
    if second.status_code != 200:
        fail(f"{name}_final", f"{second.status_code}: {second.text[:400]}")
        return
    ok(f"{name}_final", f"sale_id={sale_id} pagada")


def scenario_discount_blocked_on_card(ventas: Client, product: Dict[str, Any], rate: float, customer_id: str, vehicle_id: str) -> None:
    name = "discount_blocked_on_card"
    total = compute_total_nio(float(product.get("price") or 0), rate, 5.0)
    response = ventas.post("/sales", {
        "customer_id": customer_id,
        "vehicle_id": vehicle_id,
        "items": [sale_item(product)],
        "discount": 5,
        "supervisor_discount_preapproved": False,
        "payment_type": "card",
        "payment_method": "card",
        "apply_iva": True,
        "iva_rate": 15,
        "currency": "NIO",
        "exchange_rate": rate,
        "total_amount": total,
        "planned_payment_plan": {
            "mode": "card",
            "lines": [{"metodo": "card", "moneda": "NIO", "monto_origen": total}],
        },
        "idempotency_key": f"blocked_{uuid.uuid4().hex[:8]}",
    })
    if response.status_code in {400, 409, 422}:
        ok(name, f"Backend rechazó descuento+tarjeta ({response.status_code})")
        return
    body = response.json() if response.status_code == 200 else {}
    blocked = bool(body.get("discounts_blocked_by_method"))
    if response.status_code == 200 and blocked:
        ok(name, "Venta creada con descuentos bloqueados por tarjeta")
    elif response.status_code == 200:
        fail(name, "Se permitió descuento con tarjeta sin bloqueo")
    else:
        fail(name, f"Respuesta inesperada {response.status_code}")


def main() -> int:
    gerencia = Client("gerencia")
    ventas = Client("ventas")
    cajero = Client("cajero")
    gerencia.login(PIN_GERENCIA)
    ventas.login(PIN_VENTAS)
    cajero.login(PIN_CAJERO)

    print(f"=== LIVE FULL WORKFLOW SUITE {RUN_TAG} ===")
    customer, vehicle_id, product, rate, product_pool = pick_catalog(gerencia)
    customer_id = customer["customer_id"]
    print(f"catalog customer={customer_id} product={product.get('product_id')} rate={rate}")

    scenario_carry_out_cash(ventas, cajero, gerencia, customer_id, vehicle_id, product, rate)
    scenario_mixed_usd_nio(ventas, cajero, gerencia, customer_id, vehicle_id, product, rate)
    scenario_transfer_only(ventas, cajero, gerencia, customer_id, vehicle_id, product, rate)
    scenario_discount_cash(ventas, cajero, gerencia, customer_id, vehicle_id, product, rate)
    scenario_mixed_three_methods(ventas, cajero, gerencia, customer_id, vehicle_id, product, rate)
    scenario_partial_cash_two_step(ventas, cajero, gerencia, customer_id, vehicle_id, product, rate, product_pool)
    scenario_discount_blocked_on_card(ventas, product, rate, customer_id, vehicle_id)

    report_path = REPORT_DIR / f"live_full_workflow_report_{RUN_TAG}.json"
    report_path.write_text(json.dumps(REPORT, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "passed": len(REPORT["passed"]),
        "failed": len(REPORT["failed"]),
        "report": str(report_path),
    }, ensure_ascii=False))

    return 0 if not REPORT["failed"] else 1


if __name__ == "__main__":
    sys.exit(main())