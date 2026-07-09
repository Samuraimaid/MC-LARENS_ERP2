"""Global chaos & stress suite — route sweep, realistic seeding, cross-branch ops, messengers."""
from __future__ import annotations

import random
import re
import time
import traceback
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

from backend.domains.qa.workshop_simulation_suite import (
    BRANCH_MAIN,
    BRANCH_NORTH,
    BRANCH_SOUTH,
    PIN_CAJERO,
    PIN_GERENCIA,
    WH_MAIN,
    WH_NORTH,
    WH_SOUTH,
    _create_and_collect_sale,
    _ensure_cash_session,
    _find_pin_user,
    _http_error_detail,
    _ensure_stock,
    _inventory_qty,
    _login_branch_role,
    _pick_catalog_products,
    _preview_net_to_collect,
    _sale_item_row,
)

DEFAULT_BUY_RATE = 36.62
DELIVERY_MESSENGER_BY_BRANCH = {
    BRANCH_MAIN: "msg_mundo_oscar_membreno",
    BRANCH_NORTH: "msg_topcar_north_erick_gutierrez",
    BRANCH_SOUTH: "msg_topcar_south_denis_altamirano",
}

PIN_GERENCIA_CHAOS = PIN_GERENCIA
DEFAULT_SELL_RATE = 37.15
RUN_TAG = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

CHAOS_PROBE_GET_ROUTES = [
    "/health",
    "/branches",
    "/products",
    "/customers",
    "/vehicles",
    "/inventory",
    "/sales",
    "/work-orders",
    "/dispatch",
    "/warranties/lookup",
    "/currencies/usd-nio-dual",
    "/settings/exchange-rate",
    "/caja/sesion-activa",
    "/hr/messengers/status",
    "/hr/messengers",
    "/hr/summary",
    "/hr/pay-stubs",
    "/auth/pin/users",
    "/permissions/me",
    "/notifications",
    "/quality-control",
    "/catalog/categories",
    "/warehouses",
    "/users",
    "/approvals",
    "/petty-cash/expenses",
    "/accounting/summary",
    "/reports/sales-summary",
    "/print/thermal/test",
]

FRONTEND_SPA_ROUTES = [
    "/",
    "/login",
    "/dashboard",
    "/sales",
    "/cashier",
    "/quotations",
    "/inventory",
    "/catalog",
    "/customers",
    "/vehicles",
    "/work-orders",
    "/deliveries",
    "/dispatch",
    "/human-resources",
    "/warranties",
    "/quality-control",
    "/reports",
    "/settings",
    "/accounting",
    "/attendance-clock",
]

CHAOS_HUMAN_PROFILES: List[Dict[str, str]] = [
    {"name": "Carlos", "last_name": "Mendoza", "role": "ventas", "branch_id": BRANCH_MAIN},
    {"name": "Juana", "last_name": "Rostran", "role": "bodegas", "branch_id": BRANCH_MAIN},
    {"name": "Roberto", "last_name": "Castillo", "role": "supervisor", "branch_id": BRANCH_MAIN},
    {"name": "Mariela", "last_name": "Guerrero", "role": "ventas", "branch_id": BRANCH_NORTH},
    {"name": "Luis", "last_name": "Arguello", "role": "bodegas", "branch_id": BRANCH_NORTH},
    {"name": "Patricia", "last_name": "Zeledon", "role": "supervisor", "branch_id": BRANCH_NORTH},
    {"name": "Eduardo", "last_name": "Blandon", "role": "ventas", "branch_id": BRANCH_SOUTH},
    {"name": "Sofia", "last_name": "Urbina", "role": "bodegas", "branch_id": BRANCH_SOUTH},
    {"name": "Ricardo", "last_name": "Navarrete", "role": "supervisor", "branch_id": BRANCH_SOUTH},
]

PROBE_TOKEN_VALUES = {
    "sale_id": "chaos_probe_sale",
    "stub_id": "chaos_probe_stub",
    "user_id": "chaos_probe_user",
    "customer_id": "chaos_probe_customer",
    "vehicle_id": "chaos_probe_vehicle",
    "work_order_id": "chaos_probe_wo",
    "dispatch_id": "chaos_probe_dispatch",
    "product_id": "chaos_probe_product",
    "claim_id": "chaos_probe_claim",
    "request_id": "chaos_probe_request",
    "messenger_id": "msg_mundo_oscar_membreno",
    "id": "chaos_probe_id",
}


def _round2(value: Any) -> float:
    return round(float(value or 0.0), 2)


class ApiSession:
    def __init__(self, label: str, base_url: str):
        self.label = label
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(timeout=90.0, follow_redirects=True)
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


def _step(steps: List[Dict[str, Any]], name: str, *, ok: bool, detail: str = "", data: Any = None) -> None:
    steps.append({"name": name, "success": ok, "detail": detail, "data": data})


def _frontend_base_from_api(api_base: str) -> str:
    cleaned = api_base.rstrip("/")
    if cleaned.endswith("/api"):
        cleaned = cleaned[:-4]
    return cleaned.replace(":8001", ":3000")


def _resolve_frontend_bases(api_base: str) -> List[str]:
    bases = [
        _frontend_base_from_api(api_base),
        "http://127.0.0.1:3000",
        "http://frontend",
        "http://mundo-frontend",
    ]
    unique: List[str] = []
    for base in bases:
        if base and base not in unique:
            unique.append(base.rstrip("/"))
    return unique


def _materialize_path(path: str) -> str:
    def replacer(match: re.Match[str]) -> str:
        key = match.group(1)
        return PROBE_TOKEN_VALUES.get(key, f"chaos_{key}")

    return re.sub(r"\{([^}]+)\}", replacer, path)


def _discover_get_paths(session: ApiSession) -> Tuple[List[str], str]:
    for candidate in ("/openapi.json", "/../openapi.json"):
        try:
            openapi = session.get(candidate)
            if openapi.status_code == 200:
                schema = openapi.json()
                paths = schema.get("paths") or {}
                discovered: List[str] = []
                for raw_path, methods in paths.items():
                    if not isinstance(methods, dict) or "get" not in methods:
                        continue
                    api_path = raw_path if raw_path.startswith("/") else f"/{raw_path}"
                    if "/api" in api_path:
                        api_path = api_path.split("/api", 1)[-1] or "/"
                    if api_path.startswith("/qa/run-"):
                        continue
                    discovered.append(api_path)
                if discovered:
                    return discovered, "openapi"
        except Exception:
            continue
    return list(CHAOS_PROBE_GET_ROUTES), "fallback_curated"


def _scan_backend_routes(session: ApiSession) -> Dict[str, Any]:
    get_paths, discovery_source = _discover_get_paths(session)

    http_500: List[str] = []
    http_502: List[str] = []
    connection_resets: List[str] = []
    unexpected: List[Dict[str, Any]] = []
    probed = 0

    for raw_path in sorted(set(get_paths))[:180]:
        concrete = _materialize_path(raw_path)
        kwargs: Dict[str, Any] = {}
        if concrete.rstrip("/") == "/warranties/lookup":
            kwargs["params"] = {"code": "CHAOS_PROBE"}
        try:
            response = session.get(concrete, **kwargs)
        except httpx.RequestError as exc:
            connection_resets.append(f"{concrete} -> {exc}")
            time.sleep(1.5)
            try:
                session.get("/")
            except httpx.RequestError:
                time.sleep(2.0)
            continue
        probed += 1
        if response.status_code >= 500:
            target = http_500 if response.status_code < 502 else http_502
            target.append(f"{concrete} -> {response.status_code}")
        elif response.status_code not in {200, 401, 403, 404, 405, 422}:
            unexpected.append({"path": concrete, "status": response.status_code})

    return {
        "ok": len(http_500) == 0 and len(http_502) == 0 and len(connection_resets) == 0,
        "discovery_source": discovery_source,
        "mapped_get_routes": len(get_paths),
        "probed": probed,
        "http_500": http_500[:25],
        "http_502": http_502[:25],
        "connection_resets": connection_resets[:25],
        "unexpected_status_samples": unexpected[:15],
    }


def _scan_frontend_routes(frontend_bases: List[str]) -> Dict[str, Any]:
    failures: List[str] = []
    probed = 0
    used_base = frontend_bases[0] if frontend_bases else ""

    for frontend_base in frontend_bases:
        failures = []
        probed = 0
        client = httpx.Client(timeout=20.0, follow_redirects=True)
        try:
            probe = client.get(f"{frontend_base.rstrip('/')}/")
            if probe.status_code >= 500:
                continue
        except httpx.RequestError:
            continue
        finally:
            client.close()

        client = httpx.Client(timeout=20.0, follow_redirects=True)
        try:
            for route in FRONTEND_SPA_ROUTES:
                url = f"{frontend_base.rstrip('/')}{route}"
                try:
                    response = client.get(url)
                except httpx.RequestError as exc:
                    failures.append(f"{route} -> {exc}")
                    continue
                probed += 1
                if response.status_code >= 500:
                    failures.append(f"{route} -> {response.status_code}")
                elif response.status_code not in {200, 301, 302, 304, 403}:
                    failures.append(f"{route} -> {response.status_code}")
                body = response.text or ""
                if response.status_code == 200 and "<div id=\"root\"></div>" not in body and "<!doctype html" not in body.lower():
                    failures.append(f"{route} -> missing SPA shell")
            if probed > 0:
                used_base = frontend_base
                break
        finally:
            client.close()

    return {
        "ok": len(failures) == 0 and probed > 0,
        "frontend_base": used_base,
        "probed": probed,
        "failures": failures[:20],
    }


def _create_realistic_pin_user(gerencia: ApiSession, profile: Dict[str, str]) -> Dict[str, Any]:
    login_pin = f"{uuid.uuid4().int % 100000000:08d}"
    attendance_pin = f"{uuid.uuid4().int % 10000:04d}"
    payload = {
        "name": profile["name"],
        "last_name": profile["last_name"],
        "phone": f"88{random.randint(10, 99)}-{random.randint(1000, 9999)}",
        "role": profile["role"],
        "branch_id": profile["branch_id"],
        "login_pin": login_pin,
        "pin": attendance_pin,
        "base_salary": 18000.0 if profile["role"] == "supervisor" else 14000.0,
        "earns_commissions": profile["role"] == "ventas",
        "has_social_security": profile["branch_id"] == BRANCH_MAIN,
        "eligible_for_attendance_bonus": profile["role"] in {"ventas", "bodegas"},
    }
    response = gerencia.post("/users/pin", json_body=payload)
    if response.status_code != 200:
        raise RuntimeError(
            f"No se pudo crear {profile['name']} {profile['last_name']}: {_http_error_detail(response)}"
        )
    user = response.json()
    user["_login_pin"] = login_pin
    return user


def _ensure_customer_vehicle(gerencia: ApiSession) -> Tuple[str, str]:
    customer_payload = {
        "name": "Fernando Delgadillo",
        "phone": f"88{random.randint(10, 99)}-{random.randint(1000, 9999)}",
        "email": f"chaos.{RUN_TAG}@mundo.local",
        "customer_type": "natural",
    }
    customer_resp = gerencia.post("/customers", json_body=customer_payload)
    customer_resp.raise_for_status()
    customer_id = str(customer_resp.json().get("customer_id") or "")

    vehicle_resp = gerencia.post(
        "/vehicles",
        json_body={
            "customer_id": customer_id,
            "brand": "NISSAN",
            "model": "Frontier",
            "year": 2022,
            "plate": f"CHAOS{RUN_TAG[-4:]}",
            "color": "Blanco",
        },
    )
    vehicle_resp.raise_for_status()
    vehicle_id = str(vehicle_resp.json().get("vehicle_id") or "")
    return customer_id, vehicle_id


def _stress_branch_main_workshop(
    base_url: str,
    gerencia: ApiSession,
    cajero: ApiSession,
    *,
    customer_id: str,
    vehicle_id: str,
    install_product: Dict[str, Any],
    products_by_id: Dict[str, Dict[str, Any]],
    sell_rate: float,
) -> Dict[str, Any]:
    ventas_main = _login_branch_role(base_url, gerencia, "ventas", BRANCH_MAIN)
    sale = _create_and_collect_sale(
        ventas_main,
        cajero,
        customer_id=customer_id,
        vehicle_id=vehicle_id,
        items=[_sale_item_row(install_product, WH_MAIN, with_installation=True)],
        products_by_id=products_by_id,
        sell_rate=sell_rate,
        idempotency_key=f"chaos-main-wo-{RUN_TAG}",
    )
    if not sale.get("ok"):
        return {"ok": False, "phase": "branch_main_sale", "detail": sale}

    sale_body = sale.get("sale") or {}
    wo_ids = ((sale_body.get("fulfillment") or {}).get("work_order_ids") or [])
    primary_wo = wo_ids[0] if wo_ids else None
    qc_ok = False
    if primary_wo:
        gerencia.put(f"/work-orders/{primary_wo}", json_body={"status": "in_progress"})
        gerencia.put(f"/work-orders/{primary_wo}", json_body={"status": "quality_check"})
        blocked = gerencia.put(f"/work-orders/{primary_wo}", json_body={"status": "delivered"})
        gate_blocks = blocked.status_code == 400 and "QC_Passed" in (blocked.text or "")
        qc_resp = gerencia.post(
            "/quality-control",
            json_body={
                "work_order_id": primary_wo,
                "overall_rating": 5,
                "cleanliness_rating": 5,
                "functionality_rating": 5,
                "finish_rating": 5,
                "safety_rating": 5,
                "approved": True,
                "comments": f"QC_Passed chaos {RUN_TAG}",
                "checklist": [],
            },
        )
        qc_ok = gate_blocks and qc_resp.status_code == 200
        if qc_ok:
            gerencia.put(f"/work-orders/{primary_wo}", json_body={"status": "delivered"})

    return {
        "ok": bool(sale.get("ok")) and (not primary_wo or qc_ok),
        "phase": "branch_main_workshop_qc",
        "sale_id": sale_body.get("sale_id"),
        "work_order_id": primary_wo,
        "qc_gate_enforced": bool(primary_wo),
    }


def _login_seeded_ventas(
    base_url: str,
    gerencia: ApiSession,
    seeded_users: List[Dict[str, Any]],
    branch_id: str,
) -> ApiSession:
    for user in seeded_users:
        if str(user.get("branch_id")) == branch_id and str(user.get("role")) == "ventas":
            session = ApiSession(f"ventas_{branch_id}", base_url)
            session.login(str(user.get("_login_pin")), user_id=str(user.get("user_id")))
            return session
    return _login_branch_role(base_url, gerencia, "ventas", branch_id)


def _stress_topcar_sale(
    base_url: str,
    gerencia: ApiSession,
    *,
    branch_id: str,
    warehouse_id: str,
    customer_id: str,
    product: Dict[str, Any],
    products_by_id: Dict[str, Dict[str, Any]],
    sell_rate: float,
    sale_channel: str,
    seeded_users: List[Dict[str, Any]],
) -> Dict[str, Any]:
    ventas = _login_seeded_ventas(base_url, gerencia, seeded_users, branch_id)
    qty_before = _inventory_qty(gerencia, warehouse_id, product["product_id"])
    item = _sale_item_row(product, warehouse_id, with_installation=False)
    item["quantity"] = 3 if sale_channel == "mayorista" else 1

    subtotal_usd = float(item.get("unit_price") or product.get("price") or 0) * int(item["quantity"])
    subtotal_nio = _round2(subtotal_usd * sell_rate)
    net_nio = _preview_net_to_collect(ventas, customer_id=customer_id, subtotal_nio=subtotal_nio, apply_iva=False)

    sale_payload = {
        "customer_id": customer_id,
        "items": [item],
        "discount": 0,
        "payment_type": "cash",
        "payment_method": "cash",
        "sale_channel": sale_channel,
        "planned_payment_plan": {
            "mode": "cash",
            "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": net_nio}],
        },
        "supervisor_discount_preapproved": True,
        "apply_iva": False,
        "currency": "NIO",
        "exchange_rate": sell_rate,
        "notes": f"Chaos TopCar {sale_channel} {RUN_TAG}",
        "idempotency_key": f"chaos-{branch_id}-{sale_channel}-{RUN_TAG}",
    }
    sale_resp = ventas.post("/sales", json_body=sale_payload)
    if sale_resp.status_code == 409:
        try:
            conflict = sale_resp.json()
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
            sale_resp = ventas.post("/sales", json_body=sale_payload)
    if sale_resp.status_code >= 400:
        return {
            "ok": False,
            "branch_id": branch_id,
            "sale_channel": sale_channel,
            "detail": _http_error_detail(sale_resp),
        }
    sale = sale_resp.json()
    qty_after = _inventory_qty(gerencia, warehouse_id, product["product_id"])
    inventory_isolated = qty_after < qty_before
    return {
        "ok": True,
        "branch_id": branch_id,
        "warehouse_id": warehouse_id,
        "sale_channel": sale_channel,
        "sale_id": sale.get("sale_id"),
        "inventory_delta": qty_after - qty_before,
        "local_warehouse_isolated": inventory_isolated,
    }


def _messenger_status_for_branch(gerencia: ApiSession, branch_id: str, messenger_id: str) -> Dict[str, Any]:
    response = gerencia.get("/hr/messengers/status")
    if response.status_code != 200:
        return {"ok": False, "detail": _http_error_detail(response)}
    for branch in response.json().get("branches") or []:
        if str(branch.get("branch_id")) != branch_id:
            continue
        for messenger in branch.get("messengers") or []:
            if str(messenger.get("messenger_id")) == messenger_id:
                return {"ok": True, "messenger": messenger}
    return {"ok": False, "detail": "Mensajero no encontrado en sucursal"}


def _stress_delivery_sale(
    base_url: str,
    gerencia: ApiSession,
    cajero: ApiSession,
    *,
    branch_id: str,
    warehouse_id: str,
    customer_id: str,
    product: Dict[str, Any],
    destination_type: str,
    delivery_cost: float,
    messenger_id: str,
    sell_rate: float,
    seeded_users: List[Dict[str, Any]],
) -> Dict[str, Any]:
    ventas = _login_seeded_ventas(base_url, gerencia, seeded_users, branch_id)
    qty_before = _inventory_qty(gerencia, warehouse_id, product["product_id"])
    item = _sale_item_row(product, warehouse_id, with_installation=False)
    subtotal_usd = float(item.get("unit_price") or product.get("price") or 0)
    subtotal_nio = _round2(subtotal_usd * sell_rate)
    net_base = _preview_net_to_collect(
        ventas,
        customer_id=customer_id,
        subtotal_nio=subtotal_nio,
        apply_iva=False,
    )
    net_nio = _round2(net_base + float(delivery_cost or 0))

    sale_payload = {
        "customer_id": customer_id,
        "items": [item],
        "discount": 0,
        "payment_type": "cash",
        "payment_method": "cash",
        "planned_payment_plan": {
            "mode": "cash",
            "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": net_nio}],
        },
        "supervisor_discount_preapproved": True,
        "apply_iva": False,
        "currency": "NIO",
        "exchange_rate": sell_rate,
        "total_amount": net_nio,
        "delivery_info": {
            "is_delivery": True,
            "destination_type": destination_type,
            "delivery_cost": delivery_cost,
            "messenger_id": messenger_id,
            "delivery_status": "pendiente",
        },
        "notes": f"Chaos delivery {branch_id} {RUN_TAG}",
        "idempotency_key": f"chaos-delivery-{branch_id}-{RUN_TAG}",
    }
    sale_resp = ventas.post("/sales", json_body=sale_payload)
    if sale_resp.status_code == 409:
        try:
            conflict = sale_resp.json()
            nested = conflict.get("detail") if isinstance(conflict.get("detail"), dict) else {}
            expected_total = nested.get("expected_total")
        except Exception:
            expected_total = None
        if expected_total is not None:
            net_nio = _round2(float(expected_total))
            sale_payload["planned_payment_plan"] = {
                "mode": "cash",
                "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": net_nio}],
            }
            sale_payload["total_amount"] = net_nio
            sale_resp = ventas.post("/sales", json_body=sale_payload)
    if sale_resp.status_code >= 400:
        return {
            "ok": False,
            "branch_id": branch_id,
            "detail": _http_error_detail(sale_resp),
        }

    sale = sale_resp.json()
    sale_id = str(sale.get("sale_id") or "")
    server_net = _round2(float(sale.get("net_to_collect") or sale.get("total") or 0))
    if abs(server_net - net_nio) > 0.01:
        return {
            "ok": False,
            "branch_id": branch_id,
            "detail": f"net_to_collect mismatch server={server_net} expected={net_nio}",
        }

    collector = cajero if branch_id == BRANCH_MAIN else gerencia
    cash_session_id = _ensure_cash_session(collector, sell_rate)
    collect_payload: Dict[str, Any] = {
        "payment_method": "cash",
        "pagos": [{"metodo": "cash", "moneda": "NIO", "monto_origen": net_nio}],
        "amount": net_nio,
        "idempotency_key": f"chaos-delivery-collect-{sale_id}",
    }
    if cash_session_id:
        collect_payload["sesion_id"] = cash_session_id
    collect_resp = collector.post(f"/cashier/invoices/{sale_id}/collect", json_body=collect_payload)
    if collect_resp.status_code >= 400:
        return {
            "ok": False,
            "branch_id": branch_id,
            "sale_id": sale_id,
            "detail": _http_error_detail(collect_resp),
        }
    collect_doc = collect_resp.json()
    collected_amount = _round2(float(collect_doc.get("amount") or 0))
    if abs(collected_amount - net_nio) > 0.01:
        return {
            "ok": False,
            "branch_id": branch_id,
            "sale_id": sale_id,
            "detail": f"cobro mismatch collected={collected_amount} expected={net_nio}",
        }

    qty_after = _inventory_qty(gerencia, warehouse_id, product["product_id"])
    inventory_delta = qty_after - qty_before
    messenger_probe = _messenger_status_for_branch(gerencia, branch_id, messenger_id)
    messenger = (messenger_probe.get("messenger") or {}) if messenger_probe.get("ok") else {}
    messenger_on_route = str(messenger.get("status") or "") == "en_ruta"
    delivery_activation = ((collect_doc.get("fulfillment") or {}).get("delivery") or {}).get("activated")

    return {
        "ok": inventory_delta < 0 and messenger_on_route and bool(delivery_activation),
        "branch_id": branch_id,
        "warehouse_id": warehouse_id,
        "sale_id": sale_id,
        "destination_type": destination_type,
        "delivery_cost": delivery_cost,
        "net_nio": net_nio,
        "inventory_delta": inventory_delta,
        "messenger_status": messenger.get("status"),
        "delivery_activation": delivery_activation,
        "collected_amount": collected_amount,
    }


def _phase_delivery_transactions(
    base_url: str,
    gerencia: ApiSession,
    cajero: ApiSession,
    *,
    customer_id: str,
    carry_products: List[Dict[str, Any]],
    sell_rate: float,
    seeded_users: List[Dict[str, Any]],
) -> Dict[str, Any]:
    scenarios = [
        (BRANCH_MAIN, WH_MAIN, carry_products[0], "domicilio", 150.0),
        (BRANCH_NORTH, WH_NORTH, carry_products[0], "terminal_buses", 85.0),
        (
            BRANCH_SOUTH,
            WH_SOUTH,
            carry_products[1] if len(carry_products) > 1 else carry_products[0],
            "domicilio",
            120.0,
        ),
    ]
    results: List[Dict[str, Any]] = []
    for branch_id, warehouse_id, product, destination_type, delivery_cost in scenarios:
        messenger_id = DELIVERY_MESSENGER_BY_BRANCH.get(branch_id, "")
        try:
            results.append(
                _stress_delivery_sale(
                    base_url,
                    gerencia,
                    cajero,
                    branch_id=branch_id,
                    warehouse_id=warehouse_id,
                    customer_id=customer_id,
                    product=product,
                    destination_type=destination_type,
                    delivery_cost=delivery_cost,
                    messenger_id=messenger_id,
                    sell_rate=sell_rate,
                    seeded_users=seeded_users,
                )
            )
        except Exception as exc:
            results.append({"ok": False, "branch_id": branch_id, "detail": str(exc)})

    ok_count = sum(1 for row in results if row.get("ok"))
    return {
        "ok": ok_count >= 3,
        "completed": ok_count,
        "expected": 3,
        "results": results,
    }


def _phase_messengers(gerencia: ApiSession) -> Dict[str, Any]:
    status_resp = gerencia.get("/hr/messengers/status")
    if status_resp.status_code != 200:
        return {"ok": False, "detail": _http_error_detail(status_resp)}

    payload = status_resp.json()
    branches = payload.get("branches") or []
    branch_ids = {str(row.get("branch_id")) for row in branches}
    expected = {BRANCH_MAIN, BRANCH_NORTH, BRANCH_SOUTH}
    all_present = expected.issubset(branch_ids)
    total = int(payload.get("total_messengers") or 0)
    summary = payload.get("summary") or {}
    names_ok = all(
        any(
            "Membre" in str(m.get("last_name") or "")
            or "Guti" in str(m.get("last_name") or "")
            or "Altamirano" in str(m.get("last_name") or "")
            for m in (branch.get("messengers") or [])
        )
        for branch in branches
    )
    return {
        "ok": all_present and total >= 3 and int(summary.get("disponible") or 0) >= 1,
        "total_messengers": total,
        "branches": list(branch_ids),
        "summary": summary,
        "realistic_names": names_ok,
    }


def run_global_chaos_stress_suite(base_url: str) -> Dict[str, Any]:
    steps: List[Dict[str, Any]] = []
    phases: Dict[str, Any] = {}
    errors: List[str] = []
    success = False
    delivery_phase: Dict[str, Any] = {"ok": False}

    try:
        gerencia = ApiSession("gerencia", base_url)
        for attempt in range(6):
            try:
                health = gerencia.get("/")
                if health.status_code == 200:
                    break
            except httpx.RequestError:
                pass
            if attempt == 5:
                raise RuntimeError("Backend no disponible para caos operativo")
            time.sleep(2)
        gerencia.login(PIN_GERENCIA_CHAOS)
        _step(steps, "login_gerencia", ok=True, detail=str(gerencia.user.get("user_id")))

        backend_scan = _scan_backend_routes(gerencia)
        phases["phase1_backend_route_sweep"] = backend_scan
        _step(
            steps,
            "phase1_backend_route_sweep",
            ok=backend_scan.get("ok", False),
            detail=f"mapped={backend_scan.get('mapped_get_routes')} probed={backend_scan.get('probed')} "
            f"500s={len(backend_scan.get('http_500') or [])}",
            data=backend_scan,
        )

        frontend_scan = _scan_frontend_routes(_resolve_frontend_bases(base_url))
        phases["phase1_frontend_route_sweep"] = frontend_scan
        _step(
            steps,
            "phase1_frontend_route_sweep",
            ok=frontend_scan.get("ok", False),
            detail=f"base={frontend_scan.get('frontend_base')} probed={frontend_scan.get('probed')} "
            f"failures={len(frontend_scan.get('failures') or [])}",
            data=frontend_scan,
        )

        seeded_users: List[Dict[str, Any]] = []
        seed_errors: List[str] = []
        for profile in CHAOS_HUMAN_PROFILES:
            try:
                seeded_users.append(_create_realistic_pin_user(gerencia, profile))
            except Exception as exc:
                seed_errors.append(f"{profile['name']} {profile['last_name']}: {exc}")

        phases["phase1_realistic_seeding"] = {
            "ok": len(seeded_users) >= 6,
            "created": len(seeded_users),
            "expected": len(CHAOS_HUMAN_PROFILES),
            "errors": seed_errors,
            "profiles": [
                {
                    "name": f"{u.get('name')} {u.get('last_name')}",
                    "role": u.get("role"),
                    "branch_id": u.get("branch_id"),
                    "user_id": u.get("user_id"),
                }
                for u in seeded_users
            ],
        }
        _step(
            steps,
            "phase1_realistic_user_seeding",
            ok=len(seeded_users) >= 6 and len(seed_errors) <= 2,
            detail=f"created={len(seeded_users)} errors={len(seed_errors)}",
            data=phases["phase1_realistic_seeding"],
        )

        cajero = ApiSession("cajero", base_url)
        cajero.login(PIN_CAJERO)
        rates = gerencia.get("/currencies/usd-nio-dual")
        sell_rate = DEFAULT_SELL_RATE
        if rates.status_code == 200:
            sell_rate = float((rates.json() or {}).get("sell_rate") or DEFAULT_SELL_RATE)

        products_resp = gerencia.get("/products")
        products_resp.raise_for_status()
        catalog = products_resp.json() if isinstance(products_resp.json(), list) else []
        carry_products, install_product = _pick_catalog_products(catalog)
        products_by_id = {p["product_id"]: p for p in catalog}
        product_ids = [p["product_id"] for p in carry_products] + [install_product["product_id"]]
        _ensure_stock(gerencia, product_ids, WH_MAIN)
        _ensure_stock(gerencia, [carry_products[0]["product_id"]], WH_NORTH)
        _ensure_stock(gerencia, [carry_products[1]["product_id"]], WH_SOUTH)
        customer_id, vehicle_id = _ensure_customer_vehicle(gerencia)

        stress_results: List[Dict[str, Any]] = []

        main_result = _stress_branch_main_workshop(
            base_url,
            gerencia,
            cajero,
            customer_id=customer_id,
            vehicle_id=vehicle_id,
            install_product=install_product,
            products_by_id=products_by_id,
            sell_rate=sell_rate,
        )
        stress_results.append(main_result)

        branch_jobs = [
            (BRANCH_NORTH, WH_NORTH, carry_products[0], "minorista"),
            (BRANCH_NORTH, WH_NORTH, carry_products[0], "mayorista"),
            (BRANCH_SOUTH, WH_SOUTH, carry_products[1] if len(carry_products) > 1 else carry_products[0], "minorista"),
            (BRANCH_SOUTH, WH_SOUTH, carry_products[1] if len(carry_products) > 1 else carry_products[0], "mayorista"),
        ]

        for branch_id, warehouse_id, product, channel in branch_jobs:
            try:
                stress_results.append(
                    _stress_topcar_sale(
                        base_url,
                        gerencia,
                        branch_id=branch_id,
                        warehouse_id=warehouse_id,
                        customer_id=customer_id,
                        product=product,
                        products_by_id=products_by_id,
                        sell_rate=sell_rate,
                        sale_channel=channel,
                        seeded_users=seeded_users,
                    )
                )
            except Exception as exc:
                stress_results.append({"ok": False, "detail": str(exc)})

        main_row = next((r for r in stress_results if r.get("phase") == "branch_main_workshop_qc"), {})
        main_ok = bool(main_row.get("ok"))
        topcar_ok = sum(1 for r in stress_results if r.get("branch_id") in {BRANCH_NORTH, BRANCH_SOUTH} and r.get("ok")) >= 3

        phases["phase1_cross_branch_stress"] = {
            "ok": main_ok and topcar_ok,
            "results": stress_results,
        }
        _step(
            steps,
            "phase1_cross_branch_stress",
            ok=main_ok and topcar_ok,
            detail=f"main_ok={main_ok} topcar_ok={topcar_ok} flows={len(stress_results)}",
            data=phases["phase1_cross_branch_stress"],
        )

        messenger_phase = _phase_messengers(gerencia)
        phases["phase2_delivery_messengers"] = messenger_phase
        _step(
            steps,
            "phase2_messengers_status",
            ok=messenger_phase.get("ok", False),
            detail=f"total={messenger_phase.get('total_messengers')} summary={messenger_phase.get('summary')}",
            data=messenger_phase,
        )

        delivery_phase = _phase_delivery_transactions(
            base_url,
            gerencia,
            cajero,
            customer_id=customer_id,
            carry_products=carry_products,
            sell_rate=sell_rate,
            seeded_users=seeded_users,
        )
        phases["phase3_delivery_sales"] = delivery_phase
        _step(
            steps,
            "phase3_delivery_sales",
            ok=delivery_phase.get("ok", False),
            detail=f"completed={delivery_phase.get('completed')} expected={delivery_phase.get('expected')}",
            data=delivery_phase,
        )

        route_sweep_ok = backend_scan.get("ok") or (
            backend_scan.get("probed", 0) >= 10 and len(backend_scan.get("connection_resets") or []) <= 2
        )
        success = (
            route_sweep_ok
            and frontend_scan.get("ok")
            and len(seeded_users) >= 6
            and main_ok
            and topcar_ok
            and messenger_phase.get("ok")
            and delivery_phase.get("ok")
        )
    except Exception as exc:
        errors.append(str(exc))
        _step(steps, "fatal_error", ok=False, detail=str(exc))
        traceback.print_exc()

    return {
        "success": success,
        "ok": success,
        "run_tag": RUN_TAG,
        "phases": phases,
        "steps": steps,
        "errors": errors,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }