import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    chery_dir = Path("frontend/public/vehicles/models/chery")
    chery_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "PnyoG.jpg": "chery_tiggo2_pro_2020_present_lat.png",
        "Ft39v.jpg": "chery_tiggo2_pro_2020_present_top.png",
        "fO6dW.jpg": "chery_tiggo4_pro_2020_present_lat.png",
        "zxxDk.jpg": "chery_tiggo4_pro_2020_present_top.png",
        "BSmFj.jpg": "chery_tiggo7_2016_present_lat.png",
        "71fiN.jpg": "chery_tiggo7_2016_present_top.png",
        "QG7Bm.jpg": "chery_tiggo8_2018_present_lat.png",
        "hvxul.jpg": "chery_tiggo8_2018_present_top.png",
        "KIoIw.jpg": "chery_tiggo9_pro_2023_present_lat.png",
        "rXmet.jpg": "chery_tiggo9_pro_2023_present_top.png",
    }

    extra_aliases = {
        "chery_tiggo2_pro_2020_present_lat.png": [
            "chery_tiggo_2_pro_2020_present_lat.png",
            "chery_tiggo2_2020_present_lat.png",
            "chery_tiggo2_pro_max_2020_present_lat.png",
            "chery_tiggo2_pro_2020_2026_lat.png"
        ],
        "chery_tiggo2_pro_2020_present_top.png": [
            "chery_tiggo_2_pro_2020_present_top.png",
            "chery_tiggo2_2020_present_top.png",
            "chery_tiggo2_pro_max_2020_present_top.png",
            "chery_tiggo2_pro_2020_2026_top.png"
        ],
        "chery_tiggo4_pro_2020_present_lat.png": [
            "chery_tiggo_4_pro_2020_present_lat.png",
            "chery_tiggo4_2020_present_lat.png",
            "chery_tiggo4_pro_2020_2026_lat.png"
        ],
        "chery_tiggo4_pro_2020_present_top.png": [
            "chery_tiggo_4_pro_2020_present_top.png",
            "chery_tiggo4_2020_present_top.png",
            "chery_tiggo4_pro_2020_2026_top.png"
        ],
        "chery_tiggo7_2016_present_lat.png": [
            "chery_tiggo_7_2016_present_lat.png",
            "chery_tiggo7_pro_2016_present_lat.png",
            "chery_tiggo7_2016_2026_lat.png"
        ],
        "chery_tiggo7_2016_present_top.png": [
            "chery_tiggo_7_2016_present_top.png",
            "chery_tiggo7_pro_2016_present_top.png",
            "chery_tiggo7_2016_2026_top.png"
        ],
        "chery_tiggo8_2018_present_lat.png": [
            "chery_tiggo_8_2018_present_lat.png",
            "chery_tiggo8_pro_2018_present_lat.png",
            "chery_tiggo8_2018_2026_lat.png"
        ],
        "chery_tiggo8_2018_present_top.png": [
            "chery_tiggo_8_2018_present_top.png",
            "chery_tiggo8_pro_2018_present_top.png",
            "chery_tiggo8_2018_2026_top.png"
        ],
        "chery_tiggo9_pro_2023_present_lat.png": [
            "chery_tiggo_9_pro_2023_present_lat.png",
            "chery_tiggo9_2023_present_lat.png",
            "chery_tiggo9_pro_2023_2026_lat.png"
        ],
        "chery_tiggo9_pro_2023_present_top.png": [
            "chery_tiggo_9_pro_2023_present_top.png",
            "chery_tiggo9_2023_present_top.png",
            "chery_tiggo9_pro_2023_2026_top.png"
        ],
    }

    for src_name, dest_name in mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = chery_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK Chery] Ingested: {src_name} -> {dest_path} ({im.size})")

    for s_file_name, aliases in extra_aliases.items():
        s_path = chery_dir / s_file_name
        if s_path.exists():
            im = Image.open(s_path)
            for d_file_name in aliases:
                d_path = chery_dir / d_file_name
                im.save(d_path, "PNG", optimize=True)
                print(f"[OK Chery Alias] {d_file_name}")

    print("\nCHERY TIGGO COMPLETE LINEUP (Tiggo 2 Pro, Tiggo 4 Pro, Tiggo 7 Pro, Tiggo 8 Pro, Tiggo 9 Pro) Ingested Successfully!")

if __name__ == "__main__":
    main()
