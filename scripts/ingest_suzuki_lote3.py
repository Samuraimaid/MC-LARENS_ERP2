import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    suzuki_dir = Path("frontend/public/vehicles/models/suzuki")
    suzuki_dir.mkdir(parents=True, exist_ok=True)

    suzuki_mapping = {
        "q4z35.jpg": "suzuki_ertiga_2018_present_lat.png",
        "DB4ro.jpg": "suzuki_ertiga_2018_present_top.png",
        "y7eja.jpg": "suzuki_dzire_2017_present_lat.png",
        "xhW6W.jpg": "suzuki_dzire_2017_present_top.png",
        "n4iqE.jpg": "suzuki_baleno_2015_present_lat.png",
        "phS7N.jpg": "suzuki_baleno_2015_present_top.png",
    }

    extra_aliases = {
        "suzuki_ertiga_2018_present_lat.png": "suzuki_ertiga_2018_2026_lat.png",
        "suzuki_ertiga_2018_present_top.png": "suzuki_ertiga_2018_2026_top.png",
        "suzuki_dzire_2017_present_lat.png": "suzuki_dzire_2017_2026_lat.png",
        "suzuki_dzire_2017_present_top.png": "suzuki_dzire_2017_2026_top.png",
        "suzuki_baleno_2015_present_lat.png": "suzuki_baleno_2015_2026_lat.png",
        "suzuki_baleno_2015_present_top.png": "suzuki_baleno_2015_2026_top.png",
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

    print("\nSUZUKI LOTE #3 (Ertiga NC, Dzire Sedán, Baleno) Ingested Successfully!")

if __name__ == "__main__":
    main()
