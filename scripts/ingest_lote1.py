import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/hyundai")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "hW6Mv.jpg": "hyundai_santa_fe_2023_present_lat.png",
        "GsCxn.jpg": "hyundai_santa_fe_2023_present_top.png",
        "xMHsq.jpg": "hyundai_santa_fe_2018_2023_lat.png",
        "JVSiC.jpg": "hyundai_santa_fe_2018_2023_top.png",
        "Unlb0.jpg": "hyundai_santa_fe_2012_2018_lat.png",
        "PUGfF.jpg": "hyundai_santa_fe_2012_2018_top.png",
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

    print("\nLOTE #1 (Santa Fe MX5, TM, DM) Ingested Successfully!")

if __name__ == "__main__":
    main()
