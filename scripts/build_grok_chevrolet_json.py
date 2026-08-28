import json
from pathlib import Path

def create_chevrolet_catalog():
    # Chevrolet prioritarios en Nicaragua
    chevrolet_models = [
        {
            "model": "Tracker (4ta Gen Crossover)",
            "years": "2020-Presente",
            "vehicle_type": "SUV Compacto Moderno",
            "file_prefix": "chevrolet_tracker_2020_present",
            "key_features": "Modern crossover SUV, athletic stance, sculpted dual-port front grille, sleek LED DRLs, roof rails, high beltline, rear spoiler."
        },
        {
            "model": "Tracker / Trax (3ra Gen Trax)",
            "years": "2013-2020",
            "vehicle_type": "SUV Urbano Subcompacto",
            "file_prefix": "chevrolet_tracker_2013_2020",
            "key_features": "Subcompact urban SUV, high roofline, muscular wheel arches, prominent Chevrolet dual front grille with bowtie emblem, rear hatch."
        },
        {
            "model": "Spark (4ta Gen M400 / Beat)",
            "years": "2016-2022",
            "vehicle_type": "Hatchback Urbano",
            "file_prefix": "chevrolet_spark_2016_2022",
            "key_features": "City hatchback / Beat, sharp dynamic angular body lines, hidden rear door handles in C-pillar, modern dual-port front grille."
        },
        {
            "model": "Spark (3ra Gen M300 / Spark GT)",
            "years": "2010-2016",
            "vehicle_type": "Hatchback Subcompacto",
            "file_prefix": "chevrolet_spark_2010_2016",
            "key_features": "Iconic high-roof city hatchback, hidden vertical rear door handles, aggressive swept-back angular headlights, tall roof silhouette."
        },
        {
            "model": "Aveo / Sonic Sedán (2da Gen T300)",
            "years": "2012-2020",
            "vehicle_type": "Sedán Subcompacto",
            "file_prefix": "chevrolet_aveo_2012_2020",
            "key_features": "Subcompact sedan / Sonic, exposed twin motorcycle-inspired round headlights, clean body crease, notchback trunk styling."
        },
        {
            "model": "Aveo Clásico Sedán (1ra Gen T250)",
            "years": "2006-2018",
            "vehicle_type": "Sedán Subcompacto",
            "file_prefix": "chevrolet_aveo_2006_2018",
            "key_features": "High-volume classic subcompact sedan, high decklid, conservative clean body panels, horizontal chrome grille bar."
        },
        {
            "model": "Cruze Sedán (2da Gen D2LC)",
            "years": "2016-2023",
            "vehicle_type": "Sedán Compacto",
            "file_prefix": "chevrolet_cruze_2016_2023",
            "key_features": "Aerodynamic compact fastback sedan, sweeping aerodynamic roofline, aggressive dual front grille, sculpted muscular side character line."
        },
        {
            "model": "Cruze Sedán (1ra Gen J300)",
            "years": "2009-2016",
            "vehicle_type": "Sedán Compacto",
            "file_prefix": "chevrolet_cruze_2009_2016",
            "key_features": "Substantial compact sedan, robust arched roofline, bold honeycomb dual-port grille, prominent shoulder line, wrap-around headlights."
        },
        {
            "model": "N300 / N400 Max Van Pasajeros",
            "years": "2012-Presente",
            "vehicle_type": "Microbús Pasajeros",
            "file_prefix": "chevrolet_n300_2012_present",
            "key_features": "Microbus commercial van, cab-over short snub nose hood, dual sliding side doors, high square roof, vertical rectangular taillights."
        },
        {
            "model": "N300 / N400 Move Microbus / Cargo",
            "years": "2012-Presente",
            "vehicle_type": "Panel Comercial Cargo",
            "file_prefix": "chevrolet_n300_move_2012_present",
            "key_features": "Compact commercial panel / cargo van, snub nose front, sliding side doors, utilitarian boxy cargo profile, flat rear hatch."
        },
        {
            "model": "Colorado / D-Max Pickup Doble Cabina",
            "years": "2015-Presente",
            "vehicle_type": "Pickup Doble Cabina 4x4",
            "file_prefix": "chevrolet_colorado_2015_present",
            "key_features": "Mid-size 4x4 double cab pickup, muscular tall stance, horizontal dual-port front grille with bowtie, high cargo bed, flared fenders."
        },
        {
            "model": "Tahoe / Suburban (5ta Gen T1XX)",
            "years": "2020-Presente",
            "vehicle_type": "SUV Grande 8 Pasajeros",
            "file_prefix": "chevrolet_tahoe_2020_present",
            "key_features": "Full-size luxury 8-passenger SUV, massive imposing front grille with boomerang DRLs, long straight roofline, dark pillars, power side steps."
        }
    ]

    tasks = []
    task_id = 1
    for m in chevrolet_models:
        brand = "Chevrolet"
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
        formatted_text = f"=== BATCH {batch_num} DE CHEVROLET (TAREAS ID {batch_tasks[0]['id']} AL {batch_tasks[-1]['id']}) ===\n\n"
        for t in batch_tasks:
            formatted_text += f"ID {t['id']} | MARCA: {t['brand']} | MODELO: {t['model']} | AÑO: {t['years']} | TIPO: {t['vehicle_type']} | VISTA: {t['view']} | ARCHIVO: {t['filename']}\nPROMPT:\n{t['prompt']}\n\n"
        batches.append({
            "batch_number": batch_num,
            "task_ids": [t["id"] for t in batch_tasks],
            "formatted_paste_text": formatted_text
        })

    catalog_data = {
        "metadata": {
            "catalog_name": "Grok Chevrolet Complete Vector Catalog",
            "total_tasks": len(tasks),
            "total_batches": len(batches),
            "batch_size": batch_size,
            "models_covered": [m["model"] for m in chevrolet_models]
        },
        "tasks": tasks,
        "batches": batches
    }

    out_file = Path("scripts/grok_chevrolet_catalog_prompts.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(catalog_data, f, indent=2, ensure_ascii=False)

    print(f"Generated {out_file} with {len(tasks)} tasks in {len(batches)} batches.")

if __name__ == "__main__":
    create_chevrolet_catalog()
