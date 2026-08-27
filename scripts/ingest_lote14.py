import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/kia")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "m52ka.jpg": "kia_sorento_2009_2014_lat.png",
        "q78lE.jpg": "kia_sorento_2009_2014_top.png",
        "8QHAy.jpg": "kia_sorento_2002_2009_lat.png",
        "9EKWh.jpg": "kia_sorento_2002_2009_top.png",
        "Ce5uI.jpg": "kia_sportage_2021_present_lat.png",
        "TM7P4.jpg": "kia_sportage_2021_present_top.png",
    }

    extra_aliases = {
        "kia_sportage_2021_present_lat.png": "kia_sportage_2021_2026_lat.png",
        "kia_sportage_2021_present_top.png": "kia_sportage_2021_2026_top.png",
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

    print("\nLOTE #14 (Sorento XM, Sorento BL, Sportage NQ5) Ingested Successfully!")

if __name__ == "__main__":
    main()
