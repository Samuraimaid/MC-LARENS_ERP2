import os
from PIL import Image
from collections import deque

def crop_and_clean_raw_lateral(raw_path, box=(0, 0, 270, 140), target_size=(640, 360)):
    im = Image.open(raw_path)
    cropped = im.crop(box)
    rgba = cropped.convert("RGBA")
    w, h = rgba.size
    pixels = rgba.load()
    
    # 1. Erase title in the first 25px on the top left
    for y in range(min(h, 25)):
        for x in range(min(w, 160)):
            r, g, b, a = pixels[x, y]
            if r < 140 and g < 140 and b < 140:
                pixels[x, y] = (255, 255, 255, 255)
                
    # 2. Erase dimension lines below the tires
    for y in range(max(0, h - 25), h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r < 200 and g < 200 and b < 200:
                # If thin line
                pixels[x, y] = (255, 255, 255, 255)
                
    # 3. Flood fill outer background to transparent
    visited = [[False]*h for _ in range(w)]
    queue = deque()
    
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
                    
    # Trim transparent borders
    bbox = rgba.getbbox()
    trimmed = rgba.crop(bbox) if bbox else rgba
    
    tw, th = target_size
    max_w, max_h = int(tw * 0.92), int(th * 0.82)
    ratio = min(max_w / trimmed.width, max_h / trimmed.height)
    new_w = int(trimmed.width * ratio)
    new_h = int(trimmed.height * ratio)
    
    resized = trimmed.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", target_size, (255, 255, 255, 0))
    canvas.paste(resized, ((tw - new_w) // 2, (th - new_h) // 2), resized)
    return canvas

def generate_all_raw_thumbnails():
    raw_dir = "backend/data/blueprints_raw/toyota"
    out_dir = "frontend/public/vehicles/thumbnails"
    os.makedirs(out_dir, exist_ok=True)
    
    configs = {
        "camioneta-doble-cabina.png": ("TOYOTA (45).png", (0, 0, 270, 140)), # Hilux Double Cab
        "pickup.png": ("TOYOTA (45).png", (0, 0, 270, 140)),
        "camioneta-cabina-y-media.png": ("TOYOTA (50).png", (0, 0, 270, 140)), # Tundra TRD Pro
        "camioneta-1-cabina.png": ("TOYOTA (27).png", (0, 0, 270, 140)), # Hilux Single Cab
        "sedan.png": ("TOYOTA (46).png", (0, 0, 270, 140)), # Corolla Sedan
        "hatchback.png": ("TOYOTA (367).png", (0, 0, 270, 140)), # GR Yaris Hatchback
        "suv.png": ("TOYOTA (123).png", (0, 0, 270, 140)), # RAV4 SUV
        "station-wagon.png": ("TOYOTA (7).png", (0, 0, 270, 140)), # ProAce Wagon
        "microbus-pasajeros.png": ("TOYOTA (1).png", (0, 0, 270, 150)), # Hiace Passenger
        "microbus-carga.png": ("TOYOTA (11).png", (0, 0, 270, 150)), # Hiace Cargo
        "camion-carga.png": ("TOYOTA (14).png", (0, 0, 270, 150)), # Dyna Truck
        "cabezal.png": ("TOYOTA (14).png", (0, 0, 270, 150)),
        "convertible.png": ("TOYOTA (53).png", (0, 0, 270, 140)),
        "default.png": ("TOYOTA (45).png", (0, 0, 270, 140)),
    }
    
    for fn, (raw_fn, box) in configs.items():
        raw_p = os.path.join(raw_dir, raw_fn)
        if not os.path.exists(raw_p):
            raw_p = os.path.join(raw_dir, "TOYOTA (45).png")
        clean_img = crop_and_clean_raw_lateral(raw_p, box, (640, 360))
        clean_img.save(os.path.join(out_dir, fn), "PNG")
        print(f"Generated pristine thumbnail from raw: {fn}")

if __name__ == "__main__":
    generate_all_raw_thumbnails()
