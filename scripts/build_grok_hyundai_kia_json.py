import json
import os

def make_prompt(id_num, brand, model, generation, body_type, view, filename, extra_details=""):
    aspect = "16:9 widescreen format" if view == "Lateral" else ("9:16 vertical portrait format" if view == "Superior (Top-Down)" else "16:9 studio format")
    
    if view == "Lateral":
        orientation = "exact studio side profile view (Lateral), vehicle facing left, horizontally centered with generous padding"
    elif view == "Superior (Top-Down)":
        orientation = "pure 90-degree orthogonal top-down aerial zenith view (Vista Superior Cenital), vehicle facing UP, vertically centered with generous padding"
    else:
        orientation = "clean professional front three-quarter 3/4 studio angle, vehicle facing forward-left"

    # Specific metadata text required by the user inside the image to avoid confusion
    metadata_text_tag = f"{brand.upper()} {model.upper()} ({generation}) - {body_type.upper()} [{view.upper()}]"
    
    prompt = (
        f"Professional automotive studio photo render of {brand} {model} ({generation}) {body_type}, {orientation}. "
        f"Solid pure white body paint (#FFFFFF) with ultra-clean realistic reflections, sharp panel gaps, pristine door lines, authentic alloy wheels, detailed headlights and taillights. "
        f"Clean factory-tinted dark charcoal glass windows (#1e293b). "
        f"{extra_details} "
        f"Isolated on a seamless, clean pure solid white background (#FFFFFF) with no harsh shadows and no background clutter. "
        f"A clean, elegant, small technical caption text in discrete bold font at the bottom edge reads: '{metadata_text_tag}'. "
        f"High-end official vehicle catalog reception asset. {aspect}."
    )

    header_tag = f"📌 ID {id_num:03d} | MARCA: {brand} | MODELO: {model} | AÑO: {generation} | TIPO: {body_type} | VISTA: {view} | ARCHIVO: {filename}"

    return {
        "id": id_num,
        "brand": brand,
        "model": model,
        "generation": generation,
        "body_type": body_type,
        "view": view,
        "filename": filename,
        "metadata_text": metadata_text_tag,
        "dimensions": "640x360" if view == "Lateral" else "360x640",
        "header_tag": header_tag,
        "prompt": prompt
    }

# ==========================================
# 1. HYUNDAI LINEUP (Generaciones 2000-2026)
# ==========================================
hyundai_models = [
    # --- SANTA FE ---
    ("Santa Fe (5ta Gen MX5)", "2023-Presente", "SUV Mediano 7 Pasajeros", "hyundai_santa_fe_2023_present", "Radical boxy retro-futuristic SUV silhouette, H-shaped LED pixel headlights, roof rails, upright tailgate."),
    ("Santa Fe (4ta Gen TM)", "2018-2023", "SUV Mediano", "hyundai_santa_fe_2018_2023", "Cascading geometric front grille, split-level slim LED DRLs, muscular wheel arches, prominent chrome waistline."),
    ("Santa Fe (3ra Gen DM)", "2012-2018", "SUV Mediano", "hyundai_santa_fe_2012_2018", "Storm Edge fluidic sculpture design, hexagonal chrome grille, wraparound taillights, sleek rising beltline."),
    ("Santa Fe (2da Gen CM)", "2006-2012", "SUV Mediano", "hyundai_santa_fe_2006_2012", "Smooth rounded unibody crossover silhouette, body-colored bumpers, dual exhaust tips, clean profile."),
    ("Santa Fe (1ra Gen SM)", "2000-2006", "SUV 4x4", "hyundai_santa_fe_2000_2006", "Original muscular sculpted body cladding, flared wheel arches, asymmetric tailgate handle, high roof rails."),

    # --- TUCSON ---
    ("Tucson (4ta Gen NX4)", "2020-Presente", "SUV Compacto", "hyundai_tucson_2020_present", "Parametric hidden jewel LED grille, sharp geometric body origami creases, blade-like angular wheel arches."),
    ("Tucson (3ra Gen TL)", "2015-2020", "SUV Compacto", "hyundai_tucson_2015_2020", "Hexagonal chrome corporate grille, sculpted horizontal body lines, sporty rear roof spoiler."),
    ("Tucson (2da Gen LM / ix35)", "2009-2015", "SUV Compacto", "hyundai_tucson_2009_2015", "Fluidic Sculpture design language, swept-back almond headlights, dual sunroof lines, curved hatchback rear."),
    ("Tucson (1ra Gen JM)", "2004-2009", "SUV Compacto", "hyundai_tucson_2004_2009", "Classic boxy compact SUV with dark plastic lower body cladding, rugged roof rails, dual rear exhaust."),

    # --- CRETA / GRAND CRETA ---
    ("Creta (2da Gen SU2)", "2020-Presente", "Crossover SUV", "hyundai_creta_2020_present", "Trio LED split headlights, jewel-pattern radiator grille, two-tone floating roof, C-pillar silver boomerang arc."),
    ("Creta (1ra Gen GS)", "2015-2020", "Crossover SUV", "hyundai_creta_2015_2020", "Upright confident crossover posture, triple-slat chrome grille, black A-pillars, functional silver roof rails."),
    ("Grand Creta / Alcazar", "2021-Presente", "SUV 7 Pasajeros", "hyundai_grand_creta_2021_present", "Extended 3-row wheelbase, studded chrome grille, larger rear quarter glass, premium multi-spoke wheels."),

    # --- ACCENT ---
    ("Accent (6ta Gen BN7 / Verna)", "2023-Presente", "Sedán Compacto", "hyundai_accent_2023_present", "Full-width horizontal Horizon LED light bar, parametric jewel fastback coupe sedan silhouette, sharp body lines."),
    ("Accent (5ta Gen HC)", "2017-2023", "Sedán Compacto", "hyundai_accent_2017_2023", "Cascading grille with chrome surround, sharp wraparound LED taillights, sleek aerodynamic roofline."),
    ("Accent (4ta Gen RB)", "2011-2017", "Sedán Compacto", "hyundai_accent_2011_2017", "Iconic Fluidic Sculpture sedan, swept-back eagle-eye headlights, prominent upward sweeping shoulder crease."),
    ("Accent (3ra Gen MC)", "2005-2011", "Sedán Compacto", "hyundai_accent_2005_2011", "Clean compact three-box sedan, rectangular horizontal taillights, body-color protective door moldings."),
    ("Accent (2da Gen LC)", "2000-2005", "Sedán Compacto", "hyundai_accent_2000_2005", "Classic rounded early 2000s compact sedan, sloped hood, oval side indicators."),

    # --- ELANTRA ---
    ("Elantra (7ma Gen CN7)", "2020-Presente", "Sedán Mediano", "hyundai_elantra_2020_present", "Parametric Dynamics design with triangular sharp door creases, fastback coupe profile, full-width H taillight."),
    ("Elantra (6ta Gen AD)", "2015-2020", "Sedán Mediano", "hyundai_elantra_2015_2020", "Sophisticated hexagonal wide grille, arrow-shaped daytime running lights, chiseled body character lines."),
    ("Elantra (5ta Gen MD)", "2010-2015", "Sedán Mediano", "hyundai_elantra_2010_2015", "Wind Craft fluidic styling, sweeping headlamps extending into front fenders, wave-like body side contours."),
    ("Elantra (4ta Gen HD)", "2006-2010", "Sedán Mediano", "hyundai_elantra_2006_2010", "Wave-line styling with raised rear shoulder deck, chrome accent grille, clear lens lighting."),

    # --- GRAND i10 / i10 ---
    ("Grand i10 (3ra Gen AI3/AC3)", "2019-Presente", "Hatchback Compacto", "hyundai_grand_i10_2019_present", "Boomerang LED DRLs inside cascading grille, X-shaped C-pillar accent badge, sporty compact hatchback rear."),
    ("Grand i10 Sedán (3ra Gen)", "2019-Presente", "Sedán Subcompacto", "hyundai_grand_i10_sedan_2019_present", "Sub-4m compact notchback sedan, integrated ducktail trunk lid spoiler, dual-tone rear bumper."),
    ("Grand i10 (2da Gen BA/IA)", "2013-2019", "Hatchback Compacto", "hyundai_grand_i10_2013_2019", "Extended wheelbase city car, signature hexagonal grille, black protective door side moldings."),
    ("i10 (1ra Gen PA)", "2007-2013", "Hatchback City Car", "hyundai_i10_2007_2013", "Tall-boy city car silhouette, large expressive front headlights, upright rear tailgate glass."),

    # --- VENUE & KONA ---
    ("Venue (QX)", "2019-Presente", "SUV Subcompacto", "hyundai_venue_2019_present", "Boxy urban crossover, split cube LED headlamps, cascading mesh grille, contrasting roof pillars."),
    ("Kona (2da Gen SX2)", "2023-Presente", "Crossover SUV", "hyundai_kona_2023_present", "Futuristic Seamless Horizon Lamp, rugged parametric wheel arch armor, sculpted aerodynamic body."),
    ("Kona (1ra Gen OS)", "2017-2023", "Crossover SUV", "hyundai_kona_2017_2023", "Armor-style protective body cladding, composite slim lighting, cascading grille, sporty two-tone stance."),

    # --- PALISADE ---
    ("Palisade (LX2)", "2018-2026", "SUV Grande 8 Pasajeros", "hyundai_palisade_2018_2026", "Flagship full-size SUV, massive bold armor cascading grille, vertical composite LED light signature, panoramic rear glass."),

    # --- STARIA & H-1 / STAREX ---
    ("Staria (US4)", "2021-Presente", "Van / Minivan Lujo", "hyundai_staria_2021_present", "Spaceship-inspired silhouette, horizontal front LED bar, massive panoramic tinted side windows, vertical pixel taillights."),
    ("H-1 / Grand Starex (TQ)", "2007-2021", "Microbús / Van Pasajeros", "hyundai_h1_grand_starex_2007_2021", "Dual sliding passenger doors, large vertical headlights, high-roof van body, commercial/passenger luxury trim."),
    ("Starex / H-1 (1ra Gen A1)", "1997-2007", "Microbús / Van Comercial", "hyundai_starex_a1_1997_2007", "Classic round-nose van, dual-tone lower body paint, large front windscreen, robust utility design."),

    # --- H100 / PORTER & SANTA CRUZ ---
    ("Porter / H100 (4ta Gen)", "2004-Presente", "Camioneta Cabina Sencilla", "hyundai_porter_h100_2004_present", "Cab-over engine utility truck, flat cargo drop-side bed, twin rear small wheels, white commercial cab."),
    ("Porter / H100 Doble Cabina", "2004-Presente", "Camioneta Doble Cabina", "hyundai_porter_double_cab_2004_present", "4-door 6-seater commercial utility crew cab with rear steel cargo bed."),
    ("Santa Cruz (NX4a)", "2021-Presente", "Pick-up Sport Adventure", "hyundai_santa_cruz_2021_present", "Unibody lifestyle pickup truck, hidden daytime running lights, integrated composite composite cargo bed with tonneau."),

    # --- COUNTY & TERRACAN ---
    ("County Bus", "2004-Presente", "Microbús Colectivo", "hyundai_county_bus_2004_present", "Medium-duty passenger transit bus, passenger folding entry door, panoramic destination header, robust dual rear axle."),
    ("Terracan", "2001-2007", "SUV 4x4 Todoterreno", "hyundai_terracan_2001_2007", "Body-on-frame heavy-duty 4WD SUV, hood scoop, wide flared fenders, roof rack, rear spare wheel mounting.")
]

# ==========================================
# 2. KIA LINEUP (Generaciones 2000-2026)
# ==========================================
kia_models = [
    # --- SORENTO ---
    ("Sorento (4ta Gen MQ4)", "2020-Presente", "SUV Mediano 7 Pasajeros", "kia_sorento_2020_present", "Sharp Tiger Nose grille merging into 'Tiger Eyeline' LED headlamps, split vertical taillights, shark-fin chrome C-pillar trim."),
    ("Sorento (3ra Gen UM)", "2014-2020", "SUV Mediano", "kia_sorento_2014_2020", "Sleek elongated profile, 3D diamond-pattern mesh grille, quad ice-cube LED fog lights, wraparound rear spoiler."),
    ("Sorento (2da Gen XM)", "2009-2014", "SUV Mediano", "kia_sorento_2009_2014", "First unibody Sorento, signature Peter Schreyer Tiger Nose grille, muscular shoulder lines, black rocker cladding."),
    ("Sorento (1ra Gen BL)", "2002-2009", "SUV 4x4 Chasis", "kia_sorento_2002_2009", "Classic truck-based body-on-frame 4x4 SUV, dual-tone silver lower cladding, robust roof rails, tailgate flip glass."),

    # --- SPORTAGE ---
    ("Sportage (5ta Gen NQ5)", "2021-Presente", "SUV Compacto", "kia_sportage_2021_present", "Dramatic boomerang LED DRLs, massive black digital Tiger Face grille, floating roof with chrome accent beltline."),
    ("Sportage (4ta Gen QL)", "2015-2021", "SUV Compacto", "kia_sportage_2015_2021", "High-mounted headlamps, quad ice-cube LED fog lamps, connected horizontal rear light strip, sculpted aerodynamic profile."),
    ("Sportage (3ra Gen SL)", "2010-2015", "SUV Compacto", "kia_sportage_2010_2015", "Radical sleek coupe-like crossover silhouette, thick angled C-pillar, high shoulder line, clamshell hood."),
    ("Sportage (2da Gen KM)", "2004-2010", "SUV Compacto", "kia_sportage_2004_2010", "Friendly rugged compact SUV, twin-slat front grille, flat roof with utility crossbars, wrap-over rear tailgate."),
    ("Sportage (1ra Gen NB-7)", "1993-2004", "SUV 4x4 Todoterreno", "kia_sportage_1993_2004", "Original compact body-on-frame 4x4 off-roader, rear tailgate-mounted spare tire, tubular side steps, high ground clearance."),

    # --- SELTOS & SONET ---
    ("Seltos (SP2)", "2019-Presente", "SUV Compacto", "kia_seltos_2019_present", "Wide Tiger Nose grille with knurled chrome top edge, dual-layer LED headlights, muscular high-hood stance, roof rails."),
    ("Sonet", "2020-Presente", "SUV Subcompacto", "kia_sonet_2020_present", "Aggressive compact urban SUV, geometric mesh grille, heartbeat LED DRLs, wraparound rear windscreen, sporty skid plates."),

    # --- RIO ---
    ("Rio (4ta Gen YB/FB)", "2017-2023", "Sedán Compacto", "kia_rio_sedan_2017_2023", "Modern geometric sedan, slim Tiger Nose grille, swept-back bi-function projection headlamps, balanced 3-box sedan proportions."),
    ("Rio 5 (4ta Gen YB Hatchback)", "2017-2023", "Hatchback Compacto", "kia_rio_hatchback_2017_2023", "Sporty European 5-door hatchback, upright C-pillar, rear roof spoiler, clean horizontal body lines."),
    ("Rio (3ra Gen UB)", "2011-2017", "Sedán Compacto", "kia_rio_sedan_2011_2017", "Dynamic wedge-shaped silhouette, prominent chrome Tiger Nose grille, large expressive headlights, high trunk deck."),
    ("Rio (2da Gen JB)", "2005-2011", "Sedán Compacto", "kia_rio_sedan_2005_2011", "Clean functional compact sedan, dual black side protective moldings, body-colored door mirrors."),
    ("Rio (1ra Gen DC)", "2000-2005", "Sedán Compacto", "kia_rio_sedan_2000_2005", "Classic curved early 2000s compact sedan, horizontal chrome slat grille, smooth rounded body corners."),

    # --- PICANTO / MORNING ---
    ("Picanto (3ra Gen Facelift JA)", "2023-Presente", "Hatchback Compacto", "kia_picanto_2023_present", "Opposites United design, vertical MFR LED headlights, full-width rear light bar, aggressive sporty city car styling."),
    ("Picanto (3ra Gen JA)", "2017-2023", "Hatchback Compacto", "kia_picanto_2017_2023", "Confident wide-stance city hatchback, wraparound front bumper intake, bold double-layer character lines."),
    ("Picanto (2da Gen TA)", "2011-2017", "Hatchback Compacto", "kia_picanto_2011_2017", "Sculpted dynamic city car, prominent Tiger Nose grille, large petal-shaped headlights, distinctive side door crease."),
    ("Picanto / Morning (1ra Gen SA)", "2004-2011", "Hatchback Compacto", "kia_picanto_2004_2011", "Friendly rounded urban micro-hatchback, circular fog lights, tall roofline, large glass area."),

    # --- CERATO / FORTE / K3 ---
    ("K3 / Cerato (Nueva Gen)", "2023-Presente", "Sedán Fastback", "kia_k3_cerato_2023_present", "Fastback crossover-inspired sedan, full-width star-map LED lighting, integrated rear ducktail spoiler, cladding accents."),
    ("Cerato / Forte (4ta Gen BD)", "2018-2024", "Sedán Mediano", "kia_cerato_2018_2024", "Stinger-inspired aggressive front fascia, sweeping fastback roofline, connected rear LED light bar."),
    ("Cerato (3ra Gen YD)", "2013-2018", "Sedán Mediano", "kia_cerato_2013_2018", "Cab-forward aerodynamic shape, wide chrome-trimmed Tiger Nose grille, sweeping high beltline."),
    ("Cerato (2da Gen TD)", "2008-2013", "Sedán Mediano", "kia_cerato_2008_2013", "Crisp athletic sedan styling by Peter Schreyer, geometric headlights, clean straight shoulder line."),

    # --- K5 / OPTIMA ---
    ("K5 (5ta Gen DL3)", "2019-Presente", "Sedán Deportivo Mediano", "kia_k5_2019_present", "Heartbeat DRL signature, shark-skin texture wide grille, fastback silhouette with chrome roof molding extending into rear window."),
    ("Optima (4ta Gen JF)", "2015-2020", "Sedán Mediano", "kia_optima_2015_2020", "Executive sports sedan, dual-projector LED headlights, satin chrome fender garnishes, quad exhaust diffuser."),
    ("Optima (3ra Gen TF)", "2010-2015", "Sedán Mediano", "kia_optima_2010_2015", "Groundbreaking sleek sports sedan, aggressive Tiger Nose grille, distinctive chrome roof arc line."),

    # --- SOUL ---
    ("Soul (3ra Gen SK3)", "2019-Presente", "Crossover Urbano", "kia_soul_2019_present", "Iconic boxy silhouette with razor-thin LED brow headlights, boomerang wraparound vertical taillights, airplane wing C-pillar."),
    ("Soul (2da Gen PS)", "2013-2019", "Crossover Urbano", "kia_soul_2013_2019", "Robust cube crossover, floating body-color backpack panel on rear tailgate, projector headlights with LED halos."),
    ("Soul (1ra Gen AM)", "2008-2013", "Crossover Urbano", "kia_soul_2008_2013", "Original funky boxy crossover concept, high roofline, vertical tail lamps, flared wheel arches."),

    # --- CARNIVAL / SEDONA & CARENS ---
    ("Carnival (4ta Gen KA4)", "2020-Presente", "Minivan Lujo / SUV Familiar", "kia_carnival_2020_present", "Grand Utility Vehicle styling, SUV-inspired boxy front, metallic textured C-pillar garnish, full-width taillight bar."),
    ("Carnival / Sedona (3ra Gen YP)", "2014-2020", "Minivan Familiar 8 Pasajeros", "kia_carnival_2014_2020", "Wide luxury family carrier, dual power sliding doors, swept-back headlights, clean luxury profile."),
    ("Carens (4ta Gen KA4)", "2022-Presente", "Crossover 7 Pasajeros", "kia_carens_2022_present", "Recreational 3-row crossover, Crown Jewel LED headlamps, star-map DRLs, high ground clearance, flush roof rails."),

    # --- TELLURIDE & STINGER ---
    ("Telluride", "2019-Presente", "SUV Grande 8 Pasajeros", "kia_telluride_2019_present", "Massive rugged flagship SUV, rectangular amber LED headlights, inverted L-shaped taillights, bold upright hood with badging."),
    ("Stinger (CK)", "2017-2023", "Gran Turismo Fastback", "kia_stinger_2017_2023", "Low-slung rear-wheel-drive GT fastback, twin functional hood vents, quad exhaust pipes, Brembo red calipers, wide rear haunches."),

    # --- BONGO III / K2700 / K3000 ---
    ("Bongo III / K2700 Cabina Sencilla", "2004-Presente", "Camioneta Cabina Sencilla", "kia_bongo_k2700_single_cab_2004_present", "Forward-control commercial truck, drop-side steel flatbed cargo, dual rear wheels, white cab with protective steel bumper."),
    ("Bongo III / K3000 Doble Cabina", "2004-Presente", "Camioneta Doble Cabina", "kia_bongo_k3000_double_cab_2004_present", "6-passenger crew cab commercial utility truck with rear drop-side steel cargo bed."),
    ("Pregio / Pregio Grand", "1995-2015", "Van Comercial / Pasajeros", "kia_pregio_1995_2015", "One-box commercial van, sliding passenger door, tall rear tailgate, robust diesel workhorse body.")
]

def main():
    tasks = []
    task_id = 1

    # Build Hyundai tasks
    for model_name, gen, body_type, file_slug, extra in hyundai_models:
        # Lateral view
        tasks.append(make_prompt(
            id_num=task_id,
            brand="Hyundai",
            model=model_name,
            generation=gen,
            body_type=body_type,
            view="Lateral",
            filename=f"{file_slug}_lat.png",
            extra_details=extra
        ))
        task_id += 1

        # Front 3/4 Studio view
        tasks.append(make_prompt(
            id_num=task_id,
            brand="Hyundai",
            model=model_name,
            generation=gen,
            body_type=body_type,
            view="3/4 Frontal",
            filename=f"{file_slug}_3q.png",
            extra_details=extra
        ))
        task_id += 1

    # Build Kia tasks
    for model_name, gen, body_type, file_slug, extra in kia_models:
        # Lateral view
        tasks.append(make_prompt(
            id_num=task_id,
            brand="Kia",
            model=model_name,
            generation=gen,
            body_type=body_type,
            view="Lateral",
            filename=f"{file_slug}_lat.png",
            extra_details=extra
        ))
        task_id += 1

        # Front 3/4 Studio view
        tasks.append(make_prompt(
            id_num=task_id,
            brand="Kia",
            model=model_name,
            generation=gen,
            body_type=body_type,
            view="3/4 Frontal",
            filename=f"{file_slug}_3q.png",
            extra_details=extra
        ))
        task_id += 1

    # Create Batches of 6 for easy Grok pasting
    batch_size = 6
    batches = []
    for i in range(0, len(tasks), batch_size):
        batch_tasks = tasks[i:i+batch_size]
        batch_num = (i // batch_size) + 1
        
        batch_text_list = []
        for t in batch_tasks:
            batch_text_list.append(
                f"{t['header_tag']}\nPROMPT:\n{t['prompt']}\n"
            )
        
        batches.append({
            "batch_number": batch_num,
            "tasks_count": len(batch_tasks),
            "task_ids": [t["id"] for t in batch_tasks],
            "formatted_paste_text": "\n---\n\n".join(batch_text_list)
        })

    output_data = {
        "title": "Catálogo Oficial de Prompts Grok 3 - HYUNDAI & KIA (2000-2026)",
        "total_tasks": len(tasks),
        "total_models_hyundai": len(hyundai_models),
        "total_models_kia": len(kia_models),
        "total_batches_of_6": len(batches),
        "batches": batches,
        "tasks": tasks
    }

    output_file = "scripts/grok_hyundai_kia_catalog_prompts.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"SUCCESS: Generated {output_file}")
    print(f"  - Total vehicle models: {len(hyundai_models)} Hyundai + {len(kia_models)} Kia = {len(hyundai_models) + len(kia_models)} models")
    print(f"  - Total prompt tasks (Lateral + 3Q): {len(tasks)} tasks")
    print(f"  - Total Grok batches of 6: {len(batches)} batches")

if __name__ == "__main__":
    main()
