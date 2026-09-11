#!/usr/bin/env python3
"""
MC-LARENS ERP - Descargador y Renombrador de Imágenes de Catálogo
Descarga o copia localmente las imágenes de los 6 catálogos hacia
`frontend/public/uploads/products/` renombrándolas con el estándar:
  Principal: {SKU}_main.{ext}
  Adicional: {SKU}_add_{01..NN}.{ext}
"""

import json
import os
import shutil
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

DEST_DIR = Path("frontend/public/uploads/products")
MANIFEST_PATH = Path("scripts/catalog_images_manifest.json")

def download_or_copy_single(item):
    source = item.get("source", "").strip()
    target_filename = item.get("target_filename", "").strip()
    if not source or not target_filename:
        return "skip"

    dest_file = DEST_DIR / target_filename
    if dest_file.exists() and dest_file.stat().st_size > 500:
        return "exists"

    # If it's a local file in catalogos/
    if not source.startswith("http://") and not source.startswith("https://"):
        local_candidates = [
            Path(source),
            Path("catalogos") / source,
            Path("catalogos/dlaa") / source,
            Path("catalogos/Pioneer") / source,
            Path("catalogos/ds18_2021") / source,
            Path("catalogos/Fernandez_Sera") / source,
            Path("catalogos/Meguiars") / source,
            Path("catalogos/auxbeam_driving_light") / source,
        ]
        for cand in local_candidates:
            if cand.exists() and cand.is_file():
                try:
                    shutil.copy2(cand, dest_file)
                    return "copied_local"
                except Exception:
                    pass

    # If it's a URL
    if source.startswith("http://") or source.startswith("https://"):
        try:
            req = urllib.request.Request(
                source,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            )
            with urllib.request.urlopen(req, timeout=12) as response, open(dest_file, "wb") as out_file:
                shutil.copyfileobj(response, out_file)
            return "downloaded"
        except Exception as e:
            return f"error: {e}"

    return "not_found"

def main(max_workers=16, limit=None):
    DEST_DIR.mkdir(parents=True, exist_ok=True)
    if not MANIFEST_PATH.exists():
        print(f"Error: Manifest {MANIFEST_PATH} not found.")
        return

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # If limit specified (for test / DLAA priority)
    to_process = manifest[:limit] if limit else manifest
    print(f"Starting image sync for {len(to_process)} images to {DEST_DIR}...")

    stats = {"downloaded": 0, "copied_local": 0, "exists": 0, "errors": 0, "not_found": 0}

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(download_or_copy_single, item): item for item in to_process}
        done_count = 0
        for future in as_completed(futures):
            res = future.result()
            done_count += 1
            if res == "downloaded":
                stats["downloaded"] += 1
            elif res == "copied_local":
                stats["copied_local"] += 1
            elif res == "exists":
                stats["exists"] += 1
            elif res.startswith("error"):
                stats["errors"] += 1
            else:
                stats["not_found"] += 1

            if done_count % 100 == 0 or done_count == len(to_process):
                print(f"  Progress: {done_count}/{len(to_process)} (DL={stats['downloaded']}, Local={stats['copied_local']}, Exists={stats['exists']}, Err={stats['errors']})")

    print("\n=== IMAGE SYNC SUMMARY ===")
    print(f"Total Processed: {len(to_process)}")
    print(f"Downloaded:      {stats['downloaded']}")
    print(f"Copied Local:    {stats['copied_local']}")
    print(f"Already Existed: {stats['exists']}")
    print(f"Errors:          {stats['errors']}")
    print(f"Not Found:       {stats['not_found']}")

if __name__ == "__main__":
    limit_arg = int(sys.argv[1]) if len(sys.argv) > 1 else None
    main(limit=limit_arg)
