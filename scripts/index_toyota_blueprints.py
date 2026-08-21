import asyncio
import os
import re
import json
from PIL import Image, ImageOps
import winsdk.windows.storage as storage
import winsdk.windows.graphics.imaging as imaging
import winsdk.windows.media.ocr as ocr

async def index_all_toyota_blueprints():
    engine = ocr.OcrEngine.try_create_from_user_profile_languages()
    cleaned_dir = r"c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\data\blueprints_cleaned\toyota"
    out_json = r"c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\src\data\toyota_blueprints_index.json"
    public_blueprints_dir = r"c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\public\vehicles\blueprints\toyota"
    os.makedirs(public_blueprints_dir, exist_ok=True)
    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    
    files = [f for f in os.listdir(cleaned_dir) if f.startswith("TOYOTA") and f.endswith(".png")]
    print(f"Total Toyota blueprint images to index: {len(files)}")
    
    catalog = []
    
    for idx, fn in enumerate(files):
        p = os.path.join(cleaned_dir, fn)
        try:
            im = Image.open(p)
            w, h = im.size
            
            # Crop header (first 40px)
            header_w = min(w, 380)
            header_h = min(h, 45)
            header = im.crop((0, 0, header_w, header_h)).convert("L")
            header_4x = header.resize((header_w * 4, header_h * 4), Image.Resampling.LANCZOS)
            header_4x = ImageOps.autocontrast(header_4x, cutoff=2)
            threshold = 175
            header_bin = header_4x.point(lambda pix: 255 if pix > threshold else 0)
            
            temp_p = os.path.join(cleaned_dir, f"_temp_ocr_{idx}.png")
            header_bin.save(temp_p)
            
            file = await storage.StorageFile.get_file_from_path_async(os.path.abspath(temp_p))
            stream = await file.open_async(storage.FileAccessMode.READ)
            decoder = await imaging.BitmapDecoder.create_async(stream)
            bitmap = await decoder.get_software_bitmap_async()
            result = await engine.recognize_async(bitmap)
            raw_text = result.text.strip()
            
            if os.path.exists(temp_p):
                os.remove(temp_p)
                
            # Copy blueprint to frontend public folder
            public_dest = os.path.join(public_blueprints_dir, fn)
            if not os.path.exists(public_dest):
                im.save(public_dest)
                
            entry = {
                "file": fn,
                "path": f"/vehicles/blueprints/toyota/{fn}",
                "raw_text": raw_text,
                "width": w,
                "height": h,
            }
            catalog.append(entry)
            
            if (idx + 1) % 50 == 0 or idx < 10:
                print(f"[{idx + 1}/{len(files)}] {fn}: '{raw_text}'")
                
        except Exception as e:
            print(f"Error indexing {fn}: {e}")
            
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
        
    print(f"Index complete! Saved {len(catalog)} entries to {out_json}")

if __name__ == "__main__":
    asyncio.run(index_all_toyota_blueprints())
