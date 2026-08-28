import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/kia")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "oX2L4.jpg": "kia_bongo_k2700_single_cab_2004_present_lat.png",
        "6JPZn.jpg": "kia_bongo_k2700_single_cab_2004_present_top.png",
        "mkjzt.jpg": "kia_bongo_k2700_double_cab_2004_present_lat.png",
        "l1BDS.jpg": "kia_bongo_k2700_double_cab_2004_present_top.png",
        "mP67Q.jpg": "kia_pregio_1995_2015_lat.png",
        "GOfiq.jpg": "kia_pregio_1995_2015_top.png",
    }

    extra_aliases = {
        "kia_bongo_k2700_single_cab_2004_present_lat.png": "kia_bongo_2004_present_lat.png",
        "kia_bongo_k2700_single_cab_2004_present_top.png": "kia_bongo_2004_present_top.png",
        "kia_bongo_k2700_double_cab_2004_present_lat.png": "kia_bongo_double_cab_2004_present_lat.png",
        "kia_bongo_k2700_double_cab_2004_present_top.png": "kia_bongo_double_cab_2004_present_top.png",
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

    print("\nLOTE #25 (Bongo Single Cab, Bongo Double Cab, Pregio) Ingested Successfully!")

if __name__ == "__main__":
    main()
