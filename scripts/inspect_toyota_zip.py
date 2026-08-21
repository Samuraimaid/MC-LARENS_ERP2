import os
import zipfile
import shutil
from pathlib import Path
from PIL import Image

def main():
    zip_source = Path(r"C:\Users\Xinon\Downloads\Vector Drawings - Toyota\Toyota.zip")
    if not zip_source.exists():
        print(f"Error: No se encontró {zip_source}")
        return

    dest_dir = Path(r"c:\ANTIGRAVITY\MC-LARENS_ERP2\backend\data\blueprints_raw\toyota")
    dest_dir.mkdir(parents=True, exist_ok=True)

    print(f"Descomprimiendo {zip_source} en {dest_dir}...")
    with zipfile.ZipFile(zip_source, 'r') as zip_ref:
        zip_ref.extractall(dest_dir)

    files = list(dest_dir.rglob("*.png")) + list(dest_dir.rglob("*.jpg")) + list(dest_dir.rglob("*.jpeg"))
    print(f"Total de imágenes extraídas: {len(files)}")
    if files:
        sample = files[0]
        with Image.open(sample) as img:
            print(f"Muestra: {sample.name}, Dimensiones: {img.size}, Modo: {img.mode}")

if __name__ == "__main__":
    main()
