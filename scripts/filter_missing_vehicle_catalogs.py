import json
import os
import re
from datetime import datetime, timezone

def filter_catalogs():
    base_file = os.path.join('frontend', 'src', 'data', 'missing_vehicle_images.json')
    if not os.path.exists(base_file):
        print(f"Error: {base_file} not found.")
        return

    with open(base_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    missing = data['missing_images']

    def get_y_start(years_str):
        nums = [int(n) for n in re.findall(r'\d{4}', years_str)]
        return nums[0] if len(nums) >= 1 else 2010

    # 1. Filtro Generaciones 2008-2026 (y_start >= 2008)
    missing_2008 = [img for img in missing if get_y_start(img['years']) >= 2008]
    models_2008 = {}
    for img in missing_2008:
        slug = img['slug']
        if slug not in models_2008:
            models_2008[slug] = {
                'brand': img['brand'],
                'model_name': img['model_name'],
                'years': img['years'],
                'category': img['category'],
                'slug': slug,
                'missing_views': []
            }
        models_2008[slug]['missing_views'].append({
            'view_type': img['view_type'],
            'target_file_path': img['target_file_path'],
            'public_url': img['public_url'],
            'prompt': img['prompt']
        })

    out_2008 = {
        'metadata': {
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'filter': 'Generaciones iniciadas a partir del 2008 al 2026 (year_start >= 2008)',
            'total_models': len(models_2008),
            'total_missing_images': len(missing_2008),
            'breakdown_by_view': {
                'front_3q': len([x for x in missing_2008 if x['view_type'] == 'front_3q']),
                'rear_3q': len([x for x in missing_2008 if x['view_type'] == 'rear_3q']),
                'lateral': len([x for x in missing_2008 if x['view_type'] == 'lateral'])
            }
        },
        'missing_images': missing_2008,
        'missing_by_model': models_2008
    }

    path_2008 = os.path.join('frontend', 'src', 'data', 'missing_vehicle_images_2008_2026.json')
    with open(path_2008, 'w', encoding='utf-8') as f:
        json.dump(out_2008, f, indent=2, ensure_ascii=False)

    # 2. Filtro Solo Vistas Laterales (Thumbnails 3D prioritarios para Tarjetas ERP)
    missing_lat = [img for img in missing if img['view_type'] == 'lateral']
    out_lat = {
        'metadata': {
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'filter': 'Solo vistas laterales (Thumbnails 3D / 2D para visualización en tarjetas de vehículos y POS)',
            'total_missing_images': len(missing_lat),
            'total_models': len(set(x['slug'] for x in missing_lat))
        },
        'missing_images': missing_lat
    }

    path_lat = os.path.join('frontend', 'src', 'data', 'missing_vehicle_images_laterals_only.json')
    with open(path_lat, 'w', encoding='utf-8') as f:
        json.dump(out_lat, f, indent=2, ensure_ascii=False)

    print(f"Generated {path_2008}: {len(models_2008)} modelos, {len(missing_2008)} imagenes")
    print(f"Generated {path_lat}: {len(missing_lat)} imagenes laterales")

if __name__ == '__main__':
    filter_catalogs()
