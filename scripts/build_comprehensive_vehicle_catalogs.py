import os
import json
import re
from pathlib import Path
from PIL import Image

def is_clean_model_file(fn):
    # Ignore messy scraped numbers like "269_royota" or "583_amarok" or "10_raeton"
    parts = fn.split('_')
    if len(parts) > 1 and parts[1].isdigit():
        return False
    return True

def parse_filename(fn, brand):
    clean = fn.replace('.png', '').replace('.jpg', '')
    is_lat = '_lat' in clean
    is_top = '_top' in clean
    view = 'lateral' if is_lat else ('top' if is_top else 'other')
    
    base_no_view = clean.replace('_lat', '').replace('_top', '')
    
    # Extract years
    m_years = re.search(r'_(\d{4})_(\d{4}|present)', base_no_view)
    m_year = re.search(r'_(\d{4})', base_no_view)
    
    if m_years:
        y_start = int(m_years.group(1))
        y_end = 2026 if m_years.group(2) == 'present' else int(m_years.group(2))
        gen_str = f"{y_start}-Presente" if m_years.group(2) == 'present' else f"{y_start}-{y_end}"
        model_slug = base_no_view[:m_years.start()]
    elif m_year:
        y_start = int(m_year.group(1))
        y_end = y_start
        gen_str = f"{y_start}"
        model_slug = base_no_view[:m_year.start()]
    else:
        y_start, y_end = 2000, 2026
        gen_str = "2000-Presente"
        model_slug = base_no_view
        
    if model_slug.startswith(f"{brand}_"):
        model_slug = model_slug[len(brand)+1:]
        
    low = base_no_view.lower()
    
    # Body Type & Category Detection
    if any(k in low for k in ['doble_cab', 'double_cab', 'poer', 'wingle', 'hunter', 'amarok', 't8', 't9', 'frontier', 'hilux', 'l200', 'dmax', 'bt50', 'ranger', 'colorado', 'silverado', 'f150', 'gladiator', 'himla']):
        if any(k in low for k in ['single', 'sencilla', '1_cabina', '1cabina']):
            category = 'camioneta_1_cabina'
            body_type = 'Camioneta 1 Cabina (Single Cab)'
        elif any(k in low for k in ['media', 'extra_cab', 'king_cab', 'cabina_media', 'supercab']):
            category = 'camioneta_cabina_media'
            body_type = 'Camioneta Cabina y Media (Extra Cab)'
        else:
            category = 'camioneta_doble_cabina'
            body_type = 'Camioneta Doble Cabina 4x4'
    elif any(k in low for k in ['camion', 'truck', 'tm2', 'aumark', 'n90', '1042', 'x200', 'star_truck', 'dyna', 'canter', 'forward', 'elf', 'hd65', 'hd78', 'k2700', 'k3000']):
        category = 'camion_1_cabina'
        body_type = 'Camión Liviano / Plataforma'
    elif any(k in low for k in ['techo_alto', 'high_roof']):
        category = 'microbus_techo_alto'
        body_type = 'Microbús Techo Alto'
    elif any(k in low for k in ['panel', 'box', 'furgo', 'carga', 'c35', 'k05s', 'nv200']):
        category = 'microbus_carga'
        body_type = 'Microbús / Van Panel Carga'
    elif any(k in low for k in ['coaster', 'bus', 'county']):
        category = 'bus_mediano_coaster'
        body_type = 'Bus Mediano Pasajeros'
    elif any(k in low for k in ['hiace', 'urvan', 'h1', 'c37', 'm6_pro', 'm6', 'e8', 'minivan', 'carnival']):
        category = 'microbus_pasajeros'
        body_type = 'Minivan / Microbús Pasajeros'
    elif any(k in low for k in ['suv', 'crossover', 'cross', 'prado', 'land_cruiser', 'fortuner', '4runner', 'rav4', 'tucson', 'santa_fe', 'creta', 'sportage', 'sorento', 'seltos', 'sonet', 'kicks', 'xtrail', 'patrol', 'jimny', 'vitara', 'fronx', 'crv', 'hrv', 'pilot', 'montero', 'outlander', 'asx', 'tahoe', 'suburban', 'tracker', 'explorer', 'everest', 'escape', 'tcross', 'taigun', 'wrangler', 'cherokee', 'tiggo', 'cs35', 'cs15', 'cs55', 'cs75', 'x7', 'uni_t', 'uni_k', 'unit', 'unik', 'tank', 'coolray', 'cityray', 'starray', 'okavango', 'gx3', 'h6', 'jolion', 'dargo', 'h7', 'emzoom', 'gs8', 'gs4', 'emkoo', 's7', 'js2', 'js4', 'js6', 'glory', 's6', 'x35', 'x55', 'bj40']):
        category = 'suv'
        body_type = 'SUV / Crossover 4x4'
    elif any(k in low for k in ['hatchback', 'hb', 'picanto', 'i10', 'grand_i10', 'swift', 'alto', 'march', 'fit', 'yaris_hatchback', 'spark', 'f0', 'gol']):
        category = 'sedan'
        body_type = 'Hatchback / Subcompacto'
    else:
        category = 'sedan'
        body_type = 'Sedán'
        
    # Clean model name
    words = [w.capitalize() for w in model_slug.split('_') if w and not w.isdigit()]
    base_name = " ".join(words)
    
    return {
        'brand': brand.upper(),
        'brand_slug': brand.lower(),
        'model_slug': model_slug,
        'base_no_view': base_no_view,
        'model_name': base_name,
        'gen_str': gen_str,
        'year_start': y_start,
        'year_end': y_end,
        'category': category,
        'body_type': body_type,
        'view': view,
        'filename': fn
    }

def main():
    models_root = Path("frontend/public/vehicles/models")
    brand_dirs = sorted([d for d in models_root.iterdir() if d.is_dir()])
    
    official_models = []
    master_blueprints = {}
    
    print(f"Building Clean & Comprehensive Official Vehicle Catalogs from {len(brand_dirs)} brand directories...\n")
    
    for b_dir in brand_dirs:
        brand = b_dir.name.lower()
        all_files = [f.name for f in b_dir.glob("*.png")] + [f.name for f in b_dir.glob("*.jpg")]
        
        # Sort files so clean ones come first
        clean_files = [f for f in all_files if is_clean_model_file(f)]
        legacy_files = [f for f in all_files if not is_clean_model_file(f)]
        
        # Process clean files first
        grouped = {}
        for fn in (clean_files + legacy_files):
            meta = parse_filename(fn, brand)
            base = meta['base_no_view']
            if base not in grouped:
                grouped[base] = {'meta': meta, 'lat': None, 'top': None}
            if meta['view'] == 'lateral' and not grouped[base]['lat']:
                grouped[base]['lat'] = f"/vehicles/models/{brand}/{fn}"
            elif meta['view'] == 'top' and not grouped[base]['top']:
                grouped[base]['top'] = f"/vehicles/models/{brand}/{fn}"
                
        for base, data in grouped.items():
            meta = data['meta']
            lat_img = data['lat']
            top_img = data['top']
            
            # Prioritize models with both views
            model_id = f"{brand}_{base}"
            
            record = {
                'id': model_id,
                'brand': meta['brand'],
                'brand_slug': meta['brand_slug'],
                'model_name': meta['model_name'],
                'model_slug': meta['model_slug'],
                'generation': meta['gen_str'],
                'year_start': meta['year_start'],
                'year_end': meta['year_end'],
                'category': meta['category'],
                'body_type': meta['body_type'],
                'lateral_image': lat_img,
                'top_image': top_img,
                'is_clean': is_clean_model_file(meta['filename'])
            }
            
            official_models.append(record)
            master_blueprints[model_id] = record

    # Sort official models: clean models with complete pairs first!
    official_models.sort(key=lambda m: (
        0 if (m['is_clean'] and m['lateral_image'] and m['top_image']) else 
        (1 if m['is_clean'] else 2),
        m['brand'],
        m['model_name'],
        -m['year_start']
    ))

    print(f"Compiled {len(official_models)} total vehicle models across {len(brand_dirs)} brands.")
    
    # Save official_vehicle_catalog.json
    out_official = {
        "generated_at_utc": "2026-08-28T20:25:00Z",
        "total_models": len(official_models),
        "total_brands": len(brand_dirs),
        "models": official_models
    }
    with open("frontend/src/data/official_vehicle_catalog.json", "w", encoding="utf-8") as f:
        json.dump(out_official, f, indent=2, ensure_ascii=False)
    print("Saved frontend/src/data/official_vehicle_catalog.json")

    with open("frontend/src/data/vehicle_blueprints_master_index.json", "w", encoding="utf-8") as f:
        json.dump(master_blueprints, f, indent=2, ensure_ascii=False)
    print("Saved frontend/src/data/vehicle_blueprints_master_index.json")

    # Generate catalog entries for vehicleCatalog.json (using clean pairs)
    catalog_entries = []
    seen_descriptors = set()
    for m in official_models:
        desc_key = f"{m['brand']}::{m['model_name']} [{m['generation']}]"
        if desc_key in seen_descriptors:
            continue
        seen_descriptors.add(desc_key)
        
        entry = {
            "id": desc_key,
            "brand": m['brand'],
            "descriptor": f"{m['model_name']} [{m['generation']}]",
            "model": m['model_name'],
            "engine": "Estándar / Turbo",
            "fuel": "Gasolina / Diesel",
            "label": f"{m['model_name']} [{m['generation']}]",
            "vehicle_type_slug": m['category'],
            "vehicle_type_label": m['body_type'],
            "thumbnail_slug": m['category'],
            "lateral_image": m['lateral_image'],
            "top_image": m['top_image'],
            "year_start": m['year_start'],
            "year_end": m['year_end']
        }
        catalog_entries.append(entry)

    vc_data = {
        "generated_at_utc": "2026-08-28T20:25:00Z",
        "source_file": "comprehensive_official_models",
        "total_rows": len(catalog_entries),
        "total_brands": len(brand_dirs),
        "brands": sorted(list(set(m['brand'] for m in official_models))),
        "entries": catalog_entries,
        "vehicle_types_version": "2.5.0"
    }
    with open("frontend/src/data/vehicleCatalog.json", "w", encoding="utf-8") as f:
        json.dump(vc_data, f, indent=2, ensure_ascii=False)
    print(f"Saved frontend/src/data/vehicleCatalog.json ({len(catalog_entries)} entries)")

if __name__ == "__main__":
    main()
