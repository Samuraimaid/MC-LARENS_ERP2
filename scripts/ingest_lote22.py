import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/kia")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "3OmxX.jpg": "kia_optima_2010_2015_lat.png",
        "XOhbX.jpg": "kia_optima_2010_2015_top.png",
        "6H55S.jpg": "kia_soul_2019_present_lat.png",
        "Vh8kq.jpg": "kia_soul_2019_present_top.png",
        "CwIE2.jpg": "kia_soul_2013_2019_lat.png",
        "uM9w6.jpg": "kia_soul_2013_2019_top.png",
    }

    extra_aliases = {
        "kia_soul_2019_present_lat.png": "kia_soul_2019_2026_lat.png",
        "kia_soul_2019_present_top.png": "kia_soul_2019_2026_top.png",
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

    print("\nLOTE #22 (Optima TF, Soul SK3, Soul PS) Ingested Successfully!")

if __name__ == "__main__":
    main()
