#!/usr/bin/env python3
"""
MC-LARENS ERP - Generador y Normalizador Unificado de Semillas de Productos
Procesa los 6 catálogos de Grok:
1. DLAA (142 productos reales de iluminación con compatibilidad vehicular completa)
2. Fernández Sera (201 productos automotrices de Nicaragua)
3. Meguiar's (210 productos de detailing y cuidado automotriz)
4. Pioneer (157 productos de car audio / multimedia)
5. DS18 (820 productos de pro audio / car audio)
6. Auxbeam (194 productos de faros LED y driving lights)

Aplica la política de nombrado de imágenes para Google Cloud Storage:
  Principal:  {SKU}_main.{ext}
  Adicional:  {SKU}_add_{01..NN}.{ext}
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

GCS_PRODUCT_PREFIX = "https://storage.googleapis.com/mclarens-erp-products/products"

def sanitize_sku(sku: str, fallback_prefix: str = "PROD") -> str:
    if not sku:
        return f"{fallback_prefix}_{os.urandom(4).hex()}"
    clean = re.sub(r'[^a-zA-Z0-9_-]', '-', str(sku).strip())
    clean = re.sub(r'-+', '-', clean).strip('-_')
    return clean or f"{fallback_prefix}_{os.urandom(4).hex()}"

def get_ext_from_url_or_path(url_or_path: str, default_ext: str = ".jpg") -> str:
    if not url_or_path:
        return default_ext
    # Remove query string
    clean_path = url_or_path.split("?")[0]
    ext = Path(clean_path).suffix.lower()
    if ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        return ext if ext != ".jpeg" else ".jpg"
    return default_ext

def classify_fernandez_sera_item(name: str, raw_cats: List[str], desc: str) -> Tuple[str, str]:
    """Classifies a Fernandez Sera product into detailing vs lubricants with clean subcategories."""
    text = f"{name} {' '.join(raw_cats)} {desc}".lower()
    
    # 1. Lubricantes y Fluidos
    if any(k in text for k in ["aceite", "lubricante", "diesel", "diésel", "gasolina", "15w", "20w", "5w", "10w", "0w", "sae", "hidraulico", "hidráulico", "engranaje", "diferencial", "atf", "aw68", "aw46"]):
        if any(k in text for k in ["moto", "2t", "4t", "motus"]):
            return "lubricantes_fluidos", "Aceites para Motocicletas"
        elif any(k in text for k in ["diesel", "diésel"]):
            return "lubricantes_fluidos", "Aceites de Motor Diésel"
        elif any(k in text for k in ["gasolina", "synthetic", "sintetico", "sintético", "diamantis", "ignis", "euro"]):
            return "lubricantes_fluidos", "Aceites de Motor a Gasolina"
        elif any(k in text for k in ["engranaje", "diferencial", "transmision", "transmisión", "80w90", "85w140", "sae-90"]):
            return "lubricantes_fluidos", "Aceites de Transmisión y Engranajes"
        elif any(k in text for k in ["hidraulico", "hidráulico", "aw68", "aw46", "antidesgaste"]):
            return "lubricantes_fluidos", "Aceites Hidráulicos e Industriales"
        return "lubricantes_fluidos", "Aceites y Lubricantes de Motor"
    
    if any(k in text for k in ["freno", "frenos", "dot 3", "dot 4", "dot3", "dot4"]):
        return "lubricantes_fluidos", "Líquidos de Frenos y Dirección"
        
    if any(k in text for k in ["refrigerante", "coolant", "radiador", "anticongelante"]):
        return "lubricantes_fluidos", "Refrigerantes y Aditivos de Radiador"
        
    if any(k in text for k in ["aditivo", "tratamiento", "inyector", "octane", "combustible", "limpiador de carburador", "carb"]):
        return "lubricantes_fluidos", "Aditivos para Motor y Combustible"

    # 2. Detailing y Cuidado Automotriz
    if any(k in text for k in ["llanta", "llantas", "tire", "tire shine", "abrillantador de llanta", "stoner", "cristal"]):
        return "detailing_cuidado", "Abrillantadores y Cuidado de Llantas"
        
    if any(k in text for k in ["cera", "wax", "pulimento", "compound", "polish", "sellador", "brillo", "pasta"]):
        return "detailing_cuidado", "Ceras, Selladores y Pulimentos"
        
    if any(k in text for k in ["shampoo", "jabon", "jabón", "lavado", "foam", "espuma"]):
        return "detailing_cuidado", "Shampoo y Lavado Exterior"
        
    if any(k in text for k in ["ambientador", "aroma", "spray", "organico", "orgánico", "lata", "rejilla", "wrap"]):
        return "detailing_cuidado", "Aromatizantes y Purificadores"
        
    if any(k in text for k in ["interior", "cuero", "leather", "vinil", "tapiceria", "tapicería", "tablero"]):
        return "detailing_cuidado", "Limpieza y Restauración de Interiores"
        
    if any(k in text for k in ["desengrasante", "degreaser", "limpiador", "cleaner", "brake cleaner", "limpia contacto"]):
        return "detailing_cuidado", "Desengrasantes y Limpiadores Multiuso"
        
    if any(k in text for k in ["toalla", "microfibra", "esponja", "aplicador", "pad", "guante"]):
        return "detailing_cuidado", "Toallas, Microfibras y Aplicadores"

    # Default fallback to Detailing
    return "detailing_cuidado", "Cuidado Estético y Detailing"

def classify_meguiars_item(name: str, desc: str) -> Tuple[str, str]:
    text = f"{name} {desc}".lower()
    if any(k in text for k in ["cera", "wax", "ceramic", "cerámico", "sealant", "sellador"]):
        return "detailing_cuidado", "Ceras, Selladores y Cerámicos"
    if any(k in text for k in ["compound", "polish", "pulimento", "corte", "scratch", "ultra-pro", "swirl"]):
        return "detailing_cuidado", "Pulimentos y Compuestos de Corte"
    if any(k in text for k in ["shampoo", "wash", "lavado", "foam", "snow"]):
        return "detailing_cuidado", "Shampoo y Lavado Exterior"
    if any(k in text for k in ["tire", "wheel", "llanta", "rin", "endurance", "hot shine", "gel"]):
        return "detailing_cuidado", "Abrillantadores y Cuidado de Llantas"
    if any(k in text for k in ["interior", "leather", "cuero", "detailer", "cockpit", "tapiceria", "air re-fresher", "odor"]):
        return "detailing_cuidado", "Limpieza y Restauración de Interiores"
    if any(k in text for k in ["towel", "toalla", "microfiber", "microfibra", "pad", "applicator", "esponja"]):
        return "detailing_cuidado", "Toallas, Microfibras y Aplicadores"
    return "detailing_cuidado", "Cuidado y Mantenimiento Estético"

def classify_auxbeam_item(name: str, desc: str) -> Tuple[str, str]:
    text = f"{name} {desc}".lower()
    if any(k in text for k in ["light bar", "barra led", "barra de luz", "curved", "curva"]):
        return "iluminacion", "Barras LED y Focos Auxiliares"
    if any(k in text for k in ["bulb", "bombillo", "h4", "h7", "h11", "9005", "9006", "faro led"]):
        return "iluminacion", "Bombillos LED y Faros Delanteros"
    if any(k in text for k in ["pod", "fog", "neblinera", "driving light", "spot", "flood", "work light"]):
        return "iluminacion", "Faros Auxiliares y Driving Lights Off-Road"
    return "iluminacion", "Iluminación LED y Auxiliar"

def classify_pioneer_item(name: str, subcat: str) -> Tuple[str, str]:
    text = f"{name} {subcat}".lower()
    if any(k in text for k in ["multimedia", "dmh", "avh", "sph", "pantalla", "carplay", "android auto", "receptor"]):
        return "audio_multimedia", "Pantallas y Receptores Multimedia"
    if any(k in text for k in ["parlante", "ts-a", "ts-g", "coaxial", "set de medios", "bocina", "speaker"]):
        return "audio_multimedia", "Parlantes y Sets de Medios"
    if any(k in text for k in ["subwoofer", "ts-w", "bajo", "caja"]):
        return "audio_multimedia", "Subwoofers y Bajos"
    if any(k in text for k in ["amplificador", "gm-", "potencia", "power"]):
        return "audio_multimedia", "Amplificadores y Potencias"
    return "audio_multimedia", "Componentes de Audio Pioneer"

def classify_ds18_item(name: str, subcat: str) -> Tuple[str, str]:
    text = f"{name} {subcat}".lower()
    if any(k in text for k in ["subwoofer", "bajo", "zxi", "exl", "elite", "pro-"]):
        if "subwoofer" in text or "sub" in text:
            return "audio_multimedia", "Subwoofers y Bajos Pro Audio"
    if any(k in text for k in ["amplificador", "amp", "monoblock", "4 channel", "candor", "g2400"]):
        return "audio_multimedia", "Amplificadores y Potencias"
    if any(k in text for k in ["tweeter", "driver", "horn", "corneta", "difusor", "pro-tw"]):
        return "audio_multimedia", "Tweeters, Drivers y Cornetas"
    if any(k in text for k in ["medio", "midrange", "pro-x", "pro-gm", "pro-neor", "bocina", "parlante"]):
        return "audio_multimedia", "Parlantes y Medios Rangos Pro Audio"
    if any(k in text for k in ["cable", "kit", "rca", "fuse", "distribuidor", "porta"]):
        return "audio_multimedia", "Cableado e Instalación de Audio"
    if any(k in text for k in ["dsp", "crossover", "ecualizador", "procesador"]):
        return "audio_multimedia", "Procesadores DSP y Ecualizadores"
    if any(k in text for k in ["receptor", "radio", "pantalla", "head unit"]):
        return "audio_multimedia", "Pantallas y Receptores Multimedia"
    return "audio_multimedia", "Accesorios y Pro Audio DS18"

def process_dlaa_catalog() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Process DLAA catalog combining matched, universal, and unmatched."""
    dlaa_dir = Path("catalogos/dlaa")
    matched_path = dlaa_dir / "catalogo_matched.json"
    cat_all_path = dlaa_dir / "catalogo.json"
    
    # Load all products and map by handle/sku
    all_products = []
    if cat_all_path.exists():
        with open(cat_all_path, "r", encoding="utf-8") as f:
            all_products = json.load(f)
            
    # Load matched products for rich fitment
    matched_map = {}
    if matched_path.exists():
        with open(matched_path, "r", encoding="utf-8") as f:
            for p in json.load(f):
                handle = p.get("handle") or p.get("sku")
                if handle:
                    matched_map[handle] = p

    processed = []
    images_manifest = []

    for raw in all_products:
        handle = raw.get("handle") or raw.get("sku")
        matched = matched_map.get(handle, raw)
        
        sku = sanitize_sku(raw.get("sku") or raw.get("skus", [""])[0] or handle, "DLAA")
        name = raw.get("nombre") or raw.get("nombre_original") or f"Halógeno DLAA {sku}"
        
        # Vehicle compatibility extraction
        erp_matches = matched.get("erp_matches", [])
        brands = set()
        models = set()
        years = []
        
        if erp_matches:
            for m in erp_matches:
                if m.get("brand"):
                    brands.add(m["brand"].upper())
                if m.get("model"):
                    models.add(m["model"])
                label = m.get("label", "")
                y_matches = re.findall(r'\b(19\d\d|20\d\d)\b', label)
                for y in y_matches:
                    years.append(int(y))
        elif raw.get("fitment_raw"):
            fit = raw["fitment_raw"]
            for b in fit.get("brands", []):
                brands.add(b.upper())
            for mod in fit.get("models", []):
                models.add(mod)
            for y in fit.get("years", []):
                try:
                    years.append(int(y))
                except Exception:
                    pass

        year_from = min(years) if years else None
        year_to = max(years) if years else None
        
        # Images processing with {sku}_main and {sku}_add_XX
        main_source = raw.get("imagen_fuente_url") or raw.get("imagen_principal") or (raw.get("imagenes", [""])[0] if raw.get("imagenes") else "")
        add_sources = raw.get("imagenes_adicionales") or (raw.get("imagenes", [])[1:] if raw.get("imagenes") and len(raw.get("imagenes")) > 1 else [])
        
        main_ext = get_ext_from_url_or_path(main_source, ".jpg")
        main_filename = f"{sku}_main{main_ext}"
        main_url = f"/uploads/products/{main_filename}"
        
        image_urls = [main_url]
        media_list = [{
            "url": main_url,
            "gcs_url": f"{GCS_PRODUCT_PREFIX}/{main_filename}",
            "type": "main",
            "is_primary": True,
            "filename": main_filename,
            "source_url": main_source
        }]
        
        if main_source:
            images_manifest.append({
                "source": main_source,
                "target_filename": main_filename,
                "sku": sku,
                "type": "main"
            })
            
        for idx, add_src in enumerate(add_sources, 1):
            if isinstance(add_src, dict):
                add_src = add_src.get("imagen_fuente_url") or add_src.get("url") or ""
            add_src = str(add_src)
            add_ext = get_ext_from_url_or_path(add_src, ".jpg")
            add_filename = f"{sku}_add_{idx:02d}{add_ext}"
            add_url = f"/uploads/products/{add_filename}"
            image_urls.append(add_url)
            media_list.append({
                "url": add_url,
                "gcs_url": f"{GCS_PRODUCT_PREFIX}/{add_filename}",
                "type": "additional",
                "is_primary": False,
                "filename": add_filename,
                "source_url": add_src
            })
            if add_src:
                images_manifest.append({
                    "source": add_src,
                    "target_filename": add_filename,
                    "sku": sku,
                    "type": "additional"
                })

        try:
            raw_price = float(raw.get("precio") or 45.0)
            if raw_price > 500: # If price is placeholder or Chinese yuan
                price = 45.0
            else:
                price = raw_price
        except Exception:
            price = 45.0

        prod_doc = {
            "product_id": f"prod_dlaa_{sku.lower()}",
            "sku": sku,
            "name": name,
            "brand": "DLAA",
            "category": "iluminacion",
            "subcategory": "Faros Antiniebla / Neblineras",
            "description": raw.get("descripcion") or f"Juego de halógenos / faros antiniebla originales DLAA modelo {sku}.",
            "specs": raw.get("especificaciones") or {},
            "potencia": raw.get("potencia", "12V"),
            "tension_trabajo": raw.get("tension_trabajo", "12V"),
            "contenido_caja": raw.get("contenido_caja", "Par de halógenos, cableado, switch"),
            "price": round(price, 2),
            "precio1": round(price, 2),
            "precio2": round(price * 0.92, 2),
            "precio_vip": round(price * 0.88, 2),
            "precio_casa_comercial": round(price * 0.82, 2),
            "cost": round(price * 0.55, 2),
            "installation_type": "optional",
            "installation_price": 15.0,
            "installation_time_minutes": 60,
            "warranty_months": 12,
            "low_stock_threshold": 4,
            "stock": 0,
            "image_url": main_url,
            "images": image_urls,
            "media": media_list,
            "compatibility": {
                "brands": sorted(list(brands)),
                "models": sorted(list(models)),
                "year_from": year_from,
                "year_to": year_to,
                "erp_matches": erp_matches,
                "compatibilidad_texto": raw.get("compatibilidad") or (f"{', '.join(brands)} - {', '.join(models)}" if brands else "Universal"),
                "is_universal": len(brands) == 0
            },
            "source_catalog": "dlaa",
            "is_active": True
        }
        processed.append(prod_doc)

    print(f"[DLAA] Processed {len(processed)} products, {len(images_manifest)} images to sync.")
    return processed, images_manifest

def process_fernandez_sera() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Process Fernandez Sera catalog (201 items from Nicaragua in NIO)."""
    p_path = Path("catalogos/Fernandez_Sera/catalogo.json")
    if not p_path.exists():
        return [], []
        
    with open(p_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        items = data.get("productos", [])

    processed = []
    images_manifest = []

    for raw in items:
        sku = sanitize_sku(raw.get("sku") or raw.get("codigos", [""])[0] or raw.get("slug"), "FS")
        name = raw.get("nombre") or f"Producto {sku}"
        brand = raw.get("marca") or "AUTOMOTRIZ"
        
        # Parse price NIO and convert reference USD
        precio_nio = float(raw.get("precio_nio") or 0.0)
        # Standard FX reference ~36.8 NIO/USD
        price_usd = round(precio_nio / 36.8, 2) if precio_nio > 0 else 10.0

        main_source = raw.get("imagen_fuente_url") or raw.get("imagen_principal")
        main_ext = get_ext_from_url_or_path(main_source, ".jpg")
        main_filename = f"{sku}_main{main_ext}"
        main_url = f"/uploads/products/{main_filename}"

        image_urls = [main_url]
        media_list = [{
            "url": main_url,
            "gcs_url": f"{GCS_PRODUCT_PREFIX}/{main_filename}",
            "type": "main",
            "is_primary": True,
            "filename": main_filename,
            "source_url": main_source
        }]

        if main_source:
            images_manifest.append({
                "source": main_source,
                "target_filename": main_filename,
                "sku": sku,
                "type": "main"
            })

        add_sources = raw.get("imagenes_adicionales", [])
        for idx, add_item in enumerate(add_sources, 1):
            add_src = add_item.get("imagen_fuente_url") if isinstance(add_item, dict) else str(add_item)
            add_ext = get_ext_from_url_or_path(add_src, ".jpg")
            add_filename = f"{sku}_add_{idx:02d}{add_ext}"
            add_url = f"/uploads/products/{add_filename}"
            image_urls.append(add_url)
            media_list.append({
                "url": add_url,
                "gcs_url": f"{GCS_PRODUCT_PREFIX}/{add_filename}",
                "type": "additional",
                "is_primary": False,
                "filename": add_filename,
                "source_url": add_src
            })
            if add_src:
                images_manifest.append({
                    "source": add_src,
                    "target_filename": add_filename,
                    "sku": sku,
                    "type": "additional"
                })

        cats = raw.get("categorias", [])
        desc = raw.get("descripcion") or ""
        cat_name, subcat_name = classify_fernandez_sera_item(name, cats, desc)

        prod_doc = {
            "product_id": f"prod_fs_{sku.lower()}",
            "sku": sku,
            "name": name,
            "brand": brand,
            "category": cat_name,
            "subcategory": subcat_name,
            "description": desc or f"{name} distribuido por Fernández Sera Nicaragua.",
            "specs": raw.get("especificaciones") or {},
            "price_nio": precio_nio,
            "price": price_usd,
            "precio1": price_usd,
            "precio2": round(price_usd * 0.92, 2),
            "precio_vip": round(price_usd * 0.88, 2),
            "precio_casa_comercial": round(price_usd * 0.82, 2),
            "cost": round(price_usd * 0.60, 2),
            "installation_type": "none",
            "installation_price": 0.0,
            "installation_time_minutes": 0,
            "warranty_months": 6,
            "low_stock_threshold": 5,
            "stock": 0,
            "image_url": main_url,
            "images": image_urls,
            "media": media_list,
            "compatibility": {
                "brands": [],
                "models": [],
                "year_from": None,
                "year_to": None,
                "compatibilidad_texto": "Universal / Insumo y Detailing",
                "is_universal": True
            },
            "source_catalog": "Fernandez_Sera",
            "is_active": True
        }
        processed.append(prod_doc)

    print(f"[Fernandez_Sera] Processed {len(processed)} products, {len(images_manifest)} images to sync.")
    return processed, images_manifest

def process_meguiars() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Process Meguiar's catalog (210 detailing products)."""
    p_path = Path("catalogos/Meguiars/catalogo.json")
    if not p_path.exists():
        return [], []
        
    with open(p_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        items = data.get("productos", [])

    processed = []
    images_manifest = []

    for raw in items:
        sku = sanitize_sku(raw.get("sku") or raw.get("codigos", [""])[0] or raw.get("slug"), "MEG")
        name = raw.get("nombre") or f"Meguiar's {sku}"
        desc = raw.get("descripcion") or ""
        
        precio_crc = float(raw.get("precio_crc") or 0.0)
        price_usd = round(precio_crc / 515.0, 2) if precio_crc > 0 else 18.0

        main_source = raw.get("imagen_fuente_url") or raw.get("imagen_principal")
        main_ext = get_ext_from_url_or_path(main_source, ".jpg")
        main_filename = f"{sku}_main{main_ext}"
        main_url = f"/uploads/products/{main_filename}"

        image_urls = [main_url]
        media_list = [{
            "url": main_url,
            "gcs_url": f"{GCS_PRODUCT_PREFIX}/{main_filename}",
            "type": "main",
            "is_primary": True,
            "filename": main_filename,
            "source_url": main_source
        }]

        if main_source:
            images_manifest.append({
                "source": main_source,
                "target_filename": main_filename,
                "sku": sku,
                "type": "main"
            })

        add_sources = raw.get("imagenes_adicionales", [])
        for idx, add_item in enumerate(add_sources, 1):
            add_src = add_item.get("imagen_fuente_url") if isinstance(add_item, dict) else str(add_item)
            add_ext = get_ext_from_url_or_path(add_src, ".jpg")
            add_filename = f"{sku}_add_{idx:02d}{add_ext}"
            add_url = f"/uploads/products/{add_filename}"
            image_urls.append(add_url)
            media_list.append({
                "url": add_url,
                "gcs_url": f"{GCS_PRODUCT_PREFIX}/{add_filename}",
                "type": "additional",
                "is_primary": False,
                "filename": add_filename,
                "source_url": add_src
            })
            if add_src:
                images_manifest.append({
                    "source": add_src,
                    "target_filename": add_filename,
                    "sku": sku,
                    "type": "additional"
                })

        cat_name, subcat_name = classify_meguiars_item(name, desc)

        prod_doc = {
            "product_id": f"prod_meg_{sku.lower()}",
            "sku": sku,
            "name": name,
            "brand": "Meguiar's",
            "category": cat_name,
            "subcategory": subcat_name,
            "description": desc or f"Línea profesional Meguiar's {name}.",
            "specs": raw.get("especificaciones") or {},
            "price": price_usd,
            "precio1": price_usd,
            "precio2": round(price_usd * 0.92, 2),
            "precio_vip": round(price_usd * 0.88, 2),
            "precio_casa_comercial": round(price_usd * 0.82, 2),
            "cost": round(price_usd * 0.55, 2),
            "installation_type": "none",
            "installation_price": 0.0,
            "installation_time_minutes": 0,
            "warranty_months": 12,
            "low_stock_threshold": 4,
            "stock": 0,
            "image_url": main_url,
            "images": image_urls,
            "media": media_list,
            "compatibility": {
                "brands": [],
                "models": [],
                "year_from": None,
                "year_to": None,
                "compatibilidad_texto": "Universal / Cuidado Estético",
                "is_universal": True
            },
            "source_catalog": "Meguiars",
            "is_active": True
        }
        processed.append(prod_doc)

    print(f"[Meguiars] Processed {len(processed)} products, {len(images_manifest)} images to sync.")
    return processed, images_manifest

def process_pioneer() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Process Pioneer catalog (157 car audio & multimedia receivers)."""
    p_path = Path("catalogos/Pioneer/catalogo.json")
    if not p_path.exists():
        return [], []
        
    with open(p_path, "r", encoding="utf-8") as f:
        items = json.load(f)

    processed = []
    images_manifest = []

    for raw in items:
        sku = sanitize_sku(raw.get("sku") or raw.get("modelo") or raw.get("nombre"), "PIO")
        name = raw.get("nombre") or f"Pioneer {sku}"
        raw_subcat = raw.get("categoria", "Receptores Multimedia")
        cat_name, subcat_name = classify_pioneer_item(name, raw_subcat)

        price = float(raw.get("precio", 0) or 0)
        if price <= 0:
            if "Multimedia" in subcat_name or "Pantalla" in subcat_name:
                price = 280.0
            elif "Amplificador" in subcat_name:
                price = 190.0
            elif "Subwoofer" in subcat_name:
                price = 130.0
            elif "Parlantes" in subcat_name:
                price = 75.0
            else:
                price = 110.0

        main_source = raw.get("imagen_principal_url") or raw.get("imagen_principal") or f"https://raw.githubusercontent.com/Samuraimaid/MC-LARENS_ERP2/master/catalogos/Pioneer/{raw.get('imagen_principal', '')}"
        main_ext = get_ext_from_url_or_path(main_source, ".png")
        main_filename = f"{sku}_main{main_ext}"
        main_url = f"/uploads/products/{main_filename}"

        image_urls = [main_url]
        media_list = [{
            "url": main_url,
            "gcs_url": f"{GCS_PRODUCT_PREFIX}/{main_filename}",
            "type": "main",
            "is_primary": True,
            "filename": main_filename,
            "source_url": main_source
        }]

        if main_source:
            images_manifest.append({
                "source": main_source,
                "target_filename": main_filename,
                "sku": sku,
                "type": "main"
            })

        add_sources = raw.get("imagenes_adicionales", []) or raw.get("imagenes_urls", [])
        for idx, add_src in enumerate(add_sources, 1):
            if isinstance(add_src, str) and not add_src.startswith("http"):
                full_add_src = f"https://raw.githubusercontent.com/Samuraimaid/MC-LARENS_ERP2/master/catalogos/Pioneer/{add_src}"
            else:
                full_add_src = str(add_src)
            add_ext = get_ext_from_url_or_path(full_add_src, ".png")
            add_filename = f"{sku}_add_{idx:02d}{add_ext}"
            add_url = f"/uploads/products/{add_filename}"
            image_urls.append(add_url)
            media_list.append({
                "url": add_url,
                "gcs_url": f"{GCS_PRODUCT_PREFIX}/{add_filename}",
                "type": "additional",
                "is_primary": False,
                "filename": add_filename,
                "source_url": full_add_src
            })
            if full_add_src:
                images_manifest.append({
                    "source": full_add_src,
                    "target_filename": add_filename,
                    "sku": sku,
                    "type": "additional"
                })

        prod_doc = {
            "product_id": f"prod_pio_{sku.lower()}",
            "sku": sku,
            "name": name,
            "brand": "Pioneer",
            "category": cat_name,
            "subcategory": subcat_name,
            "description": raw.get("descripcion") or f"Equipo Pioneer {name} con alta fidelidad y conectividad.",
            "specs": raw.get("especificaciones") or {
                "CarPlay": raw.get("carplay", "No especificado"),
                "Android Auto": raw.get("android_auto", "No especificado"),
                "Tamaño Pantalla": raw.get("tamano_pantalla", "N/A"),
                "Potencia RMS": raw.get("potencia_rms_por_canal", "N/A")
            },
            "price": round(price, 2),
            "precio1": round(price, 2),
            "precio2": round(price * 0.92, 2),
            "precio_vip": round(price * 0.88, 2),
            "precio_casa_comercial": round(price * 0.82, 2),
            "cost": round(price * 0.60, 2),
            "installation_type": "optional",
            "installation_price": 20.0,
            "installation_time_minutes": 90,
            "warranty_months": 12,
            "low_stock_threshold": 3,
            "stock": 0,
            "image_url": main_url,
            "images": image_urls,
            "media": media_list,
            "compatibility": {
                "brands": [],
                "models": [],
                "year_from": None,
                "year_to": None,
                "compatibilidad_texto": "Universal 1-DIN / 2-DIN / Car Audio",
                "is_universal": True
            },
            "source_catalog": "Pioneer",
            "is_active": True
        }
        processed.append(prod_doc)

    print(f"[Pioneer] Processed {len(processed)} products, {len(images_manifest)} images to sync.")
    return processed, images_manifest

def process_ds18() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Process DS18 catalog (820 pro audio / car audio products)."""
    p_path = Path("catalogos/ds18_2021/catalogo.json")
    if not p_path.exists():
        return [], []
        
    with open(p_path, "r", encoding="utf-8") as f:
        items = json.load(f)

    processed = []
    images_manifest = []

    for raw in items:
        sku = sanitize_sku(raw.get("sku") or raw.get("modelo") or raw.get("nombre"), "DS18")
        name = raw.get("nombre") or f"DS18 {sku}"
        raw_subcat = raw.get("categoria", "")
        cat_name, subcat_name = classify_ds18_item(name, raw_subcat)
        
        try:
            price = float(raw.get("precio", 0) or 0)
            if price <= 0:
                price = 85.0
        except Exception:
            price = 85.0

        main_source = raw.get("imagen_principal_url") or raw.get("imagen_principal") or f"https://raw.githubusercontent.com/Samuraimaid/MC-LARENS_ERP2/master/catalogos/ds18_2021/{raw.get('imagen_principal', '')}"
        main_ext = get_ext_from_url_or_path(main_source, ".jpg")
        main_filename = f"{sku}_main{main_ext}"
        main_url = f"/uploads/products/{main_filename}"

        image_urls = [main_url]
        media_list = [{
            "url": main_url,
            "gcs_url": f"{GCS_PRODUCT_PREFIX}/{main_filename}",
            "type": "main",
            "is_primary": True,
            "filename": main_filename,
            "source_url": main_source
        }]

        if main_source:
            images_manifest.append({
                "source": main_source,
                "target_filename": main_filename,
                "sku": sku,
                "type": "main"
            })

        add_sources = raw.get("imagenes_adicionales", [])
        for idx, add_src in enumerate(add_sources, 1):
            if isinstance(add_src, str) and not add_src.startswith("http"):
                full_add_src = f"https://raw.githubusercontent.com/Samuraimaid/MC-LARENS_ERP2/master/catalogos/ds18_2021/{add_src}"
            else:
                full_add_src = str(add_src)
            add_ext = get_ext_from_url_or_path(full_add_src, ".jpg")
            add_filename = f"{sku}_add_{idx:02d}{add_ext}"
            add_url = f"/uploads/products/{add_filename}"
            image_urls.append(add_url)
            media_list.append({
                "url": add_url,
                "gcs_url": f"{GCS_PRODUCT_PREFIX}/{add_filename}",
                "type": "additional",
                "is_primary": False,
                "filename": add_filename,
                "source_url": full_add_src
            })
            if full_add_src:
                images_manifest.append({
                    "source": full_add_src,
                    "target_filename": add_filename,
                    "sku": sku,
                    "type": "additional"
                })

        prod_doc = {
            "product_id": f"prod_ds18_{sku.lower()}",
            "sku": sku,
            "name": name,
            "brand": "DS18",
            "category": cat_name,
            "subcategory": subcat_name,
            "description": raw.get("descripcion") or f"Componente de audio de alta potencia DS18 {name}.",
            "specs": raw.get("especificaciones") or {},
            "price": round(price, 2),
            "precio1": round(price, 2),
            "precio2": round(price * 0.92, 2),
            "precio_vip": round(price * 0.88, 2),
            "precio_casa_comercial": round(price * 0.82, 2),
            "cost": round(price * 0.55, 2),
            "installation_type": "optional",
            "installation_price": 15.0,
            "installation_time_minutes": 45,
            "warranty_months": 12,
            "low_stock_threshold": 4,
            "stock": 0,
            "image_url": main_url,
            "images": image_urls,
            "media": media_list,
            "compatibility": {
                "brands": [],
                "models": [],
                "year_from": None,
                "year_to": None,
                "compatibilidad_texto": "Universal / Car & Marine Audio",
                "is_universal": True
            },
            "source_catalog": "ds18_2021",
            "is_active": True
        }
        processed.append(prod_doc)

    print(f"[DS18] Processed {len(processed)} products, {len(images_manifest)} images to sync.")
    return processed, images_manifest

def process_auxbeam() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Process Auxbeam catalog (194 LED driving lights / pods)."""
    p_path = Path("catalogos/auxbeam_driving_light/catalogo.json")
    if not p_path.exists():
        return [], []
        
    with open(p_path, "r", encoding="utf-8") as f:
        items = json.load(f)

    processed = []
    images_manifest = []

    for raw in items:
        sku = sanitize_sku(raw.get("sku") or raw.get("skus", [""])[0] or raw.get("handle"), "AUX")
        name = raw.get("nombre") or f"Auxbeam LED {sku}"
        desc = raw.get("descripcion") or ""
        cat_name, subcat_name = classify_auxbeam_item(name, desc)
        
        try:
            price = float(raw.get("precio", 0) or 0)
            if price <= 0:
                price = 99.0
        except Exception:
            price = 99.0

        main_source = raw.get("imagen_principal_url") or raw.get("imagen_principal")
        main_ext = get_ext_from_url_or_path(main_source, ".jpg")
        main_filename = f"{sku}_main{main_ext}"
        main_url = f"/uploads/products/{main_filename}"

        image_urls = [main_url]
        media_list = [{
            "url": main_url,
            "gcs_url": f"{GCS_PRODUCT_PREFIX}/{main_filename}",
            "type": "main",
            "is_primary": True,
            "filename": main_filename,
            "source_url": main_source
        }]

        if main_source:
            images_manifest.append({
                "source": main_source,
                "target_filename": main_filename,
                "sku": sku,
                "type": "main"
            })

        add_sources = raw.get("imagenes_adicionales_urls", []) or raw.get("imagenes_adicionales", [])
        for idx, add_src in enumerate(add_sources, 1):
            add_ext = get_ext_from_url_or_path(add_src, ".jpg")
            add_filename = f"{sku}_add_{idx:02d}{add_ext}"
            add_url = f"/uploads/products/{add_filename}"
            image_urls.append(add_url)
            media_list.append({
                "url": add_url,
                "gcs_url": f"{GCS_PRODUCT_PREFIX}/{add_filename}",
                "type": "additional",
                "is_primary": False,
                "filename": add_filename,
                "source_url": add_src
            })
            if add_src:
                images_manifest.append({
                    "source": add_src,
                    "target_filename": add_filename,
                    "sku": sku,
                    "type": "additional"
                })

        prod_doc = {
            "product_id": f"prod_aux_{sku.lower()}",
            "sku": sku,
            "name": name,
            "brand": "Auxbeam",
            "category": cat_name,
            "subcategory": subcat_name,
            "description": desc or f"Faro auxiliar / barra LED Auxbeam {name}.",
            "specs": raw.get("especificaciones") or {},
            "potencia": raw.get("potencia", "LED High Output"),
            "tension_trabajo": raw.get("tension_trabajo", "9-32V DC"),
            "contenido_caja": raw.get("contenido_caja", "Faro LED, soporte y tornillería"),
            "price": round(price, 2),
            "precio1": round(price, 2),
            "precio2": round(price * 0.92, 2),
            "precio_vip": round(price * 0.88, 2),
            "precio_casa_comercial": round(price * 0.82, 2),
            "cost": round(price * 0.55, 2),
            "installation_type": "optional",
            "installation_price": 20.0,
            "installation_time_minutes": 60,
            "warranty_months": 12,
            "low_stock_threshold": 4,
            "stock": 0,
            "image_url": main_url,
            "images": image_urls,
            "media": media_list,
            "compatibility": {
                "brands": [],
                "models": [],
                "year_from": None,
                "year_to": None,
                "compatibilidad_texto": "Universal 12V / 24V Off-Road / Camioneta",
                "is_universal": True
            },
            "source_catalog": "auxbeam_driving_light",
            "is_active": True
        }
        processed.append(prod_doc)

    print(f"[Auxbeam] Processed {len(processed)} products, {len(images_manifest)} images to sync.")
    return processed, images_manifest

def process_taller_suspension_rines() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Generates foundational catalog skeleton for workshop labor, oil change, rims, tires, spacers, lifts, and suspension."""
    skeleton_products = [
        # === SERVICIOS Y MANO DE OBRA DE LUBRICENTRO & TALLER ===
        {
            "sku": "SRV-CAM-ACE-LIV",
            "name": "Mano de Obra: Cambio de Aceite y Filtro de Motor (Gasolina)",
            "brand": "MCLARENS TALLER",
            "category": "lubricantes_fluidos",
            "subcategory": "Servicios de Cambio de Aceite",
            "product_type": "service",
            "price": 8.0,
            "cost": 2.0,
            "installation_type": "required",
            "installation_price": 8.0,
            "installation_time_minutes": 30,
            "description": "Servicio profesional de drenado de aceite de motor, reemplazo de filtro de aceite y revisión de niveles de fluidos para vehículos sedán, hatchback y SUV compactos a gasolina.",
            "compatibility": {"brands": [], "models": [], "is_universal": True, "compatibilidad_texto": "Universal / Vehículos Livianos Gasolina"}
        },
        {
            "sku": "SRV-CAM-ACE-4X4",
            "name": "Mano de Obra: Cambio de Aceite y Filtro de Motor (Camioneta / SUV Diésel)",
            "brand": "MCLARENS TALLER",
            "category": "lubricantes_fluidos",
            "subcategory": "Servicios de Cambio de Aceite",
            "product_type": "service",
            "price": 12.0,
            "cost": 3.0,
            "installation_type": "required",
            "installation_price": 12.0,
            "installation_time_minutes": 45,
            "description": "Servicio de cambio de aceite y filtro de motor para camionetas pickup y SUV con motor Turbo Diésel (Hilux, Ranger, D-Max, Frontier, Prado, L200). Incluye revisión de filtro de aire y engrase de crucetas.",
            "compatibility": {"brands": ["TOYOTA", "FORD", "ISUZU", "NISSAN", "MITSUBISHI"], "models": ["Hilux", "Ranger", "D-Max", "Frontier", "Prado", "L200", "Navara", "Amarok"], "is_universal": False, "compatibilidad_texto": "Camionetas y SUV Diésel"}
        },
        {
            "sku": "SRV-CAM-ACE-TRANS",
            "name": "Mano de Obra: Cambio de Aceite de Transmisión (Manual / Automática)",
            "brand": "MCLARENS TALLER",
            "category": "lubricantes_fluidos",
            "subcategory": "Aceites de Transmisión y Engranajes",
            "product_type": "service",
            "price": 15.0,
            "cost": 4.0,
            "installation_type": "required",
            "installation_price": 15.0,
            "installation_time_minutes": 45,
            "description": "Drenado y relleno de aceite de transmisión / caja de velocidades según especificación de fabricante (MTF / ATF / CVT).",
            "compatibility": {"brands": [], "models": [], "is_universal": True, "compatibilidad_texto": "Universal"}
        },
        {
            "sku": "SRV-CAM-ACE-DIF",
            "name": "Mano de Obra: Cambio de Aceite de Diferencial / Corona (Delantera / Trasera)",
            "brand": "MCLARENS TALLER",
            "category": "lubricantes_fluidos",
            "subcategory": "Aceites de Transmisión y Engranajes",
            "product_type": "service",
            "price": 10.0,
            "cost": 3.0,
            "installation_type": "required",
            "installation_price": 10.0,
            "installation_time_minutes": 30,
            "description": "Servicio de cambio de valvulina / aceite para diferencial y corona 4x4 y 4x2.",
            "compatibility": {"brands": [], "models": [], "is_universal": True, "compatibilidad_texto": "Universal Vehículos Tracción Trasera y 4x4"}
        },
        {
            "sku": "SRV-LAV-ENG-CHASIS",
            "name": "Mano de Obra: Lavado a Presión y Engrase Completo de Chasis",
            "brand": "MCLARENS TALLER",
            "category": "lubricantes_fluidos",
            "subcategory": "Servicios de Taller",
            "product_type": "service",
            "price": 15.0,
            "cost": 4.0,
            "installation_type": "required",
            "installation_price": 15.0,
            "installation_time_minutes": 60,
            "description": "Lavado minucioso de partes bajas con desengrasante y engrase de terminales, rótulas, crucetas y gemelos de suspensión.",
            "compatibility": {"brands": [], "models": [], "is_universal": True, "compatibilidad_texto": "Universal Pickups y 4x4"}
        },
        {
            "sku": "SRV-PURGA-FRENOS",
            "name": "Mano de Obra: Purga y Reemplazo Total de Líquido de Frenos DOT 3 / DOT 4",
            "brand": "MCLARENS TALLER",
            "category": "lubricantes_fluidos",
            "subcategory": "Líquidos de Frenos y Dirección",
            "product_type": "service",
            "price": 12.0,
            "cost": 3.0,
            "installation_type": "required",
            "installation_price": 12.0,
            "installation_time_minutes": 45,
            "description": "Purga completa del sistema hidráulico de frenos en las 4 ruedas y reposición con líquido nuevo de alto punto de ebullición.",
            "compatibility": {"brands": [], "models": [], "is_universal": True, "compatibilidad_texto": "Universal"}
        },
        {
            "sku": "SRV-FLUSH-COOLANT",
            "name": "Mano de Obra: Limpieza / Flush de Sistema de Enfriamiento y Reemplazo de Coolant",
            "brand": "MCLARENS TALLER",
            "category": "lubricantes_fluidos",
            "subcategory": "Refrigerantes y Aditivos de Radiador",
            "product_type": "service",
            "price": 15.0,
            "cost": 4.0,
            "installation_type": "required",
            "installation_price": 15.0,
            "installation_time_minutes": 45,
            "description": "Drenado de refrigerante viejo, lavado químico interno de radiador y bloque motor, y llenado con nuevo refrigerante 50/50.",
            "compatibility": {"brands": [], "models": [], "is_universal": True, "compatibilidad_texto": "Universal"}
        },

        # === RINES, LLANTAS Y ACCESORIOS ===
        {
            "sku": "RIN-OFF-17X9-6X139",
            "name": "Rin 17x9 Off-Road Black Satin 6x139.7 ET-12",
            "brand": "BLACK RHINO",
            "category": "rines_llantas",
            "subcategory": "Rines Off-Road y Deportivos",
            "product_type": "product",
            "price": 185.0,
            "cost": 120.0,
            "installation_type": "optional",
            "installation_price": 5.0,
            "installation_time_minutes": 20,
            "description": "Rin de aleación reforzada de alta resistencia para camionetas 4x4. Patrón de pernos 6x139.7 mm (6 huecos) con acabado negro satinado mate y centro cóncavo.",
            "compatibility": {"brands": ["TOYOTA", "FORD", "ISUZU", "NISSAN", "MITSUBISHI", "CHEVROLET"], "models": ["Hilux", "Ranger", "D-Max", "Frontier", "Prado", "L200", "Colorado", "4Runner"], "is_universal": False, "compatibilidad_texto": "Camionetas 6x139.7 (Hilux, Ranger, D-Max, Frontier, Prado)"}
        },
        {
            "sku": "RIN-OFF-16X8-6X139",
            "name": "Rin 16x8 Off-Road Beadlock Style 6x139.7 ET0",
            "brand": "METHOD RACE",
            "category": "rines_llantas",
            "subcategory": "Rines Off-Road y Deportivos",
            "product_type": "product",
            "price": 160.0,
            "cost": 105.0,
            "installation_type": "optional",
            "installation_price": 5.0,
            "installation_time_minutes": 20,
            "description": "Rin todoterreno 16x8 estilo Beadlock simulado con labio reforzado y acabado en negro satinado con remaches de acero inoxidable.",
            "compatibility": {"brands": ["TOYOTA", "NISSAN", "MITSUBISHI", "ISUZU"], "models": ["Hilux", "Land Cruiser 70", "Patrol", "L200", "Trooper"], "is_universal": False, "compatibilidad_texto": "4x4 Tradicional 6x139.7"}
        },
        {
            "sku": "RIN-OFF-18X9-6X139",
            "name": "Rin 18x9 Off-Road Bronze Edition 6x139.7 ET0",
            "brand": "FUEL OFF-ROAD",
            "category": "rines_llantas",
            "subcategory": "Rines Off-Road y Deportivos",
            "product_type": "product",
            "price": 210.0,
            "cost": 140.0,
            "installation_type": "optional",
            "installation_price": 5.0,
            "installation_time_minutes": 20,
            "description": "Rin premium 18 pulgadas color bronce mate con labio exterior negro satinado. Ideal para Hilux Revo / Rocco, Ranger Raptor y Colorado.",
            "compatibility": {"brands": ["TOYOTA", "FORD", "ISUZU", "CHEVROLET"], "models": ["Hilux", "Ranger", "D-Max", "Colorado", "Tahoe"], "is_universal": False, "compatibilidad_texto": "Pickups Modernas 6x139.7"}
        },
        {
            "sku": "RIN-OFF-17X8.5-5X114",
            "name": "Rin 17x8.5 Off-Road / SUV 5x114.3 ET+30",
            "brand": "KMC WHEELS",
            "category": "rines_llantas",
            "subcategory": "Rines Off-Road y Deportivos",
            "product_type": "product",
            "price": 165.0,
            "cost": 110.0,
            "installation_type": "optional",
            "installation_price": 5.0,
            "installation_time_minutes": 20,
            "description": "Rin deportivo y overland para SUV compactas y medianas con patrón 5x114.3 mm.",
            "compatibility": {"brands": ["TOYOTA", "HONDA", "HYUNDAI", "KIA", "MAZDA", "NISSAN"], "models": ["Rav4", "CR-V", "Tucson", "Sportage", "CX-5", "X-Trail"], "is_universal": False, "compatibilidad_texto": "SUV 5x114.3"}
        },
        {
            "sku": "LLA-AT-265-70R17",
            "name": "Llanta 265/70R17 All-Terrain (A/T) Letras Blancas 10PR",
            "brand": "BFGOODRICH / MAXXIS",
            "category": "rines_llantas",
            "subcategory": "Llantas All-Terrain y Mud-Terrain",
            "product_type": "product",
            "price": 165.0,
            "cost": 115.0,
            "installation_type": "optional",
            "installation_price": 5.0,
            "installation_time_minutes": 20,
            "description": "Llanta todoterreno All-Terrain (A/T) 265/70R17 con hombros reforzados, tecnología anti-cortes y letras blancas destacadas. Tracción óptima 50% asfalto / 50% terracería.",
            "compatibility": {"brands": ["TOYOTA", "FORD", "ISUZU", "NISSAN", "MITSUBISHI"], "models": ["Hilux", "Ranger", "D-Max", "Frontier", "Prado", "L200", "4Runner"], "is_universal": False, "compatibilidad_texto": "Pickups y SUV con Rin 17"}
        },
        {
            "sku": "LLA-AT-265-65R17",
            "name": "Llanta 265/65R17 All-Terrain (A/T) Medida Original",
            "brand": "MAXXIS / YOKOHAMA",
            "category": "rines_llantas",
            "subcategory": "Llantas All-Terrain y Mud-Terrain",
            "product_type": "product",
            "price": 155.0,
            "cost": 105.0,
            "installation_type": "optional",
            "installation_price": 5.0,
            "installation_time_minutes": 20,
            "description": "Medida estándar original de agencia para Toyota Hilux, Fortuner y Prado. Diseño A/T con bajo nivel de ruido en carretera y excelente agarre en lodo y lluvia.",
            "compatibility": {"brands": ["TOYOTA", "FORD", "ISUZU", "NISSAN", "MITSUBISHI"], "models": ["Hilux", "Fortuner", "Prado", "Ranger", "D-Max", "L200", "Frontier"], "is_universal": False, "compatibilidad_texto": "Hilux, Prado, Ranger, D-Max original"}
        },
        {
            "sku": "LLA-MT-285-70R17",
            "name": "Llanta 285/70R17 Mud-Terrain (M/T) Tracción Extrema (33 Pulgadas)",
            "brand": "MAXXIS RAZR",
            "category": "rines_llantas",
            "subcategory": "Llantas All-Terrain y Mud-Terrain",
            "product_type": "product",
            "price": 210.0,
            "cost": 145.0,
            "installation_type": "optional",
            "installation_price": 5.0,
            "installation_time_minutes": 20,
            "description": "Llanta Mud-Terrain de 33 pulgadas de alto para barro profundo, roca y expedición off-road extrema. Tacos autolimpiantes y triple capa de carcasa resistente a pinchaduras.",
            "compatibility": {"brands": ["TOYOTA", "FORD", "JEEP", "NISSAN"], "models": ["Hilux", "Ranger", "Wrangler", "Gladiator", "Land Cruiser", "Patrol"], "is_universal": False, "compatibilidad_texto": "Vehículos 4x4 con Kit de Alzas / Lift Kit"}
        },
        {
            "sku": "LLA-AT-31X10.5R15",
            "name": "Llanta 31x10.50R15 All-Terrain (A/T) para Rin 15",
            "brand": "MAXXIS BIGHORN",
            "category": "rines_llantas",
            "subcategory": "Llantas All-Terrain y Mud-Terrain",
            "product_type": "product",
            "price": 145.0,
            "cost": 98.0,
            "installation_type": "optional",
            "installation_price": 5.0,
            "installation_time_minutes": 20,
            "description": "Llanta clásica 31x10.50R15 de alta flotación y agarre para camionetas tradicionales con rin 15.",
            "compatibility": {"brands": ["TOYOTA", "NISSAN", "ISUZU", "MITSUBISHI"], "models": ["Hilux 2.5/2.8", "D21", "D22", "Trooper", "Montero"], "is_universal": False, "compatibilidad_texto": "Camionetas con Rin 15"}
        },
        {
            "sku": "ACC-TUERCA-SEG-6L",
            "name": "Juego de 24 Tuercas de Seguridad Cónicas y Llave Antirrobo M12x1.5",
            "brand": "GORILLA AUTOMOTIVE",
            "category": "rines_llantas",
            "subcategory": "Accesorios de Rines y Llantas",
            "product_type": "product",
            "price": 28.0,
            "cost": 14.0,
            "installation_type": "optional",
            "installation_price": 5.0,
            "installation_time_minutes": 15,
            "description": "Kit completo de 24 tuercas de seguridad estriadas en cromo de alto brillo con dado especial de instalación para rines de 6 pernos.",
            "compatibility": {"brands": [], "models": [], "is_universal": True, "compatibilidad_texto": "Camionetas 6 Pernos (Rosca M12x1.5)"}
        },
        {
            "sku": "SRV-MON-BAL-4R",
            "name": "Mano de Obra: Montaje y Balanceo Computarizado (Juego de 4 Ruedas)",
            "brand": "MCLARENS TALLER",
            "category": "rines_llantas",
            "subcategory": "Servicios de Rines y Llantas",
            "product_type": "service",
            "price": 20.0,
            "cost": 5.0,
            "installation_type": "required",
            "installation_price": 20.0,
            "installation_time_minutes": 45,
            "description": "Desmontaje de llantas viejas, montaje en rines nuevos, reemplazo de válvulas y balanceo dinámico con plomos adhesivos o de grapa en balanceadora digital.",
            "compatibility": {"brands": [], "models": [], "is_universal": True, "compatibilidad_texto": "Universal 4 Ruedas"}
        },
        {
            "sku": "SRV-ALIN-3D-4X4",
            "name": "Mano de Obra: Alineación Computarizada 3D por Cámaras HD",
            "brand": "MCLARENS TALLER",
            "category": "rines_llantas",
            "subcategory": "Servicios de Rines y Llantas",
            "product_type": "service",
            "price": 25.0,
            "cost": 6.0,
            "installation_type": "required",
            "installation_price": 25.0,
            "installation_time_minutes": 45,
            "description": "Alineación láser 3D de alta precisión para corregir camber, caster y convergencia en vehículos levantados y convencionales.",
            "compatibility": {"brands": [], "models": [], "is_universal": True, "compatibilidad_texto": "Universal"}
        },

        # === SUSPENSIÓN, ALZAS Y ESPACIADORES ===
        {
            "sku": "KIT-ALZA-2P-HILUX",
            "name": "Kit de Alzas de Suspensión de 2 Pulgadas (Toyota Hilux Revo / Rocco / Vigo 2005-2024)",
            "brand": "PRO COMP / OME",
            "category": "suspension_alzas",
            "subcategory": "Kits de Alzas y Nivelación",
            "product_type": "product",
            "price": 120.0,
            "cost": 75.0,
            "installation_type": "optional",
            "installation_price": 40.0,
            "installation_time_minutes": 90,
            "warranty_months": 24,
            "description": "Kit completo para levantar 2 pulgadas la suspensión. Incluye 2 espaciadores de amortiguador delantero en aluminio mecanizado CNC y 2 tacos traseros con pernos en U (U-bolts) reforzados.",
            "compatibility": {"brands": ["TOYOTA"], "models": ["Hilux", "Fortuner"], "year_from": 2005, "year_to": 2026, "is_universal": False, "compatibilidad_texto": "Toyota Hilux 2005-2026 (Todas las versiones 4x4 y 4x2 Prerunner)"}
        },
        {
            "sku": "KIT-ALZA-2P-RANGER",
            "name": "Kit de Alzas de Suspensión de 2 Pulgadas (Ford Ranger 2012-2024)",
            "brand": "ROUGH COUNTRY",
            "category": "suspension_alzas",
            "subcategory": "Kits de Alzas y Nivelación",
            "product_type": "product",
            "price": 125.0,
            "cost": 78.0,
            "installation_type": "optional",
            "installation_price": 40.0,
            "installation_time_minutes": 90,
            "warranty_months": 24,
            "description": "Kit de nivelación y levante de 2 pulgadas para Ford Ranger T6/T7/T8 (XLT, Limited, FX4, Wildtrak).",
            "compatibility": {"brands": ["FORD"], "models": ["Ranger", "Everest"], "year_from": 2012, "year_to": 2026, "is_universal": False, "compatibilidad_texto": "Ford Ranger 2012-2026"}
        },
        {
            "sku": "KIT-ALZA-2P-DMAX",
            "name": "Kit de Alzas de Suspensión de 2 Pulgadas (Isuzu D-Max / Chevrolet Colorado 2012-2024)",
            "brand": "IRONMAN 4X4",
            "category": "suspension_alzas",
            "subcategory": "Kits de Alzas y Nivelación",
            "product_type": "product",
            "price": 125.0,
            "cost": 78.0,
            "installation_type": "optional",
            "installation_price": 40.0,
            "installation_time_minutes": 90,
            "warranty_months": 24,
            "description": "Kit de levante de 2 pulgadas diseñado a la medida para Isuzu D-Max y Chevrolet D-Max.",
            "compatibility": {"brands": ["ISUZU", "CHEVROLET"], "models": ["D-Max", "Colorado", "DMax"], "year_from": 2012, "year_to": 2026, "is_universal": False, "compatibilidad_texto": "Isuzu D-Max 2012-2026"}
        },
        {
            "sku": "KIT-ALZA-2P-NAVARA",
            "name": "Kit de Alzas de Suspensión de 2 Pulgadas (Nissan NP300 / Frontier 2015-2024)",
            "brand": "PRO COMP",
            "category": "suspension_alzas",
            "subcategory": "Kits de Alzas y Nivelación",
            "product_type": "product",
            "price": 125.0,
            "cost": 78.0,
            "installation_type": "optional",
            "installation_price": 40.0,
            "installation_time_minutes": 90,
            "warranty_months": 24,
            "description": "Kit de nivelación y elevación de 2 pulgadas para Nissan NP300 / Frontier D23 con espaciadores de resorte traseros / tacos según suspensión.",
            "compatibility": {"brands": ["NISSAN"], "models": ["NP300", "Frontier", "Navara"], "year_from": 2015, "year_to": 2026, "is_universal": False, "compatibilidad_texto": "Nissan NP300 / Frontier 2015-2026"}
        },
        {
            "sku": "ESP-RUEDA-6X139-1.5P",
            "name": "Par de Espaciadores de Rueda 1.5 Pulgadas Aluminio Forjado 6x139.7 (Centrador Hubcentric)",
            "brand": "SPACER PRO",
            "category": "suspension_alzas",
            "subcategory": "Espaciadores de Rueda (Wheel Spacers)",
            "product_type": "product",
            "price": 75.0,
            "cost": 45.0,
            "installation_type": "optional",
            "installation_price": 8.0,
            "installation_time_minutes": 20,
            "warranty_months": 24,
            "description": "Par de espaciadores de rueda de 1.5 pulgadas (38 mm) fabricados en aleación de aluminio aeroespacial 6061-T6 forjado con espárragos Grado 10.9 templados. Ensancha la trocha para mayor estabilidad y look robusto.",
            "compatibility": {"brands": ["TOYOTA", "FORD", "ISUZU", "MITSUBISHI"], "models": ["Hilux", "Ranger", "D-Max", "Prado", "L200", "4Runner"], "is_universal": False, "compatibilidad_texto": "Pickups 6x139.7 con centro 106mm / 93mm"}
        },
        {
            "sku": "ESP-RUEDA-6X139-2P",
            "name": "Par de Espaciadores de Rueda 2.0 Pulgadas Aluminio Forjado 6x139.7",
            "brand": "SPACER PRO",
            "category": "suspension_alzas",
            "subcategory": "Espaciadores de Rueda (Wheel Spacers)",
            "product_type": "product",
            "price": 85.0,
            "cost": 52.0,
            "installation_type": "optional",
            "installation_price": 8.0,
            "installation_time_minutes": 20,
            "warranty_months": 24,
            "description": "Par de espaciadores de 2.0 pulgadas (50 mm) de aluminio forjado para postura ancha y evitar roce de llantas 285/70 o 33 pulgadas con el chasis.",
            "compatibility": {"brands": ["TOYOTA", "FORD", "ISUZU", "MITSUBISHI"], "models": ["Hilux", "Ranger", "D-Max", "Prado", "L200"], "is_universal": False, "compatibilidad_texto": "Pickups 6x139.7"}
        },
        {
            "sku": "ESP-RUEDA-5X114-1.25P",
            "name": "Par de Espaciadores de Rueda 1.25 Pulgadas 5x114.3",
            "brand": "SPACER PRO",
            "category": "suspension_alzas",
            "subcategory": "Espaciadores de Rueda (Wheel Spacers)",
            "product_type": "product",
            "price": 65.0,
            "cost": 38.0,
            "installation_type": "optional",
            "installation_price": 8.0,
            "installation_time_minutes": 20,
            "warranty_months": 24,
            "description": "Par de espaciadores de 1.25 pulgadas para vehículos y SUV con 5 pernos 5x114.3 mm.",
            "compatibility": {"brands": ["TOYOTA", "HONDA", "HYUNDAI", "KIA", "MAZDA", "NISSAN"], "models": ["Rav4", "CR-V", "Tucson", "Sportage", "CX-5"], "is_universal": False, "compatibilidad_texto": "SUV y Autos 5x114.3"}
        },
        {
            "sku": "GEM-CONFORT-HILUX",
            "name": "Par de Gemelos / Grilletes Confort Engrasables para Ballestas Traseras (Toyota Hilux 2005-2024)",
            "brand": "JSK 4X4",
            "category": "suspension_alzas",
            "subcategory": "Amortiguadores y Componentes de Suspensión",
            "product_type": "product",
            "price": 95.0,
            "cost": 55.0,
            "installation_type": "optional",
            "installation_price": 20.0,
            "installation_time_minutes": 45,
            "warranty_months": 12,
            "description": "Grilletes articulados tipo gemelo confort con diseño de doble pivote para suavizar drásticamente los saltos y vibraciones de la batea en terracería. Proporciona 1.5 a 2 pulgadas de elevación trasera.",
            "compatibility": {"brands": ["TOYOTA"], "models": ["Hilux", "Vigo", "Revo", "Rocco"], "year_from": 2005, "year_to": 2026, "is_universal": False, "compatibilidad_texto": "Toyota Hilux 2005-2026"}
        },
        {
            "sku": "AMO-HD-NITRO-DEL",
            "name": "Par de Amortiguadores Delanteros Heavy Duty Nitro Gas 4x4",
            "brand": "OLD MAN EMU / PROFENDER",
            "category": "suspension_alzas",
            "subcategory": "Amortiguadores y Componentes de Suspensión",
            "product_type": "product",
            "price": 180.0,
            "cost": 115.0,
            "installation_type": "optional",
            "installation_price": 25.0,
            "installation_time_minutes": 60,
            "warranty_months": 24,
            "description": "Amortiguadores presurizados con gas nitrógeno de pistón reforzado de 35mm para soportar peso adicional (defensas de acero, winches) y brindar control superior en curvas y caminos difíciles.",
            "compatibility": {"brands": ["TOYOTA", "FORD", "ISUZU", "NISSAN"], "models": ["Hilux", "Ranger", "D-Max", "Frontier", "Prado"], "is_universal": False, "compatibilidad_texto": "Pickups 4x4"}
        },
        {
            "sku": "AMO-HD-NITRO-TRA",
            "name": "Par de Amortiguadores Traseros Heavy Duty Nitro Gas 4x4 (Largo Extendido para Alzas)",
            "brand": "OLD MAN EMU / PROFENDER",
            "category": "suspension_alzas",
            "subcategory": "Amortiguadores y Componentes de Suspensión",
            "product_type": "product",
            "price": 160.0,
            "cost": 100.0,
            "installation_type": "optional",
            "installation_price": 20.0,
            "installation_time_minutes": 45,
            "warranty_months": 24,
            "description": "Amortiguadores traseros de recorrido largo calibrados para vehículos levantados de 0 a 2.5 pulgadas.",
            "compatibility": {"brands": ["TOYOTA", "FORD", "ISUZU", "NISSAN", "MITSUBISHI"], "models": ["Hilux", "Ranger", "D-Max", "Frontier", "L200"], "is_universal": False, "compatibilidad_texto": "Pickups con Suspensión Elevada"}
        },
        {
            "sku": "SRV-INST-ALZAS-4X4",
            "name": "Mano de Obra: Instalación y Calibración de Kit de Alzas Delantero y Trasero",
            "brand": "MCLARENS TALLER",
            "category": "suspension_alzas",
            "subcategory": "Servicios de Suspensión y Taller",
            "product_type": "service",
            "price": 40.0,
            "cost": 10.0,
            "installation_type": "required",
            "installation_price": 40.0,
            "installation_time_minutes": 90,
            "description": "Instalación completa de espaciadores de amortiguador delantero, tacos y abrazaderas traseras, torqueado a especificación de fábrica y prueba de recorrido.",
            "compatibility": {"brands": [], "models": [], "is_universal": True, "compatibilidad_texto": "Camionetas 4x4"}
        },
        {
            "sku": "SRV-INST-ESP-4R",
            "name": "Mano de Obra: Instalación y Torqueado de Espaciadores de Rueda (4 Ruedas)",
            "brand": "MCLARENS TALLER",
            "category": "suspension_alzas",
            "subcategory": "Servicios de Suspensión y Taller",
            "product_type": "service",
            "price": 15.0,
            "cost": 4.0,
            "installation_type": "required",
            "installation_price": 15.0,
            "installation_time_minutes": 30,
            "description": "Limpieza de bocinas/hubs, aplicación de traba-roscas de media fuerza (Loctite azul) y ajuste con torquímetro calibrado para máxima seguridad.",
            "compatibility": {"brands": [], "models": [], "is_universal": True, "compatibilidad_texto": "Universal 4 Ruedas"}
        }
    ]

    processed = []
    images_manifest = []

    for item in skeleton_products:
        sku = sanitize_sku(item["sku"], "TALLER")
        name = item["name"]
        price = float(item.get("price", 25.0))
        cost = float(item.get("cost", price * 0.6))
        main_filename = f"{sku}_main.jpg"
        main_url = f"/uploads/products/{main_filename}"

        doc = {
            "product_id": f"prod_taller_{sku.lower().replace('-', '_')}",
            "sku": sku,
            "name": name,
            "brand": item.get("brand", "MCLARENS"),
            "category": item.get("category", "taller_mecanica"),
            "subcategory": item.get("subcategory", "Servicios de Taller"),
            "product_type": item.get("product_type", "product"),
            "description": item.get("description", ""),
            "specs": item.get("specs", {}),
            "price": round(price, 2),
            "precio1": round(price, 2),
            "precio2": round(price * 0.92, 2),
            "precio_vip": round(price * 0.88, 2),
            "precio_casa_comercial": round(price * 0.82, 2),
            "cost": round(cost, 2),
            "installation_type": item.get("installation_type", "none"),
            "installation_price": round(float(item.get("installation_price", 0.0)), 2),
            "installation_time_minutes": item.get("installation_time_minutes", 30),
            "warranty_months": item.get("warranty_months", 12),
            "low_stock_threshold": 4,
            "stock": 10 if item.get("product_type") == "product" else 999,
            "image_url": main_url,
            "images": [main_url],
            "media": [{
                "url": main_url,
                "gcs_url": f"{GCS_PRODUCT_PREFIX}/{main_filename}",
                "type": "main",
                "is_primary": True,
                "filename": main_filename,
                "source_url": ""
            }],
            "compatibility": item.get("compatibility", {
                "brands": [],
                "models": [],
                "year_from": None,
                "year_to": None,
                "compatibilidad_texto": "Universal",
                "is_universal": True
            }),
            "source_catalog": "taller_suspension_rines",
            "is_active": True
        }
        processed.append(doc)

    print(f"[Taller_Suspension_Rines] Processed {len(processed)} foundational products and services.")
    return processed, images_manifest

def main():
    seeds_dir = Path("backend/data/seeds")
    seeds_dir.mkdir(parents=True, exist_ok=True)

    print("=== BUILDING ALL UNIFIED GROK CATALOG SEEDS ===")
    
    dlaa_prods, dlaa_imgs = process_dlaa_catalog()
    fs_prods, fs_imgs = process_fernandez_sera()
    meg_prods, meg_imgs = process_meguiars()
    pio_prods, pio_imgs = process_pioneer()
    ds18_prods, ds18_imgs = process_ds18()
    aux_prods, aux_imgs = process_auxbeam()
    taller_prods, taller_imgs = process_taller_suspension_rines()

    # Save specific catalog seeds
    seeds = {
        "dlaa_halogens_seed.json": dlaa_prods,
        "fernandez_sera_seed.json": fs_prods,
        "meguiars_seed.json": meg_prods,
        "pioneer_seed.json": pio_prods,
        "ds18_seed.json": ds18_prods,
        "auxbeam_seed.json": aux_prods,
        "taller_suspension_rines_seed.json": taller_prods,
    }

    all_unified = []
    all_images_manifest = []

    for fname, prod_list in seeds.items():
        out_path = seeds_dir / fname
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(prod_list, f, ensure_ascii=False, indent=2)
        print(f"Saved {out_path} ({len(prod_list)} products, {out_path.stat().st_size} bytes)")
        all_unified.extend(prod_list)

    all_images_manifest.extend(dlaa_imgs)
    all_images_manifest.extend(fs_imgs)
    all_images_manifest.extend(meg_imgs)
    all_images_manifest.extend(pio_imgs)
    all_images_manifest.extend(ds18_imgs)
    all_images_manifest.extend(aux_imgs)
    all_images_manifest.extend(taller_imgs)

    # Save master seed
    master_seed_path = seeds_dir / "all_catalogs_unified_seed.json"
    with open(master_seed_path, "w", encoding="utf-8") as f:
        json.dump(all_unified, f, ensure_ascii=False, indent=2)
    print(f"Saved Master Unified Seed: {master_seed_path} ({len(all_unified)} total products)")

    # Save images manifest for downloader
    manifest_path = Path("scripts/catalog_images_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(all_images_manifest, f, ensure_ascii=False, indent=2)
    print(f"Saved Images Manifest: {manifest_path} ({len(all_images_manifest)} images registered)")

    print("=== SEED GENERATION COMPLETE ===")

if __name__ == "__main__":
    main()
