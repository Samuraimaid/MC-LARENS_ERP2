import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/kia")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "gu981.jpg": "kia_sportage_1993_2004_lat.png",
        "HMhEZ.jpg": "kia_sportage_1993_2004_top.png",
        "wWuPV.jpg": "kia_seltos_2019_present_lat.png",
        "KnMNz.jpg": "kia_seltos_2019_present_top.png",
        "JcyDT.jpg": "kia_sonet_2020_present_lat.png",
        "wlAJU.jpg": "kia_sonet_2020_present_top.png",
    }

    extra_aliases = {
        "kia_seltos_2019_present_lat.png": "kia_seltos_2019_2026_lat.png",
        "kia_seltos_2019_present_top.png": "kia_seltos_2019_2026_top.png",
        "kia_sonet_2020_present_lat.png": "kia_sonet_2020_2026_lat.png",
        "kia_sonet_2020_present_top.png": "kia_sonet_2020_2026_top.png",
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

    print("\nLOTE #16 (Sportage NB-7, Seltos, Sonet) Ingested Successfully!")

if __name__ == "__main__":
    main()
