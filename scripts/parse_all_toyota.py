import os
import re
import json
from PIL import Image, ImageOps
import winsdk.windows.storage as storage
import winsdk.windows.graphics.imaging as imaging
import winsdk.windows.media.ocr as ocr
import asyncio

async def parse_all_toyota():
    engine = ocr.OcrEngine.try_create_from_user_profile_languages()
    cleaned_dir = r"c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\data\blueprints_cleaned\toyota"
    
    files = [f for f in os.listdir(cleaned_dir) if f.startswith("TOYOTA") and f.endswith(".png")]
    print(f"Analyzing {len(files)} Toyota blueprints...")
    
    results = {}
    
    for idx, fn in enumerate(files):
        p = os.path.join(cleaned_dir, fn)
        im = Image.open(p)
        w, h = im.size
        
        # Crop header area
        header = im.crop((0, 0, min(w, 390), min(h, 45))).convert("L")
        header_4x = header.resize((min(w, 390) * 4, min(h, 45) * 4), Image.Resampling.LANCZOS)
        header_4x = ImageOps.autocontrast(header_4x, cutoff=1)
        header_bin = header_4x.point(lambda p: 255 if p > 170 else 0)
        
        temp_p = os.path.join(cleaned_dir, f"_temp_match_{idx}.png")
        header_bin.save(temp_p)
        
        file = await storage.StorageFile.get_file_from_path_async(os.path.abspath(temp_p))
        stream = await file.open_async(storage.FileAccessMode.READ)
        decoder = await imaging.BitmapDecoder.create_async(stream)
        bitmap = await decoder.get_software_bitmap_async()
        ocr_res = await engine.recognize_async(bitmap)
        text = ocr_res.text.strip()
        
        if os.path.exists(temp_p):
            os.remove(temp_p)
            
        results[fn] = {
            "file": fn,
            "text": text,
            "width": w,
            "height": h
        }
        
    with open("frontend/src/data/toyota_parsed_headers.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
        
    print("Done saving parsed headers!")

if __name__ == "__main__":
    asyncio.run(parse_all_toyota())
