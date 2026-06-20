#!/usr/bin/env python3
import os
import random
import uuid
from datetime import datetime
from pymongo import MongoClient

# Configuration
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('MONGO_DB', os.environ.get('DB_NAME', 'mundo_accesorios_erp'))

nombres = ["Juan", "Maria", "Carlos", "Ana", "Luis", "Elena", "Pedro", "Sofia", "Jorge", "Rosa",
           "Miguel", "Lucia", "Roberto", "Carmen", "Javier", "Teresa", "Ricardo", "Francis", "Mario", "Adriana"]
apellidos = ["Perez", "Lopez", "Ruiz", "Garcia", "Torres", "Meza", "Ortiz", "Rios", "Luna", "Mora",
             "Martinez", "Rodriguez", "Hernandez", "Gaitan", "Zelaya", "Castillo", "Blanco", "Sosa", "Nu\u00f1ez", "Vargas"]

modelos_vin = {
    "Yaris": "JTDJT5230H1",
    "Corolla": "2T1BU4EE0PC",
    "Hilux": "MROFZ22G0N1",
    "Land Cruiser Prado": "JTEBH9FJ0K1",
    "Land Cruiser Pickup": "JTEHT72J0R1",
    "Land Cruiser 200": "JTMBA1AJ0M1",
    "Land Cruiser 300": "JTMCA2BJ0N1",
    "Rush": "JDAF150S0B1",
    "Agya": "JKB100S0P10",
    "Hiace": "JTFRE22G0F1",
    "Dyna": "JTEKD32G0L1"
}

deps = ["M", "LE", "CH", "MT", "ES", "JI", "MY", "CT", "RS"]

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

print(f"Connected to {MONGO_URL} db={DB_NAME}")

# Preserve José Valdes (case-insensitive)
preserve = list(db.customers.find({"name": {"$regex": "^Jose Valdes$", "$options": "i"}}, {"_id": 0}))
if preserve:
    preserved_ids = [c['customer_id'] for c in preserve]
else:
    preserved_ids = []

print(f"Preserving customer ids: {preserved_ids}")

# Delete customers except preserved
del_filter = {"name": {"$not": {"$regex": "^Jose Valdes$", "$options": "i"}}} if preserved_ids else {}
if preserved_ids:
    # delete all customers whose customer_id not in preserved_ids
    del_res = db.customers.delete_many({"customer_id": {"$nin": preserved_ids}})
else:
    del_res = db.customers.delete_many({})
print(f"Deleted {del_res.deleted_count} customers")

# Delete vehicles for removed customers
if preserved_ids:
    del_v_res = db.vehicles.delete_many({"customer_id": {"$nin": preserved_ids}})
else:
    del_v_res = db.vehicles.delete_many({})
print(f"Deleted {del_v_res.deleted_count} vehicles")

# Helper to generate unique ids
def id_customer(i):
    return f"cust_{uuid.uuid4().hex[:12]}"

def id_vehicle(i):
    return f"veh_{uuid.uuid4().hex[:12]}"

created_customers = []
next_idx = 1

# distribution: 50 with 3 vehicles, 50 with 2, 50 with 1, 50 with 0
groups = [3]*50 + [2]*50 + [1]*50 + [0]*50
random.shuffle(groups)

for i, vehicles_count in enumerate(groups, start=1):
    first = random.choice(nombres)
    last = random.choice(apellidos)
    name = f"{first} {last}"
    phone = f"88{random.randint(10,99)}-{random.randint(1000,9999)}"
    customer_id = id_customer(i)
    customer_doc = {
        "customer_id": customer_id,
        "name": name,
        "first_name": first,
        "last_name": last,
        "phone": phone,
        "email": None,
        "address": None,
        "created_at": datetime.utcnow().isoformat()
    }
    db.customers.insert_one(customer_doc)
    created_customers.append(customer_doc)

    # create vehicles
    for v in range(vehicles_count):
        veh_model = random.choice(list(modelos_vin.keys()))
        vin_base = modelos_vin[veh_model]
        chasis = f"{vin_base}{str(i).zfill(6)}{str(v).zfill(2)}"  # ensure uniqueness
        plate = f"{random.choice(deps)} {random.randint(100,999)} {random.randint(100,999)}"
        vehicle_doc = {
            "vehicle_id": id_vehicle(i),
            "customer_id": customer_id,
            "plate": plate,
            "brand": veh_model,
            "model": veh_model,
            "year": random.randint(2005, 2023),
            "vin": chasis,
            "created_at": datetime.utcnow().isoformat()
        }
        db.vehicles.insert_one(vehicle_doc)

print(f"Inserted {len(created_customers)} customers")
print(f"Total customers in DB: {db.customers.count_documents({})}")
print(f"Total vehicles in DB: {db.vehicles.count_documents({})}")

print("Done")
