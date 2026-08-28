import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/kia")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "3nxDc.jpg": "kia_rio_sedan_2005_2011_lat.png",
        "NGFoz.jpg": "kia_rio_sedan_2005_2011_top.png",
        "6DKjy.jpg": "kia_rio_2000_2005_lat.png",
        "Du8XQ.jpg": "kia_rio_2000_2005_top.png",
        "YMJpZ.jpg": "kia_picanto_2023_present_lat.png",
        "Kcps0.jpg": "kia_picanto_2023_present_top.png",
    }

    extra_aliases = {
        "kia_rio_sedan_2005_2011_lat.png": "kia_rio_2005_2011_lat.png",
        "kia_rio_sedan_2005_2011_top.png": "kia_rio_2005_2011_top.png",
        "kia_picanto_2023_present_lat.png": "kia_picanto_2023_2026_lat.png",
        "kia_picanto_2023_present_top.png": "kia_picanto_2023_2026_top.png",
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

    print("\nLOTE #18 (Rio JB, Rio DC, Picanto Facelift 2023+) Ingested Successfully!")

if __name__ == "__main__":
    main()
