import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    mitsu_dir = Path("frontend/public/vehicles/models/mitsubishi")
    mitsu_dir.mkdir(parents=True, exist_ok=True)

    mitsu_mapping = {
        "21exB.jpg": "mitsubishi_montero_2006_2021_lat.png",
        "4PqNc.jpg": "mitsubishi_montero_2006_2021_top.png",
        "ZkJ3J.jpg": "mitsubishi_outlander_2021_present_lat.png",
        "KGuC4.jpg": "mitsubishi_outlander_2021_present_top.png",
        "6OH6S.jpg": "mitsubishi_outlander_2012_2021_lat.png",
        "DNoWt.jpg": "mitsubishi_outlander_2012_2021_top.png",
    }

    extra_aliases = {
        "mitsubishi_montero_2006_2021_lat.png": "mitsubishi_pajero_2006_2021_lat.png",
        "mitsubishi_montero_2006_2021_top.png": "mitsubishi_pajero_2006_2021_top.png",
        "mitsubishi_outlander_2021_present_lat.png": "mitsubishi_outlander_2021_2026_lat.png",
        "mitsubishi_outlander_2021_present_top.png": "mitsubishi_outlander_2021_2026_top.png",
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

    print("\nMITSUBISHI LOTE #3 (Montero V80, Outlander 4ta & 3ra Gen) Ingested Successfully!")

if __name__ == "__main__":
    main()
