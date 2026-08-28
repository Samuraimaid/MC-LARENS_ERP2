import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/kia")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "oBwSI.jpg": "kia_carens_2022_present_lat.png",
        "Grb2t.jpg": "kia_carens_2022_present_top.png",
        "LyUqM.jpg": "kia_telluride_2019_present_lat.png",
        "C1hz4.jpg": "kia_telluride_2019_present_top.png",
        "UBRdN.jpg": "kia_stinger_2017_2023_lat.png",
        "7fehH.jpg": "kia_stinger_2017_2023_top.png",
    }

    extra_aliases = {
        "kia_carens_2022_present_lat.png": "kia_carens_2022_2026_lat.png",
        "kia_carens_2022_present_top.png": "kia_carens_2022_2026_top.png",
        "kia_telluride_2019_present_lat.png": "kia_telluride_2019_2026_lat.png",
        "kia_telluride_2019_present_top.png": "kia_telluride_2019_2026_top.png",
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

    print("\nLOTE #24 (Carens KY, Telluride, Stinger) Ingested Successfully!")

if __name__ == "__main__":
    main()
