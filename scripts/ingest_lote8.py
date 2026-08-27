import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/hyundai")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "X1jJ0.jpg": "hyundai_grand_i10_2019_present_lat.png",
        "sm7xy.jpg": "hyundai_grand_i10_2019_present_top.png",
        "Ga8wK.jpg": "hyundai_grand_i10_sedan_2019_present_lat.png",
        "ZB4z5.jpg": "hyundai_grand_i10_sedan_2019_present_top.png",
        "HQd3a.jpg": "hyundai_grand_i10_2013_2019_lat.png",
        "sCvy3.jpg": "hyundai_grand_i10_2013_2019_top.png",
    }

    extra_aliases = {
        "hyundai_grand_i10_2019_present_lat.png": "hyundai_grand_i10_2019_2026_lat.png",
        "hyundai_grand_i10_2019_present_top.png": "hyundai_grand_i10_2019_2026_top.png",
        "hyundai_grand_i10_sedan_2019_present_lat.png": "hyundai_grand_i10_sedan_2019_2026_lat.png",
        "hyundai_grand_i10_sedan_2019_present_top.png": "hyundai_grand_i10_sedan_2019_2026_top.png",
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

    for src_alias, dst_alias in extra_aliases.items():
        s_file = dest_dir / src_alias
        d_file = dest_dir / dst_alias
        if s_file.exists():
            im = Image.open(s_file)
            im.save(d_file, "PNG", optimize=True)
            print(f"[OK] Alias created: {dst_alias}")

    print("\nLOTE #8 (Grand i10 Hatchback, Grand i10 Sedán, Grand i10 BA) Ingested Successfully!")

if __name__ == "__main__":
    main()
