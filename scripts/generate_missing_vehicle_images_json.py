import json
import os
from datetime import datetime, timezone

def generate():
    catalog_path = os.path.join('frontend', 'src', 'data', 'vehicle_prompts_catalog.json')
    if not os.path.exists(catalog_path):
        print(f"Error: {catalog_path} not found.")
        return

    with open(catalog_path, 'r', encoding='utf-8') as f:
        prompts_cat = json.load(f)

    items = prompts_cat.get('items', [])

    missing_images_list = []
    models_missing_dict = {}
    brand_summary = {}
    view_summary = {'front_3q': 0, 'rear_3q': 0, 'lateral': 0}
    present_count = 0
    total_count = 0

    for item in items:
        brand = item.get('brand', 'UNKNOWN')
        model_name = item.get('model_name', '')
        years = item.get('years', '')
        category = item.get('category', '')
        slug = item.get('slug', '')
        files = item.get('files', {})
        prompts = item.get('prompts', {})

        if brand not in brand_summary:
            brand_summary[brand] = {
                'total_models': 0,
                'total_views': 0,
                'present_views': 0,
                'missing_views': 0
            }
        brand_summary[brand]['total_models'] += 1

        model_missing_views = []

        for view_key in ['front_3q', 'rear_3q', 'lateral']:
            target_path = files.get(view_key, '')
            prompt = prompts.get(view_key, '')
            total_count += 1
            brand_summary[brand]['total_views'] += 1

            norm_path = target_path.replace('/', os.sep)
            is_present = os.path.exists(norm_path) and os.path.getsize(norm_path) > 0

            if is_present:
                present_count += 1
                brand_summary[brand]['present_views'] += 1
            else:
                view_summary[view_key] += 1
                brand_summary[brand]['missing_views'] += 1
                
                # Format public relative path
                public_rel = target_path.replace('frontend/public/', '').replace('frontend/public', '')
                if not public_rel.startswith('/'):
                    public_rel = '/' + public_rel

                img_info = {
                    'brand': brand,
                    'model_name': model_name,
                    'years': years,
                    'category': category,
                    'slug': slug,
                    'view_type': view_key,
                    'target_file_path': target_path,
                    'public_url': public_rel,
                    'prompt': prompt
                }
                missing_images_list.append(img_info)
                model_missing_views.append({
                    'view_type': view_key,
                    'target_file_path': target_path,
                    'public_url': public_rel,
                    'prompt': prompt
                })

        if model_missing_views:
            models_missing_dict[slug] = {
                'brand': brand,
                'model_name': model_name,
                'years': years,
                'category': category,
                'slug': slug,
                'missing_count': len(model_missing_views),
                'missing_views': model_missing_views
            }

    output_data = {
        'metadata': {
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'description': 'Catálogo de imágenes automotrices faltantes para generación batch con Grok / IA',
            'total_models_evaluated': len(items),
            'total_images_evaluated': total_count,
            'total_present_images': present_count,
            'total_missing_images': len(missing_images_list),
            'summary_by_view': view_summary,
            'summary_by_brand': brand_summary
        },
        'missing_images': missing_images_list,
        'missing_by_model': models_missing_dict
    }

    output_path = os.path.join('frontend', 'src', 'data', 'missing_vehicle_images.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"Successfully generated: {output_path}")
    print(f"Total Models Evaluated: {len(items)}")
    print(f"Total Missing Images:   {len(missing_images_list)} / {total_count}")
    print(f"Total Present Images:   {present_count}")
    print("\nSummary by View Type:")
    for v, c in view_summary.items():
        print(f"  - {v:10s}: {c} faltantes")
    print("\nSummary by Brand:")
    for b, s in brand_summary.items():
        print(f"  - {b:12s}: {s['missing_views']:3d} faltantes / {s['total_views']:3d} total ({s['present_views']:3d} presentes)")

if __name__ == '__main__':
    generate()
