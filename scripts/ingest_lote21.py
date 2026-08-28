import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/kia")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "KeZPL.jpg": "kia_cerato_2008_2013_lat.png",
        "0pIUy.jpg": "kia_cerato_2008_2013_top.png",
        "Bbo9a.jpg": "kia_k5_2019_present_lat.png",
        "SFv11.jpg": "kia_k5_2019_present_top.png",
        "I3ZxF.jpg": "kia_optima_2015_2020_lat.png",
        "lIZqy.jpg": "kia_optima_2015_2020_top.png",
    }

    extra_aliases = {
        "kia_k5_2019_present_lat.png": "kia_optima_k5_2019_present_lat.png",
        "kia_k5_2019_present_top.png": "kia_optima_k5_2019_present_top.png",
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

    print("\nLOTE #21 (Cerato TD, Kia K5 DL3, Optima JF) Ingested Successfully!")

if __name__ == "__main__":
    main()
