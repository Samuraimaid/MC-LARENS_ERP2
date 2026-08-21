import asyncio
import os
import re
from PIL import Image, ImageEnhance, ImageOps
import winsdk.windows.storage as storage
import winsdk.windows.graphics.imaging as imaging
import winsdk.windows.media.ocr as ocr

async def test_upscaled_ocr():
    engine = ocr.OcrEngine.try_create_from_user_profile_languages()
    sample_dir = r"c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\data\blueprints_cleaned\toyota"
    
    for i in range(1, 15):
        fn = f"TOYOTA ({i}).png"
        p = os.path.join(sample_dir, fn)
        if not os.path.exists(p):
            continue
        
        im = Image.open(p)
        w, h = im.size
        # Crop header with generous bounding box
        crop_w = min(w, 390)
        crop_h = min(h, 48)
        header = im.crop((0, 0, crop_w, crop_h)).convert("L")
        # Upscale 4x with bicubic
        header_4x = header.resize((crop_w * 4, crop_h * 4), Image.Resampling.LANCZOS)
        # Increase contrast
        header_4x = ImageOps.autocontrast(header_4x, cutoff=2)
        # Binarize
        threshold = 180
        header_bin = header_4x.point(lambda p: 255 if p > threshold else 0)
        
        temp_p = os.path.join(sample_dir, f"temp_up_{i}.png")
        header_bin.save(temp_p)
        
        file = await storage.StorageFile.get_file_from_path_async(os.path.abspath(temp_p))
        stream = await file.open_async(storage.FileAccessMode.READ)
        decoder = await imaging.BitmapDecoder.create_async(stream)
        bitmap = await decoder.get_software_bitmap_async()
        result = await engine.recognize_async(bitmap)
        text = result.text.strip()
        print(f"Vehicle {i} ({fn}): -> '{text}'")

if __name__ == "__main__":
    asyncio.run(test_upscaled_ocr())
