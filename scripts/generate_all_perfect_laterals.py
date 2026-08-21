import os
from PIL import Image

def process_perfect_crop(src_p, box, dest_p, target_size=(640, 360)):
    im = Image.open(src_p)
    crop = im.crop(box)
    rgba = crop.convert("RGBA")
    w, h = rgba.size
    pixels = rgba.load()
    
    # 1. Erase title in the first 22px
    for y in range(min(h, 22)):
        for x in range(min(w, 155)):
            pixels[x, y] = (255, 255, 255, 0)
            
    # 2. Erase bottom dimension lines
    for y in range(max(0, h - 16), h):
        for x in range(w):
            pixels[x, y] = (255, 255, 255, 0)
            
    # 3. Transparentize outer white background
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 0 and (r > 248 and g > 248 and b > 248):
                pixels[x, y] = (255, 255, 255, 0)
                
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
    print(f"Generated perfect lateral: {dest_p}")

def generate_all_perfect():
    raw_dir = "backend/data/blueprints_raw/toyota"
    out_dir = "frontend/public/vehicles/thumbnails"
    os.makedirs(out_dir, exist_ok=True)
    
    configs = {
        "camioneta-doble-cabina.png": ("TOYOTA (45).png", (0, 0, 270, 112)), # Hilux Double Cab
        "pickup.png": ("TOYOTA (45).png", (0, 0, 270, 112)),
        "camioneta-cabina-y-media.png": ("TOYOTA (50).png", (0, 0, 270, 112)), # Tundra TRD Pro
        "camioneta-1-cabina.png": ("TOYOTA (27).png", (0, 0, 270, 112)), # Hilux Single Cab
        "sedan.png": ("TOYOTA (46).png", (0, 0, 270, 112)), # Corolla
        "hatchback.png": ("TOYOTA (367).png", (0, 0, 270, 112)), # Yaris
        "suv.png": ("TOYOTA (123).png", (0, 0, 270, 112)), # RAV4
        "station-wagon.png": ("TOYOTA (7).png", (0, 0, 270, 112)), # ProAce
        "microbus-pasajeros.png": ("TOYOTA (1).png", (0, 0, 270, 125)), # Hiace Passenger
        "microbus-carga.png": ("TOYOTA (11).png", (0, 0, 270, 125)), # Hiace Cargo
        "camion-carga.png": ("TOYOTA (14).png", (0, 0, 270, 125)), # Dyna Truck
        "cabezal.png": ("TOYOTA (14).png", (0, 0, 270, 125)),
        "convertible.png": ("TOYOTA (53).png", (0, 0, 270, 112)),
        "default.png": ("TOYOTA (45).png", (0, 0, 270, 112)),
    }
    
    for fn, (raw_f, box) in configs.items():
        src = os.path.join(raw_dir, raw_f)
        dest = os.path.join(out_dir, fn)
        process_perfect_crop(src, box, dest)

if __name__ == "__main__":
    generate_all_perfect()
