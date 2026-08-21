import os
from PIL import Image

def create_crisp_blueprint_lateral(raw_p, crop_box, dest_p, target_size=(640, 360)):
    im = Image.open(raw_p)
    crop = im.crop(crop_box)
    rgba = crop.convert("RGBA")
    w, h = rgba.size
    pixels = rgba.load()
    
    # 1. Erase title in the first 25px top left
    for y in range(min(h, 24)):
        for x in range(min(w, 150)):
            pixels[x, y] = (255, 255, 255, 255)
            
    # 2. Erase bottom dimension lines
    for y in range(max(0, h - 22), h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r < 210 and g < 210 and b < 210:
                pixels[x, y] = (255, 255, 255, 255)
                
    # 3. Transparentize outer white background (leave inner grey and glass untouched)
    # Using BFS with boundary check
    from collections import deque
    visited = [[False]*h for _ in range(w)]
    queue = deque()
    
    for x in range(w):
        for y in (0, h - 1):
            r, g, b, a = pixels[x, y]
            if r > 240 and g > 240 and b > 240:
                queue.append((x, y))
                visited[x][y] = True
    for y in range(h):
        for x in (0, w - 1):
            if not visited[x][y]:
                r, g, b, a = pixels[x, y]
                if r > 240 and g > 240 and b > 240:
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
                    
    bbox = rgba.getbbox()
    trimmed = rgba.crop(bbox) if bbox else rgba
    
    tw, th = target_size
    max_w, max_h = int(tw * 0.94), int(th * 0.84)
    ratio = min(max_w / trimmed.width, max_h / trimmed.height)
    new_w = int(trimmed.width * ratio)
    new_h = int(trimmed.height * ratio)
    
    resized = trimmed.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", target_size, (255, 255, 255, 0))
    canvas.paste(resized, ((tw - new_w) // 2, (th - new_h) // 2), resized)
    
    canvas.save(dest_p, "PNG")
    print(f"Saved crisp lateral: {dest_p}")

def run():
    raw_dir = "backend/data/blueprints_raw/toyota"
    out_dir = "frontend/public/vehicles/thumbnails"
    os.makedirs(out_dir, exist_ok=True)
    
    # Accurate crops from raw blueprints
    configs = {
        "camioneta-doble-cabina.png": ("TOYOTA (45).png", (0, 0, 270, 140)), # Hilux Double Cab
        "pickup.png": ("TOYOTA (45).png", (0, 0, 270, 140)),
        "camioneta-cabina-y-media.png": ("TOYOTA (50).png", (0, 0, 270, 140)), # Tundra TRD Pro
        "camioneta-1-cabina.png": ("TOYOTA (27).png", (0, 0, 270, 140)), # Hilux Single Cab
        "sedan.png": ("TOYOTA (46).png", (0, 0, 270, 140)), # Corolla Sedan
        "hatchback.png": ("TOYOTA (367).png", (0, 0, 270, 140)), # Yaris Hatchback
        "suv.png": ("TOYOTA (123).png", (0, 0, 270, 140)), # RAV4 SUV
        "station-wagon.png": ("TOYOTA (7).png", (0, 0, 270, 140)), # ProAce Wagon
        "microbus-pasajeros.png": ("TOYOTA (1).png", (0, 0, 270, 150)), # Hiace Passenger
        "microbus-carga.png": ("TOYOTA (11).png", (0, 0, 270, 150)), # Hiace Cargo
        "camion-carga.png": ("TOYOTA (14).png", (0, 0, 270, 150)), # Dyna Truck
        "cabezal.png": ("TOYOTA (14).png", (0, 0, 270, 150)),
        "convertible.png": ("TOYOTA (53).png", (0, 0, 270, 140)),
        "default.png": ("TOYOTA (45).png", (0, 0, 270, 140)),
    }
    
    for fn, (raw_f, box) in configs.items():
        src = os.path.join(raw_dir, raw_f)
        dest = os.path.join(out_dir, fn)
        create_crisp_blueprint_lateral(src, box, dest)

if __name__ == "__main__":
    run()
