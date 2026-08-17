#!/usr/bin/env python3
import datetime
import hashlib
import bcrypt
from pymongo import MongoClient

uri = "mongodb+srv://dayavar18_db_user:El_Peluka_Sapbeee.2026@mclarens-db.nkdcim0.mongodb.net/mc-larens2_mundo_accesorios_erp?retryWrites=true&w=majority"
client = MongoClient(uri)
db = client["mc-larens2_mundo_accesorios_erp"]

login_pin = "01011990"
att_pin = "0101"
now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

salt = bcrypt.gensalt()
login_hash = bcrypt.hashpw(login_pin.encode("utf-8"), salt).decode("utf-8")
att_hash = bcrypt.hashpw(att_pin.encode("utf-8"), salt).decode("utf-8")

login_idx = hashlib.sha256(login_pin.encode("utf-8")).hexdigest()
att_idx = hashlib.sha256(att_pin.encode("utf-8")).hexdigest()

user_doc = {
    "user_id": "user_xinon_admin",
    "name": "Xinon",
    "email": "xinon@local",
    "role": "gerencia",
    "is_active": True,
    "is_pin_user": True,
    "login_pin_hash": login_hash,
    "login_pin_index": login_idx,
    "login_pin_last_set_at": now_iso,
    "attendance_pin_hash": att_hash,
    "attendance_pin_index": att_idx,
    "attendance_pin_last_set_at": now_iso,
    "kiosk_pin_plain": att_pin,
    "pin_hash": att_hash,
    "pin_index": att_idx,
    "pin_last_set_at": now_iso,
    "failed_pin_attempts": 0,
    "pin_lockout_until": None,
    "created_at": now_iso,
    "updated_at": now_iso,
}

db.users.delete_many({"$or": [{"email": "xinon@local"}, {"name": "Xinon"}]})
db.users.insert_one(user_doc)
print("Usuario Xinon insertado con PIN 01011990 y rol gerencia!")

# Resetear bloqueos de intentos fallidos
db.users.update_many({}, {"$set": {"failed_pin_attempts": 0, "pin_lockout_until": None}})
if "pin_login_ip_lockouts" in db.list_collection_names():
    db.pin_login_ip_lockouts.drop()
if "pin_login_ip_attempts" in db.list_collection_names():
    db.pin_login_ip_attempts.drop()

print("¡Bloqueos de IP y de usuarios reseteados exitosamente!")

# Verificar búsqueda por login_pin_index
found = db.users.find_one({"login_pin_index": login_idx, "is_pin_user": True, "is_active": True})
print("Verificación de búsqueda por PIN index:", found.get("name"), found.get("role"))
