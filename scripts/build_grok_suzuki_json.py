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
    suzuki_vehicles = [
        # Batch 1: S-Presso, Swift 4ta Gen, Jimny 4ta Gen
        {
            "model": "S-Presso",
            "years": "2019-Presente",
            "type": "Crossover Urbano / City Car",
            "details": "Mini SUV crossover stance, upright bold front grille with trapezoidal chrome-like accents, high ground clearance, squared wheel arches, compact high roofline",
            "file_base": "suzuki_spresso_2019_present"
        },
        {
            "model": "Swift (4ta Gen A2L)",
            "years": "2017-Presente",
            "type": "Hatchback Subcompacto",
            "details": "Sporty compact hatchback, floating roof design with blacked-out A and B pillars, hidden rear door handles in C-pillar, wide hexagonal front grille, sleek swept-back headlamps",
            "file_base": "suzuki_swift_2017_present"
        },
        {
            "model": "Jimny (4ta Gen JB64/JB74)",
            "years": "2018-Presente",
            "type": "SUV Todoterreno 4x4",
            "details": "Iconic boxy retro 4x4 silhouette, vertical 5-slot front grille, round headlights, flat clamshell hood, upright windshield, flared black fender flares, rear exterior mounted spare tire",
            "file_base": "suzuki_jimny_2018_present"
        },

        # Batch 2: Grand Vitara / Vitara 4ta Gen, Grand Vitara 3ra Gen, Alto 800 / K10
        {
            "model": "Vitara (4ta Gen LY)",
            "years": "2015-Presente",
            "type": "SUV Compacto",
            "details": "Modern urban SUV proportions, clamshell bonnet with fender garnishes, chrome tooth grille, muscular shoulder lines, black protective lower cladding, two-tone roof styling",
            "file_base": "suzuki_vitara_2015_present"
        },
        {
            "model": "Grand Vitara (3ra Gen JT)",
            "years": "2005-2015",
            "type": "SUV Mediano 4x4",
            "details": "Robust unibody SUV with integrated ladder frame, flared wheel arches, horizontal front grille slats, large rectangular headlights, tailgate mounted spare wheel",
            "file_base": "suzuki_grand_vitara_2005_2015"
        },
        {
            "model": "Alto 800 / K10",
            "years": "2012-Presente",
            "type": "Hatchback City Car",
            "details": "Ultra compact 5-door city car, petal-shaped large headlamps, slim upper grille with large hexagonal lower bumper air dam, pronounced side character crease, compact tail",
            "file_base": "suzuki_alto_2012_present"
        },

        # Batch 3: Ertiga, Dzire Sedán, Baleno
        {
            "model": "Ertiga (2da Gen NC)",
            "years": "2018-Presente",
            "type": "Monovolumen MPV 7 Pasajeros",
            "details": "Family 7-seater MPV, chrome studded front grille, projector headlamps, floating roof design with blacked-out D-pillar, 3D L-shaped LED tail lamps, aerodynamic body lines",
            "file_base": "suzuki_ertiga_2018_present"
        },
        {
            "model": "Dzire (3ra Gen)",
            "years": "2017-Presente",
            "type": "Sedán Subcompacto",
            "details": "Compact sedan silhouette, polygon front grille with chrome surround, sleek swept headlights, integrated short notchback trunk, flowing side character lines",
            "file_base": "suzuki_dzire_2017_present"
        },
        {
            "model": "Baleno (2da Gen)",
            "years": "2015-Presente",
            "type": "Hatchback Premium",
            "details": "Liquid flow aerodynamic hatchback design, wide 3D wave grille, swept-back headlamps with DRL accents, broad muscular rear fenders, integrated roof spoiler",
            "file_base": "suzuki_baleno_2015_present"
        },

        # Batch 4: Celerio, APV Van / Microbús, APV Pickup
        {
            "model": "Celerio (2da/3ra Gen)",
            "years": "2014-Presente",
            "type": "Hatchback Compacto",
            "details": "Curvaceous tall-boy city hatchback, radiant 3D oval front grille, teardrop headlights, sweeping roofline, clean body sides with compact rear hatch",
            "file_base": "suzuki_celerio_2014_present"
        },
        {
            "model": "APV Van / Microbús Pasajeros",
            "years": "2004-Presente",
            "type": "Furgoneta / Microbús Comercial",
            "details": "Commercial passenger minivan, cab-over semi-bonnet profile, tall boxy cargo/passenger cabin, dual sliding side doors, high roofline, vertical rear taillights",
            "file_base": "suzuki_apv_van_2004_present"
        },
        {
            "model": "APV Carry Pickup (Mega Carry)",
            "years": "2004-Presente",
            "type": "Camioneta Pickup de Carga",
            "details": "Light commercial cab-forward pickup, single cab, flat steel drop-side cargo bed with tie-down hooks, high ground clearance, heavy-duty rear leaf springs",
            "file_base": "suzuki_apv_pickup_2004_present"
        },

        # Batch 5: Grand Vitara 2da Gen, Jimny 3ra Gen, Swift 3ra Gen
        {
            "model": "Grand Vitara (2da Gen SQ)",
            "years": "1998-2005",
            "type": "SUV Todoterreno 4x4",
            "details": "Classic rugged 90s/2000s 4x4 SUV, pronounced plastic fender cladding, curved trapezoidal grille, external spare wheel on rear door, roof rails",
            "file_base": "suzuki_grand_vitara_1998_2005"
        },
        {
            "model": "Jimny (3ra Gen JB23/JB43)",
            "years": "1998-2018",
            "type": "SUV Todoterreno 4x4",
            "details": "Compact 3-door 4x4 boxy mini-SUV, hood scoop on intercooler models, 5-slot vertical grille, large blocky headlamps, rear door mounted spare tire",
            "file_base": "suzuki_jimny_1998_2018"
        },
        {
            "model": "Swift (3ra Gen ZC72S/ZC82S)",
            "years": "2010-2017",
            "type": "Hatchback Subcompacto",
            "details": "Curvaceous sporty hatchback, iconic blacked-out A-pillars creating wrap-around visor look, large vertical headlamps, muscular rear haunches",
            "file_base": "suzuki_swift_2010_2017"
        },

        # Batch 6: Ignis, Fronx / Grand Vitara Híbrido, Alto 5ta/6ta Gen
        {
            "model": "Ignis (2da Gen MF)",
            "years": "2016-Presente",
            "type": "Micro Crossover Urbano",
            "details": "Ultra-compact crossover, iconic C-pillar three-slit indentations (Cervó hommage), flared clamshell wheel arches, high stance, U-shaped LED headlights",
            "file_base": "suzuki_ignis_2016_present"
        },
        {
            "model": "Fronx (Crossover Coupé)",
            "years": "2023-Presente",
            "type": "SUV Coupé Urbano",
            "details": "Athletic fastback crossover, split LED headlamp architecture with brow DRLs, bold geometric mesh grille, silver front and rear skid plates, full-width LED lightbar",
            "file_base": "suzuki_fronx_2023_present"
        },
        {
            "model": "Alto (5ta Gen HA12/HA22 / Clásico)",
            "years": "1998-2012",
            "type": "Hatchback City Car",
            "details": "Classic economical small city hatchback, simple rounded front end with compact horizontal headlamps, clean flat sides, minimal overhangs",
            "file_base": "suzuki_alto_1998_2012"
        }
    ]

    tasks = []
    task_id = 1

    for v in suzuki_vehicles:
        # Lateral
        lat_fn = f"{v['file_base']}_lat.png"
        lat_prompt = generate_prompt("Suzuki", v["model"], v["years"], v["type"], "Lateral", lat_fn, v["details"])
        tasks.append({
            "id": task_id,
            "brand": "Suzuki",
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
        top_prompt = generate_prompt("Suzuki", v["model"], v["years"], v["type"], "Superior (Top-Down)", top_fn, v["details"])
        tasks.append({
            "id": task_id,
            "brand": "Suzuki",
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
        
        paste_text = f"=== BATCH {batch_num} DE SUZUKI (TAREAS ID {batch_tasks[0]['id']} AL {batch_tasks[-1]['id']}) ===\n\n"
        for t in batch_tasks:
            paste_text += f"ID {t['id']} | MARCA: {t['brand']} | MODELO: {t['model']} | AÑO: {t['years']} | TIPO: {t['vehicle_type']} | VISTA: {t['view']} | ARCHIVO: {t['filename']}\nPROMPT:\n{t['prompt']}\n\n"
        
        batches.append({
            "batch_number": batch_num,
            "task_ids": [t["id"] for t in batch_tasks],
            "vehicle_models": list(set([t["model"] for t in batch_tasks])),
            "formatted_paste_text": paste_text
        })

    catalog_data = {
        "catalog_name": "Catálogo Oficial 2D Vector Blueprint - Suzuki Nicaragua (MC-LARENS ERP)",
        "brand": "Suzuki",
        "total_models": len(suzuki_vehicles),
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

    out_file = Path("scripts/grok_suzuki_catalog_prompts.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(catalog_data, f, indent=2, ensure_ascii=False)

    print(f"Generated {len(tasks)} tasks across {len(batches)} batches in {out_file}")

if __name__ == "__main__":
    main()
