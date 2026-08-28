import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    ford_dir = Path("frontend/public/vehicles/models/ford")
    ford_dir.mkdir(parents=True, exist_ok=True)

    ford_mapping = {
        "QkVLF.jpg": "ford_escape_2012_2019_lat.png",
        "Iww60.jpg": "ford_escape_2012_2019_top.png",
        "qxoYr.jpg": "ford_escape_2007_2012_lat.png",
        "s6omq.jpg": "ford_escape_2007_2012_top.png",
        "ikVTF.jpg": "ford_ecosport_2012_2022_lat.png",
        "GNWYd.jpg": "ford_ecosport_2012_2022_top.png",
    }

    extra_aliases = {
        "ford_escape_2012_2019_lat.png": "ford_kuga_2012_2019_lat.png",
        "ford_escape_2012_2019_top.png": "ford_kuga_2012_2019_top.png",
        "ford_escape_2007_2012_lat.png": "ford_escape_clasico_2007_2012_lat.png",
        "ford_escape_2007_2012_top.png": "ford_escape_clasico_2007_2012_top.png",
    }

    for src_name, dest_name in ford_mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = ford_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK Ford] Ingested: {src_name} -> {dest_path} ({im.size})")

    for src_alias, dst_alias in extra_aliases.items():
        s_file = ford_dir / src_alias
        d_file = ford_dir / dst_alias
        if s_file.exists():
            im = Image.open(s_file)
            im.save(d_file, "PNG", optimize=True)
            print(f"[OK Ford Alias] {dst_alias}")

    print("\nFORD LOTE #3 (Escape 3ra Gen, Escape 2da Gen Clásica, EcoSport) Ingested Successfully!")

if __name__ == "__main__":
    main()
