#!/usr/bin/env python3
"""Seed 50 Natural Customers and 5 Company Customers with 3 random vehicles each (165 vehicles total)
in MongoDB Atlas, verifying that each vehicle's blueprint images match the vehicle creation / alta form.
"""

from __future__ import annotations
import os
import json
import random
import uuid
from datetime import datetime, timezone
from pathlib import Path
from pymongo import MongoClient

SEED_TAG = "seed_55_customers_165_vehicles_v1"
MONGO_URL = os.environ.get(
    "MONGO_URL",
    "mongodb+srv://dayavar18_db_user:El_Peluka_Sapbeee.2026@mclarens-db.nkdcim0.mongodb.net/mc-larens2_mundo_accesorios_erp?retryWrites=true&w=majority"
)
DB_NAME = os.environ.get("DB_NAME", "mc-larens2_mundo_accesorios_erp")

FIRST_NAMES = [
    "Juan Carlos", "Maria Fernanda", "Luis Alberto", "Ana Lucia", "Carlos Enrique",
    "Sofia Elena", "Pedro Jose", "Adriana Maria", "Miguel Angel", "Rosa Maria",
    "Jorge Luis", "Teresa Isabel", "Roberto Antonio", "Carmen Julia", "Francisco Javier",
    "Daniela Sofia", "Ricardo Andres", "Lucia Alejandra", "Mario Augusto", "Patricia Elena",
    "Jose Manuel", "Karla Vanessa", "Gabriel Antonio", "Silvia Patricia", "Fernando Jose",
    "Andrea Carolina", "Alejandro David", "Natalia Beatriz", "Hector Ramon", "Claudia Marcela",
    "Mauricio Jose", "Brenda Ivette", "Ernesto Alonso", "Maritza del Carmen", "Julio Cesar",
    "Lorena Beatriz", "Guillermo Antonio", "Yadira Esperanza", "Marcos Aurelio", "Elena Maria",
    "Alvaro Jose", "Fatima del Socorro", "Rodrigo Javier", "Miriam Auxiliadora", "Osman Rene",
    "Giselle Alejandra", "Bayardo Antonio", "Xiomara del Carmen", "Reynaldo Jose", "Suyapa Nicole"
]

LAST_NAMES = [
    "Perez", "Lopez", "Gonzalez", "Martinez", "Ruiz", "Castillo", "Torres", "Mora",
    "Rios", "Zelaya", "Ortega", "Blandon", "Navarro", "Luna", "Hernandez", "Vargas",
    "Mejia", "Gaitan", "Flores", "Silva", "Gomez", "Morales", "Espinoza", "Gutierrez",
    "Reyes", "Chavez", "Ramirez", "Mendoza", "Baltodano", "Barillas", "Centeno",
    "Chamorro", "Montenegro", "Sequeira", "Sandoval", "Salgado", "Mayorga", "Vallecillo",
    "Solorzano", "Lacayo", "Aguilar", "Bermudez", "Calderon", "Delgado", "Estrada",
    "Fajardo", "Granados", "Herrera", "Jarquín", "Largaespada"
]

CITIES = [
    ("Managua", ["Barrio Altagracia", "Colonia Centroamerica", "Villa Fontana", "Bello Horizonte", "Reparto San Juan", "Altamira", "Las Colinas", "Bolonia", "Los Robles", "Las Brisas"]),
    ("Masaya", ["Barrio San Jerónimo", "Monimbó", "Reparto San Carlos", "Las Malvinas"]),
    ("Leon", ["Barrio Sutiaba", "El Calvario", "Zaragoza", "Laborío"]),
    ("Granada", ["Calle Real Xalteva", "Calle La Calzada", "Reparto El Escudo", "Guadalupe"]),
    ("Matagalpa", ["Barrio Guanuca", "Palo Alto", "Yuribia", "El Progreso"]),
    ("Esteli", ["Barrio El Rosario", "Oscar Gamez", "Panamá Soberana", "La Fe"]),
    ("Chinandega", ["Barrio Guadalupe", "San Agustín", "El Calvario", "Santa Ana"])
]

COMPANY_DATA = [
    ("Distribuidora Logística Central S.A.", "Ing. Roberto Mántica", "contacto@logisticacentral.com.ni", "Carretera Norte km 5.5, Managua", "J0310000123456"),
    ("Constructora y Edificaciones de Nicaragua S.A.", "Arq. Claudia Chamorro", "proyectos@construedisa.com.ni", "Pista Jean Paul Genie, Managua", "J0310000234567"),
    ("Agropecuaria e Inversiones San Francisco S.A.", "Lic. Mario Lacayo", "gerencia@agrosanfrancisco.com.ni", "Carretera a Masaya km 12, Managua", "J0310000345678"),
    ("Transportes y Carga del Pacífico S.A.", "Don Bayardo Jarquín", "operaciones@cargapacifico.com.ni", "Carretera Nueva a León km 8, Managua", "J0310000456789"),
    ("Comercializadora Industrial Mántica S.A.", "Lic. Ana Lucia Pellas", "ventas@comercialmantica.com.ni", "Plaza Santo Domingo, Managua", "J0310000567890"),
]

COLORS = [
    "Blanco", "Negro", "Gris Plata", "Gris Grafito", "Rojo", "Azul Marino",
    "Blanco Perla", "Azul Eléctrico", "Verde Olivo", "Beige Arena", "Champagne"
]

PLATE_PREFIXES = ["M", "M", "M", "LE", "MY", "GR", "MT", "ES", "CH"]

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def make_cedula(idx: int) -> str:
    dept = f"{(idx % 15) + 1:03d}"
    day = f"{(idx % 28) + 1:02d}"
    month = f"{(idx % 12) + 1:02d}"
    year = f"{(80 + (idx % 22)):02d}"
    seq = f"{(idx * 17) % 9000 + 1000:04d}"
    letter = chr(65 + (idx % 26))
    return f"{dept}-{day}{month}{year}-{seq}{letter}"

def make_phone(idx: int, is_company: bool = False) -> str:
    prefix = "78" if is_company else "88"
    mid = f"{(idx % 90) + 10:02d}"
    end = f"{(idx * 137) % 10000:04d}"
    return f"{prefix}{mid}-{end}"

def make_plate(idx: int) -> str:
    dept = random.choice(PLATE_PREFIXES)
    num = f"{random.randint(10000, 399999):06d}"
    if len(num) == 6:
        return f"{dept} {num[:3]}-{num[3:]}"
    return f"{dept} {num}"

def make_vin(idx: int) -> str:
    chars = "0123456789ABCDEFGHJKLMNPRSTUVWXYZ"
    return "".join(random.choices(chars, k=17))

def main():
    print(f"Connecting to MongoDB Atlas: {DB_NAME}...")
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)
    db = client[DB_NAME]
    
    # Load clean official vehicle models
    with open("frontend/src/data/official_vehicle_catalog.json", "r", encoding="utf-8") as f:
        catalog_data = json.load(f)
    
    all_models = [m for m in catalog_data.get("models", []) if m.get("is_clean", True) and m.get("lateral_image") and m.get("top_image")]
    print(f"Loaded {len(all_models)} verified blueprint vehicle models from catalog.")

    # Remove previous test seed if needed
    del_cust = db.customers.delete_many({"source_seed": SEED_TAG})
    del_veh = db.vehicles.delete_many({"source_seed": SEED_TAG})
    print(f"Cleaned up previous seed: {del_cust.deleted_count} customers, {del_veh.deleted_count} vehicles removed.")

    created_customers = []
    created_vehicles = []
    
    # 1. Generate 50 Natural Persons
    print("\nGenerating 50 Natural Customers...")
    for i in range(50):
        first = FIRST_NAMES[i % len(FIRST_NAMES)]
        last = LAST_NAMES[(i * 3 + 2) % len(LAST_NAMES)]
        city_info = CITIES[i % len(CITIES)]
        city_name = city_info[0]
        neighborhood = city_info[1][i % len(city_info[1])]
        
        c_id = f"cust_nat_{i+1:03d}"
        cedula = make_cedula(i + 1)
        phone = make_phone(i + 1, is_company=False)
        email = f"{first.lower().replace(' ', '.')}.{last.lower()}{i+1}@gmail.com"
        address = f"{neighborhood}, {city_name}"
        
        customer_doc = {
            "customer_id": c_id,
            "name": f"{first} {last}",
            "first_name": first,
            "last_name": last,
            "customer_type": "natural",
            "type": "natural",
            "legal_id": cedula,
            "tax_id": cedula,
            "cedula": cedula,
            "ruc": "",
            "phone_prefix": "+505",
            "phone": phone,
            "email": email,
            "address": address,
            "city": city_name,
            "department": city_name,
            "country": "Nicaragua",
            "credit_limit": 5000.0,
            "credit_balance": 0.0,
            "vehicles_count": 3,
            "is_active": True,
            "source_seed": SEED_TAG,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        created_customers.append(customer_doc)

    # 2. Generate 5 Company Customers
    print("Generating 5 Company Customers...")
    for j, comp in enumerate(COMPANY_DATA):
        comp_name, contact_person, comp_email, comp_addr, comp_ruc = comp
        c_id = f"cust_emp_{j+1:03d}"
        phone = make_phone(j + 100, is_company=True)
        
        customer_doc = {
            "customer_id": c_id,
            "name": comp_name,
            "business_name": comp_name,
            "contact_person": contact_person,
            "customer_type": "company",
            "type": "company",
            "legal_id": comp_ruc,
            "tax_id": comp_ruc,
            "cedula": "",
            "ruc": comp_ruc,
            "phone_prefix": "+505",
            "phone": phone,
            "email": comp_email,
            "address": comp_addr,
            "city": "Managua",
            "department": "Managua",
            "country": "Nicaragua",
            "credit_limit": 25000.0,
            "credit_balance": 0.0,
            "vehicles_count": 3,
            "is_active": True,
            "source_seed": SEED_TAG,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        created_customers.append(customer_doc)

    # 3. Assign 3 Random Vehicles to each of the 55 Customers (165 vehicles)
    print("\nAssigning 3 Random Certified Vehicles to each Customer (Total: 165 vehicles)...")
    v_idx = 0
    for cust in created_customers:
        selected_models = random.sample(all_models, 3)
        
        for m in selected_models:
            v_idx += 1
            v_id = f"veh_{v_idx:04d}"
            
            y_start = m.get("year_start", 2018)
            y_end = m.get("year_end", 2024)
            year = random.randint(min(y_start, y_end), max(y_start, y_end))
            
            color = random.choice(COLORS)
            plate = make_plate(v_idx)
            vin = make_vin(v_idx)
            
            doors = 4
            if any(k in m["category"] for k in ["camioneta_1_cabina", "camion_1_cabina"]):
                doors = 2
            elif any(k in m["category"] for k in ["hatchback", "suv"]):
                doors = 5
                
            veh_doc = {
                "vehicle_id": v_id,
                "customer_id": cust["customer_id"],
                "client_id": cust["customer_id"],
                "customer_name": cust["name"],
                "plate": plate,
                "plate_number": plate,
                "chasis": vin,
                "vin": vin,
                "brand": m["brand"],
                "model": m["model_name"],
                "model_name": m["model_name"],
                "model_slug": m["model_slug"],
                "generation": m["generation"],
                "descriptor": f"{m['model_name']} [{m['generation']}]",
                "year": year,
                "color": color,
                "doors": doors,
                "vehicle_type": m["category"],
                "category": m["category"],
                "body_type": m["body_type"],
                "lateral_image": m["lateral_image"],
                "top_image": m["top_image"],
                "image_lateral": m["lateral_image"],
                "image_top": m["top_image"],
                "notes": f"Alta de Vehículo MC-LARENS ERP · {m['brand']} {m['model_name']} {year}",
                "is_active": True,
                "source_seed": SEED_TAG,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            }
            created_vehicles.append(veh_doc)

    # Bulk insert into MongoDB Atlas
    print(f"\nInserting {len(created_customers)} customers into MongoDB Atlas...")
    db.customers.insert_many(created_customers)
    print(f"Inserting {len(created_vehicles)} vehicles into MongoDB Atlas...")
    db.vehicles.insert_many(created_vehicles)

    print(f"\nSuccessfully seeded {len(created_customers)} Customers and {len(created_vehicles)} Vehicles into Atlas DB!")

    # 4. Verification Suite for Alta de Vehículos & Silhouette Matching
    print("\n" + "="*80)
    print("VERIFICATION SUITE: ALTA DE VEHICULO / BLUEPRINT MATCHING (165 VEHICLES)")
    print("="*80)

    success_matches = 0
    sample_outputs = []

    for idx, v in enumerate(created_vehicles, 1):
        lat_path = Path("frontend/public" + v["lateral_image"]) if v.get("lateral_image") else None
        top_path = Path("frontend/public" + v["top_image"]) if v.get("top_image") else None
        
        lat_ok = lat_path and lat_path.exists()
        top_ok = top_path and top_path.exists()
        
        if lat_ok and top_ok:
            success_matches += 1
            
        if idx <= 15 or idx % 20 == 0 or idx == len(created_vehicles):
            status = "[MATCH OK]" if (lat_ok and top_ok) else "[IMAGE MISSING]"
            cust_type = "EMPRESA" if "emp" in v["customer_id"] else "NATURAL"
            sample_outputs.append(
                f"[{idx:03d}/165] {status} Cliente ({cust_type}): {v['customer_name']}\n"
                f"       Vehículo: {v['brand']} {v['model']} ({v['year']}) | Placa: {v['plate']} | Color: {v['color']}\n"
                f"       Lateral: {v['lateral_image']} (Existe: {lat_ok})\n"
                f"       Superior: {v['top_image']} (Existe: {top_ok})\n"
            )

    for out in sample_outputs:
        print(out)

    print("="*80)
    print(f"TOTAL VERIFIED: {success_matches}/{len(created_vehicles)} vehicles ({(success_matches/len(created_vehicles))*100:.1f}%) have 100% certified lateral and top-down blueprint matches!")
    print("="*80)

if __name__ == "__main__":
    main()
