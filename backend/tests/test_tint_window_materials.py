"""Unit tests for tint window materials domain logic."""

import pytest
from backend.domains.tint.window_materials import (
    resolve_vehicle_glass_bands,
    get_available_materials_for_zone,
    validate_tint_window_plan,
    quote_tint_window_plan,
    merge_policy_for_role,
    DEFAULT_TINT_WINDOW_MATERIALS_POLICY,
)


def test_resolve_vehicle_glass_bands_for_compact():
    vehicle = {"brand": "Toyota", "model": "Yaris", "type": "Sedán"}
    bands = resolve_vehicle_glass_bands(vehicle)
    assert bands["windshield"] == "windshield_under_40"
    assert bands["front_sides"] == "side_under_20"
    assert bands["rear"] == "side_under_20"


def test_resolve_vehicle_glass_bands_for_tall_pickup():
    vehicle = {"brand": "Toyota", "model": "Hilux", "type": "Camioneta 4x4"}
    bands = resolve_vehicle_glass_bands(vehicle)
    assert bands["windshield"] == "windshield_over_40"
    assert bands["front_sides"] == "side_over_20"
    assert bands["rear"] == "side_over_20"


def test_resolve_vehicle_glass_bands_with_explicit_measurements():
    vehicle = {
        "brand": "Custom",
        "model": "Mod",
        "glass": {"windshield_height_in": 45.0, "side_height_in": 18.0, "rear_height_in": 18.0},
    }
    bands = resolve_vehicle_glass_bands(vehicle)
    assert bands["windshield"] == "windshield_over_40"
    assert bands["front_sides"] == "side_under_20"


def test_quote_standard_plan_zero_extra():
    plan = {
        "windows": {
            "windshield": {"material_id": "std_20"},
            "front_sides": {"material_id": "std_20"},
            "rear_sides": {"material_id": "std_20"},
            "rear": {"material_id": "std_20"},
        }
    }
    quote = quote_tint_window_plan(plan)
    assert quote["valid"] is True
    assert quote["materials_extra_total"] == 0.0


def test_quote_carbon_plan_charge_once_per_group():
    plan = {
        "windows": {
            "windshield": {"material_id": "carbon_20"},
            "front_sides": {"material_id": "carbon_20"},
            "rear_sides": {"material_id": "carbon_20"},
            "rear": {"material_id": "carbon_20"},
        }
    }
    # windshield=15, sides=25 (charged once for front+rear), rear=15 -> total = 55
    quote = quote_tint_window_plan(plan)
    assert quote["valid"] is True
    assert quote["materials_extra_total"] == 55.0


def test_quote_with_independent_sides_materials():
    plan = {
        "windows": {
            "windshield": {"material_id": "std_20"},
            "front_sides": {"material_id": "std_20"},   # sides price = 0
            "rear_sides": {"material_id": "carbon_20"}, # sides price = 25 -> 50% = 12.50
            "rear": {"material_id": "std_20"},
        }
    }
    quote = quote_tint_window_plan(plan)
    assert quote["valid"] is True
    # front_sides (0*0.5) + rear_sides (25*0.5=12.5) = 12.50
    assert quote["materials_extra_total"] == 12.50


def test_quote_with_second_layer():
    plan = {
        "windows": {
            "windshield": {
                "material_id": "std_70",
                "second_layer": {"enabled": True, "material_id": "carbon_20"}, # +15
            },
            "front_sides": {"material_id": "std_20"},
            "rear_sides": {"material_id": "std_20"},
            "rear": {"material_id": "std_20"},
        }
    }
    quote = quote_tint_window_plan(plan)
    assert quote["valid"] is True
    assert quote["materials_extra_total"] == 15.0
    sec_layer_breakdown = [b for b in quote["price_breakdown"] if "2da Capa" in b["group_label"]]
    assert len(sec_layer_breakdown) == 1
    assert sec_layer_breakdown[0]["price_extra_usd"] == 15.0


def test_quote_with_sunstrips():
    plan = {
        "windows": {
            "windshield": {"material_id": "std_20"},
            "front_sides": {"material_id": "std_20"},
            "rear_sides": {"material_id": "std_20"},
            "rear": {"material_id": "std_20"},
        },
        "sunstrips": {
            "windshield_top": {"enabled": True, "material_id": "carbon_20"}, # +10
            "rear_top": {"enabled": True, "material_id": "carbon_20"},       # +10
        }
    }
    quote = quote_tint_window_plan(plan)
    assert quote["valid"] is True
    # Base 0 + 10 (top windshield) + 10 (top rear) = 20
    assert quote["materials_extra_total"] == 20.0
    assert len(quote["price_breakdown"]) == 2


def test_merge_policy_permissions_for_coordinator():
    existing = DEFAULT_TINT_WINDOW_MATERIALS_POLICY
    incoming = dict(existing)
    # Attempting to change prices as coordinator
    incoming["materials"] = [
        {
            "id": "carbon_20",
            "name": "Carbono 20%",
            "price_by_zone_group": {"windshield": 999.0},  # should be ignored
            "rolls": {"side_under_20": {"is_available": False, "virtual_qty": 5}},  # should be applied
        }
    ]
    merged = merge_policy_for_role(existing, incoming, role="coordinador_polarizados")
    carbon = next(m for m in merged["materials"] if m["id"] == "carbon_20")
    # Price was preserved
    assert carbon["price_by_zone_group"]["windshield"] == 15.0
    # Availability was updated
    assert carbon["rolls"]["side_under_20"]["is_available"] is False
    assert carbon["rolls"]["side_under_20"]["virtual_qty"] == 5
    assert carbon["rolls"]["side_under_20"]["is_available"] is False
