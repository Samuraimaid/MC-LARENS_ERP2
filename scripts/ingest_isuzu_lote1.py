import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    isuzu_dir = Path("frontend/public/vehicles/models/isuzu")
    isuzu_dir.mkdir(parents=True, exist_ok=True)

    isuzu_mapping = {
        "6VA8p.jpg": "isuzu_dmax_2019_present_lat.png",
        "9YdT2.jpg": "isuzu_dmax_2019_present_top.png",
        "YDkyn.jpg": "isuzu_dmax_2012_2019_lat.png",
        "vDW6B.jpg": "isuzu_dmax_2012_2019_top.png",
        "MiWhw.jpg": "isuzu_dmax_2002_2012_lat.png",
        "4d2vY.jpg": "isuzu_dmax_2002_2012_top.png",
    }

    extra_aliases = {
        "isuzu_dmax_2019_present_lat.png": "isuzu_dmax_2019_2026_lat.png",
        "isuzu_dmax_2019_present_top.png": "isuzu_dmax_2019_2026_top.png",
        "isuzu_dmax_2012_2019_lat.png": "isuzu_dmax_rt50_2012_2019_lat.png",
        "isuzu_dmax_2012_2019_top.png": "isuzu_dmax_rt50_2012_2019_top.png",
        "isuzu_dmax_2002_2012_lat.png": "isuzu_dmax_ra_2002_2012_lat.png",
        "isuzu_dmax_2002_2012_top.png": "isuzu_dmax_ra_2002_2012_top.png",
    }

    for src_name, dest_name in isuzu_mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = isuzu_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK Isuzu] Ingested: {src_name} -> {dest_path} ({im.size})")

    for src_alias, dst_alias in extra_aliases.items():
        s_file = isuzu_dir / src_alias
        d_file = isuzu_dir / dst_alias
        if s_file.exists():
            im = Image.open(s_file)
            im.save(d_file, "PNG", optimize=True)
            print(f"[OK Isuzu Alias] {dst_alias}")

    print("\nISUZU LOTE #1 (D-Max 3ra, 2da y 1ra Gen) Ingested Successfully!")

if __name__ == "__main__":
    main()
