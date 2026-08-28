import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    chery_dir = Path("frontend/public/vehicles/models/chery")
    chery_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "R1Klv.jpg": "chery_arrizo5_2016_present_lat.png",
        "Zdw1K.jpg": "chery_arrizo5_2016_present_top.png",
        "XQoOU.jpg": "chery_himla_2025_present_lat.png",
        "9EGEk.jpg": "chery_himla_2025_present_top.png",
    }

    extra_aliases = {
        "chery_arrizo5_2016_present_lat.png": [
            "chery_arrizo_5_2016_present_lat.png",
            "chery_arrizo5_pro_2016_present_lat.png",
            "chery_arrizo5_2016_2026_lat.png"
        ],
        "chery_arrizo5_2016_present_top.png": [
            "chery_arrizo_5_2016_present_top.png",
            "chery_arrizo5_pro_2016_present_top.png",
            "chery_arrizo5_2016_2026_top.png"
        ],
        "chery_himla_2025_present_lat.png": [
            "chery_himla_pickup_2025_present_lat.png",
            "chery_kp11_2025_present_lat.png",
            "chery_himla_2025_2026_lat.png"
        ],
        "chery_himla_2025_present_top.png": [
            "chery_himla_pickup_2025_present_top.png",
            "chery_kp11_2025_present_top.png",
            "chery_himla_2025_2026_top.png"
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
        print(f"[OK Chery Extra] Ingested: {src_name} -> {dest_path} ({im.size})")

    for s_file_name, aliases in extra_aliases.items():
        s_path = chery_dir / s_file_name
        if s_path.exists():
            im = Image.open(s_path)
            for d_file_name in aliases:
                d_path = chery_dir / d_file_name
                im.save(d_path, "PNG", optimize=True)
                print(f"[OK Chery Extra Alias] {d_file_name}")

    print("\nCHERY EXTRA MODELS (Arrizo 5 Sedán & Himla Pickup 4x4) Ingested Successfully!")

if __name__ == "__main__":
    main()
