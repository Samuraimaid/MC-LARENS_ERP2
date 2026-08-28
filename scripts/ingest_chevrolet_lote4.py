import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    chevy_dir = Path("frontend/public/vehicles/models/chevrolet")
    chevy_dir.mkdir(parents=True, exist_ok=True)

    chevy_mapping = {
        "f9DBZ.jpg": "chevrolet_n300_move_2012_present_lat.png",
        "lCy39.jpg": "chevrolet_n300_move_2012_present_top.png",
        "s9MNg.jpg": "chevrolet_colorado_2015_present_lat.png",
        "6vEZN.jpg": "chevrolet_colorado_2015_present_top.png",
        "NjyVy.jpg": "chevrolet_tahoe_2020_present_lat.png",
        "13xJj.jpg": "chevrolet_tahoe_2020_present_top.png",
    }

    extra_aliases = {
        "chevrolet_n300_move_2012_present_lat.png": "chevrolet_n300_cargo_2012_present_lat.png",
        "chevrolet_n300_move_2012_present_top.png": "chevrolet_n300_cargo_2012_present_top.png",
        "chevrolet_n300_move_2012_present_lat.png": "chevrolet_n400_cargo_2012_present_lat.png",
        "chevrolet_n300_move_2012_present_top.png": "chevrolet_n400_cargo_2012_present_top.png",
        "chevrolet_colorado_2015_present_lat.png": "chevrolet_colorado_2015_2026_lat.png",
        "chevrolet_colorado_2015_present_top.png": "chevrolet_colorado_2015_2026_top.png",
        "chevrolet_colorado_2015_present_lat.png": "chevrolet_dmax_2015_present_lat.png",
        "chevrolet_colorado_2015_present_top.png": "chevrolet_dmax_2015_present_top.png",
        "chevrolet_tahoe_2020_present_lat.png": "chevrolet_suburban_2020_present_lat.png",
        "chevrolet_tahoe_2020_present_top.png": "chevrolet_suburban_2020_present_top.png",
        "chevrolet_tahoe_2020_present_lat.png": "chevrolet_tahoe_2020_2026_lat.png",
        "chevrolet_tahoe_2020_present_top.png": "chevrolet_tahoe_2020_2026_top.png",
    }

    for src_name, dest_name in chevy_mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = chevy_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK Chevrolet] Ingested: {src_name} -> {dest_path} ({im.size})")

    for src_alias, dst_alias in extra_aliases.items():
        s_file = chevy_dir / src_alias
        d_file = chevy_dir / dst_alias
        if s_file.exists():
            im = Image.open(s_file)
            im.save(d_file, "PNG", optimize=True)
            print(f"[OK Chevrolet Alias] {dst_alias}")

    print("\nCHEVROLET LOTE #4 (N300 Move Cargo, Colorado 4x4, Tahoe/Suburban) Ingested Successfully!")

if __name__ == "__main__":
    main()
