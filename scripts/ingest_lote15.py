import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/kia")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "Q97S2.jpg": "kia_sportage_2015_2021_lat.png",
        "TuYOy.jpg": "kia_sportage_2015_2021_top.png",
        "HaGvx.jpg": "kia_sportage_2010_2015_lat.png",
        "y1uKs.jpg": "kia_sportage_2010_2015_top.png",
        "8zlzA.jpg": "kia_sportage_2004_2010_lat.png",
        "6ZdiL.jpg": "kia_sportage_2004_2010_top.png",
    }

    for src_name, dest_name in mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = dest_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK] Ingested: {src_name} -> {dest_path} ({im.size})")

    print("\nLOTE #15 (Sportage QL, SL, KM) Ingested Successfully!")

if __name__ == "__main__":
    main()
