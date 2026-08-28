import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/kia")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "5DLzk.jpg": "kia_k3_cerato_2023_present_lat.png",
        "No1eB.jpg": "kia_k3_cerato_2023_present_top.png",
        "sI2Jq.jpg": "kia_forte_cerato_2018_present_lat.png",
        "83arB.jpg": "kia_forte_cerato_2018_present_top.png",
        "76lsk.jpg": "kia_forte_cerato_2013_2018_lat.png",
        "6EOlV.jpg": "kia_forte_cerato_2013_2018_top.png",
    }

    extra_aliases = {
        "kia_k3_cerato_2023_present_lat.png": "kia_k3_2023_present_lat.png",
        "kia_k3_cerato_2023_present_top.png": "kia_k3_2023_present_top.png",
        "kia_forte_cerato_2018_present_lat.png": "kia_cerato_2018_2024_lat.png",
        "kia_forte_cerato_2018_present_top.png": "kia_cerato_2018_2024_top.png",
        "kia_forte_cerato_2013_2018_lat.png": "kia_cerato_2013_2018_lat.png",
        "kia_forte_cerato_2013_2018_top.png": "kia_cerato_2013_2018_top.png",
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

    print("\nLOTE #20 (K3 2023+, Forte BD, Cerato YD) Ingested Successfully!")

if __name__ == "__main__":
    main()
