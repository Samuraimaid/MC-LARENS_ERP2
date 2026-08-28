import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    vw_dir = Path("frontend/public/vehicles/models/volkswagen")
    vw_dir.mkdir(parents=True, exist_ok=True)

    vw_mapping = {
        "j1VxW.jpg": "volkswagen_amarok_2010_present_lat.png",
        "CFU17.jpg": "volkswagen_amarok_2010_present_top.png",
        "Ui37M.jpg": "volkswagen_tcross_2019_present_lat.png",
        "Ae6EA.jpg": "volkswagen_tcross_2019_present_top.png",
        "ZJ8zW.jpg": "volkswagen_gol_2008_2023_lat.png",
        "85RxL.jpg": "volkswagen_gol_2008_2023_top.png",
    }

    extra_aliases = {
        "volkswagen_amarok_2010_present_lat.png": [
            "volkswagen_amarok_2010_2026_lat.png",
            "vw_amarok_2010_present_lat.png"
        ],
        "volkswagen_amarok_2010_present_top.png": [
            "volkswagen_amarok_2010_2026_top.png",
            "vw_amarok_2010_present_top.png"
        ],
        "volkswagen_tcross_2019_present_lat.png": [
            "volkswagen_t-cross_2019_present_lat.png",
            "volkswagen_taigun_2019_present_lat.png",
            "vw_tcross_2019_present_lat.png"
        ],
        "volkswagen_tcross_2019_present_top.png": [
            "volkswagen_t-cross_2019_present_top.png",
            "volkswagen_taigun_2019_present_top.png",
            "vw_tcross_2019_present_top.png"
        ],
        "volkswagen_gol_2008_2023_lat.png": [
            "volkswagen_polo_2008_2023_lat.png",
            "vw_gol_2008_2023_lat.png"
        ],
        "volkswagen_gol_2008_2023_top.png": [
            "volkswagen_polo_2008_2023_top.png",
            "vw_gol_2008_2023_top.png"
        ],
    }

    for src_name, dest_name in vw_mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = vw_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK VW] Ingested: {src_name} -> {dest_path} ({im.size})")

    for s_file_name, aliases in extra_aliases.items():
        s_path = vw_dir / s_file_name
        if s_path.exists():
            im = Image.open(s_path)
            for d_file_name in aliases:
                d_path = vw_dir / d_file_name
                im.save(d_path, "PNG", optimize=True)
                print(f"[OK VW Alias] {d_file_name}")

    print("\nVOLKSWAGEN LOTE #1 (Amarok 4x4, T-Cross, Gol/Polo) Ingested Successfully!")

if __name__ == "__main__":
    main()
