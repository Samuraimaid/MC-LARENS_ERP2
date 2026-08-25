"""
==============================================================================
MC-LARENS ERP: Generador por Lotes de Catálogo Automotriz HD (2010+)
==============================================================================
Genera las siluetas laterales limpias en 2D ortográfico con fondo transparente
para Toyota, Nissan, Hyundai, Kia, Mitsubishi e Isuzu (modelos 2010 en adelante).
==============================================================================
"""

import json
import os
import re
import sys
import time

try:
    from PIL import Image
    import requests
except ImportError:
    import subprocess
    print("[INFO] Instalando librerías necesarias en Cloud Shell (Pillow, requests)...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "--quiet", "Pillow", "requests"])
    import site
    import importlib
    site.main()
    from PIL import Image
    import requests

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DESCRIPTOR_PATH = os.path.join(BASE_DIR, "frontend", "src", "data", "vehicleDescriptorTypes.json")
OUTPUT_BASE_DIR = os.path.join(BASE_DIR, "frontend", "public", "vehicles", "models")
MANIFEST_PATH = os.path.join(BASE_DIR, "frontend", "src", "data", "vehicle_batch_generation_manifest.json")
PROGRESS_PATH = os.path.join(BASE_DIR, "scripts", "vehicle_batch_progress.json")

TARGET_BRANDS = ["toyota", "nissan", "hyundai", "kia", "mitsubishi", "isuzu"]

def extract_target_models():
    """Extrae todos los modelos únicos 2010+ de las marcas seleccionadas."""
    if not os.path.exists(DESCRIPTOR_PATH):
        print(f"[ERROR] No se encontró {DESCRIPTOR_PATH}")
        return []

    with open(DESCRIPTOR_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    entries = data.get("entries", {})
    models = []
    seen = set()

    for key, val in entries.items():
        brand, desc = key.split("::", 1) if "::" in key else ("", key)
        brand_lower = brand.lower().strip()
        
        if brand_lower not in TARGET_BRANDS:
            continue

        # Extraer años
        match = re.search(r'\[(\d{4})-(?:(\d{4})|Presente)\]', desc, re.IGNORECASE)
        y_start = 2010
        y_end = 2026
        if match:
            y_start = int(match.group(1))
            y_end = int(match.group(2)) if match.group(2) else 2026
            if y_end < 2010:
                continue
        else:
            if not any(str(y) in desc for y in range(2010, 2027)):
                continue

        # Limpiar nombre del modelo
        clean_name = re.sub(r'\[.*?\]|\(.*?\)', '', desc).strip()
        slug = f"{brand_lower}_{re.sub(r'[^a-z0-9]+', '_', clean_name.lower()).strip('_')}_{y_start}_{y_end}"

        if slug in seen:
            continue
        seen.add(slug)

        category = val.get("default_silhouette_slug", "sedan")

        models.append({
            "brand": brand.upper(),
            "brand_slug": brand_lower,
            "raw_descriptor": desc,
            "model_name": clean_name,
            "slug": slug,
            "year_start": y_start,
            "year_end": y_end,
            "category": category,
            "prompt_lateral": (
                f"Exact side view 2D orthographic illustration of a modern white {brand.capitalize()} {clean_name} ({y_start}-{y_end}) {category.replace('_', ' ')} car, "
                f"lateral blueprint style, clean white body, side doors with clearly visible windows, dark grey tinted glass, "
                f"isolated on pure solid white background, vector automotive style, high resolution, no text, no artifacts, no shadows on background"
            )
        })

    print(f"Extracted {len(models)} target vehicle models (2010+) across {len(TARGET_BRANDS)} brands.")
    return models

def flood_fill_transparent(img, threshold=240):
    """Remueve el fondo blanco exterior mediante Flood-Fill sin afectar la pintura blanca del auto."""
    img = img.convert("RGBA")
    w, h = img.size
    visited = set()
    queue = []
    pixels = img.load()

    for x in range(w):
        for y in (0, h - 1):
            r, g, b, _ = pixels[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                queue.append((x, y))
                visited.add((x, y))

    for y in range(h):
        for x in (0, w - 1):
            if (x, y) not in visited:
                r, g, b, _ = pixels[x, y]
                if r >= threshold and g >= threshold and b >= threshold:
                    queue.append((x, y))
                    visited.add((x, y))

    while queue:
        cx, cy = queue.pop(0)
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                r, g, b, _ = pixels[nx, ny]
                if r >= threshold and g >= threshold and b >= threshold:
                    visited.add((nx, ny))
                    queue.append((nx, ny))

    for x, y in visited:
        pixels[x, y] = (255, 255, 255, 0)

    return img

def crop_and_fit(img, target_w=640, target_h=360, padding=16):
    """Recorta el canvas y centra la silueta conservando la relación de aspecto."""
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    max_w = target_w - (padding * 2)
    max_h = target_h - (padding * 2)

    scale = min(max_w / img.width, max_h / img.height)
    new_w = int(img.width * scale)
    new_h = int(img.height * scale)

    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    pos_x = (target_w - new_w) // 2
    pos_y = (target_h - new_h) // 2
    canvas.paste(resized, (pos_x, pos_y), resized)
    return canvas

ACTIVE_VERTEX_MODEL = None

def generate_via_vertex_ai(prompt, project_id=None, location="us-central1"):
    """Genera la imagen usando Vertex AI Imagen conectado a los créditos de Google Cloud."""
    global ACTIVE_VERTEX_MODEL
    import base64
    import io
    import requests
    import subprocess

    token = os.environ.get("GCLOUD_TOKEN")
    if not token:
        try:
            token = subprocess.check_output("gcloud auth print-access-token", shell=True).decode().strip()
        except Exception:
            token = None

    if not project_id:
        project_id = os.environ.get("PROJECT_ID")
        if not project_id:
            try:
                project_id = subprocess.check_output("gcloud config get-value project", shell=True).decode().strip()
            except Exception:
                project_id = "gen-lang-client-0971793042"

    if token:
        candidate_models = [ACTIVE_VERTEX_MODEL] if ACTIVE_VERTEX_MODEL else [
            "imagen-3.0-generate-001",
            "imagegeneration@006",
            "imagen-3.0-fast-generate-001",
            "imagegeneration@005",
            "imagen-3.0-generate-002",
        ]

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "instances": [{"prompt": prompt}],
            "parameters": {
                "sampleCount": 1,
                "aspectRatio": "16:9",
                "outputOptions": {"mimeType": "image/jpeg"}
            }
        }

        last_error = ""
        for model_id in candidate_models:
            if not model_id:
                continue
            url = f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/publishers/google/models/{model_id}:predict"
            resp = requests.post(url, headers=headers, json=payload, timeout=60)
            if resp.status_code == 200:
                ACTIVE_VERTEX_MODEL = model_id
                data = resp.json()
                b64 = data["predictions"][0]["bytesBase64Encoded"]
                return Image.open(io.BytesIO(base64.b64decode(b64)))
            else:
                last_error = f"{model_id} ({resp.status_code}): {resp.text}"

        raise Exception(f"Vertex AI Error: {last_error}")

    # Fallback a AI Studio API Key si existe
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if api_key:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key={api_key}"
        payload = {
            "instances": [{"prompt": prompt}],
            "parameters": {
                "sampleCount": 1,
                "aspectRatio": "16:9",
                "outputOptions": {"mimeType": "image/jpeg"}
            }
        }
        resp = requests.post(url, json=payload, timeout=45)
        if resp.status_code == 200:
            data = resp.json()
            b64 = data["predictions"][0]["bytesBase64Encoded"]
            return Image.open(io.BytesIO(base64.b64decode(b64)))
        else:
            raise Exception(f"AI Studio Error {resp.status_code}: {resp.text}")

    raise Exception("No se encontró token de autenticación de Google Cloud ni API Key.")

def main():
    models = extract_target_models()
    
    # Guardar manifiesto oficial
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump({"total_models": len(models), "models": models}, f, indent=2, ensure_ascii=False)
    print(f"[OK] Manifiesto de modelos guardado en: {MANIFEST_PATH}")

    # Cargar progreso previo
    progress = {}
    if os.path.exists(PROGRESS_PATH):
        with open(PROGRESS_PATH, "r", encoding="utf-8") as f:
            progress = json.load(f)

    print(f"[INFO] Progreso actual: {len(progress)}/{len(models)} vehículos generados.")

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    limit = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else None

    if limit:
        print(f"[INFO] Modo Limitado: Procesando {limit} vehículos.")

    processed = 0
    for idx, m in enumerate(models):
        if limit and processed >= limit:
            break

        slug = m["slug"]
        out_dir = os.path.join(OUTPUT_BASE_DIR, m["brand_slug"])
        out_path = os.path.join(out_dir, f"{slug}_lat.png")

        if slug in progress and os.path.exists(out_path):
            continue

        print(f"\n[{idx+1}/{len(models)}] Generando: {m['brand']} {m['model_name']} ({m['year_start']}-{m['year_end']})...")
        
        try:
            raw_img = generate_via_vertex_ai(m["prompt_lateral"])
            trans_img = flood_fill_transparent(raw_img)
            final_img = crop_and_fit(trans_img, 640, 360)
            os.makedirs(out_dir, exist_ok=True)
            final_img.save(out_path, "PNG", optimize=True)
            
            progress[slug] = {
                "status": "completed",
                "file": out_path,
                "timestamp": time.time()
            }
            with open(PROGRESS_PATH, "w", encoding="utf-8") as f:
                json.dump(progress, f, indent=2)
                
            print(f"  [SAVED] {out_path}")
            processed += 1

            # Sincronizar progreso en vivo a la nube para monitoreo móvil
            try:
                import requests
                requests.post(
                    "https://mclarens-erp-836176703716.us-central1.run.app/api/vehicles/batch-progress-sync",
                    json={
                        "total": len(models),
                        "completed": len(progress),
                        "current_model": f"{m['brand']} {m['model_name']} ({m['year_start']}-{m['year_end']})",
                        "status": "running"
                    },
                    timeout=5
                )
            except Exception:
                pass

            time.sleep(2) # Respetar rate limits
        except Exception as e:
            print(f"  [ERROR] Falló generación de {slug}: {e}")
            time.sleep(1)

    print("\n============================================================")
    print("PROCESO DE LOTE COMPLETADO / PAUSADO CON ÉXITO")
    print(f"Progreso Total: {len(progress)}/{len(models)}")
    print("============================================================")

if __name__ == "__main__":
    main()
