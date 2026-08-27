import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/hyundai")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "Ib3Yr.jpg": "hyundai_h1_grand_starex_2007_2021_lat.png",
        "M40rc.jpg": "hyundai_h1_grand_starex_2007_2021_top.png",
        "N9oLf.jpg": "hyundai_h1_starex_1997_2007_lat.png",
        "labRO.jpg": "hyundai_h1_starex_1997_2007_top.png",
        "iTZ3e.jpg": "hyundai_porter_h100_2004_present_lat.png",
        "UHKSD.jpg": "hyundai_porter_h100_2004_present_top.png",
    }

    extra_aliases = {
        "hyundai_porter_h100_2004_present_lat.png": "hyundai_porter_h100_2004_2026_lat.png",
        "hyundai_porter_h100_2004_present_top.png": "hyundai_porter_h100_2004_2026_top.png",
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

    print("\nLOTE #11 (H-1 Grand Starex TQ, H-1 A1, Porter H100) Ingested Successfully!")

if __name__ == "__main__":
    main()
