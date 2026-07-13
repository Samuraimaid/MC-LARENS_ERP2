"""Delivery proof capture, watermark persistence and seller notifications."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from backend.domains.hr.drivers import get_driver, update_delivery_job_status
from backend.domains.media.watermark import apply_delivery_watermark

DELIVERY_MEDIA_CATEGORY = "deliveries"
MANAGUA_LAT = 12.1364
MANAGUA_LON = -86.2514


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _upload_root() -> Path:
    root = Path(os.environ.get("LOCAL_UPLOAD_ROOT", "/app/uploads"))
    root.mkdir(parents=True, exist_ok=True)
    return root


def _public_base_url(branch_id: Optional[str] = None) -> str:
    tunnel_map = {
        "branch_main": os.environ.get("PUBLIC_TUNNEL_URL_MAIN", "https://mclarenerp.com"),
        "branch_north": os.environ.get("PUBLIC_TUNNEL_URL_NORTH", "https://north.mclarenerp.com"),
        "branch_south": os.environ.get("PUBLIC_TUNNEL_URL_SOUTH", "https://south.mclarenerp.com"),
    }
    return str(
        tunnel_map.get(str(branch_id or "").strip())
        or os.environ.get("PUBLIC_TUNNEL_URL", "https://mclarenerp.com")
    ).rstrip("/")


def build_delivery_proof_url(image_id: str, *, branch_id: Optional[str] = None) -> str:
    return f"{_public_base_url(branch_id)}/api/deliveries/media/{image_id}"


def save_delivery_proof_bytes(
    image_bytes: bytes,
    *,
    sale_id: str,
    latitude: float,
    longitude: float,
) -> Dict[str, Any]:
    stamped = apply_delivery_watermark(image_bytes, latitude=latitude, longitude=longitude)
    image_id = f"dlv_{uuid.uuid4().hex[:12]}"
    folder = _upload_root() / DELIVERY_MEDIA_CATEGORY
    folder.mkdir(parents=True, exist_ok=True)
    filename = f"{image_id}.jpg"
    absolute_path = folder / filename
    absolute_path.write_bytes(stamped)
    return {
        "image_id": image_id,
        "relative_path": f"{DELIVERY_MEDIA_CATEGORY}/{filename}",
        "absolute_path": str(absolute_path),
        "content_type": "image/jpeg",
        "size_bytes": len(stamped),
        "sale_id": sale_id,
        "latitude": float(latitude),
        "longitude": float(longitude),
        "created_at": _now_iso(),
    }


async def create_seller_delivery_notification(
    db,
    *,
    sale: Dict[str, Any],
    driver: Dict[str, Any],
    proof_image_id: str,
    proof_url: str,
) -> Optional[Dict[str, Any]]:
    seller_id = str(
        sale.get("seller_id")
        or sale.get("salesperson_id")
        or sale.get("created_by")
        or ""
    ).strip()
    if not seller_id:
        return None

    driver_name = f"{driver.get('name', '')} {driver.get('last_name', '')}".strip() or driver.get("driver_id")
    invoice = str(sale.get("invoice_number") or sale.get("sale_id") or "")
    message = f"¡Pedido de Factura #{invoice} entregado con éxito por {driver_name}!"
    doc = {
        "notification_id": f"ntf_{uuid.uuid4().hex[:10]}",
        "user_id": seller_id,
        "title": f"Entrega completada — Factura #{invoice}",
        "message": message,
        "category": "delivery",
        "sale_id": sale.get("sale_id"),
        "invoice_number": invoice,
        "driver_id": driver.get("driver_id"),
        "driver_name": driver_name,
        "proof_image_id": proof_image_id,
        "proof_url": proof_url,
        "read": False,
        "created_at": _now_iso(),
    }
    await db.hr_notifications.insert_one(doc)
    return doc


async def complete_delivery_with_proof(
    db,
    sale_id: str,
    *,
    driver_id: str,
    image_bytes: bytes,
    latitude: float,
    longitude: float,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    sale = await db.sales.find_one({"sale_id": sale_id}, {"_id": 0})
    if not sale:
        raise ValueError("Venta no encontrada")

    driver = await get_driver(db, driver_id)
    if not driver:
        raise ValueError("Conductor no encontrado")

    saved = save_delivery_proof_bytes(
        image_bytes,
        sale_id=sale_id,
        latitude=latitude,
        longitude=longitude,
    )
    proof_url = build_delivery_proof_url(saved["image_id"], branch_id=sale.get("branch_id"))
    now = _now_iso()

    await db.sales.update_one(
        {"sale_id": sale_id},
        {
            "$set": {
                "delivery_status": "entregado",
                "delivery_completed_at": now,
                "delivery_info.delivery_status": "entregado",
                "delivery_info.proof_image_id": saved["image_id"],
                "delivery_info.proof_url": proof_url,
                "delivery_info.proof_latitude": saved["latitude"],
                "delivery_info.proof_longitude": saved["longitude"],
                "delivery_info.proof_captured_at": saved["created_at"],
                "delivery_info.driver_id": driver_id,
                "assigned_driver_id": driver_id,
                "updated_at": now,
            }
        },
    )

    if notes:
        await db.sales.update_one({"sale_id": sale_id}, {"$set": {"delivery_notes": notes}})

    await db.delivery_proofs.insert_one(
        {
            **saved,
            "driver_id": driver_id,
            "branch_id": sale.get("branch_id"),
            "proof_url": proof_url,
            "uploaded_by": driver.get("user_id"),
        }
    )

    notification = await create_seller_delivery_notification(
        db,
        sale=sale,
        driver=driver,
        proof_image_id=saved["image_id"],
        proof_url=proof_url,
    )

    job = await update_delivery_job_status(
        db,
        sale_id,
        "entregado",
        notes=notes,
        driver_id=driver_id,
    )

    return {
        "sale_id": sale_id,
        "proof_image_id": saved["image_id"],
        "proof_url": proof_url,
        "notification": notification,
        "job": job,
    }