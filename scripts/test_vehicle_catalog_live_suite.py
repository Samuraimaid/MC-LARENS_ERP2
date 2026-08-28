import json
import re
from pathlib import Path
from PIL import Image

def test_matching_suite():
    with open("frontend/src/data/official_vehicle_catalog.json", "r", encoding="utf-8") as f:
        catalog = json.load(f)

    models = catalog.get("models", [])
    print(f"=== TESTING VEHICLE BLUEPRINT LIVE RESOLUTION SUITE ({len(models)} models) ===\n")

    test_queries = [
        {"brand": "Toyota", "model": "Hilux Doble Cabina", "year": 2022},
        {"brand": "Toyota", "model": "Land Cruiser Prado", "year": 2021},
        {"brand": "Toyota", "model": "RAV4", "year": 2020},
        {"brand": "Nissan", "model": "Frontier Doble Cabina", "year": 2023},
        {"brand": "Nissan", "model": "Kicks", "year": 2021},
        {"brand": "Hyundai", "model": "Tucson", "year": 2022},
        {"brand": "Hyundai", "model": "Santa Fe", "year": 2021},
        {"brand": "Kia", "model": "Sportage", "year": 2022},
        {"brand": "Kia", "model": "Seltos", "year": 2021},
        {"brand": "Suzuki", "model": "Jimny", "year": 2020},
        {"brand": "Suzuki", "model": "Grand Vitara", "year": 2023},
        {"brand": "Honda", "model": "CR-V", "year": 2022},
        {"brand": "Honda", "model": "Civic", "year": 2021},
        {"brand": "Mitsubishi", "model": "L200 Doble Cabina", "year": 2021},
        {"brand": "Mitsubishi", "model": "Montero Sport", "year": 2022},
        {"brand": "Chevrolet", "model": "Colorado Doble Cabina", "year": 2022},
        {"brand": "Chevrolet", "model": "Tahoe", "year": 2021},
        {"brand": "Ford", "model": "Ranger Doble Cabina", "year": 2023},
        {"brand": "Ford", "model": "Explorer", "year": 2022},
        {"brand": "Isuzu", "model": "D-Max Doble Cabina", "year": 2021},
        {"brand": "Mazda", "model": "BT-50 Doble Cabina", "year": 2021},
        {"brand": "Volkswagen", "model": "Amarok 4x4", "year": 2020},
        {"brand": "Volkswagen", "model": "T-Cross", "year": 2021},
        {"brand": "Jeep", "model": "Wrangler Unlimited JL", "year": 2022},
        {"brand": "Chery", "model": "Tiggo 7 Pro", "year": 2022},
        {"brand": "Chery", "model": "Arrizo 5", "year": 2021},
        {"brand": "Changan", "model": "CS35 Plus", "year": 2021},
        {"brand": "Changan", "model": "Hunter 4x4", "year": 2022},
        {"brand": "Changan", "model": "UNI-T", "year": 2022},
        {"brand": "Great Wall", "model": "Poer 4x4", "year": 2021},
        {"brand": "Great Wall", "model": "Tank 300", "year": 2022},
        {"brand": "Geely", "model": "Coolray", "year": 2021},
        {"brand": "Geely", "model": "Emgrand", "year": 2022},
        {"brand": "Geely", "model": "Okavango", "year": 2022},
        {"brand": "Haval", "model": "H6 3ra Gen", "year": 2022},
        {"brand": "Haval", "model": "Jolion", "year": 2022},
        {"brand": "Haval", "model": "Dargo", "year": 2022},
        {"brand": "GAC", "model": "Emzoom", "year": 2023},
        {"brand": "GAC", "model": "GS8 7 Plazas", "year": 2022},
        {"brand": "JAC", "model": "T8 4x4", "year": 2021},
        {"brand": "JAC", "model": "T9", "year": 2023},
        {"brand": "JAC", "model": "JS4", "year": 2021},
        {"brand": "DFSK", "model": "Glory 500", "year": 2021},
        {"brand": "DFSK", "model": "C32 Doble Cabina", "year": 2020},
        {"brand": "BYD", "model": "F3", "year": 2018},
        {"brand": "BYD", "model": "S6", "year": 2015},
        {"brand": "Changhe", "model": "Panel Van", "year": 2019},
        {"brand": "Foton", "model": "Gratour Mini Truck", "year": 2020},
        {"brand": "Foton", "model": "TM2 Pro 2.5t", "year": 2021},
        {"brand": "BAIC", "model": "X35", "year": 2021},
        {"brand": "BAIC", "model": "BJ40 4x4", "year": 2021},
    ]

    matched_count = 0
    missing_files = []

    for q in test_queries:
        q_brand = q['brand'].lower().replace(" ", "")
        q_model = q['model'].lower()
        q_year = q['year']
        
        # Search model in catalog
        candidates = [m for m in models if m['brand_slug'].replace(" ", "").replace("_", "") == q_brand or q_brand in m['brand_slug']]
        
        best_match = None
        best_score = -1
        
        for c in candidates:
            c_name = c['model_name'].lower()
            c_slug = c['model_slug'].lower()
            score = 0
            
            # check token overlaps
            for tok in q_model.split():
                if tok in c_name or tok in c_slug:
                    score += 50
            if c['year_start'] <= q_year <= c['year_end']:
                score += 30
            if score > best_score:
                best_score = score
                best_match = c
                
        if best_match and best_score > 0:
            matched_count += 1
            lat_p = Path("frontend/public" + best_match['lateral_image']) if best_match['lateral_image'] else None
            top_p = Path("frontend/public" + best_match['top_image']) if best_match['top_image'] else None
            
            lat_ok = lat_p and lat_p.exists()
            top_ok = top_p and top_p.exists()
            
            status = "[OK]" if (lat_ok and top_ok) else "[PARTIAL]"
            if not lat_ok or not top_ok:
                missing_files.append((q, best_match, lat_ok, top_ok))
                
            print(f"{status} {q['brand']} {q['model']} ({q['year']}) -> {best_match['brand']} {best_match['model_name']} ({best_match['generation']})")
            print(f"       Lat: {best_match['lateral_image']} (exists: {lat_ok})")
            print(f"       Top: {best_match['top_image']} (exists: {top_ok})")
        else:
            print(f"[❌ NOT FOUND] {q['brand']} {q['model']} ({q['year']})")

    print(f"\nLive Test Results: {matched_count}/{len(test_queries)} queries resolved successfully ({(matched_count/len(test_queries))*100:.1f}%)")
    if missing_files:
        print(f"Missing files for {len(missing_files)} queries:")
        for m in missing_files:
            print(" -", m)

if __name__ == "__main__":
    test_matching_suite()
