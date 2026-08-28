import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    isuzu_dir = Path("frontend/public/vehicles/models/isuzu")
    isuzu_dir.mkdir(parents=True, exist_ok=True)

    extra_mapping = {
        "dtOug.jpg": "isuzu_qmr_2010_present_lat.png",
        "QX5en.jpg": "isuzu_qmr_2010_present_top.png",
        "vVxW3.jpg": "isuzu_dmax_power_sc_2019_present_lat.png",
        "mCwH1.jpg": "isuzu_dmax_power_sc_2019_present_top.png",
        "xmnq6.jpg": "isuzu_dmax_xtended_2019_present_lat.png",
        "TVIAn.jpg": "isuzu_dmax_xtended_2019_present_top.png",
    }

    extra_aliases = {
        "isuzu_qmr_2010_present_lat.png": [
            "isuzu_reward_qmr_2010_present_lat.png",
            "isuzu_serie_q_2010_present_lat.png"
        ],
        "isuzu_qmr_2010_present_top.png": [
            "isuzu_reward_qmr_2010_present_top.png",
            "isuzu_serie_q_2010_present_top.png"
        ],
        "isuzu_dmax_power_sc_2019_present_lat.png": [
            "isuzu_dmax_single_cab_2019_present_lat.png",
            "isuzu_dmax_cabina_sencilla_2019_present_lat.png"
        ],
        "isuzu_dmax_power_sc_2019_present_top.png": [
            "isuzu_dmax_single_cab_2019_present_top.png",
            "isuzu_dmax_cabina_sencilla_2019_present_top.png"
        ],
        "isuzu_dmax_xtended_2019_present_lat.png": [
            "isuzu_dmax_space_cab_2019_present_lat.png",
            "isuzu_dmax_cabina_extendida_2019_present_lat.png"
        ],
        "isuzu_dmax_xtended_2019_present_top.png": [
            "isuzu_dmax_space_cab_2019_present_top.png",
            "isuzu_dmax_cabina_extendida_2019_present_top.png"
        ],
    }

    for src_name, dest_name in extra_mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = isuzu_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK Isuzu Extra] Ingested: {src_name} -> {dest_path} ({im.size})")

    for s_file_name, aliases in extra_aliases.items():
        s_path = isuzu_dir / s_file_name
        if s_path.exists():
            im = Image.open(s_path)
            for d_file_name in aliases:
                d_path = isuzu_dir / d_file_name
                im.save(d_path, "PNG", optimize=True)
                print(f"[OK Isuzu Extra Alias] {d_file_name}")

    print("\nISUZU EXTRA BATCH #2 (QMR Serie Q, D-Max Cabina Sencilla y Cabina Extendida) Ingested Successfully!")

if __name__ == "__main__":
    main()
