#!/usr/bin/env python3
import json
from pymongo import MongoClient

uri = "mongodb+srv://dayavar18_db_user:El_Peluka_Sapbeee.2026@mclarens-db.nkdcim0.mongodb.net/mc-larens2_mundo_accesorios_erp?retryWrites=true&w=majority"
client = MongoClient(uri)
db = client["mc-larens2_mundo_accesorios_erp"]

branches = list(db.branches.find({}, {"_id": 0}))
warehouses = list(db.warehouses.find({}, {"_id": 0}))

print("=== SUCURSALES EN MONGODB ATLAS ===")
print(json.dumps(branches, indent=2, ensure_ascii=False))

print("\n=== BODEGAS EN MONGODB ATLAS ===")
print(json.dumps(warehouses, indent=2, ensure_ascii=False))
