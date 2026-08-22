"""
MC-LARENS ERP: Enhanced Blueprint Matching Logic
"""

import json
import re

with open(r'c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\data\vehicle_blueprints_master_index.json', 'r', encoding='utf-8') as f:
    bp_data = json.load(f)
blueprints = bp_data.get('blueprints', [])

TRIM_AND_STOP_WORDS = {
    'de', 'del', 'la', 'el', 'los', 'las', 'cabina', 'doble', 'sencilla', 'media', 
    '4x4', '4x2', 'ano', 'año', 'presente', 'present', 'van', 'pickup', 'pick-up', 
    'auto', 'm/t', 'a/t', 'gasolina', 'diesel', 'hybrid', 'hibrido', 'híbrido', 
    'electric', 'electrico', 'eléctrico', 'turbo', 'intercooler', 'v6', 'v8', 
    'touring', 'limited', 'sport', 'sportage', 'executive', 'premium', 'edition',
    'special', 'custom', 'standard', 'classic', 'plus', 'pro', 'cross', 'active',
    'comfort', 'elegance', 'luxury', 'line', 'package', 'pack', 'crew', 'regular',
    'king', 'single', 'super', 'extended', 'club', 'ute', 'truck', 'car'
}

def clean_tokens(text):
    # Remove bracketed text [2015-Present], engine sizes 2.5L, codes QR25DE, [G]
    cleaned = re.sub(r'\[.*?\]|\(.*?\)', ' ', text)
    cleaned = re.sub(r'\b\d+\.\d+L?\b|\b[A-Z0-9]{4,8}\b', ' ', cleaned)
    tokens = re.split(r'[\s\-_/]+', cleaned.lower())
    # Keep specific model acronyms even if short (cr-v, rav4, cx-5, d-max, etc.)
    primary_tokens = []
    secondary_tokens = []
    for t in tokens:
        if len(t) < 2:
            continue
        if t in TRIM_AND_STOP_WORDS:
            secondary_tokens.append(t)
        else:
            primary_tokens.append(t)
    return primary_tokens, secondary_tokens

def match_blueprint(brand_str, model_str, year_val):
    norm_brand = re.sub(r'[^a-z0-9]', '', brand_str.lower())
    brand_matches = [b for b in blueprints if re.sub(r'[^a-z0-9]', '', b.get('brand_slug', '')) == norm_brand]
    if not brand_matches:
        return None
        
    primary_tokens, secondary_tokens = clean_tokens(model_str)
    if not primary_tokens and not secondary_tokens:
        return None
        
    year = int(year_val) if year_val and str(year_val).isdigit() else None
    
    best_match = None
    best_score = 0
    
    for b in brand_matches:
        b_model = (b.get('model_name') or '').lower()
        b_raw = (b.get('raw_header_text') or '').lower()
        
        model_score = 0
        # Primary model tokens are worth 100 points
        for t in primary_tokens:
            if t == b_model or f' {t} ' in f' {b_model} ':
                model_score += 120
            elif t in b_model:
                model_score += 80
            elif t in b_raw:
                model_score += 40
                
        # Secondary trim tokens are only worth 10 points
        for t in secondary_tokens:
            if t in b_model:
                model_score += 10
                
        # REQUIRE at least one primary token match if primary tokens exist!
        if primary_tokens and model_score < 40:
            continue
            
        year_score = 0
        if year and b.get('year_start'):
            if year >= b['year_start'] and (not b.get('year_end') or year <= b.get('year_end')):
                year_score = 25
            elif abs(year - b['year_start']) <= 3:
                year_score = 15
            elif abs(year - b['year_start']) <= 6:
                year_score = 5
                
        total = model_score + year_score
        if total > best_score:
            best_score = total
            best_match = b
            
    return best_match

samples = [
    ("Nissan", "Frontier / Navara (D23) [2015-Present] - 2.5L QR25DE [G]", 2019),
    ("Toyota", "Hilux Revo Double Cab 2.8L (2018)", 2018),
    ("Toyota", "Corolla Cross 1.8L Hybrid (2022)", 2022),
    ("Toyota", "RAV4 2.5L Limited (2021)", 2021),
    ("Honda", "CR-V Touring 1.5T (2019)", 2019),
    ("Hyundai", "Tucson 2.0L CRDi (2020)", 2020),
    ("Kia", "Sportage 2.0L EX (2019)", 2019),
    ("Ford", "Ranger XLT Double Cab 3.2L (2017)", 2017),
    ("Chevrolet", "Colorado Z71 Crew Cab (2021)", 2021),
    ("Mitsubishi", "L200 Triton Sportero (2020)", 2020),
    ("Isuzu", "D-Max V-Cross 3.0L (2022)", 2022),
    ("Suzuki", "Jimny Sierra 1.5L (2021)", 2021),
    ("Mazda", "BT-50 Double Cab (2020)", 2020),
]

print("\n--- SAMPLE MATCH TEST ---")
for brand, model, yr in samples:
    res = match_blueprint(brand, model, yr)
    if res:
        print(f"[{brand}] {model[:40]}... -> MATCH: {res.get('model_name')} ({res.get('category')})")
    else:
        print(f"[{brand}] {model[:40]}... -> NO BLUEPRINT")
