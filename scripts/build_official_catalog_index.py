import os
import json
import re

def parse_years(gen_str):
    m = re.search(r'(\d{4})\s*-\s*(\d{4})', str(gen_str))
    if m:
        return int(m.group(1)), int(m.group(2))
    m2 = re.search(r'(\d{4})', str(gen_str))
    if m2:
        y = int(m2.group(1))
        return y, y
    return 2000, 2026

def map_category(body_type, model_str):
    bt = (str(body_type) + ' ' + str(model_str)).lower()
    if 'doble cabina' in bt or 'double cab' in bt or 'crew' in bt:
        return 'camioneta_doble_cabina'
    elif 'cabina y media' in bt or 'king cab' in bt or 'extra cab' in bt:
        return 'camioneta_cabina_media'
    elif 'cabina sencilla' in bt or 'single cab' in bt or '1 cabina' in bt:
        return 'camioneta_1_cabina'
    elif 'camion' in bt or 'camión' in bt or 'cabstar' in bt or 'dyna' in bt or 'canter' in bt:
        return 'camion_1_cabina'
    elif 'techo alto' in bt or 'high roof' in bt or 'gran hiace' in bt:
        return 'microbus_techo_alto'
    elif 'panel' in bt or 'carga' in bt or 'furgon' in bt:
        return 'microbus_carga'
    elif 'coaster' in bt or 'bus' in bt:
        return 'bus_mediano_coaster'
    elif 'van' in bt or 'urvan' in bt or 'hiace' in bt or 'starex' in bt or 'pasajeros' in bt:
        return 'microbus_pasajeros'
    elif 'suv' in bt or '4x4' in bt or 'prado' in bt or 'cruiser' in bt or 'fortuner' in bt or '4runner' in bt or 'rav4' in bt or 'cross' in bt or 'kicks' in bt or 'qashqai' in bt or 'xtrail' in bt or 'x-trail' in bt or 'pathfinder' in bt or 'patrol' in bt or 'terra' in bt or 'murano' in bt or 'juke' in bt or 'magnite' in bt or 'rush' in bt or 'raize' in bt or 'hilux surf' in bt:
        return 'suv'
    elif 'station' in bt or 'probox' in bt or 'succeed' in bt or 'caldina' in bt:
        return 'station_wagon'
    elif 'hatchback' in bt or 'march' in bt or 'micra' in bt or 'yaris hb' in bt or 'starlet' in bt or 'vitz' in bt:
        return 'hatchback'
    else:
        return 'sedan'

def build_index():
    catalogs = [
        ('toyota', 'scripts/grok_toyota_catalog_prompts.json'),
        ('nissan', 'scripts/grok_nissan_catalog_prompts.json')
    ]
    
    paired_models = {}
    
    for brand_key, cat_file in catalogs:
        if not os.path.exists(cat_file):
            continue
        with open(cat_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        tasks = data.get('tasks', [])
        
        for t in tasks:
            brand = t.get('brand', brand_key.capitalize())
            model = t.get('model', '')
            gen = t.get('generation', '')
            view = t.get('view', '')
            fn = t.get('filename', '')
            body_type = t.get('body_type', '')
            
            # Base key for pairing lat + top
            pair_key = f"{brand_key}::{model}::{gen}::{body_type}"
            if pair_key not in paired_models:
                y_start, y_end = parse_years(gen)
                cat = map_category(body_type, model)
                paired_models[pair_key] = {
                    "id": f"{brand_key}_{len(paired_models)+1:03d}",
                    "brand": brand,
                    "brand_slug": brand_key,
                    "model_name": model,
                    "generation": gen,
                    "year_start": y_start,
                    "year_end": y_end,
                    "body_type": body_type,
                    "category": cat,
                    "lateral_image": None,
                    "top_image": None
                }
            
            if 'Lateral' in view or '_lat.' in fn:
                paired_models[pair_key]["lateral_image"] = f"/vehicles/models/{brand_key}/{fn}"
            elif 'Superior' in view or '_top.' in fn or 'Top' in view:
                paired_models[pair_key]["top_image"] = f"/vehicles/models/{brand_key}/{fn}"

    result_list = list(paired_models.values())
    
    out_path = 'frontend/src/data/official_vehicle_catalog.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump({"models": result_list, "total_models": len(result_list)}, f, indent=2, ensure_ascii=False)
    
    print(f"Generado exitosamente {out_path} con {len(result_list)} modelos oficiales pareados.")

if __name__ == '__main__':
    build_index()
