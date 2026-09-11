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
                # Extract years from label like "Hilux [2018-2022]"
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
        main_source = raw.get("imagen_principal_url") or raw.get("imagen_principal")
        add_sources = raw.get("imagenes_adicionales_urls") or raw.get("imagenes_adicionales") or []
        
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
            "category": "accesorios_iluminacion",
            "subcategory": "Faros antiniebla / Neblineras",
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
        cat_name = cats[0] if cats else "repuestos_mantenimiento"

        prod_doc = {
            "product_id": f"prod_fs_{sku.lower()}",
            "sku": sku,
            "name": name,
            "brand": brand,
            "category": "repuestos_mantenimiento",
            "subcategory": cat_name,
            "description": raw.get("descripcion") or f"{name} distribuido por Fernández Sera Nicaragua.",
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
                "compatibilidad_texto": "Universal / Insumo de Mantenimiento",
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

        prod_doc = {
            "product_id": f"prod_meg_{sku.lower()}",
            "sku": sku,
            "name": name,
            "brand": "Meguiar's",
            "category": "cuidado_automotriz",
            "subcategory": "Detailing y Pulido",
            "description": raw.get("descripcion") or f"Línea profesional Meguiar's {name}.",
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
        subcat = raw.get("categoria", "Receptores Multimedia")

        # Base pricing heuristic for Pioneer components
        price = float(raw.get("precio", 0) or 0)
        if price <= 0:
            if "Multimedia" in subcat or "Pantalla" in subcat:
                price = 280.0
            elif "Amplificador" in subcat:
                price = 190.0
            elif "Subwoofer" in subcat:
                price = 130.0
            elif "Parlantes" in subcat:
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
            "category": "car_audio",
            "subcategory": subcat,
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
            "category": "car_audio",
            "subcategory": "Pro Audio / Altavoces y Drivers",
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
            "category": "accesorios_iluminacion",
            "subcategory": "Barras y Pods LED Offroad",
            "description": raw.get("descripcion") or f"Faro auxiliar / barra LED Auxbeam {name}.",
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

    # Save specific catalog seeds
    seeds = {
        "dlaa_halogens_seed.json": dlaa_prods,
        "fernandez_sera_seed.json": fs_prods,
        "meguiars_seed.json": meg_prods,
        "pioneer_seed.json": pio_prods,
        "ds18_seed.json": ds18_prods,
        "auxbeam_seed.json": aux_prods,
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
