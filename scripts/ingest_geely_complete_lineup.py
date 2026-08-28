import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    geely_dir = Path("frontend/public/vehicles/models/geely")
    geely_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "jfKR7.jpg": "geely_emgrand_2021_present_lat.png",
        "XOTI8.jpg": "geely_emgrand_2021_present_top.png",
        "bm6uI.jpg": "geely_gx3_pro_2017_present_lat.png",
        "XyWHl.jpg": "geely_gx3_pro_2017_present_top.png",
        "fIVYT.jpg": "geely_coolray_2018_present_lat.png",
        "MOibV.jpg": "geely_coolray_2018_present_top.png",
        "TN9uA.jpg": "geely_coolray_neo_2023_present_lat.png",
        "5DyuC.jpg": "geely_coolray_neo_2023_present_top.png",
        "nPu9p.jpg": "geely_cityray_2024_present_lat.png",
        "mJGms.jpg": "geely_cityray_2024_present_top.png",
        "5dpTX.jpg": "geely_starray_2023_present_lat.png",
        "1RmOe.jpg": "geely_starray_2023_present_top.png",
        "Pq35U.jpg": "geely_okavango_2020_present_lat.png",
        "W0p2a.jpg": "geely_okavango_2020_present_top.png",
    }

    extra_aliases = {
        "geely_emgrand_2021_present_lat.png": [
            "geely_emgrand_sedan_2021_present_lat.png",
            "geely_emgrand_2021_2026_lat.png"
        ],
        "geely_emgrand_2021_present_top.png": [
            "geely_emgrand_sedan_2021_present_top.png",
            "geely_emgrand_2021_2026_top.png"
        ],
        "geely_gx3_pro_2017_present_lat.png": [
            "geely_gx3_2017_present_lat.png",
            "geely_emgrand_x3_2017_present_lat.png",
            "geely_gx3_pro_2017_2026_lat.png",
            "geely_gx3pro_2017_present_lat.png"
        ],
        "geely_gx3_pro_2017_present_top.png": [
            "geely_gx3_2017_present_top.png",
            "geely_emgrand_x3_2017_present_top.png",
            "geely_gx3_pro_2017_2026_top.png",
            "geely_gx3pro_2017_present_top.png"
        ],
        "geely_coolray_2018_present_lat.png": [
            "geely_coolray_2019_present_lat.png",
            "geely_coolray_2018_2026_lat.png",
            "geely_coolray_2019_2026_lat.png"
        ],
        "geely_coolray_2018_present_top.png": [
            "geely_coolray_2019_present_top.png",
            "geely_coolray_2018_2026_top.png",
            "geely_coolray_2019_2026_top.png"
        ],
        "geely_coolray_neo_2023_present_lat.png": [
            "geely_coolray_neo_2023_2026_lat.png"
        ],
        "geely_coolray_neo_2023_present_top.png": [
            "geely_coolray_neo_2023_2026_top.png"
        ],
        "geely_cityray_2024_present_lat.png": [
            "geely_cityray_2024_2026_lat.png"
        ],
        "geely_cityray_2024_present_top.png": [
            "geely_cityray_2024_2026_top.png"
        ],
        "geely_starray_2023_present_lat.png": [
            "geely_starray_2023_2026_lat.png"
        ],
        "geely_starray_2023_present_top.png": [
            "geely_starray_2023_2026_top.png"
        ],
        "geely_okavango_2020_present_lat.png": [
            "geely_okavango_2020_2026_lat.png"
        ],
        "geely_okavango_2020_present_top.png": [
            "geely_okavango_2020_2026_top.png"
        ],
    }

    for src_name, dest_name in mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = geely_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK Geely] Ingested: {src_name} -> {dest_path} ({im.size})")

    for s_file_name, aliases in extra_aliases.items():
        s_path = geely_dir / s_file_name
        if s_path.exists():
            im = Image.open(s_path)
            for d_file_name in aliases:
                d_path = geely_dir / d_file_name
                im.save(d_path, "PNG", optimize=True)
                print(f"[OK Geely Alias] {d_file_name}")

    print("\nGEELY COMPLETE LINEUP (Emgrand, GX3 Pro, Coolray, Coolray Neo, Cityray, Starray, Okavango) Ingested Successfully!")

if __name__ == "__main__":
    main()
