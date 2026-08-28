import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    jeep_dir = Path("frontend/public/vehicles/models/jeep")
    changan_dir = Path("frontend/public/vehicles/models/changan")
    jeep_dir.mkdir(parents=True, exist_ok=True)
    changan_dir.mkdir(parents=True, exist_ok=True)

    mapping = {
        "JNwDu.jpg": (jeep_dir, "jeep_wrangler_jl_2018_present_lat.png"),
        "9UlDT.jpg": (jeep_dir, "jeep_wrangler_jl_2018_present_top.png"),
        "RxTwW.jpg": (jeep_dir, "jeep_grand_cherokee_2011_2022_lat.png"),
        "eL04q.jpg": (jeep_dir, "jeep_grand_cherokee_2011_2022_top.png"),
        "l0H9c.jpg": (changan_dir, "changan_hunter_2020_present_lat.png"),
        "Gbjei.jpg": (changan_dir, "changan_hunter_2020_present_top.png"),
    }

    extra_aliases = {
        (jeep_dir, "jeep_wrangler_jl_2018_present_lat.png"): [
            (jeep_dir, "jeep_wrangler_2018_present_lat.png"),
            (jeep_dir, "jeep_wrangler_unlimited_2018_present_lat.png"),
            (jeep_dir, "jeep_wrangler_jl_2018_2026_lat.png")
        ],
        (jeep_dir, "jeep_wrangler_jl_2018_present_top.png"): [
            (jeep_dir, "jeep_wrangler_2018_present_top.png"),
            (jeep_dir, "jeep_wrangler_unlimited_2018_present_top.png"),
            (jeep_dir, "jeep_wrangler_jl_2018_2026_top.png")
        ],
        (jeep_dir, "jeep_grand_cherokee_2011_2022_lat.png"): [
            (jeep_dir, "jeep_grand_cherokee_wk2_2011_2022_lat.png"),
            (jeep_dir, "jeep_grandcherokee_2011_2022_lat.png")
        ],
        (jeep_dir, "jeep_grand_cherokee_2011_2022_top.png"): [
            (jeep_dir, "jeep_grand_cherokee_wk2_2011_2022_top.png"),
            (jeep_dir, "jeep_grandcherokee_2011_2022_top.png")
        ],
        (changan_dir, "changan_hunter_2020_present_lat.png"): [
            (changan_dir, "changan_f70_2020_present_lat.png"),
            (changan_dir, "changan_hunter_2020_2026_lat.png")
        ],
        (changan_dir, "changan_hunter_2020_present_top.png"): [
            (changan_dir, "changan_f70_2020_present_top.png"),
            (changan_dir, "changan_hunter_2020_2026_top.png")
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

    print("\nMULTIMARCAS LOTE #2 (Jeep Wrangler JL, Grand Cherokee WK2, Changan Hunter) Ingested Successfully!")

if __name__ == "__main__":
    main()
