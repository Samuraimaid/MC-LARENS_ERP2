import json
from pathlib import Path

def create_ford_catalog():
    # Ford prioritarios en Nicaragua
    ford_models = [
        {
            "model": "Ranger Pickup Doble Cabina (5ta Gen P703)",
            "years": "2022-Presente",
            "vehicle_type": "Camioneta Pickup 4x4",
            "file_prefix": "ford_ranger_2022_present",
            "key_features": "Next-Gen midsize pickup, imposing C-clamp LED signature headlights, bold horizontal front grille bar, muscular flared fenders, high bed."
        },
        {
            "model": "Ranger Pickup Doble Cabina (4ta Gen T6 Facelift)",
            "years": "2015-2022",
            "vehicle_type": "Camioneta Pickup 4x4",
            "file_prefix": "ford_ranger_2015_2022",
            "key_features": "Trapezoidal chrome front grille, swept-back headlights, rugged high-riding pickup double cab profile, side fender vents."
        },
        {
            "model": "Ranger Pickup Doble Cabina (3ra Gen PJ/PK)",
            "years": "2006-2011",
            "vehicle_type": "Camioneta Pickup 4x4",
            "file_prefix": "ford_ranger_2006_2011",
            "key_features": "Classic robust workhorse pickup, rectangular blocky front grille with Ford oval badge, squared wheel wells, practical cargo bed."
        },
        {
            "model": "Explorer (6ta Gen CD6)",
            "years": "2019-Presente",
            "vehicle_type": "SUV Familiar 7 Pasajeros",
            "file_prefix": "ford_explorer_2019_present",
            "key_features": "Mid-size luxury 3-row SUV, sloping roofline, athletic stance, wide hexagonal honeycomb grille, blacked-out A, B and D pillars."
        },
        {
            "model": "Explorer (5ta Gen D4)",
            "years": "2010-2019",
            "vehicle_type": "SUV Familiar 7 Pasajeros",
            "file_prefix": "ford_explorer_2010_2019",
            "key_features": "Modern unibody 7-passenger SUV, floating roof effect with blacked-out pillars, bold 3-bar front grille, sculpted waistline."
        },
        {
            "model": "Escape / Kuga (4ta Gen C2)",
            "years": "2019-Presente",
            "vehicle_type": "SUV Compacto Crossover",
            "file_prefix": "ford_escape_2019_present",
            "key_features": "Sleek aerodynamic compact crossover SUV, shark-nose inspired trapezoidal mesh front grille, swooping coupe-like roofline."
        },
        {
            "model": "Escape / Kuga (3ra Gen C520)",
            "years": "2012-2019",
            "vehicle_type": "SUV Compacto Crossover",
            "file_prefix": "ford_escape_2012_2019",
            "key_features": "Kinetic design compact SUV, sharp angled headlights, prominent dual lower intake grilles, sweeping rising character line."
        },
        {
            "model": "Escape (2da Gen CD2)",
            "years": "2007-2012",
            "vehicle_type": "SUV Compacto Clásico",
            "file_prefix": "ford_escape_2007_2012",
            "key_features": "Boxy utilitarian classic compact SUV, large chrome horizontal grille, upright square windshield, roof rails, high ground clearance."
        },
        {
            "model": "EcoSport (2da Gen B2E)",
            "years": "2012-2022",
            "vehicle_type": "SUV Urbano Subcompacto",
            "file_prefix": "ford_ecosport_2012_2022",
            "key_features": "Urban subcompact crossover, tall athletic stance, hexagonal front grille, mounted external spare tire on rear tailgate."
        },
        {
            "model": "F-150 Pickup Doble Cabina (14va Gen)",
            "years": "2020-Presente",
            "vehicle_type": "Camioneta Pickup Grande 4x4",
            "file_prefix": "ford_f150_2020_present",
            "key_features": "Full-size American pickup SuperCrew, massive bold front grille with signature C-clamp DRLs, power dome hood, dropped front window notch."
        },
        {
            "model": "Everest / Endeavour SUV 4x4 (U704)",
            "years": "2015-Presente",
            "vehicle_type": "SUV Todoterreno 7 Pasajeros",
            "file_prefix": "ford_everest_2015_present",
            "key_features": "Rugged 7-passenger body-on-frame 4x4 SUV, high ground clearance, bold inverted trapezoidal front grille, sculpted rear tailgate."
        },
        {
            "model": "Transit Custom / Pasajeros Van",
            "years": "2014-Presente",
            "vehicle_type": "Van Comercial Pasajeros",
            "file_prefix": "ford_transit_2014_present",
            "key_features": "Commercial passenger / cargo van, high aerodynamic front with large trapezoidal grille, sliding passenger side door, vertical rear taillights."
        }
    ]

    tasks = []
    task_id = 1
    for m in ford_models:
        brand = "Ford"
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
        formatted_text = f"=== BATCH {batch_num} DE FORD (TAREAS ID {batch_tasks[0]['id']} AL {batch_tasks[-1]['id']}) ===\n\n"
        for t in batch_tasks:
            formatted_text += f"ID {t['id']} | MARCA: {t['brand']} | MODELO: {t['model']} | AÑO: {t['years']} | TIPO: {t['vehicle_type']} | VISTA: {t['view']} | ARCHIVO: {t['filename']}\nPROMPT:\n{t['prompt']}\n\n"
        batches.append({
            "batch_number": batch_num,
            "task_ids": [t["id"] for t in batch_tasks],
            "formatted_paste_text": formatted_text
        })

    catalog_data = {
        "metadata": {
            "catalog_name": "Grok Ford Complete Vector Catalog",
            "total_tasks": len(tasks),
            "total_batches": len(batches),
            "batch_size": batch_size,
            "models_covered": [m["model"] for m in ford_models]
        },
        "tasks": tasks,
        "batches": batches
    }

    out_file = Path("scripts/grok_ford_catalog_prompts.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(catalog_data, f, indent=2, ensure_ascii=False)

    print(f"Generated {out_file} with {len(tasks)} tasks in {len(batches)} batches.")

if __name__ == "__main__":
    create_ford_catalog()
