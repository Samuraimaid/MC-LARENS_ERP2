import os
from PIL import Image
from collections import deque

def clean_view(raw_idx, crop_box, dest_p, target_size, is_top_down=False):
    raw_p = f'backend/data/blueprints_raw/toyota/TOYOTA ({raw_idx}).png'
    im = Image.open(raw_p)
    crop = im.crop(crop_box)
    rgba = crop.convert('RGBA')
    w, h = rgba.size
    pixels = rgba.load()
    
    if not is_top_down:
        # LATERAL VIEW:
        # Erase title in top-left
        for y in range(min(h, 22)):
            for x in range(min(w, 150)):
                pixels[x, y] = (255, 255, 255, 0)
        # Erase bottom dimension lines below wheel contact point
        for y in range(106, h):
            for x in range(w):
                pixels[x, y] = (255, 255, 255, 0)
    else:
        # TOP-DOWN VIEW:
        # Erase scale bar at bottom left and logo at bottom right
        for y in range(max(0, h - 25), h):
            for x in range(min(w, 120)):
                pixels[x, y] = (255, 255, 255, 0)
        for y in range(max(0, h - 30), h):
            for x in range(max(0, w - 60), w):
                pixels[x, y] = (255, 255, 255, 0)

    # Flood fill transparent background from borders
    visited = [[False]*h for _ in range(w)]
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            r, g, b, a = pixels[x, y]
            if a > 0 and r > 230 and g > 230 and b > 230:
                queue.append((x, y))
                visited[x][y] = True
    for y in range(h):
        for x in (0, w - 1):
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
            if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                r, g, b, a = pixels[nx, ny]
                if r > 230 and g > 230 and b > 230:
                    visited[nx][ny] = True
                    queue.append((nx, ny))
                    
    # Keep main component
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
                
    if components:
        main_comp_id = max(components.keys(), key=lambda k: len(components[k]))
        for cid, pts in components.items():
            if cid != main_comp_id and len(pts) < 140:
                for px, py in pts:
                    pixels[px, py] = (255, 255, 255, 0)
                    
    bbox = rgba.getbbox()
    trimmed = rgba.crop(bbox) if bbox else rgba
    
    if is_top_down:
        # Rotate 270 deg clockwise so front is UP
        target_img = trimmed.rotate(270, expand=True)
    else:
        target_img = trimmed
        
    tw, th = target_size
    max_w, max_h = int(tw * 0.94), int(th * 0.94)
    scale = min(max_w / target_img.width, max_h / target_img.height)
    new_w = int(target_img.width * scale)
    new_h = int(target_img.height * scale)
    
    resized = target_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', target_size, (255, 255, 255, 0))
    canvas.paste(resized, ((tw - new_w) // 2, (th - new_h) // 2), resized)
    canvas.save(dest_p, 'PNG')
    print(f'Done [{dest_p}]: {new_w}x{new_h}')

# EXACT MATCH TABLE: Each vehicle has ONE single blueprint ID for BOTH lateral & top-down!
vehicles_master = {
    # 1. Camioneta Doble Cabina / Hilux 2024 (Gris)
    'camioneta_doble_cabina': {
        'id': 45,
        'lat_box': (0, 0, 270, 118),
        'top_box': (5, 238, 265, 344),
        'lat_dest': 'frontend/public/vehicles/thumbnails/camioneta-doble-cabina.png',
        'top_dest': 'frontend/public/vehicles/clean_camioneta_doble_cabina.png',
    },
    'pickup': {
        'id': 45,
        'lat_box': (0, 0, 270, 118),
        'top_box': (5, 238, 265, 344),
        'lat_dest': 'frontend/public/vehicles/thumbnails/pickup.png',
        'top_dest': 'frontend/public/vehicles/clean_pickup.png',
    },
    'default': {
        'id': 45,
        'lat_box': (0, 0, 270, 118),
        'top_box': (5, 238, 265, 344),
        'lat_dest': 'frontend/public/vehicles/thumbnails/default.png',
        'top_dest': 'frontend/public/vehicles/clean_default.png',
    },
    # 2. Camioneta Cabina y Media / Tacoma (Gris oscuro con Sunroof)
    'camioneta_cabina_media': {
        'id': 50,
        'lat_box': (0, 0, 270, 118),
        'top_box': (5, 225, 265, 334),
        'lat_dest': 'frontend/public/vehicles/thumbnails/camioneta-cabina-y-media.png',
        'top_dest': 'frontend/public/vehicles/clean_camioneta_cabina_media.png',
    },
    # 3. Camioneta 1 Cabina / IMV 0 Flatbed (Gris claro)
    'camioneta_1_cabina': {
        'id': 47,
        'lat_box': (0, 0, 270, 118),
        'top_box': (5, 230, 265, 340),
        'lat_dest': 'frontend/public/vehicles/thumbnails/camioneta-1-cabina.png',
        'top_dest': 'frontend/public/vehicles/clean_camioneta_1_cabina.png',
    },
    # 4. SUV / Crossover / RAV4 (Azul Acero)
    'suv': {
        'id': 123,
        'lat_box': (0, 0, 270, 118),
        'top_box': (5, 140, 265, 292),
        'lat_dest': 'frontend/public/vehicles/thumbnails/suv.png',
        'top_dest': 'frontend/public/vehicles/clean_suv.png',
    },
    # 5. Sedán / Coupé / GR86 (Rojo brillante)
    'sedan': {
        'id': 366,
        'lat_box': (0, 0, 270, 118),
        'top_box': (5, 138, 265, 283),
        'lat_dest': 'frontend/public/vehicles/thumbnails/sedan.png',
        'top_dest': 'frontend/public/vehicles/clean_sedan.png',
    },
    # 6. Hatchback / GR Yaris Rally (Azul marino)
    'hatchback': {
        'id': 367,
        'lat_box': (0, 0, 270, 118),
        'top_box': (5, 138, 265, 283),
        'lat_dest': 'frontend/public/vehicles/thumbnails/hatchback.png',
        'top_dest': 'frontend/public/vehicles/clean_hatchback.png',
    },
    # 7. Station Wagon / ProAce Verso (Gris)
    'station_wagon': {
        'id': 7,
        'lat_box': (0, 0, 270, 118),
        'top_box': (5, 262, 265, 397),
        'lat_dest': 'frontend/public/vehicles/thumbnails/station-wagon.png',
        'top_dest': 'frontend/public/vehicles/clean_station_wagon.png',
    },
    # 8. Microbús Pasajeros / HiAce (Blanco)
    'microbus_pasajeros': {
        'id': 1,
        'lat_box': (0, 0, 270, 122),
        'top_box': (5, 140, 265, 290),
        'lat_dest': 'frontend/public/vehicles/thumbnails/microbus-pasajeros.png',
        'top_dest': 'frontend/public/vehicles/clean_microbus_pasajeros.png',
    },
    # 9. Microbús Carga / HiAce Techo Alto (Blanco)
    'microbus_carga': {
        'id': 11,
        'lat_box': (0, 0, 270, 122),
        'top_box': (5, 275, 265, 420),
        'lat_dest': 'frontend/public/vehicles/thumbnails/microbus-carga.png',
        'top_dest': 'frontend/public/vehicles/clean_microbus_carga.png',
    },
    # 10. Camión de Carga / Dyna (Blanco)
    'camion_carga': {
        'id': 14,
        'lat_box': (0, 0, 270, 122),
        'top_box': (5, 252, 265, 385),
        'lat_dest': 'frontend/public/vehicles/thumbnails/camion-carga.png',
        'top_dest': 'frontend/public/vehicles/clean_camion_1_cabina.png',
    },
    'cabezal': {
        'id': 14,
        'lat_box': (0, 0, 270, 122),
        'top_box': (5, 252, 265, 385),
        'lat_dest': 'frontend/public/vehicles/thumbnails/cabezal.png',
        'top_dest': 'frontend/public/vehicles/clean_camion_2_cabinas.png',
    },
    'convertible': {
        'id': 53,
        'lat_box': (0, 0, 270, 118),
        'top_box': (5, 140, 265, 280),
        'lat_dest': 'frontend/public/vehicles/thumbnails/convertible.png',
        'top_dest': 'frontend/public/vehicles/clean_convertible.png',
    },
}

for k, v in vehicles_master.items():
    raw_id = v['id']
    print(f"=== Processing {k} from blueprint TOYOTA ({raw_id}) ===")
    clean_view(raw_id, v['lat_box'], v['lat_dest'], target_size=(640, 360), is_top_down=False)
    clean_view(raw_id, v['top_box'], v['top_dest'], target_size=(200, 360), is_top_down=True)

# Also create aliases
aliases = {
    'clean_microbus_techo_alto.png': 'clean_microbus_carga.png',
    'clean_bus_mediano_coaster.png': 'clean_microbus_pasajeros.png',
    'clean_bus_grande_marcopolo.png': 'clean_camion_1_cabina.png',
    'clean_camion_carga_furgon.png': 'clean_camion_1_cabina.png',
}
for dest, src in aliases.items():
    src_p = os.path.join('frontend/public/vehicles', src)
    dest_p = os.path.join('frontend/public/vehicles', dest)
    if os.path.exists(src_p):
        Image.open(src_p).save(dest_p)
        print(f'Alias: {dest} <- {src}')

print("All unified 1:1 paired blueprints generated successfully!")
