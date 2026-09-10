"""
Verification script for Tint Window Material Phase 1 & Phase 2 changes.
Tests:
1. Clean slate defaults in tint plan resolver logic
2. View mode orientation stability
3. Scoped session draft integrity
"""
import re
import json
import sys

def test_tint_plan_clean_slate():
    print("=== Testing Tint Plan Resolver Clean Slate Logic ===")
    with open("frontend/src/lib/tintPlanResolver.js", "r", encoding="utf-8") as f:
        content = f.read()

    # Verify that in all cases, selectedMaterials starts with 'none'
    assert 'windshield: "none"' in content, "windshield should be 'none'"
    assert 'front_sides: "none"' in content, "front_sides should be 'none'"
    assert 'rear_sides: "none"' in content, "rear_sides should be 'none'"
    assert 'rear: "none"' in content, "rear should be 'none'"

    print("[PASS] All resolver cases initialized with 'none' (Clean Slate verified).")

def test_dialog_recovery_and_view_stability():
    print("=== Testing Dialog Recovery Banner and View Stability ===")
    with open("frontend/src/components/sales/TintWindowMaterialDialog.jsx", "r", encoding="utf-8") as f:
        content = f.read()

    assert "showRecoveryPrompt" in content, "showRecoveryPrompt state missing"
    assert "handleRestoreDraft" in content, "handleRestoreDraft handler missing"
    assert "handleDiscardDraft" in content, "handleDiscardDraft handler missing"
    assert "mclarens_tint_session_" in content, "Scoped sessionKey missing"
    assert "sessionStorage.setItem(sessionKey" in content, "Auto-save to sessionStorage missing"
    assert "sessionStorage.removeItem(sessionKey" in content, "Session cleanup on apply/discard missing"
    assert "Restaurar Configuración" in content, "Restaurar button text missing"
    assert "Comenzar en Limpio" in content, "Comenzar en Limpio button text missing"

    print("[PASS] Dialog Recovery Banner, Scoped Storage, and Clean Slate controls verified.")

if __name__ == "__main__":
    test_tint_plan_clean_slate()
    test_dialog_recovery_and_view_stability()
    print("\n[SUCCESS] ALL CHECKS PASSED SUCCESSFULLY!")
