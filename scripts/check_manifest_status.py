import json
import os

manifest_path = 'frontend/src/data/vehicle_batch_generation_manifest.json'
with open(manifest_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

models = data['models']
print('Total models in manifest:', len(models))

missing = []
for i, m in enumerate(models):
    b_slug = m['brand_slug']
    slug = m['slug']
    f_path = os.path.join('frontend/public/vehicles/models', b_slug, f'{slug}_front_3q.png')
    r_path = os.path.join('frontend/public/vehicles/models', b_slug, f'{slug}_rear_3q.png')
    f_exists = os.path.exists(f_path)
    r_exists = os.path.exists(r_path)
    if not (f_exists and r_exists):
        missing.append({
            'index': i,
            'brand': m['brand'],
            'brand_slug': b_slug,
            'model_name': m['model_name'],
            'slug': slug,
            'year_start': m['year_start'],
            'year_end': m['year_end'],
            'category': m.get('category', 'sedan'),
            'missing_front': not f_exists,
            'missing_rear': not r_exists
        })

print('Total models missing 3Q images:', len(missing))
for m in missing[:15]:
    print(f"[{m['index']}] {m['brand']} {m['model_name']} ({m['year_start']}-{m['year_end']}) front_missing={m['missing_front']} rear_missing={m['missing_rear']}")
