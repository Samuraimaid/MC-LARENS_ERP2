import json
from pathlib import Path

def create_vw_jeep_chinese_catalog():
    # Modelos adicionales altamente transitados en Nicaragua
    models = [
        # VOLKSWAGEN
        {
            "brand": "Volkswagen",
            "model": "Amarok Pickup Doble Cabina (1ra Gen 2H)",
            "years": "2010-Presente",
            "vehicle_type": "Camioneta Pickup 4x4",
            "file_prefix": "volkswagen_amarok_2010_present",
            "key_features": "Robust European double cab pickup, wide horizontal twin-chrome grille bar, squared wheel arches, clean muscular side profile."
        },
        {
            "brand": "Volkswagen",
            "model": "T-Cross / Taigun (1ra Gen)",
            "years": "2019-Presente",
            "vehicle_type": "SUV Compacto Crossover",
            "file_prefix": "volkswagen_tcross_2019_present",
            "key_features": "Modern urban compact crossover, wide geometric front grille integrated with headlights, prominent full-width black rear reflector bar."
        },
        {
            "brand": "Volkswagen",
            "model": "Gol / Polo Hatchback (3ra Gen G5/G6)",
            "years": "2008-2023",
            "vehicle_type": "Hatchback Subcompacto",
            "file_prefix": "volkswagen_gol_2008_2023",
            "key_features": "Popular Latin American subcompact hatchback, horizontal single-slat black front grille, crisp beltline crease, clean compact rear hatch."
        },
        # JEEP
        {
            "brand": "Jeep",
            "model": "Wrangler Unlimited 4-Door (JL)",
            "years": "2018-Presente",
            "vehicle_type": "SUV Todoterreno 4x4",
            "file_prefix": "jeep_wrangler_jl_2018_present",
            "key_features": "Iconic legendary 4x4, vertical 7-slot front grille, round LED headlights, exposed door hinges, square fender flares, rear external spare tire."
        },
        {
            "brand": "Jeep",
            "model": "Grand Cherokee (WK2)",
            "years": "2011-2022",
            "vehicle_type": "SUV Mediano Premium 4x4",
            "file_prefix": "jeep_grand_cherokee_2011_2022",
            "key_features": "Luxury mid-size 4x4 SUV, signature 7-slot chrome grille, slim horizontal headlights, trapezoidal wheel openings, sleek roofline."
        },
        # CHANGAN & GREAT WALL / HAVAL & GEELY
        {
            "brand": "Changan",
            "model": "Hunter / F70 Pickup Doble Cabina",
            "years": "2020-Presente",
            "vehicle_type": "Camioneta Pickup 4x4",
            "file_prefix": "changan_hunter_2020_present",
            "key_features": "Modern midsize pickup, imposing large octagonal black mesh front grille with thick gloss surround, muscular sculpted fenders."
        },
        {
            "brand": "Changan",
            "model": "CS35 Plus Crossover",
            "years": "2018-Presente",
            "vehicle_type": "SUV Compacto Crossover",
            "file_prefix": "changan_cs35_plus_2018_present",
            "key_features": "Geometric urban crossover, red accent trim on lower body cladding, narrow continuous front LED light strip, floating roof effect."
        },
        {
            "brand": "Great Wall",
            "model": "Poer / Pao Pickup Doble Cabina",
            "years": "2019-Presente",
            "vehicle_type": "Camioneta Pickup 4x4",
            "file_prefix": "greatwall_poer_2019_present",
            "key_features": "Full-size appearance pickup, massive trapezoidal chrome grille with circular P logo, high hood line, wide bed with roll bar."
        },
        {
            "brand": "Great Wall",
            "model": "Wingle 5 Pickup Doble Cabina",
            "years": "2011-Presente",
            "vehicle_type": "Camioneta Pickup 4x4",
            "file_prefix": "greatwall_wingle5_2011_present",
            "key_features": "Commercial workhorse double cab pickup, U-shaped chrome front grille, teardrop headlights, high clearance cargo bed."
        },
        {
            "brand": "Haval",
            "model": "H6 (3ra Gen)",
            "years": "2020-Presente",
            "vehicle_type": "SUV Mediano Moderno",
            "file_prefix": "haval_h6_2020_present",
            "key_features": "Futuristic midsize SUV, geometric parametric matrix front grille, matrix LED headlights, full-width connected horizontal taillight bar."
        },
        {
            "brand": "Geely",
            "model": "Coolray / Binyue Crossover",
            "years": "2018-Presente",
            "vehicle_type": "SUV Crossover Deportivo",
            "file_prefix": "geely_coolray_2018_present",
            "key_features": "Sporty aggressive crossover, Expanding Cosmos grille with red surround accents, quad rear exhaust pipes, carbon-look roof spoiler."
        },
        {
            "brand": "Geely",
            "model": "GX3 Pro / Vision X3",
            "years": "2017-Presente",
            "vehicle_type": "SUV Urbano Subcompacto",
            "file_prefix": "geely_gx3_pro_2017_present",
            "key_features": "Subcompact urban crossover, vertical waterfall chrome front grille, black roof rails, protective lower bumper skid plates."
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
        formatted_text = f"=== BATCH {batch_num} DE MULTIMARCAS (VW, JEEP, CHINOS) (TAREAS ID {batch_tasks[0]['id']} AL {batch_tasks[-1]['id']}) ===\n\n"
        for t in batch_tasks:
            formatted_text += f"ID {t['id']} | MARCA: {t['brand']} | MODELO: {t['model']} | AÑO: {t['years']} | TIPO: {t['vehicle_type']} | VISTA: {t['view']} | ARCHIVO: {t['filename']}\nPROMPT:\n{t['prompt']}\n\n"
        batches.append({
            "batch_number": batch_num,
            "task_ids": [t["id"] for t in batch_tasks],
            "formatted_paste_text": formatted_text
        })

    catalog_data = {
        "metadata": {
            "catalog_name": "Grok Volkswagen, Jeep & Leading Chinese Brands Complete Vector Catalog",
            "total_tasks": len(tasks),
            "total_batches": len(batches),
            "batch_size": batch_size,
            "models_covered": [f"{m['brand']} {m['model']}" for m in models]
        },
        "tasks": tasks,
        "batches": batches
    }

    out_file = Path("scripts/grok_vw_jeep_chinese_catalog_prompts.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(catalog_data, f, indent=2, ensure_ascii=False)

    print(f"Generated {out_file} with {len(tasks)} tasks in {len(batches)} batches.")

if __name__ == "__main__":
    create_vw_jeep_chinese_catalog()
