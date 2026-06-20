#!/usr/bin/env python3
"""Verify pos_discount_card requests appear in GET /api/approvals."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone

import requests

API = "http://127.0.0.1:8001/api"
RUN = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
WAREHOUSE_ID = "wh_main"
EXCHANGE_RATE = 36.5


def login(pin: str) -> requests.Session:
    session = requests.Session()
    response = session.post(f"{API}/auth/pin/login", json={"pin": pin}, timeout=30)
    response.raise_for_status()
    return session


def bootstrap_discount_sale(ventas: requests.Session) -> str:
    products = ventas.get(f"{API}/products", timeout=60).json()
    inventory = ventas.get(f"{API}/inventory", timeout=60).json()
    customers = ventas.get(f"{API}/customers", timeout=60).json()
    vehicles = ventas.get(f"{API}/vehicles", timeout=60).json()

    stock_by_product = {}
    for row in inventory if isinstance(inventory, list) else []:
        pid = row.get("product_id")
        stock_by_product[pid] = stock_by_product.get(pid, 0) + float(row.get("quantity") or 0)

    product_candidates = []
    for product in products if isinstance(products, list) else []:
        if product.get("product_type") == "service":
            continue
        pid = product.get("product_id")
        stock = stock_by_product.get(pid, 0)
        if stock >= 1 and float(product.get("price") or 0) > 0:
            product_candidates.append((stock, product))
    product_candidates.sort(key=lambda row: row[0], reverse=True)
    if not product_candidates:
        raise RuntimeError("No hay productos con stock para crear factura de prueba")

    customer = customers[0] if isinstance(customers, list) and customers else None
    if not customer:
        raise RuntimeError("No hay clientes para crear factura de prueba")

    vehicle_id = None
    if isinstance(vehicles, list):
        match = next((v for v in vehicles if v.get("customer_id") == customer.get("customer_id")), None)
        vehicle_id = (match or vehicles[0]).get("vehicle_id") if (match or vehicles) else None

    last_error = ""
    for _, candidate in product_candidates[:12]:
        payload = {
            "customer_id": customer["customer_id"],
            "vehicle_id": vehicle_id,
            "items": [{
                "product_id": candidate["product_id"],
                "quantity": 1,
                "discount": 0,
                "unit_price": candidate.get("price"),
                "warehouse_id": WAREHOUSE_ID,
                "with_installation": False,
            }],
            "discount": 5,
            "supervisor_discount_preapproved": True,
            "payment_type": "cash",
            "payment_method": "cash",
            "apply_iva": True,
            "currency": "NIO",
            "exchange_rate": EXCHANGE_RATE,
            "notes": f"E2E approvals tab {RUN}",
            "idempotency_key": f"e2e_approvals_tab_{RUN}",
        }
        response = ventas.post(f"{API}/sales", json=payload, timeout=120)
        if response.status_code == 200:
            body = response.json()
            sale_id = body.get("sale_id") or (body.get("sale") or {}).get("sale_id")
            if sale_id:
                return str(sale_id)
        last_error = response.text[:400]
    raise RuntimeError(f"No se pudo crear factura: {last_error}")


def main() -> int:
    cajero = login("11223344")
    gerencia = login("01011990")
    ventas = login("55667788")

    try:
        sale_id = bootstrap_discount_sale(ventas)
    except RuntimeError as exc:
        print(f"FAIL create sale: {exc}")
        return 1

    request_resp = cajero.post(
        f"{API}/caja/facturas/{sale_id}/solicitud-descuento-tarjeta",
        json={
            "justificacion_interna": (
                f"Prueba pestaña aprobaciones {RUN}: cliente paga con tarjeta "
                "y requiere mantener descuento negociado."
            ),
            "mostrar_al_cliente": False,
        },
        timeout=60,
    )
    if request_resp.status_code != 200:
        print(f"FAIL request: {request_resp.status_code} {request_resp.text[:300]}")
        return 1

    request_id = str(request_resp.json().get("request_id") or "")
    if not request_id:
        print("FAIL: no request_id")
        return 1

    approvals_resp = gerencia.get(f"{API}/approvals", params={"pending_only": True}, timeout=60)
    if approvals_resp.status_code != 200:
        print(f"FAIL approvals list: {approvals_resp.status_code} {approvals_resp.text[:300]}")
        return 1

    items = approvals_resp.json()
    match = next((row for row in items if row.get("approval_id") == request_id), None)
    if not match:
        print(f"FAIL: request {request_id} not found in /approvals ({len(items)} items)")
        print("Sample types:", [row.get("type") for row in items[:8]])
        return 1

    if match.get("type") != "pos_discount_card" or match.get("source") != "sale_request":
        print("FAIL: unexpected approval row", json.dumps(match, ensure_ascii=False)[:500])
        return 1

    approve_resp = gerencia.post(
        f"{API}/sales/requests/{request_id}/approve-pos-discount",
        json={},
        timeout=60,
    )
    if approve_resp.status_code != 200:
        print(f"FAIL approve from approvals tab flow: {approve_resp.status_code} {approve_resp.text[:300]}")
        return 1

    after_resp = gerencia.get(f"{API}/approvals", params={"pending_only": True}, timeout=60)
    still_there = any(row.get("approval_id") == request_id for row in after_resp.json())
    if still_there:
        print("FAIL: approved request still listed as pending")
        return 1

    print(f"OK: solicitud {request_id} visible y aprobable desde pestaña Aprobaciones")
    return 0


if __name__ == "__main__":
    sys.exit(main())