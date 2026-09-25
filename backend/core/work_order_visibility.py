"""
Work order and KDS visibility query builders.
Ensures floor technicians can see unassigned work orders in their operational department
while restricting cross-technician and cross-department pollution.
"""
from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional


def merge_queries(base: Dict[str, Any], extra: Dict[str, Any]) -> Dict[str, Any]:
    if not base:
        return extra or {}
    if not extra:
        return base or {}
    return {"$and": [base, extra]}


async def build_work_order_visibility_query(
    user: Any,
    get_visible_sale_ids_func: Optional[Callable] = None,
    resolve_role_func: Optional[Callable] = None,
) -> Dict[str, Any]:
    role = getattr(user, "role", "") or ""
    effective_role = resolve_role_func(role) if resolve_role_func else role
    user_id = getattr(user, "user_id", "")
    branch_id = getattr(user, "branch_id", None)

    if effective_role == "gerencia":
        return {}

    if effective_role == "supervisor":
        if branch_id and branch_id not in ("Todas / Central", "all"):
            return {"branch_id": branch_id}
        elif branch_id:
            return {}
        return {"branch_id": "__no_branch__"}

    if effective_role in {"ventas", "cajero"}:
        visible_sale_ids = []
        if get_visible_sale_ids_func:
            visible_sale_ids = await get_visible_sale_ids_func(user)
        seller_filters: List[Dict[str, Any]] = [{"created_by": user_id}]
        if visible_sale_ids:
            seller_filters.append({"sale_id": {"$in": visible_sale_ids}})
        if len(seller_filters) == 1:
            return seller_filters[0]
        return {"$or": seller_filters}

    if effective_role in {
        "instalaciones",
        "electrico",
        "polarizador",
        "coordinador_instalaciones",
        "coordinador_polarizados",
    }:
        query: Dict[str, Any] = {}
        if branch_id and branch_id not in ("Todas / Central", "all"):
            query["branch_id"] = branch_id

        unassigned_or_self = [
            {"technician_id": user_id},
            {"technician_id": None},
            {"technician_id": ""},
            {"technician_id": "unassigned"},
            {"technician_id": {"$exists": False}},
        ]

        if effective_role == "electrico":
            query["department"] = "electrico"
            query["$or"] = unassigned_or_self
        elif effective_role == "instalaciones":
            query["$and"] = [
                {"$or": [{"department": "instalaciones"}, {"department": {"$exists": False}}]},
                {"$or": unassigned_or_self},
            ]
        elif effective_role == "coordinador_instalaciones":
            query["$or"] = [
                {"department": "instalaciones"},
                {"department": "electrico"},
                {"department": {"$exists": False}},
            ]
        elif effective_role in {"polarizador", "coordinador_polarizados"}:
            query["department"] = {"$in": ["polarizados", "polarizado"]}
            if effective_role == "polarizador":
                query["$or"] = unassigned_or_self
        return query

    if branch_id and branch_id not in ("Todas / Central", "all"):
        return {"branch_id": branch_id}
    elif branch_id:
        return {}
    return {"branch_id": "__no_branch__"}
