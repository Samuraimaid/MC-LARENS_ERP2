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
    mongo_uri = os.environ.get("MONGODB_URI") or os.environ.get("MONGO_URI")
    if not mongo_uri:
        for p in [Path(".env"), Path("backend/.env")]:
            if p.exists():
                for line in p.read_text(encoding="utf-8").splitlines():
                    if line.startswith("MONGODB_URI=") or line.startswith("MONGO_URI="):
                        mongo_uri = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
    if not mongo_uri:
        mongo_uri = "mongodb://localhost:27017"

    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
        db = client["mclarens_erp"]
        # Test connection
        db.command("ping")
        print("Connected to MongoDB successfully!")
        
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
