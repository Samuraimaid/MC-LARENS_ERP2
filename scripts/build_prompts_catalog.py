"""
Script para generar el Catálogo Maestro de Prompts en JSON y Markdown
para los 260 vehículos del parque automotriz de Nicaragua.
"""
import json
import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MANIFEST_PATH = os.path.join(BASE_DIR, "frontend", "src", "data", "vehicle_batch_generation_manifest.json")
JSON_OUT_PATH = os.path.join(BASE_DIR, "frontend", "src", "data", "vehicle_prompts_catalog.json")
MD_OUT_PATH = os.path.join(BASE_DIR, "VEHICLE_PROMPTS_CATALOG.md")

with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

models = data.get("models", [])

prompts_catalog = {
    "total_vehicles": len(models),
    "total_images": len(models) * 2,
    "description": "Catálogo maestro de prompts para siluetas automotrices 3/4 HD (Frontal y Trasera) para MC-LARENS ERP",
    "brands": ["TOYOTA", "NISSAN", "HYUNDAI", "KIA", "MITSUBISHI", "ISUZU"],
    "items": []
}

md_lines = [
    "# 🚗 Catálogo Maestro de Prompts Automotrices — MC-LARENS ERP",
    "",
    "Este catálogo contiene los **prompts calibrados** para generar siluetas en **3 ángulos (Frontal 3/4, Trasera 3/4 y Lateral)** para los **260 modelos** de las 6 marcas principales en Nicaragua (**Toyota, Nissan, Hyundai, Kia, Mitsubishi, Isuzu**).",
    "",
    f"- **Total de Modelos:** `{len(models)} vehículos`",
    f"- **Vistas por Modelo:** `Frontal 3/4` (Parabrisas + Laterales) y `Trasera 3/4` (Medallón + Laterales)",
    f"- **Total de Vistas 3/4:** `{len(models) * 2} imágenes`",
    f"- **Resolución y Formato:** `640x480 PNG` con fondo transparente (*RGBA*)",
    "",
    "---",
    ""
]

current_brand = ""
for m in models:
    brand = m["brand"]
    brand_slug = m["brand_slug"]
    model_name = m["model_name"]
    years = f"{m['year_start']}-{m['year_end']}"
    category = m.get("category", "car")
    slug = m["slug"]

    p_front = (
        f"Front 3/4 three-quarter perspective studio 3D render of ONE single modern white "
        f"{brand} {model_name} ({years}) {category}, exact front-left angle view, clearly showing front windshield "
        f"and side windows, dark grey tinted glass, clean white body, studio lighting, isolated on seamless pure solid "
        f"white background, high resolution cutout photograph, no floor shadow, no wall, no dark background, no reflections, single car only"
    )
    p_rear = (
        f"Rear 3/4 three-quarter perspective studio 3D render of ONE single modern white "
        f"{brand} {model_name} ({years}) {category}, exact rear-left angle view, clearly showing rear back window "
        f"and rear side windows, dark grey tinted glass, clean white body, studio lighting, isolated on seamless pure solid "
        f"white background, high resolution cutout photograph, no floor shadow, no wall, no dark background, no reflections, single car only"
    )
    p_lat = (
        f"Exact side view 2D orthographic lateral profile illustration of ONE single modern white "
        f"{brand} {model_name} ({years}) {category}, clean white body, side doors with clearly visible windows, "
        f"dark grey tinted glass, isolated on solid pure white background, vector automotive style, high resolution, "
        f"no text, no artifacts, no shadows on background"
    )

    item = {
        "brand": brand,
        "brand_slug": brand_slug,
        "model_name": model_name,
        "years": years,
        "category": category,
        "slug": slug,
        "files": {
            "front_3q": f"frontend/public/vehicles/models/{brand_slug}/{slug}_front_3q.png",
            "rear_3q": f"frontend/public/vehicles/models/{brand_slug}/{slug}_rear_3q.png",
            "lateral": f"frontend/public/vehicles/models/{brand_slug}/{slug}_lat.png"
        },
        "prompts": {
            "front_3q": p_front,
            "rear_3q": p_rear,
            "lateral": p_lat
        }
    }
    prompts_catalog["items"].append(item)

    if brand != current_brand:
        current_brand = brand
        md_lines.append(f"## 🏷️ Marca: {brand}")
        md_lines.append("")

    md_lines.append(f"### 🚙 {brand} {model_name} ({years})")
    md_lines.append(f"- **Slug:** `{slug}`")
    md_lines.append(f"- **Categoría:** `{category.upper()}`")
    md_lines.append(f"- **Archivos de salida:**")
    md_lines.append(f"  - 🟢 Frontal 3/4: `frontend/public/vehicles/models/{brand_slug}/{slug}_front_3q.png`")
    md_lines.append(f"  - 🔵 Trasera 3/4: `frontend/public/vehicles/models/{brand_slug}/{slug}_rear_3q.png`")
    md_lines.append(f"  - ⚪ Lateral: `frontend/public/vehicles/models/{brand_slug}/{slug}_lat.png`")
    md_lines.append("")
    md_lines.append("**Prompt Frontal 3/4:**")
    md_lines.append(f"```text\n{p_front}\n```")
    md_lines.append("")
    md_lines.append("**Prompt Trasero 3/4:**")
    md_lines.append(f"```text\n{p_rear}\n```")
    md_lines.append("")
    md_lines.append("---")
    md_lines.append("")

with open(JSON_OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(prompts_catalog, f, indent=2, ensure_ascii=False)
print(f"[OK] JSON generado con éxito: {JSON_OUT_PATH}")

with open(MD_OUT_PATH, "w", encoding="utf-8") as f:
    f.write("\n".join(md_lines))
print(f"[OK] Markdown generado con éxito: {MD_OUT_PATH}")
