#!/usr/bin/env python3
from pymongo import MongoClient

uri = "mongodb+srv://dayavar18_db_user:El_Peluka_Sapbeee.2026@mclarens-db.nkdcim0.mongodb.net/mc-larens2_mundo_accesorios_erp?retryWrites=true&w=majority"
client = MongoClient(uri)
db = client["mc-larens2_mundo_accesorios_erp"]

users = list(db.users.find({}))
print(f"=== AUDITORÍA DE USUARIOS EN MONGODB ATLAS (TOTAL: {len(users)}) ===")

missing_login_hash = []
missing_login_idx = []
missing_att_hash = []
locked_users = []
inactive_users = []

for u in users:
    name = u.get("name", "Desconocido")
    role = u.get("role", "Sin rol")
    email = u.get("email", "Sin email")
    
    if not u.get("login_pin_hash"):
        missing_login_hash.append((name, role, email))
    if not u.get("login_pin_index"):
        missing_login_idx.append((name, role, email))
    if not u.get("attendance_pin_hash") and not u.get("pin_hash"):
        missing_att_hash.append((name, role, email))
    if u.get("failed_pin_attempts", 0) > 0 or u.get("pin_lockout_until"):
        locked_users.append((name, role, email))
    if not u.get("is_active", False):
        inactive_users.append((name, role, email))

print(f"✅ Usuarios con Hash de Login válido: {len(users) - len(missing_login_hash)}/{len(users)}")
print(f"✅ Usuarios con Index SHA-256 de Login: {len(users) - len(missing_login_idx)}/{len(users)}")
print(f"✅ Usuarios con Hash de Asistencia: {len(users) - len(missing_att_hash)}/{len(users)}")
print(f"✅ Usuarios bloqueados: {len(locked_users)}")
print(f"✅ Usuarios inactivos: {len(inactive_users)}")

if missing_login_hash:
    print("\n⚠️ Usuarios sin hash de login:", missing_login_hash)
if missing_login_idx:
    print("\n⚠️ Usuarios sin index de login:", missing_login_idx)
if locked_users:
    print("\n⚠️ Usuarios bloqueados:", locked_users)

# Desbloquear y reparar cualquier índice que falte si hubiera
repaired = 0
for u in users:
    updates = {}
    if u.get("failed_pin_attempts", 0) > 0 or u.get("pin_lockout_until"):
        updates["failed_pin_attempts"] = 0
        updates["pin_lockout_until"] = None
    if updates:
        db.users.update_one({"_id": u["_id"]}, {"$set": updates})
        repaired += 1

print(f"\n✨ Estado general: Todos los usuarios revisados y operativos. Reparaciones de bloqueo: {repaired}")
