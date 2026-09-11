#!/usr/bin/env python3
"""
Test Suite: Grok Catalogs, Multi-Image Renaming Standard, and Vehicle Compatibility
Verifies:
1. Integrity of all 6 catalog seeds (DLAA, Fernandez Sera, Meguiar's, Pioneer, DS18, Auxbeam).
2. Naming convention compliance: {SKU}_main.{ext} and {SKU}_add_{01..NN}.{ext}.
3. Vehicle compatibility schema and matching logic in DLAA catalog.
4. Multi-image schema structure and media metadata.
"""

import json
import os
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def test_seeds_exist_and_counts():
    seeds_dir = Path("backend/data/seeds")
    expected = {
        "dlaa_halogens_seed.json": 142,
        "fernandez_sera_seed.json": 201,
        "meguiars_seed.json": 210,
        "pioneer_seed.json": 157,
        "ds18_seed.json": 820,
        "auxbeam_seed.json": 194,
        "all_catalogs_unified_seed.json": 1724,
    }

    print("=== 1. VERIFYING SEED FILES AND COUNTS ===")
    for fname, count in expected.items():
        fpath = seeds_dir / fname
        assert fpath.exists(), f"Missing seed file: {fpath}"
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        assert len(data) == count, f"Count mismatch in {fname}: got {len(data)}, expected {count}"
        print(f"  ✔ {fname}: {len(data)} products verified.")

def test_image_naming_standard():
    seeds_dir = Path("backend/data/seeds")
    master_path = seeds_dir / "all_catalogs_unified_seed.json"
    
    print("\n=== 2. VERIFYING IMAGE NAMING CONVENTIONS ({SKU}_main / {SKU}_add_XX) ===")
    with open(master_path, "r", encoding="utf-8") as f:
        products = json.load(f)

    main_pattern = re.compile(r"^/uploads/products/([a-zA-Z0-9_-]+)_main\.(jpg|png|webp|gif)$")
    add_pattern = re.compile(r"^/uploads/products/([a-zA-Z0-9_-]+)_add_\d{2}\.(jpg|png|webp|gif)$")

    total_checked = 0
    total_additional = 0

    for p in products:
        sku = p.get("sku")
        image_url = p.get("image_url", "")
        images = p.get("images", [])
        media = p.get("media", [])

        assert len(images) > 0, f"Product {sku} has no images"
        assert image_url == images[0], f"Product {sku} image_url is not first in images array"

        # Check main image naming
        m_match = main_pattern.match(image_url)
        assert m_match, f"Main image {image_url} does not follow pattern {main_pattern.pattern}"

        # Check additional images
        for idx, add_img in enumerate(images[1:], 1):
            a_match = add_pattern.match(add_img)
            assert a_match, f"Additional image {add_img} (index {idx}) does not follow pattern {add_pattern.pattern}"
            total_additional += 1

        # Check media objects
        assert len(media) == len(images), f"Media objects count mismatch for {sku}"
        assert media[0]["type"] == "main" and media[0]["is_primary"] is True
        for m in media[1:]:
            assert m["type"] == "additional" and m["is_primary"] is False

        total_checked += 1

    print(f"  ✔ Verified {total_checked} products with {total_additional} additional images following exact standard!")

def test_dlaa_vehicle_compatibility():
    print("\n=== 3. VERIFYING DLAA VEHICLE COMPATIBILITY ===")
    seed_path = Path("backend/data/seeds/dlaa_halogens_seed.json")
    with open(seed_path, "r", encoding="utf-8") as f:
        dlaa_products = json.load(f)

    matched_count = 0
    universal_count = 0

    for p in dlaa_products:
        compat = p.get("compatibility", {})
        assert "brands" in compat
        assert "models" in compat
        assert "year_from" in compat
        assert "year_to" in compat

        if compat.get("is_universal") or len(compat["brands"]) == 0:
            universal_count += 1
        else:
            matched_count += 1
            assert len(compat["brands"]) > 0

    print(f"  ✔ DLAA Matched Vehicle Products: {matched_count}")
    print(f"  ✔ DLAA Universal Products:       {universal_count}")
    print(f"  ✔ Total DLAA Products:           {len(dlaa_products)}")
    assert matched_count >= 105, f"Expected at least 105 vehicle-matched DLAA products, got {matched_count}"

def test_compatibility_checker_algorithm():
    print("\n=== 4. TESTING COMPATIBILITY RESOLUTION ALGORITHM ===")
    
    # Mock product: DLAA TY879L for Toyota Hilux 2018-2022
    mock_product = {
        "name": "DLAA TY879L Toyota Hilux Fog Lamp",
        "compatibility": {
            "brands": ["TOYOTA"],
            "models": ["Hilux"],
            "year_from": 2018,
            "year_to": 2022,
            "erp_matches": [{"brand": "TOYOTA", "model": "Hilux", "descriptor": "Hilux [2018-2022]"}],
            "is_universal": False
        }
    }

    # Helper replicating server.py algorithm
    def check_compat(prod, veh):
        compat = prod.get("compatibility")
        if not compat or compat.get("is_universal"):
            return True, "Universal"
        v_brand = str(veh.get("brand") or "").strip().upper()
        v_model = str(veh.get("model") or "").strip().lower()
        v_year = int(veh.get("year", 0))

        if compat.get("brands") and v_brand not in [b.upper() for b in compat["brands"]]:
            return False, "Marca incompatible"

        if compat.get("models"):
            compat_models = [m.lower() for m in compat["models"]]
            if not any(cm in v_model or v_model in cm for cm in compat_models):
                return False, "Modelo incompatible"

        if compat.get("year_from") and v_year < compat["year_from"]:
            return False, "Año antiguo"
        if compat.get("year_to") and v_year > compat["year_to"]:
            return False, "Año reciente"

        return True, "Compatible"

    # Test compatible vehicle
    ok1, msg1 = check_compat(mock_product, {"brand": "Toyota", "model": "Hilux Revo", "year": 2020})
    assert ok1 is True, f"Failed for Toyota Hilux 2020: {msg1}"
    print("  ✔ Toyota Hilux 2020: Compatible")

    # Test year out of range
    ok2, msg2 = check_compat(mock_product, {"brand": "Toyota", "model": "Hilux", "year": 2015})
    assert ok2 is False and "Año antiguo" in msg2, f"Expected incompatible for 2015: {msg2}"
    print("  ✔ Toyota Hilux 2015: Correctly rejected (out of year range)")

    # Test different brand
    ok3, msg3 = check_compat(mock_product, {"brand": "Nissan", "model": "Frontier", "year": 2020})
    assert ok3 is False and "Marca incompatible" in msg3, f"Expected incompatible for Nissan: {msg3}"
    print("  ✔ Nissan Frontier 2020: Correctly rejected (brand mismatch)")

if __name__ == "__main__":
    test_seeds_exist_and_counts()
    test_image_naming_standard()
    test_dlaa_vehicle_compatibility()
    test_compatibility_checker_algorithm()
    print("\n==========================================")
    print("ALL 4 TEST SUITES PASSED PERFECTLY! (100%)")
    print("==========================================")
