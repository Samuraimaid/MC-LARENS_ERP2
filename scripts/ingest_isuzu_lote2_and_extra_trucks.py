import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    isuzu_dir = Path("frontend/public/vehicles/models/isuzu")
    mazda_dir = Path("frontend/public/vehicles/models/mazda")
    isuzu_dir.mkdir(parents=True, exist_ok=True)
    mazda_dir.mkdir(parents=True, exist_ok=True)

    # Ingest Lote #2 (Isuzu & Mazda)
    lote2_mapping = {
        "zn4M0.jpg": (isuzu_dir, "isuzu_mux_2020_present_lat.png"),
        "Wcn1f.jpg": (isuzu_dir, "isuzu_mux_2020_present_top.png"),
        "Pkmpo.jpg": (isuzu_dir, "isuzu_qkr_2010_present_lat.png"),
        "9vVSo.jpg": (isuzu_dir, "isuzu_qkr_2010_present_top.png"),
        "nwC6C.jpg": (mazda_dir, "mazda_bt50_2020_present_lat.png"),
        "kcliw.jpg": (mazda_dir, "mazda_bt50_2020_present_top.png"),
    }

    # Ingest Extra Isuzu Commercial Trucks Batch
    extra_trucks_mapping = {
        "SAFXB.jpg": (isuzu_dir, "isuzu_phr_2010_present_lat.png"),
        "WdUet.jpg": (isuzu_dir, "isuzu_phr_2010_present_top.png"),
        "2jAfm.jpg": (isuzu_dir, "isuzu_npr_2010_present_lat.png"),
        "htW3X.jpg": (isuzu_dir, "isuzu_npr_2010_present_top.png"),
        "2Dtpd.jpg": (isuzu_dir, "isuzu_ftr_2010_present_lat.png"),
        "uGv2B.jpg": (isuzu_dir, "isuzu_ftr_2010_present_top.png"),
    }

    extra_aliases = {
        # Isuzu mu-X
        (isuzu_dir, "isuzu_mux_2020_present_lat.png"): [
            (isuzu_dir, "isuzu_mux_2020_2026_lat.png"),
            (isuzu_dir, "isuzu_mu-x_2020_present_lat.png")
        ],
        (isuzu_dir, "isuzu_mux_2020_present_top.png"): [
            (isuzu_dir, "isuzu_mux_2020_2026_top.png"),
            (isuzu_dir, "isuzu_mu-x_2020_present_top.png")
        ],
        # Isuzu QKR / NLR
        (isuzu_dir, "isuzu_qkr_2010_present_lat.png"): [
            (isuzu_dir, "isuzu_nlr_2010_present_lat.png"),
            (isuzu_dir, "isuzu_reward_qkr_2010_present_lat.png")
        ],
        (isuzu_dir, "isuzu_qkr_2010_present_top.png"): [
            (isuzu_dir, "isuzu_nlr_2010_present_top.png"),
            (isuzu_dir, "isuzu_reward_qkr_2010_present_top.png")
        ],
        # Mazda BT-50
        (mazda_dir, "mazda_bt50_2020_present_lat.png"): [
            (mazda_dir, "mazda_bt50_2020_2026_lat.png"),
            (mazda_dir, "mazda_bt-50_2020_present_lat.png")
        ],
        (mazda_dir, "mazda_bt50_2020_present_top.png"): [
            (mazda_dir, "mazda_bt50_2020_2026_top.png"),
            (mazda_dir, "mazda_bt-50_2020_present_top.png")
        ],
        # Isuzu NPR / NQR
        (isuzu_dir, "isuzu_npr_2010_present_lat.png"): [
            (isuzu_dir, "isuzu_nqr_2010_present_lat.png"),
            (isuzu_dir, "isuzu_elf_npr_2010_present_lat.png"),
            (isuzu_dir, "isuzu_reward_npr_2010_present_lat.png")
        ],
        (isuzu_dir, "isuzu_npr_2010_present_top.png"): [
            (isuzu_dir, "isuzu_nqr_2010_present_top.png"),
            (isuzu_dir, "isuzu_elf_npr_2010_present_top.png"),
            (isuzu_dir, "isuzu_reward_npr_2010_present_top.png")
        ],
        # Isuzu FTR / FVR
        (isuzu_dir, "isuzu_ftr_2010_present_lat.png"): [
            (isuzu_dir, "isuzu_fvr_2010_present_lat.png"),
            (isuzu_dir, "isuzu_forward_ftr_2010_present_lat.png")
        ],
        (isuzu_dir, "isuzu_ftr_2010_present_top.png"): [
            (isuzu_dir, "isuzu_fvr_2010_present_top.png"),
            (isuzu_dir, "isuzu_forward_ftr_2010_present_top.png")
        ],
    }

    all_maps = {**lote2_mapping, **extra_trucks_mapping}
    for src_name, (target_dir, dest_name) in all_maps.items():
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

    print("\nISUZU LOTE #2 + EXTRA CAMIONES ISUZU (Serie P, N, F) Ingested Successfully!")

if __name__ == "__main__":
    main()
