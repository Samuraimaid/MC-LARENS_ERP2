#!/usr/bin/env python3
"""E2E smoke test: create unpaid sale -> request cancel -> approve -> verify reversions."""
from __future__ import annotations

import os
import sys
import time
import uuid

import requests

API_BASE = os.environ.get("API_BASE", "http://127.0.0.1:3000/api").rstrip("/")
PIN = os.environ.get("TEST_PIN", "01011990")


def _fail(msg: str, detail: str = "") -> None:
    print(f"FAIL: {msg}")
    if detail:
        print(detail)
    sys.exit(1)


def _ok(msg: str) -> None:
    print(f"OK: {msg}")


def login(session: requests.Session) -> dict:
    r = session.post(f"{API_BASE}/auth/pin/login", json={"pin": PIN}, timeout=30)
    if r.status_code != 200:
        _fail("PIN login", f"status={r.status_code} body={r.text[:300]}")
    data = r.json()
    user = data.get("user") or {}
    _ok(f"Login gerencia como {user.get('name')} ({user.get('role')}) user_id={user.get('user_id')}")
    return user


def pick_customer(session: requests.Session) -> dict:
    r = session.get(f"{API_BASE}/customers", timeout=30)
    r.raise_for_status()
    customers = r.json()
    if not customers:
        _fail("No hay clientes en la base de datos")
    return customers[0]


def pick_stock_item(session: requests.Session) -> tuple[dict, dict, str]:
    products = session.get(f"{API_BASE}/products", timeout=30).json()
    inventory = session.get(f"{API_BASE}/inventory", timeout=30).json()
    for inv in inventory:
        qty = float(inv.get("quantity") or 0)
        if qty < 2:
            continue
        product = next((p for p in products if p.get("product_id") == inv.get("product_id")), None)
        if product and product.get("product_type") != "service":
            return product, inv, str(inv.get("warehouse_id"))
    _fail("No hay producto con stock >= 2 para probar reversión")


def create_pending_sale(session: requests.Session, customer_id: str, product: dict, warehouse_id: str) -> dict:
    before_inv = session.get(f"{API_BASE}/inventory", timeout=30).json()
    inv_before = next(
        (
            row
            for row in before_inv
            if row.get("product_id") == product.get("product_id")
            and row.get("warehouse_id") == warehouse_id
        ),
        None,
    )
    qty_before = float((inv_before or {}).get("quantity") or 0)

    payload = {
        "customer_id": customer_id,
        "items": [
            {
                "product_id": product.get("product_id"),
                "quantity": 1,
                "discount": 0,
                "warehouse_id": warehouse_id,
                "with_installation": False,
            }
        ],
        "discount": 0,
        "payment_type": "transfer",
        "payment_method": "transfer",
        "idempotency_key": f"e2e_cancel_{uuid.uuid4().hex[:12]}",
    }
    r = session.post(f"{API_BASE}/sales", json=payload, timeout=60)
    if r.status_code != 200:
        _fail("Crear venta pendiente", f"status={r.status_code} body={r.text[:500]}")
    sale = r.json()
    if str(sale.get("payment_status")).lower() == "paid":
        _fail("La venta de prueba quedó pagada; no se puede anular por API")

    after_inv = session.get(f"{API_BASE}/inventory", timeout=30).json()
    inv_after = next(
        (
            row
            for row in after_inv
            if row.get("product_id") == product.get("product_id")
            and row.get("warehouse_id") == warehouse_id
        ),
        None,
    )
    qty_after = float((inv_after or {}).get("quantity") or 0)
    if qty_after != qty_before - 1:
        _fail(
            "Inventario no decrementó al crear venta",
            f"before={qty_before} after={qty_after}",
        )

    _ok(
        f"Venta creada sale_id={sale.get('sale_id')} invoice={sale.get('invoice_number')} "
        f"payment_status={sale.get('payment_status')} stock {qty_before}->{qty_after}"
    )
    sale["_qty_before"] = qty_before
    sale["_product_id"] = product.get("product_id")
    sale["_warehouse_id"] = warehouse_id
    return sale


def request_cancel(session: requests.Session, sale_id: str) -> str:
    reason = "Prueba E2E automatizada de anulacion de factura pendiente"
    r = session.post(
        f"{API_BASE}/sales/{sale_id}/requests/cancel",
        json={"reason": reason},
        timeout=30,
    )
    if r.status_code != 200:
        _fail("Solicitar anulación", f"status={r.status_code} body={r.text[:400]}")
    request_id = (r.json() or {}).get("request_id")
    if not request_id:
        _fail("Solicitud de anulación sin request_id", r.text)
    _ok(f"Solicitud de anulación creada request_id={request_id}")
    return request_id


def approve_cancel(session: requests.Session, request_id: str) -> None:
    r = session.post(f"{API_BASE}/sales/requests/{request_id}/approve-cancel", timeout=30)
    if r.status_code != 200:
        _fail("Aprobar anulación", f"status={r.status_code} body={r.text[:400]}")
    _ok(f"Anulación aprobada: {(r.json() or {}).get('message')}")


def verify_cancel(session: requests.Session, sale: dict) -> None:
    sale_id = sale.get("sale_id")
    product_id = sale["_product_id"]
    warehouse_id = sale["_warehouse_id"]
    qty_before = sale["_qty_before"]

    refreshed = session.get(f"{API_BASE}/sales/{sale_id}", timeout=30)
    if refreshed.status_code != 200:
        _fail("Consultar venta anulada", refreshed.text)
    sale_doc = refreshed.json()
    if str(sale_doc.get("invoice_state")).lower() != "cancelled":
        _fail("invoice_state no es cancelled", str(sale_doc.get("invoice_state")))

    inventory = session.get(f"{API_BASE}/inventory", timeout=30).json()
    inv_row = next(
        (
            row
            for row in inventory
            if row.get("product_id") == product_id and row.get("warehouse_id") == warehouse_id
        ),
        None,
    )
    qty_final = float((inv_row or {}).get("quantity") or 0)
    if qty_final != qty_before:
        _fail(
            "Inventario no restaurado tras cancelación",
            f"expected={qty_before} got={qty_final}",
        )

    _ok(
        f"Verificación completa: invoice_state=cancelled, stock restaurado a {qty_final}"
    )


def main() -> None:
    print("=" * 60)
    print("E2E Cancel Sale Flow")
    print("API_BASE:", API_BASE)
    print("PIN:", PIN)
    print("=" * 60)
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})

    login(session)
    customer = pick_customer(session)
    product, _inv, warehouse_id = pick_stock_item(session)
    sale = create_pending_sale(session, customer.get("customer_id"), product, warehouse_id)
    request_id = request_cancel(session, sale.get("sale_id"))
    approve_cancel(session, request_id)
    time.sleep(1)
    verify_cancel(session, sale)
    print("=" * 60)
    print("RESULTADO: TODAS LAS PRUEBAS PASS")
    print("=" * 60)


if __name__ == "__main__":
    main()