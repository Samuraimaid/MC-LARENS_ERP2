#!/usr/bin/env python3
"""Seed de datos y usuarios para la suite E2E completa del ERP."""
from __future__ import annotations

import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

API_BASE = "http://127.0.0.1:8001/api"
PIN_GERENCIA = "01011990"
BRANCH_ID = "branch_main"
WH_MAIN = "wh_main"
RUN_TAG = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
OUT_DIR = Path(__file__).resolve().parents[2] / "frontend" / "test-results" / "erp-full-suite"

SUITE_ROLE_USERS: List[Dict[str, Any]] = [
    {"role": "ventas", "name": "Suite", "last_name": "Vendedor", "phone": "8100-1001", "login_pin": "55667788"},
    {"role": "cajero", "name": "Suite", "last_name": "Cajero", "phone": "8100-1002", "login_pin": "11223344"},
    {"role": "supervisor", "name": "Suite", "last_name": "Supervisor", "phone": "8100-1003", "login_pin": "00000003"},
    {"role": "bodegas", "name": "Suite", "last_name": "Bodeguero", "phone": "8100-1004", "login_pin": "00000010"},
    {"role": "instalaciones", "name": "Suite", "last_name": "Instalador", "phone": "8100-1005", "login_pin": "00000012"},
    {"role": "polarizador", "name": "Suite", "last_name": "Polarizador", "phone": "8100-1006", "login_pin": "00000009"},
    {"role": "electrico", "name": "Suite", "last_name": "Electrico", "phone": "8100-1007", "login_pin": "00000008"},
    {"role": "coordinador_instalaciones", "name": "Suite", "last_name": "CoordInst", "phone": "8100-1008", "login_pin": "88112233"},
    {"role": "coordinador_polarizados", "name": "Suite", "last_name": "CoordPol", "phone": "8100-1009", "login_pin": "88223344"},
    {"role": "transporte", "name": "Suite", "last_name": "Transporte", "phone": "8100-1010", "login_pin": "00000011"},
    {"role": "entregador", "name": "Suite", "last_name": "Entregador", "phone": "8100-1011", "login_pin": "00000015"},
    {"role": "jefe_vendedores", "name": "Suite", "last_name": "JefeVentas", "phone": "8100-1012", "login_pin": "00000006"},
    {"role": "jefe_tienda", "name": "Suite", "last_name": "JefeTienda", "phone": "8100-1013", "login_pin": "00000007"},
    {"role": "recursos_humanos", "name": "Suite", "last_name": "RRHH", "phone": "8100-1014", "login_pin": "00000002"},
    {"role": "programador", "name": "Suite", "last_name": "Programador", "phone": "8100-1015", "login_pin": "00000016"},
]


class Api:
    def __init__(self):
        self.s = requests.Session()

    def login(self, pin: str) -> Dict[str, Any]:
        r = self.s.post(f"{API_BASE}/auth/pin/login", json={"pin": pin}, timeout=30)
        r.raise_for_status()
        return r.json().get("user") or {}

    def get(self, path: str):
        return self.s.get(f"{API_BASE}{path}", timeout=60)

    def post(self, path: str, body: Any = None):
        return self.s.post(f"{API_BASE}{path}", json=body, timeout=120)

    def put(self, path: str, body: Any = None):
        return self.s.put(f"{API_BASE}{path}", json=body, timeout=120)


def ensure_suite_users(api: Api, report: Dict[str, Any]) -> None:
    users = api.get("/auth/pin/users").json()
    by_role = {str(u.get("role")): u for u in users if isinstance(users, list)}
    created = []
    for spec in SUITE_ROLE_USERS:
        role = spec["role"]
        if role in by_role:
            uid = by_role[role].get("user_id")
            if uid:
                api.put(f"/users/{uid}/login-pin", {"new_pin": spec["login_pin"]})
            report["users"][role] = {"user_id": uid, "login_pin": spec["login_pin"], "status": "existing"}
            continue
        body = {
            "name": spec["name"],
            "last_name": spec["last_name"],
            "phone": spec["phone"],
            "role": role,
            "branch_id": BRANCH_ID,
            "warehouse_id": WH_MAIN if role == "bodegas" else None,
            "login_pin": spec["login_pin"],
            "pin": spec["phone"].split("-")[1][-4:],
        }
        r = api.post("/users/pin", body)
        if r.status_code != 200:
            report["errors"].append(f"No se pudo crear {role}: {r.status_code} {r.text[:200]}")
            continue
        user = r.json()
        created.append(role)
        report["users"][role] = {
            "user_id": user.get("user_id"),
            "login_pin": spec["login_pin"],
            "status": "created",
        }
    report["users_created"] = created


def ensure_suite_customers(api: Api, report: Dict[str, Any]) -> None:
    customers = api.get("/customers").json()
    existing_names = {str(c.get("name") or "").lower() for c in customers}

    specs = [
        {
            "key": "natural_sin_credito",
            "name": f"Suite Cliente Natural {RUN_TAG}",
            "customer_type": "natural",
            "phone": "8200-2001",
            "email": f"suite.natural.{RUN_TAG}@e2e.local",
            "credit_limit": 0,
        },
        {
            "key": "natural_con_credito",
            "name": f"Suite Cliente Credito {RUN_TAG}",
            "customer_type": "natural",
            "phone": "8200-2002",
            "email": f"suite.credito.{RUN_TAG}@e2e.local",
            "credit_limit": 50000,
        },
        {
            "key": "empresa",
            "name": f"Suite Empresa Comercial {RUN_TAG}",
            "customer_type": "juridica",
            "phone": "8200-2003",
            "email": f"suite.empresa.{RUN_TAG}@e2e.local",
            "credit_limit": 120000,
            "tax_id": f"J{RUN_TAG[-8:]}",
        },
        {
            "key": "caotico",
            "name": f"Suite Cliente Caótico {RUN_TAG}",
            "customer_type": "natural",
            "phone": "8200-9999",
            "email": f"suite.caotico.{RUN_TAG}@e2e.local",
            "credit_limit": 1,
            "notes": "Cliente para pruebas de errores humanos",
        },
    ]

    for spec in specs:
        key = spec.pop("key")
        if any(spec["name"].lower() in n for n in existing_names):
            found = next((c for c in customers if spec["name"].lower() in str(c.get("name", "")).lower()), None)
            report["customers"][key] = found
            continue
        r = api.post("/customers", spec)
        if r.status_code != 200:
            report["errors"].append(f"Cliente {key}: {r.status_code} {r.text[:200]}")
            continue
        report["customers"][key] = r.json()


def ensure_suite_vehicles(api: Api, report: Dict[str, Any]) -> None:
    credit_customer = (report.get("customers") or {}).get("natural_con_credito") or {}
    customer_id = credit_customer.get("customer_id")
    if not customer_id:
        return
    vehicles = api.get("/vehicles").json()
    has_vehicle = any(str(v.get("customer_id")) == str(customer_id) for v in vehicles)
    if has_vehicle:
        existing = next(
            (v for v in vehicles if str(v.get("customer_id")) == str(customer_id)),
            None,
        )
        report["vehicles"]["for_credit_customer"] = existing or "existing"
        return
    body = {
        "customer_id": customer_id,
        "brand": "Toyota",
        "model": "Corolla",
        "year": 2020,
        "plate": f"SUITE{RUN_TAG[-4:]}",
        "color": "Gris",
        "vin": f"SUITE{uuid.uuid4().hex[:12].upper()}",
    }
    r = api.post("/vehicles", body)
    if r.status_code == 200:
        report["vehicles"]["for_credit_customer"] = r.json()
    else:
        report["errors"].append(f"Vehículo suite: {r.status_code} {r.text[:200]}")


def ensure_product_stock(api: Api, report: Dict[str, Any]) -> None:
    products = api.get("/products").json()
    inventory = api.get("/inventory").json()
    if not products:
        r = api.post("/products/seed-demo")
        if r.status_code == 200:
            products = api.get("/products").json()
    stock_by_product = {}
    for row in inventory:
        pid = row.get("product_id")
        stock_by_product[pid] = stock_by_product.get(pid, 0) + float(row.get("quantity") or 0)
    product = next((p for p in products if stock_by_product.get(p.get("product_id"), 0) >= 1), products[0] if products else None)
    if not product:
        report["errors"].append("No hay productos para pruebas")
        return
    pid = product.get("product_id")
    if stock_by_product.get(pid, 0) < 5:
        api.post("/inventory/add-stock", {
            "product_id": pid,
            "warehouse_id": WH_MAIN,
            "quantity": 20,
            "reason": f"Suite E2E seed {RUN_TAG}",
        })
    report["catalog"] = {
        "product_id": pid,
        "product_name": product.get("name"),
        "warehouse_id": WH_MAIN,
        "exchange_rate": float((api.get("/settings/exchange-rate").json() or {}).get("usd_to_nio") or 36.5),
    }


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    report: Dict[str, Any] = {
        "run_tag": RUN_TAG,
        "users": {},
        "customers": {},
        "vehicles": {},
        "catalog": {},
        "errors": [],
    }
    api = Api()
    try:
        api.login(PIN_GERENCIA)
    except Exception as exc:
        print(f"FAIL: login gerencia — {exc}")
        report["errors"].append(str(exc))
        out = OUT_DIR / "seed-report.json"
        out.write_text(json.dumps(report, indent=2), encoding="utf-8")
        return 1

    ensure_suite_users(api, report)
    ensure_suite_customers(api, report)
    ensure_suite_vehicles(api, report)
    ensure_product_stock(api, report)

    out = OUT_DIR / "seed-report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Seed OK — usuarios={len(report['users'])} clientes={len(report['customers'])}")
    if report["errors"]:
        print("Advertencias:", "; ".join(report["errors"]))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())