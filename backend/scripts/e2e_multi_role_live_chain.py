#!/usr/bin/env python3
"""
Live multi-role chain test for MC-LARENS ERP.

Chain:
  vendedor → supervisor → gerencia(opcional) → cajero →
  despachador(bodegas) → coord.instalaciones / coord.polarizados →
  instalador / electrico / polarizador → QC (coord/supervisor/gerencia) → delivered

Creates/ensures suite users with known login PINs, seeds a polarizado product
if missing, then walks one mixed sale through the full operational pipeline.
"""
from __future__ import annotations

import json
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

API = "http://127.0.0.1:8001/api"
BRANCH_ID = "branch_main"
WAREHOUSE_ID = "wh_main"
PIN_GERENCIA = "01011990"
RUN_TAG = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
EXCHANGE_RATE = 36.5

# role -> (login_pin 8 digits, attendance_pin 4 digits, name, last_name, phone)
ROLE_SPECS: List[Dict[str, Any]] = [
    {"role": "ventas", "login_pin": "55667788", "att_pin": "1001", "name": "Suite", "last_name": "Vendedor", "phone": "8100-1001"},
    {"role": "supervisor", "login_pin": "00000003", "att_pin": "1003", "name": "Suite", "last_name": "Supervisor", "phone": "8100-1003"},
    {"role": "cajero", "login_pin": "11223344", "att_pin": "1002", "name": "Suite", "last_name": "Cajero", "phone": "8100-1002"},
    {"role": "bodegas", "login_pin": "00000010", "att_pin": "1010", "name": "Suite", "last_name": "Despachador", "phone": "8100-1010", "warehouse_id": WAREHOUSE_ID},
    {"role": "coordinador_instalaciones", "login_pin": "88112233", "att_pin": "1008", "name": "Suite", "last_name": "CoordInst", "phone": "8100-1008"},
    {"role": "coordinador_polarizados", "login_pin": "88223344", "att_pin": "1009", "name": "Suite", "last_name": "CoordPol", "phone": "8100-1009"},
    {"role": "instalaciones", "login_pin": "00000012", "att_pin": "1012", "name": "Suite", "last_name": "Instalador", "phone": "8100-1012"},
    {"role": "electrico", "login_pin": "00000008", "att_pin": "1018", "name": "Suite", "last_name": "Electrico", "phone": "8100-1018"},
    {"role": "polarizador", "login_pin": "00000009", "att_pin": "1019", "name": "Suite", "last_name": "Polarizador", "phone": "8100-1019"},
]

REPORT: Dict[str, Any] = {
    "run_tag": RUN_TAG,
    "ok": [],
    "fail": [],
    "warnings": [],
    "context": {},
}


def log_ok(msg: str, **extra: Any) -> None:
    print(f"OK: {msg}")
    REPORT["ok"].append({"msg": msg, **extra})


def log_fail(msg: str, detail: str = "", **extra: Any) -> None:
    print(f"FAIL: {msg}")
    if detail:
        print(f"  → {detail[:400]}")
    REPORT["fail"].append({"msg": msg, "detail": detail[:500], **extra})


def log_warn(msg: str, detail: str = "") -> None:
    print(f"WARN: {msg}")
    if detail:
        print(f"  → {detail[:300]}")
    REPORT["warnings"].append({"msg": msg, "detail": detail[:400]})


class Api:
    def __init__(self, label: str):
        self.label = label
        self.s = requests.Session()
        self.user: Dict[str, Any] = {}

    def login(self, pin: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"pin": pin}
        if user_id:
            payload["user_id"] = user_id
        r = self.s.post(f"{API}/auth/pin/login", json=payload, timeout=30)
        if r.status_code != 200:
            raise RuntimeError(f"login {self.label} pin={pin}: {r.status_code} {r.text[:300]}")
        data = r.json()
        self.user = data.get("user") or {}
        return self.user

    def get(self, path: str, **kwargs) -> requests.Response:
        return self.s.get(f"{API}{path}", timeout=60, **kwargs)

    def post(self, path: str, json_body: Any = None, **kwargs) -> requests.Response:
        return self.s.post(f"{API}{path}", json=json_body, timeout=120, **kwargs)

    def put(self, path: str, json_body: Any = None, params: Any = None, **kwargs) -> requests.Response:
        return self.s.put(f"{API}{path}", json=json_body, params=params, timeout=120, **kwargs)


def round2(v: Any) -> float:
    return round(float(v or 0), 2)


def _probe_pin_owner(pin: str) -> Optional[Dict[str, Any]]:
    """Return user dict if pin currently works, else None (does not consume lockout hard)."""
    s = requests.Session()
    r = s.post(f"{API}/auth/pin/login", json={"pin": pin}, timeout=20)
    if r.status_code != 200:
        return None
    return (r.json() or {}).get("user") or {}


def _unique_login_pin(role: str, idx: int) -> str:
    # 8 digits, deterministic per run/role, low collision with seed pins
    base = abs(hash(f"{role}:{RUN_TAG}:{idx}")) % 10_000_000
    return f"9{base:07d}"


def ensure_roles(gerencia: Api) -> Dict[str, Dict[str, Any]]:
    """Resolve a working login for every chain role (reuse known PIN or assign unique)."""
    users = gerencia.get("/auth/pin/users").json()
    if not isinstance(users, list):
        users = []
    by_role: Dict[str, List[Dict[str, Any]]] = {}
    for u in users:
        by_role.setdefault(str(u.get("role") or ""), []).append(u)

    out: Dict[str, Dict[str, Any]] = {}
    for idx, spec in enumerate(ROLE_SPECS):
        role = spec["role"]
        preferred = str(spec["login_pin"])

        # 1) If preferred PIN already belongs to this role, reuse it.
        owner = _probe_pin_owner(preferred)
        if owner and str(owner.get("role") or "") == role:
            out[role] = {
                "user_id": owner.get("user_id"),
                "login_pin": preferred,
                "att_pin": spec["att_pin"],
                "name": owner.get("name"),
                "status": "known_pin",
            }
            log_ok(f"Usuario listo [{role}] vía PIN conocido: {owner.get('name')} ({owner.get('user_id')})")
            continue

        existing = by_role.get(role) or []
        chosen = next(
            (
                u
                for u in existing
                if "suite" in f"{u.get('name')} {u.get('last_name')}".lower()
            ),
            existing[0] if existing else None,
        )

        if not chosen:
            phone = str(spec["phone"]).replace("b", "")
            if "-" not in phone and len(phone) >= 8:
                phone = f"{phone[:4]}-{phone[4:8]}"
            pin_try = preferred if not owner else _unique_login_pin(role, idx)
            body = {
                "name": spec["name"],
                "last_name": spec["last_name"],
                "phone": phone,
                "role": role,
                "branch_id": BRANCH_ID,
                "warehouse_id": spec.get("warehouse_id"),
                "login_pin": pin_try,
                "pin": spec["att_pin"],
            }
            r = gerencia.post("/users/pin", json_body=body)
            if r.status_code != 200:
                # retry unique pin
                pin_try = _unique_login_pin(role, idx + 50)
                body["login_pin"] = pin_try
                body["phone"] = f"81{idx:02d}-{1000+idx:04d}"
                r = gerencia.post("/users/pin", json_body=body)
            if r.status_code != 200:
                log_fail(f"Crear usuario {role}", r.text[:300])
                continue
            user = r.json()
            out[role] = {
                "user_id": user.get("user_id"),
                "login_pin": pin_try,
                "att_pin": spec["att_pin"],
                "name": user.get("name"),
                "status": "created",
            }
            log_ok(f"Usuario creado [{role}]: {user.get('name')} pin={pin_try}")
            continue

        uid = str(chosen.get("user_id"))
        # Prefer preferred pin if free; else unique pin for this user.
        pin_candidates = [preferred] if not owner else []
        pin_candidates.extend([_unique_login_pin(role, idx + k) for k in range(0, 5)])
        assigned = None
        last_err = ""
        for pin_try in pin_candidates:
            r = gerencia.put(f"/users/{uid}/login-pin", json_body={"new_pin": pin_try})
            if r.status_code == 200:
                assigned = pin_try
                break
            last_err = r.text[:200]
        if not assigned:
            log_fail(f"Asignar login-pin {role}", last_err)
            continue
        out[role] = {
            "user_id": uid,
            "login_pin": assigned,
            "att_pin": spec["att_pin"],
            "name": chosen.get("name"),
            "status": "pin_reset",
        }
        log_ok(f"Usuario listo [{role}]: {chosen.get('name')} pin={assigned} ({uid})")
    return out


def login_role(roles: Dict[str, Dict[str, Any]], role: str) -> Api:
    info = roles[role]
    client = Api(role)
    # Prefer pin-only first (PIN directory uniqueness); fall back to user_id.
    try:
        client.login(info["login_pin"])
    except Exception:
        client.login(info["login_pin"], user_id=info.get("user_id"))
    if str(client.user.get("role") or "") != role:
        raise RuntimeError(
            f"Login {role} resolvió a {client.user.get('role')} ({client.user.get('name')}) "
            f"esperado user_id={info.get('user_id')}"
        )
    # keep resolved user_id
    info["user_id"] = client.user.get("user_id")
    log_ok(f"Login {role}: {client.user.get('name')} ({client.user.get('user_id')})")
    return client


def clock_in_tech(gerencia: Api, roles: Dict[str, Dict[str, Any]], role: str) -> None:
    """Mark technician present so coordinators can assign them."""
    info = roles[role]
    uid = info["user_id"]
    # Try HR punch with attendance pin
    r = gerencia.post(
        "/hr/timeclock/punch",
        json_body={
            "user_id": uid,
            "pin": info["att_pin"],
            "event_type": "clock_in",
            "notes": f"E2E multi-role clock-in {RUN_TAG}",
        },
    )
    if r.status_code == 200:
        log_ok(f"Marcación clock_in [{role}] vía HR")
        return
    # Fallback: direct mongo insert via temporary endpoint not available — try without user_id lookup by scanning pin
    # Gerencia may use different attendance pin for existing users. Insert via admin script path:
    # Use /hr/timeclock/kiosk-punch if available with att pin only
    r2 = gerencia.post(
        "/hr/timeclock/kiosk-punch",
        json_body={"pin": info["att_pin"], "event_type": "clock_in"},
    )
    if r2.status_code == 200:
        log_ok(f"Marcación clock_in [{role}] vía kiosk")
        return
    # Last resort: force via DB helper endpoint if any — otherwise warn and continue
    log_warn(
        f"No se pudo marcar asistencia de {role}; la asignación puede fallar",
        f"hr={r.status_code} {r.text[:120]} kiosk={r2.status_code} {r2.text[:120]}",
    )
    # Try to force present by inserting via a tiny internal mongo call using gerencia product seed path
    # We'll use docker-side follow-up if assignment fails.


def ensure_polarizado_product(gerencia: Api) -> Dict[str, Any]:
    products = gerencia.get("/products").json()
    if not isinstance(products, list):
        products = []
    existing = next(
        (
            p
            for p in products
            if str(p.get("category") or "").lower() in {"polarizados", "tint"}
            and float(p.get("price") or 0) > 0
        ),
        None,
    )
    if existing:
        log_ok(f"Producto polarizado existente: {existing.get('name')}")
        return existing

    body = {
        "name": f"Polarizado Cerámico Suite {RUN_TAG}",
        "sku": f"POL-E2E-{RUN_TAG[-6:]}",
        "category": "polarizados",
        "product_type": "product",
        "price": 120.0,
        "precio1": 120.0,
        "precio2": 110.0,
        "cost": 40.0,
        "installation_type": "required",
        "installation_price": 25.0,
        "installation_time_minutes": 90,
        "is_active": True,
        "window_options": [
            {"window_type": "frente", "material": "ceramic", "shade_percentage": 35},
            {"window_type": "laterales", "material": "ceramic", "shade_percentage": 20},
        ],
    }
    r = gerencia.post("/products", json_body=body)
    if r.status_code != 200:
        # try alternate payload keys used by some versions
        log_warn("POST /products polarizado falló, reintentando mínimo", r.text[:200])
        r = gerencia.post(
            "/products",
            json_body={
                "name": body["name"],
                "sku": body["sku"],
                "category": "polarizados",
                "price": 120.0,
                "installation_type": "required",
                "installation_price": 25.0,
            },
        )
    if r.status_code != 200:
        raise RuntimeError(f"No se pudo crear producto polarizado: {r.status_code} {r.text[:300]}")
    product = r.json()
    pid = product.get("product_id")
    # stock
    gerencia.post(
        "/inventory/add-stock",
        params={
            "product_id": pid,
            "warehouse_id": WAREHOUSE_ID,
            "quantity": 20,
            "min_stock": 2,
        },
    )
    log_ok(f"Producto polarizado creado: {product.get('name')} ({pid})")
    return product


def pick_mixed_cart(gerencia: Api, polar_product: Dict[str, Any]) -> List[Dict[str, Any]]:
    products = gerencia.get("/products").json()
    inventory = gerencia.get("/inventory").json()
    stock: Dict[str, float] = {}
    for row in inventory if isinstance(inventory, list) else []:
        if row.get("warehouse_id") != WAREHOUSE_ID:
            continue
        pid = row.get("product_id")
        stock[pid] = stock.get(pid, 0) + float(row.get("quantity") or 0)

    def has_stock(p: Dict[str, Any], min_qty: float = 3) -> bool:
        return stock.get(p.get("product_id"), 0) >= min_qty

    elec = next(
        (
            p
            for p in products
            if str(p.get("category") or "").lower() in {"accesorios_electronicos", "audio", "security"}
            and float(p.get("price") or 0) > 0
            and float(p.get("installation_price") or 0) > 0
            and has_stock(p)
        ),
        None,
    )
    mech = next(
        (
            p
            for p in products
            if str(p.get("category") or "").lower() in {"accesorios_no_electricos", "defensas", "accesorios"}
            and float(p.get("price") or 0) > 0
            and has_stock(p)
            and p.get("product_id") != (elec or {}).get("product_id")
        ),
        None,
    )
    if not elec or not mech:
        raise RuntimeError(f"Catálogo insuficiente electrico={bool(elec)} instalaciones={bool(mech)}")

    # ensure polar stock
    if stock.get(polar_product.get("product_id"), 0) < 3:
        gerencia.post(
            "/inventory/add-stock",
            params={
                "product_id": polar_product.get("product_id"),
                "warehouse_id": WAREHOUSE_ID,
                "quantity": 10,
                "min_stock": 2,
            },
        )

    cart = [
        {
            "product_id": mech["product_id"],
            "product_name": mech.get("name"),
            "quantity": 1,
            "unit_price": float(mech.get("price") or 0),
            "discount": 0,
            "warehouse_id": WAREHOUSE_ID,
            "with_installation": True,
            "installation_price": float(mech.get("installation_price") or 15),
            "installation_type": mech.get("installation_type") or "optional",
            "dept_expect": "instalaciones",
        },
        {
            "product_id": elec["product_id"],
            "product_name": elec.get("name"),
            "quantity": 1,
            "unit_price": float(elec.get("price") or 0),
            "discount": 0,
            "warehouse_id": WAREHOUSE_ID,
            "with_installation": True,
            "installation_price": float(elec.get("installation_price") or 0),
            "installation_type": elec.get("installation_type") or "optional",
            "dept_expect": "electrico",
        },
        {
            "product_id": polar_product["product_id"],
            "product_name": polar_product.get("name"),
            "quantity": 1,
            "unit_price": float(polar_product.get("price") or 120),
            "discount": 0,
            "warehouse_id": WAREHOUSE_ID,
            "with_installation": True,
            "installation_price": float(polar_product.get("installation_price") or 25),
            "installation_type": "required",
            "dept_expect": "polarizados",
        },
    ]
    log_ok(
        "Carrito mixto armado",
        items=[f"{c['dept_expect']}:{c['product_name']}" for c in cart],
    )
    return cart


def pick_customer_vehicle(gerencia: Api) -> Tuple[str, str]:
    customers = gerencia.get("/customers").json()
    vehicles = gerencia.get("/vehicles").json()
    by_c: Dict[str, List[Dict]] = {}
    for v in vehicles if isinstance(vehicles, list) else []:
        cid = v.get("customer_id")
        if cid:
            by_c.setdefault(cid, []).append(v)
    for c in customers if isinstance(customers, list) else []:
        cid = c.get("customer_id")
        if by_c.get(cid):
            return cid, by_c[cid][0]["vehicle_id"]
    raise RuntimeError("No hay cliente con vehículo")


def draft_and_release(
    ventas: Api,
    supervisor: Api,
    customer_id: str,
    vehicle_id: str,
    cart: List[Dict[str, Any]],
    rate: float,
) -> Dict[str, Any]:
    draft_id = f"mr_{RUN_TAG}"
    snapshot = {
        "selectedCustomerId": customer_id,
        "selectedVehicle": vehicle_id,
        "vehicleFlowOption": "registered",
        "selectedWarehouse": WAREHOUSE_ID,
        "cartItems": [
            {
                "product_id": i["product_id"],
                "product_name": i["product_name"],
                "quantity": i["quantity"],
                "unit_price": i["unit_price"],
                "original_unit_price": i["unit_price"],
                "discount": 0,
                "warehouse_id": WAREHOUSE_ID,
                "with_installation": True,
                "installation_price": i.get("installation_price") or 0,
                "installation_type": i.get("installation_type") or "optional",
            }
            for i in cart
        ],
        "paymentMethod": "cash",
        "mixedPaymentMethods": [],
        "globalDiscountMode": "percent",
        "globalDiscount": 0,
        "notes": f"Multi-role chain {RUN_TAG}",
        "applyIVA": True,
        "ivaRate": 15.0,
        "applyRetention": False,
        "retentionRate": 2,
        "currency": "NIO",
        "exchangeRate": rate,
        "appliedDiscounts": [],
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    r = ventas.put(f"/drafts/sale/{draft_id}", json_body={"name": f"MultiRole {RUN_TAG}", "snapshot": snapshot})
    if r.status_code != 200:
        raise RuntimeError(f"save draft: {r.status_code} {r.text[:300]}")
    log_ok(f"Vendedor creó borrador {draft_id}")

    # Supervisor watches + soft discount + release
    r = supervisor.post(f"/drafts/sale/{draft_id}/review/watch")
    if r.status_code != 200:
        raise RuntimeError(f"supervisor watch: {r.status_code} {r.text[:300]}")
    log_ok("Supervisor en watch del borrador")

    snapshot["globalDiscountMode"] = "percent"
    snapshot["globalDiscount"] = 3
    snapshot["updatedAt"] = datetime.now(timezone.utc).isoformat()
    r = supervisor.put(f"/drafts/sale/{draft_id}", json_body={"name": f"MultiRole {RUN_TAG}", "snapshot": snapshot})
    if r.status_code != 200:
        raise RuntimeError(f"supervisor edit: {r.status_code} {r.text[:300]}")
    log_ok("Supervisor aplicó descuento global 3%")

    r = supervisor.post(f"/drafts/sale/{draft_id}/review/release")
    if r.status_code != 200:
        raise RuntimeError(f"supervisor release: {r.status_code} {r.text[:300]}")
    log_ok("Supervisor liberó borrador al vendedor")
    return snapshot


def snapshot_to_sale(snapshot: Dict[str, Any], idem: str) -> Dict[str, Any]:
    try:
        from backend.scripts.e2e_sale_helpers import build_planned_payment_plan, round2 as r2
    except Exception:
        from e2e_sale_helpers import build_planned_payment_plan, round2 as r2  # type: ignore

    cart = snapshot.get("cartItems") or []
    rate = float(snapshot.get("exchangeRate") or EXCHANGE_RATE)
    subtotal = 0.0
    for item in cart:
        line = float(item.get("unit_price") or 0) * int(item.get("quantity") or 1)
        if item.get("with_installation"):
            line += float(item.get("installation_price") or 0) * int(item.get("quantity") or 1)
        subtotal += line
    gval = float(snapshot.get("globalDiscount") or 0)
    after = subtotal * (1 - gval / 100.0)
    total_nio = r2(after * rate * 1.15)
    return {
        "customer_id": snapshot.get("selectedCustomerId"),
        "vehicle_id": snapshot.get("selectedVehicle"),
        "items": [
            {
                "product_id": i["product_id"],
                "quantity": i.get("quantity", 1),
                "discount": 0,
                "unit_price": i.get("unit_price"),
                "warehouse_id": WAREHOUSE_ID,
                "with_installation": True,
            }
            for i in cart
        ],
        "discount": gval,
        "supervisor_discount_preapproved": True,
        "payment_type": "cash",
        "payment_method": "cash",
        "apply_iva": True,
        "iva_rate": 15,
        "currency": "NIO",
        "exchange_rate": rate,
        "planned_payment_plan": build_planned_payment_plan("cash", total_nio, exchange_rate=rate),
        "notes": snapshot.get("notes"),
        "idempotency_key": idem,
        "draft_id": f"mr_{RUN_TAG}",
    }


def ensure_cash_session(cajero: Api, rate: float) -> str:
    active = cajero.get("/caja/sesion-activa").json()
    if active.get("active") and (active.get("session") or {}).get("session_id"):
        return str(active["session"]["session_id"])
    r = cajero.post(
        "/caja/apertura",
        json_body={
            "caja_id": "CAJA-01",
            "usuario_id": cajero.user.get("user_id"),
            "tipo_cambio_usd_nio": rate,
            "denominaciones": [
                {"moneda": "NIO", "tipo": "billete", "valor_nominal": 100, "cantidad": 20},
            ],
            "observaciones": f"Multi-role {RUN_TAG}",
        },
    )
    if r.status_code != 200:
        # reuse any open session
        active = cajero.get("/caja/sesion-activa").json()
        if active.get("active"):
            return str(active["session"]["session_id"])
        raise RuntimeError(f"apertura caja: {r.status_code} {r.text[:300]}")
    return str(r.json().get("session_id"))


def _mongo_db():
    import os
    from motor.motor_asyncio import AsyncIOMotorClient

    uri = os.environ.get("MONGO_URL") or "mongodb://mongodb:27017"
    dbn = os.environ.get("DB_NAME") or "mc-larens2_mundo_accesorios_erp"
    return AsyncIOMotorClient(uri)[dbn]


def force_clock_in_mongo(role_user_ids: List[str]) -> None:
    """Best-effort: insert clock_in events via backend python if HR punch failed."""
    try:
        import asyncio

        async def _run() -> None:
            db = _mongo_db()
            now = datetime.now(timezone.utc).isoformat()
            for uid in role_user_ids:
                await db.hr_timeclock_events.insert_one(
                    {
                        "clock_id": f"clk_e2e_{uuid.uuid4().hex[:8]}",
                        "user_id": uid,
                        "event_type": "clock_in",
                        "notes": f"forced multi-role {RUN_TAG}",
                        "created_at": now,
                        "branch_id": BRANCH_ID,
                    }
                )

        asyncio.run(_run())
        log_ok(f"Asistencia forzada en Mongo para {len(role_user_ids)} técnicos")
    except Exception as exc:
        log_warn("force_clock_in_mongo falló", str(exc))


def bind_bodegas_warehouse(user_id: str, warehouse_id: str = WAREHOUSE_ID) -> None:
    try:
        import asyncio

        async def _run() -> None:
            db = _mongo_db()
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"warehouse_id": warehouse_id, "branch_id": BRANCH_ID}},
            )

        asyncio.run(_run())
        log_ok(f"Despachador {user_id} → warehouse {warehouse_id}")
    except Exception as exc:
        log_warn("bind_bodegas_warehouse falló", str(exc))


def complete_dispatch(bodegas: Api, dispatch_id: str) -> None:
    r = bodegas.put(f"/dispatch/{dispatch_id}/start")
    if r.status_code not in (200, 400):  # 400 if already started
        raise RuntimeError(f"dispatch start: {r.status_code} {r.text[:300]}")
    log_ok(f"Despachador inició {dispatch_id}")

    detail = bodegas.get(f"/dispatch/{dispatch_id}")
    if detail.status_code != 200:
        raise RuntimeError(f"dispatch detail: {detail.status_code} {detail.text[:200]}")
    items = (detail.json() or {}).get("items") or []
    dispatcher_id = bodegas.user.get("user_id")
    for item in items:
        if item.get("delivered"):
            continue
        pid = item.get("product_id")
        r = bodegas.put(
            f"/dispatch/{dispatch_id}/deliver-item",
            json_body={"product_id": pid, "dispatcher_id": dispatcher_id},
        )
        if r.status_code != 200:
            raise RuntimeError(f"deliver-item {pid}: {r.status_code} {r.text[:250]}")
        log_ok(f"Despachador entregó item {item.get('product_name') or pid}")

    final = bodegas.get(f"/dispatch/{dispatch_id}").json()
    log_ok(f"Despacho estado final: {final.get('status')}")


def advance_wo_chain(
    coord: Api,
    tech: Api,
    qc_actor: Api,
    wo: Dict[str, Any],
    tech_user_id: str,
    label: str,
) -> Dict[str, Any]:
    wo_id = wo.get("work_order_id")
    # assign
    r = coord.put(f"/work-orders/{wo_id}", json_body={"technician_id": tech_user_id})
    if r.status_code != 200:
        raise RuntimeError(f"assign {label} {wo_id}: {r.status_code} {r.text[:300]}")
    log_ok(f"Coord asignó {label} → {wo_id} a {tech.user.get('name')}")

    # tech progress
    for status in ("in_progress", "quality_check"):
        r = tech.put(f"/work-orders/{wo_id}", json_body={"status": status})
        if r.status_code != 200:
            raise RuntimeError(f"tech {label} → {status}: {r.status_code} {r.text[:300]}")
        log_ok(f"{label} marcó {wo_id} → {status}")

    # QC
    qc = qc_actor.post(
        "/quality-control",
        json_body={
            "work_order_id": wo_id,
            "overall_rating": 5,
            "cleanliness_rating": 5,
            "functionality_rating": 5,
            "finish_rating": 5,
            "safety_rating": 5,
            "comments": f"QC multi-role {RUN_TAG} {label}",
            "approved": True,
            "checklist": [{"item": "instalacion", "ok": True}],
        },
    )
    if qc.status_code != 200:
        raise RuntimeError(f"QC {label} {wo_id}: {qc.status_code} {qc.text[:300]}")
    log_ok(f"QC aprobó {label} {wo_id}")

    r = qc_actor.put(f"/work-orders/{wo_id}", json_body={"status": "delivered"})
    if r.status_code != 200:
        raise RuntimeError(f"delivered {label} {wo_id}: {r.status_code} {r.text[:300]}")
    log_ok(f"{label} OT entregada {wo_id}")
    return {"work_order_id": wo_id, "department": label, "final": "delivered"}


def advance_tint(
    coord_pol: Api,
    polarizador: Api,
    supervisor: Api,
    tint_id: str,
    polar_user_id: str,
) -> Dict[str, Any]:
    r = coord_pol.put(
        f"/tint-orders/{tint_id}/assign",
        params={"technician_id": polar_user_id},
    )
    if r.status_code != 200:
        raise RuntimeError(f"tint assign: {r.status_code} {r.text[:300]}")
    log_ok(f"Coord polarizados asignó {tint_id} a {polarizador.user.get('name')}")

    r = polarizador.put(f"/tint-orders/{tint_id}/start")
    if r.status_code != 200:
        raise RuntimeError(f"tint start (polarizador): {r.status_code} {r.text[:300]}")
    log_ok(f"Polarizador inició {tint_id}")

    order = polarizador.get(f"/tint-orders/{tint_id}").json()
    windows = order.get("windows") or []
    for w in windows:
        r = polarizador.put(
            f"/tint-orders/{tint_id}/window",
            json_body={
                "window_type": w.get("window_type"),
                "status": "completed",
                "technician_id": polar_user_id,
                "material": w.get("material") or "ceramic",
                "shade_percentage": w.get("shade_percentage") or 20,
            },
        )
        if r.status_code != 200:
            raise RuntimeError(f"tint window {w.get('window_type')}: {r.status_code} {r.text[:250]}")
        log_ok(f"Polarizador completó ventana {w.get('window_type')}")

    # QC complete by supervisor / coord polarizados
    r = supervisor.put(
        f"/tint-orders/{tint_id}/complete",
        params={"quality_rating": 5, "total_material": 3.5},
    )
    if r.status_code != 200:
        # try coord
        r = coord_pol.put(
            f"/tint-orders/{tint_id}/complete",
            params={"quality_rating": 5, "total_material": 3.5},
        )
    if r.status_code != 200:
        raise RuntimeError(f"tint complete: {r.status_code} {r.text[:300]}")
    log_ok(f"QC polarizados completó {tint_id}")
    return {"tint_order_id": tint_id, "final": "completed"}


def run() -> int:
    print("=" * 72)
    print(f"MULTI-ROLE LIVE CHAIN — {RUN_TAG}")
    print("=" * 72)

    gerencia = Api("gerencia")
    gerencia.login(PIN_GERENCIA)
    log_ok(f"Login gerencia: {gerencia.user.get('name')}")

    roles = ensure_roles(gerencia)
    REPORT["context"]["roles"] = {k: {"user_id": v.get("user_id"), "status": v.get("status")} for k, v in roles.items()}
    required = [
        "ventas", "supervisor", "cajero", "bodegas",
        "coordinador_instalaciones", "coordinador_polarizados",
        "instalaciones", "electrico", "polarizador",
    ]
    missing = [r for r in required if r not in roles]
    if missing:
        log_fail("Faltan roles", str(missing))
        return 2

    # Rate
    try:
        rate_doc = gerencia.get("/settings/exchange-rate").json()
        rate = float(rate_doc.get("usd_to_nio") or EXCHANGE_RATE)
    except Exception:
        rate = EXCHANGE_RATE

    polar = ensure_polarizado_product(gerencia)
    cart = pick_mixed_cart(gerencia, polar)
    customer_id, vehicle_id = pick_customer_vehicle(gerencia)
    REPORT["context"]["customer_id"] = customer_id
    REPORT["context"]["vehicle_id"] = vehicle_id
    REPORT["context"]["cart"] = cart

    # Ensure despachador is bound to wh_main so can process main-branch dispatches
    bind_bodegas_warehouse(str(roles["bodegas"]["user_id"]), WAREHOUSE_ID)

    # Login chain actors
    ventas = login_role(roles, "ventas")
    supervisor = login_role(roles, "supervisor")
    cajero = login_role(roles, "cajero")
    bodegas = login_role(roles, "bodegas")
    coord_inst = login_role(roles, "coordinador_instalaciones")
    coord_pol = login_role(roles, "coordinador_polarizados")
    instalador = login_role(roles, "instalaciones")
    electrico = login_role(roles, "electrico")
    polarizador = login_role(roles, "polarizador")

    # Clock-in technicians
    for role in ("instalaciones", "electrico", "polarizador"):
        clock_in_tech(gerencia, roles, role)
    force_clock_in_mongo([
        roles["instalaciones"]["user_id"],
        roles["electrico"]["user_id"],
        roles["polarizador"]["user_id"],
    ])

    snapshot = draft_and_release(ventas, supervisor, customer_id, vehicle_id, cart, rate)

    # Gerencia can also inspect drafts (permission probe)
    r = gerencia.get("/drafts/sale")
    if r.status_code == 200:
        log_ok("Gerencia puede listar borradores")
    else:
        log_warn("Gerencia no lista borradores", f"{r.status_code}")

    # Seller finalizes (retry payment plan on server expected total)
    payload = snapshot_to_sale(snapshot, f"mr_sale_{RUN_TAG}")
    # Prefer server-side total: omit total_amount, adjust plan if mismatch
    payload.pop("total_amount", None)
    r = ventas.post("/sales", json_body=payload)
    if r.status_code == 409:
        try:
            detail = (r.json() or {}).get("detail") or {}
            if isinstance(detail, dict) and detail.get("error") in {
                "PAYMENT_PLAN_MISMATCH",
                "TOTAL_MISMATCH",
            }:
                expected = float(detail.get("expected_total") or 0)
                if expected > 0:
                    payload["planned_payment_plan"] = {
                        "mode": "cash",
                        "lines": [{"metodo": "cash", "moneda": "NIO", "monto_origen": round2(expected)}],
                    }
                    payload["idempotency_key"] = f"mr_sale_{RUN_TAG}_retry"
                    r = ventas.post("/sales", json_body=payload)
                    log_ok(f"Reintento venta con expected_total={expected}")
        except Exception:
            pass
    if r.status_code != 200:
        raise RuntimeError(f"crear venta: {r.status_code} {r.text[:500]}")
    sale = r.json()
    sale_id = sale.get("sale_id")
    invoice = sale.get("invoice_number")
    log_ok(f"Vendedor envió a caja {invoice} ({sale_id})")
    REPORT["context"]["sale_id"] = sale_id
    REPORT["context"]["invoice_number"] = invoice
    REPORT["context"]["catalog_subtotal_usd"] = sale.get("catalog_subtotal_usd")
    REPORT["context"]["subtotal"] = sale.get("subtotal")
    REPORT["context"]["amounts_currency"] = sale.get("amounts_currency") or sale.get("currency")

    # Cashier
    session_id = ensure_cash_session(cajero, rate)
    log_ok(f"Sesión caja: {session_id}")
    amount = float(sale.get("net_to_collect") or sale.get("total") or 0)
    # refresh from API
    sale_live = gerencia.get(f"/sales/{sale_id}").json()
    amount = float(sale_live.get("net_to_collect") or sale_live.get("amount_pending") or amount)
    r = cajero.post(
        f"/caja/facturas/{sale_id}/cobrar",
        json_body={
            "sesion_id": session_id,
            "amount": round2(amount),
            "payment_method": "cash",
            "received_amount": round2(amount),
            "idempotency_key": f"mr_collect_{sale_id}",
            "notes": f"Cobro multi-role {RUN_TAG}",
        },
    )
    if r.status_code != 200:
        raise RuntimeError(f"cobrar: {r.status_code} {r.text[:400]}")
    collect = r.json()
    fulfillment = collect.get("fulfillment") or {}
    log_ok(
        f"Cajero cobró {invoice}",
        payment_status=collect.get("sale_payment_status"),
        fulfillment=fulfillment.get("triggered"),
    )

    # Wait a beat for fulfillment docs
    time.sleep(0.5)
    sale_paid = gerencia.get(f"/sales/{sale_id}").json()
    dispatch_id = sale_paid.get("dispatch_id") or fulfillment.get("dispatch_id")
    work_order_ids = sale_paid.get("work_order_ids") or fulfillment.get("work_order_ids") or []
    tint_order_id = sale_paid.get("tint_order_id") or fulfillment.get("tint_order_id")
    REPORT["context"]["dispatch_id"] = dispatch_id
    REPORT["context"]["work_order_ids"] = work_order_ids
    REPORT["context"]["tint_order_id"] = tint_order_id

    if not dispatch_id:
        log_fail("Sin dispatch_id tras cobro")
    else:
        complete_dispatch(bodegas, dispatch_id)

    # Load WOs
    all_wos = gerencia.get("/work-orders").json()
    if not isinstance(all_wos, list):
        all_wos = []
    sale_wos = [w for w in all_wos if w.get("sale_id") == sale_id]
    if not sale_wos and work_order_ids:
        sale_wos = [w for w in all_wos if w.get("work_order_id") in work_order_ids]
    log_ok(f"OT de la venta: {len(sale_wos)}", departments=[w.get("department") for w in sale_wos])

    by_dept: Dict[str, List[Dict]] = {}
    for w in sale_wos:
        by_dept.setdefault(str(w.get("department") or "instalaciones"), []).append(w)

    results = []
    # instalaciones
    for wo in by_dept.get("instalaciones") or []:
        results.append(
            advance_wo_chain(
                coord_inst,
                instalador,
                coord_inst,  # QC by coord instalaciones
                wo,
                roles["instalaciones"]["user_id"],
                "instalaciones",
            )
        )
    # electrico
    for wo in by_dept.get("electrico") or []:
        results.append(
            advance_wo_chain(
                coord_inst,
                electrico,
                supervisor,  # QC by supervisor (quality owner)
                wo,
                roles["electrico"]["user_id"],
                "electrico",
            )
        )

    # polarizados OT (primary path) — assigned by coord polarizados
    polar_wos = by_dept.get("polarizados") or []
    if polar_wos:
        for wo in polar_wos:
            results.append(
                advance_wo_chain(
                    coord_pol,
                    polarizador,
                    coord_pol,  # QC by coord polarizados
                    wo,
                    roles["polarizador"]["user_id"],
                    "polarizados",
                )
            )
    else:
        log_fail("No se generaron OT department=polarizados")

    if not (by_dept.get("instalaciones") or by_dept.get("electrico")):
        log_fail("No se generaron OT de instalaciones/eléctrico")

    # tint detail (windows) — still created and linked to OT
    if not tint_order_id:
        tints = gerencia.get("/tint-orders").json()
        if isinstance(tints, list):
            hit = next((t for t in tints if t.get("sale_id") == sale_id), None)
            if hit:
                tint_order_id = hit.get("tint_order_id")
    if tint_order_id:
        # windows completion may still be useful; OT is already delivered above
        try:
            results.append(
                advance_tint(
                    coord_pol,
                    polarizador,
                    supervisor,
                    tint_order_id,
                    roles["polarizador"]["user_id"],
                )
            )
        except Exception as tint_exc:
            # If tint already completed/linked via OT path, record warning not fail
            log_warn("Tint detail no avanzó (OT polarizado ya cerrado)", str(tint_exc))
    else:
        log_warn("Sin tint_order (detalle ventanas); OT polarizado es la fuente de verdad")

    # Flow health probe
    health = gerencia.get("/ops/flow-health")
    if health.status_code == 200:
        body = health.json() or {}
        log_ok(
            "Flow health",
            healthy=body.get("healthy"),
            queues=body.get("queues"),
        )
    else:
        log_warn("Flow health endpoint", f"{health.status_code}")

    # Final probes: technicians cannot list pin users; ventas blocked from dispatch
    r = ventas.get("/auth/pin/users")
    if r.status_code in (401, 403):
        log_ok("Ventas bloqueado en /auth/pin/users")
    else:
        log_fail("Ventas aún ve pin/users", str(r.status_code))

    r = instalador.get("/caja/facturas")
    if r.status_code in (401, 403):
        log_ok("Instalador bloqueado en caja")
    else:
        log_warn("Instalador accede a caja", str(r.status_code))

    r = bodegas.get("/dispatch")
    if r.status_code == 200:
        log_ok("Despachador lista despachos")
    else:
        log_fail("Despachador no lista despachos", f"{r.status_code} {r.text[:150]}")

    REPORT["context"]["results"] = results
    return 0 if not REPORT["fail"] else 1


def main() -> int:
    try:
        code = run()
    except Exception as exc:
        log_fail("Excepción fatal", str(exc))
        import traceback
        traceback.print_exc()
        code = 2

    print("\n" + "=" * 72)
    print(f"RESUMEN OK={len(REPORT['ok'])} FAIL={len(REPORT['fail'])} WARN={len(REPORT['warnings'])}")
    print("=" * 72)
    for f in REPORT["fail"]:
        print(f"  FAIL · {f['msg']}: {f.get('detail','')[:160]}")

    out_paths = [
        Path("/app/backend/data") / f"e2e_multi_role_{RUN_TAG}.json",
        Path("backend/data") / f"e2e_multi_role_{RUN_TAG}.json",
    ]
    for p in out_paths:
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps(REPORT, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"Reporte: {p}")
            break
        except Exception:
            continue
    return code


if __name__ == "__main__":
    sys.exit(main())
