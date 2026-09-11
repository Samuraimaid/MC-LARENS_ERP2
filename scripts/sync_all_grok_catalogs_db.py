#!/usr/bin/env python3
"""
MC-LARENS ERP - Sincronizador de Todos los Catálogos Grok a MongoDB
Sincroniza los 1,724 productos de los 6 catálogos con compatibilidad vehicular,
imágenes normalizadas ({SKU}_main y {SKU}_add_XX) y estructura multimoneda.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from pymongo import MongoClient

def get_mongo_connection():
    mongo_uri = (
        os.environ.get("MONGODB_LOCAL_URI")
        or os.environ.get("MONGO_URL")
        or os.environ.get("MONGODB_URI")
        or os.environ.get("MONGO_URI")
    )
    db_name = os.environ.get("DB_NAME", "mc-larens2_mundo_accesorios_erp")

    if not mongo_uri:
        for p in [Path("deploy/.env"), Path(".env"), Path("backend/.env")]:
            if p.exists():
                for line in p.read_text(encoding="utf-8").splitlines():
                    line_clean = line.strip()
                    if line_clean.startswith("#") or "=" not in line_clean:
                        continue
                    k, v = line_clean.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k in ("MONGODB_LOCAL_URI", "MONGO_URL", "MONGODB_URI", "MONGO_URI") and not mongo_uri:
                        mongo_uri = v
                    if k == "DB_NAME":
                        db_name = v

    if not mongo_uri or mongo_uri.startswith("mongodb://localhost"):
        try:
            import subprocess
            cmd = [
                "gcloud", "run", "services", "describe", "mclarens-erp",
                "--region", "us-central1",
                "--project", "gen-lang-client-0971793042",
                "--format=json"
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            if proc.returncode == 0 and proc.stdout:
                service_data = json.loads(proc.stdout)
                envs = (
                    service_data.get("spec", {})
                    .get("template", {})
                    .get("spec", {})
                    .get("containers", [{}])[0]
                    .get("env", [])
                )
                for e in envs:
                    name = e.get("name")
                    val = e.get("value")
                    if name in ("MONGODB_LOCAL_URI", "MONGO_URL", "MONGODB_URI", "MONGO_URI") and val:
                        mongo_uri = val
                    if name == "DB_NAME" and val:
                        db_name = val
        except Exception:
            pass

    if not mongo_uri:
        mongo_uri = "mongodb://localhost:27017"

    return mongo_uri, db_name

def sync_catalogs():
    seeds_dir = Path("backend/data/seeds")
    catalog_files = [
        ("DLAA (Faros e Iluminación)", seeds_dir / "dlaa_halogens_seed.json"),
        ("Fernández Sera (Nicaragua - NIO)", seeds_dir / "fernandez_sera_seed.json"),
        ("Meguiar's (Detailing & Pulido)", seeds_dir / "meguiars_seed.json"),
        ("Pioneer (Car Audio & Multimedia)", seeds_dir / "pioneer_seed.json"),
        ("DS18 (Pro Audio & Sonido)", seeds_dir / "ds18_seed.json"),
        ("Auxbeam (Faros LED y Barras)", seeds_dir / "auxbeam_seed.json"),
    ]

    mongo_uri, db_name = get_mongo_connection()
    print(f"Connecting to MongoDB database '{db_name}'...")
    
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=6000)
        db = client[db_name]
        db.command("ping")
        print("Connected to MongoDB successfully!")
    except Exception as ex:
        print(f"[Warning] MongoDB connection failed or offline: {ex}")
        print("Seed files are saved locally and ready for production deployment.")
        return

    # 1. Clean legacy / obsolete DLAA products
    del_res = db.products.delete_many({"brand": "DLAA", "source_catalog": {"$ne": "dlaa"}})
    print(f"Purged {del_res.deleted_count} legacy/obsolete DLAA products.")

    total_inserted = 0
    total_updated = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for name, seed_path in catalog_files:
        if not seed_path.exists():
            print(f"Skipping {name}: file not found at {seed_path}")
            continue

        with open(seed_path, "r", encoding="utf-8") as f:
            prods = json.load(f)

        c_inserted = 0
        c_updated = 0
        for p in prods:
            sku = p.get("sku")
            if not sku:
                continue
            p["updated_at"] = now_iso
            if not p.get("created_at"):
                p["created_at"] = now_iso
            res = db.products.update_one(
                {"sku": sku},
                {"$set": p},
                upsert=True
            )
            if res.upserted_id:
                c_inserted += 1
            else:
                c_updated += 1

        print(f"✔ {name}: {len(prods)} products synced (Inserted: {c_inserted}, Updated: {c_updated})")
        total_inserted += c_inserted
        total_updated += c_updated

    print("\n=======================================================")
    print(f"ALL CATALOGS SYNC COMPLETE: {total_inserted} inserted, {total_updated} updated.")
    print("=======================================================")

if __name__ == "__main__":
    sync_catalogs()
