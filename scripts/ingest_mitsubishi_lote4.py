import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    mitsu_dir = Path("frontend/public/vehicles/models/mitsubishi")
    mitsu_dir.mkdir(parents=True, exist_ok=True)

    mitsu_mapping = {
        "thneG.jpg": "mitsubishi_mirage_g4_2013_present_lat.png",
        "z6Zhw.jpg": "mitsubishi_mirage_g4_2013_present_top.png",
        "r0zWd.jpg": "mitsubishi_mirage_2012_present_lat.png",
        "KPCWF.jpg": "mitsubishi_mirage_2012_present_top.png",
        "bWGf2.jpg": "mitsubishi_asx_2010_present_lat.png",
        "D8Bij.jpg": "mitsubishi_asx_2010_present_top.png",
    }

    extra_aliases = {
        "mitsubishi_mirage_g4_2013_present_lat.png": "mitsubishi_attrage_2013_present_lat.png",
        "mitsubishi_mirage_g4_2013_present_top.png": "mitsubishi_attrage_2013_present_top.png",
        "mitsubishi_mirage_g4_2013_present_lat.png": "mitsubishi_mirage_g4_2013_2026_lat.png",
        "mitsubishi_mirage_g4_2013_present_top.png": "mitsubishi_mirage_g4_2013_2026_top.png",
        "mitsubishi_mirage_2012_present_lat.png": "mitsubishi_mirage_2012_2026_lat.png",
        "mitsubishi_mirage_2012_present_top.png": "mitsubishi_mirage_2012_2026_top.png",
        "mitsubishi_asx_2010_present_lat.png": "mitsubishi_outlander_sport_2010_present_lat.png",
        "mitsubishi_asx_2010_present_top.png": "mitsubishi_outlander_sport_2010_present_top.png",
        "mitsubishi_asx_2010_present_lat.png": "mitsubishi_asx_2010_2026_lat.png",
        "mitsubishi_asx_2010_present_top.png": "mitsubishi_asx_2010_2026_top.png",
    }

    for src_name, dest_name in mitsu_mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = mitsu_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK Mitsubishi] Ingested: {src_name} -> {dest_path} ({im.size})")

    for src_alias, dst_alias in extra_aliases.items():
        s_file = mitsu_dir / src_alias
        d_file = mitsu_dir / dst_alias
        if s_file.exists():
            im = Image.open(s_file)
            im.save(d_file, "PNG", optimize=True)
            print(f"[OK Mitsubishi Alias] {dst_alias}")

    print("\nMITSUBISHI LOTE #4 (Mirage G4, Mirage Hatchback, ASX) Ingested Successfully!")

if __name__ == "__main__":
    main()
