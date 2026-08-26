import json
import os

catalog = {
  "project": "MC-LARENS ERP Automotriz",
  "title": "Catálogo Maestro de Prompts para Grok (Toyota Completo 2000-2026)",
  "instructions_for_ai": "Genera siluetas automotrices técnicas en 2D puro con estilo dibujo técnico / plano esquemático vectorial. Es INDISPENSABLE: 1) Carrocería completamente blanca con líneas de contorno negras gruesas y nítidas. 2) Cristales de ventanas tintados en gris oscuro neutro uniforme. 3) Faros delanteros coloreados en AZUL CELESTE / CYAN BRILLANTE (#00E5FF). 4) Faros traseros coloreados en ROJO VIVO (#FF0033). 5) Fondo blanco puro sólido (#FFFFFF) sin sombras, sin piso, sin perspectiva 3D, sin reflejos, sin texto.",
  "visual_specifications": {
    "style": "2D Orthographic Vector Technical Drawing / Blueprint Schematic",
    "background": "Solid Pure White #FFFFFF (No shadows, No floor, No 3D perspective)",
    "car_body_color": "Solid Pure White with crisp black vector outlines",
    "window_tint": "Uniform dark grey #4A4A4A with crisp black pillar dividers",
    "front_headlight_color": "Bright Light Cyan Blue #00E5FF",
    "rear_taillight_color": "Bright Vivid Red #FF0033",
    "aspect_ratios": {
      "lateral_view": "16:9 or 3:2 (Landscape)",
      "top_down_view": "9:16 or 2:3 (Vertical Orientation - Front hood facing UP, Rear trunk/bed facing DOWN)"
    }
  },
  "tasks": []
}

raw_tasks = [
    # 1. HILUX 2021-2026
    ("Hilux", "2021-2026", "Extra Cab (Cabina y Media)", "Lateral", "toyota_hilux_extra_cab_2021_2026_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Hilux (2021-2026) extra cab smart cab pickup truck, front door and small rear access quarter window, medium cargo bed, exact true 90-degree side profile view, orthogonal lateral drawing, crisp clean solid black line art outlines, solid pure white car body, windows tinted in uniform neutral dark grey, front headlight explicitly colored in bright cyan blue (#00E5FF), rear taillight explicitly colored in bright vivid red (#FF0033), isolated on pure solid white background, flat 2D schematic, no perspective, no shadows, no text, no watermark"),
    ("Hilux", "2021-2026", "Extra Cab (Cabina y Media)", "Superior (Top-Down)", "toyota_hilux_extra_cab_2021_2026_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Hilux (2021-2026) extra cab smart cab pickup truck, medium cabin length, open cargo bed at bottom, exact true 90-degree top-down bird's-eye view, strict vertical orientation with front hood facing top, crisp clean solid black line art outlines, solid pure white body, front headlights at top in bright cyan blue (#00E5FF), rear taillights at bottom in bright vivid red (#FF0033), isolated on pure solid white background, flat 2D schematic, no shadows, no text, no watermark"),
    ("Hilux", "2021-2026", "1 Cabina (Single Cab / Sencilla)", "Superior (Top-Down)", "toyota_hilux_single_cab_2021_2026_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Hilux (2021-2026) single cab pickup truck, short 2 doors regular cabin, long open cargo bed at bottom, exact true 90-degree top-down bird's-eye view, strict vertical orientation with front hood facing top, crisp clean solid black line art outlines, solid pure white body, front headlights at top in bright cyan blue (#00E5FF), rear taillights at bottom in bright vivid red (#FF0033), isolated on pure solid white background, flat 2D schematic, no shadows, no text, no watermark"),

    # 2. HILUX 2016-2020
    ("Hilux", "2016-2020", "1 Cabina (Single Cab)", "Lateral", "toyota_hilux_single_cab_2016_2020_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Hilux (2016-2020) single cab pickup truck, 2 doors regular cab, long cargo bed, exact true 90-degree lateral side view, orthogonal drawing, crisp clean solid black line art outlines, solid pure white car body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), windows tinted dark grey, isolated on pure solid white background, flat 2D schematic, no shadows, no text"),
    ("Hilux", "2016-2020", "1 Cabina (Single Cab)", "Superior (Top-Down)", "toyota_hilux_single_cab_2016_2020_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Hilux (2016-2020) single cab pickup truck, 2 doors short cabin, long open cargo bed at bottom, exact true 90-degree bird's-eye view, vertical orientation, front hood facing top, crisp clean black line art outlines, solid white car body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hilux", "2016-2020", "Extra Cab (Cabina y Media)", "Lateral", "toyota_hilux_extra_cab_2016_2020_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Hilux (2016-2020) extra cab smart cab pickup truck, front door and rear quarter window, medium cargo bed, exact true 90-degree lateral side view, crisp clean solid black line art outlines, solid pure white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hilux", "2016-2020", "Extra Cab (Cabina y Media)", "Superior (Top-Down)", "toyota_hilux_extra_cab_2016_2020_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Hilux (2016-2020) extra cab smart cab pickup truck, medium cabin length, cargo bed at bottom, vertical orientation with front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),

    # 3. HILUX 2012-2015 (Vigo Champ)
    ("Hilux", "2012-2015", "Doble Cabina (Double Cab)", "Superior (Top-Down)", "toyota_hilux_2012_2015_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2012-2015) Vigo Champ double cab pickup truck, hood with scoop facing top, 4 doors cabin, open cargo bed at bottom, exact true 90-degree bird's-eye view, vertical orientation, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hilux", "2012-2015", "1 Cabina (Single Cab)", "Lateral", "toyota_hilux_single_cab_2012_2015_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2012-2015) Vigo Champ single cab pickup truck, 2 doors regular cab, long cargo bed, hood scoop, exact true 90-degree lateral side view, crisp black line art outlines, solid white car body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hilux", "2012-2015", "1 Cabina (Single Cab)", "Superior (Top-Down)", "toyota_hilux_single_cab_2012_2015_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2012-2015) Vigo Champ single cab pickup truck, short cabin, long cargo bed at bottom, vertical orientation with front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hilux", "2012-2015", "Extra Cab (Cabina y Media)", "Lateral", "toyota_hilux_extra_cab_2012_2015_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2012-2015) Vigo Champ extra cab pickup truck, front door and rear quarter window, medium cargo bed, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hilux", "2012-2015", "Extra Cab (Cabina y Media)", "Superior (Top-Down)", "toyota_hilux_extra_cab_2012_2015_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2012-2015) Vigo Champ extra cab pickup truck, vertical orientation, front hood with scoop facing top, cargo bed at bottom, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),

    # 4. HILUX 2005-2011 (Vigo Gen 1)
    ("Hilux", "2005-2011", "Doble Cabina (Double Cab)", "Lateral", "toyota_hilux_2005_2011_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2005-2011) Vigo double cab pickup truck, 4 doors, standard cargo bed, exact true 90-degree lateral side view, crisp black line art outlines, solid white car body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), windows tinted dark grey, isolated on pure solid white background, no shadows, no text"),
    ("Hilux", "2005-2011", "Doble Cabina (Double Cab)", "Superior (Top-Down)", "toyota_hilux_2005_2011_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2005-2011) Vigo double cab pickup truck, 4 doors cabin, open cargo bed at bottom, vertical orientation with front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hilux", "2005-2011", "1 Cabina (Single Cab)", "Lateral", "toyota_hilux_single_cab_2005_2011_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2005-2011) Vigo single cab pickup truck, 2 doors regular cab, long cargo bed, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hilux", "2005-2011", "1 Cabina (Single Cab)", "Superior (Top-Down)", "toyota_hilux_single_cab_2005_2011_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2005-2011) Vigo single cab pickup truck, 2 doors short cabin, long cargo bed at bottom, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hilux", "2005-2011", "Extra Cab (Cabina y Media)", "Lateral", "toyota_hilux_extra_cab_2005_2011_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2005-2011) Vigo extra cab pickup truck, front door and rear access quarter window, medium cargo bed, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hilux", "2005-2011", "Extra Cab (Cabina y Media)", "Superior (Top-Down)", "toyota_hilux_extra_cab_2005_2011_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2005-2011) Vigo extra cab pickup truck, vertical orientation, front hood facing top, cargo bed at bottom, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),

    # 5. HILUX 2000-2004 (Tiger)
    ("Hilux", "2000-2004", "Doble Cabina (Double Cab)", "Lateral", "toyota_hilux_2000_2004_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2000-2004) Tiger double cab pickup truck, 4 doors, exact true 90-degree lateral side view, crisp black line art outlines, solid white car body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hilux", "2000-2004", "Doble Cabina (Double Cab)", "Superior (Top-Down)", "toyota_hilux_2000_2004_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2000-2004) Tiger double cab pickup truck, vertical orientation, front hood facing top, cargo bed at bottom, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hilux", "2000-2004", "1 Cabina (Single Cab)", "Lateral", "toyota_hilux_single_cab_2000_2004_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2000-2004) Tiger single cab pickup truck, 2 doors regular cab, long cargo bed, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hilux", "2000-2004", "1 Cabina (Single Cab)", "Superior (Top-Down)", "toyota_hilux_single_cab_2000_2004_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2000-2004) Tiger single cab pickup truck, vertical orientation, front hood facing top, long cargo bed at bottom, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hilux", "2000-2004", "Extra Cab (Cabina y Media)", "Lateral", "toyota_hilux_extra_cab_2000_2004_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2000-2004) Tiger extra cab pickup truck, front door and small rear quarter window, medium cargo bed, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hilux", "2000-2004", "Extra Cab (Cabina y Media)", "Superior (Top-Down)", "toyota_hilux_extra_cab_2000_2004_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hilux (2000-2004) Tiger extra cab pickup truck, vertical orientation, front hood facing top, cargo bed at bottom, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),

    # 6. TOYOTA COROLLA CROSS (2020-2026)
    ("Corolla Cross", "2020-2026", "SUV Crossover", "Lateral", "toyota_corolla_cross_2020_2026_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Corolla Cross (2020-2026) compact SUV crossover, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, windows tinted dark grey, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Corolla Cross", "2020-2026", "SUV Crossover", "Superior (Top-Down)", "toyota_corolla_cross_2020_2026_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Corolla Cross (2020-2026) SUV crossover, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),

    # 7. TOYOTA YARIS (Sedan & Hatchback 2000-2026)
    ("Yaris Sedan", "2023-2026", "Sedan", "Lateral", "toyota_yaris_sedan_2023_2026_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Yaris (2023-2026) sedan, fastback sedan profile, exact true 90-degree side profile view, orthogonal lateral drawing, crisp clean solid black line art outlines, solid pure white car body, windows tinted in uniform neutral dark grey, front headlight explicitly colored in bright cyan blue (#00E5FF), rear taillight explicitly colored in bright vivid red (#FF0033), isolated on pure solid white background, flat 2D schematic, no shadows, no text"),
    ("Yaris Sedan", "2023-2026", "Sedan", "Superior (Top-Down)", "toyota_yaris_sedan_2023_2026_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Yaris (2023-2026) sedan, exact true 90-degree top-down bird's-eye view, strict vertical orientation with front hood facing top, crisp clean solid black line art outlines, solid pure white body, front windshield and rear glass in dark grey, front headlights at top in bright cyan blue (#00E5FF), rear taillights at bottom in bright vivid red (#FF0033), isolated on pure solid white background, flat 2D schematic, no shadows, no text"),
    ("Yaris Hatchback", "2020-2026", "Hatchback (XP210)", "Lateral", "toyota_yaris_hatchback_2020_2026_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Yaris (2020-2026) hatchback XP210, compact 5 doors hatchback profile, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Yaris Hatchback", "2020-2026", "Hatchback (XP210)", "Superior (Top-Down)", "toyota_yaris_hatchback_2020_2026_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Yaris (2020-2026) hatchback XP210, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Yaris Sedan", "2018-2022", "Sedan (XP150 Facelift)", "Lateral", "toyota_yaris_sedan_2018_2022_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Yaris (2018-2022) sedan, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), windows tinted dark grey, isolated on pure solid white background, no shadows, no text"),
    ("Yaris Sedan", "2018-2022", "Sedan (XP150 Facelift)", "Superior (Top-Down)", "toyota_yaris_sedan_2018_2022_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Yaris (2018-2022) sedan, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Yaris Hatchback", "2014-2019", "Hatchback (XP150)", "Lateral", "toyota_yaris_hatchback_2014_2019_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a white Toyota Yaris (2014-2019) hatchback, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Yaris Hatchback", "2014-2019", "Hatchback (XP150)", "Superior (Top-Down)", "toyota_yaris_hatchback_2014_2019_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a white Toyota Yaris (2014-2019) hatchback, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Yaris Sedan", "2014-2017", "Sedan (XP150)", "Lateral", "toyota_yaris_sedan_2014_2017_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a white Toyota Yaris (2014-2017) sedan, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), windows tinted dark grey, isolated on pure solid white background, no shadows, no text"),
    ("Yaris Sedan", "2014-2017", "Sedan (XP150)", "Superior (Top-Down)", "toyota_yaris_sedan_2014_2017_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a white Toyota Yaris (2014-2017) sedan, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Yaris Belta Sedan", "2006-2013", "Sedan (XP90)", "Lateral", "toyota_yaris_sedan_2006_2013_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Yaris (2006-2013) Belta sedan, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Yaris Belta Sedan", "2006-2013", "Sedan (XP90)", "Superior (Top-Down)", "toyota_yaris_sedan_2006_2013_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Yaris (2006-2013) Belta sedan, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Yaris Hatchback", "2006-2013", "Hatchback (XP90)", "Lateral", "toyota_yaris_hatchback_2006_2013_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Yaris (2006-2013) hatchback, 5 doors, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Yaris Hatchback", "2006-2013", "Hatchback (XP90)", "Superior (Top-Down)", "toyota_yaris_hatchback_2006_2013_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Yaris (2006-2013) hatchback, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Yaris Echo Sedan", "2000-2005", "Sedan (XP10)", "Lateral", "toyota_yaris_sedan_2000_2005_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Yaris Echo (2000-2005) sedan, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Yaris Echo Sedan", "2000-2005", "Sedan (XP10)", "Superior (Top-Down)", "toyota_yaris_sedan_2000_2005_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Yaris Echo (2000-2005) sedan, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Yaris Echo Hatchback", "2000-2005", "Hatchback (XP10)", "Lateral", "toyota_yaris_hatchback_2000_2005_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Yaris Vitz Echo (2000-2005) hatchback, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Yaris Echo Hatchback", "2000-2005", "Hatchback (XP10)", "Superior (Top-Down)", "toyota_yaris_hatchback_2000_2005_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Yaris Vitz Echo (2000-2005) hatchback, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),

    # 8. TOYOTA RAV4 (2000-2026)
    ("RAV4", "2019-2026", "SUV (XA50)", "Lateral", "toyota_rav4_2019_2026_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota RAV4 (2019-2026) SUV, rugged geometric SUV profile, exact true 90-degree side profile view, crisp clean solid black line art outlines, solid pure white body, windows tinted in dark grey, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, flat 2D schematic, no shadows, no text"),
    ("RAV4", "2019-2026", "SUV (XA50)", "Superior (Top-Down)", "toyota_rav4_2019_2026_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota RAV4 (2019-2026) SUV, exact true 90-degree top-down bird's-eye view, vertical orientation with front hood facing top, crisp clean solid black line art outlines, solid pure white body, front headlights at top in bright cyan blue (#00E5FF), rear taillights at bottom in bright vivid red (#FF0033), isolated on pure solid white background, flat 2D schematic, no shadows, no text"),
    ("RAV4", "2013-2018", "SUV (XA40)", "Lateral", "toyota_rav4_2013_2018_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota RAV4 (2013-2018) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("RAV4", "2013-2018", "SUV (XA40)", "Superior (Top-Down)", "toyota_rav4_2013_2018_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota RAV4 (2013-2018) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("RAV4", "2006-2012", "SUV (XA30)", "Lateral", "toyota_rav4_2006_2012_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota RAV4 (2006-2012) SUV with spare wheel on rear door, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("RAV4", "2006-2012", "SUV (XA30)", "Superior (Top-Down)", "toyota_rav4_2006_2012_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota RAV4 (2006-2012) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("RAV4", "2000-2005", "SUV (XA20)", "Lateral", "toyota_rav4_2000_2005_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota RAV4 (2000-2005) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("RAV4", "2000-2005", "SUV (XA20)", "Superior (Top-Down)", "toyota_rav4_2000_2005_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota RAV4 (2000-2005) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),

    # 9. TOYOTA LAND CRUISER PRADO (J90 a J250)
    ("Land Cruiser Prado", "2024-2026 (J250)", "SUV 4x4", "Lateral", "toyota_prado_2024_2026_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Land Cruiser Prado J250 (2024-2026) SUV, boxy 4x4 profile, exact true 90-degree side profile view, crisp clean solid black line art outlines, solid pure white body, windows tinted dark grey, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, flat 2D schematic, no shadows, no text"),
    ("Land Cruiser Prado", "2024-2026 (J250)", "SUV 4x4", "Superior (Top-Down)", "toyota_prado_2024_2026_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Land Cruiser Prado J250 (2024-2026) SUV, exact true 90-degree top-down bird's-eye view, vertical orientation with front hood facing top, crisp clean solid black line art outlines, solid pure white body, front headlights at top in bright cyan blue (#00E5FF), rear taillights at bottom in bright vivid red (#FF0033), isolated on pure solid white background, flat 2D schematic, no shadows, no text"),
    ("Land Cruiser Prado", "2018-2023 (J150 Facelift)", "SUV 4x4", "Lateral", "toyota_prado_2018_2023_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Land Cruiser Prado (2018-2023) J150 facelift SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Land Cruiser Prado", "2018-2023 (J150 Facelift)", "SUV 4x4", "Superior (Top-Down)", "toyota_prado_2018_2023_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Land Cruiser Prado (2018-2023) J150 SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Land Cruiser Prado", "2010-2017 (J150)", "SUV 4x4", "Lateral", "toyota_prado_2010_2017_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a white Toyota Land Cruiser Prado (2010-2017) J150 SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Land Cruiser Prado", "2010-2017 (J150)", "SUV 4x4", "Superior (Top-Down)", "toyota_prado_2010_2017_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a white Toyota Land Cruiser Prado (2010-2017) J150 SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Land Cruiser Prado", "2003-2009 (J120)", "SUV 4x4", "Lateral", "toyota_prado_2003_2009_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Land Cruiser Prado (2003-2009) J120 SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Land Cruiser Prado", "2003-2009 (J120)", "SUV 4x4", "Superior (Top-Down)", "toyota_prado_2003_2009_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Land Cruiser Prado (2003-2009) J120 SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Land Cruiser Prado", "2000-2002 (J90)", "SUV 4x4", "Lateral", "toyota_prado_2000_2002_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Land Cruiser Prado (2000-2002) J90 SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Land Cruiser Prado", "2000-2002 (J90)", "SUV 4x4", "Superior (Top-Down)", "toyota_prado_2000_2002_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Land Cruiser Prado (2000-2002) J90 SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),

    # 10. TOYOTA FORTUNER (2005-2026)
    ("Fortuner", "2021-2026", "SUV 4x4", "Lateral", "toyota_fortuner_2021_2026_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Fortuner (2021-2026) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), windows tinted dark grey, isolated on pure solid white background, no shadows, no text"),
    ("Fortuner", "2021-2026", "SUV 4x4", "Superior (Top-Down)", "toyota_fortuner_2021_2026_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Fortuner (2021-2026) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Fortuner", "2016-2020", "SUV 4x4", "Lateral", "toyota_fortuner_2016_2020_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Fortuner (2016-2020) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Fortuner", "2016-2020", "SUV 4x4", "Superior (Top-Down)", "toyota_fortuner_2016_2020_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Fortuner (2016-2020) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Fortuner", "2005-2015", "SUV 4x4", "Lateral", "toyota_fortuner_2005_2015_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Fortuner (2005-2015) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Fortuner", "2005-2015", "SUV 4x4", "Superior (Top-Down)", "toyota_fortuner_2005_2015_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Fortuner (2005-2015) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),

    # 11. LAND CRUISER 70 / 79 PICKUP & WAGON
    ("Land Cruiser 79", "Pick-up", "1 Cabina (Single Cab)", "Lateral", "toyota_land_cruiser_79_single_cab_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Land Cruiser 79 Series single cab pickup truck, snorkel, heavy duty 4x4, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Land Cruiser 79", "Pick-up", "1 Cabina (Single Cab)", "Superior (Top-Down)", "toyota_land_cruiser_79_single_cab_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Land Cruiser 79 Series single cab pickup truck, vertical orientation, front hood facing top, cargo bed at bottom, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Land Cruiser 79", "Pick-up", "Doble Cabina (Double Cab)", "Lateral", "toyota_land_cruiser_79_double_cab_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Land Cruiser 79 Series double cab pickup truck, 4 doors, heavy duty 4x4, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Land Cruiser 79", "Pick-up", "Doble Cabina (Double Cab)", "Superior (Top-Down)", "toyota_land_cruiser_79_double_cab_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Land Cruiser 79 Series double cab pickup truck, vertical orientation, front hood facing top, cargo bed at bottom, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),

    # 12. LAND CRUISER 300 & 200 & 100
    ("Land Cruiser 300", "2022-2026", "Luxury SUV", "Lateral", "toyota_land_cruiser_300_2022_2026_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Land Cruiser 300 (2022-2026) luxury full-size SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Land Cruiser 300", "2022-2026", "Luxury SUV", "Superior (Top-Down)", "toyota_land_cruiser_300_2022_2026_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Land Cruiser 300 (2022-2026) luxury SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Land Cruiser 200", "2008-2021", "Luxury SUV", "Lateral", "toyota_land_cruiser_200_2008_2021_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Land Cruiser 200 (2008-2021) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Land Cruiser 200", "2008-2021", "Luxury SUV", "Superior (Top-Down)", "toyota_land_cruiser_200_2008_2021_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Land Cruiser 200 (2008-2021) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Land Cruiser 100", "2000-2007", "Luxury SUV", "Lateral", "toyota_land_cruiser_100_2000_2007_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Land Cruiser 100 (2000-2007) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Land Cruiser 100", "2000-2007", "Luxury SUV", "Superior (Top-Down)", "toyota_land_cruiser_100_2000_2007_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Land Cruiser 100 (2000-2007) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),

    # 13. 4RUNNER (2000-2026)
    ("4Runner", "2014-2024", "SUV (N280 Facelift)", "Lateral", "toyota_4runner_2014_2024_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota 4Runner (2014-2024) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("4Runner", "2014-2024", "SUV (N280 Facelift)", "Superior (Top-Down)", "toyota_4runner_2014_2024_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota 4Runner (2014-2024) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("4Runner", "2010-2013", "SUV (N280 Gen 5)", "Lateral", "toyota_4runner_2010_2013_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a white Toyota 4Runner (2010-2013) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("4Runner", "2010-2013", "SUV (N280 Gen 5)", "Superior (Top-Down)", "toyota_4runner_2010_2013_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a white Toyota 4Runner (2010-2013) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("4Runner", "2003-2009", "SUV (N210 Gen 4)", "Lateral", "toyota_4runner_2003_2009_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota 4Runner (2003-2009) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("4Runner", "2003-2009", "SUV (N210 Gen 4)", "Superior (Top-Down)", "toyota_4runner_2003_2009_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota 4Runner (2003-2009) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),

    # 14. CROSSOVERS & COMPACTS (Raize, Rush, Avanza, Agya)
    ("Raize", "2020-2026", "Compact Crossover", "Lateral", "toyota_raize_2020_2026_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Raize (2020-2026) compact crossover SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Raize", "2020-2026", "Compact Crossover", "Superior (Top-Down)", "toyota_raize_2020_2026_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Raize (2020-2026) compact crossover SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Rush", "2018-2026", "7-Seater SUV", "Lateral", "toyota_rush_2018_2026_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Rush (2018-2026) 7-seater SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Rush", "2018-2026", "7-Seater SUV", "Superior (Top-Down)", "toyota_rush_2018_2026_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Rush (2018-2026) 7-seater SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Avanza", "2022-2026", "MPV Minivan", "Lateral", "toyota_avanza_2022_2026_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Avanza (2022-2026) MPV family van, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Avanza", "2022-2026", "MPV Minivan", "Superior (Top-Down)", "toyota_avanza_2022_2026_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Avanza (2022-2026) MPV family van, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Agya", "2014-2026", "City Hatchback", "Lateral", "toyota_agya_2014_2026_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Agya (2014-2026) compact hatchback, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Agya", "2014-2026", "City Hatchback", "Superior (Top-Down)", "toyota_agya_2014_2026_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Agya (2014-2026) compact hatchback, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),

    # 15. HIACE & COASTER (Vans & Busses)
    ("Hiace Commuter", "2019-2026", "Passenger Van (H300)", "Lateral", "toyota_hiace_commuter_2019_2026_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Hiace Commuter H300 (2019-2026) passenger van, semi-bonnet profile, large side windows, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hiace Commuter", "2019-2026", "Passenger Van (H300)", "Superior (Top-Down)", "toyota_hiace_commuter_2019_2026_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a modern white Toyota Hiace Commuter H300 (2019-2026) passenger van, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hiace Standard", "2005-2018", "Minibus Van (H200)", "Lateral", "toyota_hiace_2005_2018_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hiace H200 (2005-2018) flat-nose passenger van, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Hiace Standard", "2005-2018", "Minibus Van (H200)", "Superior (Top-Down)", "toyota_hiace_2005_2018_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Hiace H200 (2005-2018) flat-nose passenger van, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Coaster", "2000-2026", "Minibus Bus", "Lateral", "toyota_coaster_minibus_lat.png", "16:9",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Coaster 30-passenger minibus bus, side passenger door and long row of side windows, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright cyan blue (#00E5FF), rear taillight in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text"),
    ("Coaster", "2000-2026", "Minibus Bus", "Superior (Top-Down)", "toyota_coaster_minibus_top.png", "9:16",
     "Clean 2D vector technical blueprint illustration of a classic white Toyota Coaster minibus bus, long rectangular roof with emergency hatches, vertical orientation with front windshield facing top, crisp black line art outlines, solid white body, front headlights in bright cyan blue (#00E5FF), rear taillights in bright vivid red (#FF0033), isolated on pure solid white background, no shadows, no text")
]

for idx, (model, gen, cab, view, fname, ar, prompt) in enumerate(raw_tasks, 1):
    catalog["tasks"].append({
        "id": idx,
        "brand": "Toyota",
        "model": model,
        "generation": gen,
        "cab_variant": cab,
        "view": view,
        "filename": fname,
        "aspect_ratio": ar,
        "prompt": prompt
    })

out_path = os.path.join(os.path.dirname(__file__), "grok_toyota_catalog_prompts.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(catalog, f, indent=2, ensure_ascii=False)

print(f"[OK] Catalogo Grok actualizado con exito: {len(catalog['tasks'])} tareas en total.")
