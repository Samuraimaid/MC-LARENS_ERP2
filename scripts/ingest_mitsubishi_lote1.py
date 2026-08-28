import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    mitsu_dir = Path("frontend/public/vehicles/models/mitsubishi")
    mitsu_dir.mkdir(parents=True, exist_ok=True)

    mitsu_mapping = {
        "R8PDH.jpg": "mitsubishi_l200_2024_present_lat.png",
        "oDLlr.jpg": "mitsubishi_l200_2024_present_top.png",
        "2nikC.jpg": "mitsubishi_l200_2019_2023_lat.png",
        "hnsRn.jpg": "mitsubishi_l200_2019_2023_top.png",
        "Ush0R.jpg": "mitsubishi_l200_2015_2019_lat.png",
        "hKd3D.jpg": "mitsubishi_l200_2015_2019_top.png",
    }

    extra_aliases = {
        "mitsubishi_l200_2024_present_lat.png": "mitsubishi_l200_2024_2026_lat.png",
        "mitsubishi_l200_2024_present_top.png": "mitsubishi_l200_2024_2026_top.png",
        "mitsubishi_l200_2019_2023_lat.png": "mitsubishi_triton_2019_2023_lat.png",
        "mitsubishi_l200_2019_2023_top.png": "mitsubishi_triton_2019_2023_top.png",
        "mitsubishi_l200_2015_2019_lat.png": "mitsubishi_triton_2015_2019_lat.png",
        "mitsubishi_l200_2015_2019_top.png": "mitsubishi_triton_2015_2019_top.png",
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

    print("\nMITSUBISHI LOTE #1 (L200 6ta, 5ta Facelift & Pre-Facelift) Ingested Successfully!")

if __name__ == "__main__":
    main()
