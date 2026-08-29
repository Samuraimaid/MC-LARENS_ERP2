"""Warranty lookup and inventory side-effects for invoice-based claims."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

CLAIM_TYPES_AFFECTING_INVENTORY = {"replacement", "devolucion", "cambio"}


def _parse_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value.strip():
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def build_warranty_item_row(
    *,
    sale: Dict[str, Any],
    item: Dict[str, Any],
    product: Optional[Dict[str, Any]],
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    now_dt = now or datetime.now(timezone.utc)
    purchase_date = _parse_datetime(sale.get("created_at"))
    warranty_months = int((product or {}).get("warranty_months") or 0)
    warranty_end = purchase_date + timedelta(days=max(warranty_months, 0) * 30)
    is_active = warranty_months > 0 and warranty_end > now_dt
    install_note = ""
    if item.get("with_installation"):
        install_note = "Instalado"
    elif str(item.get("installation_type") or "") == "required":
        install_note = "Instalación obligatoria"

    serial_num = str(item.get("serial_number") or item.get("serial") or "").strip()
    lot_num = str(item.get("lot_number") or item.get("lote") or "").strip()

    return {
        "sale_id": sale.get("sale_id"),
        "invoice_number": sale.get("invoice_number"),
        "product_id": item.get("product_id"),
        "product_name": item.get("product_name") or (product or {}).get("name") or "Producto",
        "serial_number": serial_num or None,
        "lot_number": lot_num or None,
        "quantity": int(item.get("quantity") or 1),
        "unit_price": float(item.get("unit_price") or 0),
        "with_installation": bool(item.get("with_installation")),
        "installation_note": install_note,
        "warehouse_id": item.get("warehouse_id"),
        "purchase_date": purchase_date.isoformat(),
        "warranty_months": warranty_months,
        "warranty_end_date": warranty_end.isoformat(),
        "is_warranty_active": is_active,
        "days_remaining": max(0, (warranty_end - now_dt).days) if is_active else 0,
        "eligible_for_claim": is_active,
    }


async def build_invoice_warranty_lookup(
    db: Any,
    *,
    sale: Dict[str, Any],
    customer: Optional[Dict[str, Any]] = None,
    vehicle: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if not sale:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    if not customer and sale.get("customer_id"):
        customer = await db.customers.find_one({"customer_id": sale["customer_id"]}, {"_id": 0})
    if not vehicle and sale.get("vehicle_id"):
        vehicle = await db.vehicles.find_one({"vehicle_id": sale["vehicle_id"]}, {"_id": 0})

    now_dt = datetime.now(timezone.utc)
    items_out: List[Dict[str, Any]] = []
    for item in sale.get("items") or []:
        if not isinstance(item, dict):
            continue
        product = await db.products.find_one({"product_id": item.get("product_id")}, {"_id": 0})
        items_out.append(
            build_warranty_item_row(
                sale=sale,
                item=item,
                product=product,
                now=now_dt,
            )
        )

    active_items = [row for row in items_out if row.get("eligible_for_claim")]
    return {
        "sale_id": sale.get("sale_id"),
        "invoice_number": sale.get("invoice_number"),
        "created_at": sale.get("created_at"),
        "payment_status": sale.get("payment_status"),
        "customer": customer,
        "vehicle": vehicle,
        "items": items_out,
        "eligible_items": active_items,
        "eligible_count": len(active_items),
    }


async def apply_warranty_inventory_effects(
    db: Any,
    audit_service: Any,
    *,
    claim_type: str,
    product_id: str,
    warehouse_id: str,
    quantity: int,
    claim_id: str,
    actor: Any,
    branch_id: str = "",
) -> Dict[str, Any]:
    """Reingresa defectuoso como merma y descuenta unidad de reemplazo si aplica."""
    normalized_type = str(claim_type or "").strip().lower()
    qty = max(1, int(quantity or 1))
    if normalized_type not in CLAIM_TYPES_AFFECTING_INVENTORY:
        return {"applied": False, "reason": "claim_type_no_inventory"}

    inv = await db.inventory.find_one(
        {"product_id": product_id, "warehouse_id": warehouse_id},
        {"_id": 0},
    )
    if not inv:
        raise HTTPException(
            status_code=400,
            detail="No hay inventario en la bodega indicada para aplicar el reclamo",
        )

    available = int(inv.get("quantity") or 0)
    if available < qty:
        raise HTTPException(
            status_code=400,
            detail=f"Inventario insuficiente para reemplazo ({available} disponible, {qty} requerido)",
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.inventory.update_one(
        {"product_id": product_id, "warehouse_id": warehouse_id},
        {
            "$inc": {
                "damaged_quantity": qty,
                "quantity": -qty,
            },
            "$set": {"last_updated": now_iso},
        },
    )

    await audit_service.log_inventory_movement(
        product_id=product_id,
        warehouse_id=warehouse_id,
        quantity_change=qty,
        reason="warranty_defective_return",
        actor=actor,
        branch_id=branch_id,
        reference_id=claim_id,
        metadata={"claim_type": normalized_type, "bucket": "damaged/merma"},
    )
    await audit_service.log_inventory_movement(
        product_id=product_id,
        warehouse_id=warehouse_id,
        quantity_change=-qty,
        reason="warranty_replacement_dispatch",
        actor=actor,
        branch_id=branch_id,
        reference_id=claim_id,
        metadata={"claim_type": normalized_type},
    )

    return {
        "applied": True,
        "warehouse_id": warehouse_id,
        "quantity": qty,
        "damaged_added": qty,
        "available_reduced": qty,
    }