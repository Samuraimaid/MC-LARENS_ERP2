import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    chevy_dir = Path("frontend/public/vehicles/models/chevrolet")
    chevy_dir.mkdir(parents=True, exist_ok=True)

    chevy_mapping = {
        "UHEFo.jpg": "chevrolet_tracker_2020_present_lat.png",
        "kNjqM.jpg": "chevrolet_tracker_2020_present_top.png",
        "vYI5K.jpg": "chevrolet_tracker_2013_2020_lat.png",
        "wjYI8.jpg": "chevrolet_tracker_2013_2020_top.png",
        "ZFuUK.jpg": "chevrolet_spark_2016_2022_lat.png",
        "CWcWW.jpg": "chevrolet_spark_2016_2022_top.png",
    }

    extra_aliases = {
        "chevrolet_tracker_2020_present_lat.png": "chevrolet_tracker_2020_2026_lat.png",
        "chevrolet_tracker_2020_present_top.png": "chevrolet_tracker_2020_2026_top.png",
        "chevrolet_tracker_2013_2020_lat.png": "chevrolet_trax_2013_2020_lat.png",
        "chevrolet_tracker_2013_2020_top.png": "chevrolet_trax_2013_2020_top.png",
        "chevrolet_spark_2016_2022_lat.png": "chevrolet_beat_2016_2022_lat.png",
        "chevrolet_spark_2016_2022_top.png": "chevrolet_beat_2016_2022_top.png",
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

    print("\nCHEVROLET LOTE #1 (Tracker 4ta, Trax 3ra, Spark M400/Beat) Ingested Successfully!")

if __name__ == "__main__":
    main()
