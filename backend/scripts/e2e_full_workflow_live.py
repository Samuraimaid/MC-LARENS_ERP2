#!/usr/bin/env python3
"""Live E2E: 5 ventas con flujo borrador → gerencia → vendedor → caja → despacho/instalación."""
from __future__ import annotations

import json
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests

API_BASE = "http://127.0.0.1:8001/api"
PIN_VENTAS = "55667788"
PIN_GERENCIA = "01011990"
PIN_CAJERO = "11223344"
BRANCH_ID = "branch_main"
WAREHOUSE_ID = "wh_main"
EXCHANGE_RATE = 36.5
RUN_TAG = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

REPORT: Dict[str, Any] = {
    "run_tag": RUN_TAG,
    "ok": [],
    "fixed": [],
    "failed": [],
    "sales": [],
    "new_users": [],
}


def log_ok(msg: str) -> None:
    print(f"OK: {msg}")
    REPORT["ok"].append(msg)


def log_fail(msg: str, detail: str = "") -> None:
    print(f"FAIL: {msg}")
    if detail:
        print(detail)
    REPORT["failed"].append({"msg": msg, "detail": detail})


def log_fixed(msg: str) -> None:
    print(f"FIXED: {msg}")
    REPORT["fixed"].append(msg)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ApiClient:
    def __init__(self, label: str):
        self.label = label
        self.session = requests.Session()
        self.user: Dict[str, Any] = {}

    def login(self, pin: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"pin": pin}
        if user_id:
            payload["user_id"] = user_id
        r = self.session.post(f"{API_BASE}/auth/pin/login", json=payload, timeout=30)
        if r.status_code != 200:
            raise RuntimeError(f"Login {self.label} failed: {r.status_code} {r.text[:300]}")
        data = r.json()
        self.user = data.get("user") or {}
        return self.user

    def get(self, path: str, **kwargs) -> requests.Response:
        return self.session.get(f"{API_BASE}{path}", timeout=60, **kwargs)

    def post(self, path: str, json_body: Any = None, **kwargs) -> requests.Response:
        return self.session.post(f"{API_BASE}{path}", json=json_body, timeout=120, **kwargs)

    def put(self, path: str, json_body: Any = None, **kwargs) -> requests.Response:
        return self.session.put(f"{API_BASE}{path}", json=json_body, timeout=120, **kwargs)


def ensure_coordinator_users(gerencia: ApiClient) -> List[Dict[str, Any]]:
    existing = gerencia.get("/auth/pin/users").json()
    have_roles = {str(u.get("role")) for u in existing}
    created: List[Dict[str, Any]] = []
    specs = [
        {
            "name": "Ricardo Antonio",
            "last_name": "Mejía Ubeda",
            "phone": "8801-4521",
            "role": "coordinador_instalaciones",
            "login_pin": "88112233",
        },
        {
            "name": "Gabriela María",
            "last_name": "Zeledón Pérez",
            "phone": "8802-7634",
            "role": "coordinador_polarizados",
            "login_pin": "88223344",
        },
    ]
    for spec in specs:
        if spec["role"] in have_roles:
            continue
        body = {
            "name": spec["name"],
            "last_name": spec["last_name"],
            "phone": spec["phone"],
            "role": spec["role"],
            "branch_id": BRANCH_ID,
            "warehouse_id": None,
            "login_pin": spec["login_pin"],
            "pin": f"{int(spec['phone'].split('-')[0][-4:]):04d}",
        }
        r = gerencia.post("/users/pin", json_body=body)
        if r.status_code != 200:
            raise RuntimeError(f"No se pudo crear {spec['role']}: {r.status_code} {r.text[:300]}")
        user = r.json()
        row = {
            "user_id": user.get("user_id"),
            "nombre": f"{spec['name']} {spec['last_name']}",
            "telefono": spec["phone"],
            "rol": spec["role"],
            "pin_login": spec["login_pin"],
            "pin_marcacion": body["pin"],
        }
        created.append(row)
        REPORT["new_users"].append(row)
        log_ok(f"Usuario creado: {row['nombre']} ({row['rol']})")
    return created


def load_catalog(gerencia: ApiClient) -> Tuple[List[Dict], List[Dict], List[Dict], float]:
    customers = gerencia.get("/customers").json()
    products = gerencia.get("/products").json()
    inventory = gerencia.get("/inventory").json()
    vehicles = gerencia.get("/vehicles").json()
    rate_doc = gerencia.get("/settings/exchange-rate").json()
    rate = float(rate_doc.get("usd_to_nio") or EXCHANGE_RATE)

    stock_by_product: Dict[str, float] = {}
    wh_by_product: Dict[str, str] = {}
    for row in inventory:
        pid = row.get("product_id")
        qty = float(row.get("quantity") or 0)
        if qty <= 0:
            continue
        stock_by_product[pid] = stock_by_product.get(pid, 0) + qty
        if row.get("warehouse_id") == WAREHOUSE_ID:
            wh_by_product[pid] = WAREHOUSE_ID

    physical: List[Dict[str, Any]] = []
    for p in products:
        if p.get("product_type") == "service":
            continue
        pid = p.get("product_id")
        if stock_by_product.get(pid, 0) < 30:
            continue
        physical.append(
            {
                "product_id": pid,
                "product_name": p.get("name"),
                "unit_price": float(p.get("price") or 0),
                "installation_type": p.get("installation_type") or "optional",
                "installation_price": float(p.get("installation_price") or 0),
                "category": p.get("category") or "",
                "warehouse_id": wh_by_product.get(pid, WAREHOUSE_ID),
            }
        )

    if len(physical) < 15:
        raise RuntimeError("Stock insuficiente para 5 ventas x 10 productos")

    cust_with_vehicle: List[Dict[str, Any]] = []
    vehicles_by_customer: Dict[str, List[Dict]] = {}
    for v in vehicles:
        cid = v.get("customer_id")
        if cid:
            vehicles_by_customer.setdefault(cid, []).append(v)
    for c in customers:
        cid = c.get("customer_id")
        if vehicles_by_customer.get(cid):
            cust_with_vehicle.append(c)
    if len(cust_with_vehicle) < 5:
        raise RuntimeError("Se necesitan al menos 5 clientes con vehículo")

    return physical, cust_with_vehicle[:5], vehicles_by_customer, rate


def make_cart_item(product: Dict[str, Any], with_installation: bool) -> Dict[str, Any]:
    return {
        "product_id": product["product_id"],
        "product_name": product["product_name"],
        "quantity": 1,
        "unit_price": product["unit_price"],
        "original_unit_price": product["unit_price"],
        "discount": 0,
        "warehouse_id": product["warehouse_id"],
        "installation_type": product["installation_type"],
        "with_installation": with_installation,
        "installation_price": product["installation_price"],
    }


def build_snapshot(
    customer_id: str,
    vehicle_id: str,
    cart_items: List[Dict[str, Any]],
    exchange_rate: float,
    global_mode: str = "percent",
    global_value: float = 0,
) -> Dict[str, Any]:
    return {
        "selectedCustomerId": customer_id,
        "selectedVehicle": vehicle_id,
        "vehicleFlowOption": "registered",
        "selectedWarehouse": WAREHOUSE_ID,
        "cartItems": cart_items,
        "paymentMethod": "cash",
        "mixedPaymentMethods": [],
        "globalDiscountMode": global_mode,
        "globalDiscount": global_value,
        "notes": f"E2E workflow {RUN_TAG}",
        "applyIVA": True,
        "ivaRate": 15.0,
        "applyRetention": False,
        "retentionRate": 2,
        "currency": "NIO",
        "exchangeRate": exchange_rate,
        "appliedDiscounts": [],
        "updatedAt": now_iso(),
    }


def apply_line_discount_nio(cart_items: List[Dict[str, Any]], amount_nio: float, exchange_rate: float) -> None:
    if not cart_items:
        return
    target = cart_items[0]
    qty = max(1, int(target.get("quantity") or 1))
    original = float(target.get("original_unit_price") or target.get("unit_price") or 0)
    discount_usd = amount_nio / exchange_rate / qty
    new_price = max(0.01, original - discount_usd)
    target["unit_price"] = round(new_price, 4)
    target["original_unit_price"] = original


def save_draft(client: ApiClient, draft_id: str, name: str, snapshot: Dict[str, Any]) -> Dict[str, Any]:
    r = client.put(
        f"/drafts/sale/{draft_id}",
        json_body={"name": name, "snapshot": snapshot},
    )
    if r.status_code != 200:
        raise RuntimeError(f"save_draft {draft_id}: {r.status_code} {r.text[:400]}")
    return r.json()


def watch_draft(gerencia: ApiClient, draft_id: str) -> None:
    r = gerencia.post(f"/drafts/sale/{draft_id}/review/watch")
    if r.status_code != 200:
        raise RuntimeError(f"watch_draft: {r.status_code} {r.text[:300]}")


def release_draft(gerencia: ApiClient, draft_id: str) -> Dict[str, Any]:
    r = gerencia.post(f"/drafts/sale/{draft_id}/review/release")
    if r.status_code != 200:
        raise RuntimeError(f"release_draft: {r.status_code} {r.text[:300]}")
    data = r.json()
    review = (data.get("review") or {})
    if review.get("status") != "released":
        raise RuntimeError(f"Draft {draft_id} no quedó liberado: {review}")
    return data


def snapshot_to_sale_payload(snapshot: Dict[str, Any], idem: str) -> Dict[str, Any]:
    cart = snapshot.get("cartItems") or []
    subtotal = 0.0
    for item in cart:
        price = float(item.get("unit_price") or 0)
        qty = int(item.get("quantity") or 1)
        disc = float(item.get("discount") or 0)
        line = price * qty * (1 - disc / 100)
        if item.get("with_installation"):
            line += float(item.get("installation_price") or 0) * qty
        subtotal += line
    mode = str(snapshot.get("globalDiscountMode") or "percent").lower()
    gval = float(snapshot.get("globalDiscount") or 0)
    if mode == "fixed":
        discount_pct = (gval / subtotal * 100) if subtotal > 0 else 0
    else:
        discount_pct = gval
    return {
        "customer_id": snapshot.get("selectedCustomerId"),
        "vehicle_id": snapshot.get("selectedVehicle"),
        "items": [
            {
                "product_id": i["product_id"],
                "quantity": i.get("quantity", 1),
                "discount": i.get("discount", 0),
                "unit_price": i.get("unit_price"),
                "warehouse_id": i.get("warehouse_id", WAREHOUSE_ID),
                "with_installation": bool(i.get("with_installation")),
            }
            for i in cart
        ],
        "discount": round(discount_pct, 4),
        "supervisor_discount_preapproved": True,
        "payment_type": "cash",
        "payment_method": "cash",
        "apply_iva": bool(snapshot.get("applyIVA", True)),
        "currency": snapshot.get("currency") or "NIO",
        "exchange_rate": snapshot.get("exchangeRate") or EXCHANGE_RATE,
        "notes": snapshot.get("notes"),
        "idempotency_key": idem,
    }


def ensure_cash_session(cajero: ApiClient) -> str:
    active = cajero.get("/caja/sesion-activa").json()
    if active.get("active") and active.get("session", {}).get("session_id"):
        return str(active["session"]["session_id"])

    payload = {
        "caja_id": "CAJA-01",
        "usuario_id": cajero.user.get("user_id"),
        "tipo_cambio_usd_nio": EXCHANGE_RATE,
        "denominaciones": [
            {"moneda": "NIO", "tipo": "billete", "valor_nominal": 100, "cantidad": 10},
            {"moneda": "NIO", "tipo": "billete", "valor_nominal": 50, "cantidad": 10},
        ],
        "observaciones": f"Apertura E2E {RUN_TAG}",
    }
    r = cajero.post("/caja/apertura", json_body=payload)
    if r.status_code != 200:
        # Reutilizar sesión abierta de otro cajero en la misma sucursal
        gerencia = ApiClient("gerencia-temp")
        gerencia.login(PIN_GERENCIA)
        open_sessions = gerencia.get("/caja/sesion-activa").json()
        if open_sessions.get("active"):
            return str(open_sessions["session"]["session_id"])
        raise RuntimeError(f"No se pudo abrir caja: {r.status_code} {r.text[:300]}")
    return str(r.json().get("session_id"))


def collect_invoice(cajero: ApiClient, sale_id: str, session_id: str, amount: float) -> Dict[str, Any]:
    payload = {
        "sesion_id": session_id,
        "amount": round(amount, 2),
        "payment_method": "cash",
        "received_amount": round(amount, 2),
        "idempotency_key": f"e2e_collect_{sale_id}_{uuid.uuid4().hex[:8]}",
        "notes": f"Cobro E2E {RUN_TAG}",
    }
    r = cajero.post(f"/caja/facturas/{sale_id}/cobrar", json_body=payload)
    if r.status_code != 200:
        raise RuntimeError(f"cobrar {sale_id}: {r.status_code} {r.text[:400]}")
    return r.json()


def audit_sale_discounts(spec: Dict[str, Any], sale: Dict[str, Any], exchange_rate: float) -> None:
    snapshot = spec.get("snapshot") or {}
    invoice = spec.get("invoice_number") or sale.get("sale_id")
    cart = snapshot.get("cartItems") or []
    sale_items = sale.get("items") or []

    if spec.get("discount_kind") == "line" and cart:
        draft_first = cart[0]
        sale_first = next(
            (row for row in sale_items if row.get("product_id") == draft_first.get("product_id")),
            None,
        )
        if not sale_first:
            log_fail(f"Descuento línea no reflejado en factura {invoice}", "item no encontrado")
            return
        draft_price = float(draft_first.get("unit_price") or 0)
        sale_price = float(sale_first.get("unit_price") or 0)
        if abs(draft_price - sale_price) > 0.05:
            log_fail(
                f"Desalineación descuento línea en {invoice}",
                f"draft_unit_price={draft_price} sale_unit_price={sale_price}",
            )
        else:
            log_ok(f"Descuento línea preservado en {invoice}: unit_price={sale_price}")

    if spec.get("discount_kind") == "global":
        discount_amt = float(sale.get("discount") or sale.get("discounts_applied_amount") or 0)
        subtotal = float(sale.get("subtotal") or 0)
        if subtotal > 0 and discount_amt <= 0:
            log_fail(f"Descuento global 5% ausente en {invoice}", f"subtotal={subtotal} discount={discount_amt}")
        else:
            effective_pct = (discount_amt / subtotal * 100) if subtotal else 0
            if effective_pct < 4.5:
                log_fail(
                    f"Descuento global insuficiente en {invoice}",
                    f"effective_pct={effective_pct:.2f}",
                )
            else:
                log_ok(f"Descuento global ~{effective_pct:.1f}% aplicado en {invoice}")


def audit_cashier_open_invoices(cajero: ApiClient, expected_sale_ids: List[str]) -> None:
    r = cajero.get("/caja/facturas", params={"tab": "abiertas", "limit": 200})
    if r.status_code != 200:
        log_fail("Cajero no pudo listar facturas abiertas", r.text[:300])
        return
    rows = (r.json() or {}).get("rows") or []
    open_ids = {str(row.get("sale_id")) for row in rows}
    missing = [sid for sid in expected_sale_ids if sid not in open_ids]
    if missing:
        log_fail(
            "Cajero no ve facturas abiertas de la sucursal",
            f"missing={missing} visible={len(open_ids)}",
        )
    else:
        log_ok(f"Cajero ve las {len(expected_sale_ids)} facturas abiertas en UI/API")


def cleanup_stale_open_invoices(gerencia: ApiClient, keep_sale_ids: Optional[List[str]] = None) -> int:
    keep = set(keep_sale_ids or [])
    r = gerencia.get("/caja/facturas", params={"tab": "abiertas", "limit": 200})
    if r.status_code != 200:
        return 0
    rows = (r.json() or {}).get("rows") or []
    cleaned = 0
    for row in rows:
        sale_id = str(row.get("sale_id") or "")
        if not sale_id or sale_id in keep:
            continue
        payload = {
            "motivo": "Limpieza E2E de facturas pendientes huérfanas de pruebas anteriores",
            "justificacion_interna": "Anulación automática de facturas de prueba que quedaron abiertas tras corridas E2E previas.",
            "autorizado_por": gerencia.user.get("user_id"),
        }
        resp = gerencia.post(f"/caja/facturas/{sale_id}/anular", json_body=payload)
        if resp.status_code == 200:
            cleaned += 1
            log_ok(f"Huérfana anulada: {row.get('invoice_number')} ({sale_id})")
        else:
            log_fail(
                f"No se pudo anular huérfana {row.get('invoice_number')}",
                resp.text[:200],
            )
    if cleaned:
        log_fixed(f"Limpieza: {cleaned} factura(s) huérfana(s) anulada(s)")
    return cleaned


def audit_orphan_open_invoices(gerencia: ApiClient, current_sale_ids: List[str]) -> None:
    r = gerencia.get("/caja/facturas", params={"tab": "abiertas", "limit": 200})
    if r.status_code != 200:
        return
    rows = (r.json() or {}).get("rows") or []
    orphans = [
        row.get("invoice_number")
        for row in rows
        if str(row.get("sale_id")) not in current_sale_ids
        and str(row.get("payment_status") or "").lower() in {"pending", "partial"}
    ]
    if orphans:
        log_fail("Facturas huérfanas pendientes de cobro", ", ".join(str(x) for x in orphans[:10]))
    else:
        log_ok("Sin facturas huérfanas abiertas fuera de esta ronda")


def verify_fulfillment(gerencia: ApiClient, sale_id: str, invoice: str) -> Dict[str, Any]:
    sale = gerencia.get(f"/sales/{sale_id}").json()
    dispatch_id = sale.get("dispatch_id")
    work_order_ids = sale.get("work_order_ids") or []
    if sale.get("work_order_id") and sale.get("work_order_id") not in work_order_ids:
        work_order_ids = [sale.get("work_order_id"), *work_order_ids]

    dispatch_ok = False
    if dispatch_id:
        dispatches = gerencia.get("/dispatch").json()
        dispatch_ok = any(d.get("dispatch_id") == dispatch_id for d in dispatches)

    work_orders_ok = False
    work_orders = gerencia.get("/work-orders").json()
    found_wos = [wo for wo in work_orders if wo.get("sale_id") == sale_id]
    work_orders_ok = len(found_wos) > 0

    result = {
        "sale_id": sale_id,
        "invoice_number": invoice,
        "payment_status": sale.get("payment_status"),
        "workflow_state": sale.get("workflow_state"),
        "dispatch_id": dispatch_id,
        "dispatch_ok": dispatch_ok,
        "work_order_ids": work_order_ids,
        "work_orders_found": [w.get("work_order_id") for w in found_wos],
        "work_orders_ok": work_orders_ok,
        "fulfillment_triggered_at": sale.get("fulfillment_triggered_at"),
    }
    if not dispatch_ok:
        log_fail(f"Despacho no verificado para {invoice}", str(result))
    else:
        log_ok(f"Despacho {dispatch_id} creado para {invoice}")
    if not work_orders_ok:
        log_fail(f"Órdenes instalación no verificadas para {invoice}", str(result))
    else:
        log_ok(f"Órdenes instalación {result['work_orders_found']} para {invoice}")
    return result


def run_workflow() -> None:
    gerencia = ApiClient("gerencia")
    ventas = ApiClient("ventas")
    cajero = ApiClient("cajero")

    gerencia.login(PIN_GERENCIA)
    log_ok(f"Gerencia login: {gerencia.user.get('name')}")

    cleanup_stale_open_invoices(gerencia)

    new_users = ensure_coordinator_users(gerencia)
    if not new_users:
        log_ok("Roles coordinador ya existían; no se crearon usuarios nuevos")

    physical, customers, vehicles_map, exchange_rate = load_catalog(gerencia)
    log_ok(f"Catálogo: {len(physical)} productos, {len(customers)} clientes, TC={exchange_rate}")

    ventas.login(PIN_VENTAS)
    log_ok(f"Vendedor login: {ventas.user.get('name')}")

    draft_specs: List[Dict[str, Any]] = []
    product_cursor = 0

    for idx, customer in enumerate(customers):
        customer_id = customer["customer_id"]
        vehicle_id = vehicles_map[customer_id][0]["vehicle_id"]
        draft_id = f"e2e_{RUN_TAG}_{idx + 1}"
        name = f"E2E Venta {idx + 1} ({RUN_TAG})"

        initial_items = []
        for offset in range(5):
            product = physical[(product_cursor + offset) % len(physical)]
            with_install = offset < 3  # 3 de 5 con instalación
            initial_items.append(make_cart_item(product, with_install))
        product_cursor += 5

        snapshot = build_snapshot(customer_id, vehicle_id, initial_items, exchange_rate)
        saved = save_draft(ventas, draft_id, name, snapshot)
        draft_specs.append(
            {
                "draft_id": draft_id,
                "name": name,
                "customer_id": customer_id,
                "vehicle_id": vehicle_id,
                "snapshot": saved.get("snapshot") or snapshot,
                "discount_kind": "line" if idx < 2 else "global",
            }
        )
        log_ok(f"Borrador {idx + 1}/5 creado por vendedor: {draft_id}")

    gerencia.login(PIN_GERENCIA)
    for spec in draft_specs:
        draft_id = spec["draft_id"]
        watch_draft(gerencia, draft_id)
        snapshot = dict(spec["snapshot"])
        cart = list(snapshot.get("cartItems") or [])

        if spec["discount_kind"] == "line":
            apply_line_discount_nio(cart, 500.0, exchange_rate)
            snapshot["cartItems"] = cart
            log_ok(f"Gerencia aplicó descuento línea C$500 en {draft_id}")
        else:
            snapshot["globalDiscountMode"] = "percent"
            snapshot["globalDiscount"] = 5
            log_ok(f"Gerencia aplicó descuento global 5% en {draft_id}")

        snapshot["updatedAt"] = now_iso()
        updated = save_draft(gerencia, draft_id, spec["name"], snapshot)
        review = updated.get("review") or {}
        if not review.get("supervisor_changed"):
            log_fail(f"Gerencia no marcó cambios en {draft_id}", json.dumps(review))
        release_draft(gerencia, draft_id)
        spec["snapshot"] = updated.get("snapshot") or snapshot
        log_ok(f"Borrador liberado: {draft_id}")

    ventas.login(PIN_VENTAS)
    sale_ids: List[str] = []
    for spec in draft_specs:
        draft_id = spec["draft_id"]
        snapshot = dict(spec["snapshot"])
        cart = list(snapshot.get("cartItems") or [])
        locked_ids = {i["product_id"] for i in cart}
        extra_cursor = product_cursor
        added = 0
        while added < 5:
            product = physical[extra_cursor % len(physical)]
            extra_cursor += 1
            if product["product_id"] in locked_ids:
                continue
            cart.append(make_cart_item(product, added < 2))
            locked_ids.add(product["product_id"])
            added += 1
        product_cursor = extra_cursor
        snapshot["cartItems"] = cart
        snapshot["updatedAt"] = now_iso()
        updated = save_draft(ventas, draft_id, spec["name"], snapshot)
        spec["snapshot"] = updated.get("snapshot") or snapshot
        log_ok(f"Vendedor agregó 5 productos en {draft_id}")

        payload = snapshot_to_sale_payload(spec["snapshot"], f"e2e_sale_{draft_id}")
        r = ventas.post("/sales", json_body=payload)
        if r.status_code != 200:
            raise RuntimeError(f"crear venta {draft_id}: {r.status_code} {r.text[:500]}")
        sale = r.json()
        sale_id = sale.get("sale_id")
        invoice = sale.get("invoice_number")
        sale_ids.append(sale_id)
        spec["sale_id"] = sale_id
        spec["invoice_number"] = invoice
        spec["sale_doc"] = sale
        log_ok(f"Factura enviada a caja: {invoice} ({sale_id}) items={len(payload['items'])}")
        audit_sale_discounts(spec, sale, exchange_rate)

    cajero.login(PIN_CAJERO)
    log_ok(f"Cajero login: {cajero.user.get('name')}")
    audit_cashier_open_invoices(cajero, sale_ids)
    gerencia.login(PIN_GERENCIA)
    audit_orphan_open_invoices(gerencia, sale_ids)
    session_id = ensure_cash_session(cajero)
    log_ok(f"Sesión de caja activa: {session_id}")

    gerencia.login(PIN_GERENCIA)
    for spec in draft_specs:
        sale_id = spec["sale_id"]
        sale = gerencia.get(f"/sales/{sale_id}").json()
        amount = float(sale.get("net_to_collect") or sale.get("amount_pending") or sale.get("total") or 0)
        collect = collect_invoice(cajero, sale_id, session_id, amount)
        fulfillment = collect.get("fulfillment") or {}
        spec["collect"] = collect
        spec["fulfillment_api"] = fulfillment
        log_ok(
            f"Cobro {spec['invoice_number']}: status={collect.get('sale_payment_status')} "
            f"fulfillment={fulfillment.get('triggered')}"
        )
        verify = verify_fulfillment(gerencia, sale_id, spec["invoice_number"])
        spec["verify"] = verify
        REPORT["sales"].append(spec)


def main() -> int:
    print("=" * 72)
    print(f"E2E FULL WORKFLOW LIVE — tag {RUN_TAG}")
    print("=" * 72)
    try:
        run_workflow()
    except Exception as exc:
        log_fail("Excepción fatal en flujo E2E", str(exc))
        import traceback
        traceback.print_exc()
        REPORT["fatal_error"] = str(exc)

    print("\n" + "=" * 72)
    print("RESUMEN")
    print("=" * 72)
    print(f"OK: {len(REPORT['ok'])} | FIXED: {len(REPORT['fixed'])} | FAIL: {len(REPORT['failed'])}")
    if REPORT["new_users"]:
        print("\nUsuarios nuevos:")
        for row in REPORT["new_users"]:
            print(
                f"  - {row['nombre']} | {row['rol']} | tel {row['telefono']} | "
                f"login {row['pin_login']} | marcación {row['pin_marcacion']}"
            )

    from pathlib import Path
    report_dir = Path(__file__).resolve().parents[1] / "data"
    report_dir.mkdir(parents=True, exist_ok=True)
    out_path = str(report_dir / f"e2e_workflow_report_{RUN_TAG}.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(REPORT, fh, ensure_ascii=False, indent=2)
    print(f"\nReporte JSON: {out_path}")

    return 0 if not REPORT["failed"] and not REPORT.get("fatal_error") else 1


if __name__ == "__main__":
    sys.exit(main())