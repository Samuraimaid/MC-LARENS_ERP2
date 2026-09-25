"""Unit tests for tint window materials domain logic."""

try:
    import pytest
except ImportError:
    pytest = None
from backend.domains.tint.window_materials import (
    resolve_vehicle_glass_bands,
    get_available_materials_for_zone,
    validate_tint_window_plan,
    quote_tint_window_plan,
    merge_policy_for_role,
    resolve_body_surcharge_multiplier,
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


def test_quote_tinmax_sedan_reference_extra():
    """Tinmax full-car sedán reference: 15+25+15 = 55."""
    plan = {
        "vehicle_category": "sedan",
        "windows": {
            "windshield": {"material_id": "std_20"},
            "front_sides": {"material_id": "std_20"},
            "rear_sides": {"material_id": "std_20"},
            "rear": {"material_id": "std_20"},
        },
    }
    quote = quote_tint_window_plan(plan)
    assert quote["valid"] is True
    assert quote["materials_extra_total"] == 55.0
    assert quote["body_class"] == "sedan"
    assert quote["body_surcharge_multiplier"] == 1.0


def test_quote_premium_sedan_extra():
    """Premium full-car sedán: 50+80+50 = 180."""
    plan = {
        "vehicle_category": "sedan",
        "windows": {
            "windshield": {"material_id": "sg_quantum_orig_19"},
            "front_sides": {"material_id": "sg_quantum_orig_19"},
            "rear_sides": {"material_id": "sg_quantum_orig_19"},
            "rear": {"material_id": "sg_quantum_orig_19"},
        },
    }
    quote = quote_tint_window_plan(plan)
    assert quote["valid"] is True
    assert quote["materials_extra_total"] == 180.0


def test_quote_tinmax_suv_scales_by_body_multiplier():
    """SUV multiplier 1.35 → Tinmax 55 * 1.35 = 74.25."""
    plan = {
        "vehicle_category": "suv",
        "windows": {
            "windshield": {"material_id": "std_20"},
            "front_sides": {"material_id": "std_20"},
            "rear_sides": {"material_id": "std_20"},
            "rear": {"material_id": "std_20"},
        },
    }
    quote = quote_tint_window_plan(plan)
    assert quote["valid"] is True
    assert quote["body_class"] == "suv"
    assert quote["body_surcharge_multiplier"] == 1.35
    assert quote["materials_extra_total"] == 74.25


def test_quote_premium_van_highest_ladder():
    """Van multiplier 1.65 → Premium 180 * 1.65 = 297.0."""
    plan = {
        "vehicle_category": "microbus_pasajeros",
        "windows": {
            "windshield": {"material_id": "sg_quantum_orig_19"},
            "front_sides": {"material_id": "sg_quantum_orig_19"},
            "rear_sides": {"material_id": "sg_quantum_orig_19"},
            "rear": {"material_id": "sg_quantum_orig_19"},
        },
    }
    quote = quote_tint_window_plan(plan)
    assert quote["valid"] is True
    assert quote["body_class"] == "van"
    assert quote["materials_extra_total"] == 297.0


def test_quote_with_independent_sides_materials():
    plan = {
        "vehicle_category": "sedan",
        "windows": {
            "windshield": {"material_id": "std_20"},
            "front_sides": {"material_id": "std_20"},  # sides 25 * 0.5 = 12.5
            "rear_sides": {"material_id": "sg_quantum_orig_19"},  # sides 80 * 0.5 = 40
            "rear": {"material_id": "std_20"},
        },
    }
    quote = quote_tint_window_plan(plan)
    assert quote["valid"] is True
    # windshield 15 + front 12.5 + rear_sides 40 + rear 15 = 82.5
    assert quote["materials_extra_total"] == 82.5


def test_quote_with_second_layer():
    plan = {
        "vehicle_category": "sedan",
        "windows": {
            "windshield": {
                "material_id": "std_70",  # tinmax windshield 15
                "second_layer": {"enabled": True, "material_id": "sg_quantum_orig_19"},  # +50
            },
            "front_sides": {"material_id": "std_20"},
            "rear_sides": {"material_id": "std_20"},
            "rear": {"material_id": "std_20"},
        },
    }
    quote = quote_tint_window_plan(plan)
    assert quote["valid"] is True
    # full tinmax 55 + second layer premium windshield 50 = 105
    assert quote["materials_extra_total"] == 105.0
    sec_layer_breakdown = [b for b in quote["price_breakdown"] if "2da Capa" in b["group_label"]]
    assert len(sec_layer_breakdown) == 1
    assert sec_layer_breakdown[0]["price_extra_usd"] == 50.0


def test_quote_with_sunstrips_not_scaled_by_body():
    plan = {
        "vehicle_category": "suv",  # mult 1.35 — sunstrips stay flat
        "windows": {
            "windshield": {"material_id": "q1_05_40"},
            "front_sides": {"material_id": "q1_05_40"},
            "rear_sides": {"material_id": "q1_05_40"},
            "rear": {"material_id": "q1_05_40"},
        },
        "sunstrips": {
            "windshield_top": {"enabled": True, "material_id": "std_20"},
            "rear_top": {"enabled": True, "material_id": "std_20"},
        },
    }
    quote = quote_tint_window_plan(plan)
    assert quote["valid"] is True
    # económica extras 0 + 10 + 10 = 20 (sunstrips unscaled)
    assert quote["materials_extra_total"] == 20.0


def test_resolve_body_multiplier_defaults_to_sedan():
    body, mult = resolve_body_surcharge_multiplier({}, None, None)
    assert body == "sedan"
    assert mult == 1.0


def test_validate_max_materials_exceeded():
    plan = {
        "windows": {
            "windshield": {"material_id": "std_70"},
            "front_sides": {"material_id": "std_20"},
            "rear_sides": {"material_id": "sg_quantum_orig_19"},
            "rear": {"material_id": "sg_endeavor_05"},
        },
        "sunstrips": {
            "windshield_top": {"enabled": True, "material_id": "q1_05_40"},
        },
    }
    is_valid, err = validate_tint_window_plan(plan)
    assert is_valid is False
    assert "No se permiten más de 4 materiales distintos" in err
