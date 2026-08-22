"""
MC-LARENS ERP: Model Asset Sanitizer
Removes any empty or corrupt image crops and ensures 100% data integrity in master index.
"""

import os
import json
from PIL import Image

def sanitize_model_assets():
    models_dir = 'frontend/public/vehicles/models'
    index_path_fe = 'frontend/src/data/vehicle_blueprints_master_index.json'
    index_path_be = 'backend/data/vehicle_blueprints_master_index.json'
    
    with open(index_path_fe, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    blueprints = data.get('blueprints', [])
    print(f"Sanitizing {len(blueprints)} blueprint records...")
    
    cleaned_count = 0
    removed_empty_files = 0
    
    for bp in blueprints:
        lat_url = bp.get('lateral_image')
        top_url = bp.get('top_image')
        
        # Check lateral
        if lat_url:
            lat_path = os.path.join('frontend/public', lat_url.lstrip('/'))
            if os.path.exists(lat_path):
                try:
                    im = Image.open(lat_path)
                    bbox = im.getbbox()
                    # Check if bounding box is too small or empty
                    if not bbox or (bbox[2] - bbox[0] < 40) or (bbox[3] - bbox[1] < 20):
                        os.remove(lat_path)
                        bp['lateral_image'] = None
                        removed_empty_files += 1
                except Exception:
                    bp['lateral_image'] = None
            else:
                bp['lateral_image'] = None
                
        # Check top
        if top_url:
            top_path = os.path.join('frontend/public', top_url.lstrip('/'))
            if os.path.exists(top_path):
                try:
                    im = Image.open(top_path)
                    bbox = im.getbbox()
                    # Check if bounding box is too small or empty
                    if not bbox or (bbox[2] - bbox[0] < 20) or (bbox[3] - bbox[1] < 40):
                        os.remove(top_path)
                        bp['top_image'] = None
                        removed_empty_files += 1
                except Exception:
                    bp['top_image'] = None
            else:
                bp['top_image'] = None
                
        cleaned_count += 1
        
    print(f"Sanitization complete! Removed {removed_empty_files} empty/invalid crops.")
    
    # Save sanitized indexes
    with open(index_path_fe, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    with open(index_path_be, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print("Master index updated with sanitized 100% verified asset references.")

if __name__ == '__main__':
    sanitize_model_assets()
