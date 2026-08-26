"""
==============================================================================
MC-LARENS ERP: Procesador Automático de Imágenes Descargadas de Grok / IA
==============================================================================
Toma las imágenes que guardes en 'scripts/incoming_grok/' y automáticamente:
1) Remueve el fondo blanco exterior mediante Flood-Fill dejándolo transparente (RGBA).
2) Recorta los bordes transparentes y centra la imagen a 640x360 (lateral) o 360x640 (superior).
3) Guarda la imagen optimizada directamente en 'frontend/public/vehicles/models/toyota/'.
==============================================================================
"""

import os
import glob
import re
from PIL import Image

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INCOMING_DIR = os.path.join(BASE_DIR, "scripts", "incoming_grok")
DEST_DIR = os.path.join(BASE_DIR, "frontend", "public", "vehicles", "models", "toyota")

os.makedirs(INCOMING_DIR, exist_ok=True)
os.makedirs(DEST_DIR, exist_ok=True)

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

def main():
    files = [f for f in os.listdir(INCOMING_DIR) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
    if not files:
        print(f"[INFO] No hay imagenes en '{INCOMING_DIR}'.")
        print("Pega tus imagenes descargadas de Grok en esa carpeta y vuelve a ejecutar este script.")
        return

    print(f"=== PROCESANDO {len(files)} IMAGENES DE GROK ===")
    processed = 0
    for filename in files:
        src_path = os.path.join(INCOMING_DIR, filename)
        is_top = "_top" in filename.lower() or "top" in filename.lower()
        tw, th = (360, 640) if is_top else (640, 360)

        out_name = os.path.splitext(filename)[0]
        if not out_name.endswith(('.png')):
            out_name += ".png"
        
        # Asegurar prefijo toyota si corresponde
        if not out_name.startswith("toyota_") and ("hilux" in out_name or "yaris" in out_name or "rav4" in out_name or "prado" in out_name or "fortuner" in out_name or "corolla" in out_name):
            out_name = "toyota_" + out_name

        dest_path = os.path.join(DEST_DIR, out_name)

        try:
            img = Image.open(src_path)
            trans = flood_fill_transparent(img)
            fitted = crop_and_fit(trans, target_w=tw, target_h=th, padding=16)
            fitted.save(dest_path, "PNG", optimize=True)
            print(f"[OK] {filename} -> Guardado transparente como '{out_name}'")
            processed += 1
        except Exception as e:
            print(f"[ERROR] No se pudo procesar {filename}: {e}")

    print(f"\n[FINALIZADO] {processed} imagenes convertidas a transparente y colocadas en el ERP.")

if __name__ == "__main__":
    main()
