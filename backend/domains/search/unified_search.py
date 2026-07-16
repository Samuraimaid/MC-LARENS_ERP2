"""Unified document search — invoices, quotations, credits, roles, plates."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Mapping


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    try:
        if len(raw) == 10:
            return datetime.fromisoformat(f"{raw}T00:00:00+00:00")
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _regex_safe(term: str) -> str:
    return re.escape(term.strip())


async def _match_user_ids(db, term: str) -> set[str]:
    if not term or len(term) < 2:
        return set()
    pattern = _regex_safe(term)
    users = await db.users.find(
        {
            "$or": [
                {"name": {"$regex": pattern, "$options": "i"}},
                {"last_name": {"$regex": pattern, "$options": "i"}},
                {"email": {"$regex": pattern, "$options": "i"}},
            ]
        },
        {"_id": 0, "user_id": 1},
    ).to_list(50)
    return {str(u.get("user_id")) for u in users if u.get("user_id")}


async def _match_customer_ids(db, term: str) -> set[str]:
    if not term or len(term) < 2:
        return set()
    pattern = _regex_safe(term)
    customers = await db.customers.find(
        {
            "$or": [
                {"name": {"$regex": pattern, "$options": "i"}},
                {"phone": {"$regex": pattern, "$options": "i"}},
                {"tax_id": {"$regex": pattern, "$options": "i"}},
                {"customer_id": {"$regex": pattern, "$options": "i"}},
            ]
        },
        {"_id": 0, "customer_id": 1},
    ).to_list(100)
    ids = {str(c.get("customer_id")) for c in customers if c.get("customer_id")}

    vehicles = await db.vehicles.find(
        {"plate": {"$regex": pattern, "$options": "i"}},
        {"_id": 0, "customer_id": 1, "vehicle_id": 1},
    ).to_list(50)
    for v in vehicles:
        if v.get("customer_id"):
            ids.add(str(v["customer_id"]))
    return ids


def _in_date_range(created_at: Any, date_from: datetime | None, date_to: datetime | None) -> bool:
    if not date_from and not date_to:
        return True
    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except ValueError:
            return True
    if not isinstance(created_at, datetime):
        return True
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if date_from and created_at < date_from:
        return False
    if date_to:
        end = date_to.replace(hour=23, minute=59, second=59, microsecond=999999)
        if created_at > end:
            return False
    return True


def _result_row(
    *,
    doc_type: str,
    doc_id: str,
    title: str,
    subtitle: str,
    created_at: str,
    url: str,
    highlights: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "type": doc_type,
        "id": doc_id,
        "title": title,
        "subtitle": subtitle,
        "date": created_at,
        "url": url,
        "highlights": highlights or [],
    }


async def unified_search(
    db,
    *,
    user: Mapping[str, Any],
    sales_visibility_query: dict[str, Any],
    q: str = "",
    date_from: str | None = None,
    date_to: str | None = None,
    types: list[str] | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    term = str(q or "").strip()
    parsed_from = _parse_date(date_from)
    parsed_to = _parse_date(date_to)
    allowed_types = set(types or ["sale", "quotation", "credit"])
    results: list[dict[str, Any]] = []

    user_ids = await _match_user_ids(db, term) if term else set()
    customer_ids = await _match_customer_ids(db, term) if term else set()

    pattern = _regex_safe(term) if term else ""

    if "sale" in allowed_types or "credit" in allowed_types:
        sale_query: dict[str, Any] = dict(sales_visibility_query or {})
        or_filters: list[dict[str, Any]] = []
        if pattern:
            or_filters.extend([
                {"invoice_number": {"$regex": pattern, "$options": "i"}},
                {"customer_name": {"$regex": pattern, "$options": "i"}},
                {"sale_id": {"$regex": pattern, "$options": "i"}},
                {"quotation_id": {"$regex": pattern, "$options": "i"}},
            ])
        if customer_ids:
            or_filters.append({"customer_id": {"$in": list(customer_ids)}})
        if user_ids:
            or_filters.append({"salesperson_id": {"$in": list(user_ids)}})
        if or_filters:
            sale_query = {"$and": [sale_query, {"$or": or_filters}]} if sale_query else {"$or": or_filters}

        if "credit" in allowed_types and "sale" not in allowed_types:
            sale_query = {"$and": [sale_query, {"payment_type": "credit"}]} if sale_query else {"payment_type": "credit"}
        elif "credit" not in allowed_types and "sale" in allowed_types:
            extra = {"payment_type": {"$ne": "credit"}}
            sale_query = {"$and": [sale_query, extra]} if sale_query else extra

        sales = await db.sales.find(
            sale_query,
            {
                "_id": 0,
                "sale_id": 1,
                "invoice_number": 1,
                "customer_name": 1,
                "salesperson_name": 1,
                "payment_type": 1,
                "created_at": 1,
                "vehicle_id": 1,
                "quotation_id": 1,
            },
        ).sort("created_at", -1).to_list(limit * 2)

        vehicle_plates: dict[str, str] = {}
        vehicle_ids = [s.get("vehicle_id") for s in sales if s.get("vehicle_id")]
        if vehicle_ids:
            veh_docs = await db.vehicles.find(
                {"vehicle_id": {"$in": vehicle_ids}},
                {"_id": 0, "vehicle_id": 1, "plate": 1},
            ).to_list(len(vehicle_ids))
            vehicle_plates = {str(v["vehicle_id"]): str(v.get("plate") or "") for v in veh_docs}

        for sale in sales:
            if not _in_date_range(sale.get("created_at"), parsed_from, parsed_to):
                continue
            plate = vehicle_plates.get(str(sale.get("vehicle_id") or ""), "")
            doc_type = "credit" if str(sale.get("payment_type")) == "credit" else "sale"
            if doc_type not in allowed_types:
                continue
            subtitle_parts = [
                str(sale.get("salesperson_name") or ""),
                str(sale.get("customer_name") or ""),
            ]
            if plate:
                subtitle_parts.append(f"Placa {plate}")
            results.append(_result_row(
                doc_type=doc_type,
                doc_id=str(sale.get("sale_id") or ""),
                title=str(sale.get("invoice_number") or sale.get("sale_id") or ""),
                subtitle=" · ".join(p for p in subtitle_parts if p),
                created_at=str(sale.get("created_at") or ""),
                url=f"/sales/view/{sale.get('sale_id')}",
                highlights=[f"vendedor: {sale.get('salesperson_name')}"] if sale.get("salesperson_name") else [],
            ))

    if "quotation" in allowed_types:
        quot_query: dict[str, Any] = {}
        branch_id = user.get("branch_id")
        role = str(user.get("role") or "").strip().lower()
        if role not in ("gerencia",):
            if role in ("supervisor", "jefe_vendedores", "jefe_tienda") and branch_id:
                quot_query["branch_id"] = branch_id
            elif role in ("ventas", "cajero"):
                quot_query["salesperson_id"] = user.get("user_id")

        or_filters = []
        if pattern:
            or_filters.extend([
                {"quotation_id": {"$regex": pattern, "$options": "i"}},
                {"customer_name": {"$regex": pattern, "$options": "i"}},
            ])
        if customer_ids:
            or_filters.append({"customer_id": {"$in": list(customer_ids)}})
        if user_ids:
            or_filters.append({"salesperson_id": {"$in": list(user_ids)}})
        if or_filters:
            quot_query = {"$and": [quot_query, {"$or": or_filters}]} if quot_query else {"$or": or_filters}

        quotations = await db.quotations.find(
            quot_query,
            {
                "_id": 0,
                "quotation_id": 1,
                "customer_name": 1,
                "salesperson_name": 1,
                "status": 1,
                "created_at": 1,
                "total": 1,
            },
        ).sort("created_at", -1).to_list(limit * 2)

        for quot in quotations:
            if not _in_date_range(quot.get("created_at"), parsed_from, parsed_to):
                continue
            results.append(_result_row(
                doc_type="quotation",
                doc_id=str(quot.get("quotation_id") or ""),
                title=str(quot.get("quotation_id") or ""),
                subtitle=f"{quot.get('salesperson_name') or ''} · {quot.get('customer_name') or ''} · {quot.get('status') or ''}".strip(" ·"),
                created_at=str(quot.get("created_at") or ""),
                url=f"/quotations/view/{quot.get('quotation_id')}",
            ))

    results.sort(key=lambda r: str(r.get("date") or ""), reverse=True)
    trimmed = results[: max(1, min(limit, 100))]

    return {
        "query": term,
        "from": date_from,
        "to": date_to,
        "total": len(trimmed),
        "results": trimmed,
    }