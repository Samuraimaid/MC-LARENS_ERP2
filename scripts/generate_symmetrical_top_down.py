import os
from PIL import Image, ImageOps

def create_full_symmetrical_top_down(raw_path, half_box, dest_path, target_size=(200, 360)):
    im = Image.open(raw_path)
    # half_box is (left_x, top_y, right_x, center_y) where center_y is the centerline of the car
    half_crop = im.crop(half_box)
    
    # Mirror vertically to create the bottom half
    flipped = ImageOps.flip(half_crop)
    
    # Combine top half and bottom half into a single complete horizontal top-down car
    w = half_crop.width
    h = half_crop.height
    full_h = h * 2
    full_car = Image.new("RGBA", (w, full_h), (255, 255, 255, 0))
    full_car.paste(half_crop, (0, 0))
    full_car.paste(flipped, (0, h))
    
    # Rotate 90 degrees CCW (so front points UP for vertical layout)
    # In blueprint, front is at LEFT (x=0) and rear is at RIGHT (x=w)
    # Rotating 270 deg (or 90 deg counter-clockwise) makes LEFT (front) point UP!
    vertical_car = full_car.rotate(270, expand=True)
    
    # Transparentize background white
    rgba = vertical_car.convert("RGBA")
    vw, vh = rgba.size
    pixels = rgba.load()
    
    for y in range(vh):
        for x in range(vw):
            r, g, b, a = pixels[x, y]
            if r > 240 and g > 240 and b > 240:
                pixels[x, y] = (255, 255, 255, 0)
                
    bbox = rgba.getbbox()
    trimmed = rgba.crop(bbox) if bbox else rgba
    
    tw, th = target_size
    max_w, max_h = int(tw * 0.90), int(th * 0.94)
    ratio = min(max_w / trimmed.width, max_h / trimmed.height)
    new_w = int(trimmed.width * ratio)
    new_h = int(trimmed.height * ratio)
    
    resized = trimmed.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", target_size, (255, 255, 255, 0))
    canvas.paste(resized, ((tw - new_w) // 2, (th - new_h) // 2), resized)
    canvas.save(dest_path, "PNG")
    print(f"Generated symmetrical top-down car: {dest_path}")

def run_top_down():
    raw_dir = "backend/data/blueprints_raw/toyota"
    out_dir = "frontend/public/vehicles"
    
    # (left_x, top_y, right_x, center_y)
    top_configs = {
        "clean_camioneta_doble_cabina.png": ("TOYOTA (45).png", (5, 220, 260, 270)), # Hilux
        "clean_sedan.png": ("TOYOTA (46).png", (5, 220, 260, 270)), # Corolla
        "clean_suv.png": ("TOYOTA (123).png", (5, 220, 260, 270)), # RAV4
        "clean_hatchback.png": ("TOYOTA (367).png", (5, 220, 260, 270)), # Yaris
        "clean_microbus_pasajeros.png": ("TOYOTA (1).png", (5, 220, 260, 270)), # Hiace
    }
    
    for fn, (raw_f, box) in top_configs.items():
        src = os.path.join(raw_dir, raw_f)
        dest = os.path.join(out_dir, fn)
        create_full_symmetrical_top_down(src, box, dest, (200, 360))

if __name__ == "__main__":
    run_top_down()
