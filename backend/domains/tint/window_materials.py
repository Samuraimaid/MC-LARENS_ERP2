"""Tint window materials, size bands, vehicle glass heuristics, pricing, and quoting."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Tuple

# Zonas de cristal en el vehículo
GLASS_ZONES = ["windshield", "front_sides", "rear_sides", "rear"]

# Nombres descriptivos oficiales de las zonas de cristal
ZONE_LABELS = {
    "windshield": "Parabrisas delantero",
    "front_sides": "Ventanas Delanteras",
    "rear_sides": "Ventanas Traseras",
    "rear": "Parabrisas Trasero",
}

# Mapeo de zona a grupo de cobro/material base
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
    "side_under_20": {"name": "Ventanas/Trasero ≤ 20\"", "max_height_in": 20.0, "category": "sides"},
    "side_over_20": {"name": "Ventanas/Trasero > 20\"", "min_height_in": 20.0, "category": "sides"},
}

DEFAULT_TINT_WINDOW_MATERIALS_POLICY = {
    "require_plan_on_installed_sale": False,
    "max_materials_per_vehicle": 4,
    "default_link_sides": True,
    "sunstrip_pricing": {
        "top_windshield_strip_usd": 10.0,
        "bottom_windshield_strip_usd": 10.0,
        "top_rear_strip_usd": 10.0,
        "bottom_rear_strip_usd": 10.0,
    },
    "second_layer_policy": {
        "allow_second_layer": True,
    },
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
        # --- 1. SOLAR GARD SMOKE ---
        {
            "id": "std_05",
            "name": "Solar Gard Smoke 5% (HP)",
            "brand": "Solar Gard",
            "family": "Smoke",
            "vlt": 5,
            "ir_rejection_pct": 99,
            "uv_rejection_pct": 99,
            "tech_type": "HP High Performance",
            "description": "Máximo control térmico (99% IR) y total privacidad (Limo).",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 0.0, "sides": 0.0, "rear": 0.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-SMK-05-W40", "virtual_qty": 50, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-SMK-05-W60", "virtual_qty": 40, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-SMK-05-S20", "virtual_qty": 80, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-SMK-05-S40", "virtual_qty": 60, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "std_20",
            "name": "Solar Gard Smoke 20%",
            "brand": "Solar Gard",
            "family": "Smoke",
            "vlt": 20,
            "ir_rejection_pct": 40,
            "uv_rejection_pct": 99,
            "tech_type": "Tono Intermedio",
            "description": "Tonalidad intermedia más popular y versátil del mercado.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 0.0, "sides": 0.0, "rear": 0.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-SMK-20-W40", "virtual_qty": 50, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-SMK-20-W60", "virtual_qty": 40, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-SMK-20-S20", "virtual_qty": 80, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-SMK-20-S40", "virtual_qty": 60, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "std_35",
            "name": "Solar Gard NR Smoke Plus 35%",
            "brand": "Solar Gard",
            "family": "Smoke",
            "vlt": 35,
            "ir_rejection_pct": 20,
            "uv_rejection_pct": 99,
            "tech_type": "NR (Non-Reflective)",
            "description": "Claridad óptica superior (100% visibilidad nocturna o bajo lluvia).",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 0.0, "sides": 0.0, "rear": 0.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-SMK-35-W40", "virtual_qty": 50, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-SMK-35-W60", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-SMK-35-S20", "virtual_qty": 80, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-SMK-35-S40", "virtual_qty": 50, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "std_70",
            "name": "Solar Gard Smoke 70% (Claro)",
            "brand": "Solar Gard",
            "family": "Smoke",
            "vlt": 70,
            "ir_rejection_pct": 20,
            "uv_rejection_pct": 99,
            "tech_type": "Estándar Claro",
            "description": "Transparencia total para parabrisas delantero y visión nocturna.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 0.0, "sides": 0.0, "rear": 0.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-STD-70-W40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-STD-70-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-STD-70-S20", "virtual_qty": 40, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-STD-70-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
            },
        },

        # --- 2. SOLAR GARD NANO CERÁMICO SUPREME ---
        {
            "id": "sg_supreme_04",
            "name": "Solar Gard Supreme 4%",
            "brand": "Solar Gard",
            "family": "Nano Cerámico Supreme",
            "vlt": 4,
            "ir_rejection_pct": 90,
            "uv_rejection_pct": 99,
            "tech_type": "Nano Cerámico",
            "description": "Privacidad extrema y 90% rechazo infrarrojo. Tecnología multicapa.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 30.0, "sides": 50.0, "rear": 30.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-SUP-04-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-SUP-04-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-SUP-04-S20", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-SUP-04-S40", "virtual_qty": 35, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "sg_supreme_10",
            "name": "Solar Gard Supreme 10%",
            "brand": "Solar Gard",
            "family": "Nano Cerámico Supreme",
            "vlt": 10,
            "ir_rejection_pct": 90,
            "uv_rejection_pct": 99,
            "tech_type": "Nano Cerámico",
            "description": "Elegancia y confort con 90% IR. Control solar superior.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 30.0, "sides": 50.0, "rear": 30.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-SUP-10-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-SUP-10-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-SUP-10-S20", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-SUP-10-S40", "virtual_qty": 35, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "sg_supreme_14",
            "name": "Solar Gard Supreme 14%",
            "brand": "Solar Gard",
            "family": "Nano Cerámico Supreme",
            "vlt": 14,
            "ir_rejection_pct": 60,
            "uv_rejection_pct": 99,
            "tech_type": "Nano Cerámico",
            "description": "Gama media-oscura ideal para conducir con total confianza día y noche.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 30.0, "sides": 50.0, "rear": 30.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-CER-20-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-CER-20-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-CER-20-S20", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-CER-20-S40", "virtual_qty": 35, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "sg_supreme_15",
            "name": "Solar Gard Supreme 15%",
            "brand": "Solar Gard",
            "family": "Nano Cerámico Supreme",
            "vlt": 15,
            "ir_rejection_pct": 55,
            "uv_rejection_pct": 99,
            "tech_type": "Nano Cerámico",
            "description": "Claridad, confort y elegancia en un solo polarizado, perfecto para el día a día.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 25.0, "sides": 45.0, "rear": 25.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-SUP-15-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-SUP-15-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-SUP-15-S20", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-SUP-15-S40", "virtual_qty": 35, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "sg_supreme_16",
            "name": "Solar Gard Supreme 16% (HP)",
            "brand": "Solar Gard",
            "family": "Nano Cerámico Supreme",
            "vlt": 16,
            "ir_rejection_pct": 50,
            "uv_rejection_pct": 99,
            "tech_type": "HP High Performance",
            "description": "Confort total al conducir: claridad superior y estilo elegante sin excesos.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 25.0, "sides": 45.0, "rear": 25.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-SUP-16-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-SUP-16-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-SUP-16-S20", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-SUP-16-S40", "virtual_qty": 35, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "sg_supreme_22",
            "name": "Solar Gard Supreme 22%",
            "brand": "Solar Gard",
            "family": "Nano Cerámico Supreme",
            "vlt": 22,
            "ir_rejection_pct": 45,
            "uv_rejection_pct": 99,
            "tech_type": "Nano Cerámico",
            "description": "Gama media clara: visibilidad, confort y look ejecutivo.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 25.0, "sides": 45.0, "rear": 25.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-SUP-22-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-SUP-22-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-SUP-22-S20", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-SUP-22-S40", "virtual_qty": 35, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "sg_supreme_35",
            "name": "Solar Gard Supreme 35%",
            "brand": "Solar Gard",
            "family": "Nano Cerámico Supreme",
            "vlt": 35,
            "ir_rejection_pct": 40,
            "uv_rejection_pct": 99,
            "tech_type": "Nano Cerámico",
            "description": "Claridad total con protección solar y estética elegante sin oscurecer el vehículo.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 30.0, "sides": 50.0, "rear": 30.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-CER-35-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-CER-35-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-CER-35-S20", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-CER-35-S40", "virtual_qty": 35, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "sg_supreme_42",
            "name": "Solar Gard Supreme 42% (Ultra Claro)",
            "brand": "Solar Gard",
            "family": "Nano Cerámico Supreme",
            "vlt": 42,
            "ir_rejection_pct": 35,
            "uv_rejection_pct": 99,
            "tech_type": "Nano Cerámico",
            "description": "Acabado elegante casi imperceptible con protección solar y visión transparente.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 35.0, "sides": 55.0, "rear": 35.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-CER-70-W40", "virtual_qty": 15, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-CER-70-W60", "virtual_qty": 15, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-CER-70-S20", "virtual_qty": 25, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-CER-70-S40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
            },
        },

        # --- 3. SOLAR GARD CHARCOAL ---
        {
            "id": "sg_charcoal_06",
            "name": "Solar Gard Charcoal 6% (HP)",
            "brand": "Solar Gard",
            "family": "Charcoal",
            "vlt": 6,
            "ir_rejection_pct": 65,
            "uv_rejection_pct": 99,
            "tech_type": "HP Carbón",
            "description": "Ultra oscura: máxima privacidad, estética agresiva y cero interferencia electrónica.",
            "warranty_years": {"regular": 1, "original": 5},
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
            "id": "sg_charcoal_06_std",
            "name": "Solar Gard Charcoal 6% (Estándar)",
            "brand": "Solar Gard",
            "family": "Charcoal",
            "vlt": 6,
            "ir_rejection_pct": 65,
            "uv_rejection_pct": 99,
            "tech_type": "Estándar Carbón",
            "description": "Negro profundo resistente y estético para máxima privacidad sin metales.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 15.0, "sides": 25.0, "rear": 15.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-CRB-06-W40", "virtual_qty": 25, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-CRB-06-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-CRB-06-S20", "virtual_qty": 40, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-CRB-06-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "sg_charcoal_07",
            "name": "Solar Gard Charcoal 7% (HC)",
            "brand": "Solar Gard",
            "family": "Charcoal",
            "vlt": 7,
            "ir_rejection_pct": 60,
            "uv_rejection_pct": 99,
            "tech_type": "HC Hard Coated",
            "description": "Negro profundo resistente a rayaduras sin tecnología metalizada.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 15.0, "sides": 25.0, "rear": 15.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-CH-07-W40", "virtual_qty": 25, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-CH-07-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-CH-07-S20", "virtual_qty": 40, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-CH-07-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "sg_charcoal_20",
            "name": "Solar Gard Charcoal 20% (HC)",
            "brand": "Solar Gard",
            "family": "Charcoal",
            "vlt": 20,
            "ir_rejection_pct": 55,
            "uv_rejection_pct": 99,
            "tech_type": "HC Hard Coated",
            "description": "Balance ideal entre privacidad, visibilidad y estética para uso diario.",
            "warranty_years": {"regular": 1, "original": 5},
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
            "id": "sg_charcoal_35",
            "name": "Solar Gard Charcoal 35% (HC)",
            "brand": "Solar Gard",
            "family": "Charcoal",
            "vlt": 35,
            "ir_rejection_pct": 50,
            "uv_rejection_pct": 99,
            "tech_type": "HC Hard Coated",
            "description": "Tono claro con tecnología de carbón: visibilidad nocturna impecable y elegancia.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 15.0, "sides": 25.0, "rear": 15.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-CRB-35-W40", "virtual_qty": 25, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-CRB-35-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-CRB-35-S20", "virtual_qty": 40, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-CRB-35-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
            },
        },

        # --- 4. SOLAR GARD QUANTUM ORIGINAL ---
        {
            "id": "sg_quantum_orig_14",
            "name": "Solar Gard Quantum Original 14%",
            "brand": "Solar Gard",
            "family": "Quantum Original",
            "vlt": 14,
            "ir_rejection_pct": 70,
            "uv_rejection_pct": 99,
            "tech_type": "Metalizada Sputtered",
            "description": "Película 100% metalizada por pulverización catódica. Excelente rechazo de calor.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 35.0, "sides": 60.0, "rear": 35.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-QTO-14-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-QTO-14-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-QTO-14-S20", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-QTO-14-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "sg_quantum_orig_19",
            "name": "Solar Gard Quantum Original 19%",
            "brand": "Solar Gard",
            "family": "Quantum Original",
            "vlt": 19,
            "ir_rejection_pct": 80,
            "uv_rejection_pct": 99,
            "tech_type": "Metalizada Sputtered",
            "description": "Punto medio perfecto (80% IR): excelente privacidad de día sin comprometer visión nocturna.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 35.0, "sides": 60.0, "rear": 35.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-QTO-19-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-QTO-19-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-QTO-19-S20", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-QTO-19-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "sg_quantum_orig_28",
            "name": "Solar Gard Quantum Original 28% (HP)",
            "brand": "Solar Gard",
            "family": "Quantum Original",
            "vlt": 28,
            "ir_rejection_pct": 72,
            "uv_rejection_pct": 99,
            "tech_type": "HP High Performance",
            "description": "Tono claro y sutil: 72% IR sin oscurecer el auto. Máxima visibilidad.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 35.0, "sides": 60.0, "rear": 35.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-QTO-28-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-QTO-28-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-QTO-28-S20", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-QTO-28-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
            },
        },

        # --- 5. SOLAR GARD QUANTUM REGULAR ---
        {
            "id": "sg_quantum_reg_05",
            "name": "Solar Gard Quantum Regular 5%",
            "brand": "Solar Gard",
            "family": "Quantum Regular",
            "vlt": 5,
            "ir_rejection_pct": 90,
            "uv_rejection_pct": 99,
            "tech_type": "Metalizada Sputtered",
            "description": "Gama estándar sputtered (90% IR): grafito/carbón sutilmente reflectivo.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 30.0, "sides": 50.0, "rear": 30.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-QTR-05-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-QTR-05-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-QTR-05-S20", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-QTR-05-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "sg_quantum_reg_10",
            "name": "Solar Gard Quantum Regular 10%",
            "brand": "Solar Gard",
            "family": "Quantum Regular",
            "vlt": 10,
            "ir_rejection_pct": 72,
            "uv_rejection_pct": 99,
            "tech_type": "Metalizada Sputtered",
            "description": "Nitidez superior al polarizado convencional y alto rechazo térmico.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 30.0, "sides": 50.0, "rear": 30.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-QTR-10-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-QTR-10-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-QTR-10-S20", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-QTR-10-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "sg_quantum_reg_25",
            "name": "Solar Gard Quantum Regular 25%",
            "brand": "Solar Gard",
            "family": "Quantum Regular",
            "vlt": 25,
            "ir_rejection_pct": 64,
            "uv_rejection_pct": 99,
            "tech_type": "Metalizada Sputtered",
            "description": "Sin tintes: tono que jamás se degrada ni se torna morado con los años.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 30.0, "sides": 50.0, "rear": 30.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-QTR-25-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-QTR-25-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-QTR-25-S20", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-QTR-25-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
            },
        },

        # --- 6. SOLAR GARD CAMALEÓN ---
        {
            "id": "sg_camaleon_20",
            "name": "Solar Gard Camaleón 20%",
            "brand": "Solar Gard",
            "family": "Camaleón",
            "vlt": 20,
            "ir_rejection_pct": 88,
            "uv_rejection_pct": 99,
            "tech_type": "Multicapa Tornasol",
            "description": "Efecto tornasol dinámico de alta gama que cambia de color según la luz solar.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 40.0, "sides": 70.0, "rear": 40.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-CAM-20-W40", "virtual_qty": 15, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-CAM-20-W60", "virtual_qty": 15, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-CAM-20-S20", "virtual_qty": 25, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-CAM-20-S40", "virtual_qty": 25, "is_available": True, "qty_per_job": 1.0},
            },
        },

        # --- 7. SOLAR GARD TITANIUM ---
        {
            "id": "sg_titanium_26",
            "name": "Solar Gard Titanium 26%",
            "brand": "Solar Gard",
            "family": "Titanium",
            "vlt": 26,
            "ir_rejection_pct": 80,
            "uv_rejection_pct": 99,
            "tech_type": "Barrera Titanio",
            "description": "Blindaje térmico profesional basado en partículas de titanio al vacío.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 35.0, "sides": 60.0, "rear": 35.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-TIT-26-W40", "virtual_qty": 15, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-TIT-26-W60", "virtual_qty": 15, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-TIT-26-S20", "virtual_qty": 25, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-TIT-26-S40", "virtual_qty": 25, "is_available": True, "qty_per_job": 1.0},
            },
        },

        # --- 8. SOLAR GARD GALAXIE ---
        {
            "id": "sg_galaxie_12",
            "name": "Solar Gard Galaxie 12%",
            "brand": "Solar Gard",
            "family": "Galaxie",
            "vlt": 12,
            "ir_rejection_pct": 30,
            "uv_rejection_pct": 99,
            "tech_type": "Estándar Deportivo",
            "description": "Punto dulce deportivo: auto oscuro y deportivo a precio accesible.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 10.0, "sides": 20.0, "rear": 10.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-GLX-12-W40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-GLX-12-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-GLX-12-S20", "virtual_qty": 50, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-GLX-12-S40", "virtual_qty": 40, "is_available": True, "qty_per_job": 1.0},
            },
        },

        # --- 9. SOLAR GARD ENDEAVOR ---
        {
            "id": "sg_endeavor_05",
            "name": "Solar Gard Endeavor 5%",
            "brand": "Solar Gard",
            "family": "Endeavor",
            "vlt": 5,
            "ir_rejection_pct": 70,
            "uv_rejection_pct": 99,
            "tech_type": "Gama Intermedia-Alta",
            "description": "Privacidad absoluta, oscuridad profunda y rendimiento térmico sobresaliente.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 20.0, "sides": 35.0, "rear": 20.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-END-05-W40", "virtual_qty": 25, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-END-05-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-END-05-S20", "virtual_qty": 35, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-END-05-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "sg_endeavor_35",
            "name": "Solar Gard Endeavor 35%",
            "brand": "Solar Gard",
            "family": "Endeavor",
            "vlt": 35,
            "ir_rejection_pct": 60,
            "uv_rejection_pct": 99,
            "tech_type": "Gama Intermedia-Alta",
            "description": "Tono claro, sutil y elegante con visibilidad nocturna impecable.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 20.0, "sides": 35.0, "rear": 20.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-END-35-W40", "virtual_qty": 25, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-END-35-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-END-35-S20", "virtual_qty": 35, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-END-35-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
            },
        },

        # --- 10. SOLAR GARD ENDEAVOR SOLSTICE ---
        {
            "id": "sg_solstice_05",
            "name": "Endeavor Solstice 5%",
            "brand": "Solar Gard",
            "family": "Endeavor Solstice",
            "vlt": 5,
            "ir_rejection_pct": 72,
            "uv_rejection_pct": 99,
            "tech_type": "Híbrida Metalizada",
            "description": "Arquitectura híbrida metalizada para climas hostiles y sol directo de mediodía.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 25.0, "sides": 45.0, "rear": 25.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-SLS-05-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-SLS-05-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-SLS-05-S20", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-SLS-05-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
            },
        },
        {
            "id": "sg_solstice_35",
            "name": "Endeavor Solstice 35%",
            "brand": "Solar Gard",
            "family": "Endeavor Solstice",
            "vlt": 35,
            "ir_rejection_pct": 62,
            "uv_rejection_pct": 99,
            "tech_type": "Híbrida Metalizada",
            "description": "Conducción segura con partículas metálicas para reflejar el calor.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 25.0, "sides": 45.0, "rear": 25.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-SG-SLS-35-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-SG-SLS-35-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-SG-SLS-35-S20", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-SG-SLS-35-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
            },
        },

        # --- 11. 3M NANO ---
        {
            "id": "3m_nano_20",
            "name": "3M Nano HX5-2090 LSX 20%",
            "brand": "3M",
            "family": "3M Nano",
            "vlt": 20,
            "ir_rejection_pct": 62,
            "uv_rejection_pct": 99,
            "tech_type": "3M Nano Series",
            "description": "Look uniforme, deportivo y elegante: balance perfecto entre privacidad y seguridad.",
            "warranty_years": {"regular": 1, "original": 5},
            "is_active": True,
            "price_by_zone_group": {"windshield": 35.0, "sides": 55.0, "rear": 35.0},
            "rolls": {
                "windshield_under_40": {"sku": "ROLL-3M-LSX-20-W40", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "windshield_over_40": {"sku": "ROLL-3M-LSX-20-W60", "virtual_qty": 20, "is_available": True, "qty_per_job": 1.0},
                "side_under_20": {"sku": "ROLL-3M-LSX-20-S20", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
                "side_over_20": {"sku": "ROLL-3M-LSX-20-S40", "virtual_qty": 30, "is_available": True, "qty_per_job": 1.0},
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
            if rolls:
                # Usar cualquier rollo disponible del material
                for r_band, r_data in rolls.items():
                    if isinstance(r_data, dict) and r_data.get("is_available", True):
                        roll_info = r_data
                        effective_band = r_band
                        override_used = True
                        break
            if not roll_info:
                roll_info = {"sku": f"ROLL-{mat.get('id')}", "virtual_qty": 50, "is_available": True}
                override_used = True

        price_extra = float((mat.get("price_by_zone_group") or {}).get(group, 0.0))
        available.append({
            "material_id": mat.get("id"),
            "name": mat.get("name"),
            "brand": mat.get("brand", "Solar Gard"),
            "family": mat.get("family"),
            "vlt": mat.get("vlt"),
            "ir_rejection_pct": mat.get("ir_rejection_pct"),
            "uv_rejection_pct": mat.get("uv_rejection_pct", 99),
            "tech_type": mat.get("tech_type"),
            "description": mat.get("description"),
            "warranty_years": mat.get("warranty_years", {"regular": 1, "original": 5}),
            "zone_group": group,
            "price_extra_usd": price_extra,
            "size_band": effective_band,
            "is_override": override_used,
            "sku": roll_info.get("sku", f"ROLL-{mat.get('id')}"),
            "virtual_qty": roll_info.get("virtual_qty", 50),
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
      2. Los materiales elegidos (base, 2da capa o bandas) deben existir y estar activos.
      3. Máximo 4 materiales distintos por vehículo.
    """
    if not plan or not isinstance(plan, dict):
        return False, "El plan de polarizado es requerido."

    pol = policy or DEFAULT_TINT_WINDOW_MATERIALS_POLICY
    materials_map = {m["id"]: m for m in pol.get("materials", [])}

    windows = plan.get("windows") or {}
    for z in GLASS_ZONES:
        if z not in windows:
            return False, f"Falta configurar la zona de cristal '{ZONE_LABELS.get(z, z)}' en el plan."

    # Validar existencia de materiales base
    mat_ids = set()
    for z in GLASS_ZONES:
        win = windows.get(z) or {}
        mat_id = win.get("material_id")
        if mat_id:
            if mat_id not in materials_map:
                return False, f"El material '{mat_id}' asignado a {ZONE_LABELS.get(z, z)} no existe."
            mat_ids.add(mat_id)

        # Validar segunda capa si existe
        sec_layer = win.get("second_layer") or {}
        if sec_layer.get("enabled"):
            sec_mat_id = sec_layer.get("material_id")
            if not sec_mat_id or sec_mat_id not in materials_map:
                return False, f"El material de la 2da capa en {ZONE_LABELS.get(z, z)} no es válido."
            mat_ids.add(sec_mat_id)

    # Validar bandas si existen
    sunstrips = plan.get("sunstrips") or {}
    for strip_key, strip_data in sunstrips.items():
        if isinstance(strip_data, dict) and strip_data.get("enabled"):
            s_mat_id = strip_data.get("material_id")
            if s_mat_id and s_mat_id in materials_map:
                mat_ids.add(s_mat_id)

    max_materials = int(pol.get("max_materials_per_vehicle", 4))
    if len(mat_ids) > max_materials:
        return False, f"No se permiten más de {max_materials} materiales distintos en el mismo vehículo."

    return True, None


def quote_tint_window_plan(
    plan: Optional[Dict[str, Any]],
    vehicle_doc: Optional[Dict[str, Any]] = None,
    policy: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Calcula el desglose de precios, recargo extra total (materials_extra) y consumo de rollos.
    Soporta:
      - Laterales vinculados o independientes (con cobro proporcional 50%/50% si son distintos).
      - Segunda capa de material (Doble capa) con recargo por zona.
      - Bandas superiores e inferiores en parabrisas delantero y trasero.
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
    sunstrip_pricing = pol.get("sunstrip_pricing") or DEFAULT_TINT_WINDOW_MATERIALS_POLICY["sunstrip_pricing"]
    bands = resolve_vehicle_glass_bands(vehicle_doc, pol)
    windows = plan.get("windows") or {}
    sunstrips = plan.get("sunstrips") or {}

    total_extra_usd = 0.0
    breakdown = []
    rolls_consumed = []

    # 1. PARABRISAS DELANTERO (Windshield)
    win_w = windows.get("windshield") or {}
    mat_id_w = win_w.get("material_id")
    if mat_id_w and mat_id_w in materials_map:
        mat_w = materials_map[mat_id_w]
        band_w = win_w.get("size_band") or bands.get("windshield", "windshield_under_40")
        price_w = float((mat_w.get("price_by_zone_group") or {}).get("windshield", 0.0))
        total_extra_usd += price_w
        breakdown.append({
            "group": "windshield",
            "group_label": "Parabrisas delantero",
            "material_id": mat_id_w,
            "material_name": mat_w.get("name"),
            "price_extra_usd": price_w,
        })
        roll_info_w = (mat_w.get("rolls") or {}).get(band_w) or {}
        rolls_consumed.append({
            "zone": "windshield",
            "layer": 1,
            "group": "windshield",
            "material_id": mat_id_w,
            "material_name": mat_w.get("name"),
            "sku": roll_info_w.get("sku"),
            "product_id": roll_info_w.get("product_id"),
            "size_band": band_w,
            "is_override": bool(win_w.get("override_size_band")),
            "qty_consumed": float(roll_info_w.get("qty_per_job", 1.0)),
        })

    # 2. VENTANAS LATERALES (Delanteras y Traseras)
    win_fs = windows.get("front_sides") or {}
    win_rs = windows.get("rear_sides") or {}
    mat_id_fs = win_fs.get("material_id")
    mat_id_rs = win_rs.get("material_id")

    if mat_id_fs and mat_id_fs == mat_id_rs and mat_id_fs in materials_map:
        # Mismo material en todas las ventanas laterales
        mat_s = materials_map[mat_id_fs]
        price_s = float((mat_s.get("price_by_zone_group") or {}).get("sides", 0.0))
        total_extra_usd += price_s
        breakdown.append({
            "group": "sides",
            "group_label": "Ventanas Laterales (Delanteras + Traseras)",
            "material_id": mat_id_fs,
            "material_name": mat_s.get("name"),
            "price_extra_usd": price_s,
        })
        for z_name, win_obj in [("front_sides", win_fs), ("rear_sides", win_rs)]:
            b_s = win_obj.get("size_band") or bands.get(z_name, "side_under_20")
            r_info = (mat_s.get("rolls") or {}).get(b_s) or {}
            rolls_consumed.append({
                "zone": z_name,
                "layer": 1,
                "group": "sides",
                "material_id": mat_id_fs,
                "material_name": mat_s.get("name"),
                "sku": r_info.get("sku"),
                "product_id": r_info.get("product_id"),
                "size_band": b_s,
                "is_override": bool(win_obj.get("override_size_band")),
                "qty_consumed": float(r_info.get("qty_per_job", 1.0)),
            })
    else:
        # Materiales independientes en laterales
        if mat_id_fs and mat_id_fs in materials_map:
            mat_fs = materials_map[mat_id_fs]
            price_fs = float((mat_fs.get("price_by_zone_group") or {}).get("sides", 0.0)) * 0.5
            total_extra_usd += price_fs
            breakdown.append({
                "group": "front_sides",
                "group_label": "Ventanas Delanteras (50% laterales)",
                "material_id": mat_id_fs,
                "material_name": mat_fs.get("name"),
                "price_extra_usd": price_fs,
            })
            b_fs = win_fs.get("size_band") or bands.get("front_sides", "side_under_20")
            r_info_fs = (mat_fs.get("rolls") or {}).get(b_fs) or {}
            rolls_consumed.append({
                "zone": "front_sides",
                "layer": 1,
                "group": "sides",
                "material_id": mat_id_fs,
                "material_name": mat_fs.get("name"),
                "sku": r_info_fs.get("sku"),
                "product_id": r_info_fs.get("product_id"),
                "size_band": b_fs,
                "is_override": bool(win_fs.get("override_size_band")),
                "qty_consumed": float(r_info_fs.get("qty_per_job", 1.0)),
            })

        if mat_id_rs and mat_id_rs in materials_map:
            mat_rs = materials_map[mat_id_rs]
            price_rs = float((mat_rs.get("price_by_zone_group") or {}).get("sides", 0.0)) * 0.5
            total_extra_usd += price_rs
            breakdown.append({
                "group": "rear_sides",
                "group_label": "Ventanas Traseras (50% laterales)",
                "material_id": mat_id_rs,
                "material_name": mat_rs.get("name"),
                "price_extra_usd": price_rs,
            })
            b_rs = win_rs.get("size_band") or bands.get("rear_sides", "side_under_20")
            r_info_rs = (mat_rs.get("rolls") or {}).get(b_rs) or {}
            rolls_consumed.append({
                "zone": "rear_sides",
                "layer": 1,
                "group": "sides",
                "material_id": mat_id_rs,
                "material_name": mat_rs.get("name"),
                "sku": r_info_rs.get("sku"),
                "product_id": r_info_rs.get("product_id"),
                "size_band": b_rs,
                "is_override": bool(win_rs.get("override_size_band")),
                "qty_consumed": float(r_info_rs.get("qty_per_job", 1.0)),
            })

    # 3. PARABRISAS TRASERO / MEDALLÓN (Rear)
    win_r = windows.get("rear") or {}
    mat_id_r = win_r.get("material_id")
    if mat_id_r and mat_id_r in materials_map:
        mat_r = materials_map[mat_id_r]
        band_r = win_r.get("size_band") or bands.get("rear", "side_under_20")
        price_r = float((mat_r.get("price_by_zone_group") or {}).get("rear", 0.0))
        total_extra_usd += price_r
        breakdown.append({
            "group": "rear",
            "group_label": "Parabrisas Trasero",
            "material_id": mat_id_r,
            "material_name": mat_r.get("name"),
            "price_extra_usd": price_r,
        })
        roll_info_r = (mat_r.get("rolls") or {}).get(band_r) or {}
        rolls_consumed.append({
            "zone": "rear",
            "layer": 1,
            "group": "rear",
            "material_id": mat_id_r,
            "material_name": mat_r.get("name"),
            "sku": roll_info_r.get("sku"),
            "product_id": roll_info_r.get("product_id"),
            "size_band": band_r,
            "is_override": bool(win_r.get("override_size_band")),
            "qty_consumed": float(roll_info_r.get("qty_per_job", 1.0)),
        })

    # 4. SEGUNDA CAPA (Doble Capa)
    for zone in GLASS_ZONES:
        win_obj = windows.get(zone) or {}
        sec_layer = win_obj.get("second_layer") or {}
        if sec_layer.get("enabled"):
            sec_mat_id = sec_layer.get("material_id")
            if sec_mat_id and sec_mat_id in materials_map:
                sec_mat = materials_map[sec_mat_id]
                group = ZONE_TO_GROUP.get(zone, "sides")
                base_group_price = float((sec_mat.get("price_by_zone_group") or {}).get(group, 0.0))

                # Precio de 2da capa: si es laterales individuales, cobra 50%
                sec_price = base_group_price * 0.5 if (zone in ["front_sides", "rear_sides"]) else base_group_price
                total_extra_usd += sec_price
                z_label = ZONE_LABELS.get(zone, zone)
                breakdown.append({
                    "group": f"second_layer_{zone}",
                    "group_label": f"2da Capa - {z_label}",
                    "material_id": sec_mat_id,
                    "material_name": sec_mat.get("name"),
                    "price_extra_usd": sec_price,
                })

                band = sec_layer.get("size_band") or bands.get(zone, "side_under_20")
                r_info_sec = (sec_mat.get("rolls") or {}).get(band) or {}
                rolls_consumed.append({
                    "zone": zone,
                    "layer": 2,
                    "group": group,
                    "material_id": sec_mat_id,
                    "material_name": sec_mat.get("name"),
                    "sku": r_info_sec.get("sku"),
                    "product_id": r_info_sec.get("product_id"),
                    "size_band": band,
                    "is_override": False,
                    "qty_consumed": float(r_info_sec.get("qty_per_job", 1.0)),
                })

    # 5. BANDAS SUPERIORES / INFERIORES (Sunstrips)
    strip_definitions = [
        ("windshield_top", "top_windshield_strip_usd", "Banda Superior - Parabrisas delantero", "windshield"),
        ("windshield_bottom", "bottom_windshield_strip_usd", "Banda Inferior - Parabrisas delantero", "windshield"),
        ("rear_top", "top_rear_strip_usd", "Banda Superior - Parabrisas Trasero", "rear"),
        ("rear_bottom", "bottom_rear_strip_usd", "Banda Inferior - Parabrisas Trasero", "rear"),
    ]

    for strip_key, price_key, label, z_target in strip_definitions:
        strip_obj = sunstrips.get(strip_key) or {}
        if strip_obj.get("enabled"):
            strip_cost = float(sunstrip_pricing.get(price_key, 10.0))
            strip_mat_id = strip_obj.get("material_id")
            strip_mat_name = "Banda de Sol"
            if strip_mat_id and strip_mat_id in materials_map:
                strip_mat_name = materials_map[strip_mat_id].get("name", "Banda de Sol")

            total_extra_usd += strip_cost
            breakdown.append({
                "group": f"sunstrip_{strip_key}",
                "group_label": label,
                "material_id": strip_mat_id or "sunstrip",
                "material_name": strip_mat_name,
                "price_extra_usd": strip_cost,
            })

            # Roll info para sunstrip si hay material seleccionado
            if strip_mat_id and strip_mat_id in materials_map:
                s_mat = materials_map[strip_mat_id]
                s_band = "windshield_under_40" if z_target == "windshield" else "side_under_20"
                s_roll = (s_mat.get("rolls") or {}).get(s_band) or {}
                rolls_consumed.append({
                    "zone": f"sunstrip_{strip_key}",
                    "layer": "sunstrip",
                    "group": z_target,
                    "material_id": strip_mat_id,
                    "material_name": s_mat.get("name"),
                    "sku": s_roll.get("sku"),
                    "product_id": s_roll.get("product_id"),
                    "size_band": s_band,
                    "is_override": False,
                    "qty_consumed": 0.25,  # Un cuarto de rollo estimado por visera
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
