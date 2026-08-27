import os
import sys
import json
import time
from PIL import Image

def flood_fill_transparent(img, threshold=240):
    img = img.convert('RGBA')
    w, h = img.size
    visited = set()
    queue = []
    pixels = img.load()
    
    # Check edges for background
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
    canvas = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
    pos_x = (target_w - new_w) // 2
    pos_y = (target_h - new_h) // 2
    canvas.paste(resized, (pos_x, pos_y), resized)
    return canvas

def process_batch(start_id, end_id):
    dl_dir = os.path.expandvars(r'%USERPROFILE%\Downloads')
    out_dir = r'c:\ANTIGRAVITY\MC-LARENS_ERP2\frontend\public\vehicles\models\nissan'
    os.makedirs(out_dir, exist_ok=True)

    with open('scripts/grok_nissan_catalog_prompts.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    target_tasks = [t for t in data['tasks'] if start_id <= t['id'] <= end_id]
    
    # Get latest images in Downloads
    dl_files = []
    for f in os.listdir(dl_dir):
        if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            p = os.path.join(dl_dir, f)
            dl_files.append((os.path.getmtime(p), f, p))
    dl_files.sort(reverse=True)
    
    recent_downloads = dl_files[:len(target_tasks)]
    # Invert to chronological order
    recent_downloads.reverse()
    
    print(f"--- PROCESANDO LOTE NISSAN IDs {start_id} al {end_id} ---")
    for task, (_, f_name, src_p) in zip(target_tasks, recent_downloads):
        img = Image.open(src_p)
        tw, th = (640, 360) if task['view'] == 'Lateral' else (360, 640)
        trans = flood_fill_transparent(img)
        fitted = crop_and_fit(trans, target_w=tw, target_h=th, padding=16)
        dest_p = os.path.join(out_dir, task['filename'])
        fitted.save(dest_p, 'PNG', optimize=True)
        print(f"[OK] {f_name} -> {task['filename']} ({tw}x{th} RGBA Transparente)")

if __name__ == '__main__':
    if len(sys.argv) >= 3:
        process_batch(int(sys.argv[1]), int(sys.argv[2]))
    else:
        print("Uso: python process_incoming_grok_nissan_images.py <start_id> <end_id>")
