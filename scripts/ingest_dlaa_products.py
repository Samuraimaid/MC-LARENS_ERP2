import json
import os
import sys
from pathlib import Path
from pymongo import MongoClient

def ingest():
    seed_file = Path("backend/data/seeds/dlaa_halogens_seed.json")
    if not seed_file.exists():
        print(f"Error: {seed_file} does not exist yet.")
        return

    with open(seed_file, "r", encoding="utf-8") as f:
        products = json.load(f)

    print(f"Loaded {len(products)} products from {seed_file}")

    # Inspect MongoDB URI
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
                        print(f"Auto-discovered MongoDB Atlas connection from Cloud Run!")
                    if name == "DB_NAME" and val:
                        db_name = val
            else:
                if proc.stderr:
                    print(f"[Info] gcloud describe output: {proc.stderr.strip()[:150]}")
        except Exception as ex:
            print(f"[Info] Could not auto-discover from gcloud: {ex}")

    if not mongo_uri:
        mongo_uri = "mongodb://localhost:27017"

    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
        db = client[db_name]
        # Test connection
        db.command("ping")
        print(f"Connected to MongoDB database '{db_name}' successfully!")
        
        inserted = 0
        updated = 0
        for p in products:
            res = db.products.update_one(
                {"sku": p["sku"]},
                {"$set": p},
                upsert=True
            )
            if res.upserted_id:
                inserted += 1
            else:
                updated += 1
                
        print(f"Ingestion to MongoDB complete: {inserted} inserted, {updated} updated.")
    except Exception as e:
        print(f"MongoDB offline or unavailable locally ({e}). Products JSON seed is ready at {seed_file}")

if __name__ == "__main__":
    ingest()
