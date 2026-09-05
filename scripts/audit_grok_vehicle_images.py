import json
import os

def audit():
    catalog_path = 'frontend/src/data/vehicle_prompts_catalog.json'
    if not os.path.exists(catalog_path):
        print("Catalog not found:", catalog_path)
        return

    with open(catalog_path, encoding='utf-8') as f:
        catalog = json.load(f)

    items = catalog.get('items', [])
    print(f"Total Grok prompt catalog vehicles: {len(items)}")

    missing_list = []
    complete_list = []
    partial_list = []

    for item in items:
        slug = item.get('slug')
        brand = item.get('brand')
        name = item.get('model_name')
        years = item.get('years', '')
        files = item.get('files', {})
        
        missing_views = []
        present_views = []
        for view_key, rel_path in files.items():
            if os.path.exists(rel_path):
                present_views.append((view_key, rel_path))
            else:
                missing_views.append((view_key, rel_path))
        
        if not missing_views:
            complete_list.append({
                'brand': brand,
                'model': name,
                'years': years,
                'slug': slug,
                'views': [v[0] for v in present_views]
            })
        elif not present_views:
            missing_list.append({
                'brand': brand,
                'model': name,
                'years': years,
                'slug': slug,
                'missing': [v[0] for v in missing_views]
            })
        else:
            partial_list.append({
                'brand': brand,
                'model': name,
                'years': years,
                'slug': slug,
                'present': [v[0] for v in present_views],
                'missing': [v[0] for v in missing_views],
            })

    print(f"\n==================================================")
    print(f"AUDIT SUMMARY (Grok Batch Prompt Catalog):")
    print(f" - Total vehicle entries: {len(items)}")
    print(f" - Fully complete (all 3 views present): {len(complete_list)}")
    print(f" - Partially complete (some views present): {len(partial_list)}")
    print(f" - Completely missing on local disk: {len(missing_list)}")
    print(f"==================================================\n")

    if partial_list:
        print(f"--- PARTIALLY COMPLETE VEHICLES ({len(partial_list)}) ---")
        for p in partial_list:
            print(f" • [{p['brand']}] {p['model']} ({p['years']}) [{p['slug']}]: Present: {p['present']} | Missing: {p['missing']}")

    print(f"\n--- BRAND BREAKDOWN OF REGISTERED GROK MODELS ---")
    by_brand = {}
    for item in items:
        b = item['brand']
        by_brand.setdefault(b, {'total': 0, 'complete': 0, 'partial': 0, 'missing': 0})
        by_brand[b]['total'] += 1
        slug = item['slug']
        if any(c['slug'] == slug for c in complete_list):
            by_brand[b]['complete'] += 1
        elif any(p['slug'] == slug for p in partial_list):
            by_brand[b]['partial'] += 1
        else:
            by_brand[b]['missing'] += 1

    for b, counts in sorted(by_brand.items()):
        print(f" • {b:12s}: Total {counts['total']:3d} | Complete: {counts['complete']:3d} | Partial: {counts['partial']:3d} | Missing: {counts['missing']:3d}")

    # Nissan Altima specifically
    print("\n--- NISSAN ALTIMA STATUS IN GROK CATALOG ---")
    for item in items:
        if 'altima' in item['slug'].lower():
            print(f" • {item['brand']} {item.get('model_name', '')} ({item['years']}) [{item['slug']}]:")
            for v, p in item['files'].items():
                print(f"    - {v:10s}: {p} -> {'EXISTS' if os.path.exists(p) else 'NOT FOUND ON LOCAL DISK'}")

if __name__ == '__main__':
    audit()
