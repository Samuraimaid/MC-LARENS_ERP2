#!/usr/bin/env python3
"""Live flow end-to-end: cliente → venta mixta con plan → voucher → lookup caja → cobro."""
from __future__ import annotations

import json
import sys
import uuid
from typing import Any, Dict, List, Tuple

import requests

from backend.domains.sales.seller_voucher_escpos import (
    build_seller_voucher_escpos,
    is_valid_invoice_barcode,
    normalize_invoice_scan_code,
)

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
        data = r.json()
        token = data.get("session_token")
        if token:
            self.s.cookies.set("session_token", token)
        return data.get("user") or {}

    def get(self, path: str, params: Dict[str, Any] | None = None) -> requests.Response:
        return self.s.get(f"{API_BASE}{path}", params=params, timeout=60)

    def post(self, path: str, body: Any = None) -> requests.Response:
        return self.s.post(f"{API_BASE}{path}", json=body, timeout=120)

    def patch(self, path: str, body: Any = None) -> requests.Response:
        return self.s.patch(f"{API_BASE}{path}", json=body, timeout=120)


def pick_customer_with_vehicle(gerencia: Client) -> Tuple[str, str]:
    customers = gerencia.get("/customers").json()
    vehicles = gerencia.get("/vehicles").json()
    if not isinstance(customers, list):
        raise RuntimeError(f"Respuesta inesperada de /customers: {str(customers)[:200]}")
    if not isinstance(vehicles, list):
        raise RuntimeError(f"Respuesta inesperada de /vehicles: {str(vehicles)[:200]}")
    by_customer: Dict[str, List[Dict[str, Any]]] = {}
    for vehicle in vehicles:
        cid = vehicle.get("customer_id")
        if cid:
            by_customer.setdefault(cid, []).append(vehicle)
    natural_types = {"", "natural", "persona", "persona_natural", "individual"}
    eligible = [
        row for row in customers
        if by_customer.get(row.get("customer_id"))
        and str(row.get("customer_type") or "natural").lower() in natural_types
    ]
    if not eligible:
        raise RuntimeError("No hay clientes con vehículo")
    customer = eligible[0]
    vehicle = by_customer[customer["customer_id"]][0]
    return customer["customer_id"], vehicle.get("vehicle_id") or vehicle.get("id")


def pick_product(gerencia: Client) -> Dict[str, Any]:
    products = gerencia.get("/products").json()
    inventory = gerencia.get("/inventory").json()
    stock: Dict[str, float] = {}
    for row in inventory:
        if str(row.get("warehouse_id") or "") != WAREHOUSE_ID:
            continue
        pid = row.get("product_id")
        stock[pid] = stock.get(pid, 0) + float(row.get("quantity") or 0)
    physical = sorted(
        [
            row for row in products
            if row.get("product_type") != "service" and stock.get(row.get("product_id"), 0) >= 2
        ],
        key=lambda row: stock.get(row.get("product_id"), 0),
        reverse=True,
    )
    if not physical:
        raise RuntimeError("Stock insuficiente para prueba")
    return physical[0]


def compute_total_nio(unit_price: float, rate: float) -> float:
    return round(unit_price * rate * 1.15, 2)


def split_mixed_total(total: float) -> Tuple[float, float]:
    cash_part = round(total * 0.6, 2)
    card_part = round(total - cash_part, 2)
    return cash_part, card_part


def ensure_cash_session(cajero: Client, gerencia: Client) -> str:
    active = cajero.get("/caja/sesion-activa").json()
    if active.get("active") and active.get("session", {}).get("session_id"):
        return str(active["session"]["session_id"])

    rate_doc = gerencia.get("/currencies/usd-nio-effective").json()
    rate = float(rate_doc.get("rate") or 36.5)
    payload = {
        "caja_id": "CAJA-01",
        "tipo_cambio_usd_nio": rate,
        "denominaciones": [
            {"moneda": "NIO", "tipo": "billete", "valor_nominal": 100, "cantidad": 20},
        ],
        "observaciones": f"Apertura live payment plan {uuid.uuid4().hex[:8]}",
    }
    opened = cajero.post("/caja/apertura", body=payload)
    if opened.status_code == 200:
        return str(opened.json().get("session_id"))
    fallback = gerencia.get("/caja/sesion-activa").json()
    if fallback.get("active"):
        return str(fallback["session"]["session_id"])
    raise RuntimeError(f"No se pudo abrir caja: {opened.status_code} {opened.text[:300]}")


def find_sale_in_caja(cajero: Client, sale_id: str) -> Dict[str, Any]:
    tabs = cajero.get("/caja/facturas", params={"tab": "cotizacion"})
    tabs.raise_for_status()
    payload = tabs.json()
    rows = payload.get("rows") if isinstance(payload, dict) else payload
    rows = rows if isinstance(rows, list) else []
    for row in rows:
        if str(row.get("sale_id")) == str(sale_id):
            return row
    raise RuntimeError(f"Sale {sale_id} no visible en caja cotizacion")


def lookup_invoice_by_barcode(cajero: Client, invoice: str) -> Dict[str, Any]:
    code = normalize_invoice_scan_code(invoice)
    if not is_valid_invoice_barcode(code):
        raise RuntimeError(f"Invoice {invoice} no cumple formato INV-YYYYMMDD-####")
    response = cajero.get("/caja/facturas/lookup", params={"code": code})
    if response.status_code != 200:
        raise RuntimeError(f"Lookup {code} falló: {response.status_code} {response.text[:300]}")
    body = response.json()
    row = body.get("row") or {}
    if not row.get("sale_id"):
        raise RuntimeError(f"Lookup {code} sin sale_id")
    return row


def assert_voucher_generated(ventas: Client, sale: Dict[str, Any]) -> str:
    sale_id = str(sale["sale_id"])
    invoice = str(sale.get("invoice_number") or "")
    code = normalize_invoice_scan_code(invoice)
    if not is_valid_invoice_barcode(code):
        raise RuntimeError(f"Voucher sin invoice válido: {invoice}")

    text_resp = ventas.get(f"/print/seller-voucher/{sale_id}")
    if text_resp.status_code != 200:
        raise RuntimeError(f"Voucher texto falló: {text_resp.status_code} {text_resp.text[:200]}")
    if code not in text_resp.text.upper():
        raise RuntimeError(f"Voucher texto no contiene {code}")

    pdf_resp = ventas.get(f"/print/seller-voucher/{sale_id}/preview-pdf")
    if pdf_resp.status_code != 200:
        raise RuntimeError(f"Voucher PDF falló: {pdf_resp.status_code}")
    if "pdf" not in (pdf_resp.headers.get("content-type") or "").lower():
        raise RuntimeError("Preview PDF no devolvió application/pdf")
    if len(pdf_resp.content) < 500:
        raise RuntimeError("Preview PDF demasiado pequeño")

    escpos = build_seller_voucher_escpos(sale, text_lines=text_resp.text.splitlines())
    if code.encode("ascii") not in escpos:
        raise RuntimeError("ESC/POS no contiene invoice en texto")
    if b"\x1d\x6b\x49" not in escpos:
        raise RuntimeError("ESC/POS no contiene barcode Code128")

    print(f"voucher ok invoice={code} escpos_bytes={len(escpos)} pdf_bytes={len(pdf_resp.content)}")
    return code


def main() -> int:
    gerencia = Client("gerencia")
    ventas = Client("ventas")
    cajero = Client("cajero")

    gerencia.login(PIN_GERENCIA)
    ventas.login(PIN_VENTAS)
    cajero.login(PIN_CAJERO)

    print("=== [GERENCIA] Catálogo: cliente con vehículo y producto con stock ===")
    customer_id, vehicle_id = pick_customer_with_vehicle(gerencia)
    product = pick_product(gerencia)
    print(f"cliente={customer_id} vehiculo={vehicle_id} producto={product.get('product_id')}")
    rate = float(gerencia.get("/currencies/usd-nio-effective").json().get("rate") or 36.5)
    unit_price = float(product.get("price") or 0)
    total_nio = compute_total_nio(unit_price, rate)
    cash_part, card_part = split_mixed_total(total_nio)

    print(f"total_nio={total_nio} cash={cash_part} card={card_part}")

    create_payload = {
        "customer_id": customer_id,
        "vehicle_id": vehicle_id,
        "items": [
            {
                "product_id": product["product_id"],
                "quantity": 1,
                "discount": 0,
                "unit_price": unit_price,
                "warehouse_id": WAREHOUSE_ID,
                "with_installation": False,
            }
        ],
        "discount": 0,
        "payment_type": "mixed",
        "payment_method": "mixed",
        "mixed_payment_methods": ["cash", "card"],
        "apply_iva": True,
        "iva_rate": 15,
        "currency": "NIO",
        "exchange_rate": rate,
        "total_amount": total_nio,
        "planned_payment_plan": {
            "mode": "mixed",
            "lines": [
                {"metodo": "cash", "moneda": "NIO", "monto_origen": cash_part},
                {"metodo": "card", "moneda": "NIO", "monto_origen": card_part},
            ],
        },
        "idempotency_key": f"live_plan_{uuid.uuid4().hex[:10]}",
    }
    print("=== [VENDEDOR] Crear venta mixta con plan de cobro obligatorio ===")
    created = ventas.post("/sales", create_payload)
    print("create sale:", created.status_code, created.text[:500])
    if created.status_code != 200:
        return 1

    sale = created.json()
    sale_id = sale["sale_id"]
    invoice = sale.get("invoice_number")
    print(f"OK sale {invoice} ({sale_id})")

    print("=== [VENDEDOR] Generar voucher (texto, PDF, barcode ESC/POS) ===")
    barcode_code = assert_voucher_generated(ventas, sale)

    print("=== [CAJERO] Identificar factura por código de barras del voucher ===")
    lookup_row = lookup_invoice_by_barcode(cajero, barcode_code)
    if str(lookup_row.get("sale_id")) != str(sale_id):
        raise RuntimeError("Lookup no devolvió el mismo sale_id")
    print("lookup ok sale_id=", lookup_row.get("sale_id"), "invoice=", lookup_row.get("invoice_number"))

    caja_row = find_sale_in_caja(cajero, sale_id)
    assert caja_row.get("payment_plan_locked"), "Se esperaba plan bloqueado en caja"
    print("caja cotizacion plan locked:", caja_row.get("payment_plan_locked"))

    session_id = ensure_cash_session(cajero, gerencia)
    print("=== [CAJERO] Cobro incorrecto (tarjeta distinta al plan) → debe rechazar ===")
    wrong_collect = cajero.post(
        f"/caja/facturas/{sale_id}/cobrar",
        {
            "sesion_id": session_id,
            "amount": total_nio,
            "payment_method": "mixed",
            "pagos": [
                {"metodo": "cash", "moneda": "NIO", "monto_origen": cash_part},
                {
                    "metodo": "card",
                    "moneda": "NIO",
                    "monto_origen": round(card_part - 10, 2),
                    "card_type": "debit",
                    "bank_name": "BAC",
                    "transaction_number": f"WRONG{uuid.uuid4().hex[:8]}",
                    "referencia_bancaria": "REF-WRONG",
                },
            ],
            "idempotency_key": f"live_wrong_{uuid.uuid4().hex[:8]}",
        },
    )
    print("wrong collect status:", wrong_collect.status_code)
    if wrong_collect.status_code != 409:
        print(wrong_collect.text[:500])
        return 1

    print("=== [GERENCIA] Actualizar plan de cobro acordado ===")
    new_cash = round(cash_part + 10, 2)
    new_card = round(total_nio - new_cash, 2)
    patched = gerencia.patch(
        f"/sales/{sale_id}/payment-plan",
        {
            "planned_payment_plan": {
                "mode": "mixed",
                "lines": [
                    {"metodo": "cash", "moneda": "NIO", "monto_origen": new_cash},
                    {"metodo": "card", "moneda": "NIO", "monto_origen": new_card},
                ],
            },
            "mixed_payment_methods": ["cash", "card"],
            "reason": "Cliente cambió proporción de efectivo y tarjeta en mostrador",
        },
    )
    print("patch plan:", patched.status_code, patched.text[:400])
    if patched.status_code != 200:
        return 1

    print("=== [CAJERO] Re-lookup voucher y cobro correcto según plan actualizado ===")
    lookup_after_patch = lookup_invoice_by_barcode(cajero, barcode_code)
    if str(lookup_after_patch.get("sale_id")) != str(sale_id):
        raise RuntimeError("Lookup post-patch no coincide")

    ok_collect = cajero.post(
        f"/caja/facturas/{sale_id}/cobrar",
        {
            "sesion_id": session_id,
            "amount": total_nio,
            "payment_method": "mixed",
            "pagos": [
                {"metodo": "cash", "moneda": "NIO", "monto_origen": new_cash},
                {
                    "metodo": "card",
                    "moneda": "NIO",
                    "monto_origen": new_card,
                    "card_type": "debit",
                    "bank_name": "BAC",
                    "transaction_number": f"LIVE{uuid.uuid4().hex[:8]}",
                    "referencia_bancaria": "REF-LIVE-001",
                },
            ],
            "idempotency_key": f"live_ok_{uuid.uuid4().hex[:8]}",
        },
    )
    print("ok collect:", ok_collect.status_code, ok_collect.text[:400])
    if ok_collect.status_code != 200:
        return 1

    paid_row = cajero.get("/caja/facturas", params={"tab": "pagadas"}).json()
    paid_rows = paid_row.get("rows") if isinstance(paid_row, dict) else paid_row
    paid_rows = paid_rows if isinstance(paid_rows, list) else []
    visible_paid = any(str(row.get("sale_id")) == str(sale_id) for row in paid_rows)
    print("visible in pagadas:", visible_paid)

    paid_lookup = cajero.get("/caja/facturas/lookup", params={"code": barcode_code})
    print("lookup after paid status:", paid_lookup.status_code)
    if paid_lookup.status_code != 409:
        print(paid_lookup.text[:300])
        return 1

    print(json.dumps({
        "sale_id": sale_id,
        "invoice": invoice,
        "barcode": barcode_code,
        "roles": ["vendedor", "gerencia", "cajero"],
        "result": "ok",
    }, ensure_ascii=False))
    return 0 if visible_paid else 1


if __name__ == "__main__":
    sys.exit(main())