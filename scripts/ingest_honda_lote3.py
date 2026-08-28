import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    honda_dir = Path("frontend/public/vehicles/models/honda")
    honda_dir.mkdir(parents=True, exist_ok=True)

    honda_mapping = {
        "YOQfV.jpg": "honda_crv_2006_2011_lat.png",
        "Zydet.jpg": "honda_crv_2006_2011_top.png",
        "Dw90z.jpg": "honda_crv_2001_2006_lat.png",
        "YBY3B.jpg": "honda_crv_2001_2006_top.png",
        "vUoNV.jpg": "honda_fit_2013_2020_lat.png",
        "kdVcl.jpg": "honda_fit_2013_2020_top.png",
    }

    extra_aliases = {
        "honda_fit_2013_2020_lat.png": "honda_jazz_2013_2020_lat.png",
        "honda_fit_2013_2020_top.png": "honda_jazz_2013_2020_top.png",
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

    print("\nHONDA LOTE #3 (CR-V 3ra, 2da Gen & Fit GK) Ingested Successfully!")

if __name__ == "__main__":
    main()
