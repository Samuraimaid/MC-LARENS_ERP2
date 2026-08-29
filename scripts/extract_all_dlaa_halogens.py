import os
import re
import sys
import json
import pymupdf
from PIL import Image
from pathlib import Path
from rapidocr_onnxruntime import RapidOCR

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

BRAND_MAP = {
    "TY": "Toyota",
    "TOYOTA": "Toyota",
    "NN": "Nissan",
    "NS": "Nissan",
    "NISSAN": "Nissan",
    "HD": "Honda",
    "HONDA": "Honda",
    "HY": "Hyundai",
    "HYUNDAI": "Hyundai",
    "KA": "Kia",
    "KIA": "Kia",
    "FD": "Ford",
    "FORD": "Ford",
    "CV": "Chevrolet",
    "CH": "Chevrolet",
    "CHEVROLET": "Chevrolet",
    "SZ": "Suzuki",
    "SUZUKI": "Suzuki",
    "MB": "Mitsubishi",
    "MT": "Mitsubishi",
    "MITSUBISHI": "Mitsubishi",
    "IS": "Isuzu",
    "ISUZU": "Isuzu",
    "MZ": "Mazda",
    "MAZDA": "Mazda",
    "VW": "Volkswagen",
    "VOLKSWAGEN": "Volkswagen",
    "RN": "Renault",
    "RENAULT": "Renault",
    "PG": "Peugeot",
    "PEUGEOT": "Peugeot",
    "BM": "BMW",
    "BMW": "BMW",
    "AD": "Audi",
    "AUDI": "Audi",
    "MBZ": "Mercedes Benz",
    "SN": "Scion",
    "SCION": "Scion",
    "DH": "Daihatsu",
    "DAIHATSU": "Daihatsu",
    "BYD": "BYD",
    "DF": "DFSK",
    "CHG": "Changan",
    "CHANGAN": "Changan",
    "GW": "Great Wall",
    "HV": "Haval",
    "HAVAL": "Haval",
    "CHY": "Chery",
    "CHERY": "Chery",
    "JC": "JAC",
    "JAC": "JAC",
    "GL": "Geely",
    "GEELY": "Geely",
    "FT": "Foton",
    "FOTON": "Foton",
    "SUBARU": "Subaru",
    "SB": "Subaru",
    "JEEP": "Jeep",
    "JP": "Jeep",
    "RAM": "RAM",
    "LX": "Lexus",
    "LEXUS": "Lexus",
}

BODY_TYPE_KEYWORDS = {
    "SEDAN": "sedan",
    "HATCHBACK": "hatchback",
    "HB": "hatchback",
    "PICKUP": "pickup",
    "PICK UP": "pickup",
    "SUV": "suv",
    "VAN": "van",
    "CAB": "pickup",
    "DOUBLE CAB": "pickup",
    "SINGLE CAB": "pickup",
    "CROSS": "suv",
}

def load_erp_vehicles():
    master_path = Path("backend/data/vehicle_blueprints_master_index.json")
    if not master_path.exists():
        return {}
    with open(master_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    erp_db = {}
    for bp in data.get("blueprints", []):
        brand = bp.get("brand")
        if not brand:
            continue
        brand_key = brand.strip().lower()
        if brand_key not in erp_db:
            erp_db[brand_key] = []
        erp_db[brand_key].append(bp)
    return erp_db

def parse_year_range(text):
    m = re.search(r"(\d{4})\s*[\-~–]\s*(\d{4}|ON|PRESENT)", text, re.IGNORECASE)
    if m:
        y_start = int(m.group(1))
        y_end_str = m.group(2).upper()
        y_end = 2026 if ("ON" in y_end_str or "PRESENT" in y_end_str) else int(y_end_str)
        return y_start, y_end
    m_single = re.search(r"\b(19\d{2}|20\d{2})\b", text)
    if m_single:
        y = int(m_single.group(1))
        return y, y
    return None, None

def extract_bulb_specs(text):
    bulb_type = "H11"
    wattage = "12V 55W"
    
    if "LED" in text.upper():
        bulb_type = "LED Integrado"
        m_led = re.search(r"12V\s*(\d+W)", text, re.IGNORECASE)
        if m_led:
            wattage = f"12V {m_led.group(1)}"
        else:
            wattage = "12V"
    
    m_bulb = re.search(r"\b(H1|H3|H4|H7|H8|H11|H16|9005|9006|HB3|HB4|H27|880|881)\b", text, re.IGNORECASE)
    if m_bulb:
        bulb_type = m_bulb.group(1).upper()
        
    m_watt = re.search(r"(12V\s*\d+W|\d+W)", text, re.IGNORECASE)
    if m_watt:
        wattage = m_watt.group(1).upper()
        if not wattage.startswith("12V"):
            wattage = f"12V {wattage}"

    return bulb_type, wattage

def find_matching_erp_vehicle(brand_name, raw_model_str, y_start, y_end, erp_vehicles):
    brand_key = brand_name.lower()
    if brand_key not in erp_vehicles:
        return None
    
    model_clean = raw_model_str.upper()
    for kw in ["FOR", "TY", "NN", "HD", "HY", "KA", "FD", "CV", "SZ", "MB", "IS", "MZ", "VW", "RN", "PG", "LX", "DH", "GW", "HV", "JC", "CH"]:
        model_clean = re.sub(rf"\b{kw}\b", "", model_clean).strip()
    
    model_clean = re.sub(r"\d{4}.*", "", model_clean).strip()
    model_tokens = set(re.findall(r"[A-Z0-9]+", model_clean))
    
    best_match = None
    max_overlap = 0
    
    for bp in erp_vehicles[brand_key]:
        bp_name = (bp.get("model_name") or bp.get("raw_header_text") or "").upper()
        bp_tokens = set(re.findall(r"[A-Z0-9]+", bp_name))
        
        overlap = len(model_tokens & bp_tokens)
        if overlap > max_overlap and overlap >= 1:
            max_overlap = overlap
            best_match = bp
            
    return best_match

def run_extraction():
    pdf_path = r"C:\Users\Xinon\Downloads\ilide.info-dlaa-fog-lamp-catalogue-pr_4b5c9e3e5b0404a5bfa3032e2a68e44c.pdf"
    if not os.path.exists(pdf_path):
        print(f"Error: PDF not found at {pdf_path}", flush=True)
        return

    dest_images_dir = Path("frontend/public/uploads/products/dlaa_halogens")
    dest_images_dir.mkdir(parents=True, exist_ok=True)
    
    erp_vehicles = load_erp_vehicles()
    print(f"Loaded {len(erp_vehicles)} brands from ERP vehicle master database.", flush=True)

    doc = pymupdf.open(pdf_path)
    engine = RapidOCR()
    
    # STEP 1: Process ALL Content Pages (Pages 54 to 184)
    print(f"Processing {len(doc)} catalog pages...", flush=True)
    
    products = []
    seen_skus = set()

    for p_idx in range(53, len(doc)):
        page = doc[p_idx]
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        
        ocr_res, _ = engine(img_bytes)
        if not ocr_res:
            continue
            
        page_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        pw, ph = page_img.size

        # Find all product cards on this page
        # In DLAA pages, cards are divided left (x < pw*0.5) and right (x >= pw*0.5)
        col1_blocks = []
        col2_blocks = []
        
        for block in ocr_res:
            box, txt, conf = block[0], block[1].strip(), block[2]
            cx = (box[0][0] + box[1][0]) / 2.0
            cy = (box[0][1] + box[2][1]) / 2.0
            if cx < pw * 0.5:
                col1_blocks.append((cy, cx, box, txt, conf))
            else:
                col2_blocks.append((cy, cx, box, txt, conf))
                
        for col_idx, col_items in enumerate([col1_blocks, col2_blocks]):
            # Find lines containing SKU or vehicle model
            for cy, cx, box, txt, conf in col_items:
                txt_upper = txt.upper().replace("~", "-")
                
                # Check for SKU pattern or card title pattern
                is_for_line = txt_upper.startswith("FOR") or "FOR " in txt_upper
                is_sku_line = bool(re.match(r"^[A-Z]{2,4}\d{2,5}[A-Z0-9\-]*$", txt_upper)) and not txt_upper.startswith("QTY") and not txt_upper.startswith("BULB") and not txt_upper.startswith("OUTSIDE")
                
                if not (is_for_line or is_sku_line):
                    continue
                
                # Group nearby text within +- 250px Y
                nearby = [b for b in col_items if abs(b[0] - cy) < 260]
                nearby_texts = [b[3].strip() for b in nearby]
                joined_nearby = " ".join(nearby_texts).upper()
                
                # Extract SKU
                sku = None
                # First check if any nearby line is pure SKU
                for nt in nearby_texts:
                    clean_nt = re.sub(r"(QTY|PAIRS|PAIR|CASE|SIZE|OUTSIDE|P\d+).*", "", nt.upper()).strip()
                    clean_nt = re.sub(r"[^A-Z0-9\-]", "", clean_nt).strip()
                    if re.match(r"^[A-Z]{2,4}\d{2,5}[A-Z0-9\-]*$", clean_nt):
                        sku = clean_nt
                        break
                
                if not sku and is_sku_line:
                    sku = re.sub(r"[^A-Z0-9\-]", "", txt_upper).strip()
                    
                if not sku or len(sku) < 3 or sku in seen_skus:
                    continue

                # Parse Brand
                brand_prefix = re.match(r"^([A-Z]{2,4})", sku)
                detected_brand = None
                if brand_prefix:
                    detected_brand = BRAND_MAP.get(brand_prefix.group(1))
                if not detected_brand:
                    for b_code, b_name in BRAND_MAP.items():
                        if f"FOR {b_code}" in joined_nearby or f"FOR{b_code}" in joined_nearby:
                            detected_brand = b_name
                            break
                if not detected_brand:
                    detected_brand = "Universal"
                    
                # Clean vehicle line
                veh_line = ""
                for nt in nearby_texts:
                    if nt.upper().startswith("FOR") or "FOR " in nt.upper():
                        veh_line = nt
                        break
                if not veh_line:
                    veh_line = joined_nearby
                    
                txt_clean = re.sub(r"[\u4e00-\u9fff\uff00-\uffef\u3000-\u303f]", "", veh_line.upper()).strip()
                y_start, y_end = parse_year_range(txt_clean)
                
                # Model name cleaning
                model_str = txt_clean
                model_str = re.sub(r"^FOR\s*", "", model_str)
                for b_code in BRAND_MAP.keys():
                    model_str = re.sub(rf"^{b_code}\s*", "", model_str)
                model_str = re.sub(r"\d{4}.*", "", model_str).strip()
                model_str = re.sub(r"[\/\(\)\~].*", "", model_str).strip()
                model_str = re.sub(r"[^A-Z0-9\s\-]", "", model_str).strip()
                if not model_str:
                    model_str = detected_brand
                    
                body_type = "sedan"
                for kw, bt in BODY_TYPE_KEYWORDS.items():
                    if kw in txt_clean:
                        body_type = bt
                        break
                        
                matching_bp = find_matching_erp_vehicle(detected_brand, model_str, y_start, y_end, erp_vehicles)
                bulb_type, wattage = extract_bulb_specs(joined_nearby)
                
                # Crop images
                col_left = 80 if col_idx == 0 else int(pw * 0.51)
                col_right = int(pw * 0.49) if col_idx == 0 else pw - 80
                card_top = max(0, int(cy - 270))
                card_bottom = min(ph, int(cy + 40))
                
                card_w = col_right - col_left
                card_h = card_bottom - card_top
                
                if card_w > 200 and card_h > 150:
                    card_crop = page_img.crop((col_left, card_top, col_right, card_bottom))
                    cw, ch = card_crop.size
                    
                    set_filename = f"{sku}_1_set.png"
                    crop_set = card_crop.crop((int(cw * 0.24), 0, int(cw * 0.73), int(ch * 0.88)))
                    crop_set.save(dest_images_dir / set_filename, "PNG", optimize=True)
                    
                    veh_filename = f"{sku}_2_vehicle.png"
                    crop_veh = card_crop.crop((0, int(ch * 0.05), int(cw * 0.26), int(ch * 0.88)))
                    crop_veh.save(dest_images_dir / veh_filename, "PNG", optimize=True)
                    
                    wire_filename = f"{sku}_3_wiring.png"
                    crop_wire = card_crop.crop((int(cw * 0.72), 0, cw, int(ch * 0.68)))
                    crop_wire.save(dest_images_dir / wire_filename, "PNG", optimize=True)
                else:
                    set_filename = f"{sku}_1_set.png"
                    veh_filename = f"{sku}_2_vehicle.png"
                    wire_filename = f"{sku}_3_wiring.png"

                year_display = f"{y_start}-{y_end}" if (y_start and y_end and y_start != y_end) else (str(y_start) if y_start else "")
                year_suffix = f" {year_display}" if year_display else ""
                prod_name = f"HALOGENO OEM DLAA PARA {detected_brand.upper()} {model_str.upper()}{year_suffix}".strip()
                
                prod_doc = {
                    "product_id": f"prod_dlaa_{sku.lower()}",
                    "sku": sku,
                    "name": prod_name,
                    "brand": "DLAA",
                    "category": "accesorios_iluminacion",
                    "subcategory": "Halógenos OEM",
                    "description": f"Set de halógenos / neblineras OEM marca DLAA con carcasas originales para {detected_brand} {model_str}{year_suffix}. Incluye bombillos {bulb_type} ({wattage}), molduras/biseles, arnés de cables completo, relé y switch de tablero original.",
                    "price": 55.0,
                    "precio2": 50.0,
                    "precio_vip": 48.0,
                    "precio_casa_comercial": 45.0,
                    "cost": 30.0,
                    "installation_type": "optional",
                    "installation_price": 15.0,
                    "installation_time_minutes": 60,
                    "warranty_months": 12,
                    "stock": 0,
                    "images": [
                        f"/uploads/products/dlaa_halogens/{set_filename}",
                        f"/uploads/products/dlaa_halogens/{veh_filename}",
                        f"/uploads/products/dlaa_halogens/{wire_filename}"
                    ],
                    "specs": {
                        "bulb_type": bulb_type,
                        "voltage_wattage": wattage,
                        "housing_included": True,
                        "wiring_harness_included": True,
                        "switch_included": True,
                    },
                    "compatibility": {
                        "brands": [detected_brand] if detected_brand != "Universal" else [],
                        "models": [model_str.title()] if model_str else [],
                        "vehicle_types": [body_type],
                        "year_from": y_start,
                        "year_to": y_end
                    },
                    "erp_matched_blueprint": matching_bp.get("model_name") if matching_bp else None,
                    "catalog_page": p_idx + 1
                }
                
                products.append(prod_doc)
                seen_skus.add(sku)
                print(f"[OK] Page {p_idx+1}: {sku} -> {prod_name} ({bulb_type} {wattage})", flush=True)

    out_json = Path("backend/data/seeds/dlaa_halogens_seed.json")
    out_json.parent.mkdir(parents=True, exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(products, f, indent=2, ensure_ascii=False)
        
    print(f"\n==========================================", flush=True)
    print(f"Total DLAA Halogen Products Extracted: {len(products)}", flush=True)
    print(f"Images saved to: {dest_images_dir}", flush=True)
    print(f"Seed file created: {out_json}", flush=True)
    print(f"==========================================", flush=True)

if __name__ == "__main__":
    run_extraction()
