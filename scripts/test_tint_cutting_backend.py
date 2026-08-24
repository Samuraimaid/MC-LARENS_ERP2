"""
Test unitario y funcional del módulo de Corte de Polarizados, Múltiplos de 0.5m y Rollos Activos.
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.domains.tint.cutting_orders import (
    round_to_cut_multiple,
    get_zone_cutting_specs,
    compute_order_cutting_plan,
)
from backend.domains.tint.thermal_cutting_voucher import (
    build_thermal_cutting_voucher_text_lines,
    build_thermal_cutting_voucher_escpos,
    build_thermal_cutting_voucher_html,
)

def test_multiples_of_half_meter():
    print("Testing 0.5m multiples rounding...")
    assert round_to_cut_multiple(0.1) == 0.50
    assert round_to_cut_multiple(0.5) == 0.50
    assert round_to_cut_multiple(0.51) == 1.00
    assert round_to_cut_multiple(1.25) == 1.50
    assert round_to_cut_multiple(1.70) == 2.00
    assert round_to_cut_multiple(2.00) == 2.00
    print("  [OK] Rounding to 0.5m multiples verified 100%.")

def test_cutting_plan_computation():
    print("Testing cutting plan computation...")
    sample_plan = {
        "link_sides": True,
        "windows": {
            "windshield": {"material_id": "sg_supreme_70", "material_name": "Supreme 70%"},
            "front_sides": {"material_id": "sg_charcoal_20", "material_name": "Charcoal 20%"},
            "rear_sides": {"material_id": "sg_charcoal_20", "material_name": "Charcoal 20%"},
            "rear": {"material_id": "sg_charcoal_05", "material_name": "Charcoal 5%", "empalme_2x20": False},
        },
        "sunstrips": {
            "windshield_top": {"enabled": True, "material_id": "std_05"}
        }
    }

    vehicle_info = {
        "brand": "Toyota",
        "model": "Hilux",
        "year": "2024",
        "plate": "P-982-123",
        "vehicle_type": "camioneta_doble_cabina"
    }

    result = compute_order_cutting_plan(sample_plan, vehicle_info)
    assert len(result["cuts"]) >= 4, f"Expected at least 4 cuts, got {len(result['cuts'])}"
    assert result["total_meters"] > 0
    # Every cut meters should be a multiple of 0.50
    for c in result["cuts"]:
        assert c["meters"] % 0.50 == 0.0, f"Cut {c['cut_id']} meters {c['meters']} is not multiple of 0.5m!"

    print(f"  [OK] Computed {result['cut_count']} cuts with total {result['total_meters']}m.")
    for r in result["roll_summary"]:
        print(f"    - {r['roll_width_label']} | {r['material_name']}: {r['total_meters']}m")

def test_thermal_voucher_generation():
    print("Testing thermal voucher formatting with croquis...")
    sample_order = {
        "cut_order_id": "CUT-849201",
        "invoice_number": "F-001284",
        "created_at": "2026-08-24T15:45:00Z",
        "customer_name": "Carlos Mendoza",
        "customer_phone": "7890-1234",
        "vehicle_info": {
            "brand": "Toyota",
            "model": "Hilux",
            "year": "2024",
            "plate": "P-982-123",
            "color": "Gris"
        },
        "assigned_technician_name": "Roberto Gómez",
        "cuts": [
            {
                "cut_id": "C01",
                "zone": "windshield",
                "zone_label": "Parabrisas Delantero",
                "material_name": "Supreme 70%",
                "roll_width_inches": 40,
                "meters": 1.50
            },
            {
                "cut_id": "C02",
                "zone": "front_sides",
                "zone_label": "Laterales Delanteros",
                "material_name": "Charcoal 20%",
                "roll_width_inches": 20,
                "meters": 1.00
            },
            {
                "cut_id": "C03",
                "zone": "rear_sides",
                "zone_label": "Laterales Traseros",
                "material_name": "Charcoal 5%",
                "roll_width_inches": 20,
                "meters": 1.00
            },
            {
                "cut_id": "C04",
                "zone": "rear",
                "zone_label": "Vidrio Trasero",
                "material_name": "Charcoal 5%",
                "roll_width_inches": 40,
                "meters": 1.50
            },
            {
                "cut_id": "C05",
                "zone": "windshield_top",
                "zone_label": "Banda Frontal",
                "material_name": "Estándar 5%",
                "roll_width_inches": 20,
                "meters": 0.50
            }
        ],
        "roll_summary": [
            {"roll_width_label": "Rollo 40\"", "material_name": "Supreme 70%", "total_meters": 1.50, "zones": ["Parabrisas"]},
            {"roll_width_label": "Rollo 20\"", "material_name": "Charcoal 20%", "total_meters": 1.00, "zones": ["Delanteros"]},
            {"roll_width_label": "Rollo 20\"", "material_name": "Charcoal 5%", "total_meters": 1.50, "zones": ["Traseros", "Banda"]},
            {"roll_width_label": "Rollo 40\"", "material_name": "Charcoal 5%", "total_meters": 1.50, "zones": ["Luneta"]},
        ],
        "total_meters": 5.50,
        "additional_meters_total": 0.0,
        "notes": "Sensor de lluvia sensible"
    }

    lines = build_thermal_cutting_voucher_text_lines(sample_order)
    assert any("CROQUIS" in l for l in lines)
    assert any("MC-LARENS" in l for l in lines)
    assert any("TOTAL METRAJE" in l for l in lines)

    escpos = build_thermal_cutting_voucher_escpos(sample_order)
    assert len(escpos) > 100
    assert escpos.startswith(b"\x1b@")

    html = build_thermal_cutting_voucher_html(sample_order)
    assert "CUT-849201" in html
    assert "Toyota Hilux" in html

    print("  [OK] Thermal voucher ESC/POS, text lines, and HTML generated successfully.")

if __name__ == "__main__":
    print("=" * 60)
    print("MC-LARENS ERP: TINT CUTTING DOMAIN VERIFICATION")
    print("=" * 60)
    test_multiples_of_half_meter()
    test_cutting_plan_computation()
    test_thermal_voucher_generation()
    print("=" * 60)
    print("ALL BACKEND CUTTING TESTS PASSED 100%!")
    print("=" * 60)
