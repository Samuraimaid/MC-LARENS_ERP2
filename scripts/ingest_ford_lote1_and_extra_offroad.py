import os
import numpy as np
from PIL import Image
from pathlib import Path

def standardize_lateral_if_vertical(im_raw):
    w, h = im_raw.size
    if w >= h:
        return im_raw  # already horizontal
    
    # Process vertical canvas with horizontal vehicle
    arr = np.array(im_raw.convert('RGB'))
    
    # Vehicle mask: ignore bottom 15% where text lives
    veh_part = arr[:int(h*0.8), :, :]
    mask = np.any(veh_part < 250, axis=2)
    if not np.any(mask):
        return im_raw
        
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    veh_crop = im_raw.crop((cmin, rmin, cmax, rmax))
    
    # Text crop
    txt_part = arr[int(h*0.8):, :, :]
    txt_mask = np.any(txt_part < 250, axis=2)
    if np.any(txt_mask):
        t_rows = np.any(txt_mask, axis=1)
        t_cols = np.any(txt_mask, axis=0)
        t_rmin, t_rmax = np.where(t_rows)[0][[0, -1]] + int(h*0.8)
        t_cmin, t_cmax = np.where(t_cols)[0][[0, -1]]
        txt_crop = im_raw.crop((t_cmin, t_rmin, t_cmax, t_rmax))
    else:
        txt_crop = None

    canvas = Image.new('RGB', (1168, 784), (255, 255, 255))
    vw, vh = veh_crop.size

    scale = min(1080 / vw, 580 / vh, 1.4)
    new_vw, new_vh = int(vw * scale), int(vh * scale)
    veh_scaled = veh_crop.resize((new_vw, new_vh), Image.Resampling.LANCZOS)

    vx = (1168 - new_vw) // 2
    vy = (784 - new_vh) // 2 - 20
    canvas.paste(veh_scaled, (vx, vy))

    if txt_crop:
        canvas.paste(txt_crop, (40, 784 - txt_crop.size[1] - 25))

    return canvas

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    ford_dir = Path("frontend/public/vehicles/models/ford")
    ford_dir.mkdir(parents=True, exist_ok=True)
    chevy_dir = Path("frontend/public/vehicles/models/chevrolet")
    chevy_dir.mkdir(parents=True, exist_ok=True)

    # 1. Ford Lote 1 Mapping
    ford_lote1 = {
        "sgvp5.jpg": "ford_ranger_2022_present_lat.png",
        "IePI4.jpg": "ford_ranger_2022_present_top.png",
        "tNCQF.jpg": "ford_ranger_2015_2022_lat.png",
        "13YWJ.jpg": "ford_ranger_2015_2022_top.png",
        "hX5QC.jpg": "ford_ranger_2006_2011_lat.png",
        "oppAK.jpg": "ford_ranger_2006_2011_top.png",
    }

    # 2. Extra Off-Road / Special Editions Mapping
    extra_ford = {
        "RKEHp.jpg": "ford_ranger_raptor_2022_present_lat.png",
        "Vfb50.jpg": "ford_ranger_raptor_2022_present_top.png",
        "I7Las.jpg": "ford_ranger_wildtrak_2022_present_lat.png",
        "hy458.jpg": "ford_ranger_wildtrak_2022_present_top.png",
        "NUVC8.jpg": "ford_ranger_raptor_2019_2022_lat.png",
        "vgns5.jpg": "ford_ranger_raptor_2019_2022_top.png",
    }

    extra_chevy = {
        "yagWx.jpg": "chevrolet_colorado_zr2_2017_present_lat.png",
        "RgoGy.jpg": "chevrolet_colorado_zr2_2017_present_top.png",
        "oTZxZ.jpg": "chevrolet_silverado_zr2_2022_present_lat.png",
        "JtDHm.jpg": "chevrolet_silverado_zr2_2022_present_top.png",
    }

    # Ford Aliases
    ford_aliases = {
        "ford_ranger_2022_present_lat.png": "ford_ranger_2022_2026_lat.png",
        "ford_ranger_2022_present_top.png": "ford_ranger_2022_2026_top.png",
        "ford_ranger_raptor_2022_present_lat.png": "ford_ranger_raptor_2022_2026_lat.png",
        "ford_ranger_raptor_2022_present_top.png": "ford_ranger_raptor_2022_2026_top.png",
        "ford_ranger_wildtrak_2022_present_lat.png": "ford_ranger_wildtrak_2022_2026_lat.png",
        "ford_ranger_wildtrak_2022_present_top.png": "ford_ranger_wildtrak_2022_2026_top.png",
    }

    # Chevy Aliases
    chevy_aliases = {
        "chevrolet_colorado_zr2_2017_present_lat.png": "chevrolet_colorado_zr2_2017_2026_lat.png",
        "chevrolet_colorado_zr2_2017_present_top.png": "chevrolet_colorado_zr2_2017_2026_top.png",
        "chevrolet_silverado_zr2_2022_present_lat.png": "chevrolet_silverado_zr2_2022_2026_lat.png",
        "chevrolet_silverado_zr2_2022_present_top.png": "chevrolet_silverado_zr2_2022_2026_top.png",
        "chevrolet_silverado_zr2_2022_present_lat.png": "chevrolet_silverado_2022_present_lat.png",
        "chevrolet_silverado_zr2_2022_present_top.png": "chevrolet_silverado_2022_present_top.png",
        "chevrolet_silverado_zr2_2022_present_lat.png": "chevrolet_silverado_2022_2026_lat.png",
        "chevrolet_silverado_zr2_2022_present_top.png": "chevrolet_silverado_2022_2026_top.png",
    }

    print("=== INGESTING FORD LOTE 1 ===")
    for src, dst in ford_lote1.items():
        p = dl / src
        if p.exists():
            im = Image.open(p)
            out = ford_dir / dst
            im.save(out, "PNG", optimize=True)
            print(f"[OK Ford Lote 1] {src} -> {out} ({im.size})")

    print("\n=== INGESTING EXTRA FORD OFF-ROAD ===")
    for src, dst in extra_ford.items():
        p = dl / src
        if p.exists():
            im = Image.open(p)
            if "_lat" in dst:
                im = standardize_lateral_if_vertical(im)
            out = ford_dir / dst
            im.save(out, "PNG", optimize=True)
            print(f"[OK Ford Extra] {src} -> {out} ({im.size})")

    print("\n=== INGESTING EXTRA CHEVROLET ZR2 ===")
    for src, dst in extra_chevy.items():
        p = dl / src
        if p.exists():
            im = Image.open(p)
            if "_lat" in dst:
                im = standardize_lateral_if_vertical(im)
            out = chevy_dir / dst
            im.save(out, "PNG", optimize=True)
            print(f"[OK Chevy Extra] {src} -> {out} ({im.size})")

    print("\n=== GENERATING ALIASES ===")
    for src_alias, dst_alias in ford_aliases.items():
        s = ford_dir / src_alias
        d = ford_dir / dst_alias
        if s.exists():
            im = Image.open(s)
            im.save(d, "PNG", optimize=True)
            print(f"[OK Ford Alias] {dst_alias}")

    for src_alias, dst_alias in chevy_aliases.items():
        s = chevy_dir / src_alias
        d = chevy_dir / dst_alias
        if s.exists():
            im = Image.open(s)
            im.save(d, "PNG", optimize=True)
            print(f"[OK Chevy Alias] {dst_alias}")

    print("\nALL 16 BLUEPRINTS (Ford Lote 1 + Extra Off-Road Raptor, Wildtrak, Colorado ZR2, Silverado ZR2) INGESTED AND STANDARDIZED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
