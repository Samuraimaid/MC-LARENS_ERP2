import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    suzuki_dir = Path("frontend/public/vehicles/models/suzuki")
    suzuki_dir.mkdir(parents=True, exist_ok=True)

    suzuki_mapping = {
        "zPRIk.jpg": "suzuki_vitara_2015_present_lat.png",
        "jfarS.jpg": "suzuki_vitara_2015_present_top.png",
        "vXoUh.jpg": "suzuki_grand_vitara_2005_2015_lat.png",
        "F5TA9.jpg": "suzuki_grand_vitara_2005_2015_top.png",
        "id14J.jpg": "suzuki_alto_2012_present_lat.png",
        "TgVto.jpg": "suzuki_alto_2012_present_top.png",
    }

    extra_aliases = {
        "suzuki_vitara_2015_present_lat.png": "suzuki_vitara_2015_2026_lat.png",
        "suzuki_vitara_2015_present_top.png": "suzuki_vitara_2015_2026_top.png",
        "suzuki_alto_2012_present_lat.png": "suzuki_alto_k10_2012_2026_lat.png",
        "suzuki_alto_2012_present_top.png": "suzuki_alto_k10_2012_2026_top.png",
        "suzuki_alto_2012_present_lat.png": "suzuki_alto_800_2012_2026_lat.png",
        "suzuki_alto_2012_present_top.png": "suzuki_alto_800_2012_2026_top.png",
    }

    for src_name, dest_name in suzuki_mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = suzuki_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK Suzuki] Ingested: {src_name} -> {dest_path} ({im.size})")

    for src_alias, dst_alias in extra_aliases.items():
        s_file = suzuki_dir / src_alias
        d_file = suzuki_dir / dst_alias
        if s_file.exists():
            im = Image.open(s_file)
            im.save(d_file, "PNG", optimize=True)
            print(f"[OK Suzuki Alias] {dst_alias}")

    print("\nSUZUKI LOTE #2 (Vitara LY, Grand Vitara JT, Alto 800/K10) Ingested Successfully!")

if __name__ == "__main__":
    main()
