#!/usr/bin/env python3
"""Seed test customers and vehicles for Managua sales testing.

Creates:
- 20 natural-person customers (phones starting with 88)
- 20 company customers (phones starting with 78)
- 3 vehicles per customer (120 vehicles total)

The script is idempotent for this dataset using `source_seed`.
"""

from __future__ import annotations

import os
import random
import uuid
from datetime import datetime, timezone

from pymongo import MongoClient

SEED_TAG = "seed_managua_customers_vehicles_v1"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")

NATURAL_CUSTOMERS = [
    ("Juan Carlos", "Perez", "juan.perez88@example.com", "Barrio Altagracia, Managua"),
    ("Maria Fernanda", "Lopez", "maria.lopez88@example.com", "Colonia Centroamerica, Managua"),
    ("Luis Alberto", "Gonzalez", "luis.gonzalez88@example.com", "Villa Fontana, Managua"),
    ("Ana Lucia", "Martinez", "ana.martinez88@example.com", "Bello Horizonte, Managua"),
    ("Carlos Enrique", "Ruiz", "carlos.ruiz88@example.com", "Carretera a Masaya, km 8, Managua"),
    ("Sofia Elena", "Castillo", "sofia.castillo88@example.com", "Reparto San Juan, Managua"),
    ("Pedro Jose", "Torres", "pedro.torres88@example.com", "Altamira, Managua"),
    ("Adriana Maria", "Mora", "adriana.mora88@example.com", "Las Colinas, Managua"),
    ("Miguel Angel", "Rios", "miguel.rios88@example.com", "Ciudad Jardin, Managua"),
    ("Rosa Maria", "Zelaya", "rosa.zelaya88@example.com", "Bolonia, Managua"),
    ("Jorge Luis", "Ortega", "jorge.ortega88@example.com", "Reparto Las Palmas, Managua"),
    ("Teresa Isabel", "Blandon", "teresa.blandon88@example.com", "Linda Vista, Managua"),
    ("Roberto Antonio", "Navarro", "roberto.navarro88@example.com", "Monseñor Lezcano, Managua"),
    ("Carmen Julia", "Luna", "carmen.luna88@example.com", "Batahola Norte, Managua"),
    ("Francisco Javier", "Hernandez", "francisco.hernandez88@example.com", "Colonia Miguel Bonilla, Managua"),
    ("Daniela Sofia", "Vargas", "daniela.vargas88@example.com", "Reparto Schick, Managua"),
    ("Ricardo Andres", "Mejia", "ricardo.mejia88@example.com", "Bello Horizonte Oeste, Managua"),
    ("Lucia Alejandra", "Gaitan", "lucia.gaitan88@example.com", "Las Brisas, Managua"),
    ("Mario Augusto", "Flores", "mario.flores88@example.com", "Larreynaga, Managua"),
    ("Patricia Elena", "Silva", "patricia.silva88@example.com", "Mercado Oriental sector sur, Managua"),
]

COMPANY_CUSTOMERS = [
    ("Claro Nicaragua", "contacto@claro.com.ni", "Pista Juan Pablo II, Managua"),
    ("Tigo Nicaragua", "contacto@tigo.com.ni", "Carretera a Masaya, Managua"),
    ("Banco Lafise", "contacto@lafise.com", "Edificio Corporativo Lafise, Managua"),
    ("BAC Credomatic Nicaragua", "contacto@baccredomatic.com", "Galerias Santo Domingo, Managua"),
    ("Banpro Grupo Promerica", "contacto@banpro.com.ni", "Edificio Banpro, Managua"),
    ("Casa Pellas", "contacto@casapellas.com", "Carretera Norte, Managua"),
    ("Grupo Q Nicaragua", "contacto@grupoq.com", "Carretera a Masaya, Managua"),
    ("DHL Nicaragua", "contacto@dhl.com", "Carretera Norte, Managua"),
    ("PriceSmart Nicaragua", "contacto@pricesmart.com", "Carretera a Masaya, Managua"),
    ("Walmart Nicaragua", "contacto@walmart.com", "Metrocentro, Managua"),
    ("Supermercados La Colonia", "contacto@lacolonia.com.ni", "Oficinas Centrales, Managua"),
    ("Disnorte Dissur", "contacto@disnorte-dissur.com", "Carretera Norte, Managua"),
    ("ENACAL", "contacto@enacal.com.ni", "Bolonia, Managua"),
    ("EPN Nicaragua", "contacto@epn.gob.ni", "Avenida Bolivar, Managua"),
    ("Cargill Nicaragua", "contacto@cargill.com", "Las Mercedes, Managua"),
    ("NESTLE Nicaragua", "contacto@ni.nestle.com", "Carretera a Masaya, Managua"),
    ("Grupo Lala Nicaragua", "contacto@lala.com", "Carretera Norte, Managua"),
    ("Comtech Nicaragua", "contacto@comtech.com.ni", "Villa Fontana, Managua"),
    ("SINSA", "contacto@sinsa.com.ni", "Pista Suburbana, Managua"),
    ("Farmacias Kielsa Nicaragua", "contacto@kielsa.com", "Carretera a Masaya, Managua"),
]

NATURAL_BRANDS = ["NISSAN", "HONDA", "SUZUKI"]
COMPANY_BRANDS = ["KIA", "HYUNDAI", "TOYOTA"]

MODELS = {
    "NISSAN": ["SENTRA", "VERSA", "X-TRAIL"],
    "HONDA": ["CIVIC", "CR-V", "FIT"],
    "SUZUKI": ["SWIFT", "VITARA", "JIMNY"],
    "KIA": ["RIO", "SPORTAGE", "SORENTO"],
    "HYUNDAI": ["ACCENT", "TUCSON", "SANTA FE"],
    "TOYOTA": ["COROLLA", "YARIS", "HILUX"],
}

COLORS = ["BLANCO", "NEGRO", "GRIS", "AZUL", "ROJO", "PLATA"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def make_phone(prefix_2_digits: str, idx: int) -> str:
    # 88xx-xxxx or 78xx-xxxx
    left = f"{prefix_2_digits}{(idx % 90) + 10:02d}"
    right = f"{(idx * 137) % 10000:04d}"
    return f"{left}-{right}"


def make_ruc(idx: int) -> str:
    # Format compatible with frontend guidance: J0000000000000
    return f"J{idx:013d}"


def make_plate(global_idx: int) -> str:
    a = 100 + (global_idx % 900)
    b = 100 + ((global_idx * 7) % 900)
    return f"M {a:03d} {b:03d}"


def make_vin(brand: str, cidx: int, vidx: int) -> str:
    # 17 chars, avoid I/O/Q
    alpha = "ABCDEFGHJKLMNPRSTUVWXYZ"
    rnd = random.Random(f"{SEED_TAG}-{brand}-{cidx}-{vidx}")
    chars = [rnd.choice(alpha) for _ in range(8)] + [str(rnd.randint(0, 9)) for _ in range(9)]
    return "".join(chars)[:17]


def resolve_db(client: MongoClient):
    preferred = os.environ.get("MONGO_DB") or os.environ.get("DB_NAME")
    if preferred:
        return client[preferred], preferred

    known = [
        "mc-larens2_mundo_accesorios_erp",
        "mundo_accesorios_erp",
        "erp",
    ]
    names = set(client.list_database_names())
    for name in known:
        if name in names:
            return client[name], name

    # fallback: first DB containing customers collection
    for name in client.list_database_names():
        db = client[name]
        if "customers" in db.list_collection_names():
            return db, name

    return client["mc-larens2_mundo_accesorios_erp"], "mc-larens2_mundo_accesorios_erp"


def main():
    client = MongoClient(MONGO_URL)
    db, db_name = resolve_db(client)

    # Idempotent cleanup only for this seed batch.
    deleted_vehicles = db.vehicles.delete_many({"source_seed": SEED_TAG}).deleted_count
    deleted_customers = db.customers.delete_many({"source_seed": SEED_TAG}).deleted_count

    print(f"Connected to {MONGO_URL} db={db_name}")
    print(f"Removed previous seed data: customers={deleted_customers}, vehicles={deleted_vehicles}")

    customers_docs = []
    vehicles_docs = []

    global_vehicle_idx = 1

    # 20 natural-person customers with 3 vehicles each.
    for idx, (first_name, last_name, email, address) in enumerate(NATURAL_CUSTOMERS, start=1):
        customer_id = make_id("customer")
        full_name = f"{first_name} {last_name}"
        customer_doc = {
            "customer_id": customer_id,
            "name": full_name,
            "first_name": first_name,
            "last_name": last_name,
            "customer_type": "natural",
            "tax_id": "",
            "phone_prefix": "+505",
            "phone": make_phone("88", idx),
            "email": email,
            "address": address,
            "is_active": True,
            "customer_segments": ["minorista"],
            "created_at": now_iso(),
            "source_seed": SEED_TAG,
        }
        customers_docs.append(customer_doc)

        for v in range(3):
            brand = NATURAL_BRANDS[v]
            model = MODELS[brand][idx % len(MODELS[brand])]
            year = 2015 + ((idx + v) % 10)
            vehicle_doc = {
                "vehicle_id": make_id("vehicle"),
                "customer_id": customer_id,
                "plate": make_plate(global_vehicle_idx),
                "brand": brand,
                "model": model,
                "year": year,
                "color": COLORS[(idx + v) % len(COLORS)],
                "chasis": make_vin(brand, idx, v),
                "vin": make_vin(brand, idx, v),
                "vehicle_type": "sedan" if v == 0 else ("suv" if v == 1 else "pickup"),
                "created_at": now_iso(),
                "source_seed": SEED_TAG,
            }
            vehicles_docs.append(vehicle_doc)
            global_vehicle_idx += 1

    # 20 company customers with 3 vehicles each: KIA, HYUNDAI, TOYOTA.
    for idx, (company_name, email, address) in enumerate(COMPANY_CUSTOMERS, start=1):
        customer_id = make_id("customer")
        customer_doc = {
            "customer_id": customer_id,
            "name": company_name,
            "first_name": company_name,
            "last_name": "",
            "customer_type": "empresa",
            "tax_id": make_ruc(5000 + idx),
            "phone_prefix": "+505",
            "phone": make_phone("78", idx),
            "email": email,
            "address": address,
            "is_active": True,
            "customer_segments": ["empresa"],
            "created_at": now_iso(),
            "source_seed": SEED_TAG,
        }
        customers_docs.append(customer_doc)

        for v, brand in enumerate(COMPANY_BRANDS):
            model = MODELS[brand][idx % len(MODELS[brand])]
            year = 2018 + ((idx + v) % 7)
            vehicle_doc = {
                "vehicle_id": make_id("vehicle"),
                "customer_id": customer_id,
                "plate": make_plate(global_vehicle_idx),
                "brand": brand,
                "model": model,
                "year": year,
                "color": COLORS[(idx + v + 2) % len(COLORS)],
                "chasis": make_vin(brand, 100 + idx, v),
                "vin": make_vin(brand, 100 + idx, v),
                "vehicle_type": "sedan" if brand in {"KIA", "TOYOTA"} else "suv",
                "created_at": now_iso(),
                "source_seed": SEED_TAG,
            }
            vehicles_docs.append(vehicle_doc)
            global_vehicle_idx += 1

    db.customers.insert_many(customers_docs)
    db.vehicles.insert_many(vehicles_docs)

    natural_count = db.customers.count_documents({"source_seed": SEED_TAG, "customer_type": "natural"})
    company_count = db.customers.count_documents({"source_seed": SEED_TAG, "customer_type": "empresa"})
    vehicle_count = db.vehicles.count_documents({"source_seed": SEED_TAG})

    print("Seed completed")
    print(f"Natural customers: {natural_count}")
    print(f"Company customers: {company_count}")
    print(f"Vehicles: {vehicle_count}")


if __name__ == "__main__":
    main()
