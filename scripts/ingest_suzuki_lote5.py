import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    suzuki_dir = Path("frontend/public/vehicles/models/suzuki")
    suzuki_dir.mkdir(parents=True, exist_ok=True)

    suzuki_mapping = {
        "cNIfa.jpg": "suzuki_grand_vitara_1998_2005_lat.png",
        "ZpC1q.jpg": "suzuki_grand_vitara_1998_2005_top.png",
        "4yCfB.jpg": "suzuki_jimny_1998_2018_lat.png",
        "LbCnS.jpg": "suzuki_jimny_1998_2018_top.png",
        "Q48NB.jpg": "suzuki_swift_2010_2017_lat.png",
        "K8mjV.jpg": "suzuki_swift_2010_2017_top.png",
    }

    extra_aliases = {
        "suzuki_grand_vitara_1998_2005_lat.png": "suzuki_vitara_1998_2005_lat.png",
        "suzuki_grand_vitara_1998_2005_top.png": "suzuki_vitara_1998_2005_top.png",
        "suzuki_jimny_1998_2018_lat.png": "suzuki_samurai_1998_2018_lat.png",
        "suzuki_jimny_1998_2018_top.png": "suzuki_samurai_1998_2018_top.png",
    }

    for src_name, dest_name in suzuki_mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = suzuki_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK Suzuki] Ingested: {src_name} -> {dest_path} ({im.size})")

    for src_alias, dst_alias in extra_aliases.items():
        s_file = suzuki_dir / src_alias
        d_file = suzuki_dir / dst_alias
        if s_file.exists():
            im = Image.open(s_file)
            im.save(d_file, "PNG", optimize=True)
            print(f"[OK Suzuki Alias] {dst_alias}")

    print("\nSUZUKI LOTE #5 (Grand Vitara SQ, Jimny JB43, Swift 3ra Gen) Ingested Successfully!")

if __name__ == "__main__":
    main()
