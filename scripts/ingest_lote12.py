import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/hyundai")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "tG9uf.jpg": "hyundai_porter_double_cab_2004_present_lat.png",
        "ZC6bx.jpg": "hyundai_porter_double_cab_2004_present_top.png",
        "eOhTx.jpg": "hyundai_santa_cruz_2021_present_lat.png",
        "QNaNt.jpg": "hyundai_santa_cruz_2021_present_top.png",
        "vCzwd.jpg": "hyundai_county_2004_present_lat.png",
        "zc9QK.jpg": "hyundai_county_2004_present_top.png",
    }

    extra_aliases = {
        "hyundai_porter_double_cab_2004_present_lat.png": "hyundai_porter_double_cab_2004_2026_lat.png",
        "hyundai_porter_double_cab_2004_present_top.png": "hyundai_porter_double_cab_2004_2026_top.png",
        "hyundai_santa_cruz_2021_present_lat.png": "hyundai_santa_cruz_2021_2026_lat.png",
        "hyundai_santa_cruz_2021_present_top.png": "hyundai_santa_cruz_2021_2026_top.png",
        "hyundai_county_2004_present_lat.png": "hyundai_county_2004_2019_lat.png",
        "hyundai_county_2004_present_top.png": "hyundai_county_2004_2019_top.png",
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

    print("\nLOTE #12 (Porter Doble Cabina, Santa Cruz, County Bus) Ingested Successfully!")

if __name__ == "__main__":
    main()
