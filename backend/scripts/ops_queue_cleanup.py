#!/usr/bin/env python3
"""Shared operational queue cleanup used by QA suites and manual scripts."""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import requests
from motor.motor_asyncio import AsyncIOMotorClient

DEFAULT_API = os.environ.get("ERP_API_BASE") or "http://127.0.0.1:8001/api"
DEFAULT_PIN = os.environ.get("ERP_GERENCIA_PIN") or "01011990"
DEFAULT_BRANCH = os.environ.get("ERP_BRANCH_ID") or "branch_main"
DEFAULT_WAREHOUSE = os.environ.get("ERP_WAREHOUSE_ID") or "wh_main"


def _log(report: Dict[str, Any], msg: str) -> None:
    print(f"CLEANUP: {msg}")
    report.setdefault("messages", []).append(msg)


def login_gerencia(
    api: str = DEFAULT_API,
    pin: str = DEFAULT_PIN,
    session: Optional[requests.Session] = None,
) -> requests.Session:
    s = session or requests.Session()
    r = s.post(f"{api}/auth/pin/login", json={"pin": pin}, timeout=30)
    r.raise_for_status()
    return s


def api_clear_queues(
    session: requests.Session,
    *,
    api: str = DEFAULT_API,
    branch_id: str = DEFAULT_BRANCH,
    warehouse_id: str = DEFAULT_WAREHOUSE,
    report: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    report = report if report is not None else {}
    detail: Dict[str, Any] = {}

    for tab in ("abiertas", "cotizacion", "credito"):
        r = session.post(
            f"{api}/caja/facturas/clear-queue",
            json={"branch_id": branch_id, "tab": tab},
            timeout=120,
        )
        if r.status_code == 200:
            body = r.json() or {}
            detail[f"caja_{tab}"] = body
            _log(report, f"Caja {tab}: removed={body.get('removed')} skipped={body.get('skipped')}")
        else:
            _log(report, f"Caja {tab} WARN {r.status_code}: {r.text[:160]}")

    r = session.post(
        f"{api}/dispatch/clear-queue",
        json={"branch_id": branch_id, "warehouse_id": warehouse_id},
        timeout=120,
    )
    if r.status_code == 200:
        body = r.json() or {}
        detail["dispatch"] = body
        _log(report, f"Despacho: removed={body.get('removed')}")
    else:
        _log(report, f"Despacho WARN {r.status_code}: {r.text[:160]}")

    for dept in ("instalaciones", "electrico", "polarizados"):
        r = session.post(
            f"{api}/coordinator/clear-queue",
            json={"department": dept, "branch_id": branch_id, "profile": dept},
            timeout=120,
        )
        if r.status_code == 200:
            body = r.json() or {}
            detail[f"coord_{dept}"] = body
            _log(report, f"Coord {dept}: removed={body.get('removed')}")
        else:
            _log(report, f"Coord {dept} WARN {r.status_code}: {r.text[:160]}")

    report["api"] = detail
    return detail


async def mongo_deep_clear_async() -> Dict[str, Any]:
    uri = os.environ.get("MONGO_URL") or os.environ.get("MONGODB_LOCAL_URI") or "mongodb://mongodb:27017"
    dbn = os.environ.get("DB_NAME") or "mc-larens2_mundo_accesorios_erp"
    db = AsyncIOMotorClient(uri)[dbn]
    out: Dict[str, Any] = {}

    wo_res = await db.work_orders.delete_many(
        {
            "status": {
                "$in": ["pending", "pending_assignment", "in_progress", "quality_check"]
            }
        }
    )
    out["work_orders_deleted"] = int(wo_res.deleted_count or 0)

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

    disp_res = await db.dispatch_orders.delete_many(
        {"status": {"$in": ["pending", "in_progress", "partial"]}}
    )
    out["dispatch_deleted"] = int(disp_res.deleted_count or 0)

    now = datetime.now(timezone.utc).isoformat()
    open_sales = await db.sales.find(
        {
            "invoice_state": {"$ne": "cancelled"},
            "payment_status": {"$in": ["pending", "partial"]},
        },
        {"_id": 0, "sale_id": 1},
    ).to_list(1000)
    cancelled = 0
    for sale in open_sales:
        sid = sale.get("sale_id")
        if not sid:
            continue
        r = await db.sales.update_one(
            {"sale_id": sid},
            {
                "$set": {
                    "invoice_state": "cancelled",
                    "cancel_reason": "Limpieza automática post-suite QA",
                    "cancel_justification_internal": "ops_queue_cleanup",
                    "cancelled_at": now,
                    "cancelled_by_name": "qa_suite_cleanup",
                    "updated_at": now,
                }
            },
        )
        cancelled += int(r.modified_count or 0)
    out["sales_cancelled_open"] = cancelled

    draft_res = await db.sale_drafts.delete_many(
        {
            "$or": [
                {"draft_id": {"$regex": r"^(e2e_|mr_)", "$options": "i"}},
                {"id": {"$regex": r"^(e2e_|mr_)", "$options": "i"}},
                {"name": {"$regex": r"(E2E|MultiRole|Multi-role|multi-role)", "$options": "i"}},
            ]
        }
    )
    out["sale_drafts_deleted"] = int(draft_res.deleted_count or 0)

    req_res = await db.sale_requests.delete_many({"status": "pending"})
    out["sale_requests_pending_deleted"] = int(req_res.deleted_count or 0)

    notif_res = await db.notifications.delete_many(
        {
            "read": {"$ne": True},
            "$or": [
                {
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
                    }
                },
                {"message": {"$regex": r"(orden|despacho|calidad|polarizado|instalaci)", "$options": "i"}},
            ],
        }
    )
    out["notifications_deleted"] = int(notif_res.deleted_count or 0)

    out["after"] = {
        "active_work_orders": await db.work_orders.count_documents(
            {"status": {"$in": ["pending", "pending_assignment", "in_progress", "quality_check"]}}
        ),
        "active_dispatch": await db.dispatch_orders.count_documents(
            {"status": {"$in": ["pending", "in_progress", "partial"]}}
        ),
        "active_tint": await db.tint_orders.count_documents(
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
        ),
        "open_sales_pending_or_partial": await db.sales.count_documents(
            {
                "invoice_state": {"$ne": "cancelled"},
                "payment_status": {"$in": ["pending", "partial"]},
            }
        ),
    }
    return out


def mongo_deep_clear() -> Dict[str, Any]:
    return asyncio.run(mongo_deep_clear_async())


def run_full_queue_cleanup(
    *,
    session: Optional[requests.Session] = None,
    api: str = DEFAULT_API,
    pin: str = DEFAULT_PIN,
    branch_id: str = DEFAULT_BRANCH,
    warehouse_id: str = DEFAULT_WAREHOUSE,
    deep: bool = True,
) -> Dict[str, Any]:
    """
    Clear ops queues via API (+ optional Mongo deep purge for stuck items).
    Safe to call at the end of every live QA suite.
    """
    report: Dict[str, Any] = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "messages": [],
        "ok": True,
    }
    try:
        s = session or login_gerencia(api=api, pin=pin)
        # If a foreign session was passed without auth, re-login
        probe = s.get(f"{api}/", timeout=15)
        if probe.status_code in (401, 403):
            s = login_gerencia(api=api, pin=pin, session=s)

        api_clear_queues(
            s,
            api=api,
            branch_id=branch_id,
            warehouse_id=warehouse_id,
            report=report,
        )
        if deep:
            deep_result = mongo_deep_clear()
            report["mongo"] = deep_result
            after = deep_result.get("after") or {}
            remaining = (
                int(after.get("active_work_orders") or 0)
                + int(after.get("active_dispatch") or 0)
                + int(after.get("active_tint") or 0)
                + int(after.get("open_sales_pending_or_partial") or 0)
            )
            report["remaining_active_total"] = remaining
            report["ok"] = remaining == 0
            _log(
                report,
                (
                    f"Deep purge WO={deep_result.get('work_orders_deleted')} "
                    f"TINT={deep_result.get('tint_orders_deleted')} "
                    f"DISP={deep_result.get('dispatch_deleted')} "
                    f"SALES={deep_result.get('sales_cancelled_open')} "
                    f"remaining={remaining}"
                ),
            )
    except Exception as exc:
        report["ok"] = False
        report["error"] = str(exc)
        _log(report, f"ERROR {exc}")

    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    return report
