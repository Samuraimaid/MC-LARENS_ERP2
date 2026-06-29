#!/usr/bin/env python3
"""Suite E2E completa: preflight → cotización → inventario → KDS → flujo ventas → caja → despacho."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

API_BASE = "http://127.0.0.1:8001/api"
PIN_GERENCIA = "01011990"
PIN_VENTAS = "55667788"
PIN_CAJERO = "11223344"
BRANCH_MAIN = "branch_main"
BRANCH_NORTH = "branch_north"
WAREHOUSE_MAIN = "wh_main"
EXCHANGE_RATE = 36.5
RUN_TAG = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
REPORT_DIR = Path(__file__).resolve().parents[2] / "backend" / "data"
REPORT_DIR.mkdir(parents=True, exist_ok=True)

REPORT: Dict[str, Any] = {
    "run_tag": RUN_TAG,
    "phases": {},
    "ok": [],
    "failed": [],
    "fixed": [],
}


def log_ok(phase: str, msg: str) -> None:
    print(f"OK [{phase}]: {msg}")
    REPORT["ok"].append({"phase": phase, "msg": msg})
    REPORT["phases"].setdefault(phase, {"ok": [], "failed": []})["ok"].append(msg)


def log_fail(phase: str, msg: str, detail: str = "") -> None:
    print(f"FAIL [{phase}]: {msg}")
    if detail:
        print(f"  {detail}")
    row = {"phase": phase, "msg": msg, "detail": detail}
    REPORT["failed"].append(row)
    REPORT["phases"].setdefault(phase, {"ok": [], "failed": []})["failed"].append(row)


class ApiClient:
    def __init__(self, label: str):
        self.label = label
        self.session = requests.Session()
        self.user: Dict[str, Any] = {}

    def login(self, pin: str) -> Dict[str, Any]:
        r = self.session.post(f"{API_BASE}/auth/pin/login", json={"pin": pin}, timeout=30)
        if r.status_code != 200:
            raise RuntimeError(f"Login {self.label}: {r.status_code} {r.text[:300]}")
        self.user = r.json().get("user") or {}
        return self.user

    def get(self, path: str, **kwargs) -> requests.Response:
        return self.session.get(f"{API_BASE}{path}", timeout=60, **kwargs)

    def post(self, path: str, json_body: Any = None, **kwargs) -> requests.Response:
        return self.session.post(f"{API_BASE}{path}", json=json_body, timeout=120, **kwargs)

    def put(self, path: str, json_body: Any = None, **kwargs) -> requests.Response:
        return self.session.put(f"{API_BASE}{path}", json=json_body, timeout=120, **kwargs)


def phase_preflight(client: ApiClient) -> bool:
    phase = "preflight"
    try:
        r = client.get("/")
        if r.status_code == 200:
            log_ok(phase, f"API root: {r.json().get('message', 'ok')}")
        else:
            log_fail(phase, "API root no responde", r.text[:200])
            return False

        branches = client.get("/branches").json()
        by_id = {b["branch_id"]: b for b in branches}
        for bid, expect_inst, expect_tint in [
            (BRANCH_MAIN, True, True),
            (BRANCH_NORTH, False, False),
            ("branch_south", False, False),
        ]:
            branch = by_id.get(bid)
            if not branch:
                log_fail(phase, f"Sucursal {bid} no encontrada")
                continue
            policy = branch.get("service_policy") or {}
            inst = bool(policy.get("installations_enabled"))
            tint = bool(policy.get("tint_enabled"))
            if inst == expect_inst and tint == expect_tint:
                log_ok(phase, f"{branch.get('name')} ({bid}): inst={inst} tint={tint}")
            else:
                log_fail(
                    phase,
                    f"Política incorrecta en {bid}",
                    f"expected inst={expect_inst} tint={expect_tint}, got inst={inst} tint={tint}",
                )

        warehouses = client.get("/warehouses").json()
        log_ok(phase, f"{len(warehouses)} bodegas registradas")
        return True
    except Exception as exc:
        log_fail(phase, "Excepción en preflight", str(exc))
        return False


def phase_catalog(client: ApiClient) -> Optional[Dict[str, Any]]:
    phase = "catalog"
    try:
        customers = client.get("/customers").json()
        vehicles = client.get("/vehicles").json()
        products = client.get("/products").json()
        inventory = client.get("/inventory").json()

        log_ok(phase, f"Clientes={len(customers)} Vehículos={len(vehicles)} Productos={len(products)} Inventario={len(inventory)}")

        cust_with_vehicle = None
        vehicle_id = None
        vehicles_by_cust: Dict[str, List] = {}
        for v in vehicles:
            cid = v.get("customer_id")
            if cid:
                vehicles_by_cust.setdefault(cid, []).append(v)
        for c in customers:
            cid = c.get("customer_id")
            if vehicles_by_cust.get(cid):
                cust_with_vehicle = c
                vehicle_id = vehicles_by_cust[cid][0]["vehicle_id"]
                break

        if not cust_with_vehicle:
            log_fail(phase, "No hay cliente con vehículo")
            return None
        log_ok(phase, f"Cliente+vehículo: {cust_with_vehicle.get('name')} / {vehicle_id}")

        physical = None
        for p in products:
            if p.get("product_type") == "service":
                continue
            pid = p["product_id"]
            stock = sum(
                float(r.get("quantity") or 0)
                for r in inventory
                if r.get("product_id") == pid and r.get("warehouse_id") == WAREHOUSE_MAIN
            )
            if stock >= 5:
                physical = p
                break
        if not physical:
            log_fail(phase, "Sin producto con stock >= 5 en wh_main")
            return None
        log_ok(phase, f"Producto stock: {physical.get('name')} ({physical['product_id']})")

        return {
            "customer": cust_with_vehicle,
            "vehicle_id": vehicle_id,
            "product": physical,
        }
    except Exception as exc:
        log_fail(phase, "Excepción en catálogo", str(exc))
        return None


def phase_quotation(client: ApiClient, ctx: Dict[str, Any]) -> Optional[str]:
    phase = "quotation"
    try:
        ventas = ApiClient("ventas-quot")
        ventas.login(PIN_VENTAS)
        payload = {
            "customer_id": ctx["customer"]["customer_id"],
            "vehicle_id": ctx["vehicle_id"],
            "warehouse_id": WAREHOUSE_MAIN,
            "items": [
                {
                    "product_id": ctx["product"]["product_id"],
                    "quantity": 1,
                    "with_installation": False,
                    "discount": 0,
                }
            ],
            "currency": "NIO",
            "exchange_rate": EXCHANGE_RATE,
            "apply_iva": True,
            "valid_days": 7,
            "notes": f"Cotización E2E {RUN_TAG}",
        }
        r = ventas.post("/quotations", json_body=payload)
        if r.status_code != 200:
            log_fail(phase, "Crear cotización", r.text[:300])
            return None
        quot = r.json()
        quot_id = quot.get("quotation_id")
        log_ok(phase, f"Cotización creada: {quot_id} total={quot.get('total')}")

        r2 = ventas.put(f"/quotations/{quot_id}/status", params={"status": "approved"})
        if r2.status_code == 200:
            log_ok(phase, f"Cotización {quot_id} aprobada")
        else:
            log_fail(phase, f"Aprobar cotización {quot_id}", r2.text[:200])

        listed = ventas.get("/quotations").json()
        found = any(q.get("quotation_id") == quot_id for q in listed)
        if found:
            log_ok(phase, "Cotización visible en listado")
        else:
            log_fail(phase, "Cotización no aparece en listado")
        return quot_id
    except Exception as exc:
        log_fail(phase, "Excepción en cotización", str(exc))
        return None


def phase_inventory(client: ApiClient, ctx: Dict[str, Any]) -> None:
    phase = "inventory"
    pid = ctx["product"]["product_id"]
    try:
        before_rows = client.get("/inventory").json()
        before_qty = next(
            (
                int(r.get("quantity") or 0)
                for r in before_rows
                if r.get("product_id") == pid and r.get("warehouse_id") == WAREHOUSE_MAIN
            ),
            0,
        )

        r = client.post(
            "/inventory/add-stock",
            params={"product_id": pid, "warehouse_id": WAREHOUSE_MAIN, "quantity": 2},
        )
        if r.status_code != 200:
            log_fail(phase, "Ingreso de stock", r.text[:300])
            return
        added = r.json()
        log_ok(phase, f"Ingreso +2 unidades: qty={added.get('quantity')} suggest_labels={added.get('suggest_label_print')}")

        after_rows = client.get("/inventory").json()
        after_qty = next(
            (
                int(r.get("quantity") or 0)
                for r in after_rows
                if r.get("product_id") == pid and r.get("warehouse_id") == WAREHOUSE_MAIN
            ),
            0,
        )
        if after_qty >= before_qty + 2:
            log_ok(phase, f"Stock verificado: {before_qty} -> {after_qty}")
        else:
            log_fail(phase, "Stock no incrementó", f"before={before_qty} after={after_qty}")

        warehouses = client.get("/warehouses").json()
        alt_wh = next((w["warehouse_id"] for w in warehouses if w["warehouse_id"] != WAREHOUSE_MAIN), None)
        if not alt_wh or after_qty < 1:
            log_ok(phase, "Transferencia omitida (sin bodega alterna o stock insuficiente)")
            return

        r_xfer = client.post(
            "/inventory/transfer",
            params={
                "product_id": pid,
                "from_warehouse": WAREHOUSE_MAIN,
                "to_warehouse": alt_wh,
                "quantity": 1,
            },
        )
        if r_xfer.status_code == 200:
            log_ok(phase, f"Transferencia wh_main -> {alt_wh}: 1 unidad")
        else:
            log_fail(phase, "Transferencia entre bodegas", r_xfer.text[:300])
    except Exception as exc:
        log_fail(phase, "Excepción en inventario", str(exc))


def phase_kds(client: ApiClient, expect_activity: bool, sale_ids: Optional[List[str]] = None) -> None:
    phase = "kds" if not expect_activity else "kds-post-sale"
    try:
        endpoints = [
            ("/kds/warehouse", "bodega"),
            ("/kds/orders?department=instalaciones", "instalaciones"),
            ("/kds/tint-orders", "polarizados"),
            ("/kds/board", "tablero"),
        ]
        for path, label in endpoints:
            r = client.get(path)
            if r.status_code != 200:
                log_fail(phase, f"KDS {label}", r.text[:200])
                continue
            data = r.json()
            if path.endswith("/board"):
                counts = data.get("counts") or {}
                log_ok(phase, f"KDS tablero: {counts}")
                depts = data.get("departments") or {}
                for dept in ("bodega", "instalaciones", "polarizados"):
                    if dept in depts:
                        log_ok(phase, f"  departamento '{dept}': {len(depts[dept])} items")
            else:
                count = len(data) if isinstance(data, list) else 0
                log_ok(phase, f"KDS {label}: {count} registros")

        if expect_activity and sale_ids:
            orders = client.get("/kds/orders").json()
            warehouse = client.get("/kds/warehouse").json()
            sale_set = set(sale_ids)
            wo_for_sales = [o for o in orders if o.get("sale_id") in sale_set]
            disp_for_sales = [d for d in warehouse if d.get("sale_id") in sale_set]
            if wo_for_sales:
                log_ok(phase, f"Órdenes instalación KDS para ventas E2E: {len(wo_for_sales)}")
            else:
                log_fail(phase, "KDS instalaciones sin órdenes de ventas E2E", f"sale_ids={sale_ids}")
            if disp_for_sales:
                log_ok(phase, f"Despachos KDS bodega para ventas E2E: {len(disp_for_sales)}")
            else:
                log_fail(phase, "KDS bodega sin despachos de ventas E2E", f"sale_ids={sale_ids}")
    except Exception as exc:
        log_fail(phase, "Excepción en KDS", str(exc))


def run_subprocess_script(script_name: str, phase: str) -> int:
    script_path = Path(__file__).resolve().parent / script_name
    if not script_path.exists():
        log_fail(phase, f"Script no encontrado: {script_name}")
        return 1
    print(f"\n{'=' * 72}\nEjecutando {script_name}\n{'=' * 72}")
    result = subprocess.run(
        [sys.executable, str(script_path)],
        cwd=str(script_path.resolve().parents[2]),
        capture_output=False,
    )
    if result.returncode == 0:
        log_ok(phase, f"{script_name} completado sin fallos")
    else:
        log_fail(phase, f"{script_name} terminó con código {result.returncode}")
    return result.returncode


def run_unit_tests(phase: str) -> int:
    tests_dir = Path(__file__).resolve().parents[1] / "tests"
    label_tests = tests_dir / "test_product_labels.py"
    if not label_tests.exists():
        log_fail(phase, "test_product_labels.py no encontrado")
        return 1
    print(f"\n{'=' * 72}\nEjecutando pytest test_product_labels.py\n{'=' * 72}")
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            str(label_tests),
            "-q",
            "--tb=short",
            "-o",
            "addopts=",
        ],
        cwd=str(Path(__file__).resolve().parents[2]),
        capture_output=True,
        text=True,
    )
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    if result.returncode == 0:
        log_ok(phase, "test_product_labels.py: todos pasaron")
    else:
        log_fail(phase, "test_product_labels.py falló", result.stdout[-500:] if result.stdout else "")
    return result.returncode


def main() -> int:
    print("=" * 72)
    print(f"E2E FULL PROCESS SUITE — tag {RUN_TAG}")
    print("=" * 72)

    gerencia = ApiClient("gerencia")
    try:
        gerencia.login(PIN_GERENCIA)
        log_ok("auth", f"Gerencia: {gerencia.user.get('name')}")
    except Exception as exc:
        log_fail("auth", "Login gerencia falló", str(exc))
        _write_report()
        return 1

    if not phase_preflight(gerencia):
        _write_report()
        return 1

    ctx = phase_catalog(gerencia)
    if ctx:
        phase_quotation(gerencia, ctx)
        phase_inventory(gerencia, ctx)

    phase_kds(gerencia, expect_activity=False)

    workflow_rc = run_subprocess_script("e2e_full_workflow_live.py", "workflow")
    sale_ids: List[str] = []
    if workflow_rc == 0:
        sale_ids = _load_workflow_sale_ids()
        if not sale_ids:
            try:
                sales = gerencia.get("/sales", params={"limit": 30}).json()
                sales_sorted = sorted(sales, key=lambda s: s.get("created_at") or "", reverse=True)
                sale_ids = [s["sale_id"] for s in sales_sorted[:5] if s.get("sale_id")]
            except Exception:
                pass
        gerencia.login(PIN_GERENCIA)
        phase_kds(gerencia, expect_activity=True, sale_ids=sale_ids)

    run_subprocess_script("e2e_cashier_features.py", "cashier")
    run_subprocess_script("e2e_cancel_sale_flow.py", "cancel-sale")
    run_unit_tests("unit-tests")

    print("\n" + "=" * 72)
    print("RESUMEN SUITE COMPLETA")
    print("=" * 72)
    print(f"OK: {len(REPORT['ok'])} | FAIL: {len(REPORT['failed'])}")
    for phase, data in REPORT["phases"].items():
        fails = len(data.get("failed", []))
        if fails:
            print(f"  {phase}: {len(data.get('ok', []))} ok, {fails} fail")

    if REPORT["failed"]:
        print("\nFallos:")
        for row in REPORT["failed"]:
            print(f"  - [{row['phase']}] {row['msg']}")

    _write_report()
    return 0 if not REPORT["failed"] and workflow_rc == 0 else 1


def _load_workflow_sale_ids() -> List[str]:
    data_dir = Path(__file__).resolve().parents[1] / "data"
    reports = sorted(data_dir.glob("e2e_workflow_report_*.json"), reverse=True)
    for report_path in reports[:3]:
        try:
            payload = json.loads(report_path.read_text(encoding="utf-8"))
            sale_ids = [
                str(row.get("sale_id"))
                for row in (payload.get("sales") or [])
                if row.get("sale_id")
            ]
            if sale_ids:
                log_ok("workflow", f"Sale IDs desde {report_path.name}: {len(sale_ids)}")
                return sale_ids
        except Exception:
            continue
    return []


def _write_report() -> None:
    out = REPORT_DIR / f"e2e_full_process_report_{RUN_TAG}.json"
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(REPORT, fh, ensure_ascii=False, indent=2)
    print(f"\nReporte JSON: {out}")


if __name__ == "__main__":
    sys.exit(main())