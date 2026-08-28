import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    mitsu_dir = Path("frontend/public/vehicles/models/mitsubishi")
    mitsu_dir.mkdir(parents=True, exist_ok=True)

    mitsu_mapping = {
        "74RQZ.jpg": "mitsubishi_l200_2005_2015_lat.png",
        "LumVC.jpg": "mitsubishi_l200_2005_2015_top.png",
        "ov0iR.jpg": "mitsubishi_montero_sport_2015_present_lat.png",
        "EGiEW.jpg": "mitsubishi_montero_sport_2015_present_top.png",
        "fXLdk.jpg": "mitsubishi_montero_sport_2008_2015_lat.png",
        "iYmmN.jpg": "mitsubishi_montero_sport_2008_2015_top.png",
    }

    extra_aliases = {
        "mitsubishi_l200_2005_2015_lat.png": "mitsubishi_sportero_2005_2015_lat.png",
        "mitsubishi_l200_2005_2015_top.png": "mitsubishi_sportero_2005_2015_top.png",
        "mitsubishi_montero_sport_2015_present_lat.png": "mitsubishi_montero_sport_2015_2026_lat.png",
        "mitsubishi_montero_sport_2015_present_top.png": "mitsubishi_montero_sport_2015_2026_top.png",
        "mitsubishi_montero_sport_2015_present_lat.png": "mitsubishi_pajero_sport_2015_present_lat.png",
        "mitsubishi_montero_sport_2015_present_top.png": "mitsubishi_pajero_sport_2015_present_top.png",
        "mitsubishi_montero_sport_2008_2015_lat.png": "mitsubishi_pajero_sport_2008_2015_lat.png",
        "mitsubishi_montero_sport_2008_2015_top.png": "mitsubishi_pajero_sport_2008_2015_top.png",
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

    print("\nMITSUBISHI LOTE #2 (L200 Sportero, Montero Sport 3ra & 2da Gen) Ingested Successfully!")

if __name__ == "__main__":
    main()
