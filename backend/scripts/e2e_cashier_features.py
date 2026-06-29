#!/usr/bin/env python3
"""Live E2E: abonos parciales, búsqueda de clientes y solicitud remota descuento+tarjeta."""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import requests

from backend.scripts.e2e_sale_helpers import (
    build_sale_create_payload,
    compute_sale_total_nio,
    round2,
)

API_BASE = "http://127.0.0.1:8001/api"
PIN_GERENCIA = "01011990"
PIN_CAJERO = "11223344"
PIN_VENTAS = "55667788"
BRANCH_ID = "branch_main"
WAREHOUSE_ID = "wh_main"
EXCHANGE_RATE = 36.5
RUN_TAG = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
REPORT_DIR = Path(__file__).resolve().parents[2] / "backend" / "data"

REPORT: Dict[str, Any] = {"run_tag": RUN_TAG, "ok": [], "failed": []}


def ok(msg: str) -> None:
    print(f"OK: {msg}")
    REPORT["ok"].append(msg)


def fail(msg: str, detail: str = "") -> None:
    print(f"FAIL: {msg}")
    if detail:
        print(detail)
    REPORT["failed"].append({"msg": msg, "detail": detail})


class ApiClient:
    def __init__(self, label: str):
        self.label = label
        self.session = requests.Session()
        self.user: Dict[str, Any] = {}

    def login(self, pin: str) -> Dict[str, Any]:
        r = self.session.post(f"{API_BASE}/auth/pin/login", json={"pin": pin}, timeout=30)
        if r.status_code != 200:
            raise RuntimeError(f"Login {self.label} failed: {r.status_code} {r.text[:300]}")
        self.user = r.json().get("user") or {}
        return self.user

    def get(self, path: str, **kwargs) -> requests.Response:
        return self.session.get(f"{API_BASE}{path}", timeout=60, **kwargs)

    def post(self, path: str, json_body: Any = None, **kwargs) -> requests.Response:
        return self.session.post(f"{API_BASE}{path}", json=json_body, timeout=120, **kwargs)


def open_cash_session(cajero: ApiClient) -> str:
    date_token = datetime.now(timezone.utc).strftime("%Y%m%d")
    caja_id = f"caja-branchmain-{date_token}"
    r = cajero.post(
        "/caja/apertura",
        json_body={
            "caja_id": caja_id,
            "denominaciones": [],
            "tipo_cambio_usd_nio": EXCHANGE_RATE,
            "observaciones": f"E2E cashier features {RUN_TAG}",
        },
    )
    if r.status_code != 200:
        active = cajero.get("/caja/sesion-activa", params={"caja_id": caja_id})
        if active.status_code == 200 and active.json().get("active"):
            return str(active.json()["session"]["session_id"])
        raise RuntimeError(f"No se pudo abrir caja: {r.status_code} {r.text[:300]}")
    return str(r.json().get("session_id"))


def pick_catalog(ventas: ApiClient) -> Dict[str, Any]:
    products = ventas.get("/products").json()
    inventory = ventas.get("/inventory").json()
    customers = ventas.get("/customers").json()
    vehicles = ventas.get("/vehicles").json()

    stock_by_product: Dict[str, float] = {}
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

    return {
        "customer": customer,
        "vehicle_id": vehicle_id,
        "product": product_candidates[0][1],
        "product_candidates": [row[1] for row in product_candidates[:12]],
    }


def create_sale_with_plan(ventas: ApiClient, catalog: Dict[str, Any], **kwargs: Any) -> Dict[str, Any]:
    customer = catalog["customer"]
    product = catalog["product"]
    last_error = ""
    for candidate in catalog.get("product_candidates") or [product]:
        payload = build_sale_create_payload(
            customer_id=customer["customer_id"],
            vehicle_id=catalog.get("vehicle_id"),
            product_id=candidate["product_id"],
            unit_price=float(candidate.get("price") or 0),
            warehouse_id=WAREHOUSE_ID,
            exchange_rate=EXCHANGE_RATE,
            **kwargs,
        )
        response = ventas.post("/sales", payload)
        if response.status_code == 200:
            return response.json()
        last_error = response.text[:400]
    raise RuntimeError(f"No se pudo crear factura: {last_error}")


def bootstrap_open_invoices(ventas: ApiClient, catalog: Dict[str, Any]) -> Dict[str, Any]:
    plain_sale = create_sale_with_plan(
        ventas,
        catalog,
        payment_method="cash",
        notes=f"E2E cashier bootstrap {RUN_TAG}",
        idempotency_key=f"e2e_cash_plain_{RUN_TAG}",
    )
    discount_sale = create_sale_with_plan(
        ventas,
        catalog,
        payment_method="cash",
        discount_percent=5,
        supervisor_discount_preapproved=True,
        notes=f"E2E cashier bootstrap discount {RUN_TAG}",
        idempotency_key=f"e2e_cash_disc_{RUN_TAG}",
    )
    return {"plain": plain_sale, "discount": discount_sale}


def pick_cash_open_invoice(cajero: ApiClient) -> Optional[Dict[str, Any]]:
    rows = cajero.get(
        "/caja/facturas",
        params={"tab": "abiertas", "branch_id": BRANCH_ID, "limit": 80},
    ).json().get("rows") or []
    for row in rows:
        method = str(row.get("payment_method") or row.get("payment_type") or "").lower()
        pending = float(row.get("amount_pending") or 0)
        if method == "cash" and pending > 20:
            return row
    return None


def main() -> int:
    cajero = ApiClient("cajero")
    gerencia = ApiClient("gerencia")
    ventas = ApiClient("ventas")
    cajero.login(PIN_CAJERO)
    gerencia.login(PIN_GERENCIA)
    ventas.login(PIN_VENTAS)

    session_id = open_cash_session(cajero)
    ok(f"Sesión de caja activa: {session_id}")

    catalog = pick_catalog(ventas)
    partial_sale = create_sale_with_plan(
        ventas,
        catalog,
        payment_method="cash",
        notes=f"E2E abono parcial dedicado {RUN_TAG}",
        idempotency_key=f"e2e_partial_{RUN_TAG}",
    )
    ok(f"Factura cash para abono parcial: {partial_sale.get('invoice_number')}")

    invoice = pick_cash_open_invoice(cajero)
    if not invoice or str(invoice.get("sale_id")) != str(partial_sale.get("sale_id")):
        invoice = {
            "sale_id": partial_sale["sale_id"],
            "customer_name": partial_sale.get("customer_name"),
            "payment_method": "cash",
            "amount_pending": partial_sale.get("net_to_collect") or partial_sale.get("total"),
        }

    sale_id = str(invoice["sale_id"])
    pending = float(invoice.get("amount_pending") or partial_sale.get("net_to_collect") or partial_sale.get("total") or 0)
    partial_amount = round2(max(min(pending * 0.4, pending - 1), 1))
    payment_method = str(invoice.get("payment_method") or partial_sale.get("payment_method") or "cash")

    r_partial = cajero.post(
        f"/caja/facturas/{sale_id}/cobrar",
        json_body={
            "sesion_id": session_id,
            "amount": partial_amount,
            "payment_method": payment_method,
            "notes": f"E2E abono parcial {RUN_TAG}",
            "idempotency_key": f"partial_{RUN_TAG}",
        },
    )
    if r_partial.status_code != 200:
        fail("Abono parcial en caja", f"{r_partial.status_code} {r_partial.text[:400]}")
    else:
        body = r_partial.json()
        new_pending = float(body.get("amount_pending") or 0)
        if body.get("sale_payment_status") == "partial" or new_pending > 0:
            ok(f"Abono parcial aplicado. Pendiente restante C${new_pending:.2f}")
        else:
            fail("Abono parcial no dejó saldo pendiente como se esperaba", json.dumps(body)[:400])

        r_final = cajero.post(
            f"/caja/facturas/{sale_id}/cobrar",
            json_body={
                "sesion_id": session_id,
                "amount": new_pending,
                "payment_method": payment_method,
                "notes": f"E2E saldo final {RUN_TAG}",
                "idempotency_key": f"final_{RUN_TAG}",
            },
        )
        if r_final.status_code != 200:
            fail("Cobro final tras abono parcial", f"{r_final.status_code} {r_final.text[:400]}")
        else:
            ok("Saldo final cobrado tras abono parcial")

    search_term = str(invoice.get("customer_name") or partial_sale.get("customer_name") or "")[:8].strip()
    r_clients = cajero.get(
        "/caja/clientes-pendientes",
        params={"search": search_term, "branch_id": BRANCH_ID, "limit": 20},
    )
    if r_clients.status_code != 200:
        fail("Búsqueda clientes pendientes", f"{r_clients.status_code} {r_clients.text[:300]}")
    else:
        customers = r_clients.json().get("customers") or []
        if customers:
            ok(f"Búsqueda clientes pendientes devolvió {len(customers)} cliente(s)")
        else:
            fail("Búsqueda clientes pendientes sin resultados", f"search={search_term}")

    discount_seed = create_sale_with_plan(
        ventas,
        catalog,
        payment_method="cash",
        discount_percent=5,
        supervisor_discount_preapproved=True,
        notes=f"E2E cashier bootstrap discount {RUN_TAG}",
        idempotency_key=f"e2e_cash_disc2_{RUN_TAG}",
    )
    d_sale_id = str(discount_seed["sale_id"])
    discount_invoice = cajero.get("/caja/facturas", params={"tab": "abiertas", "search": d_sale_id, "limit": 5}).json()
    discount_row = next(
        (r for r in (discount_invoice.get("rows") or []) if r.get("sale_id") == d_sale_id),
        discount_seed,
    )
    justification = f"Solicitud E2E caja {RUN_TAG}: cliente paga con tarjeta y requiere mantener descuento negociado."

    r_req = cajero.post(
        f"/caja/facturas/{d_sale_id}/solicitud-descuento-tarjeta",
        json_body={"justificacion_interna": justification, "mostrar_al_cliente": False},
    )
    if r_req.status_code != 200:
        fail("Solicitud descuento+tarjeta desde caja", f"{r_req.status_code} {r_req.text[:400]}")
    else:
        body = r_req.json()
        request_id = str(body.get("request_id") or "")
        status = str(body.get("status") or "")
        if status == "pending":
            ok(f"Solicitud remota enviada: {request_id}")
        elif status == "approved":
            fail("La factura nueva ya estaba autorizada; limpiar datos de prueba", json.dumps(body)[:300])
        else:
            fail("Respuesta inesperada al solicitar autorización", json.dumps(body)[:300])

        r_status = cajero.get(f"/caja/facturas/{d_sale_id}/estado-autorizacion-descuento-tarjeta")
        if r_status.status_code == 200 and r_status.json().get("status") == "pending":
            ok("Estado de solicitud = pending")
        else:
            fail("Estado de solicitud no quedó pending", r_status.text[:300])

        pending_amount = float(
            discount_row.get("amount_pending")
            or discount_seed.get("amount_pending")
            or discount_seed.get("total")
            or 0,
        )
        r_block = cajero.post(
            f"/caja/facturas/{d_sale_id}/cobrar",
            json_body={
                "sesion_id": session_id,
                "amount": pending_amount,
                "payment_method": "card",
                "reference": f"REF-{RUN_TAG}",
                "card_type": "credit",
                "bank_name": "BAC",
                "transaction_number": f"TX-{RUN_TAG}",
            },
        )
        if r_block.status_code == 409:
            ok("Cobro bloqueado sin aprobación remota (seguridad OK)")
        else:
            fail("Se esperaba bloqueo 409 sin aprobación", f"{r_block.status_code} {r_block.text[:300]}")

        if request_id:
            r_approve = gerencia.post(f"/sales/requests/{request_id}/approve-pos-discount", json_body={})
            if r_approve.status_code != 200:
                fail("Aprobación gerencia de solicitud POS", f"{r_approve.status_code} {r_approve.text[:300]}")
            else:
                ok("Gerencia aprobó solicitud descuento+tarjeta")

            time.sleep(0.5)
            r_status2 = cajero.get(f"/caja/facturas/{d_sale_id}/estado-autorizacion-descuento-tarjeta")
            if r_status2.status_code == 200 and r_status2.json().get("status") == "approved":
                ok("Estado de solicitud = approved")
            else:
                fail("Estado no quedó approved tras aprobación", r_status2.text[:300])

            r_card = cajero.post(
                f"/caja/facturas/{d_sale_id}/cobrar",
                json_body={
                    "sesion_id": session_id,
                    "amount": pending_amount,
                    "payment_method": "card",
                    "reference": f"REF-{RUN_TAG}-2",
                    "card_type": "credit",
                    "bank_name": "BAC",
                    "transaction_number": f"TX-{RUN_TAG}-2",
                },
            )
            if r_card.status_code == 200:
                ok("Cobro con tarjeta tras aprobación remota completado")
            else:
                fail("Cobro con tarjeta tras aprobación", f"{r_card.status_code} {r_card.text[:400]}")

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORT_DIR / f"e2e_cashier_features_{RUN_TAG}.json"
    report_path.write_text(json.dumps(REPORT, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Reporte: {report_path}")
    print(f"Resumen: {len(REPORT['ok'])} OK | {len(REPORT['failed'])} FAIL")
    return 0 if not REPORT["failed"] else 1


if __name__ == "__main__":
    sys.exit(main())