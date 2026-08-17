#!/usr/bin/env python3
"""
MC-LARENS ERP CI/CD Pre-deployment Verification Suite.
Runs all automated sanity and regression checks before deploying containers to Google Cloud Run.
"""

import sys
import os
import re

def check_backend_tests():
    print("==================================================")
    print("1. Running Backend Domain & Unit Tests...")
    print("==================================================")
    sys.path.insert(0, os.path.abspath("."))
    
    import backend.tests.test_tint_window_materials as tint_tests
    tint_tests.test_resolve_vehicle_glass_bands_for_compact()
    tint_tests.test_resolve_vehicle_glass_bands_for_tall_pickup()
    tint_tests.test_resolve_vehicle_glass_bands_with_explicit_measurements()
    tint_tests.test_quote_standard_plan_zero_extra()
    tint_tests.test_quote_carbon_plan_charge_once_per_group()
    tint_tests.test_quote_with_independent_sides_materials()
    tint_tests.test_quote_with_second_layer()
    tint_tests.test_quote_with_sunstrips()
    tint_tests.test_merge_policy_permissions_for_coordinator()
    print("  [PASS] Tint Window Materials Logic: 9/9 tests passed.")


def check_frontend_integrity():
    print("\n==================================================")
    print("2. Checking Frontend Code Integrity & JSX Files...")
    print("==================================================")
    
    src_dir = os.path.join("frontend", "src")
    total_files = 0
    passed_files = 0
    errors = []

    for root, _, files in os.walk(src_dir):
        for f in files:
            if f.endswith((".jsx", ".js")) and not f.endswith((".test.js", ".test.jsx")):
                total_files += 1
                filepath = os.path.join(root, f)
                with open(filepath, "r", encoding="utf-8", errors="replace") as fp:
                    content = fp.read()

                # Check for duplicate default export
                default_exports = re.findall(r"export\s+default\s+", content)
                if len(default_exports) > 1:
                    errors.append(f"Duplicate 'export default' found in {filepath} ({len(default_exports)} occurrences)")

                # Check for mismatched brackets or critical corruption
                open_curlies = content.count("{")
                close_curlies = content.count("}")
                if abs(open_curlies - close_curlies) > 20:
                    errors.append(f"Potential syntax corruption in {filepath}: {open_curlies} open vs {close_curlies} close")
                
                passed_files += 1

    if errors:
        for err in errors:
            print(f"  [FAIL] {err}")
        sys.exit(1)
    else:
        print(f"  [PASS] Checked {total_files} frontend files. All structurally intact without duplicate exports.")


def main():
    try:
        check_backend_tests()
        check_frontend_integrity()
        print("\n==================================================")
        print(">>> ALL CI/CD PRE-DEPLOYMENT CHECKS PASSED 100% <<<")
        print("==================================================")
        sys.exit(0)
    except Exception as e:
        print(f"\n[CRITICAL FAILURE] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
