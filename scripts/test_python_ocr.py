import asyncio
import os
from PIL import Image
import winsdk.windows.storage as storage
import winsdk.windows.graphics.imaging as imaging
import winsdk.windows.media.ocr as ocr
import winsdk.windows.globalization as glob

async def test_ocr():
    engine = ocr.OcrEngine.try_create_from_user_profile_languages()
    if not engine:
        print("No OCR engine available")
        return

    sample_dir = r"c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\data\blueprints_cleaned\toyota"
    for i in range(1, 10):
        p = os.path.join(sample_dir, f"header_{i}.png")
        if os.path.exists(p):
            file = await storage.StorageFile.get_file_from_path_async(os.path.abspath(p))
            stream = await file.open_async(storage.FileAccessMode.READ)
            decoder = await imaging.BitmapDecoder.create_async(stream)
            bitmap = await decoder.get_software_bitmap_async()
            result = await engine.recognize_async(bitmap)
            print(f"Header {i}: -> '{result.text}'")

if __name__ == "__main__":
    asyncio.run(test_ocr())
