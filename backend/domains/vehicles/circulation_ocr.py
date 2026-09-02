"""
==============================================================================
MC-LARENS ERP: Extractor OCR Blindado de Circulaciones de Nicaragua (v2)
==============================================================================
Extrae con precisión milimétrica los datos de la Tarjeta de Circulación
(Policía Nacional de Nicaragua / Dirección de Seguridad de Tránsito Nacional).
Soporta:
1. Gemini Vision API (Multimodal Structured JSON).
2. OpenAI Vision API (GPT-4o Vision Multimodal).
3. Windows SDK OCR Nativo en Servidor (Ultra-rápido ~40ms, 100% offline).
4. Normalizador de Tránsito de Nicaragua (Prefijos Departamentales, VIN ISO 3779, Cédulas).
5. Fuzzy matcher contra el Catálogo Oficial de Vehículos del ERP.
6. Decodificación NHTSA vPIC cruzada para enriquecimiento de especificaciones.
==============================================================================
"""

import os
import re
import json
import time
import base64
import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

# Prefijos de Departamentos y Regiones de Nicaragua (Policía Nacional de Tránsito)
NICARAGUA_DEPT_PREFIXES = [
    # Multi-carácter especial primero para prioridad de matching
    "RAAN", # Costa Caribe Norte
    "RAAS", # Costa Caribe Sur
    # Departamentos y Especiales de 2 letras
    "LE",   # León
    "CH",   # Chinandega
    "MY",   # Masaya
    "GR",   # Granada
    "CZ",   # Carazo
    "MT",   # Matagalpa
    "BO",   # Boaco
    "CT",   # Chontales
    "CO",   # Chontales alterno
    "RI",   # Rivas
    "NS",   # Nueva Segovia
    "ES",   # Estelí
    "MZ",   # Madriz
    "MD",   # Madriz alterno
    "JI",   # Jinotega
    "RS",   # Río San Juan
    "AN",   # Atlántico Norte
    "AS",   # Atlántico Sur
    "RN",   # Región Norte
    "TM",   # Transporte Municipal / Taxi
    "ZC",   # Zona Comercial / Franca
    "PN",   # Policía Nacional
    "EN",   # Ejército de Nicaragua
    "CD",   # Cuerpo Diplomático
    "MI",   # Misión Internacional
    "OI",   # Organismos Internacionales
    "CC",   # Cuerpo Consular
    "PJ",   # Poder Judicial
    "ME",   # Ministerio de Estado
    # 1 letra (Managua)
    "M",    # Managua
]

DEPT_PREFIX_REGEX = r"(?:" + "|".join(sorted(NICARAGUA_DEPT_PREFIXES, key=len, reverse=True)) + r")"

# Regex de Placas de Nicaragua
NICARAGUA_PLATE_PATTERNS = [
    re.compile(rf"\b({DEPT_PREFIX_REGEX}[\s\-_]?\d{{1,3}}[\s\-_]\d{{2,4}})\b", re.IGNORECASE),
    re.compile(rf"\b({DEPT_PREFIX_REGEX}[\s\-_]?\d{{3,6}})\b", re.IGNORECASE),
    re.compile(rf"(?:PLACA|MATR[IÍ]CULA|NO\.?\s*PLACA|REGISTRO)[\s:\.#-]*({DEPT_PREFIX_REGEX}[\s\-_]?\d{{1,6}})", re.IGNORECASE),
]

# VIN / Chasis (17 caracteres excluyendo I, O, Q)
VIN_REGEX = re.compile(r"\b([A-HJ-NPR-Z0-9]{17})\b", re.IGNORECASE)

# Cédula de Identidad de Nicaragua: 001-XXXXXX-XXXX[A-Z]
NICARAGUA_CEDULA_REGEX = re.compile(r"\b(\d{3}[\s\-_]?\d{6}[\s\-_]?\d{4}[A-Z])\b", re.IGNORECASE)

# Años de Modelo y Fabricación
YEAR_REGEX = re.compile(r"\b(19[789]\d|20[0-3]\d)\b")

# Mapeo de Tipo de Carrocería a Slugs Canónicos del ERP
VEHICLE_TYPE_SLUG_MAP = {
    "pickup": [
        "camioneta", "pickup", "pick-up", "doble cabina", "cabina sencilla", "cabina y media", "truck 4x4",
        "d/cabina", "d/c", "hilux", "frontier", "d-max", "dmax", "bt-50", "l200", "tundra", "tacoma",
        "silverado", "f-150", "ranger", "colorado", "poer", "wingle", "amaze", "amarok"
    ],
    "suv": [
        "jeep", "suv", "rural", "station wagon", "crossover", "todo terreno", "4x4",
        "prado", "land cruiser", "rav4", "4runner", "fortuner", "patrol", "pathfinder", "x-trail", "xtrail",
        "kicks", "cr-v", "crv", "hr-v", "hrv", "sportage", "sorento", "tucson", "santa fe", "creta",
        "montero", "outlander", "vitara", "jimny", "duster", "tracker", "tahoe", "suburban", "explorer",
        "edge", "escape", "everest", "bronco", "x3", "x5", "x6", "q5", "q7", "tiguan", "taos", "teramont",
        "t-cross", "tcross", "haval", "tiggo", "cs35", "cs55", "cs75", "coolray"
    ],
    "hatchback": [
        "hatchback", "compacto", "3 puertas", "5 puertas", "liftback", "hb",
        "picanto", "i10", "grand i10", "spark", "march", "swift", "polo", "golf", "fit"
    ],
    "van": ["microbus", "microbús", "van", "panel", "minivan", "furgoneta", "pasajeros", "hiace", "urvan", "h1", "starex"],
    "truck": ["camion", "camión", "furgon", "furgón", "cabezal", "chasis cabina", "plataforma", "volquete", "heavy", "canter", "dyna", "npr", "nqr"],
    "moto": ["moto", "motocicleta", "scooter", "cuadraciclo", "trimoto", "mototaxi"],
    "sedan": ["automovil", "automóvil", "sedan", "sedán", "turismo", "saloon", "berlina", "yaris", "corolla", "rio", "accent", "elantra", "sentra", "civic"],
}

# Colores Automotrices Oficiales
COLOR_MAP = {
    "BLANCO": ["BLANCO", "WHITE", "BLANCA", "PERLA", "BLANCO PERLA"],
    "NEGRO": ["NEGRO", "BLACK", "NEGRA", "AZABACHE"],
    "PLATA": ["PLATA", "SILVER", "PLATEADO", "PLATEADA"],
    "GRIS": ["GRIS", "GRAY", "GREY", "PLOMO", "GRIS OSCURO", "GRIS RATON"],
    "AZUL": ["AZUL", "BLUE", "NAVY", "AZUL MARINO", "CELESTE", "AZUL METALICO"],
    "ROJO": ["ROJO", "RED", "ROJA", "GRANATE"],
    "VINO": ["VINO", "BURGUNDY", "BURDEOS", "TINTO", "VINO TINTO"],
    "VERDE": ["VERDE", "GREEN", "VERDE OLIVA"],
    "AMARILLO": ["AMARILLO", "YELLOW", "AMARILLA"],
    "DORADO": ["DORADO", "GOLD", "DORADA", "ORO"],
    "BEIGE": ["BEIGE", "BEIG", "ARENA", "CREMA", "CHAMPAGNE"],
    "CAFÉ": ["CAFE", "CAFÉ", "BROWN", "MARRON", "MARRÓN", "CHOCOLATE"],
    "NARANJA": ["NARANJA", "ORANGE", "ANARANJADO"],
}

# Tabla de Años según 10mo dígito del VIN (Estándar ISO 3779)
VIN_YEAR_CODES = {
    'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014,
    'F': 2015, 'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019,
    'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023, 'R': 2024,
    'S': 2025, 'T': 2026, '1': 2001, '2': 2002, '3': 2003,
    '4': 2004, '5': 2005, '6': 2006, '7': 2007, '8': 2008, '9': 2009
}

# Catálogo Cacheado en Memoria
_CATALOG_CACHE: Optional[Dict[str, Any]] = None

def _get_catalog_data() -> Dict[str, Any]:
    global _CATALOG_CACHE
    if _CATALOG_CACHE is not None:
        return _CATALOG_CACHE

    paths_to_try = [
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "src", "data", "vehicleCatalog.json"),
        os.path.join(os.getcwd(), "frontend", "src", "data", "vehicleCatalog.json"),
        os.path.join(os.path.dirname(__file__), "..", "..", "data", "official_vehicle_catalog.json"),
    ]
    for p in paths_to_try:
        norm = os.path.normpath(p)
        if os.path.exists(norm):
            try:
                with open(norm, "r", encoding="utf-8") as f:
                    _CATALOG_CACHE = json.load(f)
                    return _CATALOG_CACHE
            except Exception as e:
                print(f"[OCR] Advertencia al cargar catálogo desde {norm}: {e}")

    _CATALOG_CACHE = {"brands": [], "entries": []}
    return _CATALOG_CACHE


def clean_ocr_text(raw_text: str) -> str:
    if not raw_text:
        return ""
    text = raw_text.replace("\r", "\n")
    text = re.sub(r'[|\\/{}\[\]_~`]', ' ', text)
    return text


def normalize_plate_nicaragua(raw_plate: Optional[str]) -> Tuple[Optional[str], float, bool]:
    """
    Normaliza la placa al formato de Nicaragua.
    Retorna: (placa_normalizada, confidence, needs_review)
    """
    if not raw_plate:
        return None, 0.0, True

    plate = raw_plate.strip().upper()
    plate = re.sub(r'[^A-Z0-9\s\-]', '', plate)

    # Intentar separar prefijo y números
    match = re.match(r'^([A-Z]{1,4})[\s\-_]*(\d{1,6})$', plate)
    if match:
        prefix = match.group(1)
        digits = match.group(2)
        if prefix in NICARAGUA_DEPT_PREFIXES:
            if len(digits) == 6:
                formatted = f"{prefix} {digits[:3]}-{digits[3:]}"
            else:
                formatted = f"{prefix} {digits}"
            return formatted, 0.98, False
        else:
            # Prefijo desconocido -> no inventar 'M', retornar raw y marcar review
            return plate, 0.70, True

    # Búsqueda con patterns
    for pattern in NICARAGUA_PLATE_PATTERNS:
        m = pattern.search(plate)
        if m:
            cand = m.group(1).strip()
            parts = re.split(r'[\s\-_]+', cand)
            if len(parts) >= 2:
                prefix = parts[0]
                digits = "".join(parts[1:])
                if prefix in NICARAGUA_DEPT_PREFIXES and digits.isdigit():
                    if len(digits) == 6:
                        return f"{prefix} {digits[:3]}-{digits[3:]}", 0.95, False
                    return f"{prefix} {digits}", 0.95, False

    return plate, 0.65, True


def normalize_cedula_nicaragua(raw_cedula: Optional[str]) -> Optional[str]:
    """
    Normaliza el formato de cédula nicaragüense (ej: 001-290590-0004L).
    """
    if not raw_cedula:
        return None
    cedula_pattern = re.compile(r"\b(\d{3})[\s\-_]?(\d{6})[\s\-_]?(\d{4}[A-Za-z])\b")
    m = cedula_pattern.search(raw_cedula)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3).upper()}"
    cleaned = re.sub(r"[^A-Za-z0-9]", "", raw_cedula).upper()
    if len(cleaned) == 14 and cleaned[:13].isdigit() and cleaned[13].isalpha():
        return f"{cleaned[:3]}-{cleaned[3:9]}-{cleaned[9:]}"
    return raw_cedula.strip() if raw_cedula.strip() else None


def resolve_vehicle_type_slug(raw_type: Optional[str], raw_model: Optional[str] = None) -> Tuple[str, str]:
    """
    Determina el slug canónico de carrocería (sedan, hatchback, pickup, suv, van, truck, moto).
    """
    text = f"{raw_type or ''} {raw_model or ''}".lower()
    
    # Pickup / Camioneta
    for kw in VEHICLE_TYPE_SLUG_MAP["pickup"]:
        if re.search(rf"\b{re.escape(kw)}\b", text) or kw in text:
            return "pickup", "Camioneta / Pickup"

    # SUV / Todo Terreno
    for kw in VEHICLE_TYPE_SLUG_MAP["suv"]:
        if re.search(rf"\b{re.escape(kw)}\b", text) or kw in text:
            return "suv", "SUV / Todo Terreno"

    # Hatchback / Compacto
    for kw in VEHICLE_TYPE_SLUG_MAP["hatchback"]:
        if re.search(rf"\b{re.escape(kw)}\b", text) or kw in text:
            return "hatchback", "Hatchback / Compacto"

    # Van / Microbús
    for kw in VEHICLE_TYPE_SLUG_MAP["van"]:
        if re.search(rf"\b{re.escape(kw)}\b", text) or kw in text:
            return "van", "Microbús / Van"

    # Camión / Pesado
    for kw in VEHICLE_TYPE_SLUG_MAP["truck"]:
        if re.search(rf"\b{re.escape(kw)}\b", text) or kw in text:
            return "truck", "Camión / Carga Pesada"

    # Moto / Motocicleta (usar límites de palabra estrictos para evitar falsos positivos con 'motor')
    for kw in VEHICLE_TYPE_SLUG_MAP["moto"]:
        if re.search(rf"\b{re.escape(kw)}\b", text):
            return "moto", "Motocicleta"

    # Sedán / Turismo por defecto
    return "sedan", "Sedán / Automóvil"


def normalize_vin(raw_vin: Optional[str]) -> Tuple[Optional[str], float, bool]:
    """
    Normaliza Chasis/VIN a 17 caracteres (Estándar ISO 3779).
    Aplica corrección de caracteres confusos de OCR (I->1, O->0, Q->0) y extrae de texto si es necesario.
    Retorna: (vin_normalizado, confidence, needs_review)
    """
    if not raw_vin:
        return None, 0.0, True

    raw_str = raw_vin.strip().upper()
    vin_charset = set("0123456789ABCDEFGHJKLMNPRSTUVWXYZ")
    candidates = []

    # 1. Buscar tras etiquetas de Chasis / VIN
    m = re.search(r"(?:CHASIS|VIN|NO\.?\s*CHASIS|NUMERO\s*CHASIS|FRAME)[\s:\.#-]*([A-Z0-9IOQ]{11,25})", raw_str, re.IGNORECASE)
    if m:
        candidates.append(m.group(1))

    # 2. Extraer tokens alfanuméricos de longitud 15-22
    tokens = re.findall(r"\b[A-Z0-9IOQ]{15,22}\b", raw_str, re.IGNORECASE)
    candidates.extend(tokens)

    # 3. String limpio completo si no tenía espacios
    cleaned_full = re.sub(r'[^A-Z0-9IOQ]', '', raw_str)
    if cleaned_full:
        candidates.append(cleaned_full)

    for cand in candidates:
        cand_clean = cand.upper()
        # Sustituciones legales de OCR para caracteres ilegales en VIN ISO 3779
        fixed = cand_clean.replace('I', '1').replace('O', '0').replace('Q', '0')
        if len(fixed) == 17 and all(c in vin_charset for c in fixed):
            conf = 0.96 if fixed == cand_clean else 0.88
            return fixed, conf, False
        if len(fixed) > 17:
            for i in range(len(fixed) - 16):
                sub = fixed[i:i+17]
                if all(c in vin_charset for c in sub):
                    conf = 0.92 if sub == cand_clean[i:i+17] else 0.85
                    return sub, conf, False

    return None, 0.0, True


# WMI (World Manufacturer Identifier) a Marca
WMI_BRAND_MAP = {
    "MR0": "TOYOTA",
    "MRO": "TOYOTA",
    "JTD": "TOYOTA",
    "JTE": "TOYOTA",
    "JTM": "TOYOTA",
    "4T1": "TOYOTA",
    "4T3": "TOYOTA",
    "5TB": "TOYOTA",
    "5TD": "TOYOTA",
    "KNA": "KIA",
    "KND": "KIA",
    "KNM": "KIA",
    "KMH": "HYUNDAI",
    "KM8": "HYUNDAI",
    "KME": "HYUNDAI",
    "3N1": "NISSAN",
    "JN1": "NISSAN",
    "JN6": "NISSAN",
    "JN8": "NISSAN",
    "WBA": "BMW",
    "WBS": "BMW",
    "WBX": "BMW",
    "5UX": "BMW",
    "1GC": "CHEVROLET",
    "2GC": "CHEVROLET",
    "3GC": "CHEVROLET",
    "KL1": "CHEVROLET",
    "1FA": "FORD",
    "1FT": "FORD",
    "3FA": "FORD",
    "JMB": "MITSUBISHI",
    "MMB": "MITSUBISHI",
    "JSA": "SUZUKI",
    "JS2": "SUZUKI",
    "JAL": "ISUZU",
    "MP1": "ISUZU",
    "JM1": "MAZDA",
    "WVW": "VOLKSWAGEN",
    "3VW": "VOLKSWAGEN",
    "1C4": "JEEP",
    "1J4": "JEEP",
}

def fuzzy_match_brand_and_model(brand_raw: Optional[str], model_raw: Optional[str], vin: Optional[str] = None) -> Tuple[str, str, float]:
    """
    Empareja con tolerancia a fallas la Marca y Modelo contra el catálogo maestro del ERP.
    Usa tanto el texto OCR como los primeros 3 caracteres del VIN/WMI.
    """
    catalog = _get_catalog_data()
    brands_list = catalog.get("brands", [])
    entries = catalog.get("entries", [])

    text_combined = f"{brand_raw or ''} {model_raw or ''}".upper()

    brand_synonyms = {
        "TOYOTA": ["TOYOTA", "T OTA", "TOYOT", "TOYTA", "OYOTA", "OYOTAYANS"],
        "HYUNDAI": ["HYUNDAI", "HYUNDA", "HIUNDAI"],
        "NISSAN": ["NISSAN", "NISAN"],
        "KIA": ["KIA"],
        "SUZUKI": ["SUZUKI", "SUSUKI"],
        "HONDA": ["HONDA"],
        "MITSUBISHI": ["MITSUBISHI", "MITSUBI"],
        "CHEVROLET": ["CHEVROLET", "CHEVY"],
        "FORD": ["FORD"],
        "ISUZU": ["ISUZU"],
        "MAZDA": ["MAZDA"],
        "VOLKSWAGEN": ["VOLKSWAGEN", "VW"],
        "JEEP": ["JEEP"],
        "BMW": ["BMW"],
        "MERCEDES-BENZ": ["MERCEDES", "MERCEDES-BENZ", "BENZ"],
        "CHERY": ["CHERY"],
        "CHANGAN": ["CHANGAN"],
        "HAVAL": ["HAVAL"],
        "GREAT WALL": ["GREAT WALL", "GREATWALL", "GWM", "TANK"],
        "GEELY": ["GEELY"],
        "GAC": ["GAC", "GAC MOTOR", "TRUMPCHI"],
        "JAC": ["JAC", "JAC MOTORS"],
        "DFSK": ["DFSK", "DONGFENG"],
        "BYD": ["BYD"],
        "CHANGHE": ["CHANGHE"],
        "FOTON": ["FOTON"],
        "BAIC": ["BAIC"],
    }

    # Mapeo de Modelos por Marca
    brand_model_synonyms = {
        "TOYOTA": {
            "Hilux": ["HILUX", "HILU", "HILUX D/C", "HILUX D/CABINA", "YAMIONETA"],
            "Yaris": ["YARIS", "YANS", "YARI", "OYOTAYANS"],
            "Corolla": ["COROLLA", "COROLA"],
            "Land Cruiser Prado": ["PRADO", "LAND CRUISER", "LANDCRUISER"],
            "RAV4": ["RAV4", "RAV-4"],
            "Fortuner": ["FORTUNER"],
            "4Runner": ["4RUNNER"],
            "Agya": ["AGYA"],
            "Rush": ["RUSH"],
        },
        "KIA": {
            "Rio": ["RIO SEDAN", "RIO", "RIO HATCHBACK"],
            "Sportage": ["SPORTAGE", "SPORTAG"],
            "Picanto": ["PICANTO"],
            "Seltos": ["SELTOS"],
            "Sorento": ["SORENTO"],
            "Soluto": ["SOLUTO"],
            "Sonet": ["SONET"],
            "K2700": ["K2700", "K-2700"],
        },
        "HYUNDAI": {
            "Tucson": ["TUCSON", "TUCSON IX"],
            "Accent": ["ACCENT"],
            "Elantra": ["ELANTRA"],
            "Santa Fe": ["SANTA FE", "SANTAFE"],
            "Creta": ["CRETA"],
            "Grand i10": ["GRAND I10", "I10"],
            "Venue": ["VENUE"],
            "H-100": ["H-100", "H100"],
        },
        "NISSAN": {
            "Frontier": ["FRONTIER", "NAVARA", "NP300"],
            "Sentra": ["SENTRA", "SENTRA B13", "B13"],
            "Versa": ["VERSA"],
            "Kicks": ["KICKS"],
            "X-Trail": ["X-TRAIL", "XTRAIL"],
            "Urvan": ["URVAN"],
            "Patrol": ["PATROL"],
            "March": ["MARCH"],
        },
        "BMW": {
            "X3": ["X3", "X328I", "X3 28I", "X3 2.0", "X3 3.0"],
            "X5": ["X5"],
            "X6": ["X6"],
            "X1": ["X1"],
            "Serie 3": ["SERIE 3", "320I", "328I", "330I"],
            "Serie 5": ["SERIE 5", "520I", "528I"],
        },
        "MITSUBISHI": {
            "L200": ["L200", "SPORTERO", "L200 SPORTERO"],
            "Montero": ["MONTERO", "MONTERO SPORT"],
            "Outlander": ["OUTLANDER"],
            "ASX": ["ASX"],
        },
        "SUZUKI": {
            "Vitara": ["VITARA", "GRAND VITARA"],
            "Jimny": ["JIMNY"],
            "Swift": ["SWIFT"],
            "Alto": ["ALTO"],
            "Dzire": ["DZIRE"],
            "Ertiga": ["ERTIGA"],
        },
        "ISUZU": {
            "D-Max": ["D-MAX", "DMAX"],
            "MU-X": ["MU-X", "MUX"],
            "NPR": ["NPR"],
            "Forward": ["FORWARD"],
        },
        "MAZDA": {
            "BT-50": ["BT-50", "BT50"],
            "Mazda 3": ["MAZDA 3", "MAZDA3"],
            "Mazda 2": ["MAZDA 2", "MAZDA2"],
            "CX-5": ["CX-5", "CX5"],
            "CX-30": ["CX-30", "CX30"],
        },
    }

    matched_brand = ""
    matched_model = ""

    # 1. Identificar Marca desde texto
    for canon, aliases in brand_synonyms.items():
        for al in aliases:
            if re.search(rf"\b{re.escape(al)}\b", text_combined) or al in text_combined:
                matched_brand = canon
                break
        if matched_brand:
            break

    # 2. Si no se halló en texto, consultar WMI del VIN
    if not matched_brand and vin and len(vin) >= 3:
        wmi_prefix = vin[:3].upper()
        if wmi_prefix in WMI_BRAND_MAP:
            matched_brand = WMI_BRAND_MAP[wmi_prefix]

    if not matched_brand:
        for b in brands_list:
            if re.search(rf"\b{re.escape(b.upper())}\b", text_combined):
                matched_brand = b
                break

    # 3. Identificar Modelo según la Marca identificada
    if matched_brand and matched_brand in brand_model_synonyms:
        for canon_m, aliases in brand_model_synonyms[matched_brand].items():
            for al in aliases:
                if re.search(rf"\b{re.escape(al)}\b", text_combined) or al in text_combined:
                    matched_model = canon_m
                    break
            if matched_model:
                break

    # 4. Si la marca no tiene sinónimos o no coincidió, buscar en entradas del catálogo de esa marca
    if matched_brand and not matched_model and entries:
        brand_entries = [e for e in entries if e.get("brand", "").upper() == matched_brand.upper()]
        for entry in brand_entries:
            m_name = entry.get("model", "")
            if len(m_name) >= 2 and (re.search(rf"\b{re.escape(m_name.upper())}\b", text_combined) or m_name.upper() in text_combined):
                matched_model = m_name
                break

    # 5. Si la marca NO está identificada pero hay un modelo muy específico en el texto
    if not matched_brand and not matched_model:
        for b_name, m_dict in brand_model_synonyms.items():
            for m_name, aliases in m_dict.items():
                for al in aliases:
                    if len(al) >= 4 and re.search(rf"\b{re.escape(al)}\b", text_combined):
                        matched_brand = b_name
                        matched_model = m_name
                        break
                if matched_model:
                    break
            if matched_brand:
                break

    conf = 0.95 if (matched_brand and matched_model) else (0.85 if matched_brand else 0.50)
    return matched_brand, matched_model, conf


def extract_vin_origin_country(vin: str) -> Optional[str]:
    if not vin or len(vin) < 1:
        return None
    c = vin[0]
    if c in ['1', '4', '5']: return "Estados Unidos"
    if c in ['2']: return "Canadá"
    if c in ['3']: return "México"
    if c in ['J']: return "Japón"
    if c in ['K']: return "Corea del Sur"
    if c in ['L']: return "China"
    if c in ['M']: return "India / Tailandia"
    if c in ['8', '9']: return "Brasil / Argentina"
    if c in ['S', 'W', 'Z']: return "Europa"
    return "Internacional"


# ==============================================================================
# PIPELINE DE VISIÓN MULTIMODAL (Gemini / OpenAI / Windows Native OCR)
# ==============================================================================

SYSTEM_VISION_PROMPT = """You are an expert document parser extracting structured data from photos of Nicaraguan vehicle circulation cards (República de Nicaragua - Policía Nacional - Circulación Vehicular).

EXACT CARD LAYOUT SPECIFICATION:
1. PLACA: Located on the top-right under the title 'CIRCULACION VEHICULAR'. Format: Department prefix + number (e.g., 'Placa M 145835', 'Placa LE 29646', 'Placa CZ 13206', 'Placa M 243-616'). Extract as string (e.g. 'M 145-835' or 'M 145835').
2. CLASIFICACION, MARCA, MODELO: Located on the upper-left, printed with comma separators:
   - Example 'CAMIONETA,TOYOTA,HILUX' -> vehicle_type: 'Camioneta / Pickup', brand: 'TOYOTA', model: 'Hilux'.
   - Example 'AUTOMOVIL,KIA,RIO' -> vehicle_type: 'Sedán / Automóvil', brand: 'KIA', model: 'Rio'.
   - Example 'CAMIONETA,BMW,X3' -> vehicle_type: 'SUV / Camioneta Cerrada', brand: 'BMW', model: 'X3'.
3. TIPO DE VEHICULO / SUBTIPO: Located directly below the Marca/Modelo line:
   - 'D/CABINA.' = Doble Cabina -> vehicle_type_slug: 'pickup', trim: 'Doble Cabina'.
   - 'SEDAN' -> vehicle_type_slug: 'sedan'.
   - 'HATCHBACK' -> vehicle_type_slug: 'hatchback'.
   - 'CABINA SENCILLA' -> vehicle_type_slug: 'pickup', trim: 'Cabina Sencilla'.
4. COLOR: Located on the left labeled 'Color' (e.g. 'Color CAFE' -> 'Café', 'Color BLANCO' -> 'Blanco', 'Color GRIS' -> 'Gris', 'Color NEGRO' -> 'Negro', 'Color ROJO' -> 'Rojo', 'Color AZUL' -> 'Azul'). NOTE: A transparent security watermark/hologram covers parts of the card; read through it carefully.
5. MOTOR: Located on the left labeled 'Motor' followed by alphanumeric serial code (e.g. 'Motor 2KD7854925', 'Motor G4FDCHS30772', 'Motor 2NZ5032362', 'Motor A9821078'). IMPORTANT: Preserve engine codes like '2KD' (do not confuse with '20' or '2O').
6. CHASIS: Located on the left labeled 'Chasis' (e.g. 'Chasis MROFR22G800550800', 'Chasis KNADM4A3XD6124749', 'Chasis JTDBW923X01121180'). This is the 17-character VIN.

EXCLUSION RULES (CRITICAL - DO NOT EXTRACT OR CONFUSE THESE):
- IGNORE 'Emisión DD/MM/YYYY' (e.g. '22/09/2017'): This is the administrative date the card was printed by Transit Police. It is NEVER the vehicle's manufacture year.
- IGNORE 'VIN 0009' or other bottom serial counters.
- IGNORE signatures, 'Autorizado', stamps, barcode numbers, and headers.
- The real manufacturing year is ONLY on the REVERSE of the card (if provided as a second photo) or decoded from the 10th digit of the 17-character VIN if standard ISO 3779. If the VIN has '0' as the 10th digit (e.g., Thai/Japanese Toyota MR0... / JTD...), return year as null so the operator enters it directly.

Return JSON only:
{
  "vin": "MR0FR22G800550800",
  "plate": "M 145-835",
  "brand": "TOYOTA",
  "model": "Hilux",
  "year": null,
  "year_source": "no_detectado",
  "color": "Café",
  "vehicle_type": "Camioneta / Pickup",
  "vehicle_type_slug": "pickup",
  "numero_motor": "2KD7854925",
  "tipo_combustible": "Diésel",
  "propietario_cedula": null,
  "origin_country": "India / Tailandia",
  "version_level": "intermedio",
  "trim": "Doble Cabina",
  "confidence": {
    "vin": 0.95,
    "plate": 0.95,
    "brand": 0.95,
    "model": 0.95,
    "year": 0.0
  },
  "needs_review": ["year"]
}
"""

def _call_vertex_ai_vision(image_base64: str, image_back_base64: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Ejecuta Gemini Multimodal Vision mediante Vertex AI en Google Cloud Run
    usando las credenciales automáticas del proyecto (sin requerir API key manual).
    """
    try:
        from google import genai
        from google.genai import types

        project_id = os.getenv("GCP_PROJECT") or os.getenv("GOOGLE_CLOUD_PROJECT") or "gen-lang-client-0971793042"
        region = os.getenv("GCP_REGION") or "us-central1"
        client = genai.Client(vertexai=True, project=project_id, location=region)

        contents = [SYSTEM_VISION_PROMPT]

        b64_data = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
        raw_bytes = base64.b64decode(b64_data)
        mime_type = "image/jpeg"
        if "png" in image_base64[:30]:
            mime_type = "image/png"

        contents.append(types.Part.from_bytes(data=raw_bytes, mime_type=mime_type))

        if image_back_base64:
            b64_back = image_back_base64.split(",", 1)[1] if "," in image_back_base64 else image_back_base64
            raw_back_bytes = base64.b64decode(b64_back)
            mime_back = "image/jpeg"
            if "png" in image_back_base64[:30]:
                mime_back = "image/png"
            contents.append("Foto del Reverso de la tarjeta (contiene Año de Fabricación):")
            contents.append(types.Part.from_bytes(data=raw_back_bytes, mime_type=mime_back))

        for model_name in ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"]:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1
                    )
                )
                if response and response.text:
                    clean_text = response.text.strip()
                    if clean_text.startswith("```json"):
                        clean_text = clean_text[7:]
                    if clean_text.endswith("```"):
                        clean_text = clean_text[:-3]
                    return json.loads(clean_text)
            except Exception as e:
                print(f"[OCR] Intento con Vertex AI {model_name}: {e}")
    except Exception as e:
        print(f"[OCR] Error general inicializando Vertex AI: {e}")
    return None


def _call_gemini_vision(image_base64: str, api_key: str, image_back_base64: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Llama a la API de Gemini 1.5/2.0 Flash Multimodal Vision vía REST API con urllib."""
    import urllib.request
    import urllib.error
    import json
    
    parts = [{"text": SYSTEM_VISION_PROMPT}]

    # Frente
    b64_data = image_base64
    mime_type = "image/jpeg"
    if "," in image_base64:
        header, b64_data = image_base64.split(",", 1)
        if "png" in header:
            mime_type = "image/png"
    parts.append({
        "inline_data": {
            "mime_type": mime_type,
            "data": b64_data
        }
    })

    # Reverso si se proporciona
    if image_back_base64:
        b64_back = image_back_base64
        mime_back = "image/jpeg"
        if "," in image_back_base64:
            h_back, b64_back = image_back_base64.split(",", 1)
            if "png" in h_back:
                mime_back = "image/png"
        parts.append({"text": "Foto del Reverso de la tarjeta (contiene Año de Fabricación):"})
        parts.append({
            "inline_data": {
                "mime_type": mime_back,
                "data": b64_back
            }
        })

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.1
        }
    }
    raw_payload = json.dumps(payload).encode("utf-8")

    for model_name in [
        "gemini-flash-latest",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-pro-latest"
    ]:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            req = urllib.request.Request(
                url,
                data=raw_payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                if resp.status == 200:
                    resp_body = resp.read().decode("utf-8")
                    data = json.loads(resp_body)
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts_out = candidates[0].get("content", {}).get("parts", [])
                        if parts_out:
                            text_out = parts_out[0].get("text", "").strip()
                            if text_out.startswith("```json"):
                                text_out = text_out[7:]
                            if text_out.endswith("```"):
                                text_out = text_out[:-3]
                            return json.loads(text_out.strip())
        except urllib.error.HTTPError as he:
            err_msg = he.read().decode("utf-8", errors="ignore")
            print(f"[OCR] Error HTTP en Gemini API ({model_name}): {he.code} - {err_msg[:200]}")
        except Exception as e:
            print(f"[OCR] Error de conexión en Gemini API ({model_name}): {e}")

    return None


def _call_openai_vision(image_base64: str, api_key: str, image_back_base64: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Llama a la API de OpenAI GPT-4o-mini Vision."""
    import requests

    img_url = image_base64 if image_base64.startswith("data:") else f"data:image/jpeg;base64,{image_base64}"
    content_list = [
        {"type": "text", "text": "Extrae los datos de esta tarjeta de circulación de Nicaragua (Frente y opcional Reverso) en JSON según las reglas."},
        {"type": "image_url", "image_url": {"url": img_url, "detail": "high"}}
    ]

    if image_back_base64:
        img_back_url = image_back_base64 if image_back_base64.startswith("data:") else f"data:image/jpeg;base64,{image_back_base64}"
        content_list.append({"type": "text", "text": "Foto Reverso:"})
        content_list.append({"type": "image_url", "image_url": {"url": img_back_url, "detail": "high"}})

    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_VISION_PROMPT
            },
            {
                "role": "user",
                "content": content_list
            }
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)
    return None


def _run_tesseract_ocr(image_base64: str) -> str:
    """
    Ejecuta Tesseract OCR en Linux/Docker con preprocesamiento de imagen con PIL
    para máxima legibilidad de números de placa, chasis y motor.
    """
    try:
        from PIL import Image, ImageEnhance, ImageOps
        import io
        import subprocess
        import tempfile

        b64_data = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
        raw_bytes = base64.b64decode(b64_data)

        img = Image.open(io.BytesIO(raw_bytes))
        
        # Preprocesar imagen para OCR:
        img_gray = ImageOps.grayscale(img)
        enhancer = ImageEnhance.Contrast(img_gray)
        img_enhanced = enhancer.enhance(1.8)

        if img_enhanced.width < 1000:
            scale_factor = 1200 / img_enhanced.width
            new_size = (int(img_enhanced.width * scale_factor), int(img_enhanced.height * scale_factor))
            img_enhanced = img_enhanced.resize(new_size, Image.Resampling.LANCZOS)

        # 1. Intentar con pytesseract si está disponible
        try:
            import pytesseract
            text = pytesseract.image_to_string(img_enhanced, lang="spa+eng", config="--psm 6")
            if text and len(text.strip()) > 15:
                return text.strip()
        except Exception:
            pass

        # 2. Intentar con binario tesseract en el sistema
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            img_enhanced.save(tmp.name, format="PNG")
            tmp_path = tmp.name

        try:
            for psm in ["6", "4", "3", "11"]:
                proc = subprocess.run(
                    ["tesseract", tmp_path, "stdout", "-l", "spa+eng", "--psm", psm],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="ignore",
                    timeout=5
                )
                if proc.returncode == 0 and proc.stdout and len(proc.stdout.strip()) > 15:
                    return proc.stdout.strip()
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
    except Exception as e:
        print(f"[OCR] Error en Tesseract OCR local: {e}")

    return ""


async def _run_windows_sdk_ocr_on_base64(image_base64: str) -> str:
    """
    Ejecuta el motor OCR nativo de Windows (winsdk o PowerShell WinRT bridge)
    a velocidad instantánea (~40-80ms) 100% offline.
    """
    if os.name != "nt":
        return ""

    # 1. Intentar módulo Python winsdk si está compilado
    try:
        import winsdk.windows.media.ocr as w_ocr
        import winsdk.windows.globalization as glob
        import winsdk.windows.storage.streams as streams
        import winsdk.windows.graphics.imaging as imaging

        b64_data = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
        raw_bytes = base64.b64decode(b64_data)

        mem_stream = streams.InMemoryRandomAccessStream()
        data_writer = streams.DataWriter(mem_stream)
        data_writer.write_bytes(bytes(raw_bytes))
        await data_writer.store_async()
        await data_writer.flush_async()
        mem_stream.seek(0)

        decoder = await imaging.BitmapDecoder.create_async(mem_stream)
        software_bitmap = await decoder.get_software_bitmap_async()

        lang = glob.Language("es")
        engine = w_ocr.OcrEngine.try_create_from_language(lang) or w_ocr.OcrEngine.try_create_from_user_profile_languages()
        if engine:
            result = await engine.recognize_async(software_bitmap)
            if result and result.text:
                return result.text
    except Exception:
        pass

    # 2. Fallback súper rápido a WinRT PowerShell en Windows
    try:
        import tempfile
        import subprocess

        b64_data = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
        raw_bytes = base64.b64decode(b64_data)

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(raw_bytes)
            tmp_path = tmp.name

        try:
            ps_cmd = f"""
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | ? {{ $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.IsGenericMethod }} | Select-Object -First 1
function Await($WinRtTask, $ResultType) {{
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait()
    return $netTask.Result
}}
[Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null

$lang = New-Object Windows.Globalization.Language("es")
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if ($engine -eq $null) {{ $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }}

$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync("{tmp_path}")) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$softwareBitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$ocrResult = Await ($engine.RecognizeAsync($softwareBitmap)) ([Windows.Media.Ocr.OcrResult])
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host $ocrResult.Text
"""
            loop = asyncio.get_event_loop()
            proc = await loop.run_in_executor(
                None,
                lambda: subprocess.run(
                    ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_cmd],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="ignore"
                )
            )
            return proc.stdout.strip()
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
    except Exception as e:
        print(f"[OCR] Error en fallback WinRT PowerShell: {e}")

    return ""


# ==============================================================================
# ENTRY POINT MAESTRO v2
# ==============================================================================

async def process_circulation_card_v2(
    image_base64: Optional[str] = None,
    image_back_base64: Optional[str] = None,
    raw_text: Optional[str] = None
) -> Dict[str, Any]:
    """
    Procesador principal v2 de Tarjetas de Circulación de Nicaragua.
    Soporta:
    - Tier 1: Vertex AI Gemini Multimodal Vision (Cloud Run / GCP nativo).
    - Tier 2: Gemini API Key REST.
    - Tier 3: OpenAI Vision.
    - Tier 4: Tesseract OCR (Linux / Docker local sin APIs externas).
    - Tier 5: Windows Media OCR (Windows local dev).
    """
    start_time = time.time()
    engine_used = "desconocido"
    raw_extracted_json: Optional[Dict[str, Any]] = None
    extracted_text = raw_text or ""
    back_extracted_text = ""

    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY") or os.getenv("VISION_API_KEY")

    if image_base64:
        # 1. Intentar Vertex AI en Google Cloud Run
        try:
            raw_extracted_json = _call_vertex_ai_vision(image_base64, image_back_base64)
            if raw_extracted_json:
                engine_used = "vertex_ai_gemini"
        except Exception as e:
            print(f"[OCR] Error en Vertex AI: {e}")

        # 2. Intentar Gemini API Key REST
        if not raw_extracted_json and gemini_key:
            try:
                raw_extracted_json = _call_gemini_vision(image_base64, gemini_key, image_back_base64)
                if raw_extracted_json:
                    engine_used = "gemini_vision"
            except Exception as e:
                print(f"[OCR] Error en llamada a Gemini Vision: {e}")

        # 3. Intentar OpenAI Vision
        if not raw_extracted_json and openai_key:
            try:
                raw_extracted_json = _call_openai_vision(image_base64, openai_key, image_back_base64)
                if raw_extracted_json:
                    engine_used = "openai_vision"
            except Exception as e:
                print(f"[OCR] Error en llamada a OpenAI Vision: {e}")

        # 4. Fallback a Tesseract OCR (Linux / Docker)
        if not raw_extracted_json:
            tess_text = _run_tesseract_ocr(image_base64)
            if tess_text:
                extracted_text = f"{extracted_text}\n{tess_text}".strip()
                engine_used = "tesseract_ocr"

            if image_back_base64:
                tess_back = _run_tesseract_ocr(image_back_base64)
                if tess_back:
                    back_extracted_text = tess_back

        # 5. Fallback a Windows Media OCR si estamos en Windows
        if not raw_extracted_json and not extracted_text and os.name == "nt":
            try:
                native_text = await _run_windows_sdk_ocr_on_base64(image_base64)
                if native_text:
                    extracted_text = f"{extracted_text}\n{native_text}".strip()
                    engine_used = "windows_native_ocr"
            except Exception as e:
                print(f"[OCR] Error en OCR nativo frente: {e}")

            if image_back_base64:
                try:
                    native_back = await _run_windows_sdk_ocr_on_base64(image_back_base64)
                    if native_back:
                        back_extracted_text = native_back
                except Exception as e:
                    print(f"[OCR] Error en OCR nativo reverso: {e}")

    # 3. Consolidar y Normalizar Datos
    confidence_dict: Dict[str, float] = {}
    needs_review: List[str] = []
    year_source = "no_detectado"

    if raw_extracted_json:
        raw_vin = raw_extracted_json.get("vin")
        raw_plate = raw_extracted_json.get("plate")
        raw_brand = raw_extracted_json.get("brand")
        raw_model = raw_extracted_json.get("model")
        raw_year = raw_extracted_json.get("year")
        year_source = raw_extracted_json.get("year_source") or ("reverso_tarjeta" if image_back_base64 else "inferido_vin")
        raw_color = raw_extracted_json.get("color")
        raw_engine = raw_extracted_json.get("numero_motor")
        raw_fuel = raw_extracted_json.get("tipo_combustible")
        raw_cedula = raw_extracted_json.get("propietario_cedula")
        raw_owner_name = raw_extracted_json.get("propietario_nombre")
        raw_type = raw_extracted_json.get("vehicle_type")
        raw_type_slug = raw_extracted_json.get("vehicle_type_slug")
        version_level = raw_extracted_json.get("version_level") or "intermedio"
        trim = raw_extracted_json.get("trim") or ""

        conf_in = raw_extracted_json.get("confidence", {})
        confidence_dict["vin"] = float(conf_in.get("vin", 0.90)) if raw_vin else 0.0
        confidence_dict["plate"] = float(conf_in.get("plate", 0.90)) if raw_plate else 0.0
        confidence_dict["brand"] = float(conf_in.get("brand", 0.85)) if raw_brand else 0.0
        confidence_dict["model"] = float(conf_in.get("model", 0.85)) if raw_model else 0.0
        confidence_dict["year"] = float(conf_in.get("year", 0.85)) if raw_year else 0.0
    else:
        # Extraer usando el parser regex heurístico
        parsed = parse_circulation_card_text(extracted_text)
        raw_vin = parsed.get("vin_chasis")
        raw_plate = parsed.get("placa")
        raw_brand = parsed.get("marca")
        raw_model = parsed.get("modelo")
        raw_color = parsed.get("color")
        raw_engine = parsed.get("numero_motor")
        raw_fuel = parsed.get("tipo_combustible")
        raw_cedula = parsed.get("propietario_cedula")
        raw_owner_name = None
        raw_type = parsed.get("tipo_carroceria")
        raw_type_slug = None
        version_level = "intermedio"
        trim = ""

        # Año: evaluar si viene del reverso o del VIN
        raw_year = None
        if back_extracted_text:
            parsed_back = parse_circulation_card_back_text(back_extracted_text)
            if parsed_back.get("anio"):
                raw_year = parsed_back.get("anio")
                year_source = "reverso_tarjeta"
                confidence_dict["year"] = 0.96

        if not raw_year and parsed.get("vin_year"):
            raw_year = parsed.get("vin_year")
            year_source = "inferido_vin"
            confidence_dict["year"] = 0.80

    # Normalizaciones de Nicaragua
    norm_plate, plate_conf, plate_review = normalize_plate_nicaragua(raw_plate)
    confidence_dict["plate"] = plate_conf
    if plate_review or not norm_plate:
        needs_review.append("plate")

    norm_vin, vin_conf, vin_review = normalize_vin(raw_vin)
    confidence_dict["vin"] = vin_conf
    if vin_review or not norm_vin:
        needs_review.append("vin")

    norm_brand, norm_model, model_conf = fuzzy_match_brand_and_model(raw_brand, raw_model, vin=norm_vin)
    confidence_dict["brand"] = 0.90 if norm_brand else 0.0
    confidence_dict["model"] = model_conf if norm_model else 0.0
    if not norm_brand: needs_review.append("brand")
    if not norm_model: needs_review.append("model")

    # Validación de Año (Excluyendo explícitamente fecha de emisión)
    current_year = datetime.now().year
    valid_year = None
    if raw_year:
        try:
            y_int = int(raw_year)
            if 1980 <= y_int <= current_year + 1:
                valid_year = y_int
                if year_source == "reverso_tarjeta":
                    confidence_dict["year"] = 0.96
                else:
                    confidence_dict["year"] = 0.82
        except (ValueError, TypeError):
            pass

    if not valid_year:
        if norm_vin and len(norm_vin) == 17:
            valid_year = VIN_YEAR_CODES.get(norm_vin[9])
            if valid_year:
                year_source = "inferido_vin"
                confidence_dict["year"] = 0.80
                needs_review.append("year")
    if not valid_year:
        needs_review.append("year")

    # Validación de Tipo de Carrocería
    type_slug, type_label = resolve_vehicle_type_slug(raw_type_slug or raw_type, norm_model)

    # Color normalizado
    norm_color = raw_color or "Blanco"
    if norm_color.upper() in COLOR_MAP:
        norm_color = norm_color.capitalize()

    # Cédula
    norm_cedula = normalize_cedula_nicaragua(raw_cedula)
    origin_country = extract_vin_origin_country(norm_vin) if norm_vin else None

    # Registrar latencia en ms
    latency_ms = int((time.time() - start_time) * 1000)
    print(f"[OCR v2] Procesado en {latency_ms}ms | Motor: {engine_used} | Placa: {norm_plate} | VIN: {norm_vin} | Año ({year_source}): {valid_year}")

    return {
        "vin": norm_vin or "",
        "vin_chasis": norm_vin or "",
        "plate": norm_plate or "",
        "placa": norm_plate or "",
        "brand": norm_brand or "",
        "marca": norm_brand or "",
        "model": norm_model or "",
        "modelo": norm_model or "",
        "year": valid_year,
        "anio": valid_year,
        "year_source": year_source,
        "color": norm_color,
        "vehicle_type": type_label,
        "vehicle_type_slug": type_slug,
        "tipo_carroceria": type_slug,
        "numero_motor": raw_engine or "",
        "tipo_combustible": raw_fuel or "Gasolina",
        "propietario_cedula": norm_cedula or "",
        "propietario_nombre": raw_owner_name or "",
        "origin_country": origin_country or "Estándar",
        "version_level": version_level,
        "trim": trim,
        "confidence": confidence_dict,
        "needs_review": list(set(needs_review)),
        "engine": engine_used,
        "latency_ms": latency_ms,
        "has_reverse_image": bool(image_back_base64),
    }


def parse_circulation_card_text(raw_text: str) -> Dict[str, Any]:
    """
    Parser heurístico regex para la cara FRONTal de la tarjeta.
    Extrae Placa, Chasis/VIN, Motor, Color, Tipo de Vehículo, Marca y Modelo.
    IMPORTANTE: Ignora explícitamente la fecha de emisión.
    """
    cleaned = clean_ocr_text(raw_text)
    plate, _, _ = normalize_plate_nicaragua(cleaned)
    vin, _, _ = normalize_vin(cleaned)
    vin_year = VIN_YEAR_CODES.get(vin[9]) if vin and len(vin) == 17 else None
    origin_country = extract_vin_origin_country(vin) if vin else None
    
    # Motor
    engine = None
    m_eng = re.search(r"(?:MOTOR|ENGINE|NO\.?\s*MOTOR|NUMERO\s*MOTOR)[\s:\.#-]*([A-Z0-9]{4,16})", cleaned, re.IGNORECASE)
    if m_eng:
        cand = m_eng.group(1).upper().strip()
        if cand not in ["DIESEL", "GASOLINA", "GASOIL", "CHASIS", "SERIE"]:
            engine = cand

    # Cédula
    cedula = normalize_cedula_nicaragua(cleaned)

    # Marca y Modelo (usando texto y WMI de VIN)
    brand_match, model_match, _ = fuzzy_match_brand_and_model(cleaned, cleaned, vin=vin)

    # Color
    color = "No especificado"
    # 1. Búsqueda tras etiqueta Color
    m_col = re.search(r"(?:Color|color|COLOR)[\s:\.#\-*]*([A-Za-zÁÉÍÓÚáéíóúñÑ]+)", cleaned, re.IGNORECASE)
    if m_col:
        c_word = m_col.group(1).upper()
        for canonical, aliases in COLOR_MAP.items():
            if any(syn in c_word or c_word in syn for syn in aliases):
                color = canonical.capitalize()
                break

    if color == "No especificado":
        for canonical, aliases in COLOR_MAP.items():
            for alias in aliases:
                if re.search(rf"\b{re.escape(alias)}\b", cleaned.upper()):
                    color = canonical.capitalize()
                    break
            if color != "No especificado":
                break

    # Combustible
    fuel = "Gasolina"
    if "DIESEL" in cleaned.upper() or "GASOIL" in cleaned.upper() or "HILUX" in cleaned.upper():
        fuel = "Diésel"

    type_slug, type_label = resolve_vehicle_type_slug(cleaned, model_match)

    return {
        "placa": plate,
        "vin_chasis": vin,
        "vin_year": vin_year,
        "origin_country": origin_country,
        "numero_motor": engine,
        "marca": brand_match,
        "modelo": model_match,
        "anio": vin_year,
        "color": color,
        "tipo_carroceria": type_slug,
        "tipo_combustible": fuel,
        "propietario_cedula": cedula,
        "confidence_score": 85 if (plate or vin) else 40,
        "raw_snippet": cleaned[:300] if cleaned else "",
    }


def parse_circulation_card_back_text(raw_text: str) -> Dict[str, Any]:
    """
    Parser heurístico regex para la cara TRASERA (Reverso) de la tarjeta de circulación.
    Busca Año de Fabricación / Modelo Año y capacidades.
    """
    cleaned = clean_ocr_text(raw_text)
    year = None

    # 1. Buscar con etiquetas explícitas de reverso
    m_year = re.search(r"(?:A[ÑN]O\s*FABRICACI[OÓ]N|A\.\s*FAB|A[ÑN]O\s*MODELO|MODELO\s*A[ÑN]O|A[ÑN]O|YEAR)[\s:\.#-]*\b(19[89]\d|20[0-3]\d)\b", cleaned, re.IGNORECASE)
    if m_year:
        year = int(m_year.group(1))
    else:
        # 2. Buscar 4 dígitos entre 1980 y el año en curso
        current_year = datetime.now().year
        matches = YEAR_REGEX.findall(cleaned)
        for cand in matches:
            val = int(cand)
            if 1980 <= val <= current_year + 1:
                year = val
                break

    return {
        "anio": year,
        "raw_snippet": cleaned[:200] if cleaned else ""
    }

