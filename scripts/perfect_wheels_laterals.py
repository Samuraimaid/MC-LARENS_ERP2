import os
from PIL import Image
from collections import deque

def extract_perfect_full_wheels_lateral(raw_p, crop_box, dest_p, target_size=(640, 360)):
    im = Image.open(raw_p)
    crop = im.crop(crop_box)
    rgba = crop.convert("RGBA")
    w, h = rgba.size
    pixels = rgba.load()
    
    # 1. Erase title in the first 24px top left
    for y in range(min(h, 24)):
        for x in range(min(w, 150)):
            pixels[x, y] = (255, 255, 255, 0)
            
    # 2. Precision cleanup of dimension lines while PRESERVING 100% of round tires:
    # Dimension line is below y=106
    for y in range(106, h):
        for x in range(w):
            pixels[x, y] = (255, 255, 255, 0)
            
    # Under-car cleanup between wheels (x from 82 to 175):
    for y in range(93, 106):
        for x in range(82, 178):
            pixels[x, y] = (255, 255, 255, 0)
            
    # Front bumper under-space (x <= 25):
    for y in range(92, 106):
        for x in range(min(w, 26)):
            pixels[x, y] = (255, 255, 255, 0)
            
    # Rear bumper under-space (x >= 244):
    for y in range(94, 106):
        for x in range(244, w):
            pixels[x, y] = (255, 255, 255, 0)
            
    # 3. Flood-fill transparent outer background from all 4 borders
    visited = [[False]*h for _ in range(w)]
    queue = deque()
    
    for x in range(w):
        for y in (0, h - 1):
            r, g, b, a = pixels[x, y]
            if a > 0 and r > 240 and g > 240 and b > 240:
                queue.append((x, y))
                visited[x][y] = True
    for y in range(h):
        for x in (0, w - 1):
            if not visited[x][y]:
                r, g, b, a = pixels[x, y]
                if a > 0 and r > 240 and g > 240 and b > 240:
                    queue.append((x, y))
                    visited[x][y] = True
                    
    while queue:
        cx, cy = queue.popleft()
        pixels[cx, cy] = (255, 255, 255, 0)
        for dx, dy in ((-1,0), (1,0), (0,-1), (0,1)):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                r, g, b, a = pixels[nx, ny]
                if r > 240 and g > 240 and b > 240:
                    visited[nx][ny] = True
                    queue.append((nx, ny))
                    
    # Clean floating island artifacts (< 120 pixels)
    labeled = [[0]*h for _ in range(w)]
    comp_id = 0
    components = {}
    for x in range(w):
        for y in range(h):
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
                        if 0 <= sx < w and 0 <= sy < h and pixels[sx, sy][3] > 0 and labeled[sx][sy] == 0:
                            labeled[sx][sy] = comp_id
                            c_queue.append((sx, sy))
                components[comp_id] = c_pixels
                
    for cid, pts in components.items():
        if len(pts) < 120:
            for px, py in pts:
                pixels[px, py] = (255, 255, 255, 0)
                
    bbox = rgba.getbbox()
    trimmed = rgba.crop(bbox) if bbox else rgba
    
    tw, th = target_size
    max_w, max_h = int(tw * 0.94), int(th * 0.85)
    ratio = min(max_w / trimmed.width, max_h / trimmed.height)
    new_w = int(trimmed.width * ratio)
    new_h = int(trimmed.height * ratio)
    
    resized = trimmed.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", target_size, (255, 255, 255, 0))
    canvas.paste(resized, ((tw - new_w) // 2, (th - new_h) // 2), resized)
    canvas.save(dest_p, "PNG")
    print(f"Generated perfect full-wheel lateral: {dest_p}")

def run_all_perfect_wheels():
    raw_dir = "backend/data/blueprints_raw/toyota"
    out_dir = "frontend/public/vehicles/thumbnails"
    
    configs = {
        "camioneta-doble-cabina.png": ("TOYOTA (45).png", (0, 0, 270, 120)), # Hilux Double Cab
        "pickup.png": ("TOYOTA (45).png", (0, 0, 270, 120)),
        "camioneta-cabina-y-media.png": ("TOYOTA (50).png", (0, 0, 270, 120)), # Tundra TRD Pro
        "camioneta-1-cabina.png": ("TOYOTA (27).png", (0, 0, 270, 120)), # Hilux Single Cab
        "sedan.png": ("TOYOTA (46).png", (0, 0, 270, 120)), # Corolla Sedan
        "hatchback.png": ("TOYOTA (367).png", (0, 0, 270, 120)), # Yaris
        "suv.png": ("TOYOTA (123).png", (0, 0, 270, 120)), # RAV4 / Sorento style
        "station-wagon.png": ("TOYOTA (7).png", (0, 0, 270, 120)), # ProAce
        "microbus-pasajeros.png": ("TOYOTA (1).png", (0, 0, 270, 125)), # Hiace Passenger
        "microbus-carga.png": ("TOYOTA (11).png", (0, 0, 270, 125)), # Hiace Cargo
        "camion-carga.png": ("TOYOTA (14).png", (0, 0, 270, 125)), # Dyna Truck
        "cabezal.png": ("TOYOTA (14).png", (0, 0, 270, 125)),
        "convertible.png": ("TOYOTA (53).png", (0, 0, 270, 120)),
        "default.png": ("TOYOTA (45).png", (0, 0, 270, 120)),
    }
    
    for fn, (raw_f, box) in configs.items():
        src = os.path.join(raw_dir, raw_f)
        dest = os.path.join(out_dir, fn)
        extract_perfect_full_wheels_lateral(src, box, dest)

if __name__ == "__main__":
    run_all_perfect_wheels()
