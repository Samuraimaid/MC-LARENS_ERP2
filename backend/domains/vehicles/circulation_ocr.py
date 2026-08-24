"""
==============================================================================
MC-LARENS ERP: Extractor OCR Blindado de Circulaciones de Nicaragua
==============================================================================
Extrae con precisión milimétrica los datos de la Tarjeta de Circulación
(Policía Nacional de Nicaragua / Dirección de Seguridad de Tránsito Nacional).
Soporta procesamiento multimodal con Gemini Vision y parser heurístico regex.
==============================================================================
"""

import re
from typing import Any, Dict, List, Optional

# Prefijos de Departamentos y Regiones de Nicaragua
NICARAGUA_DEPT_PREFIXES = [
    "M",    # Managua
    "MY",   # Masaya
    "GR",   # Granada
    "LE",   # León
    "CH",   # Chinandega
    "MT",   # Matagalpa
    "JI",   # Jinotega
    "ES",   # Estelí
    "MD",   # Madriz
    "NS",   # Nueva Segovia
    "BO",   # Boaco
    "CO",   # Chontales
    "CT",   # Chontales alterno
    "RI",   # Rivas
    "RS",   # Río San Juan
    "RAAN", # Costa Caribe Norte
    "RAAS", # Costa Caribe Sur
    "RN",   # Región Norte
    "CC",   # Cuerpo Consular / Especial
    "CD",   # Cuerpo Diplomático
    "OI",   # Organismos Internacionales
    "MI",   # Misión Internacional
    "PJ",   # Poder Judicial
    "ME",   # Ministerio de Estado
]

DEPT_PREFIX_REGEX = r"(?:" + "|".join(NICARAGUA_DEPT_PREFIXES) + r")"

# 1. Regex de Placas de Nicaragua: Prefijo + 1 a 6 dígitos (con o sin guión o espacio)
NICARAGUA_PLATE_PATTERNS = [
    # M 324-589 o GR 145-231
    re.compile(rf"\b({DEPT_PREFIX_REGEX}[\s\-_]?\d{{1,3}}[\s\-_]\d{{2,4}})\b", re.IGNORECASE),
    # M 324589 o LE 23145 o MT 8741
    re.compile(rf"\b({DEPT_PREFIX_REGEX}[\s\-_]?\d{{3,6}})\b", re.IGNORECASE),
    # Contexto explícito PLACA: M 123456
    re.compile(rf"(?:PLACA|MATR[IÍ]CULA|NO\.?\s*PLACA|REGISTRO)[\s:\.#-]*({DEPT_PREFIX_REGEX}[\s\-_]?\d{{1,6}})", re.IGNORECASE),
]

# 2. VIN / Chasis (17 caracteres alfanuméricos excluyendo I, O, Q)
VIN_REGEX = re.compile(r"\b([A-HJ-NPR-Z0-9]{17})\b", re.IGNORECASE)

# 3. Cédula de Identidad de Nicaragua: 001-XXXXXX-XXXX[A-Z]
NICARAGUA_CEDULA_REGEX = re.compile(r"\b(\d{3}[\s\-_]?\d{6}[\s\-_]?\d{4}[A-Z])\b", re.IGNORECASE)

# 4. Años de Modelo y Fabricación
YEAR_REGEX = re.compile(r"\b(19[789]\d|20[0-3]\d)\b")

# 5. Colores Automotrices Oficiales
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

# 6. Marcas Principales
KNOWN_BRANDS = [
    "TOYOTA", "NISSAN", "HYUNDAI", "KIA", "MITSUBISHI", "ISUZU",
    "CHEVROLET", "FORD", "SUZUKI", "HONDA", "MAZDA", "VOLKSWAGEN",
    "BMW", "MERCEDES-BENZ", "MERCEDES", "AUDI", "JEEP", "SUBARU",
    "RAM", "GMC", "PEUGEOT", "RENAULT", "FIAT", "BYD", "GEELY",
    "CHERY", "GREAT WALL", "HAVAL", "JAC", "CHANGAN", "HINO",
    "MACK", "FREIGHTLINER", "INTERNATIONAL", "LAND ROVER", "LEXUS",
    "VOLVO", "DODGE", "CHRYSLER", "CADILLAC", "LINCOLN", "PORSCHE", "MINI"
]

# 7. Modelos Populares
KNOWN_MODELS = [
    # Toyota
    "HILUX", "COROLLA", "YARIS", "RAV4", "PRADO", "LAND CRUISER", "FORTUNER",
    "HIACE", "AGYA", "RUSH", "TACOMA", "TUNDRA", "CAMRY", "AVANZA", "COROLLA CROSS",
    # Nissan
    "FRONTIER", "NP300", "SENTRA", "VERSA", "KICKS", "QASHQAI", "X-TRAIL", "URVAN",
    "TIIDA", "MARCH", "PATROL", "NAVARA", "ALTIMA", "PATHFINDER",
    # Hyundai
    "TUCSON", "SANTA FE", "ELANTRA", "ACCENT", "GRAND I10", "I10", "CRETA",
    "H-1", "H1", "STARIA", "VENUE", "KONA", "PALISADE", "HD65", "HD72",
    # Kia
    "SPORTAGE", "SORENTO", "RIO", "PICANTO", "SELTOS", "SOLUTO", "CERATO",
    "K2700", "K3000", "BONGO", "SOUL", "SONET", "CARNIVAL",
    # Mitsubishi
    "L200", "MONTERO", "MONTERO SPORT", "OUTLANDER", "ASX", "ECLIPSE CROSS",
    "MIRAGE", "LANCER", "CANTER", "FUSO",
    # Isuzu
    "D-MAX", "DMAX", "MU-X", "MUX", "NKR", "NPR", "NQR", "FORWARD", "FVR",
    # Suzuki
    "JIMNY", "VITARA", "GRAND VITARA", "SWIFT", "ALTO", "DZIRE", "FRONX", "ERTIGA",
    # Ford / Chevrolet
    "RANGER", "F-150", "F150", "EXPLORER", "ESCAPE", "EVEREST", "DMAX",
    "COLORADO", "D-MAX", "AVEO", "ONIX", "TRACKER", "SILVERADO", "TAHOE"
]

# Tabla de Años según 10mo dígito del VIN (Estándar ISO 3779)
VIN_YEAR_CODES = {
    'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014,
    'F': 2015, 'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019,
    'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023, 'R': 2024,
    'S': 2025, 'T': 2026, '1': 2001, '2': 2002, '3': 2003,
    '4': 2004, '5': 2005, '6': 2006, '7': 2007, '8': 2008, '9': 2009
}

def clean_ocr_text(raw_text: str) -> str:
    if not raw_text:
        return ""
    text = raw_text.replace("\r", "\n")
    # Limpiar caracteres comunes de ruido en OCR
    text = re.sub(r'[|\\/{}\[\]_~`]', ' ', text)
    return text

def extract_nicaragua_plate(text: str) -> Optional[str]:
    """Extrae la placa de Nicaragua con prefijo departamental validado."""
    if not text:
        return None
    for pattern in NICARAGUA_PLATE_PATTERNS:
        for match in pattern.finditer(text):
            candidate = match.group(1).strip().upper()
            candidate = re.sub(r'[\s\-_]+', '-', candidate)
            # Re-estructurar prefijo y número (ej: M-324-589 -> M 324-589 o M-123456)
            parts = candidate.split('-')
            if len(parts) >= 2:
                prefix = parts[0]
                digits = "".join(parts[1:])
                if digits.isdigit() and len(digits) >= 3:
                    if len(digits) == 6:
                        return f"{prefix} {digits[:3]}-{digits[3:]}"
                    return f"{prefix} {digits}"
            elif len(candidate) >= 4:
                return candidate
    return None

def extract_vin_with_metadata(text: str) -> Dict[str, Any]:
    """Extrae y decodifica el VIN de 17 caracteres."""
    if not text:
        return {"vin": None, "vin_year": None, "origin_country": None}
    
    context_match = re.search(
        r"(?:CHASIS|CHASSIS|VIN|NIV|SERIE|CUADRO)[\s:\.#-]*([A-HJ-NPR-Z0-9]{17})",
        text,
        re.IGNORECASE
    )
    vin = None
    if context_match:
        cand = context_match.group(1).upper()
        if "I" not in cand and "O" not in cand and "Q" not in cand:
            vin = cand

    if not vin:
        for match in VIN_REGEX.finditer(text):
            cand = match.group(1).upper()
            if "I" not in cand and "O" not in cand and "Q" not in cand:
                vin = cand
                break

    vin_year = None
    origin_country = None
    if vin and len(vin) == 17:
        year_char = vin[9]
        vin_year = VIN_YEAR_CODES.get(year_char)
        # Primer carácter: País de Origen
        first_char = vin[0]
        if first_char in ['1', '4', '5']: origin_country = "Estados Unidos"
        elif first_char in ['2']: origin_country = "Canadá"
        elif first_char in ['3']: origin_country = "México"
        elif first_char in ['J']: origin_country = "Japón"
        elif first_char in ['K']: origin_country = "Corea del Sur"
        elif first_char in ['L']: origin_country = "China"
        elif first_char in ['M']: origin_country = "India / Tailandia"
        elif first_char in ['8', '9']: origin_country = "Brasil / Argentina"

    return {"vin": vin, "vin_year": vin_year, "origin_country": origin_country}

def extract_engine_number(text: str) -> Optional[str]:
    """Extrae el número de motor grabado."""
    match = re.search(
        r"(?:MOTOR|ENGINE|NO\.?\s*MOTOR|NUMERO\s*MOTOR)[\s:\.#-]*([A-Z0-9]{4,16})",
        text,
        re.IGNORECASE
    )
    if match:
        cand = match.group(1).upper().strip()
        # Evitar capturar la palabra DIESEL o GASOLINA
        if cand not in ["DIESEL", "GASOLINA", "GASOIL", "CHASIS", "SERIE"]:
            return cand
    return None

def extract_nicaragua_cedula(text: str) -> Optional[str]:
    """Extrae cédula de identidad de Nicaragua."""
    match = NICARAGUA_CEDULA_REGEX.search(text)
    if match:
        raw = match.group(1).upper().replace(" ", "").replace("_", "-")
        # Formatear a 001-XXXXXX-XXXXA
        parts = raw.split("-")
        if len(parts) == 3:
            return f"{parts[0]}-{parts[1]}-{parts[2]}"
        digits = re.sub(r'[^0-9A-Z]', '', raw)
        if len(digits) == 14:
            return f"{digits[:3]}-{digits[3:9]}-{digits[9:]}"
    return None

def extract_brand_and_model(text: str) -> Dict[str, Optional[str]]:
    upper_text = text.upper()
    found_brand = None
    for b in KNOWN_BRANDS:
        if re.search(rf"\b{re.escape(b)}\b", upper_text):
            found_brand = b
            break

    found_model = None
    for m in KNOWN_MODELS:
        if re.search(rf"\b{re.escape(m)}\b", upper_text):
            found_model = m
            break

    return {"brand": found_brand, "model": found_model}

def extract_body_type(text: str) -> str:
    upper = text.upper()
    if "DOBLE CABINA" in upper or "DOUBLE CAB" in upper: return "camioneta_doble_cabina"
    if "CABINA Y MEDIA" in upper: return "camioneta_cabina_media"
    if "1 CABINA" in upper or "UNA CABINA" in upper or "CABINA SENCILLA" in upper: return "camioneta_1_cabina"
    if "SEDAN" in upper or "SEDÁN" in upper or "AUTOMOVIL" in upper or "AUTOMÓVIL" in upper: return "sedan"
    if "SUV" in upper or "RURAL" in upper or "TODO TERRENO" in upper or "STATION WAGON" in upper: return "suv"
    if "MICROBUS" in upper or "MICROBÚS" in upper or "MINIBUS" in upper: return "microbus_pasajeros"
    if "CAMION" in upper or "CAMIÓN" in upper or "FURGON" in upper: return "camion_carga_furgon"
    if "CABEZAL" in upper or "TRACTO" in upper: return "cabezal"
    return "sedan"

def parse_circulation_card_text(raw_text: str) -> Dict[str, Any]:
    """
    Parser robusto con validación cruzada para tarjetas de circulación de Nicaragua.
    """
    cleaned = clean_ocr_text(raw_text)
    plate = extract_nicaragua_plate(cleaned)
    vin_data = extract_vin_with_metadata(cleaned)
    engine = extract_engine_number(cleaned)
    cedula = extract_nicaragua_cedula(cleaned)
    brand_model = extract_brand_and_model(cleaned)
    body_type = extract_body_type(cleaned)

    # Detección de Año
    year = None
    context_year = re.search(r"(?:AÑO|A\.\s*FAB|MODELO|YEAR|AÑO\s*MODELO)[\s:\.#-]*\b(19[89]\d|20[0-3]\d)\b", cleaned, re.IGNORECASE)
    if context_year:
        year = int(context_year.group(1))
    elif vin_data["vin_year"]:
        year = vin_data["vin_year"]
    else:
        years = YEAR_REGEX.findall(cleaned)
        if years:
            year = int(years[0])

    # Detección de Color
    color = "No especificado"
    for canonical, aliases in COLOR_MAP.items():
        for alias in aliases:
            if re.search(rf"\b{re.escape(alias)}\b", cleaned.upper()):
                color = canonical
                break
        if color != "No especificado":
            break

    # Detección de Combustible
    fuel = "Gasolina"
    if "DIESEL" in cleaned.upper() or "GASOIL" in cleaned.upper() or "D-MAX" in cleaned.upper() or "HILUX" in cleaned.upper():
        fuel = "Diésel"
    elif "HIBRIDO" in cleaned.upper() or "HÍBRIDO" in cleaned.upper():
        fuel = "Híbrido"
    elif "ELECTRICO" in cleaned.upper() or "ELÉCTRICO" in cleaned.upper():
        fuel = "Eléctrico"

    # Score de Confianza
    confidence = 0
    if plate: confidence += 30
    if vin_data["vin"]: confidence += 30
    if engine: confidence += 10
    if brand_model["brand"]: confidence += 15
    if brand_model["model"]: confidence += 15

    return {
        "placa": plate,
        "vin_chasis": vin_data["vin"],
        "vin_year": vin_data["vin_year"],
        "origin_country": vin_data["origin_country"],
        "numero_motor": engine,
        "marca": brand_model["brand"],
        "modelo": brand_model["model"],
        "anio": year,
        "color": color,
        "tipo_carroceria": body_type,
        "tipo_combustible": fuel,
        "propietario_cedula": cedula,
        "confidence_score": min(confidence, 100),
        "raw_snippet": cleaned[:300] if cleaned else "",
    }
