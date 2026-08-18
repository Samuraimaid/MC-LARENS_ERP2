"""
Live GPS Delivery Tracking and Public Vehicle/Order Traceability Domain.
Provides live location updates for messengers/drivers, fleet monitoring for management/HR/sales,
and public status timeline with real-time driver tracking for customers via QR code.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:
    from pydantic import BaseModel, Field
except ImportError:
    class BaseModel:  # type: ignore
        def __init__(self, **data: Any):
            for k, v in data.items():
                setattr(self, k, v)

    def Field(*args: Any, **kwargs: Any) -> Any:  # type: ignore
        return None


# Standard status progression for vehicle workshop & delivery
WORK_ORDER_STAGES = [
    {"id": "received", "label": "Recepción del Vehículo", "description": "Vehículo registrado e inspección inicial"},
    {"id": "in_prep", "label": "Preparación y Desmontaje", "description": "Limpieza profunda y preparación de cristales/piezas"},
    {"id": "in_workshop", "label": "En Taller / Polarizado", "description": "Corte computarizado e instalación de láminas o accesorios"},
    {"id": "quality_check", "label": "Control de Calidad", "description": "Revisión óptica, secado y verificación de acabados"},
    {"id": "ready", "label": "Listo para Entrega", "description": "Trabajo completado con garantía activa"},
    {"id": "in_transit", "label": "En Ruta de Entrega", "description": "Mensajero/chofer en camino a destino con el pedido"},
    {"id": "delivered", "label": "Entregado", "description": "Entrega finalizada y liquidada"},
]


class DriverLocationPing(BaseModel):
    driver_id: str
    driver_name: Optional[str] = None
    latitude: float
    longitude: float
    speed: Optional[float] = None  # Speed in km/h
    heading: Optional[float] = None  # Bearing in degrees (0-360)
    altitude: Optional[float] = None
    accuracy: Optional[float] = None  # Accuracy in meters
    battery_level: Optional[float] = None  # Battery percentage 0-100
    is_charging: Optional[bool] = None
    active_job_ids: List[str] = Field(default_factory=list)
    branch_id: Optional[str] = None


class VehicleStatusUpdate(BaseModel):
    sale_id: str
    stage: str
    notes: Optional[str] = None
    technician_name: Optional[str] = None


def normalize_tracking_key(raw: str) -> str:
    """Normalize input key (sale_id, invoice_number, or custom token)."""
    return str(raw or "").strip().upper()


def determine_order_stage(sale: Dict[str, Any], delivery_info: Optional[Dict[str, Any]] = None) -> str:
    """
    Infers the current stage of the sale/vehicle job.
    """
    manual_stage = sale.get("vehicle_work_stage")
    if manual_stage:
        return str(manual_stage)

    # Check delivery status first if it's a delivery order
    deliv = delivery_info or sale.get("delivery_info") or {}
    if deliv.get("is_delivery"):
        deliv_status = str(deliv.get("delivery_status") or sale.get("delivery_status") or "").lower()
        if deliv_status in {"entregado", "delivered", "completado"}:
            return "delivered"
        if deliv_status in {"en_ruta", "en_transito", "in_transit", "asignado"}:
            return "in_transit"

    # Check workshop / sales status
    status = str(sale.get("status") or "").lower()
    work_status = str(sale.get("work_order_status") or sale.get("installation_status") or "").lower()

    if status in {"completed", "completada", "entregado", "delivered"}:
        return "ready" if not deliv.get("is_delivery") else "delivered"

    if work_status in {"quality_check", "control_calidad", "revisado"}:
        return "quality_check"

    if work_status in {"in_progress", "en_proceso", "instalando", "polarizando"}:
        return "in_workshop"

    if work_status in {"preparacion", "in_prep"}:
        return "in_prep"

    return "received"


def build_public_tracking_payload(
    sale: Dict[str, Any],
    *,
    vehicle: Optional[Dict[str, Any]] = None,
    driver_location: Optional[Dict[str, Any]] = None,
    branch: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Builds a secure, sanitized public payload for customer self-tracking via QR code.
    No sensitive margins, cost prices, or internal notes are exposed.
    """
    sale_id = str(sale.get("sale_id") or "")
    invoice_number = str(sale.get("invoice_number") or sale_id)
    created_at = sale.get("created_at")
    delivery_info = sale.get("delivery_info") or {}
    is_delivery = bool(delivery_info.get("is_delivery"))

    current_stage = determine_order_stage(sale, delivery_info)

    # Build timeline items
    timeline = []
    has_reached_current = False
    for stage in WORK_ORDER_STAGES:
        # If order is pickup, skip "in_transit"
        if not is_delivery and stage["id"] == "in_transit":
            continue

        stage_id = stage["id"]
        is_current = (stage_id == current_stage)
        if is_current:
            has_reached_current = True
            is_completed = True
        elif not has_reached_current:
            is_completed = True
        else:
            is_completed = False

        timeline.append({
            "id": stage["id"],
            "label": stage["label"],
            "description": stage["description"],
            "completed": is_completed,
            "current": is_current,
        })

    # Public vehicle details
    v_data = None
    if vehicle or sale.get("vehicle_info"):
        v = vehicle or sale.get("vehicle_info") or {}
        v_data = {
            "brand": v.get("brand") or "",
            "model": v.get("model") or "",
            "year": v.get("year") or "",
            "plate": v.get("plate_number") or v.get("plate") or "",
            "color": v.get("color") or "",
            "vehicle_type": v.get("vehicle_type") or v.get("vehicle_type_slug") or "sedan",
            "version_level": v.get("version_level") or "",
        }

    # Public items summary (name + quantity + install flag, without sensitive internal codes)
    public_items = []
    for item in sale.get("items") or []:
        public_items.append({
            "product_name": item.get("product_name") or "Servicio / Producto",
            "quantity": item.get("quantity") or 1,
            "with_installation": bool(item.get("with_installation") or item.get("installation_price")),
            "tint_coverage": item.get("tint_coverage") or item.get("coverage_label") or "",
        })

    # Driver live location if active in transit
    driver_pub = None
    if is_delivery and driver_location and current_stage == "in_transit":
        driver_pub = {
            "driver_name": driver_location.get("driver_name") or delivery_info.get("messenger_name") or "Repartidor Asignado",
            "latitude": driver_location.get("latitude"),
            "longitude": driver_location.get("longitude"),
            "speed": driver_location.get("speed"),
            "heading": driver_location.get("heading"),
            "updated_at": driver_location.get("updated_at"),
            "is_moving": bool((driver_location.get("speed") or 0) > 3),
        }

    # Branch contact info for WhatsApp / Phone support
    branch_pub = {
        "name": (branch.get("name") if branch else None) or "MC-LARENS Taller & Accesorios",
        "phone": (branch.get("phone") if branch else None) or "+505 8888 8888",
        "address": (branch.get("address") if branch else None) or "Managua, Nicaragua",
    }

    return {
        "sale_id": sale_id,
        "invoice_number": invoice_number,
        "created_at": created_at,
        "status": sale.get("status") or "completed",
        "current_stage": current_stage,
        "is_delivery": is_delivery,
        "destination_label": delivery_info.get("destination_label") or "En Sucursal / Taller",
        "vehicle": v_data,
        "items": public_items,
        "timeline": timeline,
        "driver_live": driver_pub,
        "branch": branch_pub,
        "warranty_active": True,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }
