"""
==============================================================================
MC-LARENS ERP: Generador Continuo de Catalogo Toyota en Google Cloud (Vertex AI)
==============================================================================
Utiliza el saldo de $300 de GCP con Vertex AI Imagen 3 (imagen-3.0-generate-002)
para generar todas las siluetas vectoriales tecnicas de Toyota (2000-2026),
con faros celestes (delanteros) y rojos (traseros), fondo transparente RGBA.
==============================================================================
"""

import json
import os
import sys
import time
import base64
import subprocess
from PIL import Image

PROJECT_ID = "gen-lang-client-0971793042"
LOCATION = "us-central1"
MODEL_ID = "imagen-3.0-generate-002"

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(BASE_DIR, "frontend", "public", "vehicles", "models", "toyota")
os.makedirs(OUT_DIR, exist_ok=True)

def get_access_token():
    try:
        token = subprocess.check_output(["gcloud", "auth", "print-access-token"]).decode("utf-8").strip()
        return token
    except Exception as e:
        print(f"[ERROR] No se pudo obtener el token de gcloud: {e}")
        return None

def ensure_aiplatform_enabled():
    try:
        print("[INFO] Verificando habilitacion de Vertex AI API en el proyecto...")
        subprocess.check_call(["gcloud", "services", "enable", "aiplatform.googleapis.com", "--project", PROJECT_ID])
        print("[OK] Vertex AI API habilitada.")
    except Exception as e:
        print(f"[AVISO] No se pudo ejecutar gcloud services enable: {e}")

CANDIDATE_MODELS = [
    "imagegeneration@006",
    "imagegeneration@005",
    "imagen-3.0-generate-001",
    "imagegeneration@002",
    "imagen-3.0-fast-generate-001",
]

def flood_fill_transparent(img, threshold=240):
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

def generate_vertex_image(prompt, aspect_ratio="16:9", token=None):
    global ACTIVE_MODEL
    import requests
    if not token:
        token = get_access_token()
    if not token:
        raise ValueError("No access token available")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=utf-8",
    }
    payload = {
        "instances": [{"prompt": prompt}],
        "parameters": {
            "sampleCount": 1,
            "aspectRatio": aspect_ratio,
            "outputMimeType": "image/jpeg"
        }
    }

    models_to_try = [ACTIVE_MODEL] if ACTIVE_MODEL else CANDIDATE_MODELS

    last_err = None
    for model_id in models_to_try:
        url = f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/publishers/google/models/{model_id}:predict"
        r = requests.post(url, headers=headers, json=payload, timeout=60)
        if r.status_code == 200:
            ACTIVE_MODEL = model_id
            data = r.json()
            predictions = data.get("predictions", [])
            if predictions:
                b64_str = predictions[0].get("bytesBase64Encoded")
                img_bytes = base64.b64decode(b64_str)
                from io import BytesIO
                return Image.open(BytesIO(img_bytes))
        else:
            last_err = f"Vertex AI [{model_id} - {r.status_code}]: {r.text}"

    raise Exception(last_err or "No se pudo generar imagen con ningun modelo de Vertex AI")

# Catalogo Maestro de Tareas Toyota con Faros Diferenciados
TASKS = [
    # 1. HILUX 2021-2026
    {
        "name": "Hilux 2021-2026 Single Cab (Top)",
        "file": "toyota_hilux_single_cab_2021_2026_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota Hilux (2021-2026) single cab pickup truck, short 2 doors regular cabin, long open cargo bed at the bottom, exact true 90-degree bird's-eye view from above, vertical orientation, front hood facing towards the top, automotive technical drawing style, crisp clean black line art outlines, solid white car body, front headlights at the top distinctly colored in bright light cyan blue, rear taillights at the bottom distinctly colored in bright vivid red, clearly visible front windshield, short cabin roof, rear window, and ribbed cargo bed, isolated on pure solid white background, high quality vector graphics, no 3D perspective, no shadows"
    },
    {
        "name": "Hilux 2021-2026 Extra Cab (Lat)",
        "file": "toyota_hilux_extra_cab_2021_2026_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota Hilux (2021-2026) extra cab smart cab pickup truck, front door and small rear access quarter window, medium cargo bed, exact true 90-degree lateral side view, automotive technical drawing style, crisp clean black line art outlines, solid white car body, front headlight distinctly colored in bright light cyan blue, rear taillight distinctly colored in bright vivid red, windows tinted in neutral dark grey, isolated on pure solid white background, vector graphics, no 3D perspective"
    },
    {
        "name": "Hilux 2021-2026 Extra Cab (Top)",
        "file": "toyota_hilux_extra_cab_2021_2026_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota Hilux (2021-2026) extra cab smart cab pickup truck, medium cabin length, open cargo bed at the bottom, exact true 90-degree bird's-eye view from above, vertical orientation, front hood facing towards the top, automotive technical drawing style, crisp clean black line art outlines, solid white car body, front headlights at top in bright light cyan blue, rear taillights at bottom in bright vivid red, isolated on pure solid white background, vector graphics"
    },

    # 2. HILUX 2016-2020
    {
        "name": "Hilux 2016-2020 Single Cab (Lat)",
        "file": "toyota_hilux_single_cab_2016_2020_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota Hilux (2016-2020) single cab pickup truck, 2 doors regular cab, long cargo bed, exact true 90-degree lateral side view, automotive technical drawing style, crisp clean black line art outlines, solid white car body, front headlight in bright light cyan blue, rear taillight in bright vivid red, windows tinted dark grey, isolated on pure solid white background"
    },
    {
        "name": "Hilux 2016-2020 Single Cab (Top)",
        "file": "toyota_hilux_single_cab_2016_2020_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota Hilux (2016-2020) single cab pickup truck, 2 doors short cabin, long open cargo bed at bottom, exact true 90-degree bird's-eye view, vertical orientation, front hood facing top, crisp clean black line art outlines, solid white car body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Hilux 2016-2020 Extra Cab (Lat)",
        "file": "toyota_hilux_extra_cab_2016_2020_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota Hilux (2016-2020) extra cab smart cab pickup truck, front door and rear quarter window, medium cargo bed, exact true 90-degree lateral side view, automotive technical drawing style, black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Hilux 2016-2020 Extra Cab (Top)",
        "file": "toyota_hilux_extra_cab_2016_2020_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota Hilux (2016-2020) extra cab smart cab pickup truck, medium cabin length, cargo bed at bottom, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },

    # 3. HILUX 2012-2015 (Vigo Champ)
    {
        "name": "Hilux 2012-2015 Double Cab (Top)",
        "file": "toyota_hilux_2012_2015_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota Hilux (2012-2015) Vigo Champ double cab pickup truck, hood with scoop facing top, 4 doors cabin, open cargo bed at bottom, exact true 90-degree bird's-eye view, vertical orientation, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Hilux 2012-2015 Single Cab (Lat)",
        "file": "toyota_hilux_single_cab_2012_2015_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a classic white Toyota Hilux (2012-2015) Vigo Champ single cab pickup truck, 2 doors regular cab, long cargo bed, hood scoop, exact true 90-degree lateral side view, automotive technical drawing style, crisp black line art outlines, solid white car body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Hilux 2012-2015 Single Cab (Top)",
        "file": "toyota_hilux_single_cab_2012_2015_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota Hilux (2012-2015) Vigo Champ single cab pickup truck, short cabin, long cargo bed at bottom, vertical orientation, front hood with scoop facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Hilux 2012-2015 Extra Cab (Lat)",
        "file": "toyota_hilux_extra_cab_2012_2015_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a classic white Toyota Hilux (2012-2015) Vigo Champ extra cab pickup truck, front door and rear quarter window, medium cargo bed, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Hilux 2012-2015 Extra Cab (Top)",
        "file": "toyota_hilux_extra_cab_2012_2015_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota Hilux (2012-2015) Vigo Champ extra cab pickup truck, vertical orientation, front hood with scoop facing top, cargo bed at bottom, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },

    # 4. HILUX 2005-2011 (Vigo Gen 1)
    {
        "name": "Hilux 2005-2011 Double Cab (Lat)",
        "file": "toyota_hilux_2005_2011_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a classic white Toyota Hilux (2005-2011) Vigo double cab pickup truck, 4 doors, standard cargo bed, exact true 90-degree lateral side view, automotive technical drawing style, crisp black line art outlines, solid white car body, front headlight in bright light cyan blue, rear taillight in bright vivid red, windows tinted dark grey, isolated on pure solid white background"
    },
    {
        "name": "Hilux 2005-2011 Double Cab (Top)",
        "file": "toyota_hilux_2005_2011_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota Hilux (2005-2011) Vigo double cab pickup truck, 4 doors cabin, open cargo bed at bottom, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Hilux 2005-2011 Single Cab (Lat)",
        "file": "toyota_hilux_single_cab_2005_2011_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a classic white Toyota Hilux (2005-2011) Vigo single cab pickup truck, 2 doors regular cab, long cargo bed, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Hilux 2005-2011 Single Cab (Top)",
        "file": "toyota_hilux_single_cab_2005_2011_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota Hilux (2005-2011) Vigo single cab pickup truck, 2 doors short cabin, long cargo bed at bottom, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },

    # 5. HILUX 2000-2004 (Tiger)
    {
        "name": "Hilux 2000-2004 Double Cab (Lat)",
        "file": "toyota_hilux_2000_2004_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a classic white Toyota Hilux (2000-2004) Tiger double cab pickup truck, 4 doors, exact true 90-degree lateral side view, automotive technical drawing style, crisp black line art outlines, solid white car body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Hilux 2000-2004 Double Cab (Top)",
        "file": "toyota_hilux_2000_2004_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota Hilux (2000-2004) Tiger double cab pickup truck, vertical orientation, front hood facing top, cargo bed at bottom, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Hilux 2000-2004 Single Cab (Lat)",
        "file": "toyota_hilux_single_cab_2000_2004_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a classic white Toyota Hilux (2000-2004) Tiger single cab pickup truck, 2 doors regular cab, long cargo bed, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Hilux 2000-2004 Single Cab (Top)",
        "file": "toyota_hilux_single_cab_2000_2004_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota Hilux (2000-2004) Tiger single cab pickup truck, vertical orientation, front hood facing top, long cargo bed at bottom, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },

    # 6. TOYOTA YARIS (Sedan & Hatchback 2000-2026)
    {
        "name": "Yaris 2023-2026 Sedan (Lat)",
        "file": "toyota_yaris_sedan_2023_2026_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota Yaris (2023-2026) sedan, fastback sedan profile, exact true 90-degree lateral side view, automotive technical drawing style, crisp black line art outlines, solid white car body, front headlight in bright light cyan blue, rear taillight in bright vivid red, windows tinted dark grey, isolated on pure solid white background"
    },
    {
        "name": "Yaris 2023-2026 Sedan (Top)",
        "file": "toyota_yaris_sedan_2023_2026_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota Yaris (2023-2026) sedan, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, clearly visible windshield and glass, isolated on pure solid white background"
    },
    {
        "name": "Yaris 2018-2022 Sedan (Lat)",
        "file": "toyota_yaris_sedan_2018_2022_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota Yaris (2018-2022) sedan, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, windows tinted dark grey, isolated on pure solid white background"
    },
    {
        "name": "Yaris 2018-2022 Sedan (Top)",
        "file": "toyota_yaris_sedan_2018_2022_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota Yaris (2018-2022) sedan, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Yaris 2014-2017 Sedan (Lat)",
        "file": "toyota_yaris_sedan_2014_2017_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a white Toyota Yaris (2014-2017) sedan, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, windows tinted dark grey, isolated on pure solid white background"
    },
    {
        "name": "Yaris 2014-2017 Sedan (Top)",
        "file": "toyota_yaris_sedan_2014_2017_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a white Toyota Yaris (2014-2017) sedan, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Yaris 2006-2013 Sedan Belta (Lat)",
        "file": "toyota_yaris_sedan_2006_2013_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a classic white Toyota Yaris (2006-2013) Belta sedan, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Yaris 2006-2013 Sedan Belta (Top)",
        "file": "toyota_yaris_sedan_2006_2013_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota Yaris (2006-2013) Belta sedan, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Yaris 2000-2005 Sedan Echo (Lat)",
        "file": "toyota_yaris_sedan_2000_2005_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a classic white Toyota Yaris Echo (2000-2005) sedan, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Yaris 2000-2005 Sedan Echo (Top)",
        "file": "toyota_yaris_sedan_2000_2005_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota Yaris Echo (2000-2005) sedan, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },

    # 7. TOYOTA RAV4 (2000-2026)
    {
        "name": "RAV4 2019-2026 (Lat)",
        "file": "toyota_rav4_2019_2026_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota RAV4 (2019-2026) SUV, rugged geometric SUV profile, exact true 90-degree lateral side view, automotive technical drawing style, crisp black line art outlines, solid white car body, front headlight in bright light cyan blue, rear taillight in bright vivid red, windows tinted dark grey, isolated on pure solid white background"
    },
    {
        "name": "RAV4 2019-2026 (Top)",
        "file": "toyota_rav4_2019_2026_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota RAV4 (2019-2026) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, clearly visible windshield and panoramic roof, isolated on pure solid white background"
    },
    {
        "name": "RAV4 2013-2018 (Lat)",
        "file": "toyota_rav4_2013_2018_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota RAV4 (2013-2018) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "RAV4 2013-2018 (Top)",
        "file": "toyota_rav4_2013_2018_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota RAV4 (2013-2018) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "RAV4 2006-2012 (Lat)",
        "file": "toyota_rav4_2006_2012_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a classic white Toyota RAV4 (2006-2012) SUV with spare wheel on rear door, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "RAV4 2006-2012 (Top)",
        "file": "toyota_rav4_2006_2012_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota RAV4 (2006-2012) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "RAV4 2000-2005 (Lat)",
        "file": "toyota_rav4_2000_2005_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a classic white Toyota RAV4 (2000-2005) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "RAV4 2000-2005 (Top)",
        "file": "toyota_rav4_2000_2005_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota RAV4 (2000-2005) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },

    # 8. TOYOTA LAND CRUISER PRADO (J90 a J250)
    {
        "name": "Prado 2024-2026 J250 (Lat)",
        "file": "toyota_prado_2024_2026_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota Land Cruiser Prado (2024-2026) J250 SUV, boxy rugged 4x4 profile, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Prado 2024-2026 J250 (Top)",
        "file": "toyota_prado_2024_2026_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota Land Cruiser Prado (2024-2026) J250 SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Prado 2018-2023 J150 (Lat)",
        "file": "toyota_prado_2018_2023_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota Land Cruiser Prado (2018-2023) J150 facelift SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Prado 2018-2023 J150 (Top)",
        "file": "toyota_prado_2018_2023_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota Land Cruiser Prado (2018-2023) J150 SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Prado 2010-2017 J150 (Lat)",
        "file": "toyota_prado_2010_2017_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a white Toyota Land Cruiser Prado (2010-2017) J150 SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Prado 2010-2017 J150 (Top)",
        "file": "toyota_prado_2010_2017_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a white Toyota Land Cruiser Prado (2010-2017) J150 SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Prado 2003-2009 J120 (Lat)",
        "file": "toyota_prado_2003_2009_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a classic white Toyota Land Cruiser Prado (2003-2009) J120 SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Prado 2003-2009 J120 (Top)",
        "file": "toyota_prado_2003_2009_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota Land Cruiser Prado (2003-2009) J120 SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Prado 2000-2002 J90 (Lat)",
        "file": "toyota_prado_2000_2002_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a classic white Toyota Land Cruiser Prado (2000-2002) J90 SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Prado 2000-2002 J90 (Top)",
        "file": "toyota_prado_2000_2002_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota Land Cruiser Prado (2000-2002) J90 SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },

    # 9. TOYOTA FORTUNER (2005-2026)
    {
        "name": "Fortuner 2021-2026 (Lat)",
        "file": "toyota_fortuner_2021_2026_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota Fortuner (2021-2026) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, windows tinted dark grey, isolated on pure solid white background"
    },
    {
        "name": "Fortuner 2021-2026 (Top)",
        "file": "toyota_fortuner_2021_2026_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota Fortuner (2021-2026) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Fortuner 2016-2020 (Lat)",
        "file": "toyota_fortuner_2016_2020_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota Fortuner (2016-2020) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Fortuner 2016-2020 (Top)",
        "file": "toyota_fortuner_2016_2020_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota Fortuner (2016-2020) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Fortuner 2005-2015 (Lat)",
        "file": "toyota_fortuner_2005_2015_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a classic white Toyota Fortuner (2005-2015) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Fortuner 2005-2015 (Top)",
        "file": "toyota_fortuner_2005_2015_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota Fortuner (2005-2015) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },

    # 10. LAND CRUISER 70 / 79 PICKUP
    {
        "name": "Land Cruiser 79 Single Cab (Lat)",
        "file": "toyota_land_cruiser_79_single_cab_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a classic white Toyota Land Cruiser 79 Series single cab pickup truck, snorkel, heavy duty 4x4, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Land Cruiser 79 Single Cab (Top)",
        "file": "toyota_land_cruiser_79_single_cab_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota Land Cruiser 79 Series single cab pickup truck, vertical orientation, front hood facing top, cargo bed at bottom, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Land Cruiser 79 Double Cab (Lat)",
        "file": "toyota_land_cruiser_79_double_cab_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a classic white Toyota Land Cruiser 79 Series double cab pickup truck, 4 doors, heavy duty 4x4, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Land Cruiser 79 Double Cab (Top)",
        "file": "toyota_land_cruiser_79_double_cab_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota Land Cruiser 79 Series double cab pickup truck, vertical orientation, front hood facing top, cargo bed at bottom, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },

    # 11. LAND CRUISER 300 / 200
    {
        "name": "Land Cruiser 300 (Lat)",
        "file": "toyota_land_cruiser_300_2022_2026_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota Land Cruiser 300 (2022-2026) luxury full-size SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Land Cruiser 300 (Top)",
        "file": "toyota_land_cruiser_300_2022_2026_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota Land Cruiser 300 (2022-2026) luxury SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Land Cruiser 200 (Lat)",
        "file": "toyota_land_cruiser_200_2008_2021_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a classic white Toyota Land Cruiser 200 (2008-2021) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Land Cruiser 200 (Top)",
        "file": "toyota_land_cruiser_200_2008_2021_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a classic white Toyota Land Cruiser 200 (2008-2021) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },

    # 12. 4RUNNER / RUSH / RAIZE / AGYA / HIACE
    {
        "name": "4Runner 2014-2024 (Lat)",
        "file": "toyota_4runner_2014_2024_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota 4Runner (2014-2024) SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "4Runner 2014-2024 (Top)",
        "file": "toyota_4runner_2014_2024_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota 4Runner (2014-2024) SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Raize 2020-2026 (Lat)",
        "file": "toyota_raize_2020_2026_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota Raize (2020-2026) compact crossover SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Raize 2020-2026 (Top)",
        "file": "toyota_raize_2020_2026_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota Raize (2020-2026) compact crossover SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Rush 2018-2026 (Lat)",
        "file": "toyota_rush_2018_2026_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota Rush (2018-2026) 7-seater SUV, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Rush 2018-2026 (Top)",
        "file": "toyota_rush_2018_2026_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota Rush (2018-2026) 7-seater SUV, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Agya 2014-2026 (Lat)",
        "file": "toyota_agya_2014_2026_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota Agya (2014-2026) compact hatchback, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Agya 2014-2026 (Top)",
        "file": "toyota_agya_2014_2026_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota Agya (2014-2026) compact hatchback, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Hiace Commuter (Lat)",
        "file": "toyota_hiace_commuter_lat.png",
        "ar": "16:9",
        "tw": 640, "th": 360, "rotate": False,
        "prompt": "Clean 2D vector orthographic side profile blueprint illustration of a modern white Toyota Hiace passenger commuter van, large side windows, exact true 90-degree lateral side view, crisp black line art outlines, solid white body, front headlight in bright light cyan blue, rear taillight in bright vivid red, isolated on pure solid white background"
    },
    {
        "name": "Hiace Commuter (Top)",
        "file": "toyota_hiace_commuter_top.png",
        "ar": "9:16",
        "tw": 360, "th": 640, "rotate": False,
        "prompt": "Clean 2D vector orthographic top-down blueprint illustration of a modern white Toyota Hiace passenger van, vertical orientation, front hood facing top, crisp black line art outlines, solid white body, front headlights in bright light cyan blue, rear taillights in bright vivid red, isolated on pure solid white background"
    },
]

def main():
    print(f"=== INICIANDO GENERADOR CONTINUO TOYOTA ({len(TASKS)} TAREAS) ===")
    ensure_aiplatform_enabled()
    token = get_access_token()
    if not token:
        print("[ERROR CRITICO] Debes ejecutar este script en Google Cloud Shell donde gcloud esta autenticado.")
        sys.exit(1)

    success_count = 0
    for i, t in enumerate(TASKS, 1):
        target_path = os.path.join(OUT_DIR, t["file"])
        if os.path.exists(target_path):
            print(f"[{i}/{len(TASKS)}] YA EXISTE: {t['name']} -> {t['file']}")
            success_count += 1
            continue

        print(f"\n[{i}/{len(TASKS)}] Generando con Vertex AI: {t['name']}...")
        try:
            raw_img = generate_vertex_image(t["prompt"], aspect_ratio=t["ar"], token=token)
            if t.get("rotate", False):
                raw_img = raw_img.rotate(180, expand=True)
            trans_img = flood_fill_transparent(raw_img)
            fitted_img = crop_and_fit(trans_img, target_w=t["tw"], target_h=t["th"], padding=16)
            fitted_img.save(target_path, "PNG", optimize=True)
            print(f"[OK] Guardado transparente en: {t['file']}")
            success_count += 1
            time.sleep(1.5)  # Pausa breve entre peticiones
        except Exception as e:
            print(f"[FALLO] Error en {t['name']}: {e}")
            time.sleep(3)

    print(f"\n=== PROCESO COMPLETADO: {success_count}/{len(TASKS)} IMAGENES LISTAS ===")

if __name__ == "__main__":
    main()
