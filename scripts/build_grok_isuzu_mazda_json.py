import json
from pathlib import Path

def create_isuzu_mazda_catalog():
    # Isuzu & Mazda prioritarios en Nicaragua
    models = [
        # ISUZU
        {
            "brand": "Isuzu",
            "model": "D-Max Pickup Doble Cabina (3ra Gen RG01)",
            "years": "2019-Presente",
            "vehicle_type": "Camioneta Pickup 4x4",
            "file_prefix": "isuzu_dmax_2019_present",
            "key_features": "Aggressive fanged front grille, Bi-LED projector headlights, muscular wheel arches, modern high-riding double cab pickup."
        },
        {
            "brand": "Isuzu",
            "model": "D-Max Pickup Doble Cabina (2da Gen RT50)",
            "years": "2012-2019",
            "vehicle_type": "Camioneta Pickup 4x4",
            "file_prefix": "isuzu_dmax_2012_2019",
            "key_features": "Wedge-shaped aerodynamic profile, large chrome upper grille bar, flared fenders, robust durable cargo bed."
        },
        {
            "brand": "Isuzu",
            "model": "D-Max Pickup Doble Cabina (1ra Gen RA/RC)",
            "years": "2002-2012",
            "vehicle_type": "Camioneta Pickup 4x4",
            "file_prefix": "isuzu_dmax_2002_2012",
            "key_features": "Classic indestructible workhorse pickup, clean angular bodylines, twin vertical slat chrome grille, rugged side steps."
        },
        {
            "brand": "Isuzu",
            "model": "mu-X SUV 4x4 (2da Gen RJ)",
            "years": "2020-Presente",
            "vehicle_type": "SUV Todoterreno 7 Pasajeros",
            "file_prefix": "isuzu_mux_2020_present",
            "key_features": "Sleek 3-row ladder-frame 4x4 SUV, arrow-signature Bi-LED headlights, floating roof pillar styling, sporty rear spoiler."
        },
        {
            "brand": "Isuzu",
            "model": "QKR / NLR Camion Liviano Cabina Sencilla",
            "years": "2010-Presente",
            "vehicle_type": "Camion Liviano Comercial",
            "file_prefix": "isuzu_qkr_2010_present",
            "key_features": "Forward control cab-over-engine commercial truck, vertical panoramic windshield, twin vertical headlights, aluminum cargo box / flatbed."
        },
        # MAZDA
        {
            "brand": "Mazda",
            "model": "BT-50 Pickup Doble Cabina (3ra Gen TF)",
            "years": "2020-Presente",
            "vehicle_type": "Camioneta Pickup 4x4",
            "file_prefix": "mazda_bt50_2020_present",
            "key_features": "Kodo design double cab pickup, signature Mazda wing front grille, slim horizontal LED headlights, sculpted body panels."
        },
        {
            "brand": "Mazda",
            "model": "BT-50 Pickup Doble Cabina (2da Gen UP/UR)",
            "years": "2011-2020",
            "vehicle_type": "Camioneta Pickup 4x4",
            "file_prefix": "mazda_bt50_2011_2020",
            "key_features": "Curvaceous passenger-car inspired pickup styling, distinctive wraparound leaf-shaped headlights and rear taillights."
        },
        {
            "brand": "Mazda",
            "model": "CX-5 (2da Gen KF)",
            "years": "2017-Presente",
            "vehicle_type": "SUV Crossover Mediano",
            "file_prefix": "mazda_cx5_2017_present",
            "key_features": "Kodo Soul of Motion styling, deep concave mesh grille with chrome signature wing, sleek narrow LED headlights, coupe-like profile."
        },
        {
            "brand": "Mazda",
            "model": "CX-30 (1ra Gen DM)",
            "years": "2019-Presente",
            "vehicle_type": "SUV Crossover Compacto",
            "file_prefix": "mazda_cx30_2019_present",
            "key_features": "Compact crossover with bold dark lower body cladding, sweeping S-curve reflection along doors, slim LED rear lights."
        },
        {
            "brand": "Mazda",
            "model": "Mazda 3 Sedán (4ta Gen BP)",
            "years": "2019-Presente",
            "vehicle_type": "Sedán Compacto Premium",
            "file_prefix": "mazda_3_sedan_2019_present",
            "key_features": "Minimalist elegant 4-door sedan, low-slung nose, signature black wing grille, clean smooth door surfaces without harsh body creases."
        },
        {
            "brand": "Mazda",
            "model": "Mazda 3 Sedán (3ra Gen BM/BN)",
            "years": "2013-2018",
            "vehicle_type": "Sedán Compacto",
            "file_prefix": "mazda_3_sedan_2013_2018",
            "key_features": "Dynamic Kodo stance, prominent shield grille connecting to sharp almond headlights, sweeping aerodynamic beltline."
        },
        {
            "brand": "Mazda",
            "model": "Mazda 2 Hatchback / Sedán (3ra Gen DJ/DL)",
            "years": "2014-Presente",
            "vehicle_type": "Hatchback Subcompacto",
            "file_prefix": "mazda_2_2014_present",
            "key_features": "Compact agile urban hatchback, compact 5-door silhouette, expressive five-point front grille, integrated rear roof spoiler."
        }
    ]

    tasks = []
    task_id = 1
    for m in models:
        brand = m["brand"]
        model_name = m["model"]
        years = m["years"]
        vtype = m["vehicle_type"]
        prefix = m["file_prefix"]
        features = m["key_features"]

        # 1. Lateral
        lat_file = f"{prefix}_lat.png"
        lat_prompt = (
            f"Professional automotive 2D vector technical blueprint illustration of {brand} {model_name} ({years}) {vtype}, "
            f"exact side profile view (Lateral), vehicle facing left, horizontally centered with generous padding. "
            f"Solid pure white body paint (#FFFFFF) with crisp, clean black outline vector lines defining doors, panels, bumpers, hood, fenders and roof contours. "
            f"Uniform flat dark charcoal tinted glass windows (#1e293b / #334155). "
            f"Headlights illuminated in bright cyan-blue (#00E5FF / #38bdf8), Taillights illuminated in bright red (#FF0033 / #ef4444). "
            f"{features} "
            f"Tires, wheels, and ground shadow in crisp clean blueprint style. "
            f"Pure solid white background (#FFFFFF). "
            f"Include small legible technical text in bottom-left corner: '{brand.upper()} {model_name.upper()} ({years}) · {vtype} · Lateral'."
        )
        tasks.append({
            "id": task_id,
            "brand": brand,
            "model": model_name,
            "years": years,
            "vehicle_type": vtype,
            "view": "Lateral",
            "filename": lat_file,
            "prompt": lat_prompt
        })
        task_id += 1

        # 2. Superior (Top-Down)
        top_file = f"{prefix}_top.png"
        top_prompt = (
            f"Professional automotive 2D vector technical blueprint illustration of {brand} {model_name} ({years}) {vtype}, "
            f"exact top-down view (Superior Cenital), oriented horizontally with front of vehicle facing left, centered with generous padding. "
            f"Solid pure white body paint (#FFFFFF) with crisp, clean black outline vector lines defining hood contours, roof panel, front windshield, side mirrors, rear window, roof ridges/rails and tailgate/trunk. "
            f"Uniform flat dark charcoal tinted glass windows (#1e293b / #334155). "
            f"Headlights illuminated in bright cyan-blue (#00E5FF / #38bdf8), Taillights illuminated in bright red (#FF0033 / #ef4444). "
            f"{features} "
            f"Pure solid white background (#FFFFFF). "
            f"Include small legible technical text in bottom-left corner: '{brand.upper()} {model_name.upper()} ({years}) · {vtype} · Superior (Top-Down)'."
        )
        tasks.append({
            "id": task_id,
            "brand": brand,
            "model": model_name,
            "years": years,
            "vehicle_type": vtype,
            "view": "Superior (Top-Down)",
            "filename": top_file,
            "prompt": top_prompt
        })
        task_id += 1

    batches = []
    batch_size = 6
    for i in range(0, len(tasks), batch_size):
        batch_tasks = tasks[i:i+batch_size]
        batch_num = (i // batch_size) + 1
        formatted_text = f"=== BATCH {batch_num} DE ISUZU & MAZDA (TAREAS ID {batch_tasks[0]['id']} AL {batch_tasks[-1]['id']}) ===\n\n"
        for t in batch_tasks:
            formatted_text += f"ID {t['id']} | MARCA: {t['brand']} | MODELO: {t['model']} | AÑO: {t['years']} | TIPO: {t['vehicle_type']} | VISTA: {t['view']} | ARCHIVO: {t['filename']}\nPROMPT:\n{t['prompt']}\n\n"
        batches.append({
            "batch_number": batch_num,
            "task_ids": [t["id"] for t in batch_tasks],
            "formatted_paste_text": formatted_text
        })

    catalog_data = {
        "metadata": {
            "catalog_name": "Grok Isuzu & Mazda Complete Vector Catalog",
            "total_tasks": len(tasks),
            "total_batches": len(batches),
            "batch_size": batch_size,
            "models_covered": [f"{m['brand']} {m['model']}" for m in models]
        },
        "tasks": tasks,
        "batches": batches
    }

    out_file = Path("scripts/grok_isuzu_mazda_catalog_prompts.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(catalog_data, f, indent=2, ensure_ascii=False)

    print(f"Generated {out_file} with {len(tasks)} tasks in {len(batches)} batches.")

if __name__ == "__main__":
    create_isuzu_mazda_catalog()
