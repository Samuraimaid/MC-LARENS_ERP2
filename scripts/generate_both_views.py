import os
from PIL import Image
from collections import deque

def clean_outside_flood(rgba_im, target_size=(640, 360)):
    w, h = rgba_im.size
    pixels = rgba_im.load()
    
    visited = [[False]*h for _ in range(w)]
    queue = deque()
    
    # Border pixels
    for x in range(w):
        for y in (0, h - 1):
            r, g, b, a = pixels[x, y]
            if r > 235 and g > 235 and b > 235:
                queue.append((x, y))
                visited[x][y] = True
    for y in range(h):
        for x in (0, w - 1):
            if not visited[x][y]:
                r, g, b, a = pixels[x, y]
                if r > 235 and g > 235 and b > 235:
                    queue.append((x, y))
                    visited[x][y] = True
                    
    while queue:
        cx, cy = queue.popleft()
        pixels[cx, cy] = (255, 255, 255, 0)
        
        for dx, dy in ((-1,0), (1,0), (0,-1), (0,1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                r, g, b, a = pixels[nx, ny]
                if r > 235 and g > 235 and b > 235:
                    visited[nx][ny] = True
                    queue.append((nx, ny))
                    
    bbox = rgba_im.getbbox()
    if bbox:
        trimmed = rgba_im.crop(bbox)
    else:
        trimmed = rgba_im
        
    tw, th = target_size
    max_w, max_h = int(tw * 0.90), int(th * 0.85)
    ratio = min(max_w / trimmed.width, max_h / trimmed.height)
    new_w = int(trimmed.width * ratio)
    new_h = int(trimmed.height * ratio)
    
    resized = trimmed.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", target_size, (255, 255, 255, 0))
    canvas.paste(resized, ((tw - new_w) // 2, (th - new_h) // 2), resized)
    return canvas

def generate_both_views():
    cleaned_dir = "backend/data/blueprints_cleaned/toyota"
    
    # 1. Lateral Silhouettes (640x360)
    lateral_configs = {
        "camioneta-doble-cabina.png": ("TOYOTA (45).png", (8, 25, 260, 116)),
        "pickup.png": ("TOYOTA (45).png", (8, 25, 260, 116)),
        "camioneta-cabina-y-media.png": ("TOYOTA (50).png", (8, 25, 260, 116)),
        "camioneta-1-cabina.png": ("TOYOTA (27).png", (8, 25, 260, 116)),
        "sedan.png": ("TOYOTA (46).png", (8, 25, 260, 116)),
        "hatchback.png": ("TOYOTA (367).png", (8, 25, 260, 116)),
        "suv.png": ("TOYOTA (123).png", (8, 25, 260, 116)),
        "station-wagon.png": ("TOYOTA (7).png", (8, 25, 260, 116)),
        "microbus-pasajeros.png": ("TOYOTA (1).png", (8, 25, 260, 126)),
        "microbus-carga.png": ("TOYOTA (11).png", (8, 25, 260, 126)),
        "camion-carga.png": ("TOYOTA (14).png", (8, 25, 260, 126)),
        "cabezal.png": ("TOYOTA (14).png", (8, 25, 260, 126)),
        "convertible.png": ("TOYOTA (53).png", (8, 25, 260, 116)),
        "default.png": ("TOYOTA (45).png", (8, 25, 260, 116)),
    }
    
    for fn, (src, box) in lateral_configs.items():
        p = os.path.join(cleaned_dir, src)
        im = Image.open(p).convert("RGBA")
        crop = im.crop(box)
        clean = clean_outside_flood(crop, (640, 360))
        clean.save(os.path.join("frontend/public/vehicles/thumbnails", fn), "PNG")
        print(f"Generated clean lateral: {fn}")
        
    # 2. Top-Down Views (200x360 or 400x200 vertical/horizontal)
    top_configs = {
        "clean_camioneta_doble_cabina.png": ("TOYOTA (45).png", (10, 215, 260, 310)),
        "clean_sedan.png": ("TOYOTA (46).png", (10, 215, 260, 310)),
        "clean_suv.png": ("TOYOTA (123).png", (10, 215, 260, 310)),
        "clean_hatchback.png": ("TOYOTA (367).png", (10, 215, 260, 310)),
        "clean_microbus_pasajeros.png": ("TOYOTA (1).png", (10, 215, 260, 310)),
    }
    
    for fn, (src, box) in top_configs.items():
        p = os.path.join(cleaned_dir, src)
        im = Image.open(p).convert("RGBA")
        crop = im.crop(box)
        # Rotate top down 90 deg so front is pointing UP (vertical)
        rotated = crop.rotate(90, expand=True)
        clean = clean_outside_flood(rotated, (200, 360))
        clean.save(os.path.join("frontend/public/vehicles", fn), "PNG")
        print(f"Generated clean top-down: {fn}")

if __name__ == "__main__":
    generate_both_views()
