import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/hyundai")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "BDYH4.jpg": "hyundai_kona_2017_2023_lat.png",
        "DAqlr.jpg": "hyundai_kona_2017_2023_top.png",
        "EzPUL.jpg": "hyundai_palisade_2018_present_lat.png",
        "PEDUR.jpg": "hyundai_palisade_2018_present_top.png",
        "wz7nN.jpg": "hyundai_staria_2021_present_lat.png",
        "q7Src.jpg": "hyundai_staria_2021_present_top.png",
    }

    extra_aliases = {
        "hyundai_palisade_2018_present_lat.png": "hyundai_palisade_2018_2026_lat.png",
        "hyundai_palisade_2018_present_top.png": "hyundai_palisade_2018_2026_top.png",
        "hyundai_staria_2021_present_lat.png": "hyundai_staria_2021_2026_lat.png",
        "hyundai_staria_2021_present_top.png": "hyundai_staria_2021_2026_top.png",
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

    print("\nLOTE #10 (Kona OS, Palisade LX2, Staria US4) Ingested Successfully!")

if __name__ == "__main__":
    main()
