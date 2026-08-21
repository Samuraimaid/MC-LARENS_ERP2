import os
import re
import json
import asyncio
import time
from PIL import Image
import winsdk.windows.storage as storage
import winsdk.windows.graphics.imaging as imaging
import winsdk.windows.media.ocr as ocr

# Regex patterns for vehicle model and year extraction
YEAR_PATTERN = re.compile(r'\(?\b(19\d{2}|20\d{2})(?:[-–](\d{2,4}))?\b\)?')

# Category keywords dictionary
BODY_CATEGORY_RULES = [
    # 1. Camioneta Doble Cabina / Pickup
    ('camioneta_doble_cabina', [
        'double cab', 'crew cab', 'supercrew', 'dual cab', 'pickup', 'pick-up', 'hilux',
        'frontier', 'ranger', 'silverado', 'tacoma', 'tundra', 'd-max', 'dmax', 'l200',
        'triton', 'navara', 'amarok', 'colorado', 'f-150', 'f-250', 'f-350', 'ram 1500',
        'ram 2500', 'bt-50', 'poer', 'wingle', 't60', 't90', 'hunter', 'ridgeline',
        'gladiator', 'np300', 'titan', 'avalanche', 's10 double cab', 't6', 't8 pro'
    ]),
    # 2. Camioneta 1 Cabina / Chasis
    ('camioneta_1_cabina', [
        'single cab', 'regular cab', 'chassis cab', 'cabina sencilla', '1 cabina', 'flatbed',
        'imv 0', 'lc79 single', 'hilux single', 'd-max single', 'ranger single'
    ]),
    # 3. Camioneta Cabina y Media
    ('camioneta_cabina_media', [
        'king cab', 'extra cab', 'extended cab', 'access cab', 'super cab', 'space cab',
        'cabina y media', 'club cab', 'quad cab'
    ]),
    # 4. SUV / Crossover / 4x4
    ('suv', [
        'suv', 'crossover', '4x4', 'cross', 'prado', 'land cruiser', 'patrol', 'pajero',
        'montero', 'rav4', 'cr-v', 'crv', 'cx-5', 'cx-30', 'cx-9', 'cx-60', 'cx-90',
        'tucson', 'santa fe', 'palisade', 'sportage', 'sorento', 'telluride', 'creta',
        'seltos', 'kicks', 'qashqai', 'x-trail', 'xtrail', 'pathfinder', 'armada', 'murano',
        'explorer', 'expedition', 'everest', 'bronco', 'edge', 'escape', 'ecosport',
        'tahoe', 'suburban', 'traverse', 'equinox', 'tracker', 'blazer', 'trailblazer',
        'renegade', 'compass', 'cherokee', 'wrangler', 'grand cherokee', 'commander',
        'q2', 'q3', 'q4', 'q5', 'q7', 'q8', 'e-tron', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'ix',
        'g-class', 'gle', 'glc', 'gla', 'glb', 'gls', 'eqb', 'eqc', 'eqe suv', 'eqs suv',
        'tiguan', 'touareg', 't-cross', 'taos', 'atlas', 'teramont', 'id.4', 'id.5',
        'outlander', 'asx', 'eclipse cross', 'montero sport', 'pajero sport',
        'forester', 'outback', 'xv', 'crosstrek', 'ascent', 'solterra',
        'duster', 'koleos', 'captur', 'austral', 'kadjar',
        'vitara', 'grand vitara', 'jimny', 's-cross', 'ignis',
        'song', 'tang', 'yuan', 'atto', 'sealion',
        'cs15', 'cs35', 'cs55', 'cs75', 'cs85', 'cs95', 'uni-k', 'uni-t',
        'tiggo', 'omoda', 'jaecoo', 'haval', 'h6', 'jolion', 'dargo', 'tank',
        'coolray', 'emgrand x7', 'monjaro', 'azkarra', 'tugella', 'okavango',
        'rx5', 'zs', 'hs', 'rx8', 's2', 's3', 's4', 's5', 's7', 'js4', 'js6', 'js8',
        'korando', 'rexton', 'torres', 'tivoli', 'scorpio', 'xuv',
        'defender', 'discovery', 'evoque', 'velar', 'range rover sport', 'range rover',
        'rx', 'nx', 'gx', 'lx', 'ux', 'tx', 'rz',
        'levante', 'grecale', 'stelvio', 'tonale', 'macan', 'cayenne', 'urus'
    ]),
    # 5. Hatchback
    ('hatchback', [
        'hatchback', 'sportback', 'yaris', 'swift', 'fit', 'jazz', 'march', 'micra',
        'note', 'tiida hatchback', 'rio hatchback', 'picanto', 'i10', 'i20', 'i30',
        'clio', 'sandero', 'megane hatchback', '206', '207', '208', '307', '308',
        'polo', 'golf', 'up!', 'fox', 'c1', 'c2', 'c3', 'ds3', 'fiesta', 'focus hatchback',
        'spark', 'beat', 'aveo hatchback', 'sonic hatchback', 'onix hatchback', 'cruze hatchback',
        'mazda2', 'mazda 2', 'mazda3 hatchback', 'mazda 3 hatchback', 'corolla hatchback',
        'auris', 'leaf', 'zoe', 'e-208', '500', 'panda', 'punto', 'tipo hatchback',
        'dolphin', 'seagull', 'benben', 'e-star', 'kwid', 'alto', 'celerio', 'baleno'
    ]),
    # 6. Station Wagon / Familiar
    ('station_wagon', [
        'wagon', 'estate', 'touring', 'avant', 'variant', 'combi', 'station wagon', 'sw',
        'fielder', 'proace verso', 'v60', 'v90', 'passat variant', 'golf variant',
        'octavia combi', 'superb combi', 'megane estate', 'clio estate', '308 sw', '508 sw',
        'c-class estate', 'e-class estate', '3 series touring', '5 series touring',
        'a4 avant', 'a6 avant', 'levorg', 'legacy touring'
    ]),
    # 7. Microbús Pasajeros / Van Familiar
    ('microbus_pasajeros', [
        'hiace', 'urvan', 'nv350', 'transporter', 'caravelle', 'multivan', 'transit passenger',
        'tourneo', 'sprinter passenger', 'v-class', 'vito passenger', 'expert combi',
        'traveller', 'boxer combi', 'ducato combi', 'h1', 'h-1', 'starex', 'staria',
        'carnival', 'sedona', 'odyssey', 'sienna', 'alphard', 'vellfire', 'noah', 'voxy',
        'granvia', 'delica', 'space gear', 'l300 bus', 'townace', 'liteace', 'stepwgn',
        'elgrand', 'serena', 'caravan', 'coaster', 'county', 'rosa', 'civilian'
    ]),
    # 8. Microbús Carga / Furgón Panel
    ('microbus_carga', [
        'panel', 'furgon', 'furgón', 'cargo', 'van', 'nv200', 'nv400', 'berlingo',
        'partner', 'partner van', 'rifter', 'kangoo', 'combo', 'caddy', 'crafter',
        'proace city', 'express', 'promaster', 'transit van', 'transit custom',
        'sprinter van', 'vito van', 'expert van', 'boxer van', 'ducato van', 'master',
        'trafic', 'dokker', 'fiorino', 'bipper', 'jumpy', 'jumper'
    ]),
    # 9. Camión de Carga Pesada / Cabezal
    ('camion_carga', [
        'truck', 'camion', 'camión', 'dyna', 'canter', 'fighter', 'hino 300', 'hino 500',
        'hino 700', 'isuzu elf', 'isuzu forward', 'isuzu giga', 'npr', 'nqr', 'nhr',
        'foton aumark', 'foton auman', 'actros', 'atego', 'axor', 'fl', 'fm', 'fh',
        'f-650', 'f-750', 'kodiak', 't880', 'w900', 'cascadia', 'm2'
    ]),
    # 10. Convertible / Roadster
    ('convertible', [
        'cabrio', 'cabriolet', 'convertible', 'roadster', 'spider', 'spyder', 'miata',
        'mx-5', 'z4', 'z3', 'sl', 'slk', 'slc', 'boxster', '911 cabriolet', 'mustang convertible',
        'camaro convertible', 'corvette convertible', 'tt roadster', '4 series convertible',
        'c-class cabriolet', 'e-class cabriolet', 'cascada'
    ]),
]

def classify_vehicle_body(text: str, model_name: str, brand_name: str) -> str:
    comb = f"{text} {model_name} {brand_name}".lower()
    for cat_id, keywords in BODY_CATEGORY_RULES:
        for kw in keywords:
            # Word boundary search
            if re.search(rf'\b{re.escape(kw)}\b', comb):
                return cat_id
    return 'sedan'

def parse_header_text(raw_text: str, brand_name: str) -> dict:
    cleaned = raw_text.replace('\n', ' ').strip()
    
    # Extract Year
    year_match = YEAR_PATTERN.search(cleaned)
    year_start = None
    year_end = None
    if year_match:
        y1 = int(year_match.group(1))
        year_start = y1
        if year_match.group(2):
            y2_str = year_match.group(2)
            if len(y2_str) == 2:
                year_end = int(str(y1)[:2] + y2_str)
            else:
                year_end = int(y2_str)
        else:
            year_end = y1
            
    # Extract Model String
    model_str = cleaned
    # Remove brand name
    model_str = re.sub(re.escape(brand_name), '', model_str, flags=re.IGNORECASE).strip()
    # Remove year pattern
    if year_match:
        model_str = model_str[:year_match.start()] + model_str[year_match.end():]
    # Clean noise chars
    model_str = re.sub(r'[\(\)\[\]_\-—–\.,;:]+', ' ', model_str).strip()
    model_str = re.sub(r'\s+', ' ', model_str)
    
    cat = classify_vehicle_body(cleaned, model_str, brand_name)
    
    return {
        'brand': brand_name.capitalize(),
        'brand_slug': brand_name.lower(),
        'model_name': model_str or f"{brand_name.capitalize()} Model",
        'raw_header_text': cleaned,
        'year_start': year_start,
        'year_end': year_end,
        'category': cat,
    }

async def process_brand(brand_slug: str, engine, raw_dir: str, semaphore: asyncio.Semaphore) -> list:
    b_dir = os.path.join(raw_dir, brand_slug)
    if not os.path.exists(b_dir):
        return []
        
    files = [f for f in os.listdir(b_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
    results = []
    
    # Sort files numerically if possible
    def file_sort_key(fn):
        m = re.search(r'\((\d+)\)', fn)
        return int(m.group(1)) if m else 0
    files.sort(key=file_sort_key)
    
    brand_display_name = brand_slug.replace('_', ' ').replace('-', ' ').title()
    if brand_slug.lower() == 'byd':
        brand_display_name = 'BYD'
    elif brand_slug.lower() == 'bmw':
        brand_display_name = 'BMW'
    elif brand_slug.lower() == 'ram':
        brand_display_name = 'RAM'
    elif brand_slug.lower() == 'jac':
        brand_display_name = 'JAC'
    elif brand_slug.lower() == 'baic':
        brand_display_name = 'BAIC'

    for idx, fn in enumerate(files):
        p = os.path.join(b_dir, fn)
        try:
            im = Image.open(p)
            w, h = im.size
            
            # Crop header text
            hdr = im.crop((0, 0, min(w, 400), min(h, 45))).convert('L')
            hdr_3x = hdr.resize((hdr.width * 3, hdr.height * 3), Image.Resampling.BICUBIC)
            
            temp_p = os.path.join(raw_dir, f'_tmp_ocr_{brand_slug}_{idx}.png')
            hdr_3x.save(temp_p)
            
            async with semaphore:
                file_obj = await storage.StorageFile.get_file_from_path_async(os.path.abspath(temp_p))
                stream = await file_obj.open_async(storage.FileAccessMode.READ)
                decoder = await imaging.BitmapDecoder.create_async(stream)
                bitmap = await decoder.get_software_bitmap_async()
                ocr_res = await engine.recognize_async(bitmap)
                text = ocr_res.text.strip().replace('\n', ' ')
                
            if os.path.exists(temp_p):
                os.remove(temp_p)
                
            parsed = parse_header_text(text, brand_display_name)
            parsed['file_name'] = fn
            parsed['relative_raw_path'] = f"blueprints_raw/{brand_slug}/{fn}"
            parsed['width'] = w
            parsed['height'] = h
            parsed['file_id'] = idx + 1
            
            results.append(parsed)
            
        except Exception as e:
            if os.path.exists(f'_tmp_ocr_{brand_slug}_{idx}.png'):
                try:
                    os.remove(f'_tmp_ocr_{brand_slug}_{idx}.png')
                except Exception:
                    pass
            results.append({
                'brand': brand_display_name,
                'brand_slug': brand_slug.lower(),
                'model_name': f"{brand_display_name} Vehicle",
                'raw_header_text': '',
                'year_start': None,
                'year_end': None,
                'category': 'sedan',
                'file_name': fn,
                'relative_raw_path': f"blueprints_raw/{brand_slug}/{fn}",
                'width': 400,
                'height': 300,
                'file_id': idx + 1
            })
            
    print(f"[{brand_display_name:18s}] Processed {len(results):4d} blueprints")
    return results

async def main():
    t0 = time.time()
    print("=================================================================")
    print("MC-LARENS ERP: MASTER BLUEPRINT OCR & CATALOG INDEXING ENGINE")
    print("=================================================================")
    
    engine = ocr.OcrEngine.try_create_from_user_profile_languages()
    raw_dir = 'backend/data/blueprints_raw'
    brands = [d for d in os.listdir(raw_dir) if os.path.isdir(os.path.join(raw_dir, d))]
    brands.sort()
    
    print(f"Discovered {len(brands)} brands. Starting OCR indexing...")
    
    semaphore = asyncio.Semaphore(12)  # 12 concurrent OCR tasks
    all_records = []
    
    for b in brands:
        res = await process_brand(b, engine, raw_dir, semaphore)
        all_records.extend(res)
        
    print(f"\nCompleted indexing {len(all_records)} vehicle blueprints in {time.time()-t0:.2f}s!")
    
    # Save Master Catalogs
    backend_dest = 'backend/data/vehicle_blueprints_master_index.json'
    frontend_dest = 'frontend/src/data/vehicle_blueprints_master_index.json'
    
    master_data = {
        'version': 1,
        'generated_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        'total_blueprints': len(all_records),
        'total_brands': len(brands),
        'blueprints': all_records
    }
    
    with open(backend_dest, 'w', encoding='utf-8') as f:
        json.dump(master_data, f, indent=2, ensure_ascii=False)
    print(f"Saved backend master index -> {backend_dest}")
    
    with open(frontend_dest, 'w', encoding='utf-8') as f:
        json.dump(master_data, f, indent=2, ensure_ascii=False)
    print(f"Saved frontend master index -> {frontend_dest}")

if __name__ == '__main__':
    asyncio.run(main())
