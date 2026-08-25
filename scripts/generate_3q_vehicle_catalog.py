#!/usr/bin/env python3
"""
MC-LARENS ERP - Generador de Catálogo de Siluetas 3/4 (Front + Rear)
Ejecutable 100% en Windows PowerShell de forma autónoma e independiente.

Genera para cada modelo:
  - Vista Frontal 3/4: Parabrisas delantero + Laterales delanteros/traseros
  - Vista Trasera 3/4: Vidrio trasero (medallón) + Laterales traseros/delanteros

Aplica Flood-Fill para transparencia limpia sin afectar la carrocería blanca.
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request
import io

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

try:
    from PIL import Image
except ImportError:
    import subprocess
    print("[INFO] Instalando Pillow para procesamiento de imágenes...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "Pillow"])
    from PIL import Image

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CATALOG_PATH = os.path.join(BASE_DIR, "frontend", "src", "data", "vehicle_prompts_catalog.json")
PROGRESS_PATH = os.path.join(BASE_DIR, "scripts", "vehicle_3q_progress.json")
OUTPUT_BASE_DIR = os.path.join(BASE_DIR, "frontend", "public", "vehicles", "models")


def flood_fill_transparent(img, threshold=242):
    """Convierte el fondo blanco externo en transparente protegiendo la carrocería."""
    img = img.convert("RGBA")
    w, h = img.size
    visited = set()
    queue = []
    pixels = img.load()

    # Borde superior e inferior
    for x in range(w):
        for y in (0, h - 1):
            r, g, b, _ = pixels[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                queue.append((x, y))
                visited.add((x, y))

    # Borde izquierdo y derecho
    for y in range(h):
        for x in (0, w - 1):
            if (x, y) not in visited:
                r, g, b, _ = pixels[x, y]
                if r >= threshold and g >= threshold and b >= threshold:
                    queue.append((x, y))
                    visited.add((x, y))

    # Inundación BFS
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


def crop_and_fit(img, target_w=640, target_h=480, padding=14):
    """Centra la silueta conservando la relación de aspecto."""
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


# Códigos de color ANSI para PowerShell / Windows Terminal
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
MAGENTA = "\033[95m"
WHITE = "\033[97m"
GRAY = "\033[90m"
BOLD = "\033[1m"
RESET = "\033[0m"


def render_progress_bar(completed, total, width=28):
    """Genera una barra de progreso visual con bloques."""
    if total <= 0:
        return ""
    pct = completed / total
    filled = int(width * pct)
    bar = f"{GREEN}{'█' * filled}{GRAY}{'░' * (width - filled)}{RESET}"
    return f"[{bar}] {BOLD}{WHITE}{pct * 100:5.1f}%{RESET}"


def is_clean_studio_background(img):
    """Verifica que las esquinas y bordes sean fondo blanco claro (no gris oscuro ni habitación de garaje)."""
    img_rgb = img.convert("RGB")
    w, h = img_rgb.size
    pixels = img_rgb.load()
    
    samples = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (w // 4, 0), (3 * w // 4, 0)
    ]
    clean_samples = sum(1 for cx, cy in samples if pixels[cx, cy][0] >= 200 and pixels[cx, cy][1] >= 200 and pixels[cx, cy][2] >= 200)
    return clean_samples >= 5


def fetch_image_from_engine(prompt, retries=6):
    """Genera la imagen garantizando fondo blanco puro y reintentando automáticamente si sale con fondo oscuro."""
    encoded = urllib.parse.quote(prompt)
    
    last_error = None
    for attempt in range(retries):
        seed = int(time.time() * 1000 + attempt * 777) % 99999
        url = f"https://image.pollinations.ai/prompt/{encoded}?width=1024&height=1024&nologo=true&seed={seed}&model=flux"
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
            })
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = resp.read()
                if len(data) < 1000:
                    raise Exception(f"Respuesta inválida ({len(data)} bytes)")
                img = Image.open(io.BytesIO(data))
                
                # Control de calidad estricto: verificar fondo blanco
                if not is_clean_studio_background(img):
                    print(f"      [Filtro ⚠️ Fondo no blanco detectado, regenerando con nueva semilla...]", flush=True)
                    time.sleep(2)
                    continue

                time.sleep(1.5)
                return img
        except Exception as e:
            last_error = e
            wait_time = 4 * (attempt + 1)
            print(f"      [Aviso ⏳ Reintento {attempt+1}/{retries} tras {wait_time}s]: {e}", flush=True)
            time.sleep(wait_time)
            
    if last_error:
        raise last_error
    raise Exception("No se pudo obtener imagen con fondo blanco limpio tras varios intentos.")


def main():
    # Habilitar ANSI en consolas Windows legacy si es necesario
    if os.name == "nt":
        os.system("")

    print(f"\n{CYAN}{BOLD}╔══════════════════════════════════════════════════════════════════════════════════╗{RESET}", flush=True)
    print(f"{CYAN}{BOLD}║   🚗 MC-LARENS ERP — GENERADOR AUTÓNOMO DE SILUETAS 3/4 HD (FRONT + REAR)        ║{RESET}", flush=True)
    print(f"{CYAN}{BOLD}╚══════════════════════════════════════════════════════════════════════════════════╝{RESET}", flush=True)

    if not os.path.exists(CATALOG_PATH):
        print(f"{YELLOW}❌ [ERROR] No se encontró el catálogo de prompts: {CATALOG_PATH}{RESET}", flush=True)
        return

    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    models = catalog.get("items") or catalog.get("models") or []
    total_models = len(models)
    start_time = time.time()

    # Cargar progreso
    progress = {}
    if os.path.exists(PROGRESS_PATH):
        try:
            with open(PROGRESS_PATH, "r", encoding="utf-8") as f:
                progress = json.load(f)
        except Exception:
            progress = {}

    completed_count = len([k for k, v in progress.items() if v.get("status") == "completed"])

    print(f"{BLUE}📁 Catálogo Fuente:{RESET} {WHITE}{CATALOG_PATH}{RESET}", flush=True)
    print(f"{BLUE}📊 Modelos a procesar:{RESET} {BOLD}{total_models} Vehículos{RESET} ({total_models * 2} Vistas en total)", flush=True)
    limit = None
    brand_filter = None
    for arg in sys.argv[1:]:
        if arg.isdigit():
            limit = int(arg)
        elif arg.lower() in ["toyota", "nissan", "hyundai", "kia", "mitsubishi", "isuzu"]:
            brand_filter = arg.lower()

    if limit:
        print(f"{YELLOW}⚡ Modo Limitado: Procesando hasta {limit} modelos.{RESET}", flush=True)
    if brand_filter:
        print(f"{YELLOW}⚡ Filtro de Marca: {brand_filter.upper()}{RESET}", flush=True)

    processed_count = 0
    for idx, m in enumerate(models, start=1):
        if limit and processed_count >= limit:
            break
        brand_slug = m.get("brand_slug", "").lower()
        if brand_filter and brand_slug != brand_filter:
            continue

        slug = m.get("slug") or f"{brand_slug}_{m.get('model_name', '').lower()}"
        brand = m.get("brand", brand_slug.upper())
        model_name = m.get("model_name", "")
        years = m.get("years") or f"{m.get('year_start', '')}-{m.get('year_end', '')}"
        
        # Rutas de archivo especificadas en el JSON
        files_info = m.get("files", {})
        front_rel = files_info.get("front_3q") or f"frontend/public/vehicles/models/{brand_slug}/{slug}_front_3q.png"
        rear_rel = files_info.get("rear_3q") or f"frontend/public/vehicles/models/{brand_slug}/{slug}_rear_3q.png"
        
        front_path = os.path.normpath(os.path.join(BASE_DIR, front_rel) if not os.path.isabs(front_rel) else front_rel)
        rear_path = os.path.normpath(os.path.join(BASE_DIR, rear_rel) if not os.path.isabs(rear_rel) else rear_rel)

        os.makedirs(os.path.dirname(front_path), exist_ok=True)
        os.makedirs(os.path.dirname(rear_path), exist_ok=True)

        # Prompts especificados en el JSON
        prompts_info = m.get("prompts", {})
        p_front = prompts_info.get("front_3q")
        p_rear = prompts_info.get("rear_3q")

        # Fallback si no vinieran prompts
        if not p_front:
            category = m.get("category", "car")
            p_front = f"Front 3/4 three-quarter perspective studio 3D render of ONE single modern white {brand} {model_name} ({years}) {category}, exact front-left angle view, clearly showing front windshield and side windows, dark grey tinted glass, clean white body, studio lighting, isolated on seamless pure solid white background, high resolution cutout photograph, no floor shadow, no wall, no dark background, no reflections, single car only"
        if not p_rear:
            category = m.get("category", "car")
            p_rear = f"Rear 3/4 three-quarter perspective studio 3D render of ONE single modern white {brand} {model_name} ({years}) {category}, exact rear-left angle view, clearly showing rear back window and rear side windows, dark grey tinted glass, clean white body, studio lighting, isolated on seamless pure solid white background, high resolution cutout photograph, no floor shadow, no wall, no dark background, no reflections, single car only"

        # Verificar si ya está completado en disco
        if os.path.exists(front_path) and os.path.exists(rear_path):
            if slug not in progress:
                progress[slug] = {
                    "status": "completed",
                    "front": front_path,
                    "rear": rear_path,
                    "updated_at": time.time()
                }
            continue

        bar = render_progress_bar(completed_count, total_models)
        print(f"{bar} {MAGENTA}{BOLD}[{idx}/{total_models}]{RESET} {WHITE}{BOLD}{brand} {model_name}{RESET} {GRAY}({years}){RESET}", flush=True)

        # 1. Vista Delantera 3/4
        if not os.path.exists(front_path):
            try:
                print(f"   {YELLOW}⏳ [1/2] Generando Ángulo Frontal 3/4 (Parabrisas + Laterales)...{RESET}", flush=True)
                raw_f = fetch_image_from_engine(p_front)
                trans_f = flood_fill_transparent(raw_f)
                final_f = crop_and_fit(trans_f, 640, 480)
                final_f.save(front_path, "PNG", optimize=True)
                print(f"   {GREEN}✔ [1/2] Frontal 3/4 guardada:{RESET} {GRAY}{os.path.basename(front_path)}{RESET}", flush=True)
            except Exception as e:
                print(f"   {YELLOW}❌ [1/2] Error en frontal de {slug}: {e}{RESET}", flush=True)

        # 2. Vista Trasera 3/4
        if not os.path.exists(rear_path):
            try:
                print(f"   {YELLOW}⏳ [2/2] Generando Ángulo Trasero 3/4 (Medallón + Laterales)...{RESET}", flush=True)
                raw_r = fetch_image_from_engine(p_rear)
                trans_r = flood_fill_transparent(raw_r)
                final_r = crop_and_fit(trans_r, 640, 480)
                final_r.save(rear_path, "PNG", optimize=True)
                print(f"   {GREEN}✔ [2/2] Trasera 3/4 guardada:{RESET} {GRAY}{os.path.basename(rear_path)}{RESET}", flush=True)
            except Exception as e:
                print(f"   {YELLOW}❌ [2/2] Error en trasera de {slug}: {e}{RESET}", flush=True)

        # Registrar progreso únicamente si ambos archivos existen
        if os.path.exists(front_path) and os.path.exists(rear_path):
            completed_count += 1
            processed_count += 1
            progress[slug] = {
                "status": "completed",
                "front": front_path,
                "rear": rear_path,
                "updated_at": time.time()
            }
            with open(PROGRESS_PATH, "w", encoding="utf-8") as f:
                json.dump(progress, f, indent=2)

            # Sincronizar en vivo a Cloud Run para monitoreo móvil
            try:
                import urllib.request
                sync_payload = json.dumps({
                    "total": total_models,
                    "completed": completed_count,
                    "current_model": f"{brand} {model_name} ({years}) [Front 3/4 + Rear 3/4]",
                    "status": "running"
                }).encode("utf-8")
                s_req = urllib.request.Request(
                    "https://mclarens-erp-836176703716.us-central1.run.app/api/vehicles/batch-progress-sync",
                    data=sync_payload,
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                urllib.request.urlopen(s_req, timeout=4)
            except Exception:
                pass

            print(f"   {CYAN}✨ Modelo {brand} {model_name} completado con éxito.{RESET}\n", flush=True)
        time.sleep(1)

    elapsed = time.time() - start_time
    print(f"\n{GREEN}{BOLD}════════════════════════════════════════════════════════════════════════════════════{RESET}", flush=True)
    print(f"{GREEN}{BOLD}  🏁 CATÁLOGO 3/4 COMPLETADO: {completed_count}/{total_models} MODELOS EN {elapsed/60:.1f} MINUTOS{RESET}", flush=True)
    print(f"{GREEN}{BOLD}════════════════════════════════════════════════════════════════════════════════════{RESET}\n", flush=True)


if __name__ == "__main__":
    main()
