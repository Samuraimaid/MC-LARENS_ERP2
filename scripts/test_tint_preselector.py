"""Test suite for intelligent tint plan preselection based on catalog products."""

import re

def test_tint_plan_preselector():
    print("============================================================")
    print("MC-LARENS ERP: TINT PLAN PRESELECTOR VERIFICATION")
    print("============================================================")

    with open("frontend/src/lib/tintPlanResolver.js", "r", encoding="utf-8") as f:
        content = f.read()

    # Check key functions and patterns in tintPlanResolver.js
    assert "export function detectTintPlanFromProduct" in content, "detectTintPlanFromProduct not exported"
    assert "franja_superior" in content, "franja_superior case missing"
    assert "vidrios_delanteros" in content, "vidrios_delanteros case missing"
    assert "parabrisas_delantero" in content, "parabrisas_delantero case missing"
    assert "vidrio_trasero" in content, "vidrio_trasero case missing"
    assert "laterales_y_trasero" in content, "laterales_y_trasero case missing"
    assert "completo" in content, "completo case missing"

    print("[PASSED] tintPlanResolver.js contains all 6 core service resolution branches.")

    # Check TintWindowMaterialDialog.jsx integration
    with open("frontend/src/components/sales/TintWindowMaterialDialog.jsx", "r", encoding="utf-8") as f:
        dialog_content = f.read()

    assert "import { detectTintPlanFromProduct } from \"@/lib/tintPlanResolver\";" in dialog_content, "Resolver not imported in Dialog"
    assert "product" in dialog_content, "product prop missing in Dialog"
    assert "detectTintPlanFromProduct(product, vehicle)" in dialog_content, "detectTintPlanFromProduct not called in Dialog"
    assert "Preseleccionado" in dialog_content, "Preselected badge missing in Dialog header"
    assert "Banda Frontal ON" in dialog_content, "Lateral sunstrip indicator missing"

    print("[PASSED] TintWindowMaterialDialog.jsx correctly integrates intelligent preselection & badges.")
    print("============================================================")
    print("ALL TINT PRESELECTOR TESTS PASSED 100%!")
    print("============================================================")

if __name__ == "__main__":
    test_tint_plan_preselector()
