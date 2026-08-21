import os
import re
import asyncio
from PIL import Image, ImageOps
import winsdk.windows.storage as storage
import winsdk.windows.graphics.imaging as imaging
import winsdk.windows.media.ocr as ocr

# Regex patterns for vehicle model and year extraction
YEAR_PATTERN = re.compile(r'\(?\b(19\d{2}|20\d{2})(?:-(\d{2,4})|–(\d{2,4}))?\b\)?')

def clean_ocr_text(text: str, brand_name: str) -> dict:
    cleaned = text.replace('\n', ' ').strip()
    # Find year match
    year_match = YEAR_PATTERN.search(cleaned)
    year_start = None
    year_end = None
    if year_match:
        y1 = int(year_match.group(1))
        year_start = y1
        if year_match.group(2) or year_match.group(3):
            y2_str = year_match.group(2) or year_match.group(3)
            if len(y2_str) == 2:
                y2 = int(str(y1)[:2] + y2_str)
            else:
                y2 = int(y2_str)
            year_end = y2
        else:
            year_end = y1
            
    # Extract model name by removing brand name and year
    model_str = cleaned
    # remove brand
    model_str = re.sub(re.escape(brand_name), '', model_str, flags=re.IGNORECASE).strip()
    # remove year
    if year_match:
        model_str = model_str[:year_match.start()] + model_str[year_match.end():]
    # clean extra punctuation
    model_str = re.sub(r'[\(\)\[\]_\-—–\.,;:]+', ' ', model_str).strip()
    model_str = re.sub(r'\s+', ' ', model_str)
    
    # Infer body category
    low = (cleaned + ' ' + model_str).lower()
    if any(w in low for w in ['double cab', 'crew cab', 'supercrew', 'dual cab', 'pickup', 'pick-up', 'hilux', 'frontier', 'ranger', 'silverado', 'tacoma', 'tundra', 'd-max', 'dmax', 'l200', 'triton', 'navara', 'amarok', 'colorado', 'f-150', 'f-250', 'f-350', 'ram 1500', 'ram 2500', 'bt-50', 'poer', 'wingle', 't60', 't90', 'hunter']):
        category = 'camioneta_doble_cabina'
    elif any(w in low for w in ['single cab', 'regular cab', 'chassis cab', 'flatbed']):
        category = 'camioneta_1_cabina'
    elif any(w in low for w in ['king cab', 'extra cab', 'extended cab', 'access cab', 'super cab', 'space cab']):
        category = 'camioneta_cabina_media'
    elif any(w in low for w in ['suv', 'crossover', '4x4', 'cross', 'prado', 'land cruiser', 'patrol', 'pajero', 'montero', 'rav4', 'cr-v', 'crv', 'cx-5', 'cx-30', 'cx-9', 'cx-60', 'cx-90', 'tucson', 'santa fe', 'sportage', 'sorento', 'creta', 'seltos', 'kicks', 'qashqai', 'x-trail', 'xtrail', 'pathfinder', 'explorer', 'expedition', 'tahoe', 'suburban', 'traverse', 'equinox', 'tracker', 'blazer', 'renegade', 'compass', 'cherokee', 'wrangler', 'grand cherokee', 'q3', 'q5', 'q7', 'q8', 'x1', 'x3', 'x5', 'x6', 'x7', 'g-class', 'gle', 'glc', 'gla', 'gls', 'tiguan', 'touareg', 't-cross', 'taos', 'outlander', 'asx', 'forester', 'outback', 'xv', 'crosstrek', 'duster', 'koleos', 'vitara', 'jimny', 'song', 'tang', 'yuan', 'cs35', 'cs55', 'cs75', 'cs95', 'tiggo', 'haval h6', 'haval jolion', 'coolray', 'emgrand x7', 'rx5', 's3', 's4', 's5', 's7', 't8', 't6']):
        category = 'suv'
    elif any(w in low for w in ['hatchback', 'sportback', 'yaris', 'swift', 'fit', 'jazz', 'march', 'micra', 'rio', 'i20', 'i10', 'picanto', 'clio', 'sandero', '208', '308', 'polo', 'golf', 'c3', 'fiesta', 'focus hatchback', 'spark', 'beat', 'aveo hatchback', 'sonic hatchback', 'onix hatchback', 'mazda2', 'mazda 2', 'mazda3 hatchback', 'mazda 3 hatchback', 'corolla hatchback', 'leaf', 'dolphin', 'seagull']):
        category = 'hatchback'
    elif any(w in low for w in ['wagon', 'estate', 'touring', 'avant', 'variant', 'combi', 'station wagon', 'sw', 'fielder', 'proace verso']):
        category = 'station_wagon'
    elif any(w in low for w in ['hiace', 'urvan', 'nv350', 'transporter', 'caravelle', 'multivan', 'transit', 'sprinter', 'v-class', 'vito', 'expert', 'traveller', 'boxer', 'ducato', 'h1', 'starex', 'staria', 'carnival', 'sedona', 'odyssey', 'sienna']):
        category = 'microbus_pasajeros'
    elif any(w in low for w in ['panel', 'furgon', 'furgón', 'cargo', 'van', 'nv200', 'nv400', 'berlingo', 'partner', 'kangoo', 'combo', 'caddy', 'crafter', 'proace city', 'express', 'promaster']):
        category = 'microbus_carga'
    elif any(w in low for w in ['truck', 'camion', 'camión', 'dyna', 'canter', 'hino', 'isuzu elf', 'npr', 'nqr', 'nhr', 'foton', 'actros', 'atego', 'fl', 'fm', 'fh']):
        category = 'camion_carga'
    elif any(w in low for w in ['cabrio', 'cabriolet', 'convertible', 'roadster', 'spider', 'spyder', 'miata', 'mx-5', 'z4', 'sl', 'slk', 'boxster']):
        category = 'convertible'
    else:
        category = 'sedan'
        
    return {
        'clean_text': cleaned,
        'model_name': model_str or cleaned,
        'year_start': year_start,
        'year_end': year_end,
        'category': category
    }

async def test_tuning():
    engine = ocr.OcrEngine.try_create_from_user_profile_languages()
    raw_dir = 'backend/data/blueprints_raw'
    
    test_cases = [
        ('nissan', ['NISSAN (1).png', 'NISSAN (10).png', 'NISSAN (45).png', 'NISSAN (100).png']),
        ('kia', ['HYUNDAI (1).png', 'HYUNDAI (10).png', 'HYUNDAI (15).png']),
        ('hyundai', ['HYUNDAI (10).png', 'HYUNDAI (25).png', 'HYUNDAI (100).png']),
        ('ford', ['FORD (10).png', 'FORD (25).png', 'FORD (50).png']),
        ('chevrolet', ['CHEVROLET (10).png', 'CHEVROLET (25).png', 'CHEVROLET (50).png']),
        ('honda', ['HONDA (10).png', 'HONDA (25).png', 'HONDA (50).png']),
    ]
    
    for brand, files in test_cases:
        b_dir = os.path.join(raw_dir, brand)
        if not os.path.exists(b_dir):
            continue
        print(f"\n--- Testing Brand: {brand.upper()} ---")
        for f in files:
            p = os.path.join(b_dir, f)
            if not os.path.exists(p):
                continue
            im = Image.open(p)
            w, h = im.size
            
            # Crop title header
            header = im.crop((0, 0, min(w, 400), min(h, 45))).convert('L')
            header_4x = header.resize((min(w, 400) * 4, min(h, 45) * 4), Image.Resampling.LANCZOS)
            header_4x = ImageOps.autocontrast(header_4x, cutoff=1)
            header_bin = header_4x.point(lambda p: 255 if p > 165 else 0)
            
            temp_p = os.path.join(raw_dir, f'_test_temp_{brand}_{f}.png')
            header_bin.save(temp_p)
            
            file = await storage.StorageFile.get_file_from_path_async(os.path.abspath(temp_p))
            stream = await file.open_async(storage.FileAccessMode.READ)
            decoder = await imaging.BitmapDecoder.create_async(stream)
            bitmap = await decoder.get_software_bitmap_async()
            ocr_res = await engine.recognize_async(bitmap)
            text = ocr_res.text.strip()
            
            if os.path.exists(temp_p):
                os.remove(temp_p)
                
            parsed = clean_ocr_text(text, brand)
            print(f"{f:18s} | Raw: {text:30s} | Model: {parsed['model_name']:20s} | Years: {parsed['year_start']}-{parsed['year_end']} | Cat: {parsed['category']}")

if __name__ == '__main__':
    asyncio.run(test_tuning())
