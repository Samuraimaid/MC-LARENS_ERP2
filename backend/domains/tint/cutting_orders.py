"""
MC-LARENS ERP: Módulo de Cálculo y Gestión de Órdenes de Corte de Polarizados
=============================================================================
Calcula el metraje exacto en múltiplos de 0.50m por cada cristal contratado,
agrupa los cortes por rollo (ancho 20", 36", 40") y genera la orden de corte
enlazada a la factura de venta y al KDS de polarizados.
"""

from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional
import uuid

# Múltiplo estándar de corte para evitar retazos inservibles
CUT_MULTIPLE_METERS = 0.50


def round_to_cut_multiple(meters: float) -> float:
    """Redondea hacia arriba al múltiplo de 0.50m más cercano."""
    if meters <= 0:
        return 0.0
    return math.ceil(round(meters, 3) / CUT_MULTIPLE_METERS) * CUT_MULTIPLE_METERS


def get_zone_cutting_specs(
    zone: str,
    vehicle_type: str = "sedan",
    is_empalme: bool = False
) -> Dict[str, Any]:
    """
    Retorna el ancho de rollo requerido y el metraje redondeado a múltiplos de 0.5m
    según la zona del vehículo.
    """
    is_large_vehicle = vehicle_type in (
        "camioneta_doble_cabina", "suv_grande", "panel_van", "camion_cabezal"
    )

    if zone == "windshield":
        # Parabrisas delantero: requiere rollo de 40" (o 36" según stock), 1.50m de longitud
        return {
            "roll_width_inches": 40,
            "roll_width_label": "Rollo 40\"",
            "base_meters": 1.50,
            "zone_label": "Parabrisas Delantero",
        }

    if zone == "front_sides":
        # Vidrios laterales delanteros (conductor y copiloto): rollo de 20", 1.00m total
        return {
            "roll_width_inches": 20,
            "roll_width_label": "Rollo 20\"",
            "base_meters": 1.00,
            "zone_label": "Vidrios Laterales Delanteros",
        }

    if zone == "rear_sides":
        # Vidrios laterales traseros + aletas: rollo de 20", 1.00m (1.50m en SUV grande/Van)
        return {
            "roll_width_inches": 20,
            "roll_width_label": "Rollo 20\"",
            "base_meters": 1.50 if is_large_vehicle else 1.00,
            "zone_label": "Vidrios Laterales Traseros",
        }

    if zone == "rear":
        # Vidrio trasero (Luneta):
        if is_empalme:
            # Corte especial de 2 pliegos de 20" en empalme
            return {
                "roll_width_inches": 20,
                "roll_width_label": "Rollo 20\" (Empalme)",
                "base_meters": 2.00,  # 2 pliegos de 1.00m
                "zone_label": "Vidrio Trasero (Empalme 2x20\")",
                "is_empalme": True,
            }
        return {
            "roll_width_inches": 40,
            "roll_width_label": "Rollo 40\"",
            "base_meters": 1.50,
            "zone_label": "Vidrio Trasero (Luneta)",
        }

    if zone.startswith("sunstrip_") or "strip" in zone:
        # Franja solar superior o inferior: rollo de 20", 0.50m de longitud
        return {
            "roll_width_inches": 20,
            "roll_width_label": "Rollo 20\"",
            "base_meters": 0.50,
            "zone_label": "Banda Frontal / Franja Solar",
        }

    return {
        "roll_width_inches": 20,
        "roll_width_label": "Rollo 20\"",
        "base_meters": 0.50,
        "zone_label": zone,
    }


def compute_order_cutting_plan(
    tint_plan: Dict[str, Any],
    vehicle_info: Optional[Dict[str, Any]] = None,
    materials_catalog: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Calcula el plan detallado de cortes para una orden de polarizado.
    Retorna la lista de cortes individuales y el resumen agrupado por rollo y metraje total.
    """
    windows = tint_plan.get("windows") or {}
    sunstrips = tint_plan.get("sunstrips") or {}
    vehicle_type = (vehicle_info or {}).get("vehicle_type") or "sedan"

    # Mapeo de nombres de materiales
    mat_names = {}
    if materials_catalog:
        for m in materials_catalog:
            mat_names[m.get("id") or m.get("material_id")] = m.get("name")

    cuts: List[Dict[str, Any]] = []
    cut_seq = 1

    # 1. Analizar cristales laterales vinculados o individuales
    link_sides = bool(tint_plan.get("link_sides"))
    fs_mat = windows.get("front_sides", {}).get("material_id")
    rs_mat = windows.get("rear_sides", {}).get("material_id")

    if link_sides and fs_mat and fs_mat == rs_mat and fs_mat not in ("none", "sin_polarizado", None):
        # Laterales completos con el mismo material -> 1 corte continuo de 2.00m (o 2.50m en SUV grande)
        spec = get_zone_cutting_specs("front_sides", vehicle_type)
        meters = 2.50 if vehicle_type in ("suv_grande", "camioneta_doble_cabina", "panel_van") else 2.00
        cuts.append({
            "cut_id": f"C{cut_seq:02d}",
            "zone": "sides_all",
            "zone_label": "4 Laterales (Delanteros + Traseros)",
            "layer": 1,
            "material_id": fs_mat,
            "material_name": windows.get("front_sides", {}).get("material_name") or mat_names.get(fs_mat, fs_mat),
            "roll_width_inches": spec["roll_width_inches"],
            "roll_width_label": spec["roll_width_label"],
            "meters": meters,
            "instructions": f"Cortar {meters:.2f}m de {spec['roll_width_label']} para 4 vidrios laterales",
        })
        cut_seq += 1
    else:
        # Laterales independientes
        for z_key in ("front_sides", "rear_sides"):
            win = windows.get(z_key) or {}
            mat_id = win.get("material_id")
            if mat_id and mat_id not in ("none", "sin_polarizado"):
                spec = get_zone_cutting_specs(z_key, vehicle_type)
                cuts.append({
                    "cut_id": f"C{cut_seq:02d}",
                    "zone": z_key,
                    "zone_label": spec["zone_label"],
                    "layer": 1,
                    "material_id": mat_id,
                    "material_name": win.get("material_name") or mat_names.get(mat_id, mat_id),
                    "roll_width_inches": spec["roll_width_inches"],
                    "roll_width_label": spec["roll_width_label"],
                    "meters": spec["base_meters"],
                    "instructions": f"Cortar {spec['base_meters']:.2f}m de {spec['roll_width_label']}",
                })
                cut_seq += 1

    # 2. Parabrisas Delantero
    win_w = windows.get("windshield") or {}
    mat_id_w = win_w.get("material_id")
    if mat_id_w and mat_id_w not in ("none", "sin_polarizado"):
        spec_w = get_zone_cutting_specs("windshield", vehicle_type)
        cuts.append({
            "cut_id": f"C{cut_seq:02d}",
            "zone": "windshield",
            "zone_label": spec_w["zone_label"],
            "layer": 1,
            "material_id": mat_id_w,
            "material_name": win_w.get("material_name") or mat_names.get(mat_id_w, mat_id_w),
            "roll_width_inches": spec_w["roll_width_inches"],
            "roll_width_label": spec_w["roll_width_label"],
            "meters": spec_w["base_meters"],
            "instructions": f"Cortar {spec_w['base_meters']:.2f}m de {spec_w['roll_width_label']}",
        })
        cut_seq += 1

    # 3. Vidrio Trasero (Luneta)
    win_r = windows.get("rear") or {}
    mat_id_r = win_r.get("material_id")
    if mat_id_r and mat_id_r not in ("none", "sin_polarizado"):
        is_empalme = bool(win_r.get("empalme_2x20") or tint_plan.get("has_empalme"))
        spec_r = get_zone_cutting_specs("rear", vehicle_type, is_empalme=is_empalme)
        cuts.append({
            "cut_id": f"C{cut_seq:02d}",
            "zone": "rear",
            "zone_label": spec_r["zone_label"],
            "layer": 1,
            "material_id": mat_id_r,
            "material_name": win_r.get("material_name") or mat_names.get(mat_id_r, mat_id_r),
            "roll_width_inches": spec_r["roll_width_inches"],
            "roll_width_label": spec_r["roll_width_label"],
            "meters": spec_r["base_meters"],
            "is_empalme": is_empalme,
            "instructions": "Cortar 2 pliegos de 1.00m (Empalme 2x20\")" if is_empalme else f"Cortar {spec_r['base_meters']:.2f}m de {spec_r['roll_width_label']}",
        })
        cut_seq += 1

    # 4. Bandas de Sol (Sunstrips)
    for strip_key, strip_label in [
        ("windshield_top", "Banda Frontal Superior"),
        ("windshield_bottom", "Banda Frontal Inferior"),
        ("rear_top", "Banda Trasera Superior"),
        ("rear_bottom", "Banda Trasera Inferior"),
    ]:
        strip_data = sunstrips.get(strip_key) or {}
        if strip_data.get("enabled"):
            s_mat_id = strip_data.get("material_id") or "std_20"
            spec_s = get_zone_cutting_specs(strip_key, vehicle_type)
            cuts.append({
                "cut_id": f"C{cut_seq:02d}",
                "zone": strip_key,
                "zone_label": strip_label,
                "layer": 1,
                "material_id": s_mat_id,
                "material_name": mat_names.get(s_mat_id, s_mat_id),
                "roll_width_inches": 20,
                "roll_width_label": "Rollo 20\"",
                "meters": 0.50,
                "instructions": f"Cortar 0.50m de Rollo 20\" para {strip_label}",
            })
            cut_seq += 1

    # 5. Segundas Capas (Doble Capa)
    for z_key in ("windshield", "front_sides", "rear_sides", "rear"):
        win = windows.get(z_key) or {}
        sec = win.get("second_layer") or {}
        if sec.get("enabled") and sec.get("material_id"):
            sec_mat = sec.get("material_id")
            spec_sec = get_zone_cutting_specs(z_key, vehicle_type)
            cuts.append({
                "cut_id": f"C{cut_seq:02d}",
                "zone": f"{z_key}_layer2",
                "zone_label": f"{spec_sec['zone_label']} (2da Capa)",
                "layer": 2,
                "material_id": sec_mat,
                "material_name": mat_names.get(sec_mat, sec_mat),
                "roll_width_inches": spec_sec["roll_width_inches"],
                "roll_width_label": spec_sec["roll_width_label"],
                "meters": spec_sec["base_meters"],
                "instructions": f"2da Capa: Cortar {spec_sec['base_meters']:.2f}m de {spec_sec['roll_width_label']}",
            })
            cut_seq += 1

    # Resumen agrupado por Material y Ancho de Rollo
    roll_summary_map: Dict[str, Dict[str, Any]] = {}
    total_meters = 0.0

    for c in cuts:
        key = f"{c['material_id']}__w{c['roll_width_inches']}"
        if key not in roll_summary_map:
            roll_summary_map[key] = {
                "key": key,
                "material_id": c["material_id"],
                "material_name": c["material_name"],
                "roll_width_inches": c["roll_width_inches"],
                "roll_width_label": c["roll_width_label"],
                "total_meters": 0.0,
                "cut_count": 0,
                "zones": [],
            }
        roll_summary_map[key]["total_meters"] += c["meters"]
        roll_summary_map[key]["cut_count"] += 1
        roll_summary_map[key]["zones"].append(c["zone_label"])
        total_meters += c["meters"]

    # Redondear totales al múltiplo de 0.50m
    roll_summary = list(roll_summary_map.values())
    for r in roll_summary:
        r["total_meters"] = round_to_cut_multiple(r["total_meters"])

    return {
        "cuts": cuts,
        "roll_summary": roll_summary,
        "total_meters": round_to_cut_multiple(total_meters),
        "cut_count": len(cuts),
    }


async def create_cutting_order_from_sale(
    db: Any,
    sale_doc: Dict[str, Any],
    tint_order_id: str,
    customer: Dict[str, Any],
    vehicle_info: Dict[str, Any],
    polarizado_items: List[Dict[str, Any]],
    policy: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """
    Crea la orden de corte en db.tint_cutting_orders inmediatamente tras la confirmación de pago en caja.
    """
    if not polarizado_items:
        return None

    # Extraer el plan de polarizado del primer item o consolidar
    tint_plan = None
    for it in polarizado_items:
        if it.get("tint_window_plan"):
            tint_plan = it.get("tint_window_plan")
            break

    if not tint_plan:
        # Fallback a un plan básico a partir del producto
        tint_plan = {
            "windows": {
                "windshield": {"material_id": "std_70", "material_name": "Estándar 70%"},
                "front_sides": {"material_id": "std_20", "material_name": "Estándar 20%"},
                "rear_sides": {"material_id": "std_20", "material_name": "Estándar 20%"},
                "rear": {"material_id": "std_20", "material_name": "Estándar 20%"},
            }
        }

    materials_cat = (policy or {}).get("materials", [])
    cutting_plan = compute_order_cutting_plan(tint_plan, vehicle_info, materials_cat)

    cut_order_id = f"CUT-{uuid.uuid4().hex[:6].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()

    doc = {
        "cut_order_id": cut_order_id,
        "tint_order_id": tint_order_id,
        "sale_id": sale_doc.get("sale_id"),
        "invoice_number": sale_doc.get("invoice_number"),
        "customer_id": customer.get("customer_id"),
        "customer_name": customer.get("name"),
        "customer_phone": customer.get("phone"),
        "vehicle_id": sale_doc.get("vehicle_id"),
        "vehicle_info": vehicle_info,
        "branch_id": sale_doc.get("branch_id"),
        "salesperson_name": sale_doc.get("salesperson_name"),
        "cuts": cutting_plan["cuts"],
        "roll_summary": cutting_plan["roll_summary"],
        "total_meters": cutting_plan["total_meters"],
        "cut_count": cutting_plan["cut_count"],
        "additional_meters_total": 0.0,
        "adjustments": [],  # Historial de adiciones (+0.5m)
        "status": "pending_cut",  # pending_cut -> cut_ready -> delivered
        "assigned_technician_id": None,
        "assigned_technician_name": None,
        "cut_by_user_id": None,
        "cut_by_user_name": None,
        "created_at": now_iso,
        "cut_at": None,
        "delivered_at": None,
        "notes": f"Corte para Factura #{sale_doc.get('invoice_number', 'N/A')}",
    }

    await db.tint_cutting_orders.insert_one(doc)

    # Actualizar la orden de polarizado con el enlace a la orden de corte
    await db.tint_orders.update_one(
        {"tint_order_id": tint_order_id},
        {
            "$set": {
                "cut_order_id": cut_order_id,
                "cutting_status": "pending_cut",
                "total_cutting_meters": cutting_plan["total_meters"],
            }
        },
    )

    return cut_order_id
