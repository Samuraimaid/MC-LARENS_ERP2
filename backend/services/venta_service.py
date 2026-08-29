from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from backend.db.session import get_collection

_ACTIVE_SALE_FILTER = {
    "$or": [
        {"invoice_state": {"$exists": False}},
        {"invoice_state": {"$ne": "cancelled"}},
    ],
}


def update_venta_status(sale_id: str, status: str) -> None:
    """Actualiza el estado de workflow de la venta en la base de datos."""
    get_collection("sales").update_one(
        {"sale_id": sale_id},
        {
            "$set": {
                "workflow_state": status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )


def generate_token_autorizacion(sale_id: str) -> str:
    import uuid
    return str(uuid.uuid4())


def _inventory_adjustments_for_sale(sale: Dict[str, Any]) -> List[Dict[str, Any]]:
    stored = sale.get("inventory_adjustments")
    if isinstance(stored, list) and stored:
        return stored
    return [
        {
            "product_id": item.get("product_id"),
            "warehouse_id": item.get("warehouse_id"),
            "quantity": item.get("quantity") or 0,
        }
        for item in sale.get("items", [])
        if item.get("product_id") and item.get("warehouse_id")
    ]


async def _find_previous_customer_sale(
    db: Any,
    customer_id: str,
    excluded_sale_id: str,
    *,
    salesperson_id: Optional[str] = None,
    branch_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    query: Dict[str, Any] = {
        "customer_id": customer_id,
        "sale_id": {"$ne": excluded_sale_id},
        **_ACTIVE_SALE_FILTER,
    }
    if salesperson_id:
        query["salesperson_id"] = salesperson_id
    if branch_id:
        query["branch_id"] = branch_id
    return await db.sales.find_one(query, {"_id": 0}, sort=[("created_at", -1)])


async def _resolve_branch_name(db: Any, branch_id: Optional[str]) -> Optional[str]:
    if not branch_id:
        return None
    branch = await db.branches.find_one({"branch_id": branch_id}, {"_id": 0, "name": 1})
    if branch:
        return str(branch.get("name") or branch_id)
    return str(branch_id)


async def _revert_customer_history(db: Any, sale: Dict[str, Any], sale_id: str) -> None:
    customer_id = sale.get("customer_id")
    if not customer_id:
        return

    branch_id = sale.get("branch_id")
    salesperson_id = sale.get("salesperson_id")
    created_at = sale.get("created_at")

    await db.customers.update_one(
        {"customer_id": customer_id},
        {"$inc": {"total_sales_count": -1}},
    )

    customer_doc = await db.customers.find_one(
        {"customer_id": customer_id},
        {"_id": 0, "salesperson_history": 1, "branch_visit_history": 1},
    )
    history_entry = None
    visit_entry = None
    if customer_doc:
        for entry in customer_doc.get("salesperson_history") or []:
            if (
                entry.get("user_id") == salesperson_id
                and entry.get("branch_id") == branch_id
            ):
                history_entry = entry
                break
        for entry in customer_doc.get("branch_visit_history") or []:
            if entry.get("branch_id") == branch_id:
                visit_entry = entry
                break

    salesperson_update: Dict[str, Any] = {"$inc": {"salesperson_history.$.sales_count": -1}}
    if history_entry and history_entry.get("last_sale_id") == sale_id:
        previous_sale = await _find_previous_customer_sale(
            db,
            customer_id,
            sale_id,
            salesperson_id=salesperson_id,
            branch_id=branch_id,
        )
        if previous_sale:
            salesperson_update["$set"] = {
                "salesperson_history.$.last_sale_at": previous_sale.get("created_at"),
                "salesperson_history.$.last_sale_id": previous_sale.get("sale_id"),
            }
        else:
            salesperson_update["$set"] = {
                "salesperson_history.$.last_sale_at": None,
                "salesperson_history.$.last_sale_id": None,
            }

    if salesperson_id and branch_id:
        await db.customers.update_one(
            {
                "customer_id": customer_id,
                "salesperson_history.user_id": salesperson_id,
                "salesperson_history.branch_id": branch_id,
            },
            salesperson_update,
        )

    branch_name = await _resolve_branch_name(db, branch_id)
    if branch_id:
        branch_visit_update: Dict[str, Any] = {
            "$inc": {"branch_visit_history.$.visit_count": -1},
        }
        visit_matches_cancelled_sale = (
            visit_entry is not None
            and visit_entry.get("last_visit_at") == created_at
        )
        branch_set: Dict[str, Any] = {}
        if visit_matches_cancelled_sale:
            previous_branch_sale = await _find_previous_customer_sale(
                db,
                customer_id,
                sale_id,
                branch_id=branch_id,
            )
            if previous_branch_sale:
                branch_set["branch_visit_history.$.last_visit_at"] = previous_branch_sale.get(
                    "created_at"
                )
            else:
                branch_set["branch_visit_history.$.last_visit_at"] = None
        if branch_name:
            branch_set["branch_visit_history.$.branch_name"] = branch_name
        if branch_set:
            branch_visit_update["$set"] = branch_set

        await db.customers.update_one(
            {
                "customer_id": customer_id,
                "branch_visit_history.branch_id": branch_id,
            },
            branch_visit_update,
        )
        await db.customers.update_one(
            {"customer_id": customer_id},
            {"$pull": {"branch_visit_history": {"branch_id": branch_id, "visit_count": {"$lte": 0}}}},
        )

    previous_sale = await _find_previous_customer_sale(db, customer_id, sale_id)
    if previous_sale:
        previous_branch_name = await _resolve_branch_name(db, previous_sale.get("branch_id"))
        await db.customers.update_one(
            {"customer_id": customer_id},
            {
                "$set": {
                    "last_sale_at": previous_sale.get("created_at"),
                    "last_sale_branch_id": previous_sale.get("branch_id"),
                    "last_sale_branch_name": previous_branch_name,
                }
            },
        )
    else:
        await db.customers.update_one(
            {"customer_id": customer_id},
            {
                "$unset": {
                    "last_sale_at": "",
                    "last_sale_branch_id": "",
                    "last_sale_branch_name": "",
                }
            },
        )


async def _revert_samples(db: Any, sale_id: str) -> None:
    sample_docs = await db.sample_requests.find({"sale_id": sale_id}, {"_id": 0}).to_list(100)
    for sample in sample_docs:
        sample_id = sample.get("sample_id")
        if not sample_id:
            continue
        restored_status = sample.get("status_before_consumption") or "delivered"
        await db.sample_requests.update_one(
            {"sample_id": sample_id},
            {
                "$set": {"status": restored_status},
                "$unset": {"sale_id": "", "status_before_consumption": ""},
            },
        )


async def _revert_quotation(db: Any, sale: Dict[str, Any]) -> None:
    quotation_id = sale.get("quotation_id")
    if not quotation_id:
        return
    await db.quotations.update_one(
        {"quotation_id": quotation_id, "status": "converted"},
        {"$set": {"status": "approved"}},
    )


async def _revert_manager_authorization(db: Any, sale_id: str) -> None:
    await db.manager_authorizations.update_one(
        {"sale_id": sale_id, "used": True},
        {"$set": {"used": False, "used_at": None}, "$unset": {"sale_id": ""}},
    )


async def revert_sale_effects(db: Any, sale_id: str, approver) -> Dict[str, Any]:
    """
    Revierte los efectos secundarios de una venta cancelada.
    """
    sale = await db.sales.find_one({"sale_id": sale_id}, {"_id": 0})
    if not sale:
        raise ValueError(f"Venta {sale_id} no encontrada")

    now_iso = datetime.now(timezone.utc).isoformat()
    actor_id = getattr(approver, "user_id", None)
    technician_id: Optional[str] = None

    for inv_item in _inventory_adjustments_for_sale(sale):
        qty = int(inv_item.get("quantity") or 0)
        product_id = inv_item.get("product_id")
        warehouse_id = inv_item.get("warehouse_id")
        if qty <= 0 or not product_id or not warehouse_id:
            continue
        await db.inventory.update_one(
            {"product_id": product_id, "warehouse_id": warehouse_id},
            {
                "$inc": {"quantity": qty},
                "$set": {"last_updated": now_iso},
            },
        )
        branch_id = str(sale.get("branch_id") or "").strip()
        branch_name = str(sale.get("branch_name") or branch_id or "").strip()
        await db.inventory_movements.insert_one({
            "product_id": product_id,
            "warehouse_id": warehouse_id,
            "quantity_change": qty,
            "reason": "sale_cancelled",
            "reference_id": sale_id,
            "created_at": now_iso,
            "actor_id": actor_id,
            "branch_id": branch_id or None,
            "branch_name": branch_name or branch_id or None,
        })

    if sale.get("payment_type") == "credit":
        raw_total = sale.get("total") or 0.0
        total = float(raw_total)
        if total > 0:
            await db.customers.update_one(
                {"customer_id": sale.get("customer_id")},
                {"$inc": {"credit_balance": -total}},
            )

    await _revert_customer_history(db, sale, sale_id)
    await _revert_samples(db, sale_id)
    await _revert_quotation(db, sale)
    await _revert_manager_authorization(db, sale_id)

    work_order_id = sale.get("work_order_id")
    if work_order_id:
        work_order = await db.work_orders.find_one(
            {"work_order_id": work_order_id},
            {"_id": 0, "technician_id": 1},
        )
        if work_order:
            technician_id = work_order.get("technician_id")
        await db.work_orders.update_one(
            {"work_order_id": work_order_id},
            {"$set": {"status": "cancelled", "cancelled_at": now_iso}},
        )

    # Protección de órdenes de polarizados y control de merma
    tint_order = await db.tint_orders.find_one({"sale_id": sale_id}, {"_id": 0})
    if tint_order:
        tint_status = str(tint_order.get("status") or "").lower()
        if tint_status in {"cut", "in_progress", "completed", "cortado", "instalado"}:
            # El material ya fue cercenado físicamente; registrar merma irrecuperable
            await db.tint_orders.update_one(
                {"sale_id": sale_id},
                {
                    "$set": {
                        "status": "cancelled_with_scrap",
                        "cancelled_at": now_iso,
                        "scrap_loss_recorded": True,
                        "scrap_reason": "Venta cancelada post-corte de bobina",
                    }
                },
            )
            await db.scrap_inventory.insert_one({
                "scrap_id": f"scrap_{sale_id}",
                "sale_id": sale_id,
                "invoice_number": sale.get("invoice_number"),
                "total_meters": tint_order.get("total_meters"),
                "cuts": tint_order.get("cuts") or [],
                "created_at": now_iso,
                "status": "available_for_small_cuts",
            })
        else:
            await db.tint_orders.update_one(
                {"sale_id": sale_id},
                {"$set": {"status": "cancelled", "cancelled_at": now_iso}},
            )

    dispatch_id = sale.get("dispatch_id")
    if dispatch_id:
        await db.dispatch_orders.update_one(
            {"dispatch_id": dispatch_id},
            {"$set": {"status": "cancelled", "cancelled_at": now_iso}},
        )

    raw_total = sale.get("total") or 0.0
    total_decimal = Decimal(str(raw_total))
    cancel_branch_id = str(sale.get("branch_id") or "").strip()
    cancel_branch_name = str(sale.get("branch_name") or cancel_branch_id or "").strip()
    await db.audit_logs.insert_one({
        "action": "sale_cancelled",
        "entity": "sale",
        "entity_id": sale_id,
        "actor_id": actor_id,
        "actor_name": getattr(approver, "name", None),
        "branch_id": cancel_branch_id or None,
        "branch_name": cancel_branch_name or cancel_branch_id or None,
        "timestamp": now_iso,
        "metadata": {
            "total": str(total_decimal),
            "customer_id": sale.get("customer_id"),
            "invoice_number": sale.get("invoice_number"),
            "quotation_id": sale.get("quotation_id"),
            "work_order_id": work_order_id,
            "dispatch_id": dispatch_id,
            "tint_order_cancelled": bool(tint_order),
        },
    })

    return {
        "status": "reverted",
        "sale_id": sale_id,
        "technician_id": technician_id,
        "invoice_number": sale.get("invoice_number"),
        "work_order_id": work_order_id,
        "tint_scrap_recorded": bool(tint_order and str(tint_order.get("status") or "").lower() in {"cut", "in_progress", "completed", "cortado", "instalado"}),
    }