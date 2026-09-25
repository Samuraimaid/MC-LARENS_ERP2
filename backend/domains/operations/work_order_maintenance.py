import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger("erp.operations.maintenance")


def generate_work_order_id() -> str:
    """Generates a canonical work_order_id prefixed with 'wo_'."""
    return f"wo_{uuid.uuid4().hex[:8]}"


def ensure_valid_work_order_id(doc: Dict[str, Any]) -> str:
    """Ensures doc has a valid non-null work_order_id, generating one if missing."""
    wo_id = doc.get("work_order_id")
    if not wo_id or not str(wo_id).strip():
        wo_id = generate_work_order_id()
        doc["work_order_id"] = wo_id
    return str(wo_id)


async def cancel_null_id_work_orders(db_conn: Any) -> int:
    """
    One-shot maintenance: Safely cancels any orphan work orders in MongoDB
    that have a null, empty, or missing work_order_id so they do not pollute KDS.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    filter_query = {
        "$or": [
            {"work_order_id": None},
            {"work_order_id": ""},
            {"work_order_id": {"$exists": False}},
        ],
        "status": {"$ne": "cancelled"},
    }
    update_op = {
        "$set": {
            "status": "cancelled",
            "cancellation_reason": "auto_cancelled_null_work_order_id",
            "notes": "Cancelada automáticamente por higiene: work_order_id nulo/inválido [AUDIT_SMOKE]",
            "updated_at": now_iso,
        }
    }
    try:
        result = await db_conn.work_orders.update_many(filter_query, update_op)
        cancelled_count = getattr(result, "modified_count", 0)
        if cancelled_count > 0:
            logger.info("AUDIT_SMOKE: Cancelled %d orphan work orders with null work_order_id", cancelled_count)
        return int(cancelled_count)
    except Exception as e:
        logger.error("Error executing cancel_null_id_work_orders: %s", e)
        return 0
