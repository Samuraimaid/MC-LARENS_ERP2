import asyncio
import os
import re
from pathlib import Path
from PIL import Image
from winsdk.windows.media.ocr import OcrEngine
from winsdk.windows.globalization import Language
from winsdk.windows.graphics.imaging import BitmapDecoder
from winsdk.windows.storage import StorageFile

async def ocr_image(engine, file_path):
    try:
        file = await StorageFile.get_file_from_path_async(str(file_path.resolve()))
        stream = await file.open_async(0)
        decoder = await BitmapDecoder.create_async(stream)
        software_bitmap = await decoder.get_software_bitmap_async()
        result = await engine.recognize_async(software_bitmap)
        return result.text.strip()
    except Exception as e:
        return f"ERROR: {e}"

async def main():
    engine = OcrEngine.try_create_from_user_profile_languages()
    if not engine:
        lang = Language("es")
        engine = OcrEngine.try_create_from_language(lang)

    dl = Path(r"C:\Users\Xinon\Downloads")
    w0p2a_mtime = (dl / "W0p2a.jpg").stat().st_mtime
    new_files = [f for f in dl.iterdir() if f.suffix.lower() in [".jpg", ".png"] and f.stat().st_mtime > w0p2a_mtime]
    new_files = sorted(new_files, key=lambda f: f.stat().st_mtime)

    out_crop_dir = Path("scripts/incoming_grok/inspect_all_new_downloads")
    out_crop_dir.mkdir(parents=True, exist_ok=True)

    print(f"Scanning and OCR-ing {len(new_files)} new images...\n")
    
    ocr_results = []
    for idx, f in enumerate(new_files, 1):
        im = Image.open(f)
        w, h = im.size
        is_top = (h > w)
        
        # Crop label
        crop_path = out_crop_dir / f"{f.name}_lbl.jpg"
        if not crop_path.exists():
            crop = im.crop((0, int(h * 0.88), int(w * 0.75), h))
            crop.save(crop_path)
            
        label_text = await ocr_image(engine, crop_path)
        # clean text
        clean_lbl = " ".join(label_text.replace("\n", " ").split())
        print(f"[{idx:03d}/{len(new_files):03d}] {f.name} ({im.size}, {'TOP' if is_top else 'LAT'}) -> {clean_lbl}")
        
        ocr_results.append({
            "filename": f.name,
            "path": str(f),
            "size": im.size,
            "orientation": "TOP" if is_top else "LAT",
            "mtime": f.stat().st_mtime,
            "ocr_text": clean_lbl
        })

    import json
    with open("scripts/incoming_grok/ocr_results_all.json", "w", encoding="utf-8") as out_f:
        json.dump(ocr_results, out_f, indent=2, ensure_ascii=False)
        
    print(f"\nSaved {len(ocr_results)} OCR records to scripts/incoming_grok/ocr_results_all.json")

if __name__ == "__main__":
    asyncio.run(main())
