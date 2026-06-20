from datetime import datetime, timezone
import os

import bcrypt
from pymongo import MongoClient


TEST_USERS = [
    {
        "user_id": "user_4e83905e28",
        "name": "Test Gerencia",
        "email": "test_gerencia@local",
        "role": "gerencia",
        "pin": "91000001",
    },
    {
        "user_id": "user_1731e73966",
        "name": "Test Supervisor",
        "email": "test_supervisor@local",
        "role": "supervisor",
        "pin": "91000002",
    },
    {
        "user_id": "user_4d3fcc280e",
        "name": "Test Ventas",
        "email": "test_ventas@local",
        "role": "ventas",
        "pin": "91000003",
    },
    {
        "user_id": "user_296ef19b85",
        "name": "Test Eléctrico",
        "email": "test_electrico@local",
        "role": "electrico",
        "pin": "91000004",
    },
    {
        "user_id": "user_b30979f465",
        "name": "Test Polarizador",
        "email": "test_polarizador@local",
        "role": "polarizador",
        "pin": "91000005",
    },
    {
        "user_id": "user_a3d9bc4825",
        "name": "Test Transporte",
        "email": "test_transporte@local",
        "role": "transporte",
        "pin": "91000006",
    },
    {
        "user_id": "user_1977b3337d",
        "name": "Test Bodegas",
        "email": "test_bodegas@local",
        "role": "bodegas",
        "pin": "91000007",
    },
    {
        "user_id": "user_baaf5080c0",
        "name": "Test Instalaciones",
        "email": "test_instalaciones@local",
        "role": "instalaciones",
        "pin": "91000008",
    },
]


def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pin_hash(pin: str, pin_hash: str | None) -> bool:
    if not pin_hash:
        return False
    try:
        return bcrypt.checkpw(pin.encode("utf-8"), pin_hash.encode("utf-8"))
    except Exception:
        return False


def validate_test_users_config() -> None:
    seen_user_ids: set[str] = set()
    seen_emails: set[str] = set()
    seen_pins: dict[str, str] = {}

    for user in TEST_USERS:
        user_id = user.get("user_id", "")
        email = user.get("email", "")
        pin = user.get("pin", "")

        if not user_id or not isinstance(user_id, str):
            raise RuntimeError("TEST_USERS contiene un user_id inválido")
        if not email or not isinstance(email, str):
            raise RuntimeError(f"TEST_USERS contiene email inválido para {user_id}")
        if not (isinstance(pin, str) and pin.isdigit() and len(pin) == 8):
            raise RuntimeError(f"PIN inválido para {user_id}: debe tener exactamente 8 dígitos")

        if user_id in seen_user_ids:
            raise RuntimeError(f"user_id duplicado en TEST_USERS: {user_id}")
        seen_user_ids.add(user_id)

        if email in seen_emails:
            raise RuntimeError(f"email duplicado en TEST_USERS: {email}")
        seen_emails.add(email)

        if pin in seen_pins and seen_pins[pin] != user_id:
            raise RuntimeError(
                f"PIN duplicado en TEST_USERS: {pin} (usuarios {seen_pins[pin]} y {user_id})"
            )
        seen_pins[pin] = user_id


def validate_pin_conflicts_with_db(db) -> None:
    candidates = list(
        db.users.find(
            {"is_pin_user": True},
            {"_id": 0, "user_id": 1, "pin_hash": 1, "email": 1, "name": 1},
        ).limit(5000)
    )

    for user in TEST_USERS:
        user_id = user["user_id"]
        pin = user["pin"]
        for candidate in candidates:
            candidate_user_id = candidate.get("user_id")
            if candidate_user_id == user_id:
                continue
            if verify_pin_hash(pin, candidate.get("pin_hash")):
                candidate_label = candidate.get("email") or candidate.get("name") or candidate_user_id
                raise RuntimeError(
                    f"Conflicto de PIN detectado: el PIN de {user_id} ya está en uso por {candidate_label} ({candidate_user_id})"
                )


def main() -> None:
    validate_test_users_config()

    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("MONGO_DB", os.environ.get("DB_NAME", "erp"))

    client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
    db = client[db_name]

    validate_pin_conflicts_with_db(db)

    now_iso = datetime.now(timezone.utc).isoformat()

    desired_user_ids = {user["user_id"] for user in TEST_USERS}
    desired_emails = {user["email"] for user in TEST_USERS}

    delete_query = {
        "email": {"$in": list(desired_emails)},
        "user_id": {"$nin": list(desired_user_ids)},
    }
    removed_duplicates = db.users.delete_many(delete_query).deleted_count

    upserted = []
    for user in TEST_USERS:
        update = {
            "$set": {
                "email": user["email"],
                "name": user["name"],
                "role": user["role"],
                "is_active": True,
                "is_pin_user": True,
                "pin_hash": hash_pin(user["pin"]),
                "pin_last_set_at": now_iso,
                "failed_pin_attempts": 0,
                "pin_lockout_until": None,
            },
            "$setOnInsert": {
                "created_at": now_iso,
            },
        }
        db.users.update_one({"user_id": user["user_id"]}, update, upsert=True)
        upserted.append(
            {
                "user_id": user["user_id"],
                "email": user["email"],
                "role": user["role"],
                "pin": user["pin"],
            }
        )

    print("removed_duplicates=", removed_duplicates)
    print("upserted_count=", len(upserted))
    for row in upserted:
        print(row)


if __name__ == "__main__":
    main()
