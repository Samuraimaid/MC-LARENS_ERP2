import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/hyundai")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "VDOgH.jpg": "hyundai_santa_fe_2006_2012_lat.png",
        "b1GhU.jpg": "hyundai_santa_fe_2006_2012_top.png",
        "2JZIx.jpg": "hyundai_santa_fe_2000_2006_lat.png",
        "99HMn.jpg": "hyundai_santa_fe_2000_2006_top.png",
        "rw3Es.jpg": "hyundai_tucson_2020_present_lat.png",
        "Qb2Hv.jpg": "hyundai_tucson_2020_present_top.png",
    }

    # Also alias 2020_2026 for Tucson
    extra_aliases = {
        "hyundai_tucson_2020_present_lat.png": "hyundai_tucson_2020_2026_lat.png",
        "hyundai_tucson_2020_present_top.png": "hyundai_tucson_2020_2026_top.png",
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

    print("\nLOTE #2 (Santa Fe CM, SM, Tucson NX4) Ingested Successfully!")

if __name__ == "__main__":
    main()
