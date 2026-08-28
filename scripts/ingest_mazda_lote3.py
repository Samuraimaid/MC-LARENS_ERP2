import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    mazda_dir = Path("frontend/public/vehicles/models/mazda")
    mazda_dir.mkdir(parents=True, exist_ok=True)

    mazda_mapping = {
        "0Ry79.jpg": "mazda_bt50_2011_2020_lat.png",
        "drPMS.jpg": "mazda_bt50_2011_2020_top.png",
        "NZYBE.jpg": "mazda_cx5_2017_present_lat.png",
        "SHtPY.jpg": "mazda_cx5_2017_present_top.png",
        "q2L8N.jpg": "mazda_cx30_2019_present_lat.png",
        "e5VOc.jpg": "mazda_cx30_2019_present_top.png",
    }

    extra_aliases = {
        "mazda_bt50_2011_2020_lat.png": [
            "mazda_bt-50_2011_2020_lat.png",
            "mazda_bt50_up_ur_2011_2020_lat.png"
        ],
        "mazda_bt50_2011_2020_top.png": [
            "mazda_bt-50_2011_2020_top.png",
            "mazda_bt50_up_ur_2011_2020_top.png"
        ],
        "mazda_cx5_2017_present_lat.png": [
            "mazda_cx-5_2017_present_lat.png",
            "mazda_cx5_2017_2026_lat.png",
            "mazda_cx-5_2017_2026_lat.png"
        ],
        "mazda_cx5_2017_present_top.png": [
            "mazda_cx-5_2017_present_top.png",
            "mazda_cx5_2017_2026_top.png",
            "mazda_cx-5_2017_2026_top.png"
        ],
        "mazda_cx30_2019_present_lat.png": [
            "mazda_cx-30_2019_present_lat.png",
            "mazda_cx30_2019_2026_lat.png",
            "mazda_cx-30_2019_2026_lat.png"
        ],
        "mazda_cx30_2019_present_top.png": [
            "mazda_cx-30_2019_present_top.png",
            "mazda_cx30_2019_2026_top.png",
            "mazda_cx-30_2019_2026_top.png"
        ],
    }

    for src_name, dest_name in mazda_mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = mazda_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK Mazda] Ingested: {src_name} -> {dest_path} ({im.size})")

    for s_file_name, aliases in extra_aliases.items():
        s_path = mazda_dir / s_file_name
        if s_path.exists():
            im = Image.open(s_path)
            for d_file_name in aliases:
                d_path = mazda_dir / d_file_name
                im.save(d_path, "PNG", optimize=True)
                print(f"[OK Mazda Alias] {d_file_name}")

    print("\nMAZDA LOTE #3 (BT-50 2da Gen, CX-5 2da Gen, CX-30) Ingested Successfully!")

if __name__ == "__main__":
    main()
