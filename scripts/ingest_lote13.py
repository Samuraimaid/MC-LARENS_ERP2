import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    hyundai_dir = Path("frontend/public/vehicles/models/hyundai")
    kia_dir = Path("frontend/public/vehicles/models/kia")
    hyundai_dir.mkdir(parents=True, exist_ok=True)
    kia_dir.mkdir(parents=True, exist_ok=True)

    hyundai_mapping = {
        "aqvsp.jpg": "hyundai_terracan_2001_2007_lat.png",
        "3h58o.jpg": "hyundai_terracan_2001_2007_top.png",
    }

    kia_mapping = {
        "Dzum0.jpg": "kia_sorento_2020_present_lat.png",
        "2RX3w.jpg": "kia_sorento_2020_present_top.png",
        "p7D9v.jpg": "kia_sorento_2014_2020_lat.png",
        "DQQRq.jpg": "kia_sorento_2014_2020_top.png",
    }

    extra_kia_aliases = {
        "kia_sorento_2020_present_lat.png": "kia_sorento_2020_2026_lat.png",
        "kia_sorento_2020_present_top.png": "kia_sorento_2020_2026_top.png",
    }

    for src_name, dest_name in hyundai_mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = hyundai_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK] Ingested Hyundai: {src_name} -> {dest_path} ({im.size})")

    for src_name, dest_name in kia_mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = kia_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK] Ingested Kia: {src_name} -> {dest_path} ({im.size})")

    for src_alias, dst_alias in extra_kia_aliases.items():
        s_file = kia_dir / src_alias
        d_file = kia_dir / dst_alias
        if s_file.exists():
            im = Image.open(s_file)
            im.save(d_file, "PNG", optimize=True)
            print(f"[OK] Kia alias created: {dst_alias}")

    print("\nLOTE #13 (Terracan, Sorento MQ4, Sorento UM) Ingested Successfully!")

if __name__ == "__main__":
    main()
