"""
MC-LARENS ERP: Top Vehicle Models Paired Blueprint Extractor for 36 Brands
Extracts 100% paired, transparent lateral and top-down silhouettes for top vehicle models.
"""

import os
import re
import json
from PIL import Image
from collections import deque

def sanitize_slug(text: str) -> str:
    s = re.sub(r'[^a-zA-Z0-9_-]', '_', text.lower())
    s = re.sub(r'_+', '_', s).strip('_')
    return s or 'vehicle'

def clean_and_extract_pair(raw_path: str, lat_dest: str, top_dest: str):
    if not os.path.exists(raw_path):
        return False, False
    im = Image.open(raw_path)
    w, h = im.size
    
    # ---------------- 1. LATERAL VIEW (Top-Left) ----------------
    lat_crop = im.crop((0, 0, int(w * 0.70), int(h * 0.44)))
    lat_rgba = lat_crop.convert('RGBA')
    lw, lh = lat_rgba.size
    l_pixels = lat_rgba.load()
    
    # Erase title in top-left
    for y in range(min(lh, 22)):
        for x in range(min(lw, 160)):
            l_pixels[x, y] = (255, 255, 255, 0)
            
    # Flood fill transparent background
    visited = [[False]*lh for _ in range(lw)]
    queue = deque()
    for x in range(lw):
        for y in (0, lh - 1):
            r, g, b, a = l_pixels[x, y]
            if a > 0 and r > 230 and g > 230 and b > 230:
                queue.append((x, y))
                visited[x][y] = True
    for y in range(lh):
        for x in (0, lw - 1):
            if not visited[x][y]:
                r, g, b, a = l_pixels[x, y]
                if a > 0 and r > 230 and g > 230 and b > 230:
                    queue.append((x, y))
                    visited[x][y] = True
    while queue:
        cx, cy = queue.popleft()
        l_pixels[cx, cy] = (255, 255, 255, 0)
        for dx, dy in ((-1,0), (1,0), (0,-1), (0,1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < lw and 0 <= ny < lh and not visited[nx][ny]:
                r, g, b, a = l_pixels[nx, ny]
                if r > 230 and g > 230 and b > 230:
                    visited[nx][ny] = True
                    queue.append((nx, ny))
                    
    # Keep main component
    labeled = [[0]*lh for _ in range(lw)]
    comp_id = 0
    components = {}
    for x in range(lw):
        for y in range(lh):
            if l_pixels[x, y][3] > 0 and labeled[x][y] == 0:
                comp_id += 1
                c_pixels = []
                c_queue = deque([(x, y)])
                labeled[x][y] = comp_id
                while c_queue:
                    qx, qy = c_queue.popleft()
                    c_pixels.append((qx, qy))
                    for dx, dy in ((-1,0), (1,0), (0,-1), (0,1)):
                        sx, sy = qx + dx, qy + dy
                        if 0 <= sx < lw and 0 <= sy < lh and l_pixels[sx, sy][3] > 0 and labeled[sx][sy] == 0:
                            labeled[sx][sy] = comp_id
                            c_queue.append((sx, sy))
                components[comp_id] = c_pixels
    if components:
        main_comp_id = max(components.keys(), key=lambda k: len(components[k]))
        for cid, pts in components.items():
            if cid != main_comp_id and len(pts) < 140:
                for px, py in pts:
                    l_pixels[px, py] = (255, 255, 255, 0)
                    
    lat_bbox = lat_rgba.getbbox()
    lat_trimmed = lat_rgba.crop(lat_bbox) if lat_bbox else lat_rgba
    
    tw, th = (640, 360)
    max_w, max_h = int(tw * 0.94), int(th * 0.94)
    scale = min(max_w / lat_trimmed.width, max_h / lat_trimmed.height)
    new_w = int(lat_trimmed.width * scale)
    new_h = int(lat_trimmed.height * scale)
    lat_resized = lat_trimmed.resize((new_w, new_h), Image.Resampling.LANCZOS)
    lat_canvas = Image.new('RGBA', (tw, th), (255, 255, 255, 0))
    lat_canvas.paste(lat_resized, ((tw - new_w) // 2, (th - new_h) // 2), lat_resized)
    os.makedirs(os.path.dirname(os.path.abspath(lat_dest)), exist_ok=True)
    lat_canvas.save(lat_dest, 'PNG')
    
    # ---------------- 2. TOP-DOWN VIEW (Bottom-Left / Middle-Left) ----------------
    top_crop = im.crop((5, int(h * 0.50), int(w * 0.70), h))
    top_rgba = top_crop.convert('RGBA')
    tw_top, th_top = top_rgba.size
    t_pixels = top_rgba.load()
    
    # Erase bottom scale bar & logo
    for y in range(max(0, th_top - 25), th_top):
        for x in range(min(tw_top, 140)):
            t_pixels[x, y] = (255, 255, 255, 0)
    for y in range(max(0, th_top - 30), th_top):
        for x in range(max(0, tw_top - 60), tw_top):
            t_pixels[x, y] = (255, 255, 255, 0)
            
    # Flood fill transparent background
    visited_t = [[False]*th_top for _ in range(tw_top)]
    queue_t = deque()
    for x in range(tw_top):
        for y in (0, th_top - 1):
            r, g, b, a = t_pixels[x, y]
            if a > 0 and r > 230 and g > 230 and b > 230:
                queue_t.append((x, y))
                visited_t[x][y] = True
    for y in range(th_top):
        for x in (0, tw_top - 1):
            if not visited_t[x][y]:
                r, g, b, a = t_pixels[x, y]
                if a > 0 and r > 230 and g > 230 and b > 230:
                    queue_t.append((x, y))
                    visited_t[x][y] = True
    while queue_t:
        cx, cy = queue_t.popleft()
        t_pixels[cx, cy] = (255, 255, 255, 0)
        for dx, dy in ((-1,0), (1,0), (0,-1), (0,1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < tw_top and 0 <= ny < th_top and not visited_t[nx][ny]:
                r, g, b, a = t_pixels[nx, ny]
                if r > 230 and g > 230 and b > 230:
                    visited_t[nx][ny] = True
                    queue_t.append((nx, ny))
                    
    # Keep main component
    labeled_t = [[0]*th_top for _ in range(tw_top)]
    comp_id_t = 0
    components_t = {}
    for x in range(tw_top):
        for y in range(th_top):
            if t_pixels[x, y][3] > 0 and labeled_t[x][y] == 0:
                comp_id_t += 1
                c_pixels = []
                c_queue = deque([(x, y)])
                labeled_t[x][y] = comp_id_t
                while c_queue:
                    qx, qy = c_queue.popleft()
                    c_pixels.append((qx, qy))
                    for dx, dy in ((-1,0), (1,0), (0,-1), (0,1)):
                        sx, sy = qx + dx, qy + dy
                        if 0 <= sx < tw_top and 0 <= sy < th_top and t_pixels[sx, sy][3] > 0 and labeled_t[sx][sy] == 0:
                            labeled_t[sx][sy] = comp_id_t
                            c_queue.append((sx, sy))
                components_t[comp_id_t] = c_pixels
    if components_t:
        main_comp_id_t = max(components_t.keys(), key=lambda k: len(components_t[k]))
        for cid, pts in components_t.items():
            if cid != main_comp_id_t and len(pts) < 140:
                for px, py in pts:
                    t_pixels[px, py] = (255, 255, 255, 0)
                    
    top_bbox = top_rgba.getbbox()
    top_trimmed = top_rgba.crop(top_bbox) if top_bbox else top_rgba
    
    # Rotate 270 deg so front is pointing UP
    top_rotated = top_trimmed.rotate(270, expand=True)
    
    target_top_size = (200, 360)
    ttw, tth = target_top_size
    max_tw, max_th = int(ttw * 0.94), int(tth * 0.94)
    scale_t = min(max_tw / top_rotated.width, max_th / top_rotated.height)
    new_tw = int(top_rotated.width * scale_t)
    new_th = int(top_rotated.height * scale_t)
    top_resized = top_rotated.resize((new_tw, new_th), Image.Resampling.LANCZOS)
    top_canvas = Image.new('RGBA', target_top_size, (255, 255, 255, 0))
    top_canvas.paste(top_resized, ((ttw - new_tw) // 2, (tth - new_th) // 2), top_resized)
    os.makedirs(os.path.dirname(os.path.abspath(top_dest)), exist_ok=True)
    top_canvas.save(top_dest, 'PNG')
    
    return True, True

def run():
    with open('backend/data/vehicle_blueprints_master_index.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    blueprints = data.get('blueprints', [])
    
    # Process distinct blueprints across all 36 brands
    processed = 0
    matched_models = {}
    
    for bp in blueprints:
        raw_rel = bp.get('relative_raw_path')
        if not raw_rel:
            continue
        raw_full = os.path.join('backend/data', raw_rel)
        if not os.path.exists(raw_full):
            continue
            
        brand_slug = bp.get('brand_slug', 'other')
        file_id = bp.get('file_id', 1)
        model_name = bp.get('model_name', 'model')
        model_slug = sanitize_slug(model_name)
        
        key = f"{brand_slug}::{model_slug}"
        if key in matched_models and len(matched_models[key]) >= 2:
            continue
            
        lat_path = f"frontend/public/vehicles/models/{brand_slug}/{brand_slug}_{file_id}_{model_slug}_lat.png"
        top_path = f"frontend/public/vehicles/models/{brand_slug}/{brand_slug}_{file_id}_{model_slug}_top.png"
        
        ok_l, ok_t = clean_and_extract_pair(raw_full, lat_path, top_path)
        if ok_l and ok_t:
            bp['lateral_image'] = f"/vehicles/models/{brand_slug}/{brand_slug}_{file_id}_{model_slug}_lat.png"
            bp['top_image'] = f"/vehicles/models/{brand_slug}/{brand_slug}_{file_id}_{model_slug}_top.png"
            matched_models.setdefault(key, []).append(bp)
            processed += 1
            if processed % 100 == 0:
                print(f"Extracted {processed} paired model blueprints...")
                
    print(f"\nDone! Successfully extracted {processed} paired model blueprints across all 36 brands!")
    
    with open('backend/data/vehicle_blueprints_master_index.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    with open('frontend/src/data/vehicle_blueprints_master_index.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Master index updated with model image paths.")

if __name__ == '__main__':
    run()
