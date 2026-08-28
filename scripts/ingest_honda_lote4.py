import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    honda_dir = Path("frontend/public/vehicles/models/honda")
    honda_dir.mkdir(parents=True, exist_ok=True)

    honda_mapping = {
        "gY3LA.jpg": "honda_fit_2007_2014_lat.png",
        "GX5XB.jpg": "honda_fit_2007_2014_top.png",
        "TRgFz.jpg": "honda_hrv_2021_present_lat.png",
        "JWeEZ.jpg": "honda_hrv_2021_present_top.png",
        "GRm1X.jpg": "honda_hrv_2015_2021_lat.png",
        "wisgJ.jpg": "honda_hrv_2015_2021_top.png",
    }

    extra_aliases = {
        "honda_fit_2007_2014_lat.png": "honda_jazz_2007_2014_lat.png",
        "honda_fit_2007_2014_top.png": "honda_jazz_2007_2014_top.png",
        "honda_hrv_2021_present_lat.png": "honda_hrv_2021_2026_lat.png",
        "honda_hrv_2021_present_top.png": "honda_hrv_2021_2026_top.png",
        "honda_hrv_2015_2021_lat.png": "honda_vezel_2015_2021_lat.png",
        "honda_hrv_2015_2021_top.png": "honda_vezel_2015_2021_top.png",
    }

    for src_name, dest_name in honda_mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = honda_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK Honda] Ingested: {src_name} -> {dest_path} ({im.size})")

    for src_alias, dst_alias in extra_aliases.items():
        s_file = honda_dir / src_alias
        d_file = honda_dir / dst_alias
        if s_file.exists():
            im = Image.open(s_file)
            im.save(d_file, "PNG", optimize=True)
            print(f"[OK Honda Alias] {dst_alias}")

    print("\nHONDA LOTE #4 (Fit GE, HR-V RV, HR-V RU) Ingested Successfully!")

if __name__ == "__main__":
    main()
