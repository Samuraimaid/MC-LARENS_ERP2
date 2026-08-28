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
    honda_vehicles = [
        # Batch 1: Civic 11va Gen, Civic 10ma Gen, Civic 8va Gen
        {
            "model": "Civic Sedán (11va Gen FE/FL)",
            "years": "2021-Presente",
            "type": "Sedán Mediano",
            "details": "Sleek low-slung sedan, elongated hood, upright front grille, slim full-LED headlights, elongated greenhouse with chrome window trim, clean horizontal shoulder line, wide L-shaped taillights",
            "file_base": "honda_civic_sedan_2021_present"
        },
        {
            "model": "Civic Sedán (10ma Gen FC)",
            "years": "2015-2021",
            "type": "Sedán Fastback",
            "details": "Aggressive fastback sedan profile, prominent chrome 'Solid Wing Face' front grille bar extending over jewel-eye headlights, dramatic roof slope into short deck, C-shaped boomerang taillights",
            "file_base": "honda_civic_sedan_2015_2021"
        },
        {
            "model": "Civic Sedán (8va Gen FA/FD)",
            "years": "2005-2011",
            "type": "Sedán Compacto",
            "details": "Iconic futuristic aerodynamic wedge silhouette, steeply raked long front windshield cab-forward design, triangular front quarter glass, slim grille, octagonal taillight clusters",
            "file_base": "honda_civic_sedan_2005_2011"
        },

        # Batch 2: CR-V 6ta Gen, CR-V 5ta Gen, CR-V 4ta Gen
        {
            "model": "CR-V (6ta Gen RS/RT)",
            "years": "2022-Presente",
            "type": "SUV Mediano",
            "details": "Boxier rugged SUV proportions, large upright piano-black honeycomb grille, sleek horizontal LED headlights, long flat hood, signature vertical LED taillights framing tailgate",
            "file_base": "honda_crv_2022_present"
        },
        {
            "model": "CR-V (5ta Gen RW)",
            "years": "2016-2022",
            "type": "SUV Mediano",
            "details": "Muscular sculpted crossover, prominent chrome wing grille, flared front and rear wheel arches, athletic character line below windows, signature high-mounted L-shaped vertical tail lamps",
            "file_base": "honda_crv_2016_2022"
        },
        {
            "model": "CR-V (4ta Gen RM)",
            "years": "2011-2016",
            "type": "SUV Compacto",
            "details": "Aerodynamic family crossover, three-bar chrome grille merging into projector headlamps, distinctive hump rear roofline profile, iconic vertical pillar taillights",
            "file_base": "honda_crv_2011_2016"
        },

        # Batch 3: CR-V 3ra Gen, CR-V 2da Gen, Fit / Jazz 3ra Gen
        {
            "model": "CR-V (3ra Gen RE)",
            "years": "2006-2011",
            "type": "SUV Compacto",
            "details": "Curved unibody SUV styling, double-tier front grille opening, lift-up rear tailgate without exterior spare tire, sleek curved rear side quarter window, vertical pillar taillights",
            "file_base": "honda_crv_2006_2011"
        },
        {
            "model": "CR-V (2da Gen RD)",
            "years": "2001-2006",
            "type": "SUV Todoterreno 4x4",
            "details": "Classic rugged boxy SUV, rear side-swinging tailgate with full-size exterior spare tire cover, high roofline, tall vertical rear taillights on D-pillars, black bumper cladding",
            "file_base": "honda_crv_2001_2006"
        },
        {
            "model": "Fit / Jazz (3ra Gen GK)",
            "years": "2013-2020",
            "type": "Hatchback Monovolumen",
            "details": "Aero one-box silhouette, aggressive angular front fascia with solid wing grille, deep door sculpt crease rising to rear, high roofline, tall vertical rear LED lamp pillars",
            "file_base": "honda_fit_2013_2020"
        },

        # Batch 4: Fit / Jazz 2da Gen, HR-V 3ra Gen, HR-V 2da Gen
        {
            "model": "Fit / Jazz (2da Gen GE)",
            "years": "2007-2014",
            "type": "Hatchback Subcompacto",
            "details": "Super-forward cabin mono-form profile, large triangular front quarter windows, large expressive triangular headlamps, swept roofline, vertical taillights with clear lens sections",
            "file_base": "honda_fit_2007_2014"
        },
        {
            "model": "HR-V (3ra Gen RV/RZ)",
            "years": "2021-Presente",
            "type": "SUV Coupé Urbano",
            "details": "Minimalist sleek SUV coupé, body-colored integrated horizontal grille slats, slim jewel headlights, hidden rear door handles in C-pillar window frame, horizontal full-width LED light bar taillight",
            "file_base": "honda_hrv_2021_present"
        },
        {
            "model": "HR-V (2da Gen RU)",
            "years": "2015-2021",
            "type": "SUV Crossover Compacto",
            "details": "Dynamic crossover coupé styling, dark chrome front grille bar, sweeping coupé-like roofline, concealed vertical rear door handles, aggressive side sculpting",
            "file_base": "honda_hrv_2015_2021"
        },

        # Batch 5: Accord 10ma Gen, Accord 9na Gen, City Sedán 7ma Gen
        {
            "model": "Accord (10ma Gen CV)",
            "years": "2017-2022",
            "type": "Sedán Ejecutivo",
            "details": "Fastback executive sedan, low and wide athletic stance, prominent chrome brow over jewel-eye LED headlamps, swooping fastback greenhouse, crab-claw C-shaped taillights",
            "file_base": "honda_accord_2017_2022"
        },
        {
            "model": "Accord (9na Gen CR)",
            "years": "2012-2017",
            "type": "Sedán Mediano",
            "details": "Classic upscale sedan proportions, heavy chrome horizontal bar grille, sharp projector headlamps, straight crisp shoulder crease line, large wrap-around rear taillights",
            "file_base": "honda_accord_2012_2017"
        },
        {
            "model": "City Sedán (7ma Gen GN)",
            "years": "2019-Presente",
            "type": "Sedán Subcompacto",
            "details": "Modern compact family sedan, bold chrome Solid Wing grille, sleek headlamps with wing DRLs, strong shoulder line running from headlights to 3D light-guide rear taillights",
            "file_base": "honda_city_2019_present"
        },

        # Batch 6: Pilot 3ra Gen, Pilot 2da Gen, Odyssey 5ta Gen
        {
            "model": "Pilot (3ra Gen YF5/YF6)",
            "years": "2015-2022",
            "type": "SUV Grande 8 Pasajeros",
            "details": "Full-size 3-row family SUV, rounded aerodynamic profile, three-bar chrome grille flowing into headlights, large glass area, horizontal wrap-around taillights",
            "file_base": "honda_pilot_2015_2022"
        },
        {
            "model": "Pilot (2da Gen YF3/YF4)",
            "years": "2008-2015",
            "type": "SUV Grande 8 Pasajeros",
            "details": "Iconic boxy utilitarian 3-row SUV, large hexagonal billet grille with thick chrome surround, square headlamps, upright vertical rear tailgate with flip-up glass",
            "file_base": "honda_pilot_2008_2015"
        },
        {
            "model": "Odyssey (5ta Gen RL6)",
            "years": "2017-Presente",
            "type": "Minivan Familiar 8 Pasajeros",
            "details": "Premium family minivan, lightning-bolt beltline character drop, floating D-pillar roof design, power sliding side doors with hidden track below rear windows, wide LED taillights",
            "file_base": "honda_odyssey_2017_present"
        }
    ]

    tasks = []
    task_id = 1

    for v in honda_vehicles:
        # Lateral
        lat_fn = f"{v['file_base']}_lat.png"
        lat_prompt = generate_prompt("Honda", v["model"], v["years"], v["type"], "Lateral", lat_fn, v["details"])
        tasks.append({
            "id": task_id,
            "brand": "Honda",
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
        top_prompt = generate_prompt("Honda", v["model"], v["years"], v["type"], "Superior (Top-Down)", top_fn, v["details"])
        tasks.append({
            "id": task_id,
            "brand": "Honda",
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
        
        paste_text = f"=== BATCH {batch_num} DE HONDA (TAREAS ID {batch_tasks[0]['id']} AL {batch_tasks[-1]['id']}) ===\n\n"
        for t in batch_tasks:
            paste_text += f"ID {t['id']} | MARCA: {t['brand']} | MODELO: {t['model']} | AÑO: {t['years']} | TIPO: {t['vehicle_type']} | VISTA: {t['view']} | ARCHIVO: {t['filename']}\nPROMPT:\n{t['prompt']}\n\n"
        
        batches.append({
            "batch_number": batch_num,
            "task_ids": [t["id"] for t in batch_tasks],
            "vehicle_models": list(set([t["model"] for t in batch_tasks])),
            "formatted_paste_text": paste_text
        })

    catalog_data = {
        "catalog_name": "Catálogo Oficial 2D Vector Blueprint - Honda Nicaragua (MC-LARENS ERP)",
        "brand": "Honda",
        "total_models": len(honda_vehicles),
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

    out_file = Path("scripts/grok_honda_catalog_prompts.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(catalog_data, f, indent=2, ensure_ascii=False)

    print(f"Generated {len(tasks)} tasks across {len(batches)} batches in {out_file}")

if __name__ == "__main__":
    main()
