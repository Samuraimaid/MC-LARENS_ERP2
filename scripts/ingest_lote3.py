import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/hyundai")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "t8zFy.jpg": "hyundai_tucson_2015_2020_lat.png",
        "soKYt.jpg": "hyundai_tucson_2015_2020_top.png",
        "2OTeR.jpg": "hyundai_tucson_2009_2015_lat.png",
        "p4w4b.jpg": "hyundai_tucson_2009_2015_top.png",
        "buSRN.jpg": "hyundai_tucson_2004_2009_lat.png",
        "HrRz0.jpg": "hyundai_tucson_2004_2009_top.png",
    }

    # Also aliases for ix35
    extra_aliases = {
        "hyundai_tucson_2009_2015_lat.png": "hyundai_ix35_2009_2015_lat.png",
        "hyundai_tucson_2009_2015_top.png": "hyundai_ix35_2009_2015_top.png",
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

    print("\nLOTE #3 (Tucson TL, LM/ix35, JM) Ingested Successfully!")

if __name__ == "__main__":
    main()
