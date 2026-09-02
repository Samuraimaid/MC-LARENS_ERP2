import sys
import os
sys.path.insert(0, os.path.abspath("."))

import asyncio
import base64
from pathlib import Path
from backend.domains.vehicles.circulation_ocr import process_circulation_card_v2

async def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    test_files = ["images.jpg", "images (1).jpg", "images (4).jpg", "images (6).jpg"]

    for f in test_files:
        p = dl / f
        if not p.exists():
            continue
        with open(p, "rb") as fh:
            b64 = f"data:image/jpeg;base64,{base64.b64encode(fh.read()).decode('utf-8')}"
        
        result = await process_circulation_card_v2(image_base64=b64)
        print(f"=== RESULTADO PARA {f} ===")
        print(f"Placa:          {result.get('plate')}")
        print(f"Chasis/VIN:     {result.get('vin')}")
        print(f"Marca:          {result.get('brand')}")
        print(f"Modelo:         {result.get('model')}")
        print(f"Color:          {result.get('color')}")
        print(f"N° Motor:       {result.get('numero_motor')}")
        print(f"Tipo/Carrocería: {result.get('vehicle_type')} ({result.get('vehicle_type_slug')})")
        print(f"Año:            {result.get('year')} (Fuente: {result.get('year_source')})")
        print(f"Motor OCR:      {result.get('engine')} ({result.get('latency_ms')} ms)")
        print(f"Needs Review:   {result.get('needs_review')}")
        print()

if __name__ == "__main__":
    asyncio.run(main())

