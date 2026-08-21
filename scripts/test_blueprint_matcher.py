"""
MC-LARENS ERP: Vehicle Blueprint Matcher Test Suite
Tests exact brand/model/year lookup against the master engineering catalog.
"""

import json
import unicodedata
import re

def normalize_text(text: str) -> str:
    text = unicodedata.normalize('NFD', str(text or ''))
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn')
    return text.lower().strip()

def find_matching_vehicle_blueprint(vehicle, master_catalog):
    brand = normalize_text(vehicle.get('brand', ''))
    model = normalize_text(vehicle.get('model', '') or vehicle.get('descriptor', ''))
    year = int(vehicle.get('year', 0)) if str(vehicle.get('year', '')).isdigit() else None
    
    blueprints = master_catalog.get('blueprints', [])
    if not blueprints:
        return None
        
    norm_brand = re.sub(r'[^a-z0-9]', '', brand)
    brand_matches = [
        b for b in blueprints
        if re.sub(r'[^a-z0-9]', '', normalize_text(b.get('brand_slug', ''))) == norm_brand
        or norm_brand in re.sub(r'[^a-z0-9]', '', normalize_text(b.get('brand_slug', '')))
    ]
    
    if not brand_matches:
        return None
        
    ignore_tokens = {'de', 'del', 'la', 'el', 'los', 'las', 'cabina', 'doble', '4x4', '4x2', 'ano', 'año'}
    model_tokens = [
        t for t in re.split(r'[\s\-_/()\[\]]+', model)
        if len(t) >= 2 and t not in ignore_tokens
    ]
    
    best_match = None
    best_score = -1
    
    for b in brand_matches:
        score = 0
        b_model = normalize_text(b.get('model_name', ''))
        b_raw = normalize_text(b.get('raw_header_text', ''))
        
        for t in model_tokens:
            if t in b_model or t in b_raw:
                score += 10
                
        if year and b.get('year_start'):
            y_start = b.get('year_start')
            y_end = b.get('year_end') or y_start
            if y_start <= year <= y_end:
                score += 15
            elif abs(year - y_start) <= 3:
                score += 5
                
        if score > best_score and score >= 10:
            best_score = score
            best_match = b
            
    return best_match

def run_tests():
    with open('frontend/src/data/vehicle_blueprints_master_index.json', 'r', encoding='utf-8') as f:
        master_catalog = json.load(f)
        
    test_vehicles = [
        {'brand': 'NISSAN', 'model': 'FRONTIER', 'year': 2022},
        {'brand': 'NISSAN', 'model': 'SENTRA', 'year': 2020},
        {'brand': 'NISSAN', 'model': 'KICKS', 'year': 2021},
        {'brand': 'TOYOTA', 'model': 'HILUX DOBLE CABINA', 'year': 2024},
        {'brand': 'TOYOTA', 'model': 'LAND CRUISER PRADO', 'year': 2021},
        {'brand': 'TOYOTA', 'model': 'COROLLA', 'year': 2022},
        {'brand': 'KIA', 'model': 'SPORTAGE', 'year': 2020},
        {'brand': 'KIA', 'model': 'SORENTO', 'year': 2021},
        {'brand': 'KIA', 'model': 'RIO', 'year': 2019},
        {'brand': 'HYUNDAI', 'model': 'TUCSON', 'year': 2022},
        {'brand': 'HYUNDAI', 'model': 'SANTA FE', 'year': 2021},
        {'brand': 'HYUNDAI', 'model': 'CRETA', 'year': 2023},
        {'brand': 'FORD', 'model': 'RANGER', 'year': 2023},
        {'brand': 'FORD', 'model': 'F-150', 'year': 2021},
        {'brand': 'FORD', 'model': 'EXPLORER', 'year': 2020},
        {'brand': 'CHEVROLET', 'model': 'SILVERADO', 'year': 2022},
        {'brand': 'CHEVROLET', 'model': 'TRACKER', 'year': 2021},
        {'brand': 'ISUZU', 'model': 'D-MAX', 'year': 2022},
        {'brand': 'MITSUBISHI', 'model': 'L200', 'year': 2021},
        {'brand': 'MITSUBISHI', 'model': 'MONTERO SPORT', 'year': 2022},
        {'brand': 'MAZDA', 'model': 'CX-5', 'year': 2021},
        {'brand': 'MAZDA', 'model': 'BT-50', 'year': 2022},
        {'brand': 'HONDA', 'model': 'CR-V', 'year': 2022},
        {'brand': 'HONDA', 'model': 'CIVIC', 'year': 2021},
        {'brand': 'JEEP', 'model': 'WRANGLER', 'year': 2020},
        {'brand': 'JEEP', 'model': 'GRAND CHEROKEE', 'year': 2021},
        {'brand': 'VOLKSWAGEN', 'model': 'AMAROK', 'year': 2022},
        {'brand': 'VOLKSWAGEN', 'model': 'TIGUAN', 'year': 2021},
        {'brand': 'BMW', 'model': 'X5', 'year': 2022},
        {'brand': 'AUDI', 'model': 'Q7', 'year': 2021},
        {'brand': 'BYD', 'model': 'SONG PLUS', 'year': 2023},
        {'brand': 'CHANGAN', 'model': 'CS55', 'year': 2022},
        {'brand': 'GEELY', 'model': 'COOLRAY', 'year': 2022},
    ]
    
    print(f"Testing {len(test_vehicles)} vehicles against master blueprint catalog...\n")
    
    for v in test_vehicles:
        match = find_matching_vehicle_blueprint(v, master_catalog)
        if match:
            print(f"[MATCH] {v['brand']:12s} {v['model']:22s} ({v['year']}) -> {match.get('brand')} {match.get('model_name')} ({match.get('year_start')}) | Category: {match.get('category')}")
        else:
            print(f"[FALLBACK] {v['brand']:12s} {v['model']:22s} ({v['year']}) -> Canonical category fallback")

if __name__ == '__main__':
    bestScore = 0
    run_tests()
