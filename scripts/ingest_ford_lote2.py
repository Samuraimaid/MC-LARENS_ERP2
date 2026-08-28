import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    ford_dir = Path("frontend/public/vehicles/models/ford")
    ford_dir.mkdir(parents=True, exist_ok=True)

    ford_mapping = {
        "Dg1Tr.jpg": "ford_explorer_2019_present_lat.png",
        "94WuL.jpg": "ford_explorer_2019_present_top.png",
        "tPTQy.jpg": "ford_explorer_2010_2019_lat.png",
        "LiiXx.jpg": "ford_explorer_2010_2019_top.png",
        "37W2x.jpg": "ford_escape_2019_present_lat.png",
        "jAZwR.jpg": "ford_escape_2019_present_top.png",
    }

    extra_aliases = {
        "ford_explorer_2019_present_lat.png": "ford_explorer_2019_2026_lat.png",
        "ford_explorer_2019_present_top.png": "ford_explorer_2019_2026_top.png",
        "ford_escape_2019_present_lat.png": "ford_escape_2019_2026_lat.png",
        "ford_escape_2019_present_top.png": "ford_escape_2019_2026_top.png",
        "ford_escape_2019_present_lat.png": "ford_kuga_2019_present_lat.png",
        "ford_escape_2019_present_top.png": "ford_kuga_2019_present_top.png",
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

    print("\nFORD LOTE #2 (Explorer 6ta & 5ta Gen, Escape 4ta Gen) Ingested Successfully!")

if __name__ == "__main__":
    main()
