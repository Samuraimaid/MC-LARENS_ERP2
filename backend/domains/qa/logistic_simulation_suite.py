"""Live E2E logistics simulation: blind intake + three-step transfers."""

from __future__ import annotations

import traceback
from datetime import datetime, timezone
from typing import Any, Dict, List

import httpx

PIN_GERENCIA = "01011990"
WAREHOUSE_MAIN = "wh_main"
WAREHOUSE_DEST = "wh_topcar_calvario"
BLIND_INTAKE_QTY = 10
TRANSFER_QTY = 2


class ApiSession:
    def __init__(self, label: str, base_url: str):
        self.label = label
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(timeout=120.0, follow_redirects=True)

    def login(self, pin: str) -> Dict[str, Any]:
        response = self.client.post(f"{self.base_url}/auth/pin/login", json={"pin": pin})
        response.raise_for_status()
        return response.json().get("user") or {}

    def get(self, path: str, **kwargs) -> httpx.Response:
        return self.client.get(f"{self.base_url}{path}", **kwargs)

    def post(self, path: str, json_body: Any = None, **kwargs) -> httpx.Response:
        return self.client.post(f"{self.base_url}{path}", json=json_body, **kwargs)

    def put(self, path: str, json_body: Any = None, **kwargs) -> httpx.Response:
        return self.client.put(f"{self.base_url}{path}", json=json_body, **kwargs)


def _pick_products(catalog: List[Dict[str, Any]], count: int = 3) -> List[Dict[str, Any]]:
    physical = [
        p
        for p in catalog
        if str(p.get("product_type") or "").lower() != "service" and p.get("product_id")
    ]
    physical.sort(key=lambda row: str(row.get("product_id") or ""))
    return physical[:count]


def _inventory_qty(session: ApiSession, warehouse_id: str, product_id: str) -> int:
    response = session.get("/inventory", params={"warehouse_id": warehouse_id})
    if response.status_code != 200:
        return 0
    rows = response.json() if isinstance(response.json(), list) else []
    for row in rows:
        if str(row.get("product_id") or "") == product_id:
            return int(row.get("quantity") or 0)
    return 0


def run_logistic_simulation_suite(base_url: str) -> Dict[str, Any]:
    started_at = datetime.now(timezone.utc).isoformat()
    steps: List[Dict[str, Any]] = []
    errors: List[str] = []

    def record(step: str, ok: bool, detail: Any = None) -> None:
        steps.append({"step": step, "ok": ok, "detail": detail})

    gerencia = ApiSession("gerencia", base_url)
    try:
        user = gerencia.login(PIN_GERENCIA)
        record("login_gerencia", True, {"user_id": user.get("user_id"), "role": user.get("role")})

        products_resp = gerencia.get("/products")
        products_resp.raise_for_status()
        catalog = products_resp.json() if isinstance(products_resp.json(), list) else []
        picked = _pick_products(catalog, count=3)
        if len(picked) < 3:
            raise RuntimeError("Se requieren al menos 3 productos físicos en catálogo")

        intake_items = [
            {"product_id": p["product_id"], "quantity": BLIND_INTAKE_QTY}
            for p in picked
        ]
        intake_resp = gerencia.post(
            "/inventory/purchase-receipt",
            json_body={"warehouse_id": WAREHOUSE_MAIN, "items": intake_items},
        )
        intake_resp.raise_for_status()
        intake_payload = intake_resp.json()
        record(
            "blind_intake_wh_main",
            True,
            {
                "receipt_id": intake_payload.get("receipt_id"),
                "items": intake_payload.get("items"),
            },
        )

        transfer_product = picked[0]["product_id"]
        qty_before_origin = _inventory_qty(gerencia, WAREHOUSE_MAIN, transfer_product)
        qty_before_dest = _inventory_qty(gerencia, WAREHOUSE_DEST, transfer_product)

        create_resp = gerencia.post(
            "/inventory/transfer-request",
            json_body={
                "product_id": transfer_product,
                "from_warehouse_id": WAREHOUSE_MAIN,
                "to_warehouse_id": WAREHOUSE_DEST,
                "quantity": TRANSFER_QTY,
                "reason": "QA logistic simulation",
            },
        )
        create_resp.raise_for_status()
        request_id = create_resp.json().get("request_id")
        record("transfer_request_create", True, {"request_id": request_id})

        for step_name, path in [
            ("transfer_approve", f"/inventory/transfer-requests/{request_id}/approve"),
            ("transfer_ship", f"/inventory/transfer-requests/{request_id}/ship"),
            ("transfer_receive", f"/inventory/transfer-requests/{request_id}/receive"),
        ]:
            step_resp = gerencia.put(path)
            step_resp.raise_for_status()
            record(step_name, True, step_resp.json())

        qty_after_origin = _inventory_qty(gerencia, WAREHOUSE_MAIN, transfer_product)
        qty_after_dest = _inventory_qty(gerencia, WAREHOUSE_DEST, transfer_product)
        origin_delta = qty_after_origin - qty_before_origin
        dest_delta = qty_after_dest - qty_before_dest

        transfer_ok = origin_delta == -TRANSFER_QTY and dest_delta == TRANSFER_QTY
        record(
            "inventory_reconciliation",
            transfer_ok,
            {
                "product_id": transfer_product,
                "origin_delta": origin_delta,
                "dest_delta": dest_delta,
                "expected_origin_delta": -TRANSFER_QTY,
                "expected_dest_delta": TRANSFER_QTY,
            },
        )
        if not transfer_ok:
            errors.append("Conciliación de inventario post-traslado no coincide")

        success = len(errors) == 0 and all(step.get("ok") for step in steps)
        return {
            "suite": "logistic_simulation",
            "success": success,
            "started_at": started_at,
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "steps": steps,
            "errors": errors,
            "summary": {
                "blind_intake_products": len(intake_items),
                "transfer_request_id": request_id,
                "transfer_status_flow": ["approved", "shipped", "received"],
            },
        }
    except Exception as exc:
        errors.append(str(exc))
        record("fatal_error", False, traceback.format_exc())
        return {
            "suite": "logistic_simulation",
            "success": False,
            "started_at": started_at,
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "steps": steps,
            "errors": errors,
        }
    finally:
        gerencia.client.close()