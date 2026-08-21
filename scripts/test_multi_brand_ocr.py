import os
import asyncio
from PIL import Image, ImageOps
import winsdk.windows.storage as storage
import winsdk.windows.graphics.imaging as imaging
import winsdk.windows.media.ocr as ocr

async def test_brands_ocr():
    engine = ocr.OcrEngine.try_create_from_user_profile_languages()
    raw_dir = 'backend/data/blueprints_raw'
    
    test_brands = ['nissan', 'hyundai', 'kia', 'ford', 'chevrolet', 'honda', 'mazda', 'jeep', 'bmw', 'audi', 'isuzu', 'mitsubishi']
    
    for b in test_brands:
        b_dir = os.path.join(raw_dir, b)
        if not os.path.exists(b_dir):
            continue
        files = [f for f in os.listdir(b_dir) if f.lower().endswith(('.png', '.jpg'))][:3]
        for f in files:
            p = os.path.join(b_dir, f)
            im = Image.open(p)
            w, h = im.size
            
            # Crop header
            header = im.crop((0, 0, min(w, 390), min(h, 45))).convert('L')
            header_4x = header.resize((min(w, 390) * 4, min(h, 45) * 4), Image.Resampling.LANCZOS)
            header_4x = ImageOps.autocontrast(header_4x, cutoff=1)
            header_bin = header_4x.point(lambda p: 255 if p > 170 else 0)
            
            temp_p = os.path.join(raw_dir, f'_temp_test_ocr.png')
            header_bin.save(temp_p)
            
            file = await storage.StorageFile.get_file_from_path_async(os.path.abspath(temp_p))
            stream = await file.open_async(storage.FileAccessMode.READ)
            decoder = await imaging.BitmapDecoder.create_async(stream)
            bitmap = await decoder.get_software_bitmap_async()
            ocr_res = await engine.recognize_async(bitmap)
            text = ocr_res.text.strip().replace('\n', ' ')
            
            if os.path.exists(temp_p):
                os.remove(temp_p)
                
            print(f'[{b:12s}] {f:22s} -> OCR: "{text}"')

if __name__ == '__main__':
    asyncio.run(test_brands_ocr())
