import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    mazda_dir = Path("frontend/public/vehicles/models/mazda")
    mazda_dir.mkdir(parents=True, exist_ok=True)

    mazda_mapping = {
        "3e7EB.jpg": "mazda_3_sedan_2019_present_lat.png",
        "7yFTG.jpg": "mazda_3_sedan_2019_present_top.png",
        "7658o.jpg": "mazda_3_sedan_2013_2019_lat.png",
        "v0fgy.jpg": "mazda_3_sedan_2013_2019_top.png",
        "HCxbg.jpg": "mazda_2_2014_present_lat.png",
        "m5scO.jpg": "mazda_2_2014_present_top.png",
    }

    extra_aliases = {
        "mazda_3_sedan_2019_present_lat.png": [
            "mazda_3_sedan_2019_2026_lat.png",
            "mazda_3_2019_present_lat.png",
            "mazda_3_sedan_bp_2019_present_lat.png"
        ],
        "mazda_3_sedan_2019_present_top.png": [
            "mazda_3_sedan_2019_2026_top.png",
            "mazda_3_2019_present_top.png",
            "mazda_3_sedan_bp_2019_present_top.png"
        ],
        "mazda_3_sedan_2013_2019_lat.png": [
            "mazda_3_2013_2019_lat.png",
            "mazda_3_sedan_bm_bn_2013_2019_lat.png"
        ],
        "mazda_3_sedan_2013_2019_top.png": [
            "mazda_3_2013_2019_top.png",
            "mazda_3_sedan_bm_bn_2013_2019_top.png"
        ],
        "mazda_2_2014_present_lat.png": [
            "mazda_2_sedan_2014_present_lat.png",
            "mazda_2_hatchback_2014_present_lat.png",
            "mazda_2_2014_2026_lat.png",
            "mazda_2_dj_2014_present_lat.png"
        ],
        "mazda_2_2014_present_top.png": [
            "mazda_2_sedan_2014_present_top.png",
            "mazda_2_hatchback_2014_present_top.png",
            "mazda_2_2014_2026_top.png",
            "mazda_2_dj_2014_present_top.png"
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

    print("\nMAZDA LOTE #4 (Mazda 3 4ta Gen BP, Mazda 3 3ra Gen BM/BN, Mazda 2 DJ) Ingested Successfully!")

if __name__ == "__main__":
    main()
