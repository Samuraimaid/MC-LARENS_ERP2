import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    dest_dir = Path("frontend/public/vehicles/models/kia")
    dest_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "w036D.jpg": "kia_rio_sedan_2017_2023_lat.png",
        "Fb2AK.jpg": "kia_rio_sedan_2017_2023_top.png",
        "wK75m.jpg": "kia_rio_hatchback_2017_2023_lat.png",
        "DXoP4.jpg": "kia_rio_hatchback_2017_2023_top.png",
        "vwQ9o.jpg": "kia_rio_sedan_2011_2017_lat.png",
        "ZFy7q.jpg": "kia_rio_sedan_2011_2017_top.png",
    }

    extra_aliases = {
        "kia_rio_sedan_2017_2023_lat.png": "kia_rio_2017_2023_lat.png",
        "kia_rio_sedan_2017_2023_top.png": "kia_rio_2017_2023_top.png",
        "kia_rio_sedan_2011_2017_lat.png": "kia_rio_2011_2017_lat.png",
        "kia_rio_sedan_2011_2017_top.png": "kia_rio_2011_2017_top.png",
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

    print("\nLOTE #17 (Rio Sedán YB, Rio Hatchback YB, Rio Sedán UB) Ingested Successfully!")

if __name__ == "__main__":
    main()
