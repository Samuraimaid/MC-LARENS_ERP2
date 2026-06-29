"""Split multi-item work orders into one order per installable product."""
from __future__ import annotations

import copy
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List


def _normalize_items(wo_doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    items = wo_doc.get("items") or wo_doc.get("accessories") or []
    return [item for item in items if isinstance(item, dict)]


def _single_item_estimated_time(item: Dict[str, Any]) -> int:
    return max(1, int(item.get("installation_time_minutes") or 60))


def _can_split_work_order(wo_doc: Dict[str, Any]) -> bool:
    if str(wo_doc.get("department") or "").lower() == "polarizados":
        return False
    if str(wo_doc.get("assignment_status") or "") != "pending_assignment":
        return False
    if str(wo_doc.get("status") or "") not in {"pending", "in_progress"}:
        return False
    if wo_doc.get("technician_id"):
        return False
    return len(_normalize_items(wo_doc)) > 1


async def ensure_single_item_work_orders(
    db: Any,
    wo_doc: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Ensure pending unassigned work orders contain at most one install item."""
    items = _normalize_items(wo_doc)
    if not _can_split_work_order(wo_doc):
        return [wo_doc]

    work_order_id = str(wo_doc.get("work_order_id") or "")
    if not work_order_id:
        return [wo_doc]

    split_total = len(items)
    result: List[Dict[str, Any]] = []

    first_item = items[0]
    first_update = {
        "items": [first_item],
        "accessories": [first_item],
        "estimated_time": _single_item_estimated_time(first_item),
        "item_index": 0,
        "split_total": split_total,
        "split_parent": None,
    }
    await db.work_orders.update_one(
        {"work_order_id": work_order_id},
        {"$set": first_update},
    )
    result.append({**wo_doc, **first_update})

    for idx, item in enumerate(items[1:], start=1):
        existing = await db.work_orders.find_one(
            {
                "split_parent": work_order_id,
                "item_index": idx,
            },
            {"_id": 0},
        )
        if existing:
            result.append(existing)
            continue

        new_id = f"wo_{uuid.uuid4().hex[:8]}"
        new_doc = copy.deepcopy(wo_doc)
        new_doc.pop("_id", None)
        new_doc.update(
            {
                "work_order_id": new_id,
                "items": [item],
                "accessories": [item],
                "estimated_time": _single_item_estimated_time(item),
                "item_index": idx,
                "split_total": split_total,
                "split_parent": work_order_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "notes": (
                    f"{wo_doc.get('notes') or 'Orden de trabajo'} "
                    f"(producto {idx + 1}/{split_total})"
                ).strip(),
            }
        )
        await db.work_orders.insert_one(new_doc)
        result.append(new_doc)

    return result