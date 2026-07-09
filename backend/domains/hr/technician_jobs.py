"""Completed technician jobs for payroll commission calculations."""
from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Any, Dict, List, Optional


def _job_completed_timestamp(doc: Dict[str, Any], job_type: str) -> Optional[str]:
    if job_type == "work_order":
        for key in ("qc_approved_at", "end_time", "updated_at", "created_at"):
            value = doc.get(key)
            if value:
                return str(value)
        return None
    for key in ("completed_at", "updated_at", "created_at"):
        value = doc.get(key)
        if value:
            return str(value)
    return None


def _technician_includes_work_orders(role: str) -> bool:
    normalized = str(role or "").strip().lower()
    return normalized in {"instalaciones", "instalador", "electrico", "tecnico", "gerencia", "supervisor"}


def _technician_includes_tint_orders(role: str) -> bool:
    normalized = str(role or "").strip().lower()
    return normalized in {"polarizador", "gerencia", "supervisor", "coordinador_polarizados"}


def _serialize_completed_work_order(wo: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "job_type": "work_order",
        "job_id": wo.get("work_order_id"),
        "sale_id": wo.get("sale_id"),
        "department": str(wo.get("department") or "instalaciones").lower(),
        "completed_at": _job_completed_timestamp(wo, "work_order"),
        "branch_id": wo.get("branch_id"),
    }


def _serialize_completed_tint_order(order: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "job_type": "tint_order",
        "job_id": order.get("tint_order_id"),
        "sale_id": order.get("sale_id"),
        "department": "polarizados",
        "completed_at": _job_completed_timestamp(order, "tint_order"),
        "branch_id": order.get("branch_id"),
    }


async def collect_technician_completed_jobs(
    db: Any,
    *,
    user_id: str,
    user_role: str,
    branch_id: Optional[str] = None,
    period_start: date,
    period_end: date,
) -> List[Dict[str, Any]]:
    """Mirror of server._collect_technician_completed_jobs for payroll (no auth actor)."""
    target_role = str(user_role or "").strip().lower()
    target_id = str(user_id or "").strip()
    jobs: List[Dict[str, Any]] = []

    date_from = period_start.isoformat()
    date_to = f"{period_end.isoformat()}T23:59:59"

    if _technician_includes_work_orders(target_role):
        legacy_qc_rows = await db.quality_controls.find(
            {"technician_id": target_id, "approved": True},
            {"_id": 0, "work_order_id": 1},
        ).to_list(5000)
        legacy_approved_ids = [
            str(row.get("work_order_id"))
            for row in legacy_qc_rows
            if row.get("work_order_id")
        ]

        qc_filters: List[Dict[str, Any]] = [{"qc_approved": True}]
        if legacy_approved_ids:
            qc_filters.append({"work_order_id": {"$in": legacy_approved_ids}})

        wo_query: Dict[str, Any] = {
            "technician_id": target_id,
            "status": {"$in": ["completed", "delivered"]},
            "$or": qc_filters,
        }
        if target_role == "electrico":
            wo_query["department"] = "electrico"
        elif target_role in {"instalaciones", "instalador"}:
            wo_query["$or"] = [
                {"department": "instalaciones"},
                {"department": {"$exists": False}},
            ]
        if branch_id:
            wo_query["branch_id"] = branch_id
        wo_query["end_time"] = {"$gte": date_from, "$lte": date_to}

        work_orders = await db.work_orders.find(wo_query, {"_id": 0}).sort("end_time", -1).to_list(2000)
        for wo in work_orders:
            jobs.append(_serialize_completed_work_order(wo))

    if _technician_includes_tint_orders(target_role):
        tint_query: Dict[str, Any] = {
            "assigned_technician_id": target_id,
            "status": "completed",
            "completed_at": {"$gte": date_from, "$lte": date_to},
        }
        if branch_id:
            tint_query["branch_id"] = branch_id
        tint_orders = await db.tint_orders.find(tint_query, {"_id": 0}).sort("completed_at", -1).to_list(2000)
        for order in tint_orders:
            jobs.append(_serialize_completed_tint_order(order))

    jobs.sort(key=lambda row: str(row.get("completed_at") or ""), reverse=True)
    return jobs