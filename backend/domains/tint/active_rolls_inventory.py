"""
MC-LARENS ERP: Módulo de Inventario Dual de Rollos de Polarizado
==============================================================
Gestiona la separación estricta entre:
  1. Rollos Sellados en Bodega (Unidades enteras cerradas, ej. 30m c/u en db.products).
  2. Rollos en Uso en Taller (1 rollo activo por tono y ancho en db.tint_active_rolls, medido en metros).
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

DEFAULT_ROLL_METERS = 30.00  # Longitud estándar de rollo de fábrica


async def get_or_initialize_active_rolls(
    db: Any,
    branch_id: Optional[str] = "principal",
    materials_catalog: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Retorna la lista de rollos activos en la mesa de corte para una sucursal.
    Si algún material no tiene rollo en uso inicializado, lo crea con stock inicial.
    """
    effective_branch = branch_id or "principal"
    existing_rolls = await db.tint_active_rolls.find(
        {"branch_id": effective_branch, "status": "active"},
        {"_id": 0}
    ).to_list(100)

    existing_map = {
        f"{r.get('material_id')}__w{r.get('roll_width_inches')}": r
        for r in existing_rolls
    }

    # Materiales estándar si no se pasa catálogo
    catalog = materials_catalog or [
        {"id": "std_70", "name": "Estándar 70% Térmico", "gama": "gama_economica"},
        {"id": "std_20", "name": "Estándar Charcoal 20%", "gama": "gama_economica"},
        {"id": "std_05", "name": "Estándar Charcoal 5%", "gama": "gama_economica"},
        {"id": "sg_supreme_70", "name": "Solar Gard Supreme 70%", "gama": "gama_premium"},
        {"id": "sg_charcoal_20", "name": "Solar Gard HP Charcoal 20%", "gama": "gama_premium"},
        {"id": "sg_charcoal_05", "name": "Solar Gard HP Charcoal 5%", "gama": "gama_premium"},
        {"id": "sg_vortex_70", "name": "Solar Gard VortexIR Nano Cerámico 70%", "gama": "nano_ceramico"},
        {"id": "sg_vortex_20", "name": "Solar Gard VortexIR Nano Cerámico 20%", "gama": "nano_ceramico"},
        {"id": "sg_vortex_05", "name": "Solar Gard VortexIR Nano Cerámico 5%", "gama": "nano_ceramico"},
        {"id": "raybar_ch_20", "name": "Raybar HP Charcoal 20%", "gama": "gama_premium"},
        {"id": "raybar_ch_05", "name": "Raybar HP Charcoal 5%", "gama": "gama_premium"},
        {"id": "sg_camaleon_20", "name": "Solar Gard Camaleón Azul 20%", "gama": "especial"},
    ]

    now_iso = datetime.now(timezone.utc).isoformat()
    new_rolls_to_insert = []

    # Cada material puede tener rollo de 20" y rollo de 40"
    for mat in catalog:
        mat_id = mat.get("id") or mat.get("material_id")
        if not mat_id:
            continue

        widths = [20, 40]
        for w in widths:
            key = f"{mat_id}__w{w}"
            if key not in existing_map:
                new_doc = {
                    "roll_id": f"ACT-{mat_id.upper()}-W{w}",
                    "material_id": mat_id,
                    "material_name": mat.get("name") or mat_id,
                    "gama": mat.get("gama") or "general",
                    "roll_width_inches": w,
                    "roll_width_label": f"Rollo {w}\"",
                    "initial_length_meters": DEFAULT_ROLL_METERS,
                    "remaining_meters": DEFAULT_ROLL_METERS,
                    "total_dispatched_meters": 0.0,
                    "branch_id": effective_branch,
                    "opened_at": now_iso,
                    "opened_by_user_id": "system",
                    "opened_by_user_name": "Inicialización Automática",
                    "status": "active",
                    "low_stock_warning": False,
                    "history": [
                        {
                            "timestamp": now_iso,
                            "type": "initial_open",
                            "meters": DEFAULT_ROLL_METERS,
                            "user_name": "Sistema",
                            "note": "Apertura inicial de rollo en taller",
                        }
                    ],
                }
                new_rolls_to_insert.append(new_doc)
                existing_map[key] = new_doc

    if new_rolls_to_insert:
        await db.tint_active_rolls.insert_many(new_rolls_to_insert)

    # Devolver lista completa ordenada por gama y nombre
    results = await db.tint_active_rolls.find(
        {"branch_id": effective_branch, "status": "active"},
        {"_id": 0}
    ).sort("material_name", 1).to_list(200)

    return results


async def deduct_meters_from_active_roll(
    db: Any,
    branch_id: str,
    material_id: str,
    roll_width_inches: int,
    meters: float,
    cut_order_id: str,
    user_info: Optional[Dict[str, Any]] = None,
    note: Optional[str] = None
) -> Dict[str, Any]:
    """
    Descuenta metros lineales del rollo activo en taller al despachar un corte.
    """
    effective_branch = branch_id or "principal"
    w = int(roll_width_inches) if roll_width_inches else 20
    now_iso = datetime.now(timezone.utc).isoformat()

    active_roll = await db.tint_active_rolls.find_one({
        "branch_id": effective_branch,
        "material_id": material_id,
        "roll_width_inches": w,
        "status": "active",
    })

    if not active_roll:
        # Inicializar sobre la marcha si no existe
        await get_or_initialize_active_rolls(db, effective_branch)
        active_roll = await db.tint_active_rolls.find_one({
            "branch_id": effective_branch,
            "material_id": material_id,
            "roll_width_inches": w,
            "status": "active",
        })

    if not active_roll:
        return {"success": False, "error": f"No se encontró rollo activo para {material_id} {w}\""}

    current_remaining = float(active_roll.get("remaining_meters", DEFAULT_ROLL_METERS))
    new_remaining = max(0.0, round(current_remaining - meters, 2))
    new_dispatched = round(float(active_roll.get("total_dispatched_meters", 0.0)) + meters, 2)
    is_low = new_remaining <= 2.00  # Alerta si quedan 2 metros o menos

    history_entry = {
        "timestamp": now_iso,
        "type": "cut_dispatch",
        "meters_deducted": meters,
        "remaining_after": new_remaining,
        "cut_order_id": cut_order_id,
        "user_id": (user_info or {}).get("user_id"),
        "user_name": (user_info or {}).get("name") or "Coordinador",
        "note": note or f"Despacho para orden {cut_order_id}",
    }

    await db.tint_active_rolls.update_one(
        {"_id": active_roll["_id"]},
        {
            "$set": {
                "remaining_meters": new_remaining,
                "total_dispatched_meters": new_dispatched,
                "low_stock_warning": is_low,
                "updated_at": now_iso,
            },
            "$push": {"history": history_entry},
        },
    )

    return {
        "success": True,
        "roll_id": active_roll.get("roll_id"),
        "material_name": active_roll.get("material_name"),
        "remaining_meters": new_remaining,
        "low_stock_warning": is_low,
    }


async def open_new_roll_from_warehouse(
    db: Any,
    branch_id: str,
    material_id: str,
    roll_width_inches: int,
    user_info: Dict[str, Any],
    custom_length_meters: Optional[float] = None
) -> Dict[str, Any]:
    """
    Pasa 1 Rollo Sellado de Bodega (db.products) a Rollo en Uso en Taller (db.tint_active_rolls).
    Cierra el rollo anterior si existía y abre uno nuevo con 30.00m.
    """
    effective_branch = branch_id or "principal"
    w = int(roll_width_inches) if roll_width_inches else 20
    roll_meters = float(custom_length_meters) if custom_length_meters else DEFAULT_ROLL_METERS
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Buscar y descontar 1 unidad sellada en bodega (db.products) si existe el producto
    # Buscamos por palabras clave del material y ancho
    search_regex = f"(?=.*{material_id.replace('_', '.*')}|.*polarizado)(?=.*{w})"
    sealed_prod = await db.products.find_one({
        "$or": [
            {"product_id": f"ROL-{material_id.upper()}-{w}"},
            {"sku": f"ROL-{material_id.upper()}-{w}"},
            {"name": {"$regex": search_regex, "$options": "i"}},
            {"category": "polarizado", "tags": {"$in": [material_id, f"{w}in", f"{w}inch"]}},
        ]
    })

    sealed_stock_before = 0
    sealed_stock_after = 0

    if sealed_prod:
        sealed_stock_before = int(sealed_prod.get("stock", 0))
        sealed_stock_after = max(0, sealed_stock_before - 1)
        await db.products.update_one(
            {"product_id": sealed_prod["product_id"]},
            {"$set": {"stock": sealed_stock_after, "updated_at": now_iso}}
        )

        # Registrar movimiento de inventario en bodega
        movement_doc = {
            "movement_id": f"MOV-{uuid.uuid4().hex[:8].upper()}",
            "product_id": sealed_prod["product_id"],
            "product_name": sealed_prod.get("name"),
            "movement_type": "transfer_to_workshop",
            "quantity": -1,
            "stock_before": sealed_stock_before,
            "stock_after": sealed_stock_after,
            "branch_id": effective_branch,
            "reference": f"Apertura rollo en taller ({material_id} {w}\")",
            "created_by": user_info.get("name", "Coordinador Polarizados"),
            "created_at": now_iso,
        }
        await db.inventory_movements.insert_one(movement_doc)

    # 2. Desactivar rollo anterior en taller si existía
    prev_roll = await db.tint_active_rolls.find_one({
        "branch_id": effective_branch,
        "material_id": material_id,
        "roll_width_inches": w,
        "status": "active",
    })

    if prev_roll:
        await db.tint_active_rolls.update_one(
            {"_id": prev_roll["_id"]},
            {
                "$set": {
                    "status": "depleted",
                    "closed_at": now_iso,
                    "closed_by_user_id": user_info.get("user_id"),
                    "closed_by_user_name": user_info.get("name"),
                }
            }
        )

    # 3. Crear nuevo rollo activo en taller
    new_roll_id = f"ACT-{material_id.upper()}-W{w}-{uuid.uuid4().hex[:4].upper()}"
    mat_name = prev_roll.get("material_name") if prev_roll else (sealed_prod.get("name") if sealed_prod else material_id)

    new_active_doc = {
        "roll_id": new_roll_id,
        "material_id": material_id,
        "material_name": mat_name,
        "roll_width_inches": w,
        "roll_width_label": f"Rollo {w}\"",
        "initial_length_meters": roll_meters,
        "remaining_meters": roll_meters,
        "total_dispatched_meters": 0.0,
        "branch_id": effective_branch,
        "opened_at": now_iso,
        "opened_by_user_id": user_info.get("user_id"),
        "opened_by_user_name": user_info.get("name", "Coordinador"),
        "status": "active",
        "low_stock_warning": False,
        "sealed_product_id": sealed_prod.get("product_id") if sealed_prod else None,
        "history": [
            {
                "timestamp": now_iso,
                "type": "open_new_from_warehouse",
                "meters": roll_meters,
                "sealed_stock_remaining": sealed_stock_after,
                "user_id": user_info.get("user_id"),
                "user_name": user_info.get("name", "Coordinador"),
                "note": f"Apertura de nuevo rollo desde bodega. Stock bodega restante: {sealed_stock_after} rollos sellados.",
            }
        ],
    }

    await db.tint_active_rolls.insert_one(new_active_doc)

    return {
        "success": True,
        "roll_id": new_roll_id,
        "material_id": material_id,
        "material_name": mat_name,
        "roll_width_label": f"Rollo {w}\"",
        "remaining_meters": roll_meters,
        "sealed_stock_remaining": sealed_stock_after,
        "message": f"Nuevo rollo de {mat_name} ({w}\") abierto con {roll_meters:.2f}m. Stock bodega sellado: {sealed_stock_after} rollos.",
    }
