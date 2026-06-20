from __future__ import annotations

import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import bcrypt
from pymongo import MongoClient

CORE_ROLES: list[str] = [
    "gerencia",
    "recursos_humanos",
    "supervisor",
    "cajero",
    "ventas",
    "electrico",
    "polarizador",
    "transporte",
    "bodegas",
    "instalaciones",
    "programador",
]

ROLE_LABELS: dict[str, str] = {
    "gerencia": "Gerencia",
    "recursos_humanos": "Recursos Humanos",
    "supervisor": "Supervisor",
    "cajero": "Cajero",
    "ventas": "Ventas",
    "electrico": "Eléctrico",
    "polarizador": "Polarizador",
    "transporte": "Transporte",
    "bodegas": "Bodegas",
    "instalaciones": "Instalaciones",
    "programador": "Programador",
}


def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def compute_pin_index(pin: str) -> str:
    return hashlib.sha256(pin.encode("utf-8")).hexdigest()


def load_users_backup(workspace_root: Path) -> dict[str, dict]:
    users_file = workspace_root / "users.json"
    if not users_file.exists():
        return {}

    try:
        raw = json.loads(users_file.read_text(encoding="utf-8"))
    except Exception:
        return {}

    rows = raw.get("value") if isinstance(raw, dict) else None
    if not isinstance(rows, list):
        return {}

    by_role: dict[str, dict] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        role = (row.get("role") or "").strip().lower()
        if role and role not in by_role:
            by_role[role] = row
    return by_role


def build_user_from_role(role: str, index: int, backup_row: dict | None) -> dict:
    now_iso = datetime.now(timezone.utc).isoformat()
    attendance_pin = f"{index % 10000:04d}"
    login_pin = f"{index % 100000000:08d}"

    backup_row = backup_row or {}
    user_id = (backup_row.get("user_id") or "").strip() or f"user_{uuid.uuid4().hex[:12]}"
    email = (backup_row.get("email") or "").strip() or f"{role}@local"
    name = (backup_row.get("name") or "").strip() or f"{ROLE_LABELS.get(role, role.title())}"

    attendance_pin_hash = hash_pin(attendance_pin)
    login_pin_hash = hash_pin(login_pin)

    return {
        "user_id": user_id,
        "email": email,
        "name": name,
        "role": role,
        "is_active": True,
        "is_pin_user": True,
        "phone": backup_row.get("phone") or "0000-0000",
        "profile_emoji": backup_row.get("profile_emoji") or "👤",
        "theme_mode": backup_row.get("theme_mode") or "light",
        "theme_skin": backup_row.get("theme_skin") or "atlas",
        "theme_custom": backup_row.get("theme_custom") or {},
        "attendance_pin_hash": attendance_pin_hash,
        "attendance_pin_index": compute_pin_index(attendance_pin),
        "attendance_pin_last_set_at": now_iso,
        "kiosk_pin_plain": attendance_pin,
        "login_pin_hash": login_pin_hash,
        "login_pin_index": compute_pin_index(login_pin),
        "login_pin_last_set_at": now_iso,
        "pin_hash": attendance_pin_hash,
        "pin_index": compute_pin_index(attendance_pin),
        "pin_last_set_at": now_iso,
        "failed_pin_attempts": 0,
        "pin_lockout_until": None,
        "updated_at": now_iso,
    }


def main() -> None:
    workspace_root = Path(__file__).resolve().parents[1]
    mongo_url = os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017")
    mongo_db = os.environ.get("MONGO_DB", os.environ.get("DB_NAME", "erp"))

    db = MongoClient(mongo_url)[mongo_db]
    backup_by_role = load_users_backup(workspace_root)

    restored_users: list[dict] = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for idx, role in enumerate(CORE_ROLES, start=1):
        desired = build_user_from_role(role, idx, backup_by_role.get(role))

        existing = db.users.find_one(
            {"$or": [{"user_id": desired["user_id"]}, {"email": desired["email"]}]},
            {"_id": 0, "user_id": 1},
        )
        target_user_id = (existing or {}).get("user_id") or desired["user_id"]

        db.users.update_one(
            {"user_id": target_user_id},
            {
                "$set": desired,
                "$setOnInsert": {"created_at": now_iso},
            },
            upsert=True,
        )

        restored_users.append(
            {
                "user_id": target_user_id,
                "email": desired["email"],
                "role": role,
                "attendance_pin": desired["kiosk_pin_plain"],
                "login_pin": f"{idx % 100000000:08d}",
            }
        )

    for role in CORE_ROLES:
        db.role_permissions.update_one(
            {"role": role},
            {
                "$set": {
                    "role": role,
                    "permissions": {},
                    "updated_at": now_iso,
                    "updated_by": "restore_users_roles_permissions_baseline",
                },
                "$setOnInsert": {
                    "created_at": now_iso,
                    "created_by": "restore_users_roles_permissions_baseline",
                },
            },
            upsert=True,
        )

    counts_by_role = {
        role: db.users.count_documents({"role": role, "is_active": True})
        for role in CORE_ROLES
    }

    print("restored_users_count", len(restored_users))
    print("role_permissions_count", db.role_permissions.count_documents({}))
    print("users_total", db.users.count_documents({}))
    print("counts_by_role", counts_by_role)
    print("restored_users")
    for row in restored_users:
        print(row)


if __name__ == "__main__":
    main()
