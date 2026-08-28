import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    suzuki_dir = Path("frontend/public/vehicles/models/suzuki")
    kia_dir = Path("frontend/public/vehicles/models/kia")
    suzuki_dir.mkdir(parents=True, exist_ok=True)
    kia_dir.mkdir(parents=True, exist_ok=True)

    # Ingest Suzuki Lote 1
    suzuki_mapping = {
        "2yu2W.jpg": "suzuki_spresso_2019_present_lat.png",
        "iVpap.jpg": "suzuki_spresso_2019_present_top.png",
        "ux5Vc.jpg": "suzuki_swift_2017_present_lat.png",
        "IsT7N.jpg": "suzuki_swift_2017_present_top.png",
        "XGi50.jpg": "suzuki_jimny_2018_present_lat.png",
        "WNklx.jpg": "suzuki_jimny_2018_present_top.png",
    }

    suzuki_extra_aliases = {
        "suzuki_spresso_2019_present_lat.png": "suzuki_spresso_2019_2026_lat.png",
        "suzuki_spresso_2019_present_top.png": "suzuki_spresso_2019_2026_top.png",
        "suzuki_swift_2017_present_lat.png": "suzuki_swift_2017_2026_lat.png",
        "suzuki_swift_2017_present_top.png": "suzuki_swift_2017_2026_top.png",
        "suzuki_jimny_2018_present_lat.png": "suzuki_jimny_2018_2026_lat.png",
        "suzuki_jimny_2018_present_top.png": "suzuki_jimny_2018_2026_top.png",
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

    for src_alias, dst_alias in suzuki_extra_aliases.items():
        s_file = suzuki_dir / src_alias
        d_file = suzuki_dir / dst_alias
        if s_file.exists():
            im = Image.open(s_file)
            im.save(d_file, "PNG", optimize=True)
            print(f"[OK Suzuki Alias] {dst_alias}")

    # Also ingest Kia Soluto if present
    kia_soluto_mapping = {
        "FkpVR.jpg": "kia_soluto_2019_present_lat.png",
        "ac8Kj.jpg": "kia_soluto_2019_present_top.png",
    }
    for src_name, dest_name in kia_soluto_mapping.items():
        src_path = dl / src_name
        if src_path.exists():
            im = Image.open(src_path)
            dest_path = kia_dir / dest_name
            im.save(dest_path, "PNG", optimize=True)
            print(f"[OK Kia Soluto] Ingested: {src_name} -> {dest_path} ({im.size})")

    print("\nSUZUKI LOTE #1 (S-Presso, Swift A2L, Jimny JB74) & Kia Soluto Ingested Successfully!")

if __name__ == "__main__":
    main()
