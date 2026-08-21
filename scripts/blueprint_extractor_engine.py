"""
MC-LARENS ERP: Universal Blueprint Extractor Engine
Extracts high-resolution, transparent, 100% paired Lateral and Top-Down views
from any manufacturer blueprint across all 36 automotive brands.
"""

import os
from PIL import Image
from collections import deque

def extract_lateral_view(raw_path: str, dest_path: str, target_size=(640, 360)):
    if not os.path.exists(raw_path):
        return False
    im = Image.open(raw_path)
    w, h = im.size
    
    # Lateral view is in top-left quadrant
    crop = im.crop((0, 0, int(w * 0.70), int(h * 0.36)))
    rgba = crop.convert('RGBA')
    cw, ch = rgba.size
    pixels = rgba.load()
    
    # 1. Erase title in top-left
    for y in range(min(ch, 22)):
        for x in range(min(cw, 160)):
            pixels[x, y] = (255, 255, 255, 0)
            
    # 2. Erase bottom dimension lines below wheel contact points
    for y in range(max(0, ch - 22), ch):
        for x in range(cw):
            pixels[x, y] = (255, 255, 255, 0)
            
    # 3. Flood fill transparent background
    visited = [[False]*ch for _ in range(cw)]
    queue = deque()
    for x in range(cw):
        for y in (0, ch - 1):
            r, g, b, a = pixels[x, y]
            if a > 0 and r > 230 and g > 230 and b > 230:
                queue.append((x, y))
                visited[x][y] = True
    for y in range(ch):
        for x in (0, cw - 1):
            if not visited[x][y]:
                r, g, b, a = pixels[x, y]
                if a > 0 and r > 230 and g > 230 and b > 230:
                    queue.append((x, y))
                    visited[x][y] = True
                    
    while queue:
        cx, cy = queue.popleft()
        pixels[cx, cy] = (255, 255, 255, 0)
        for dx, dy in ((-1,0), (1,0), (0,-1), (0,1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < cw and 0 <= ny < ch and not visited[nx][ny]:
                r, g, b, a = pixels[nx, ny]
                if r > 230 and g > 230 and b > 230:
                    visited[nx][ny] = True
                    queue.append((nx, ny))
                    
    # 4. Connected components: keep the car
    labeled = [[0]*ch for _ in range(cw)]
    comp_id = 0
    components = {}
    for x in range(cw):
        for y in range(ch):
            if pixels[x, y][3] > 0 and labeled[x][y] == 0:
                comp_id += 1
                c_pixels = []
                c_queue = deque([(x, y)])
                labeled[x][y] = comp_id
                while c_queue:
                    qx, qy = c_queue.popleft()
                    c_pixels.append((qx, qy))
                    for dx, dy in ((-1,0), (1,0), (0,-1), (0,1)):
                        sx, sy = qx + dx, qy + dy
                        if 0 <= sx < cw and 0 <= sy < ch and pixels[sx, sy][3] > 0 and labeled[sx][sy] == 0:
                            labeled[sx][sy] = comp_id
                            c_queue.append((sx, sy))
                components[comp_id] = c_pixels
                
    if components:
        main_comp_id = max(components.keys(), key=lambda k: len(components[k]))
        for cid, pts in components.items():
            if cid != main_comp_id and len(pts) < 140:
                for px, py in pts:
                    pixels[px, py] = (255, 255, 255, 0)
                    
    bbox = rgba.getbbox()
    trimmed = rgba.crop(bbox) if bbox else rgba
    
    tw, th = target_size
    max_w, max_h = int(tw * 0.94), int(th * 0.94)
    scale = min(max_w / trimmed.width, max_h / trimmed.height)
    new_w = int(trimmed.width * scale)
    new_h = int(trimmed.height * scale)
    
    resized = trimmed.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', target_size, (255, 255, 255, 0))
    canvas.paste(resized, ((tw - new_w) // 2, (th - new_h) // 2), resized)
    
    os.makedirs(os.path.dirname(os.path.abspath(dest_path)), exist_ok=True)
    canvas.save(dest_path, 'PNG')
    return True

def extract_top_down_view(raw_path: str, dest_path: str, target_size=(200, 360)):
    if not os.path.exists(raw_path):
        return False
    im = Image.open(raw_path)
    w, h = im.size
    
    # Top-down view is in the lower-left or middle-left quadrant
    # For standard 3-row layout: starts around h*0.50..h*0.65 to h
    # Let's crop from h*0.50 to h
    crop = im.crop((5, int(h * 0.50), int(w * 0.70), h))
    rgba = crop.convert('RGBA')
    cw, ch = rgba.size
    pixels = rgba.load()
    
    # 1. Erase bottom scale bar (bottom 25px, x < 150) and bottom-right logo
    for y in range(max(0, ch - 25), ch):
        for x in range(min(cw, 150)):
            pixels[x, y] = (255, 255, 255, 0)
    for y in range(max(0, ch - 30), ch):
        for x in range(max(0, cw - 60), cw):
            pixels[x, y] = (255, 255, 255, 0)
            
    # 2. Flood fill transparent background
    visited = [[False]*ch for _ in range(cw)]
    queue = deque()
    for x in range(cw):
        for y in (0, ch - 1):
            r, g, b, a = pixels[x, y]
            if a > 0 and r > 230 and g > 230 and b > 230:
                queue.append((x, y))
                visited[x][y] = True
    for y in range(ch):
        for x in (0, cw - 1):
            if not visited[x][y]:
                r, g, b, a = pixels[x, y]
                if a > 0 and r > 230 and g > 230 and b > 230:
                    queue.append((x, y))
                    visited[x][y] = True
                    
    while queue:
        cx, cy = queue.popleft()
        pixels[cx, cy] = (255, 255, 255, 0)
        for dx, dy in ((-1,0), (1,0), (0,-1), (0,1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < cw and 0 <= ny < ch and not visited[nx][ny]:
                r, g, b, a = pixels[nx, ny]
                if r > 230 and g > 230 and b > 230:
                    visited[nx][ny] = True
                    queue.append((nx, ny))
                    
    # 3. Connected components: keep the car
    labeled = [[0]*ch for _ in range(cw)]
    comp_id = 0
    components = {}
    for x in range(cw):
        for y in range(ch):
            if pixels[x, y][3] > 0 and labeled[x][y] == 0:
                comp_id += 1
                c_pixels = []
                c_queue = deque([(x, y)])
                labeled[x][y] = comp_id
                while c_queue:
                    qx, qy = c_queue.popleft()
                    c_pixels.append((qx, qy))
                    for dx, dy in ((-1,0), (1,0), (0,-1), (0,1)):
                        sx, sy = qx + dx, qy + dy
                        if 0 <= sx < cw and 0 <= sy < ch and pixels[sx, sy][3] > 0 and labeled[sx][sy] == 0:
                            labeled[sx][sy] = comp_id
                            c_queue.append((sx, sy))
                components[comp_id] = c_pixels
                
    if components:
        main_comp_id = max(components.keys(), key=lambda k: len(components[k]))
        for cid, pts in components.items():
            if cid != main_comp_id and len(pts) < 140:
                for px, py in pts:
                    pixels[px, py] = (255, 255, 255, 0)
                    
    bbox = rgba.getbbox()
    trimmed = rgba.crop(bbox) if bbox else rgba
    
    # 4. Rotate 270 deg so FRONT is POINTING UP
    rotated = trimmed.rotate(270, expand=True)
    
    tw, th = target_size
    max_w, max_h = int(tw * 0.94), int(th * 0.94)
    scale = min(max_w / rotated.width, max_h / rotated.height)
    new_w = int(rotated.width * scale)
    new_h = int(rotated.height * scale)
    
    resized = rotated.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', target_size, (255, 255, 255, 0))
    canvas.paste(resized, ((tw - new_w) // 2, (th - new_h) // 2), resized)
    
    os.makedirs(os.path.dirname(os.path.abspath(dest_path)), exist_ok=True)
    canvas.save(dest_path, 'PNG')
    return True
