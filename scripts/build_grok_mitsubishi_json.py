import json
from pathlib import Path

def generate_prompt(brand, model, years, vehicle_type, view, filename, details):
    view_text = "exact side profile view (Lateral), vehicle facing left, horizontally centered with generous padding" if view == "Lateral" else "exact directly overhead top-down aerial blueprint view (Superior/Top-Down), vehicle pointing upwards/north, perfectly centered with generous padding"
    
    prompt = (
        f"Professional automotive 2D vector technical blueprint illustration of {brand} {model} ({years}) {vehicle_type}, "
        f"{view_text}. Solid pure white body paint (#FFFFFF) with crisp, clean black outline vector lines defining doors, "
        f"panels, bumpers, hood, fenders and roof contours. Uniform flat dark charcoal tinted glass windows (#1e293b / #334155). "
        f"Headlights illuminated in bright cyan-blue (#00E5FF / #38bdf8), Taillights illuminated in bright red (#FF0033 / #ef4444). "
        f"{details}. "
        f"Crisp minimalist 2D orthographic projection on pure solid white background (#FFFFFF). "
        f"No background grid, no perspective distortion, no 3D shading, no shadows beneath wheels. "
        f"Include technical badge in bottom-left corner with crisp modern clean typography: '{brand.upper()} {model.upper()} ({years}) · {vehicle_type} · {view}' without any emojis or extra borders."
    )
    return prompt

def main():
    mitsubishi_vehicles = [
        # Batch 1: L200 6ta Gen (2024+), L200 5ta Gen Facelift (2019-2023), L200 5ta Gen (2015-2019)
        {
            "model": "L200 Triton (6ta Gen LC)",
            "years": "2024-Presente",
            "type": "Camioneta Pickup Doble Cabina",
            "details": "Massive Beast Mode pickup, rectangular bold horizontal 3-slat front grille, split T-shaped daytime running lights over vertically stacked main headlamps, flared squared wheel arches, high cargo bed",
            "file_base": "mitsubishi_l200_2024_present"
        },
        {
            "model": "L200 Triton (5ta Gen Facelift KJ)",
            "years": "2019-2023",
            "type": "Camioneta Pickup Doble Cabina",
            "details": "Dynamic Shield front fascia, high hoodline, slim horizontal bi-LED headlamps with large lower fog/turn pods in deep chrome C-brackets, muscular squared fenders, robust double cab cargo bed",
            "file_base": "mitsubishi_l200_2019_2023"
        },
        {
            "model": "L200 Triton (5ta Gen Pre-Facelift KJ)",
            "years": "2015-2019",
            "type": "Camioneta Pickup Doble Cabina",
            "details": "Aerodynamic double-cab pickup, iconic J-line cabin seam separating cab from bed, curved vertical chrome grille teeth, swept-back headlamps, athletic curved shoulder crease",
            "file_base": "mitsubishi_l200_2015_2019"
        },

        # Batch 2: L200 4ta Gen (2005-2015), Montero Sport 3ra Gen, Montero Sport 2da Gen
        {
            "model": "L200 Triton (4ta Gen KB)",
            "years": "2005-2015",
            "type": "Camioneta Pickup Doble Cabina",
            "details": "Iconic curvy Dakar-inspired pickup, dramatic J-line curved cab seam, rounded front bumper with split grille opening, curved cargo bed contour, high ground clearance",
            "file_base": "mitsubishi_l200_2005_2015"
        },
        {
            "model": "Montero Sport / Pajero Sport (3ra Gen QE/QF)",
            "years": "2015-Presente",
            "type": "SUV Todoterreno 4x4 7 Pasajeros",
            "details": "Aggressive 7-seater off-road SUV, massive chrome Dynamic Shield front face, high beltline, distinctive long vertical teardrop rear taillights descending toward rear bumper",
            "file_base": "mitsubishi_montero_sport_2015_present"
        },
        {
            "model": "Montero Sport / Nativa (2da Gen PB/PC)",
            "years": "2008-2015",
            "type": "SUV Todoterreno 4x4",
            "details": "Rugged ladder-chassis SUV, large horizontal mesh grille with chrome surround, projector headlamps, flared wheel arches, side step bars, rear tailgate with wrap-around taillights",
            "file_base": "mitsubishi_montero_sport_2008_2015"
        },

        # Batch 3: Montero / Pajero 4ta Gen, Outlander 4ta Gen, Outlander 3ra Gen
        {
            "model": "Montero / Pajero (4ta Gen V80/V90)",
            "years": "2006-2021",
            "type": "SUV Todoterreno Legendario 4x4",
            "details": "Iconic full-size Dakar legend SUV, upright rectangular grille with two thick chrome bars, flared integrated fender blisters, rear door mounted spare wheel in hard cover, commanding roofline",
            "file_base": "mitsubishi_montero_2006_2021"
        },
        {
            "model": "Outlander (4ta Gen GN)",
            "years": "2021-Presente",
            "type": "SUV Mediano 7 Pasajeros",
            "details": "Bold sophisticated unibody SUV, aggressive Dynamic Shield styling, razor-thin upper DRLs with vertically stacked main headlights in bumper, floating roof effect, horizontal T-shaped taillights",
            "file_base": "mitsubishi_outlander_2021_present"
        },
        {
            "model": "Outlander (3ra Gen GF)",
            "years": "2012-2021",
            "type": "SUV Compacto / Mediano",
            "details": "Family crossover, chrome wing grille accents, swept-back projector headlamps, clean straight waistline, rear tailgate with connected horizontal chrome accent bar",
            "file_base": "mitsubishi_outlander_2012_2021"
        },

        # Batch 4: Mirage G4 Sedán, Mirage Hatchback, ASX / Outlander Sport
        {
            "model": "Mirage G4 Sedán (A10)",
            "years": "2013-Presente",
            "type": "Sedán Subcompacto",
            "details": "Economical 4-door sedan, Dynamic Shield front grille with red horizontal accent lines, compact notchback trunk lid, aerodynamic roofline, high rear bumper",
            "file_base": "mitsubishi_mirage_g4_2013_present"
        },
        {
            "model": "Mirage / Space Star (Hatchback A00)",
            "years": "2012-Presente",
            "type": "Hatchback City Car",
            "details": "Ultra-compact aerodynamic city hatchback, prominent upper roof spoiler, Dynamic Shield front bumper with chrome boomerangs, clean side panels",
            "file_base": "mitsubishi_mirage_hatchback_2012_present"
        },
        {
            "model": "ASX / Outlander Sport (GA)",
            "years": "2010-Presente",
            "type": "Crossover SUV Compacto",
            "details": "Compact urban crossover, sharp Dynamic Shield front face, front fender vents, muscular high beltline, rear tailgate with wide horizontal taillights",
            "file_base": "mitsubishi_asx_2010_present"
        }
    ]

    tasks = []
    task_id = 1

    for v in mitsubishi_vehicles:
        # Lateral
        lat_fn = f"{v['file_base']}_lat.png"
        lat_prompt = generate_prompt("Mitsubishi", v["model"], v["years"], v["type"], "Lateral", lat_fn, v["details"])
        tasks.append({
            "id": task_id,
            "brand": "Mitsubishi",
            "model": v["model"],
            "years": v["years"],
            "vehicle_type": v["type"],
            "view": "Lateral",
            "filename": lat_fn,
            "prompt": lat_prompt
        })
        task_id += 1

        # Superior
        top_fn = f"{v['file_base']}_top.png"
        top_prompt = generate_prompt("Mitsubishi", v["model"], v["years"], v["type"], "Superior (Top-Down)", top_fn, v["details"])
        tasks.append({
            "id": task_id,
            "brand": "Mitsubishi",
            "model": v["model"],
            "years": v["years"],
            "vehicle_type": v["type"],
            "view": "Superior (Top-Down)",
            "filename": top_fn,
            "prompt": top_prompt
        })
        task_id += 1

    batches = []
    batch_size = 6
    for i in range(0, len(tasks), batch_size):
        batch_tasks = tasks[i:i+batch_size]
        batch_num = (i // batch_size) + 1
        
        paste_text = f"=== BATCH {batch_num} DE MITSUBISHI (TAREAS ID {batch_tasks[0]['id']} AL {batch_tasks[-1]['id']}) ===\n\n"
        for t in batch_tasks:
            paste_text += f"ID {t['id']} | MARCA: {t['brand']} | MODELO: {t['model']} | AÑO: {t['years']} | TIPO: {t['vehicle_type']} | VISTA: {t['view']} | ARCHIVO: {t['filename']}\nPROMPT:\n{t['prompt']}\n\n"
        
        batches.append({
            "batch_number": batch_num,
            "task_ids": [t["id"] for t in batch_tasks],
            "vehicle_models": list(set([t["model"] for t in batch_tasks])),
            "formatted_paste_text": paste_text
        })

    catalog_data = {
        "catalog_name": "Catálogo Oficial 2D Vector Blueprint - Mitsubishi Nicaragua (MC-LARENS ERP)",
        "brand": "Mitsubishi",
        "total_models": len(mitsubishi_vehicles),
        "total_tasks": len(tasks),
        "total_batches": len(batches),
        "batch_size": batch_size,
        "style_guidelines": {
            "body_color": "#FFFFFF (Pure White)",
            "headlights": "#00E5FF (Bright Cyan-Blue)",
            "taillights": "#FF0033 (Bright Red)",
            "glass_tint": "#1e293b / #334155 (Uniform Charcoal)",
            "background": "#FFFFFF (Solid White)",
            "legend": "Esquina inferior izquierda, tipografía técnica limpia sin emojis"
        },
        "batches": batches,
        "tasks": tasks
    }

    out_file = Path("scripts/grok_mitsubishi_catalog_prompts.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(catalog_data, f, indent=2, ensure_ascii=False)

    print(f"Generated {len(tasks)} tasks across {len(batches)} batches in {out_file}")

if __name__ == "__main__":
    main()
