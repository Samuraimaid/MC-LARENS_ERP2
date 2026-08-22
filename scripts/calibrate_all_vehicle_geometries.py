"""
MC-LARENS ERP: Detailed Glass Region Detector & Calibrator
"""

from PIL import Image
import os
import json

vehicles_dir = 'frontend/public/vehicles'

def analyze_vehicle(category_id, filename):
    filepath = os.path.join(vehicles_dir, filename)
    im = Image.open(filepath).convert('RGBA')
    w, h = im.size
    
    # Locate windshield (bright glass or dark rubber frame on front 10% - 40% of vehicle)
    # Windshield is between hood and roof.
    # Front sides are alongside front doors.
    # Rear sides are alongside rear doors.
    # Rear glass is between roof and trunk/bed/tailgate.
    
    print(f"\n--- {category_id} ({filename}) ---")
    # Sample horizontal slices
    # Let's find hood end / windshield start:
    for y in range(50, 160, 5):
        c = im.getpixel((100, y))
        l = im.getpixel((60, y))
        r = im.getpixel((140, y))
        # print first transition
        # print(f"y={y}: center={c[:3]}, left={l[:3]}")

# Let's inspect the pickup and suv and sedan
for cat, fn in [
    ('sedan', 'clean_sedan.png'),
    ('suv', 'clean_suv.png'),
    ('camioneta_doble_cabina', 'clean_camioneta_doble_cabina.png'),
    ('camioneta_cabina_media', 'clean_camioneta_cabina_media.png'),
    ('camioneta_1_cabina', 'clean_camioneta_1_cabina.png'),
    ('microbus_pasajeros', 'clean_microbus_pasajeros.png'),
    ('microbus_carga', 'clean_microbus_carga.png'),
    ('bus_mediano_coaster', 'clean_bus_mediano_coaster.png')
]:
    analyze_vehicle(cat, fn)
