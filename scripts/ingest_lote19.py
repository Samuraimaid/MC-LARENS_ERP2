import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/kia")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "PTGG5.jpg": "kia_picanto_2017_2023_lat.png",
        "MfsRp.jpg": "kia_picanto_2017_2023_top.png",
        "rZdjq.jpg": "kia_picanto_2011_2017_lat.png",
        "qSTdn.jpg": "kia_picanto_2011_2017_top.png",
        "pfula.jpg": "kia_picanto_2004_2011_lat.png",
        "wFZfP.jpg": "kia_picanto_2004_2011_top.png",
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

    print("\nLOTE #19 (Picanto JA, TA, SA) Ingested Successfully!")

if __name__ == "__main__":
    main()
