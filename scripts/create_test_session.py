#!/usr/bin/env python3
"""Create a test user and session directly in MongoDB.

Usage:
  python scripts/create_test_session.py

The script reads `MONGO_URL` and `DB_NAME` from the environment with sensible
defaults (mongodb://localhost:27017 and 'erp' respectively). It prints the
inserted session token and user_id on success.
"""
import os
import secrets
from datetime import datetime, timedelta
import sys

try:
    from pymongo import MongoClient
except Exception as exc:
    print("Missing dependency: pymongo. Install with 'pip install pymongo'", file=sys.stderr)
    raise


def main():
    mongo_url = os.environ.get(
        "MONGO_URL",
        "mongodb://127.0.0.1:27017/?directConnection=true",
    )
    db_name = os.environ.get("MONGO_DB", os.environ.get("DB_NAME", "erp"))

    print(f"Connecting to MongoDB: {mongo_url}", flush=True)
    client = MongoClient(
        mongo_url,
        serverSelectionTimeoutMS=3000,
        connectTimeoutMS=3000,
        socketTimeoutMS=3000,
    )
    # Force a connection attempt early to surface errors quickly.
    try:
        client.admin.command("ping")
    except Exception as exc:
        print(f"MongoDB ping failed: {exc}", file=sys.stderr, flush=True)
        sys.exit(1)
    db = client[db_name]

    user_id = f"user_test_{secrets.token_hex(6)}"
    now_iso = datetime.utcnow().isoformat()

    user = {
        "user_id": user_id,
        "email": "test.admin@local",
        "name": "Test Admin",
        "role": "gerencia",
        "is_active": True,
        "created_at": now_iso,
    }

    db.users.update_one({"user_id": user_id}, {"$set": user}, upsert=True)

    token = secrets.token_hex(16)
    session = {
        "session_token": token,
        "user_id": user_id,
        "created_at": now_iso,
        "expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
    }

    db.sessions.insert_one(session)

    print("OK")
    print(f"db: {mongo_url} / {db_name}")
    print(f"user_id: {user_id}")
    print(f"session_token: {token}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("Error creating test session:", e, file=sys.stderr)
        sys.exit(1)
