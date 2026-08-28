import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    honda_dir = Path("frontend/public/vehicles/models/honda")
    honda_dir.mkdir(parents=True, exist_ok=True)

    honda_mapping = {
        "0cad2.jpg": "honda_crv_2022_present_lat.png",
        "XaV4K.jpg": "honda_crv_2022_present_top.png",
        "FW9cH.jpg": "honda_crv_2016_2022_lat.png",
        "hKJ5i.jpg": "honda_crv_2016_2022_top.png",
        "yOSMR.jpg": "honda_crv_2011_2016_lat.png",
        "dxed9.jpg": "honda_crv_2011_2016_top.png",
    }

    extra_aliases = {
        "honda_crv_2022_present_lat.png": "honda_crv_2022_2026_lat.png",
        "honda_crv_2022_present_top.png": "honda_crv_2022_2026_top.png",
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

    print("\nHONDA LOTE #2 (CR-V 6ta, 5ta y 4ta Gen) Ingested Successfully!")

if __name__ == "__main__":
    main()
