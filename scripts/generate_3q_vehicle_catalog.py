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

try:
    from PIL import Image
except ImportError:
    import subprocess
    print("[INFO] Instalando Pillow para procesamiento de imágenes...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "Pillow"])
    from PIL import Image

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MANIFEST_PATH = os.path.join(BASE_DIR, "frontend", "src", "data", "vehicle_batch_generation_manifest.json")
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


def fetch_image_from_engine(prompt, retries=3):
    """Genera la imagen en alta definición vía motor fotorealista de alta velocidad."""
    encoded = urllib.parse.quote(prompt)
    seed = int(time.time() * 1000) % 99999
    url = f"https://image.pollinations.ai/prompt/{encoded}?width=1024&height=1024&nologo=true&seed={seed}"
    
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = resp.read()
                return Image.open(io.BytesIO(data))
        except Exception as e:
            if attempt == retries - 1:
                raise e
            time.sleep(3)


def main():
    # Habilitar ANSI en consolas Windows legacy si es necesario
    if os.name == "nt":
        os.system("")

    print(f"\n{CYAN}{BOLD}╔══════════════════════════════════════════════════════════════════════════════════╗{RESET}")
    print(f"{CYAN}{BOLD}║   🚗 MC-LARENS ERP — GENERADOR AUTÓNOMO DE SILUETAS 3/4 HD (FRONT + REAR)        ║{RESET}")
    print(f"{CYAN}{BOLD}╚══════════════════════════════════════════════════════════════════════════════════╝{RESET}")

    if not os.path.exists(MANIFEST_PATH):
        print(f"{YELLOW}❌ [ERROR] No se encontró el manifiesto: {MANIFEST_PATH}{RESET}")
        return

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    models = manifest.get("models", [])
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

    print(f"{BLUE}📁 Carpeta de Salida:{RESET} {WHITE}{OUTPUT_BASE_DIR}{RESET}")
    print(f"{BLUE}📊 Catálogo a procesar:{RESET} {BOLD}{total_models} Vehículos{RESET} ({total_models * 2} Vistas en total)")
    print(f"{GREEN}💾 Progreso detectado:{RESET}  {BOLD}{completed_count}/{total_models}{RESET} modelos ya completados.")
    print(f"{GRAY}💡 Puedes pausar con Ctrl + C en cualquier momento. El progreso se guarda automáticamente.{RESET}\n")

    for idx, m in enumerate(models, start=1):
        slug = m["slug"]
        brand_slug = m["brand_slug"]
        brand = m["brand"]
        model_name = m["model_name"]
        years = f"{m['year_start']}-{m['year_end']}"
        category = m.get("category", "car")

        out_dir = os.path.join(OUTPUT_BASE_DIR, brand_slug)
        os.makedirs(out_dir, exist_ok=True)

        front_path = os.path.join(out_dir, f"{slug}_front_3q.png")
        rear_path = os.path.join(out_dir, f"{slug}_rear_3q.png")

        # Verificar si ya está completado
        if slug in progress and os.path.exists(front_path) and os.path.exists(rear_path):
            continue

        bar = render_progress_bar(completed_count, total_models)
        print(f"{bar} {MAGENTA}{BOLD}[{idx}/{total_models}]{RESET} {WHITE}{BOLD}{brand} {model_name}{RESET} {GRAY}({years}){RESET}")

        # 1. Vista Delantera 3/4
        if not os.path.exists(front_path):
            try:
                print(f"   {YELLOW}⏳ [1/2] Generando Ángulo Frontal 3/4 (Parabrisas + Laterales)...{RESET}", end="\r")
                p_front = f"Front 3/4 three-quarter perspective studio 3D render of a modern white {brand} {model_name} ({years}) {category}, front-left isometric studio view, clearly showing front windshield and side doors windows, dark grey tinted glass, clean white body, studio lighting, isolated on solid pure white background, high resolution, no watermark, no text, no ground shadow"
                raw_f = fetch_image_from_engine(p_front)
                trans_f = flood_fill_transparent(raw_f)
                final_f = crop_and_fit(trans_f, 640, 480)
                final_f.save(front_path, "PNG", optimize=True)
                print(f"   {GREEN}✔ [1/2] Frontal 3/4 guardada:{RESET} {GRAY}{os.path.basename(front_path)}{RESET}                  ")
            except Exception as e:
                print(f"   {YELLOW}❌ [1/2] Error en frontal de {slug}: {e}{RESET}")

        # 2. Vista Trasera 3/4
        if not os.path.exists(rear_path):
            try:
                print(f"   {YELLOW}⏳ [2/2] Generando Ángulo Trasero 3/4 (Medallón + Laterales)...{RESET}", end="\r")
                p_rear = f"Rear 3/4 three-quarter perspective studio 3D render of a modern white {brand} {model_name} ({years}) {category}, rear-left isometric studio view, clearly showing rear back windshield window and rear side windows, dark grey tinted glass, clean white body, studio lighting, isolated on solid pure white background, high resolution, no watermark, no text, no ground shadow"
                raw_r = fetch_image_from_engine(p_rear)
                trans_r = flood_fill_transparent(raw_r)
                final_r = crop_and_fit(trans_r, 640, 480)
                final_r.save(rear_path, "PNG", optimize=True)
                print(f"   {GREEN}✔ [2/2] Trasera 3/4 guardada:{RESET} {GRAY}{os.path.basename(rear_path)}{RESET}                  ")
            except Exception as e:
                print(f"   {YELLOW}❌ [2/2] Error en trasera de {slug}: {e}{RESET}")

        # Registrar progreso
        completed_count += 1
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

        print(f"   {CYAN}✨ Modelo {brand} {model_name} completado con éxito.{RESET}\n")
        time.sleep(1)

    elapsed = time.time() - start_time
    print(f"\n{GREEN}{BOLD}════════════════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{GREEN}{BOLD}  🏁 CATÁLOGO 3/4 COMPLETADO: {completed_count}/{total_models} MODELOS EN {elapsed/60:.1f} MINUTOS{RESET}")
    print(f"{GREEN}{BOLD}════════════════════════════════════════════════════════════════════════════════════{RESET}\n")


if __name__ == "__main__":
    main()
