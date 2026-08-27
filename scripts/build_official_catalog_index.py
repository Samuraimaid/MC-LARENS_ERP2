import os
import json
import re

def parse_filename(fn, brand):
    # e.g. toyota_hilux_2021_2026_lat.png
    # e.g. toyota_hilux_extra_cab_2021_2026_lat.png
    # e.g. nissan_sentra_2020_2026_lat.png
    # e.g. toyota_land_cruiser_79_double_cab_lat.png
    
    clean = fn.replace('.png', '').replace('.jpg', '')
    is_lat = '_lat' in clean
    is_top = '_top' in clean
    view = 'lateral' if is_lat else ('top' if is_top else 'other')
    
    base_no_view = clean.replace('_lat', '').replace('_top', '')
    
    # Extract years
    m_years = re.search(r'_(\d{4})_(\d{4})', base_no_view)
    m_year = re.search(r'_(\d{4})', base_no_view)
    
    if m_years:
        y_start = int(m_years.group(1))
        y_end = int(m_years.group(2))
        gen_str = f"{y_start}-{y_end}"
        model_slug = base_no_view[:m_years.start()]
    elif m_year:
        y_start = int(m_year.group(1))
        y_end = y_start
        gen_str = f"{y_start}"
        model_slug = base_no_view[:m_year.start()]
    else:
        y_start, y_end = 2000, 2026
        gen_str = "2000-2026"
        model_slug = base_no_view
        
    if model_slug.startswith(f"{brand}_"):
        model_slug = model_slug[len(brand)+1:]
        
    low = base_no_view.lower()
    
    # Categorization
    if 'double_cab' in low or 'doble_cab' in low or ('hilux' in low and 'extra' not in low and 'single' not in low and 'surf' not in low) or ('frontier' in low and 'king' not in low and 'single' not in low):
        category = 'camioneta_doble_cabina'
        body_type = 'Camioneta Doble Cabina'
    elif 'extra_cab' in low or 'king_cab' in low or 'cabina_media' in low:
        category = 'camioneta_cabina_media'
        body_type = 'Camioneta Cabina y Media'
    elif 'single_cab' in low or 'cabina_sencilla' in low:
        category = 'camioneta_1_cabina'
        body_type = 'Camioneta 1 Cabina'
    elif 'cabstar' in low or 'dyna' in low:
        category = 'camion_1_cabina'
        body_type = 'Camión 1 Cabina'
    elif 'high_roof' in low or 'techo_alto' in low:
        category = 'microbus_techo_alto'
        body_type = 'Microbús Techo Alto'
    elif 'panel' in low or 'nv200' in low:
        category = 'microbus_carga'
        body_type = 'Microbús Panel Carga'
    elif 'coaster' in low:
        category = 'bus_mediano_coaster'
        body_type = 'Bus Mediano'
    elif 'hiace' in low or 'urvan' in low or 'nv350' in low:
        category = 'microbus_pasajeros'
        body_type = 'Microbús Pasajeros'
    elif 'prado' in low or 'land_cruiser' in low or 'fortuner' in low or '4runner' in low or 'rav4' in low or 'cross' in low or 'kicks' in low or 'qashqai' in low or 'xtrail' in low or 'pathfinder' in low or 'patrol' in low or 'terra' in low or 'murano' in low or 'juke' in low or 'magnite' in low or 'rush' in low or 'raize' in low:
        category = 'suv'
        body_type = 'SUV / 4x4'
    elif 'hatchback' in low or 'march' in low or 'yaris_hatchback' in low:
        category = 'hatchback'
        body_type = 'Hatchback'
    else:
        category = 'sedan'
        body_type = 'Sedán'
        
    # Model name humanization
    words = [w.capitalize() for w in model_slug.split('_')]
    base_name = " ".join(words)
    
    return {
        'brand': brand.capitalize(),
        'brand_slug': brand,
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
    brands = ['toyota', 'nissan']
    models_dict = {}
    
    for brand in brands:
        dir_path = f'frontend/public/vehicles/models/{brand}'
        if not os.path.exists(dir_path):
            continue
            
        all_files = [f for f in os.listdir(dir_path) if f.endswith('.png') or f.endswith('.jpg')]
        # Keep clean standardized files
        clean_files = [f for f in all_files if not f.split('_')[1].isdigit()]
        
        for fn in clean_files:
            meta = parse_filename(fn, brand)
            pair_key = f"{brand}::{meta['base_no_view']}"
            
            if pair_key not in models_dict:
                models_dict[pair_key] = {
                    'id': f"{brand}_{len(models_dict)+1:03d}",
                    'brand': meta['brand'],
                    'brand_slug': meta['brand_slug'],
                    'model_name': meta['model_name'],
                    'generation': meta['gen_str'],
                    'year_start': meta['year_start'],
                    'year_end': meta['year_end'],
                    'category': meta['category'],
                    'body_type': meta['body_type'],
                    'lateral_image': None,
                    'top_image': None
                }
                
            if meta['view'] == 'lateral':
                models_dict[pair_key]['lateral_image'] = f"/vehicles/models/{brand}/{fn}"
            elif meta['view'] == 'top':
                models_dict[pair_key]['top_image'] = f"/vehicles/models/{brand}/{fn}"
                
    # Fill in any lone pairs
    for k, m in models_dict.items():
        if m['lateral_image'] and not m['top_image']:
            m['top_image'] = m['lateral_image'].replace('_lat.png', '_top.png')
        elif m['top_image'] and not m['lateral_image']:
            m['lateral_image'] = m['top_image'].replace('_top.png', '_lat.png')

    result_models = list(models_dict.values())
    
    out_file = 'frontend/src/data/official_vehicle_catalog.json'
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump({'models': result_models, 'total_models': len(result_models)}, f, indent=2, ensure_ascii=False)
        
    print(f"Indexado oficial desde disco completado: {len(result_models)} modelos guardados en {out_file}")

if __name__ == '__main__':
    main()
