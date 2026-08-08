#!/usr/bin/env python3
"""Clear all operational queues (caja, despacho, OT, polarizados, drafts de prueba)."""
from __future__ import annotations

import asyncio
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List

import requests
from motor.motor_asyncio import AsyncIOMotorClient

API = "http://127.0.0.1:8001/api"
PIN_GERENCIA = "01011990"
BRANCH_ID = "branch_main"
REPORT: Dict[str, Any] = {"ok": [], "detail": {}, "at": datetime.now(timezone.utc).isoformat()}


def log(msg: str) -> None:
    print(f"OK: {msg}")
    REPORT["ok"].append(msg)


def login() -> requests.Session:
    s = requests.Session()
    r = s.post(f"{API}/auth/pin/login", json={"pin": PIN_GERENCIA}, timeout=30)
    r.raise_for_status()
    user = (r.json() or {}).get("user") or {}
    log(f"Login gerencia: {user.get('name')} ({user.get('role')})")
    return s


def api_clear(s: requests.Session) -> None:
    # Caja: cotización/abiertas + crédito
    for tab in ("abiertas", "cotizacion", "credito"):
        r = s.post(
            f"{API}/caja/facturas/clear-queue",
            json={"branch_id": BRANCH_ID, "tab": tab},
            timeout=120,
        )
        if r.status_code == 200:
            body = r.json() or {}
            log(f"Caja tab={tab}: removed={body.get('removed')} skipped={body.get('skipped')}")
            REPORT["detail"][f"caja_{tab}"] = body
        else:
            print(f"WARN caja {tab}: {r.status_code} {r.text[:200]}")

    # Despacho
    r = s.post(
        f"{API}/dispatch/clear-queue",
        json={"branch_id": BRANCH_ID, "warehouse_id": "wh_main"},
        timeout=120,
    )
    if r.status_code == 200:
        body = r.json() or {}
        log(f"Despacho clear-queue: removed={body.get('removed')}")
        REPORT["detail"]["dispatch_api"] = body
    else:
        print(f"WARN dispatch: {r.status_code} {r.text[:200]}")

    # Coordinación: instalaciones / electrico / polarizados
    for dept in ("instalaciones", "electrico", "polarizados"):
        r = s.post(
            f"{API}/coordinator/clear-queue",
            json={"department": dept, "branch_id": BRANCH_ID, "profile": dept},
            timeout=120,
        )
        if r.status_code == 200:
            body = r.json() or {}
            log(f"Coord {dept}: removed={body.get('removed')}")
            REPORT["detail"][f"coord_{dept}"] = body
        else:
            print(f"WARN coord {dept}: {r.status_code} {r.text[:200]}")


async def mongo_deep_clear() -> Dict[str, Any]:
    """Remove remaining active queue items that official purge endpoints leave behind."""
    uri = os.environ.get("MONGO_URL") or os.environ.get("MONGODB_LOCAL_URI") or "mongodb://mongodb:27017"
    dbn = os.environ.get("DB_NAME") or "mc-larens2_mundo_accesorios_erp"
    db = AsyncIOMotorClient(uri)[dbn]
    out: Dict[str, Any] = {}

    # Snapshot before
    wo_before = await db.work_orders.aggregate(
        [{"$group": {"_id": "$status", "n": {"$sum": 1}}}]
    ).to_list(50)
    disp_before = await db.dispatch_orders.aggregate(
        [{"$group": {"_id": "$status", "n": {"$sum": 1}}}]
    ).to_list(50)
    tint_before = await db.tint_orders.aggregate(
        [{"$group": {"_id": "$status", "n": {"$sum": 1}}}]
    ).to_list(50)
    out["before"] = {
        "work_orders": {str(r["_id"]): r["n"] for r in wo_before},
        "dispatch": {str(r["_id"]): r["n"] for r in disp_before},
        "tint": {str(r["_id"]): r["n"] for r in tint_before},
    }

    # Active work orders (not completed/delivered/cancelled)
    wo_res = await db.work_orders.delete_many(
        {
            "status": {
                "$in": [
                    "pending",
                    "pending_assignment",
                    "in_progress",
                    "quality_check",
                ]
            }
        }
    )
    out["work_orders_deleted"] = int(wo_res.deleted_count or 0)

    # Active tint orders
    tint_res = await db.tint_orders.delete_many(
        {
            "status": {
                "$in": [
                    "pending",
                    "pending_assignment",
                    "in_progress",
                    "quality_check",
                    "assigned",
                ]
            }
        }
    )
    out["tint_orders_deleted"] = int(tint_res.deleted_count or 0)

    # Active dispatches
    disp_res = await db.dispatch_orders.delete_many(
        {"status": {"$in": ["pending", "in_progress", "partial"]}}
    )
    out["dispatch_deleted"] = int(disp_res.deleted_count or 0)

    # Open sales still in cashier queue (pending/partial), post-test cleanup
    open_sales = await db.sales.find(
        {
            "invoice_state": {"$ne": "cancelled"},
            "payment_status": {"$in": ["pending", "partial"]},
        },
        {"_id": 0, "sale_id": 1, "invoice_number": 1},
    ).to_list(1000)
    cancelled = 0
    now = datetime.now(timezone.utc).isoformat()
    for sale in open_sales:
        sid = sale.get("sale_id")
        if not sid:
            continue
        r = await db.sales.update_one(
            {"sale_id": sid},
            {
                "$set": {
                    "invoice_state": "cancelled",
                    "cancel_reason": "Limpieza masiva de colas post-pruebas",
                    "cancel_justification_internal": "clear_all_ops_queues",
                    "cancelled_at": now,
                    "cancelled_by_name": "system_queue_cleanup",
                    "updated_at": now,
                }
            },
        )
        cancelled += int(r.modified_count or 0)
    out["sales_cancelled_open"] = cancelled

    # Test drafts (e2e / multi-role)
    draft_res = await db.sale_drafts.delete_many(
        {
            "$or": [
                {"draft_id": {"$regex": r"^(e2e_|mr_)", "$options": "i"}},
                {"id": {"$regex": r"^(e2e_|mr_)", "$options": "i"}},
                {"name": {"$regex": r"(E2E|MultiRole|Multi-role|multi-role)", "$options": "i"}},
            ]
        }
    )
    # collection name variants
    if draft_res.deleted_count == 0:
        for coll_name in ("drafts", "sale_form_drafts", "user_drafts"):
            try:
                coll = db[coll_name]
                r2 = await coll.delete_many(
                    {
                        "$or": [
                            {"draft_id": {"$regex": r"^(e2e_|mr_)", "$options": "i"}},
                            {"id": {"$regex": r"^(e2e_|mr_)", "$options": "i"}},
                            {"name": {"$regex": r"(E2E|MultiRole)", "$options": "i"}},
                        ]
                    }
                )
                if r2.deleted_count:
                    out[f"drafts_{coll_name}"] = int(r2.deleted_count)
            except Exception:
                pass
    out["sale_drafts_deleted"] = int(draft_res.deleted_count or 0)

    # Stale pending sale requests
    req_res = await db.sale_requests.delete_many({"status": "pending"})
    out["sale_requests_pending_deleted"] = int(req_res.deleted_count or 0)

    # Ops notifications backlog (assignment / QC / dispatch)
    notif_res = await db.notifications.delete_many(
        {
            "read": {"$ne": True},
            "metadata.type": {
                "$in": [
                    "work_order_assigned",
                    "work_order_qc_approved",
                    "work_order_qc_rejected",
                    "tint_order_assigned",
                    "tint_order_pending_assignment",
                    "installation_orders_pending_assignment",
                    "sale_edit_request",
                    "sale_cancel_request",
                ]
            },
        }
    )
    # fallback if metadata nested differently
    if notif_res.deleted_count == 0:
        notif_res = await db.notifications.delete_many(
            {
                "$or": [
                    {"type": {"$regex": r"(work_order|tint|dispatch|qc|instal)", "$options": "i"}},
                    {"message": {"$regex": r"(orden|despacho|calidad|polarizado|instalaci)", "$options": "i"}},
                ],
                "read": {"$ne": True},
            }
        )
    out["notifications_deleted"] = int(notif_res.deleted_count or 0)

    # After snapshot
    wo_after = await db.work_orders.aggregate(
        [{"$group": {"_id": "$status", "n": {"$sum": 1}}}]
    ).to_list(50)
    disp_after = await db.dispatch_orders.aggregate(
        [{"$group": {"_id": "$status", "n": {"$sum": 1}}}]
    ).to_list(50)
    tint_after = await db.tint_orders.aggregate(
        [{"$group": {"_id": "$status", "n": {"$sum": 1}}}]
    ).to_list(50)
    open_after = await db.sales.count_documents(
        {
            "invoice_state": {"$ne": "cancelled"},
            "payment_status": {"$in": ["pending", "partial"]},
        }
    )
    active_wo = await db.work_orders.count_documents(
        {"status": {"$in": ["pending", "pending_assignment", "in_progress", "quality_check"]}}
    )
    active_disp = await db.dispatch_orders.count_documents(
        {"status": {"$in": ["pending", "in_progress", "partial"]}}
    )
    active_tint = await db.tint_orders.count_documents(
        {"status": {"$in": ["pending", "pending_assignment", "in_progress", "quality_check", "assigned"]}}
    )
    out["after"] = {
        "work_orders": {str(r["_id"]): r["n"] for r in wo_after},
        "dispatch": {str(r["_id"]): r["n"] for r in disp_after},
        "tint": {str(r["_id"]): r["n"] for r in tint_after},
        "open_sales_pending_or_partial": open_after,
        "active_work_orders": active_wo,
        "active_dispatch": active_disp,
        "active_tint": active_tint,
    }
    return out


def verify_api(s: requests.Session) -> None:
    checks = []
    # open invoices
    r = s.get(f"{API}/caja/facturas", params={"tab": "abiertas", "limit": 50}, timeout=60)
    if r.status_code == 200:
        rows = (r.json() or {}).get("rows") or []
        checks.append(("caja_abiertas", len(rows)))
    r = s.get(f"{API}/dispatch", timeout=60)
    if r.status_code == 200:
        rows = r.json() if isinstance(r.json(), list) else []
        active = [d for d in rows if str(d.get("status") or "").lower() in {"pending", "in_progress", "partial"}]
        checks.append(("dispatch_active", len(active)))
    r = s.get(f"{API}/work-orders", timeout=60)
    if r.status_code == 200:
        rows = r.json() if isinstance(r.json(), list) else []
        active = [
            w
            for w in rows
            if str(w.get("status") or "").lower()
            in {"pending", "pending_assignment", "in_progress", "quality_check"}
        ]
        checks.append(("work_orders_active", len(active)))
    r = s.get(f"{API}/tint-orders", timeout=60)
    if r.status_code == 200:
        rows = r.json() if isinstance(r.json(), list) else []
        active = [
            t
            for t in rows
            if str(t.get("status") or "").lower()
            not in {"completed", "cancelled", "delivered"}
        ]
        checks.append(("tint_active", len(active)))
    r = s.get(f"{API}/quality-control/pending", timeout=60)
    if r.status_code == 200:
        rows = r.json() if isinstance(r.json(), list) else []
        checks.append(("qc_pending", len(rows)))

    for name, n in checks:
        status = "VACÍA" if n == 0 else f"{n} restantes"
        log(f"Verificación {name}: {status}")
        REPORT["detail"][f"verify_{name}"] = n


def main() -> int:
    print("=" * 64)
    print("LIMPIEZA TOTAL DE COLAS OPERATIVAS")
    print("=" * 64)
    s = login()
    api_clear(s)
    deep = asyncio.run(mongo_deep_clear())
    REPORT["detail"]["mongo_deep"] = deep
    log(
        "Mongo deep: "
        f"WO={deep.get('work_orders_deleted')} "
        f"TINT={deep.get('tint_orders_deleted')} "
        f"DISP={deep.get('dispatch_deleted')} "
        f"SALES={deep.get('sales_cancelled_open')} "
        f"DRAFTS={deep.get('sale_drafts_deleted')} "
        f"NOTIF={deep.get('notifications_deleted')}"
    )
    verify_api(s)

    after = deep.get("after") or {}
    remaining = (
        int(after.get("active_work_orders") or 0)
        + int(after.get("active_dispatch") or 0)
        + int(after.get("active_tint") or 0)
        + int(after.get("open_sales_pending_or_partial") or 0)
    )
    print("\n" + "=" * 64)
    print(f"RESUMEN remaining_active_total={remaining}")
    print(json.dumps(after, indent=2, ensure_ascii=False))
    print("=" * 64)

    out = "/app/backend/data/clear_all_ops_queues_report.json"
    try:
        with open(out, "w", encoding="utf-8") as f:
            json.dump(REPORT, f, indent=2, ensure_ascii=False)
        print(f"Reporte: {out}")
    except Exception:
        pass
    return 0 if remaining == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
