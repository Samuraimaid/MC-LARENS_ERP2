import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    chevy_dir = Path("frontend/public/vehicles/models/chevrolet")
    chevy_dir.mkdir(parents=True, exist_ok=True)

    chevy_mapping = {
        "HOm47.jpg": "chevrolet_cruze_2016_2023_lat.png",
        "hhDuB.jpg": "chevrolet_cruze_2016_2023_top.png",
        "s9wlp.jpg": "chevrolet_cruze_2009_2016_lat.png",
        "6VF3R.jpg": "chevrolet_cruze_2009_2016_top.png",
        "fzf9A.jpg": "chevrolet_n300_2012_present_lat.png",
        "s6OjV.jpg": "chevrolet_n300_2012_present_top.png",
    }

    extra_aliases = {
        "chevrolet_n300_2012_present_lat.png": "chevrolet_n300_2012_2026_lat.png",
        "chevrolet_n300_2012_present_top.png": "chevrolet_n300_2012_2026_top.png",
        "chevrolet_n300_2012_present_lat.png": "chevrolet_n400_2012_present_lat.png",
        "chevrolet_n300_2012_present_top.png": "chevrolet_n400_2012_present_top.png",
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

    print("\nCHEVROLET LOTE #3 (Cruze 2da & 1ra Gen, N300/N400 Pasajeros) Ingested Successfully!")

if __name__ == "__main__":
    main()
