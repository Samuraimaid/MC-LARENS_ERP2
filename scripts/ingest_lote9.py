import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/hyundai")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "17Jc0.jpg": "hyundai_i10_2007_2013_lat.png",
        "WgfPq.jpg": "hyundai_i10_2007_2013_top.png",
        "aU1yw.jpg": "hyundai_venue_2019_present_lat.png",
        "yDx2w.jpg": "hyundai_venue_2019_present_top.png",
        "uSR7W.jpg": "hyundai_kona_2023_present_lat.png",
        "sAo00.jpg": "hyundai_kona_2023_present_top.png",
    }

    extra_aliases = {
        "hyundai_venue_2019_present_lat.png": "hyundai_venue_2019_2026_lat.png",
        "hyundai_venue_2019_present_top.png": "hyundai_venue_2019_2026_top.png",
        "hyundai_kona_2023_present_lat.png": "hyundai_kona_2023_2026_lat.png",
        "hyundai_kona_2023_present_top.png": "hyundai_kona_2023_2026_top.png",
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

    print("\nLOTE #9 (i10 PA, Venue, Kona SX2) Ingested Successfully!")

if __name__ == "__main__":
    main()
