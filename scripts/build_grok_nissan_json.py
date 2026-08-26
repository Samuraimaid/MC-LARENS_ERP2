import json
import os

# Base visual prompt template for Grok 3 / Aurora Image Generation
def make_prompt(id_num, brand, model, generation, body_type, view, filename, extra_details=""):
    aspect = "16:9 widescreen format" if view == "Lateral" else "9:16 vertical portrait format"
    orientation = (
        "exact side profile view (Lateral), vehicle facing left, horizontally centered with generous padding"
        if view == "Lateral"
        else "pure 90-degree orthogonal top-down aerial zenith view (Vista Superior Cenital), vehicle facing UP, vertically centered with generous padding"
    )
    headlights_instruction = (
        "Headlights illuminated in bright cyan-blue (#00E5FF / #38bdf8), Taillights illuminated in bright red (#FF0033 / #ef4444)."
        if view == "Lateral"
        else "Front headlights glowing in vivid cyan (#00E5FF), Rear taillights glowing in solid vivid red (#FF0033)."
    )

    prompt = (
        f"Professional automotive 2D vector technical blueprint illustration of {brand} {model} ({generation}) {body_type}, {orientation}. "
        f"Solid pure white body paint (#FFFFFF) with crisp, clean black outline vector lines defining doors, panels, bumpers, hood, fenders and roof contours. "
        f"Uniform flat dark charcoal tinted glass windows (#1e293b / #334155). "
        f"{headlights_instruction} "
        f"{extra_details} "
        f"Isolated on a seamless, clean pure solid white background (#FFFFFF) with no gradients, no shadows, no ground reflections, no perspective distortion, no text, no watermarks, no wheels on top view. "
        f"Perfect flat technical schematic for vehicle workshop reception damage inspection system. {aspect}."
    )

    header_tag = f"📌 ID {id_num:02d} | MARCA: {brand} | MODELO: {model} | AÑO: {generation} | VISTA: {view} | ARCHIVO: {filename}"

    return {
        "id": id_num,
        "brand": brand,
        "model": model,
        "generation": generation,
        "body_type": body_type,
        "view": view,
        "filename": filename,
        "dimensions": "640x360" if view == "Lateral" else "360x640",
        "header_tag": header_tag,
        "prompt": prompt
    }

# Complete Nissan Lineup (2000 - 2026)
nissan_models = [
    # --- 1. NISSAN FRONTIER / NP300 (D23 Facelift 2021-2026) ---
    ("Frontier D23 PRO-4X / LE", "2021-2026", "Doble Cabina Pick-up", "nissan_frontier_double_cab_2021_2026", "Aggressive V-Motion interlocking grille, modern C-clamp LED headlights, muscular high-rise truck bed."),
    ("Frontier / NP300 D23", "2021-2026", "Cabina Sencilla Pick-up", "nissan_frontier_single_cab_2021_2026", "2-door single cab with long commercial cargo steel bed, black bumper trim."),
    ("Frontier / NP300 D23", "2021-2026", "King Cab (Cabina y Media)", "nissan_frontier_king_cab_2021_2026", "Extended cab with rear suicide quarter doors, medium cargo bed."),

    # --- 2. NISSAN FRONTIER / NP300 (D23 1ra Fase 2015-2020) ---
    ("NP300 Frontier D23", "2015-2020", "Doble Cabina Pick-up", "nissan_frontier_double_cab_2015_2020", "First gen D23 aerodynamic V-Motion front grille, sleek curved roofline and roof rails."),
    ("NP300 Frontier D23", "2015-2020", "Cabina Sencilla Pick-up", "nissan_frontier_single_cab_2015_2020", "Single cab workhorse utility pickup with tall rear cargo box."),
    ("NP300 Frontier D23", "2015-2020", "King Cab (Cabina y Media)", "nissan_frontier_king_cab_2015_2020", "King cab configuration with extended cabin side windows."),

    # --- 3. NISSAN FRONTIER / NAVARA (D40 2005-2014) ---
    ("Frontier / Navara D40", "2005-2014", "Doble Cabina Pick-up", "nissan_frontier_double_cab_2005_2014", "Boxy wide-fender muscular design, angled V grille bars, sturdy tubular roof rack."),
    ("Frontier / Navara D40", "2005-2014", "King Cab (Cabina y Media)", "nissan_frontier_king_cab_2005_2014", "D40 King Cab with suicide half-doors and longer bed."),

    # --- 4. NISSAN FRONTIER / NP300 (D22 Clásica / Hardbody 2000-2015) ---
    ("Frontier / NP300 D22 Clásica", "2000-2015", "Doble Cabina Pick-up", "nissan_frontier_double_cab_2000_2015", "Classic iconic D22 Hardbody double cab, rectangular headlights, flat hood, rollbar."),
    ("Frontier / NP300 D22 Clásica", "2000-2015", "Cabina Sencilla Pick-up", "nissan_frontier_single_cab_2000_2015", "Legendary D22 single cab commercial pickup with tie-down cargo bed."),
    ("Frontier / Hardbody D22", "2000-2004", "King Cab (Cabina y Media)", "nissan_frontier_king_cab_2000_2004", "Classic D22 King Cab with rear side quarter windows."),

    # --- 5. NISSAN KICKS (2017 - 2026) ---
    ("Kicks Facelift", "2021-2026", "Crossover SUV", "nissan_kicks_2021_2026", "Large black Double V-Motion grille, slim LED headlights, floating roof design with roof rails."),
    ("Kicks 1ra Gen", "2017-2020", "Crossover SUV", "nissan_kicks_2017_2020", "Original compact crossover silhouette, black C-pillar floating roof accent."),

    # --- 6. NISSAN QASHQAI (2007 - 2026) ---
    ("Qashqai 3ra Gen", "2022-2026", "SUV Compacto", "nissan_qashqai_2022_2026", "Boomerang split LED headlights, sharp angular body creases, sleek rear spoiler."),
    ("Qashqai 2da Gen", "2014-2021", "SUV Compacto", "nissan_qashqai_2014_2021", "Flowing aerodynamic crossover shape, V-motion chrome grille."),
    ("Qashqai 1ra Gen", "2007-2013", "SUV Compacto", "nissan_qashqai_2007_2013", "Classic rounder European crossover silhouette with black lower cladding."),

    # --- 7. NISSAN X-TRAIL (2001 - 2026: T33, T32, T31, T30) ---
    ("X-Trail T33 / e-POWER", "2022-2026", "SUV Mediano", "nissan_xtrail_2022_2026", "Double-deck split headlamps, muscular floating roof, bold wide stance."),
    ("X-Trail T32 Facelift", "2018-2022", "SUV Mediano", "nissan_xtrail_2018_2022", "Wider V-Motion front, boomerang taillights, panoramic roof lines."),
    ("X-Trail T32 1ra Fase", "2014-2017", "SUV Mediano", "nissan_xtrail_2014_2017", "Smooth modern crossover silhouette replacing boxy predecessor."),
    ("X-Trail T31", "2007-2013", "SUV 4x4", "nissan_xtrail_2007_2013", "Rugged boxy upright off-road styling with integrated roof rail spotlights."),
    ("X-Trail T30 Clásica", "2001-2007", "SUV 4x4", "nissan_xtrail_2001_2007", "Original iconic boxy SUV shape with high-mounted vertical taillights."),

    # --- 8. NISSAN PATHFINDER (2000 - 2026: R53, R52, R51, R50) ---
    ("Pathfinder R53", "2022-2026", "SUV 3 Filas", "nissan_pathfinder_2022_2026", "Robust three-slot top grille, wide boxy body, two-tone floating roof."),
    ("Pathfinder R52", "2013-2020", "SUV 3 Filas", "nissan_pathfinder_2013_2020", "Curved aerodynamic unibody family SUV silhouette."),
    ("Pathfinder R51", "2005-2012", "SUV 4x4 Chasis", "nissan_pathfinder_2005_2012", "Heavy-duty truck-based 4x4 SUV, vertical rear door handles on C-pillar, flared fenders."),
    ("Pathfinder R50", "2000-2004", "SUV 4x4", "nissan_pathfinder_2000_2004", "Classic rugged 90s/2000s SUV styling with rear spare tire carrier or flat tailgate."),

    # --- 9. NISSAN PATROL (Y62 & Y61 2000 - 2026) ---
    ("Patrol / Armada Y62", "2011-2026", "SUV Grande 4x4 Lujo", "nissan_patrol_y62_2011_2026", "Massive flagship full-size SUV, large chrome grille, side fender vents, sunroof."),
    ("Patrol Y61 Super Safari", "2000-2016", "SUV 4x4 Todoterreno", "nissan_patrol_y61_2000_2016", "Legendary heavy-duty off-roader, dual rear barn doors, snorkel, flared wheel arches."),

    # --- 10. NISSAN TERRA (2018 - 2026) ---
    ("Terra SUV", "2018-2026", "SUV 7 Pasajeros 4x4", "nissan_terra_2018_2026", "Frontier-based body-on-frame 7-seater SUV, bold chrome V-Motion front, high ground clearance."),

    # --- 11. NISSAN VERSA (2012 - 2026) ---
    ("Versa N18 Facelift", "2023-2026", "Sedán Compacto", "nissan_versa_2023_2026", "Horizontal multi-slat front grille, razor-sharp LED lights, floating roofline."),
    ("Versa N18", "2020-2022", "Sedán Compacto", "nissan_versa_2020_2022", "Modern dynamic sedan with black accented C-pillar floating roof."),
    ("Versa N17 / V-Drive", "2012-2019", "Sedán Compacto", "nissan_versa_2012_2019", "High-roof spacious sedan silhouette, teardrop headlights."),

    # --- 12. NISSAN SENTRA (2000 - 2026: B18, B17, B16, B15) ---
    ("Sentra B18", "2020-2026", "Sedán Mediano", "nissan_sentra_2020_2026", "Wide low-slung aggressive sedan, floating roof, boomerang taillights."),
    ("Sentra B17 Facelift", "2016-2019", "Sedán Mediano", "nissan_sentra_2016_2019", "V-Motion front styling, sculpted body character lines."),
    ("Sentra B17 1ra Fase", "2013-2015", "Sedán Mediano", "nissan_sentra_2013_2015", "Clean executive sedan profile, LED accent headlights."),
    ("Sentra B16", "2007-2012", "Sedán Mediano", "nissan_sentra_2007_2012", "Taller rounded compact sedan body, high rear trunk line."),
    ("Sentra B15 Clásico", "2000-2006", "Sedán Clásico", "nissan_sentra_2000_2006", "Iconic angular compact sedan, horizontal clear taillights."),

    # --- 13. NISSAN TIIDA, MARCH, ALMERA (2000 - 2026) ---
    ("Tiida Sedán", "2007-2018", "Sedán", "nissan_tiida_sedan_2007_2018", "Tall roofline, expansive glasshouse, high rear decklid."),
    ("Tiida Hatchback", "2007-2018", "Hatchback", "nissan_tiida_hatchback_2007_2018", "5-door hatchback with high roof and vertical tailgate."),
    ("March / Micra K13", "2012-2026", "Hatchback Urbano", "nissan_march_2012_2026", "Compact city car, rounded roofline, large friendly headlights."),
    ("Almera Clásico", "2000-2006", "Sedán Clásico", "nissan_almera_2000_2006", "Classic 2000s European-style sedan silhouette."),

    # --- 14. NISSAN VANS & COMERCIALES (URVAN & NV200 & CABSTAR) ---
    ("Urvan NV350 E26 Techo Alto", "2013-2026", "Microbús Pasajeros Techo Alto", "nissan_urvan_nv350_high_roof_2013_2026", "Long wheelbase high-roof commercial passenger van, flush windows."),
    ("Urvan NV350 E26 Techo Estándar", "2013-2026", "Microbús Pasajeros", "nissan_urvan_nv350_std_roof_2013_2026", "Standard roof passenger/cargo van, sliding side door."),
    ("Urvan NV350 E26 Panel Carga", "2013-2026", "Furgón Panel Carga", "nissan_urvan_nv350_panel_2013_2026", "Blind solid metal side panels with no side windows, cargo van."),
    ("Urvan E25 Clásica", "2001-2012", "Microbús Pasajeros", "nissan_urvan_e25_2001_2012", "Classic rounded commercial van silhouette, vertical taillights."),
    ("NV200 Compact Panel", "2010-2024", "Panel de Carga Ligera", "nissan_nv200_panel_2010_2024", "Compact unibody cargo van with front snout hood and sliding doors."),
    ("Cabstar / Atlas", "2000-2026", "Camión Ligero Cabina Frontal", "nissan_cabstar_truck_2000_2026", "Cab-over-engine commercial light truck with flat cargo platform/baranda."),

    # --- 15. NISSAN JUKE, MURANO, MAGNITE (2003 - 2026) ---
    ("Juke", "2011-2019", "Crossover Compacto", "nissan_juke_2011_2019", "Distinctive rally-style circular bumper headlights, sloped coupe roofline."),
    ("Murano Z52", "2015-2024", "SUV Mediano Lujo", "nissan_murano_2015_2024", "Dramatic floating D-pillar, boomerang lights, luxury sculpted curves."),
    ("Murano Z51", "2008-2014", "SUV Mediano Lujo", "nissan_murano_2008_2014", "Distinctive wide tooth-style grille, sweeping rounded rear tailgate."),
    ("Murano Z50 Clásica", "2003-2007", "SUV Mediano Lujo", "nissan_murano_2003_2007", "First generation revolutionary luxury crossover shape."),
    ("Magnite", "2021-2026", "SUV Subcompacto", "nissan_magnite_2021_2026", "Octagonal chrome grille, L-shaped daytime running lights, rugged compact SUV."),
]

tasks = []
current_id = 1

for model, generation, body_type, base_fn, details in nissan_models:
    # 1. Vista Lateral
    lat_fn = f"{base_fn}_lat.png"
    tasks.append(make_prompt(current_id, "Nissan", model, generation, body_type, "Lateral", lat_fn, details))
    current_id += 1

    # 2. Vista Superior (Top-Down)
    top_fn = f"{base_fn}_top.png"
    tasks.append(make_prompt(current_id, "Nissan", model, generation, body_type, "Superior (Top-Down)", top_fn, details))
    current_id += 1

output_data = {
    "brand": "Nissan",
    "total_tasks": len(tasks),
    "total_batches_of_6": (len(tasks) + 5) // 6,
    "tasks": tasks
}

out_path = "scripts/grok_nissan_catalog_prompts.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(output_data, f, indent=2, ensure_ascii=False)

print(f"Catálogo Nissan generado con éxito: {len(tasks)} tareas creadas en {out_path}")
print(f"Total de lotes de 6 imágenes: {output_data['total_batches_of_6']}")
