import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    suzuki_dir = Path("frontend/public/vehicles/models/suzuki")
    suzuki_dir.mkdir(parents=True, exist_ok=True)

    suzuki_mapping = {
        "XwY4L.jpg": "suzuki_ignis_2016_present_lat.png",
        "JTbzT.jpg": "suzuki_ignis_2016_present_top.png",
        "Rf8MU.jpg": "suzuki_fronx_2023_present_lat.png",
        "MsY5K.jpg": "suzuki_fronx_2023_present_top.png",
        "IvAx2.jpg": "suzuki_alto_1998_2012_lat.png",
        "ju5cq.jpg": "suzuki_alto_1998_2012_top.png",
    }

    extra_aliases = {
        "suzuki_ignis_2016_present_lat.png": "suzuki_ignis_2016_2026_lat.png",
        "suzuki_ignis_2016_present_top.png": "suzuki_ignis_2016_2026_top.png",
        "suzuki_fronx_2023_present_lat.png": "suzuki_fronx_2023_2026_lat.png",
        "suzuki_fronx_2023_present_top.png": "suzuki_fronx_2023_2026_top.png",
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

    print("\nSUZUKI LOTE #6 (Ignis MF, Fronx Coupé, Alto Clásico) Ingested Successfully!")

if __name__ == "__main__":
    main()
