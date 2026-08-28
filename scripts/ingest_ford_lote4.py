import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    ford_dir = Path("frontend/public/vehicles/models/ford")
    ford_dir.mkdir(parents=True, exist_ok=True)

    ford_mapping = {
        "xWBaQ.jpg": "ford_f150_2020_present_lat.png",
        "VCxoc.jpg": "ford_f150_2020_present_top.png",
        "Uv8Ol.jpg": "ford_everest_2015_present_lat.png",
        "02SdO.jpg": "ford_everest_2015_present_top.png",
        "vCPAZ.jpg": "ford_transit_2014_present_lat.png",
        "1BjoF.jpg": "ford_transit_2014_present_top.png",
    }

    extra_aliases = {
        "ford_f150_2020_present_lat.png": "ford_f150_2020_2026_lat.png",
        "ford_f150_2020_present_top.png": "ford_f150_2020_2026_top.png",
        "ford_everest_2015_present_lat.png": "ford_everest_2015_2026_lat.png",
        "ford_everest_2015_present_top.png": "ford_everest_2015_2026_top.png",
        "ford_everest_2015_present_lat.png": "ford_endeavour_2015_present_lat.png",
        "ford_everest_2015_present_top.png": "ford_endeavour_2015_present_top.png",
        "ford_transit_2014_present_lat.png": "ford_transit_custom_2014_present_lat.png",
        "ford_transit_2014_present_top.png": "ford_transit_custom_2014_present_top.png",
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

    print("\nFORD LOTE #4 (F-150 SuperCrew, Everest 4x4, Transit Custom) Ingested Successfully!")

if __name__ == "__main__":
    main()
