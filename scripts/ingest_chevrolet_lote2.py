import os
from PIL import Image
from pathlib import Path

def main():
    dl = Path(r"C:\Users\Xinon\Downloads")
    chevy_dir = Path("frontend/public/vehicles/models/chevrolet")
    chevy_dir.mkdir(parents=True, exist_ok=True)

    chevy_mapping = {
        "UWD3F.jpg": "chevrolet_spark_2010_2016_lat.png",
        "iVQ0I.jpg": "chevrolet_spark_2010_2016_top.png",
        "4kCUU.jpg": "chevrolet_aveo_2012_2020_lat.png",
        "inEkt.jpg": "chevrolet_aveo_2012_2020_top.png",
        "9aMTC.jpg": "chevrolet_aveo_2006_2018_lat.png",
        "NMjKk.jpg": "chevrolet_aveo_2006_2018_top.png",
    }

    extra_aliases = {
        "chevrolet_spark_2010_2016_lat.png": "chevrolet_spark_gt_2010_2016_lat.png",
        "chevrolet_spark_2010_2016_top.png": "chevrolet_spark_gt_2010_2016_top.png",
        "chevrolet_aveo_2012_2020_lat.png": "chevrolet_sonic_2012_2020_lat.png",
        "chevrolet_aveo_2012_2020_top.png": "chevrolet_sonic_2012_2020_top.png",
        "chevrolet_aveo_2006_2018_lat.png": "chevrolet_aveo_clasico_2006_2018_lat.png",
        "chevrolet_aveo_2006_2018_top.png": "chevrolet_aveo_clasico_2006_2018_top.png",
    }

    for src_name, dest_name in chevy_mapping.items():
        src_path = dl / src_name
        if not src_path.exists():
            print(f"Error: {src_path} not found")
            continue
        
        im = Image.open(src_path)
        dest_path = chevy_dir / dest_name
        im.save(dest_path, "PNG", optimize=True)
        print(f"[OK Chevrolet] Ingested: {src_name} -> {dest_path} ({im.size})")

    for src_alias, dst_alias in extra_aliases.items():
        s_file = chevy_dir / src_alias
        d_file = chevy_dir / dst_alias
        if s_file.exists():
            im = Image.open(s_file)
            im.save(d_file, "PNG", optimize=True)
            print(f"[OK Chevrolet Alias] {dst_alias}")

    print("\nCHEVROLET LOTE #2 (Spark GT, Aveo/Sonic, Aveo Clásico) Ingested Successfully!")

if __name__ == "__main__":
    main()
