import os
import asyncio
from pathlib import Path
from PIL import Image
import winsdk.windows.media.ocr as ocr
import winsdk.windows.graphics.imaging as imaging
import winsdk.windows.storage as storage

async def ocr_image(path_str):
    file = await storage.StorageFile.get_file_from_path_async(str(Path(path_str).resolve()))
    stream = await file.open_async(storage.FileAccessMode.READ)
    decoder = await imaging.BitmapDecoder.create_async(stream)
    software_bitmap = await decoder.get_software_bitmap_async()
    engine = ocr.OcrEngine.try_create_from_user_profile_languages()
    ocr_result = await engine.recognize_async(software_bitmap)
    return ocr_result.text

async def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    recent = ["images.jpg", "images (1).jpg", "images (2).jpg", "images (3).jpg", "images (4).jpg", "images (5).jpg", "images (6).jpg"]
    
    for f in recent:
        p = dl / f
        if p.exists():
            im = Image.open(p)
            try:
                txt = await ocr_image(str(p))
            except Exception as e:
                txt = f"OCR Error: {e}"
            print(f"File: {f:<16} | Size: {im.size} | Mode: {im.mode}")
            print(f"OCR: {txt}\n{'-'*60}")

if __name__ == "__main__":
    asyncio.run(main())
