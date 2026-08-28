import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    suzuki_dir = Path("frontend/public/vehicles/models/suzuki")
    suzuki_dir.mkdir(parents=True, exist_ok=True)

    suzuki_mapping = {
        "3f3il.jpg": "suzuki_celerio_2014_present_lat.png",
        "Ypc19.jpg": "suzuki_celerio_2014_present_top.png",
        "EHVpu.jpg": "suzuki_apv_van_2004_present_lat.png",
        "7UL0d.jpg": "suzuki_apv_van_2004_present_top.png",
        "Fa3Wl.jpg": "suzuki_apv_pickup_2004_present_lat.png",
        "plG2b.jpg": "suzuki_apv_pickup_2004_present_top.png",
    }

    extra_aliases = {
        "suzuki_celerio_2014_present_lat.png": "suzuki_celerio_2014_2026_lat.png",
        "suzuki_celerio_2014_present_top.png": "suzuki_celerio_2014_2026_top.png",
        "suzuki_apv_van_2004_present_lat.png": "suzuki_apv_2004_2026_lat.png",
        "suzuki_apv_van_2004_present_top.png": "suzuki_apv_2004_2026_top.png",
        "suzuki_apv_pickup_2004_present_lat.png": "suzuki_mega_carry_2004_2026_lat.png",
        "suzuki_apv_pickup_2004_present_top.png": "suzuki_mega_carry_2004_2026_top.png",
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

    print("\nSUZUKI LOTE #4 (Celerio, APV Van, APV Pickup) Ingested Successfully!")

if __name__ == "__main__":
    main()
