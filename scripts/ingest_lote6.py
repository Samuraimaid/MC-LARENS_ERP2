import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/hyundai")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "QkRvA.jpg": "hyundai_accent_2005_2011_lat.png",
        "3AwL6.jpg": "hyundai_accent_2005_2011_top.png",
        "k9HTf.jpg": "hyundai_accent_2000_2005_lat.png",
        "konwu.jpg": "hyundai_accent_2000_2005_top.png",
        "qVEl2.jpg": "hyundai_elantra_2020_present_lat.png",
        "D3dwh.jpg": "hyundai_elantra_2020_present_top.png",
    }

    extra_aliases = {
        "hyundai_accent_2005_2011_lat.png": "hyundai_accent_2006_2011_lat.png",
        "hyundai_accent_2005_2011_top.png": "hyundai_accent_2006_2011_top.png",
        "hyundai_elantra_2020_present_lat.png": "hyundai_elantra_2020_2026_lat.png",
        "hyundai_elantra_2020_present_top.png": "hyundai_elantra_2020_2026_top.png",
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

    print("\nLOTE #6 (Accent MC, Accent LC, Elantra CN7) Ingested Successfully!")

if __name__ == "__main__":
    main()
