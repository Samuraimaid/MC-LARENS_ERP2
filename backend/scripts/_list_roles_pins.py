#!/usr/bin/env python3
"""List active users by role for multi-role live suite setup."""
from __future__ import annotations

import asyncio
import os
from collections import Counter

from motor.motor_asyncio import AsyncIOMotorClient


async def main() -> None:
    uri = os.environ.get("MONGO_URL") or os.environ.get("MONGODB_LOCAL_URI") or "mongodb://mongodb:27017"
    dbn = os.environ.get("DB_NAME") or "mc-larens2_mundo_accesorios_erp"
    client = AsyncIOMotorClient(uri)
    db = client[dbn]
    users = await db.users.find(
        {"is_active": {"$ne": False}},
        {
            "_id": 0,
            "user_id": 1,
            "name": 1,
            "last_name": 1,
            "role": 1,
            "branch_id": 1,
            "is_pin_user": 1,
            "phone": 1,
        },
    ).to_list(500)
    roles = Counter(str(u.get("role")) for u in users)
    print("ROLE COUNTS:", dict(sorted(roles.items())))
    print("---")
    for u in sorted(users, key=lambda x: (str(x.get("role")), str(x.get("name")))):
        name = f"{u.get('name') or ''} {u.get('last_name') or ''}".strip()
        print(
            f"{str(u.get('role')):32} | {name:28} | pin={u.get('is_pin_user')} "
            f"| branch={u.get('branch_id')} | id={u.get('user_id')}"
        )


if __name__ == "__main__":
    asyncio.run(main())
