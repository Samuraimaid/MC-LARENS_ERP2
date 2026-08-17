"""Tint window materials, size bands, vehicle glass heuristics, pricing, and quoting."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Tuple

# Zonas de cristal en el vehículo
GLASS_ZONES = ["windshield", "front_sides", "rear_sides", "rear"]

# Mapeo de zona a grupo de cobro/material (laterales comparten material y cobro)
ZONE_TO_GROUP = {
    "windshield": "windshield",
    "front_sides": "sides",
    "rear_sides": "sides",
    "rear": "rear",
}

# Tallas de rollo / Bandas de tamaño
SIZE_BANDS = {
    "windshield_under_40": {"name": "Parabrisas ≤ 40\"", "max_height_in": 40.0, "category": "windshield"},
    "windshield_over_40": {"name": "Parabrisas > 40\"", "min_height_in": 40.0, "category": "windshield"},
    "side_under_20": {"name": "Laterales/Traseros ≤ 20\"", "max_height_in": 20.0, "category": "sides"},
    "side_over_20": {"name": "Laterales/Traseros > 20\"", "min_height_in": 20.0, "category": "sides"},
}

DEFAULT_TINT_WINDOW_MATERIALS_POLICY = {
    "require_plan_on_installed_sale": False,
    "max_materials_per_vehicle": 3,
    "glass_templates": {
        "toyota_hilux": {"windshield": "windshield_over_40", "sides": "side_over_20", "rear": "side_over_20"},
        "toyota_land_cruiser": {"windshield": "windshield_over_40", "sides": "side_over_20", "rear": "side_over_20"},
        "nissan_frontier": {"windshield": "windshield_over_40", "sides": "side_over_20", "rear": "side_over_20"},
        "isuzu_dmax": {"windshield": "windshield_over_40", "sides": "side_over_20", "rear": "side_over_20"},
        "mitsubishi_l200": {"windshield": "windshield_over_40", "sides": "side_over_20", "rear": "side_over_20"},
        "honda_crv": {"windshield": "windshield_under_40", "sides": "side_over_20", "rear": "side_over_20"},
        "toyota_rav4": {"windshield": "windshield_under_40", "sides": "side_over_20", "rear": "side_over_20"},
    },
    "materials": [
        {
            "id": "std_20",
            "name": "Estándar 20%",
            "family": "Estándar",
            "vlt": 20,
            "is_active": True,
            "price_by_zone_group": {"windshield": 0.0, "sides": 0.0, "rear": 0.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-STD-20-W40", "virtual_qty": 50, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-STD-20-W60", "virtual_qty": 40, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-STD-20-S20", "virtual_qty": 80, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-STD-20-S40", "virtual_qty": 60, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "std_35",
            "name": "Estándar 35%",
            "family": "Estándar",
            "vlt": 35,
            "is_active": True,
            "price_by_zone_group": {"windshield": 0.0, "sides": 0.0, "rear": 0.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-STD-35-W40", "virtual_qty": 50, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-STD-35-W60", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-STD-35-S20", "virtual_qty": 80, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-STD-35-S40", "virtual_qty": 50, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "std_70",
            "name": "Estándar 70% (Claro)",
            "family": "Estándar",
            "vlt": 70,
            "is_active": True,
            "price_by_zone_group": {"windshield": 0.0, "sides": 0.0, "rear": 0.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-STD-70-W40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-STD-70-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-STD-70-S20", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "carbon_20",
            "name": "Carbono 20%",
            "family": "Carbono",
            "vlt": 20,
            "is_active": True,
            "price_by_zone_group": {"windshield": 15.0, "sides": 25.0, "rear": 15.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-CRB-20-W40", "virtual_qty": 25, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-CRB-20-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-CRB-20-S20", "virtual_qty": 40, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-CRB-20-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "carbon_35",
            "name": "Carbono 35%",
            "family": "Carbono",
            "vlt": 35,
            "is_active": True,
            "price_by_zone_group": {"windshield": 15.0, "sides": 25.0, "rear": 15.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-CRB-35-W40", "virtual_qty": 25, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-CRB-35-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-CRB-35-S20", "virtual_qty": 40, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-CRB-35-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "nano_ceramic_20",
            "name": "Nano Cerámico 20%",
            "family": "Nano Cerámico",
            "vlt": 20,
            "is_active": True,
            "price_by_zone_group": {"windshield": 30.0, "sides": 50.0, "rear": 30.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-CER-20-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-CER-20-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-CER-20-S40", "virtual_qty": 35, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "nano_ceramic_35",
            "name": "Nano Cerámico 35%",
            "family": "Nano Cerámico",
            "vlt": 35,
            "is_active": True,
            "price_by_zone_group": {"windshield": 30.0, "sides": 50.0, "rear": 30.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-CER-35-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-CER-35-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-CER-35-S40", "virtual_qty": 35, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "nano_ceramic_70",
            "name": "Nano Cerámico 70% (Ultra Claro)",
            "family": "Nano Cerámico",
            "vlt": 70,
            "is_active": True,
            "price_by_zone_group": {"windshield": 35.0, "sides": 55.0, "rear": 35.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-CER-70-W40", "virtual_qty": 15, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-CER-70-W60", "virtual_qty": 15, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-CER-70-S40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
            },
        },
    ],
}


def resolve_vehicle_glass_bands(
    vehicle_doc: Optional[Dict[str, Any]],
    policy: Optional[Dict[str, Any]] = None,
) -> Dict[str, str]:
    """
    Determina las bandas de tamaño de cristal (size bands) para un vehículo.
    Orden de prioridad:
      1. Medidas reales en vehicle.glass o glass_*_height_in.
      2. Plantillas de marca/modelo en la política.
      3. Heurística por nombre/modelo/tipo.
      4. Modelos compactos forzados a estándar.
    """
    pol = policy or DEFAULT_TINT_WINDOW_MATERIALS_POLICY
    templates = pol.get("glass_templates", {})

    if not vehicle_doc or not isinstance(vehicle_doc, dict):
        return {
            "windshield": "windshield_under_40",
            "front_sides": "side_under_20",
            "rear_sides": "side_under_20",
            "rear": "side_under_20",
        }

    # 1. Medidas explícitas
    glass = vehicle_doc.get("glass") or {}
    w_height = float(
        glass.get("windshield_height_in")
        or vehicle_doc.get("glass_windshield_height_in")
        or 0
    )
    s_height = float(
        glass.get("side_height_in")
        or vehicle_doc.get("glass_side_height_in")
        or 0
    )
    r_height = float(
        glass.get("rear_height_in")
        or vehicle_doc.get("glass_rear_height_in")
        or s_height
    )

    if w_height > 0 or s_height > 0:
        return {
            "windshield": "windshield_over_40" if w_height > 40.0 else "windshield_under_40",
            "front_sides": "side_over_20" if s_height > 20.0 else "side_under_20",
            "rear_sides": "side_over_20" if s_height > 20.0 else "side_under_20",
            "rear": "side_over_20" if r_height > 20.0 else "side_under_20",
        }

    # 2. Plantilla marca/modelo
    brand = str(vehicle_doc.get("brand") or "").strip().lower().replace(" ", "_")
    model = str(vehicle_doc.get("model") or "").strip().lower().replace(" ", "_")
    template_key = f"{brand}_{model}"
    if template_key in templates:
        tpl = templates[template_key]
        return {
            "windshield": tpl.get("windshield", "windshield_under_40"),
            "front_sides": tpl.get("sides", "side_under_20"),
            "rear_sides": tpl.get("sides", "side_under_20"),
            "rear": tpl.get("rear", tpl.get("sides", "side_under_20")),
        }

    # 3. Modelos compactos conocidos -> Forzar bajo
    compacts = ["civic", "corolla", "yaris", "versa", "sentra", "swift", "rio", "accent", "spark", "march", "picanto"]
    if any(comp in model for comp in compacts):
        return {
            "windshield": "windshield_under_40",
            "front_sides": "side_under_20",
            "rear_sides": "side_under_20",
            "rear": "side_under_20",
        }

    # 4. Heurística por tipo / palabras clave
    v_type = str(vehicle_doc.get("type") or vehicle_doc.get("vehicle_type") or "").lower()
    full_name = f"{brand} {model} {v_type}".lower()

    is_tall_truck_or_suv = any(
        kw in full_name
        for kw in [
            "hilux", "land cruiser", "prado", "fortuner", "d-max", "dmax", "frontier",
            "navara", "l200", "bt-50", "bt50", "f-150", "f150", "silverado", "ram",
            "tundra", "tahoma", "tacoma", "4runner", "pickup", "pick-up", "camioneta",
            "van", "microbus", "hiace", "urvan"
        ]
    )

    if is_tall_truck_or_suv:
        return {
            "windshield": "windshield_over_40",
            "front_sides": "side_over_20",
            "rear_sides": "side_over_20",
            "rear": "side_over_20",
        }

    # SUV regular / Crossover
    is_suv = "suv" in v_type or "crossover" in v_type or any(kw in full_name for kw in ["cr-v", "crv", "rav4", "tucson", "sportage", "cx-5", "cx5"])
    if is_suv:
        return {
            "windshield": "windshield_under_40",
            "front_sides": "side_over_20",
            "rear_sides": "side_over_20",
            "rear": "side_over_20",
        }

    # Default sedán / estándar
    return {
        "windshield": "windshield_under_40",
        "front_sides": "side_under_20",
        "rear_sides": "side_under_20",
        "rear": "side_under_20",
    }


def get_available_materials_for_zone(
    zone: str,
    size_band: str,
    policy: Optional[Dict[str, Any]] = None,
    allow_override: bool = False,
) -> List[Dict[str, Any]]:
    """
    Retorna los materiales que tienen rollo disponible para una zona y banda de tamaño.
    Si allow_override es True, también incluye materiales que solo tienen rollo en talla superior.
    """
    pol = policy or DEFAULT_TINT_WINDOW_MATERIALS_POLICY
    materials = pol.get("materials", [])
    group = ZONE_TO_GROUP.get(zone, "sides")

    available = []
    for mat in materials:
        if not mat.get("is_active", True):
            continue

        rolls = mat.get("rolls", {})
        roll_info = rolls.get(size_band)

        # Si no tiene en talla exacta pero allow_override=True, buscar en talla superior
        override_used = False
        effective_band = size_band

        if not roll_info or not roll_info.get("is_available", True):
            if allow_override:
                if size_band == "windshield_under_40" and "windshield_over_40" in rolls:
                    roll_info = rolls.get("windshield_over_40")
                    effective_band = "windshield_over_40"
                    override_used = True
                elif size_band == "side_under_20" and "side_over_20" in rolls:
                    roll_info = rolls.get("side_over_20")
                    effective_band = "side_over_20"
                    override_used = True

        if roll_info and roll_info.get("is_available", True):
            price_extra = float((mat.get("price_by_zone_group") or {}).get(group, 0.0))
            available.append({
                "material_id": mat.get("id"),
                "name": mat.get("name"),
                "family": mat.get("family"),
                "vlt": mat.get("vlt"),
                "zone_group": group,
                "price_extra_usd": price_extra,
                "size_band": effective_band,
                "is_override": override_used,
                "sku": roll_info.get("sku"),
                "virtual_qty": roll_info.get("virtual_qty", 0),
            })

    return available


def validate_tint_window_plan(
    plan: Optional[Dict[str, Any]],
    vehicle_doc: Optional[Dict[str, Any]] = None,
    policy: Optional[Dict[str, Any]] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Valida un plan de polarizado por ventana.
    Reglas:
      1. Debe contener las 4 zonas de cristal.
      2. front_sides y rear_sides deben compartir el mismo material (sides).
      3. Máximo 3 materiales distintos por vehículo.
      4. Los materiales elegidos deben existir y estar activos.
    """
    if not plan or not isinstance(plan, dict):
        return False, "El plan de polarizado es requerido."

    windows = plan.get("windows") or {}
    for z in GLASS_ZONES:
        if z not in windows:
            return False, f"Falta configurar la zona de cristal '{z}' en el plan."

    # Validar que laterales compartan material
    front_mat = (windows.get("front_sides") or {}).get("material_id")
    rear_sides_mat = (windows.get("rear_sides") or {}).get("material_id")
    if front_mat and rear_sides_mat and front_mat != rear_sides_mat:
        return False, "Los laterales delanteros y traseros deben compartir el mismo material."

    # Validar máximo 3 materiales
    mat_ids = {
        (windows.get(z) or {}).get("material_id")
        for z in GLASS_ZONES
        if (windows.get(z) or {}).get("material_id")
    }
    if len(mat_ids) > 3:
        return False, "No se permiten más de 3 materiales distintos en el mismo vehículo."

    return True, None


def quote_tint_window_plan(
    plan: Optional[Dict[str, Any]],
    vehicle_doc: Optional[Dict[str, Any]] = None,
    policy: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Calcula el desglose de precios, recargo extra total (materials_extra) y consumo de rollos.
    El cargo por grupo de material (sides) se cobra una sola vez (no se duplica por los dos lados).
    """
    is_valid, err_msg = validate_tint_window_plan(plan, vehicle_doc, policy)
    if not is_valid:
        return {
            "valid": False,
            "error": err_msg,
            "materials_extra_total": 0.0,
            "price_breakdown": [],
            "rolls_consumed": [],
        }

    pol = policy or DEFAULT_TINT_WINDOW_MATERIALS_POLICY
    materials_map = {m["id"]: m for m in pol.get("materials", [])}
    bands = resolve_vehicle_glass_bands(vehicle_doc, pol)
    windows = plan.get("windows") or {}

    total_extra_usd = 0.0
    breakdown = []
    rolls_consumed = []
    charged_groups: Set[str] = set()

    for zone in GLASS_ZONES:
        win = windows.get(zone) or {}
        mat_id = win.get("material_id")
        if not mat_id or mat_id not in materials_map:
            continue

        mat = materials_map[mat_id]
        group = ZONE_TO_GROUP.get(zone, "sides")
        default_band = bands.get(zone, "side_under_20")
        is_override = bool(win.get("override_size_band"))
        effective_band = win.get("size_band") or default_band

        # Roll SKU y consumo
        rolls = mat.get("rolls", {})
        roll_info = rolls.get(effective_band) or {}
        rolls_consumed.append({
            "zone": zone,
            "group": group,
            "material_id": mat_id,
            "material_name": mat.get("name"),
            "sku": roll_info.get("sku"),
            "product_id": roll_info.get("product_id"),
            "size_band": effective_band,
            "is_override": is_override,
            "qty_consumed": float(roll_info.get("qty_per_job", 1.0)),
        })

        # Cobro por grupo (se cobra 1 vez por grupo)
        if group not in charged_groups:
            group_price = float((mat.get("price_by_zone_group") or {}).get(group, 0.0))
            total_extra_usd += group_price
            charged_groups.add(group)
            breakdown.append({
                "group": group,
                "group_label": "Parabrisas" if group == "windshield" else ("Laterales (Delanteros + Traseros)" if group == "sides" else "Trasero / Medallón"),
                "material_id": mat_id,
                "material_name": mat.get("name"),
                "price_extra_usd": group_price,
            })

    return {
        "valid": True,
        "error": None,
        "materials_extra_total": round(total_extra_usd, 2),
        "price_breakdown": breakdown,
        "rolls_consumed": rolls_consumed,
        "vehicle_size_bands": bands,
        "plan": plan,
    }


def merge_policy_for_role(
    existing_policy: Dict[str, Any],
    incoming_policy: Dict[str, Any],
    role: str,
) -> Dict[str, Any]:
    """
    Aplica permisos asimétricos al actualizar la política de polarizados:
      - Gerencia / Programador: Control total (precios, reglas, flags, disponibilidades, plantillas).
      - Coordinador de Polarizados: Solo puede actualizar disponibilidad de rollos y stock virtual.
        Los cambios de precio o flags se ignoran.
    """
    clean_role = str(role or "").lower()
    if clean_role in ["gerencia", "programador", "admin"]:
        return incoming_policy

    if clean_role in ["coordinador_polarizados", "supervisor"]:
        merged = dict(existing_policy)
        incoming_mats = {m["id"]: m for m in incoming_policy.get("materials", [])}
        updated_materials = []

        for exist_mat in existing_policy.get("materials", []):
            mat_id = exist_mat["id"]
            if mat_id in incoming_mats:
                inc_mat = incoming_mats[mat_id]
                new_mat = dict(exist_mat)
                # Solo actualizar disponibilidad y stock de rollos
                new_rolls = dict(exist_mat.get("rolls", {}))
                for b_key, inc_roll in (inc_mat.get("rolls") or {}).items():
                    if b_key in new_rolls:
                        new_rolls[b_key]["is_available"] = inc_roll.get("is_available", True)
                        if "virtual_qty" in inc_roll:
                            new_rolls[b_key]["virtual_qty"] = inc_roll.get("virtual_qty")
                new_mat["rolls"] = new_rolls
                new_mat["is_active"] = inc_mat.get("is_active", True)
                updated_materials.append(new_mat)
            else:
                updated_materials.append(exist_mat)

        merged["materials"] = updated_materials
        return merged

    return existing_policy
