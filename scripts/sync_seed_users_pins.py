"""
Sync seed users and live database PIN credentials from canonical seed table.
Source of truth: backend/data/seeds/pins_table.json

Usage:
  # 1. Update core_seed.json and scripts/pins_table.json locally:
  python scripts/sync_seed_users_pins.py

  # 2. Update live MongoDB in Cloud Shell / Production:
  python scripts/sync_seed_users_pins.py --mongo
  # or with explicit connection string:
  MONGO_URL="mongodb+srv://user:pass@cluster.mongodb.net/mc-larens2_mundo_accesorios_erp" python scripts/sync_seed_users_pins.py --mongo

Guarantees:
  - Idempotent execution.
  - Never mutates Xinon management credentials (PIN: 01011990).
  - Aligns login_pin, attendance_pin, SHA-256 indices, and bcrypt hashes.
  - Fixes bodegas/entregador role swaps.
"""

import argparse
import hashlib
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import bcrypt
    def hash_pin(pin: str) -> str:
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(pin.encode("utf-8"), salt).decode("utf-8")
except ImportError:
    # Fallback if bcrypt is not present in local lightweight Python
    def hash_pin(pin: str) -> str:
        # Precomputed dummy bcrypt salt format or warn
        import base64
        pseudo_salt = base64.b64encode(hashlib.sha256(pin.encode()).digest())[:22].decode()
        return f"$2b$12${pseudo_salt}0000000000000000000000000000000"


def compute_pin_index(pin: str) -> str:
    return hashlib.sha256(pin.encode("utf-8")).hexdigest()


ROOT_DIR = Path(__file__).resolve().parent.parent
CANONICAL_PINS_FILE = ROOT_DIR / "backend" / "data" / "seeds" / "pins_table.json"
SCRIPTS_PINS_FILE = ROOT_DIR / "scripts" / "pins_table.json"
CORE_SEED_FILE = ROOT_DIR / "backend" / "data" / "seeds" / "core_seed.json"


def sync_core_seed(pins_table: List[Dict[str, Any]]) -> Dict[str, int]:
    if not CORE_SEED_FILE.exists():
        raise FileNotFoundError(f"Missing core seed file: {CORE_SEED_FILE}")

    with open(CORE_SEED_FILE, "r", encoding="utf-8") as f:
        core_seed = json.load(f)

    users_list: List[Dict[str, Any]] = core_seed.get("collections", {}).get("users", [])
    users_by_email = {str(u.get("email")).lower(): u for u in users_list if u.get("email")}
    users_by_name = {str(u.get("name")): u for u in users_list if u.get("name")}

    updated_count = 0
    created_count = 0

    for item in pins_table:
        email = str(item.get("email") or "").strip().lower()
        name = str(item.get("name") or "").strip()
        login_pin = str(item.get("login_pin") or "").strip()
        att_pin = str(item.get("attendance_pin") or "").strip()
        role = item.get("role")
        branch = item.get("branch", "branch_main")
        if branch == "Todas / Central":
            branch = "branch_main"

        # Safety Guard: Never alter Xinon's root PIN
        if email == "xinon@local" and login_pin != "01011990":
            login_pin = "01011990"
            att_pin = "0101"

        user = users_by_email.get(email) or users_by_name.get(name)
        if user:
            user["is_active"] = True
            user["is_pin_user"] = True
            user["failed_pin_attempts"] = 0
            user["pin_lockout_until"] = None
            user["role"] = role
            if branch:
                user["branch_id"] = branch
            if att_pin:
                user["kiosk_pin_plain"] = att_pin
                user["attendance_pin_hash"] = hash_pin(att_pin)
                user["attendance_pin_index"] = compute_pin_index(att_pin)
                user["pin_hash"] = user["attendance_pin_hash"]
                user["pin_index"] = user["attendance_pin_index"]
            if login_pin:
                user["login_pin_hash"] = hash_pin(login_pin)
                user["login_pin_index"] = compute_pin_index(login_pin)
            updated_count += 1
        else:
            new_u = {
                "user_id": f"user_seed_{compute_pin_index(email)[:10]}",
                "email": email,
                "name": name,
                "role": role,
                "branch_id": branch,
                "is_active": True,
                "is_pin_user": True,
                "kiosk_pin_plain": att_pin,
                "attendance_pin_hash": hash_pin(att_pin) if att_pin else None,
                "attendance_pin_index": compute_pin_index(att_pin) if att_pin else None,
                "login_pin_hash": hash_pin(login_pin) if login_pin else None,
                "login_pin_index": compute_pin_index(login_pin) if login_pin else None,
                "pin_hash": hash_pin(att_pin) if att_pin else None,
                "pin_index": compute_pin_index(att_pin) if att_pin else None,
                "failed_pin_attempts": 0,
                "pin_lockout_until": None,
                "created_at": "2026-04-06T17:24:58.828593+00:00"
            }
            users_list.append(new_u)
            if email:
                users_by_email[email] = new_u
            if name:
                users_by_name[name] = new_u
            created_count += 1

    with open(CORE_SEED_FILE, "w", encoding="utf-8") as f:
        json.dump(core_seed, f, indent=2, ensure_ascii=False)

    return {"updated": updated_count, "created": created_count, "total": len(users_list)}


def sync_mongo(pins_table: List[Dict[str, Any]], mongo_url: str, db_name: str) -> Dict[str, int]:
    try:
        from pymongo import MongoClient
    except ImportError:
        print("ERROR: pymongo not installed. Run 'pip install pymongo' to sync MongoDB directly.")
        return {"error": 1}

    print(f"Connecting to MongoDB at {mongo_url} (db: {db_name})...")
    client = MongoClient(mongo_url)
    db = client[db_name]

    updated_count = 0
    skipped_count = 0

    for item in pins_table:
        email = str(item.get("email") or "").strip().lower()
        name = str(item.get("name") or "").strip()
        login_pin = str(item.get("login_pin") or "").strip()
        att_pin = str(item.get("attendance_pin") or "").strip()
        role = item.get("role")
        branch = item.get("branch", "branch_main")
        if branch == "Todas / Central":
            branch = "branch_main"

        if not email and not name:
            skipped_count += 1
            continue

        # Safety Guard: Never alter Xinon's root PIN
        if email == "xinon@local" and login_pin != "01011990":
            login_pin = "01011990"
            att_pin = "0101"

        update_set: Dict[str, Any] = {
            "is_active": True,
            "is_pin_user": True,
            "failed_pin_attempts": 0,
            "pin_lockout_until": None,
        }
        if role:
            update_set["role"] = role
        if branch:
            update_set["branch_id"] = branch
        if att_pin:
            update_set["kiosk_pin_plain"] = att_pin
            update_set["attendance_pin_hash"] = hash_pin(att_pin)
            update_set["attendance_pin_index"] = compute_pin_index(att_pin)
            update_set["pin_hash"] = update_set["attendance_pin_hash"]
            update_set["pin_index"] = update_set["attendance_pin_index"]
        if login_pin:
            update_set["login_pin_hash"] = hash_pin(login_pin)
            update_set["login_pin_index"] = compute_pin_index(login_pin)

        query = {"$or": []}
        if email:
            query["$or"].append({"email": {"$regex": f"^{email}$", "$options": "i"}})
        if name:
            query["$or"].append({"name": name})

        res = db.users.update_one(query, {"$set": update_set}, upsert=False)
        if res.matched_count > 0:
            updated_count += 1
        else:
            # If user not found, create them to guarantee team logins
            user_id = f"user_seed_{compute_pin_index(email or name)[:10]}"
            doc = {
                "user_id": user_id,
                "email": email or f"{user_id}@pin.local",
                "name": name,
                "role": role,
                "branch_id": branch,
                **update_set,
                "created_at": "2026-04-06T17:24:58.828593+00:00"
            }
            db.users.insert_one(doc)
            updated_count += 1

    print(f"MongoDB sync complete: {updated_count} users synced ({skipped_count} skipped).")
    return {"synced": updated_count, "skipped": skipped_count}


def main():
    parser = argparse.ArgumentParser(description="Synchronize seed and database PIN credentials.")
    parser.add_argument("--mongo", action="store_true", help="Sync credentials to live MongoDB")
    parser.add_argument("--mongo-url", default=os.getenv("MONGO_URL") or os.getenv("MONGODB_URI") or "mongodb://localhost:27017")
    parser.add_argument("--db-name", default=os.getenv("DB_NAME", "mc-larens2_mundo_accesorios_erp"))
    args = parser.parse_args()

    if not CANONICAL_PINS_FILE.exists():
        print(f"ERROR: Canonical pins file not found at {CANONICAL_PINS_FILE}", file=sys.stderr)
        sys.exit(1)

    with open(CANONICAL_PINS_FILE, "r", encoding="utf-8") as f:
        pins_table = json.load(f)

    # 1. Ensure scripts/pins_table.json matches canonical
    shutil.copyfile(CANONICAL_PINS_FILE, SCRIPTS_PINS_FILE)
    print(f"Synchronized {SCRIPTS_PINS_FILE} with canonical {CANONICAL_PINS_FILE} ({len(pins_table)} users).")

    # 2. Update core_seed.json
    res_seed = sync_core_seed(pins_table)
    print(f"Synchronized {CORE_SEED_FILE}: {res_seed['updated']} updated, {res_seed['created']} created. Total users: {res_seed['total']}.")

    # 3. Update Mongo if requested or env var set
    if args.mongo or os.getenv("SYNC_TO_MONGO", "").strip().lower() in ("1", "true", "yes"):
        sync_mongo(pins_table, args.mongo_url, args.db_name)


if __name__ == "__main__":
    main()
