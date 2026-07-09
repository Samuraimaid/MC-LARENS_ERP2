"""Live E2E workshop simulation: OT, QC gate, dispatch, logistics, warranties."""

from __future__ import annotations

import traceback
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

PIN_GERENCIA = "01011990"
PIN_VENTAS = "55667788"
PIN_CAJERO = "11223344"
DEFAULT_SELL_RATE = 37.15

BRANCH_MAIN = "branch_main"
BRANCH_NORTH = "branch_north"
BRANCH_SOUTH = "branch_south"
WH_MAIN = "wh_main"
WH_NORTH = "wh_topcar_calvario"
WH_SOUTH = "wh_topcar_tigre"

BLIND_INTAKE_QTY = 10
TRANSFER_QTY = 2
MIN_STOCK = 8

BRANCH_ROLE_PINS: Dict[str, Dict[str, str]] = {
    BRANCH_MAIN: {
        "ventas": "11042026",
        "bodegas": "11052026",
        "instalaciones": "11072026",
    },
    BRANCH_NORTH: {
        "ventas": "12042026",
        "bodegas": "12052026",
    },
    BRANCH_SOUTH: {
        "ventas": "13042026",
        "bodegas": "13052026",
    },
}

RUN_TAG = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def _round2(value: Any) -> float:
    return round(float(value or 0.0), 2)


class ApiSession:
    def __init__(self, label: str, base_url: str):
        self.label = label
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(timeout=120.0, follow_redirects=True)
        self.user: Dict[str, Any] = {}

    def login(self, pin: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"pin": pin}
        if user_id:
            payload["user_id"] = user_id
        response = self.client.post(f"{self.base_url}/auth/pin/login", json=payload)
        response.raise_for_status()
        self.user = response.json().get("user") or {}
        return self.user

    def get(self, path: str, **kwargs) -> httpx.Response:
        return self.client.get(f"{self.base_url}{path}", **kwargs)

    def post(self, path: str, json_body: Any = None, **kwargs) -> httpx.Response:
        return self.client.post(f"{self.base_url}{path}", json=json_body, **kwargs)

    def put(self, path: str, json_body: Any = None, **kwargs) -> httpx.Response:
        return self.client.put(f"{self.base_url}{path}", json=json_body, **kwargs)


def _http_error_detail(response: httpx.Response) -> str:
    body = (response.text or "").strip()
    if len(body) > 500:
        body = f"{body[:500]}..."
    return f"{response.status_code}: {body}"


def _find_pin_user(gerencia: ApiSession, role: str, branch_id: str) -> Dict[str, Any]:
    response = gerencia.get("/auth/pin/users")
    response.raise_for_status()
    users = response.json() if isinstance(response.json(), list) else []
    for row in users:
        if str(row.get("role") or "") == role and str(row.get("branch_id") or "") == branch_id:
            return row
    raise RuntimeError(f"No hay usuario PIN para role={role} branch={branch_id}")


def _assign_login_pin(gerencia: ApiSession, user_id: str, pin: str) -> bool:
    if len(pin) != 8 or not pin.isdigit():
        return False
    response = gerencia.put(
        f"/users/{user_id}/login-pin",
        json_body={"new_pin": pin},
    )
    return response.status_code == 200


def _login_branch_role(
    base_url: str,
    gerencia: ApiSession,
    role: str,
    branch_id: str,
    *,
    forced_pin: Optional[str] = None,
) -> ApiSession:
    user = _find_pin_user(gerencia, role, branch_id)
    user_id = str(user.get("user_id") or "")
    session = ApiSession(f"{role}_{branch_id}", base_url)
    if forced_pin:
        _assign_login_pin(gerencia, user_id, forced_pin)
    pin_candidates = [
        forced_pin,
        BRANCH_ROLE_PINS.get(branch_id, {}).get(role),
        PIN_VENTAS if role in {"ventas", "bodegas"} else None,
        PIN_CAJERO if role == "cajero" else None,
    ]
    last_error = ""
    for pin in pin_candidates:
        if not pin:
            continue
        try:
            session.login(pin, user_id=user_id)
            if str(session.user.get("role") or "") == role:
                return session
        except Exception as exc:
            last_error = str(exc)
    raise RuntimeError(f"Login fallido {role}/{branch_id}: {last_error}")


def _inventory_qty(session: ApiSession, warehouse_id: str, product_id: str) -> int:
    response = session.get("/inventory", params={"warehouse_id": warehouse_id})
    if response.status_code != 200:
        return 0
    rows = response.json() if isinstance(response.json(), list) else []
    for row in rows:
        if str(row.get("product_id") or "") == product_id:
            return int(row.get("quantity") or 0)
    return 0


def _ensure_stock(
    gerencia: ApiSession,
    product_ids: List[str],
    warehouse_id: str,
    minimum: int = MIN_STOCK,
) -> None:
    for product_id in product_ids:
        qty = _inventory_qty(gerencia, warehouse_id, product_id)
        if qty >= minimum:
            continue
        add_qty = max(minimum - qty, 5)
        response = gerencia.post(
            "/inventory/add-stock",
            params={
                "product_id": product_id,
                "warehouse_id": warehouse_id,
                "quantity": add_qty,
                "min_stock": 2,
            },
        )
        response.raise_for_status()


def _pick_catalog_products(
    catalog: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    physical = [
        p
        for p in catalog
        if str(p.get("product_type") or "").lower() != "service"
        and float(p.get("price") or 0) > 0
        and str(p.get("category") or "").lower() != "polarizados"
    ]
    physical.sort(key=lambda row: str(row.get("product_id") or ""))

    install_candidates = [
        p
        for p in physical
        if float(p.get("installation_price") or 0) > 0
        and str(p.get("category") or "").lower() in {
            "accesorios_electronicos",
            "audio",
            "security",
        }
    ]
    if len(physical) < 2 or not install_candidates:
        raise RuntimeError("Catálogo insuficiente: se requieren 2 físicos + 1 instalable")

    install_product = install_candidates[0]
    carry_products = [p for p in physical if p["product_id"] != install_product["product_id"]][:2]
    if len(carry_products) < 2:
        raise RuntimeError("No hay suficientes productos físicos para venta mixta")
    return carry_products, install_product


def _sale_item_row(
    product: Dict[str, Any],
    warehouse_id: str,
    *,
    with_installation: bool = False,
) -> Dict[str, Any]:
    return {
        "product_id": product["product_id"],
        "quantity": 1,
        "discount": 0,
        "unit_price": float(product.get("price") or 0),
        "warehouse_id": warehouse_id,
        "with_installation": with_installation,
    }


def _preview_net_to_collect(
    ventas: ApiSession,
    *,
    customer_id: str,
    subtotal_nio: float,
    apply_iva: bool,
) -> float:
    response = ventas.post(
        "/sales/preview-settlement",
        json_body={
            "customer_id": customer_id,
            "subtotal": subtotal_nio,
            "discount_percent": 0,
            "discounts_amount": 0,
            "promotions_amount": 0,
            "payment_method": "cash",
            "print_format": "thermal80",
            "apply_iva": apply_iva,
        },
    )
    response.raise_for_status()
    settlement = response.json()
    return float(settlement.get("net_to_collect") or settlement.get("total_legal") or 0.0)


def _ensure_cash_session(cajero: ApiSession, sell_rate: float) -> Optional[str]:
    active = cajero.get("/caja/sesion-activa")
    if active.status_code == 200:
        payload = active.json() or {}
        session = payload.get("session") or payload
        session_id = session.get("session_id")
        if session_id:
            return str(session_id)

    date_token = datetime.now(timezone.utc).strftime("%Y%m%d")
    opened = cajero.post(
        "/caja/apertura",
        json_body={
            "caja_id": f"caja-ws-{date_token}",
            "denominaciones": [],
            "tipo_cambio_usd_nio": sell_rate,
            "observaciones": f"Workshop QA auto-open {RUN_TAG}",
        },
    )
    if opened.status_code == 200:
        return str(opened.json().get("session_id") or "")
    return None


def _create_and_collect_sale(
    ventas: ApiSession,
    cajero: ApiSession,
    *,
    customer_id: str,
    vehicle_id: Optional[str],
    items: List[Dict[str, Any]],
    products_by_id: Dict[str, Dict[str, Any]],
    sell_rate: float,
    idempotency_key: str,
    apply_iva: bool = False,
) -> Dict[str, Any]:
    subtotal_usd = 0.0
    for row in items:
        product = products_by_id.get(row["product_id"], {})
        unit = float(row.get("unit_price") or product.get("price") or 0)
        qty = int(row.get("quantity") or 1)
        line = unit * qty
        if row.get("with_installation"):
            line += float(product.get("installation_price") or 0) * qty
        subtotal_usd += line
    subtotal_nio = _round2(subtotal_usd * sell_rate)
    net_nio = _preview_net_to_collect(
        ventas,
        customer_id=customer_id,
        subtotal_nio=subtotal_nio,
        apply_iva=apply_iva,
    )

    sale_payload: Dict[str, Any] = {
        "customer_id": customer_id,
        "items": items,
        "discount": 0,
        "payment_type": "cash",
        "payment_method": "cash",
        "planned_payment_plan": {
            "mode": "cash",
            "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": net_nio}],
        },
        "supervisor_discount_preapproved": True,
        "apply_iva": apply_iva,
        "currency": "NIO",
        "exchange_rate": sell_rate,
        "notes": f"Workshop QA {RUN_TAG}",
        "idempotency_key": idempotency_key,
    }
    if vehicle_id:
        sale_payload["vehicle_id"] = vehicle_id

    sale_response = ventas.post("/sales", json_body=sale_payload)
    if sale_response.status_code == 409:
        try:
            conflict = sale_response.json()
            nested = conflict.get("detail") if isinstance(conflict.get("detail"), dict) else {}
            expected_total = nested.get("expected_total")
        except Exception:
            expected_total = None
        if expected_total is not None:
            adjusted = _round2(float(expected_total))
            sale_payload["planned_payment_plan"] = {
                "mode": "cash",
                "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": adjusted}],
            }
            net_nio = adjusted
            sale_response = ventas.post("/sales", json_body=sale_payload)
    if sale_response.status_code >= 400:
        return {
            "ok": False,
            "status_code": sale_response.status_code,
            "detail": _http_error_detail(sale_response),
            "sale": None,
        }
    sale = sale_response.json()
    sale_id = str(sale.get("sale_id") or "")

    cash_session_id = _ensure_cash_session(cajero, sell_rate)
    collect_payload: Dict[str, Any] = {
        "payment_method": "cash",
        "pagos": [{"metodo": "cash", "moneda": "NIO", "monto_origen": net_nio}],
        "amount": net_nio,
        "idempotency_key": f"ws-collect-{sale_id}",
    }
    if cash_session_id:
        collect_payload["sesion_id"] = cash_session_id

    collect_response = cajero.post(
        f"/cashier/invoices/{sale_id}/collect",
        json_body=collect_payload,
    )
    if collect_response.status_code >= 400:
        raise RuntimeError(_http_error_detail(collect_response))
    collect_doc = collect_response.json()
    return {
        "ok": True,
        "sale_id": sale_id,
        "invoice_number": sale.get("invoice_number"),
        "sale": sale,
        "collect": collect_doc,
        "fulfillment": collect_doc.get("fulfillment") or {},
        "net_nio": net_nio,
    }


def _complete_dispatch(
    bodegas: ApiSession,
    dispatch_id: str,
    product_ids: List[str],
    dispatcher_id: str,
) -> Dict[str, Any]:
    start = bodegas.put(f"/dispatch/{dispatch_id}/start")
    if start.status_code >= 400:
        raise RuntimeError(_http_error_detail(start))

    delivered: List[str] = []
    for product_id in product_ids:
        response = bodegas.put(
            f"/dispatch/{dispatch_id}/deliver-item",
            json_body={"product_id": product_id, "dispatcher_id": dispatcher_id},
        )
        if response.status_code >= 400:
            raise RuntimeError(_http_error_detail(response))
        delivered.append(product_id)

    detail = bodegas.get(f"/dispatch/{dispatch_id}")
    detail.raise_for_status()
    dispatch_doc = detail.json()
    return {
        "dispatch_id": dispatch_id,
        "delivered_products": delivered,
        "status": dispatch_doc.get("status"),
        "all_completed": str(dispatch_doc.get("status") or "").lower() == "completed",
    }


def run_workshop_simulation_suite(base_url: str) -> Dict[str, Any]:
    started_at = datetime.now(timezone.utc).isoformat()
    steps: List[Dict[str, Any]] = []
    errors: List[str] = []
    context: Dict[str, Any] = {"run_tag": RUN_TAG}

    def record(step: str, ok: bool, detail: Any = None) -> None:
        steps.append({"step": step, "ok": ok, "detail": detail})
        if not ok:
            errors.append(f"{step}: {detail}")

    sessions: List[ApiSession] = []

    try:
        gerencia = ApiSession("gerencia", base_url)
        gerencia.login(PIN_GERENCIA)
        sessions.append(gerencia)
        record("login_gerencia", True, {"user_id": gerencia.user.get("user_id")})

        ventas_main = _login_branch_role(base_url, gerencia, "ventas", BRANCH_MAIN)
        sessions.append(ventas_main)
        record("login_ventas_main", True, {"user_id": ventas_main.user.get("user_id")})

        cajero = ApiSession("cajero", base_url)
        cajero.login(PIN_CAJERO)
        sessions.append(cajero)
        record("login_cajero", True, {"user_id": cajero.user.get("user_id")})

        north_pin = f"7{RUN_TAG[-7:]}"
        south_pin = f"8{RUN_TAG[-7:]}"
        ventas_north = _login_branch_role(
            base_url,
            gerencia,
            "ventas",
            BRANCH_NORTH,
            forced_pin=north_pin,
        )
        ventas_south = _login_branch_role(
            base_url,
            gerencia,
            "ventas",
            BRANCH_SOUTH,
            forced_pin=south_pin,
        )
        sessions.extend([ventas_north, ventas_south])
        record("login_topcar_ventas", True, {
            "north_ventas": ventas_north.user.get("user_id"),
            "south_ventas": ventas_south.user.get("user_id"),
        })

        rate_doc = gerencia.get("/settings/exchange-rate").json()
        sell_rate = float(rate_doc.get("usd_to_nio") or DEFAULT_SELL_RATE)

        # FASE 1 — Cliente y vehículo
        plate_token = uuid.uuid4().hex[:6].upper()
        customer_resp = gerencia.post(
            "/customers",
            json_body={
                "name": f"QA Workshop {RUN_TAG}",
                "phone": f"8888-{plate_token[:4]}",
                "email": f"qa.workshop.{RUN_TAG}@test.local",
                "customer_type": "natural",
            },
        )
        customer_resp.raise_for_status()
        customer = customer_resp.json()
        customer_id = customer.get("customer_id")
        record("create_customer", True, {"customer_id": customer_id})

        vehicle_resp = gerencia.post(
            "/vehicles",
            json_body={
                "customer_id": customer_id,
                "brand": "Toyota",
                "model": "Hilux",
                "year": 2022,
                "plate": f"QA{plate_token}",
                "color": "Blanco",
            },
        )
        vehicle_resp.raise_for_status()
        vehicle = vehicle_resp.json()
        vehicle_id = vehicle.get("vehicle_id")
        context["vehicle_id"] = vehicle_id
        record("create_vehicle", True, {"vehicle_id": vehicle_id, "plate": vehicle.get("plate")})

        products_resp = gerencia.get("/products")
        products_resp.raise_for_status()
        catalog = products_resp.json() if isinstance(products_resp.json(), list) else []
        carry_products, install_product = _pick_catalog_products(catalog)
        products_by_id = {p["product_id"]: p for p in catalog}
        product_ids_main = [p["product_id"] for p in carry_products] + [install_product["product_id"]]
        record("pick_catalog_products", True, {
            "carry": [p["product_id"] for p in carry_products],
            "install": install_product["product_id"],
        })

        # FASE 3 (paralelo) — Ingreso ciego
        intake_items = [
            {"product_id": pid, "quantity": BLIND_INTAKE_QTY}
            for pid in product_ids_main[:3]
        ]
        intake_resp = gerencia.post(
            "/inventory/purchase-receipt",
            json_body={"warehouse_id": WH_MAIN, "items": intake_items},
        )
        intake_resp.raise_for_status()
        record("blind_intake_wh_main", True, intake_resp.json())

        _ensure_stock(gerencia, product_ids_main, WH_MAIN)
        _ensure_stock(gerencia, [carry_products[0]["product_id"]], WH_NORTH, minimum=3)
        _ensure_stock(gerencia, [carry_products[1]["product_id"]], WH_SOUTH, minimum=3)

        # FASE 1 — Venta taller Mundo de Accesorios
        main_items = [
            _sale_item_row(carry_products[0], WH_MAIN, with_installation=False),
            _sale_item_row(carry_products[1], WH_MAIN, with_installation=False),
            _sale_item_row(install_product, WH_MAIN, with_installation=True),
        ]
        main_sale = _create_and_collect_sale(
            ventas_main,
            gerencia,
            customer_id=customer_id,
            vehicle_id=vehicle_id,
            items=main_items,
            products_by_id=products_by_id,
            sell_rate=sell_rate,
            idempotency_key=f"ws-main-{RUN_TAG}",
        )
        if not main_sale.get("ok"):
            record("workshop_sale_main", False, main_sale)
            raise RuntimeError("Venta principal taller falló")
        fulfillment = main_sale.get("fulfillment") or {}
        work_order_ids = fulfillment.get("work_order_ids") or []
        dispatch_id = fulfillment.get("dispatch_id")
        sale_id = main_sale.get("sale_id")
        invoice_number = main_sale.get("invoice_number")
        context.update({
            "sale_id": sale_id,
            "invoice_number": invoice_number,
            "work_order_ids": work_order_ids,
            "dispatch_id": dispatch_id,
        })
        wo_pending = bool(work_order_ids)
        record(
            "workshop_sale_main",
            wo_pending and bool(dispatch_id),
            {
                "sale_id": sale_id,
                "invoice_number": invoice_number,
                "work_order_ids": work_order_ids,
                "dispatch_id": dispatch_id,
            },
        )
        if not wo_pending:
            errors.append("workshop_sale_main: no se generó OT pendiente tras cobro")

        primary_wo_id = work_order_ids[0] if work_order_ids else None
        if primary_wo_id:
            wo_doc = gerencia.get(f"/work-orders/{primary_wo_id}").json()
            record(
                "work_order_pending_status",
                str(wo_doc.get("status") or "") == "pending",
                {"work_order_id": primary_wo_id, "status": wo_doc.get("status")},
            )

        # FASE 1 — Restricción multi-sucursal TopCar
        blocked_items = [_sale_item_row(install_product, WH_NORTH, with_installation=True)]
        for branch_label, ventas_session, warehouse_id in [
            ("north", ventas_north, WH_NORTH),
            ("south", ventas_south, WH_SOUTH),
        ]:
            blocked = _create_and_collect_sale(
                ventas_session,
                cajero,
                customer_id=customer_id,
                vehicle_id=vehicle_id,
                items=[_sale_item_row(install_product, warehouse_id, with_installation=True)],
                products_by_id=products_by_id,
                sell_rate=sell_rate,
                idempotency_key=f"ws-block-{branch_label}-{RUN_TAG}",
            )
            detail_text = str(blocked.get("detail") or "").lower()
            blocked_ok = (
                not blocked.get("ok")
                and int(blocked.get("status_code") or 0) in {400, 403}
                and (
                    "instalaciones" in detail_text
                    or "sucursal" in detail_text
                    or "taller" in detail_text
                    or "polarizado" in detail_text
                )
            )
            record(f"topcar_install_blocked_{branch_label}", blocked_ok, blocked)

        # FASE 2 — OT en proceso + notas técnicas
        if primary_wo_id:
            in_progress = gerencia.put(
                f"/work-orders/{primary_wo_id}",
                json_body={
                    "status": "in_progress",
                    "notes": f"QA técnico: instalación {install_product.get('name')} iniciada",
                },
            )
            in_progress_ok = in_progress.status_code == 200
            record("work_order_in_progress", in_progress_ok, _http_error_detail(in_progress) if not in_progress_ok else None)

            qc_submit = gerencia.put(
                f"/work-orders/{primary_wo_id}",
                json_body={"status": "quality_check"},
            )
            record(
                "work_order_submit_qc",
                qc_submit.status_code == 200,
                None if qc_submit.status_code == 200 else _http_error_detail(qc_submit),
            )

            # FASE 3 — QC gate bloquea Entregado sin aprobación
            blocked_delivered = gerencia.put(
                f"/work-orders/{primary_wo_id}",
                json_body={"status": "delivered"},
            )
            gate_ok = blocked_delivered.status_code == 400 and "QC_Passed" in (blocked_delivered.text or "")
            record(
                "qc_gate_blocks_delivered",
                gate_ok,
                {
                    "status_code": blocked_delivered.status_code,
                    "detail": (blocked_delivered.text or "")[:240],
                },
            )

            qc_resp = gerencia.post(
                "/quality-control",
                json_body={
                    "work_order_id": primary_wo_id,
                    "overall_rating": 5,
                    "cleanliness_rating": 5,
                    "functionality_rating": 5,
                    "finish_rating": 5,
                    "safety_rating": 5,
                    "approved": True,
                    "comments": f"QC_Passed workshop QA {RUN_TAG}",
                    "checklist": [],
                },
            )
            qc_ok = qc_resp.status_code == 200
            record("quality_control_approved", qc_ok, qc_resp.json() if qc_ok else _http_error_detail(qc_resp))

        # FASE 2 — Despacho bodega central
        if dispatch_id:
            dispatch_doc = gerencia.get(f"/dispatch/{dispatch_id}")
            dispatch_doc.raise_for_status()
            dispatch_items = dispatch_doc.json().get("items") or []
            dispatch_product_ids = [
                str(item.get("product_id"))
                for item in dispatch_items
                if item.get("product_id")
            ]
            dispatch_result = _complete_dispatch(
                gerencia,
                dispatch_id,
                dispatch_product_ids,
                str(gerencia.user.get("user_id") or ""),
            )
            record("dispatch_main_completed", dispatch_result.get("all_completed"), dispatch_result)

            thermal = cajero.get(f"/print/thermal-invoice/{sale_id}/preview-pdf")
            record(
                "thermal_invoice_pdf",
                thermal.status_code == 200 and len(thermal.content or b"") > 500,
                {"status": thermal.status_code, "bytes": len(thermal.content or b"")},
            )

        # FASE 3 — Traslado 3 pasos en paralelo con OT activa
        transfer_product = carry_products[0]["product_id"]
        qty_before_origin = _inventory_qty(gerencia, WH_MAIN, transfer_product)
        qty_before_dest = _inventory_qty(gerencia, WH_NORTH, transfer_product)

        transfer_create = gerencia.post(
            "/inventory/transfer-request",
            json_body={
                "product_id": transfer_product,
                "from_warehouse_id": WH_MAIN,
                "to_warehouse_id": WH_NORTH,
                "quantity": TRANSFER_QTY,
                "reason": "QA workshop parallel transfer",
            },
        )
        transfer_create.raise_for_status()
        request_id = transfer_create.json().get("request_id")
        for step_name, path in [
            ("transfer_approve", f"/inventory/transfer-requests/{request_id}/approve"),
            ("transfer_ship", f"/inventory/transfer-requests/{request_id}/ship"),
            ("transfer_receive", f"/inventory/transfer-requests/{request_id}/receive"),
        ]:
            step_resp = gerencia.put(path)
            step_resp.raise_for_status()
            record(step_name, True, {"request_id": request_id, "status": step_resp.json().get("status")})

        qty_after_origin = _inventory_qty(gerencia, WH_MAIN, transfer_product)
        qty_after_dest = _inventory_qty(gerencia, WH_NORTH, transfer_product)
        transfer_ok = (
            (qty_after_origin - qty_before_origin) == -TRANSFER_QTY
            and (qty_after_dest - qty_before_dest) == TRANSFER_QTY
        )
        record(
            "transfer_inventory_reconciliation",
            transfer_ok,
            {
                "product_id": transfer_product,
                "origin_delta": qty_after_origin - qty_before_origin,
                "dest_delta": qty_after_dest - qty_before_dest,
            },
        )

        # Entrega OT tras QC
        if primary_wo_id:
            delivered = gerencia.put(
                f"/work-orders/{primary_wo_id}",
                json_body={"status": "delivered"},
            )
            record(
                "work_order_delivered_after_qc",
                delivered.status_code == 200,
                None if delivered.status_code == 200 else _http_error_detail(delivered),
            )

        # FASE 2 — Ventas y despacho TopCar (sin instalación)
        for branch_label, ventas_session, warehouse_id in [
            ("north", ventas_north, WH_NORTH),
            ("south", ventas_south, WH_SOUTH),
        ]:
            product = carry_products[0] if branch_label == "north" else carry_products[1]
            pid = product["product_id"]
            main_qty_before = _inventory_qty(gerencia, WH_MAIN, pid)
            local_qty_before = _inventory_qty(gerencia, warehouse_id, pid)

            topcar_sale = _create_and_collect_sale(
                ventas_session,
                gerencia,
                customer_id=customer_id,
                vehicle_id=None,
                items=[_sale_item_row(product, warehouse_id, with_installation=False)],
                products_by_id=products_by_id,
                sell_rate=sell_rate,
                idempotency_key=f"ws-topcar-{branch_label}-{RUN_TAG}",
            )
            if not topcar_sale.get("ok"):
                record(f"topcar_sale_{branch_label}", False, topcar_sale)
                continue

            topcar_dispatch_id = (topcar_sale.get("fulfillment") or {}).get("dispatch_id")
            record(f"topcar_sale_{branch_label}", bool(topcar_dispatch_id), {
                "sale_id": topcar_sale.get("sale_id"),
                "dispatch_id": topcar_dispatch_id,
            })

            if topcar_dispatch_id:
                dispatch_info = _complete_dispatch(
                    gerencia,
                    topcar_dispatch_id,
                    [pid],
                    str(gerencia.user.get("user_id") or ""),
                )
                main_qty_after = _inventory_qty(gerencia, WH_MAIN, pid)
                local_qty_after = _inventory_qty(gerencia, warehouse_id, pid)
                isolated_ok = main_qty_before == main_qty_after and local_qty_after < local_qty_before
                record(
                    f"topcar_dispatch_{branch_label}",
                    dispatch_info.get("all_completed") and isolated_ok,
                    {
                        "dispatch": dispatch_info,
                        "main_delta": main_qty_after - main_qty_before,
                        "local_delta": local_qty_after - local_qty_before,
                    },
                )

        # FASE 4 — Garantías
        if invoice_number:
            lookup = gerencia.get("/warranties/lookup", params={"code": invoice_number})
            lookup_ok = lookup.status_code == 200
            lookup_payload = lookup.json() if lookup_ok else {}
            record(
                "warranty_lookup_invoice",
                lookup_ok and int(lookup_payload.get("eligible_count") or 0) > 0,
                {
                    "invoice_number": invoice_number,
                    "eligible_count": lookup_payload.get("eligible_count"),
                },
            )

            claim_product_id = carry_products[0]["product_id"]
            qty_before_claim = _inventory_qty(gerencia, WH_MAIN, claim_product_id)
            claim_resp = gerencia.post(
                "/warranties/claim",
                json_body={
                    "sale_id": sale_id,
                    "product_id": claim_product_id,
                    "vehicle_id": vehicle_id,
                    "issue_description": f"Reclamo QA instalación defectuosa {RUN_TAG}",
                    "claim_type": "replacement",
                    "warehouse_id": WH_MAIN,
                    "quantity": 1,
                },
            )
            claim_ok = claim_resp.status_code == 200
            claim_doc = claim_resp.json() if claim_ok else {}
            qty_after_claim = _inventory_qty(gerencia, WH_MAIN, claim_product_id)
            inventory_applied = bool((claim_doc.get("inventory_effect") or {}).get("applied"))
            record(
                "warranty_claim_replacement",
                claim_ok and inventory_applied and qty_after_claim < qty_before_claim,
                {
                    "claim_id": claim_doc.get("claim_id"),
                    "inventory_effect": claim_doc.get("inventory_effect"),
                    "qty_before": qty_before_claim,
                    "qty_after": qty_after_claim,
                },
            )

        success = len(errors) == 0 and all(step.get("ok") for step in steps)
        return {
            "suite": "full_workshop_simulation",
            "success": success,
            "started_at": started_at,
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "run_tag": RUN_TAG,
            "steps": steps,
            "errors": errors,
            "context": context,
            "summary": {
                "phases": [
                    "customer_vehicle",
                    "workshop_sale_ot",
                    "topcar_install_restriction",
                    "work_order_qc_dispatch",
                    "blind_intake_transfer",
                    "topcar_local_dispatch",
                    "warranty_lookup_claim",
                ],
                "work_order_id": primary_wo_id,
                "sale_id": sale_id,
                "invoice_number": invoice_number,
            },
        }
    except Exception as exc:
        errors.append(str(exc))
        record("fatal_error", False, traceback.format_exc())
        return {
            "suite": "full_workshop_simulation",
            "success": False,
            "started_at": started_at,
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "run_tag": RUN_TAG,
            "steps": steps,
            "errors": errors,
            "context": context,
        }
    finally:
        for session in sessions:
            session.client.close()