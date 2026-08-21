"""
MC-LARENS ERP: Batch Generator of High-Definition Model Blueprints (Lateral + Planta Top-Down)
Processes indexed blueprints and generates clean, transparent, 100% paired PNG assets.
"""

import os
import re
import json
import time
from scripts.blueprint_extractor_engine import extract_lateral_view, extract_top_down_view

def sanitize_slug(text: str) -> str:
    s = re.sub(r'[^a-zA-Z0-9_-]', '_', text.lower())
    s = re.sub(r'_+', '_', s).strip('_')
    return s or 'vehicle'

def process_all_model_blueprints():
    index_path = 'backend/data/vehicle_blueprints_master_index.json'
    if not os.path.exists(index_path):
        print(f"Error: {index_path} not found.")
        return
        
    with open(index_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    blueprints = data.get('blueprints', [])
    print(f"Loaded {len(blueprints)} blueprints from master index.")
    
    out_dir = 'frontend/public/vehicles/blueprints'
    os.makedirs(out_dir, exist_ok=True)
    
    generated_count = 0
    t0 = time.time()
    
    for bp in blueprints:
        raw_rel = bp.get('relative_raw_path')
        if not raw_rel:
            continue
            
        raw_full = os.path.join('backend/data', raw_rel)
        if not os.path.exists(raw_full):
            continue
            
        brand_slug = bp.get('brand_slug', 'other')
        file_id = bp.get('file_id', 1)
        model_name = bp.get('model_name', 'model')
        model_slug = sanitize_slug(model_name)
        
        brand_out_dir = os.path.join(out_dir, brand_slug)
        os.makedirs(brand_out_dir, exist_ok=True)
        
        lat_filename = f"{brand_slug}_{file_id}_{model_slug}_lateral.png"
        top_filename = f"{brand_slug}_{file_id}_{model_slug}_top.png"
        
        lat_dest = os.path.join(brand_out_dir, lat_filename)
        top_dest = os.path.join(brand_out_dir, top_filename)
        
        # Extract lateral and top-down
        try:
            lat_ok = extract_lateral_view(raw_full, lat_dest)
            top_ok = extract_top_down_view(raw_full, top_dest)
            
            if lat_ok and top_ok:
                bp['lateral_image'] = f"/vehicles/blueprints/{brand_slug}/{lat_filename}"
                bp['top_image'] = f"/vehicles/blueprints/{brand_slug}/{top_filename}"
                generated_count += 1
        except Exception as e:
            pass
            
        if generated_count > 0 and generated_count % 500 == 0:
            print(f"Generated {generated_count} paired model blueprints in {time.time()-t0:.1f}s...")
            
    print(f"\nFinished generating {generated_count} paired model blueprints across all brands in {time.time()-t0:.1f}s!")
    
    # Save updated master index with image paths
    backend_dest = 'backend/data/vehicle_blueprints_master_index.json'
    frontend_dest = 'frontend/src/data/vehicle_blueprints_master_index.json'
    
    with open(backend_dest, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    with open(frontend_dest, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Master index updated with asset URLs successfully!")

if __name__ == '__main__':
    process_all_model_blueprints()
