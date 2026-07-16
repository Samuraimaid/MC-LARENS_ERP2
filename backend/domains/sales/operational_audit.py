"""Operational workshop traceability and customer loyalty metrics for sale detail."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

DEPARTMENT_LABELS = {
    "polarizados": "Polarizados",
    "instalaciones": "Instalaciones",
    "electrico": "Eléctrico",
    "tint": "Polarizados",
}


def _parse_iso(value: Any) -> Optional[datetime]:
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _minutes_between(start: Any, end: Any) -> Optional[int]:
    start_dt = _parse_iso(start)
    end_dt = _parse_iso(end)
    if not start_dt or not end_dt:
        return None
    if end_dt < start_dt:
        return None
    return int((end_dt - start_dt).total_seconds() / 60)


def _staff_from_user(user: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not user:
        return None
    nombre = str(user.get("name") or "").strip()
    apellido = str(user.get("last_name") or "").strip()
    display = " ".join(part for part in (nombre, apellido) if part).strip() or nombre
    if not display and not user.get("user_id"):
        return None
    return {
        "user_id": user.get("user_id"),
        "nombre": nombre or None,
        "apellido": apellido or None,
        "display_name": display or None,
    }


def _staff_from_label(label: Any) -> Optional[Dict[str, Any]]:
    text = str(label or "").strip()
    if not text:
        return None
    parts = text.split(None, 1)
    nombre = parts[0] if parts else text
    apellido = parts[1] if len(parts) > 1 else None
    return {
        "user_id": None,
        "nombre": nombre,
        "apellido": apellido,
        "display_name": text,
    }


async def _resolve_staff_by_name(db: Any, label: Any) -> Optional[Dict[str, Any]]:
    text = str(label or "").strip()
    if not text:
        return None
    user = await db.users.find_one(
        {
            "$or": [
                {"name": text},
                {
                    "$expr": {
                        "$eq": [
                            {
                                "$trim": {
                                    "input": {
                                        "$concat": [
                                            {"$ifNull": ["$name", ""]},
                                            " ",
                                            {"$ifNull": ["$last_name", ""]},
                                        ]
                                    }
                                }
                            },
                            text,
                        ]
                    }
                },
            ]
        },
        {"_id": 0, "user_id": 1, "name": 1, "last_name": 1},
    )
    if user:
        return _staff_from_user(user)
    return _staff_from_label(text)


def _sale_total_nio(sale: Dict[str, Any]) -> float:
    mixed = sale.get("mixed_payment_summary") or {}
    if isinstance(mixed, dict) and mixed.get("total_nio"):
        return round(float(mixed["total_nio"]), 2)

    currency = str(sale.get("currency") or "NIO").upper()
    rate = float(sale.get("exchange_rate") or 36.5)
    total = float(
        sale.get("net_to_collect")
        or sale.get("total_legal")
        or sale.get("total")
        or sale.get("total_amount")
        or 0.0
    )
    if currency == "USD":
        return round(total * rate, 2)
    return round(total, 2)


def _vehicle_from_sources(
    sale: Dict[str, Any],
    vehicle_doc: Optional[Dict[str, Any]],
    work_orders: List[Dict[str, Any]],
    tint_orders: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    vehicle_info: Dict[str, Any] = {}
    for source in (
        vehicle_doc or {},
        sale.get("vehicle_info") if isinstance(sale.get("vehicle_info"), dict) else {},
        *(wo.get("vehicle_info") for wo in work_orders if isinstance(wo.get("vehicle_info"), dict)),
        *(to.get("vehicle_info") for to in tint_orders if isinstance(to.get("vehicle_info"), dict)),
    ):
        for key in ("brand", "model", "year", "plate", "vin", "chasis"):
            if source.get(key) and not vehicle_info.get(key):
                vehicle_info[key] = source.get(key)

    doc = vehicle_doc or {}
    marca = vehicle_info.get("brand") or doc.get("brand")
    modelo = vehicle_info.get("model") or doc.get("model")
    anio = vehicle_info.get("year") or doc.get("year")
    placa = vehicle_info.get("plate") or doc.get("plate")
    vin = vehicle_info.get("vin") or vehicle_info.get("chasis") or doc.get("vin") or doc.get("chasis")

    if not any([marca, modelo, anio, placa, vin]):
        return None

    return {
        "marca": marca,
        "modelo": modelo,
        "anio": anio,
        "placa": placa,
        "vin": vin,
    }


def _pick_primary_work_order(work_orders: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not work_orders:
        return None
    ranked = sorted(
        work_orders,
        key=lambda row: (
            0 if row.get("start_time") else 1,
            str(row.get("created_at") or ""),
        ),
    )
    return ranked[0]


def _pick_primary_tint_order(tint_orders: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not tint_orders:
        return None
    ranked = sorted(
        tint_orders,
        key=lambda row: (
            0 if row.get("started_at") else 1,
            str(row.get("created_at") or ""),
        ),
    )
    return ranked[0]


def _installation_window(
    work_orders: List[Dict[str, Any]],
    tint_orders: List[Dict[str, Any]],
) -> Tuple[Optional[Any], Optional[Any]]:
    starts: List[datetime] = []
    ends: List[datetime] = []

    for row in work_orders:
        start_dt = _parse_iso(row.get("start_time"))
        end_dt = _parse_iso(row.get("end_time"))
        if start_dt:
            starts.append(start_dt)
        if end_dt:
            ends.append(end_dt)

    for row in tint_orders:
        start_dt = _parse_iso(row.get("started_at"))
        end_dt = _parse_iso(row.get("completed_at"))
        if start_dt:
            starts.append(start_dt)
        if end_dt:
            ends.append(end_dt)

    if not starts:
        return None, None
    start = min(starts).isoformat()
    end = max(ends).isoformat() if ends else None
    return start, end


def _infer_favorite_service(
    historical_sales: List[Dict[str, Any]],
    work_orders: List[Dict[str, Any]],
    tint_orders: List[Dict[str, Any]],
) -> Optional[str]:
    counts: Dict[str, int] = {}

    for row in work_orders:
        dept = str(row.get("department") or "instalaciones").lower()
        label = DEPARTMENT_LABELS.get(dept, dept.title())
        counts[label] = counts.get(label, 0) + 1

    for _ in tint_orders:
        counts["Polarizados"] = counts.get("Polarizados", 0) + 1

    for sale in historical_sales:
        for item in sale.get("items") or []:
            name = str(item.get("product_name") or "").lower()
            category = str(item.get("category") or item.get("product_category") or "").lower()
            if "polar" in name or "tint" in category or category == "tint":
                counts["Polarizados"] = counts.get("Polarizados", 0) + int(item.get("quantity") or 1)
            elif "instal" in name or category in {"accessories", "audio", "security"}:
                counts["Instalaciones"] = counts.get("Instalaciones", 0) + int(item.get("quantity") or 1)

    if not counts:
        return None
    return max(counts.items(), key=lambda pair: pair[1])[0]


def _empty_operational_audit(customer_id: Optional[str] = None) -> Dict[str, Any]:
    return {
        "vehiculo": None,
        "despachado_por_bodega": None,
        "recibido_por_taller": None,
        "instalado_por": None,
        "control_calidad_por": None,
        "tiempo_espera_instalacion": None,
        "tiempo_ejecucion_taller": None,
        "total_visitas_historicas": 0,
        "ticket_promedio_nio": 0.0,
        "servicio_favorito": None,
        "has_workshop_flow": False,
        "timeline": [],
        "customer_id": customer_id,
    }


async def build_operational_audit(db: Any, sale: Dict[str, Any]) -> Dict[str, Any]:
    """Aggregate workshop traceability and customer BI for GET /api/sales/{sale_id}."""
    sale_id = str(sale.get("sale_id") or "")
    customer_id = sale.get("customer_id")
    base = _empty_operational_audit(customer_id)

    work_orders = await db.work_orders.find({"sale_id": sale_id}, {"_id": 0}).to_list(50)
    tint_orders = await db.tint_orders.find({"sale_id": sale_id}, {"_id": 0}).to_list(20)
    dispatch = await db.dispatch_orders.find_one({"sale_id": sale_id}, {"_id": 0})

    has_workshop = bool(work_orders or tint_orders or dispatch)
    base["has_workshop_flow"] = has_workshop

    vehicle_doc = None
    vehicle_id = sale.get("vehicle_id")
    if not vehicle_id and work_orders:
        vehicle_id = work_orders[0].get("vehicle_id")
    if vehicle_id:
        vehicle_doc = await db.vehicles.find_one({"vehicle_id": vehicle_id}, {"_id": 0})

    base["vehiculo"] = _vehicle_from_sources(sale, vehicle_doc, work_orders, tint_orders)

    dispatcher_label = None
    if dispatch:
        dispatchers = list(dispatch.get("dispatchers") or [])
        if dispatchers:
            dispatcher_label = dispatchers[-1]
        else:
            for item in dispatch.get("items") or []:
                if item.get("delivered_by"):
                    dispatcher_label = item.get("delivered_by")
                    break
    base["despachado_por_bodega"] = await _resolve_staff_by_name(db, dispatcher_label)

    primary_wo = _pick_primary_work_order(work_orders)
    primary_tint = _pick_primary_tint_order(tint_orders)

    recibido_label = None
    if primary_wo:
        recibido_label = primary_wo.get("technician_name")
        if not recibido_label and primary_wo.get("technician_id"):
            tech = await db.users.find_one(
                {"user_id": primary_wo.get("technician_id")},
                {"_id": 0, "user_id": 1, "name": 1, "last_name": 1},
            )
            recibido = _staff_from_user(tech)
            if recibido:
                base["recibido_por_taller"] = recibido
    if not base.get("recibido_por_taller"):
        base["recibido_por_taller"] = await _resolve_staff_by_name(db, recibido_label)

    instalado_label = None
    if primary_wo and primary_wo.get("technician_name"):
        instalado_label = primary_wo.get("technician_name")
    elif primary_tint:
        instalado_label = (
            primary_tint.get("assigned_technician_name")
            or primary_tint.get("technician_name")
        )
    base["instalado_por"] = await _resolve_staff_by_name(db, instalado_label)

    qc_label = None
    if primary_wo:
        qc_label = primary_wo.get("qc_approved_by_name")
    if not qc_label and primary_wo:
        qc_row = await db.quality_controls.find_one(
            {"work_order_id": primary_wo.get("work_order_id"), "approved": True},
            {"_id": 0, "inspector_name": 1, "approved_by_name": 1},
        )
        if qc_row:
            qc_label = qc_row.get("inspector_name") or qc_row.get("approved_by_name")
    base["control_calidad_por"] = await _resolve_staff_by_name(db, qc_label)

    paid_at = sale.get("paid_at") or sale.get("collected_at")
    if str(sale.get("payment_status") or "").lower() == "paid" and not paid_at:
        paid_at = sale.get("updated_at")

    install_start, install_end = _installation_window(work_orders, tint_orders)
    base["tiempo_espera_instalacion"] = _minutes_between(paid_at, install_start)
    base["tiempo_ejecucion_taller"] = _minutes_between(install_start, install_end)

    if customer_id:
        paid_sales = await db.sales.find(
            {"customer_id": customer_id, "payment_status": "paid"},
            {"_id": 0, "sale_id": 1, "items": 1, "currency": 1, "exchange_rate": 1, "total": 1, "total_legal": 1, "net_to_collect": 1, "total_amount": 1, "mixed_payment_summary": 1},
        ).to_list(5000)
        visit_count = len(paid_sales)
        total_nio = sum(_sale_total_nio(row) for row in paid_sales)
        base["total_visitas_historicas"] = visit_count
        base["ticket_promedio_nio"] = round(total_nio / visit_count, 2) if visit_count else 0.0
        base["servicio_favorito"] = _infer_favorite_service(paid_sales, work_orders, tint_orders)

    timeline: List[Dict[str, Any]] = [
        {
            "step": "caja",
            "label": "Caja",
            "actor": sale.get("cashier_name") or sale.get("collected_by_name"),
            "timestamp": paid_at,
        },
    ]
    if base["despachado_por_bodega"]:
        timeline.append(
            {
                "step": "bodega",
                "label": "Bodega",
                "actor": base["despachado_por_bodega"].get("display_name"),
                "timestamp": (dispatch or {}).get("completed_at"),
            }
        )
    if base["instalado_por"]:
        timeline.append(
            {
                "step": "taller",
                "label": "Taller",
                "actor": base["instalado_por"].get("display_name"),
                "timestamp": install_start,
            }
        )
    if base["control_calidad_por"]:
        timeline.append(
            {
                "step": "qc",
                "label": "QC Gate",
                "actor": base["control_calidad_por"].get("display_name"),
                "timestamp": (primary_wo or {}).get("qc_approved_at"),
            }
        )
    base["timeline"] = timeline

    return base