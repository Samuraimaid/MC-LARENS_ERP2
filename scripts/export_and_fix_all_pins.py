#!/usr/bin/env python3
import datetime
import hashlib
import json
import os
import bcrypt
from pymongo import MongoClient

uri = "mongodb+srv://dayavar18_db_user:El_Peluka_Sapbeee.2026@mclarens-db.nkdcim0.mongodb.net/mc-larens2_mundo_accesorios_erp?retryWrites=true&w=majority"
client = MongoClient(uri)
db = client["mc-larens2_mundo_accesorios_erp"]

now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def compute_pin_index(pin: str) -> str:
    return hashlib.sha256(pin.encode("utf-8")).hexdigest()

# 1. Asegurar Xinon admin permanente
login_pin_xinon = "01011990"
att_pin_xinon = "0101"
salt = bcrypt.gensalt()
login_hash_x = bcrypt.hashpw(login_pin_xinon.encode("utf-8"), salt).decode("utf-8")
login_idx_x = hashlib.sha256(login_pin_xinon.encode("utf-8")).hexdigest()
att_hash_x = bcrypt.hashpw(att_pin_xinon.encode("utf-8"), salt).decode("utf-8")
att_idx_x = hashlib.sha256(att_pin_xinon.encode("utf-8")).hexdigest()

db.users.update_one(
    {"$or": [{"email": "xinon@local"}, {"name": "Xinon"}]},
    {
        "$set": {
            "name": "Xinon",
            "email": "xinon@local",
            "role": "gerencia",
            "is_active": True,
            "is_pin_user": True,
            "login_pin_hash": login_hash_x,
            "login_pin_index": login_idx_x,
            "login_pin_last_set_at": now_iso,
            "attendance_pin_hash": att_hash_x,
            "attendance_pin_index": att_idx_x,
            "attendance_pin_last_set_at": now_iso,
            "kiosk_pin_plain": att_pin_xinon,
            "pin_hash": att_hash_x,
            "pin_index": att_idx_x,
            "pin_last_set_at": now_iso,
            "failed_pin_attempts": 0,
            "pin_lockout_until": None,
        }
    },
    upsert=True
)

# 2. Desbloquear todas las colecciones de bloqueo
db.users.update_many({}, {"$set": {"failed_pin_attempts": 0, "pin_lockout_until": None}})
if "pin_login_ip_lockouts" in db.list_collection_names():
    db.pin_login_ip_lockouts.drop()
if "pin_login_ip_attempts" in db.list_collection_names():
    db.pin_login_ip_attempts.drop()

# 3. Mapear y listar todos los usuarios
# Asignar PINs estándar conocidos si no los tienen o recuperar los existentes
users = list(db.users.find({}).sort([("role", 1), ("name", 1)]))

# Para mostrar la tabla completa con los PINs de cada usuario
table_data = []

known_pins = {
    "xinon@local": ("01011990", "0101"),
    "admin@mclarenerp.com": ("01011990", "0101"),
}

for idx, u in enumerate(users, start=1):
    name = u.get("name", "Usuario")
    role = u.get("role", "general")
    email = u.get("email", "")
    branch = u.get("branch_id") or "Todas / Central"
    
    # Determinar login_pin y attendance_pin
    if email == "xinon@local" or name == "Xinon":
        l_pin = "01011990"
        a_pin = "0101"
    elif "kiosk_pin_plain" in u and u["kiosk_pin_plain"]:
        a_pin = str(u["kiosk_pin_plain"])
        # If it has a known pattern or generated
        if u.get("login_pin_plain"):
            l_pin = str(u["login_pin_plain"])
        elif a_pin.isdigit():
            l_pin = f"{a_pin}000{idx % 10}"
        else:
            l_pin = f"{idx:08d}"
    else:
        a_pin = f"{(1000 + idx):04d}"
        l_pin = f"{(10000000 + idx):08d}"
        
    # Asegurar que los hashes en la base de datos coincidan exactamente con estos PINs
    cur_hash = u.get("login_pin_hash")
    if not cur_hash or not bcrypt.checkpw(l_pin.encode("utf-8"), cur_hash.encode("utf-8")):
        h_login = hash_pin(l_pin)
        idx_login = compute_pin_index(l_pin)
        h_att = hash_pin(a_pin)
        idx_att = compute_pin_index(a_pin)
        db.users.update_one(
            {"_id": u["_id"]},
            {
                "$set": {
                    "login_pin_hash": h_login,
                    "login_pin_index": idx_login,
                    "attendance_pin_hash": h_att,
                    "attendance_pin_index": idx_att,
                    "kiosk_pin_plain": a_pin,
                    "pin_hash": h_att,
                    "pin_index": idx_att,
                    "failed_pin_attempts": 0,
                    "pin_lockout_until": None,
                }
            }
        )

    table_data.append({
        "name": name,
        "role": role,
        "branch": branch,
        "email": email,
        "login_pin": l_pin,
        "attendance_pin": a_pin
    })

print(json.dumps(table_data, indent=2, ensure_ascii=False))
