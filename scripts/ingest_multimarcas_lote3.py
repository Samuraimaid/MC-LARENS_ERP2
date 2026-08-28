import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    changan_dir = Path("frontend/public/vehicles/models/changan")
    greatwall_dir = Path("frontend/public/vehicles/models/greatwall")
    changan_dir.mkdir(parents=True, exist_ok=True)
    greatwall_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "mHIxj.jpg": (changan_dir, "changan_cs35_plus_2018_present_lat.png"),
        "HrDky.jpg": (changan_dir, "changan_cs35_plus_2018_present_top.png"),
        "UjFjn.jpg": (greatwall_dir, "greatwall_poer_2019_present_lat.png"),
        "qEXlN.jpg": (greatwall_dir, "greatwall_poer_2019_present_top.png"),
        "8mkkq.jpg": (greatwall_dir, "greatwall_wingle5_2011_present_lat.png"),
        "te2CC.jpg": (greatwall_dir, "greatwall_wingle5_2011_present_top.png"),
    }

    extra_aliases = {
        (changan_dir, "changan_cs35_plus_2018_present_lat.png"): [
            (changan_dir, "changan_cs35plus_2018_present_lat.png"),
            (changan_dir, "changan_cs35_2018_present_lat.png"),
            (changan_dir, "changan_cs35_plus_2018_2026_lat.png")
        ],
        (changan_dir, "changan_cs35_plus_2018_present_top.png"): [
            (changan_dir, "changan_cs35plus_2018_present_top.png"),
            (changan_dir, "changan_cs35_2018_present_top.png"),
            (changan_dir, "changan_cs35_plus_2018_2026_top.png")
        ],
        (greatwall_dir, "greatwall_poer_2019_present_lat.png"): [
            (greatwall_dir, "greatwall_pao_2019_present_lat.png"),
            (greatwall_dir, "gwm_poer_2019_present_lat.png"),
            (greatwall_dir, "greatwall_poer_2019_2026_lat.png")
        ],
        (greatwall_dir, "greatwall_poer_2019_present_top.png"): [
            (greatwall_dir, "greatwall_pao_2019_present_top.png"),
            (greatwall_dir, "gwm_poer_2019_present_top.png"),
            (greatwall_dir, "greatwall_poer_2019_2026_top.png")
        ],
        (greatwall_dir, "greatwall_wingle5_2011_present_lat.png"): [
            (greatwall_dir, "greatwall_wingle_5_2011_present_lat.png"),
            (greatwall_dir, "gwm_wingle5_2011_present_lat.png"),
            (greatwall_dir, "greatwall_wingle5_2011_2026_lat.png")
        ],
        (greatwall_dir, "greatwall_wingle5_2011_present_top.png"): [
            (greatwall_dir, "greatwall_wingle_5_2011_present_top.png"),
            (greatwall_dir, "gwm_wingle5_2011_present_top.png"),
            (greatwall_dir, "greatwall_wingle5_2011_2026_top.png")
        ],
    }

    for src_name, (target_dir, dest_name) in mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = target_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK] Ingested: {src_name} -> {dest_path} ({im.size})")

    for (s_dir, s_file_name), aliases in extra_aliases.items():
        s_path = s_dir / s_file_name
        if s_path.exists():
            im = Image.open(s_path)
            for (d_dir, d_file_name) in aliases:
                d_path = d_dir / d_file_name
                im.save(d_path, "PNG", optimize=True)
                print(f"[OK Alias] {d_path.name}")

    print("\nMULTIMARCAS LOTE #3 (Changan CS35 Plus, Great Wall Poer, Great Wall Wingle 5) Ingested Successfully!")

if __name__ == "__main__":
    main()
