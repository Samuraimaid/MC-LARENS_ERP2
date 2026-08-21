import os
from PIL import Image
from collections import deque

def precision_clean_lateral(raw_p, crop_box, dest_p, target_size=(640, 360)):
    im = Image.open(raw_p)
    crop = im.crop(crop_box)
    rgba = crop.convert("RGBA")
    w, h = rgba.size
    pixels = rgba.load()
    
    # 1. Erase title in the first 25px top left
    for y in range(min(h, 25)):
        for x in range(min(w, 160)):
            pixels[x, y] = (255, 255, 255, 0)
            
    # 2. Find wheels / tires bottom y
    # Dark pixels of tires are around x=30..80 (front wheel) and x=170..230 (rear wheel)
    # The dimension line is a thin line below tires (y >= 95)
    # Let's erase all pixels below y=94 that are NOT inside the round wheel
    for y in range(88, h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            # If it's a thin grey dimension line or text below y=94
            if y >= 96:
                # Check if it's tire rubber (dark grey/black with tire height) or dimension line
                # Dimension line is thin (height 1-2px) and has white above and below it
                # Or simply: if y > 98, erase everything!
                if y >= 98:
                    pixels[x, y] = (255, 255, 255, 0)
                    
    # 3. Transparentize all outer white/light background (> 242)
    # Flood fill from all 4 borders
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
                    
    # Clean any leftover stray floating pixels (connected components < 20 pixels)
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
                
    # Erase small floating artifacts (stray dimension numbers, stray dots < 100 pixels)
    for cid, pts in components.items():
        if len(pts) < 120:
            for px, py in pts:
                pixels[px, py] = (255, 255, 255, 0)
                
    bbox = rgba.getbbox()
    trimmed = rgba.crop(bbox) if bbox else rgba
    
    tw, th = target_size
    max_w, max_h = int(tw * 0.94), int(th * 0.82)
    ratio = min(max_w / trimmed.width, max_h / trimmed.height)
    new_w = int(trimmed.width * ratio)
    new_h = int(trimmed.height * ratio)
    
    resized = trimmed.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", target_size, (255, 255, 255, 0))
    canvas.paste(resized, ((tw - new_w) // 2, (th - new_h) // 2), resized)
    canvas.save(dest_p, "PNG")
    print(f"Generated laser-clean lateral: {dest_p}")

def precision_clean_all():
    raw_dir = "backend/data/blueprints_raw/toyota"
    out_dir = "frontend/public/vehicles/thumbnails"
    os.makedirs(out_dir, exist_ok=True)
    
    configs = {
        "camioneta-doble-cabina.png": ("TOYOTA (45).png", (0, 0, 270, 114)), # Hilux Double Cab
        "pickup.png": ("TOYOTA (45).png", (0, 0, 270, 114)),
        "camioneta-cabina-y-media.png": ("TOYOTA (50).png", (0, 0, 270, 114)), # Tundra TRD Pro
        "camioneta-1-cabina.png": ("TOYOTA (27).png", (0, 0, 270, 114)), # Hilux Single Cab
        "sedan.png": ("TOYOTA (46).png", (0, 0, 270, 114)), # Corolla Sedan
        "hatchback.png": ("TOYOTA (367).png", (0, 0, 270, 114)), # Yaris
        "suv.png": ("TOYOTA (123).png", (0, 0, 270, 114)), # RAV4
        "station-wagon.png": ("TOYOTA (7).png", (0, 0, 270, 114)), # ProAce
        "microbus-pasajeros.png": ("TOYOTA (1).png", (0, 0, 270, 120)), # Hiace Passenger
        "microbus-carga.png": ("TOYOTA (11).png", (0, 0, 270, 120)), # Hiace Cargo
        "camion-carga.png": ("TOYOTA (14).png", (0, 0, 270, 120)), # Dyna Truck
        "cabezal.png": ("TOYOTA (14).png", (0, 0, 270, 120)),
        "convertible.png": ("TOYOTA (53).png", (0, 0, 270, 114)),
        "default.png": ("TOYOTA (45).png", (0, 0, 270, 114)),
    }
    
    for fn, (raw_f, box) in configs.items():
        src = os.path.join(raw_dir, raw_f)
        dest = os.path.join(out_dir, fn)
        precision_clean_lateral(src, box, dest)

if __name__ == "__main__":
    precision_clean_all()
