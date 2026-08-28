import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    honda_dir = Path("frontend/public/vehicles/models/honda")
    honda_dir.mkdir(parents=True, exist_ok=True)

    honda_mapping = {
        "OdwKf.jpg": "honda_pilot_2015_2022_lat.png",
        "3Gu4n.jpg": "honda_pilot_2015_2022_top.png",
        "EKBbE.jpg": "honda_pilot_2008_2015_lat.png",
        "x9PkU.jpg": "honda_pilot_2008_2015_top.png",
        "AsWoS.jpg": "honda_odyssey_2017_present_lat.png",
        "9QNxD.jpg": "honda_odyssey_2017_present_top.png",
    }

    extra_aliases = {
        "honda_odyssey_2017_present_lat.png": "honda_odyssey_2017_2026_lat.png",
        "honda_odyssey_2017_present_top.png": "honda_odyssey_2017_2026_top.png",
    }

    for src_name, dest_name in honda_mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = honda_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK Honda] Ingested: {src_name} -> {dest_path} ({im.size})")

    for src_alias, dst_alias in extra_aliases.items():
        s_file = honda_dir / src_alias
        d_file = honda_dir / dst_alias
        if s_file.exists():
            im = Image.open(s_file)
            im.save(d_file, "PNG", optimize=True)
            print(f"[OK Honda Alias] {dst_alias}")

    print("\nHONDA LOTE #6 (Pilot 3ra & 2da Gen, Odyssey) Ingested Successfully!")

if __name__ == "__main__":
    main()
