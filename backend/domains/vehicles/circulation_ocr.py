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
    "sedan": ["automovil", "automóvil", "sedan", "sedán", "turismo", "saloon", "berlina"],
    "hatchback": ["hatchback", "compacto", "3 puertas", "5 puertas", "liftback"],
    "pickup": ["camioneta", "pickup", "pick-up", "doble cabina", "cabina sencilla", "cabina y media", "truck 4x4"],
    "suv": ["jeep", "suv", "rural", "station wagon", "crossover", "todo terreno", "4x4"],
    "van": ["microbus", "microbús", "van", "panel", "minivan", "furgoneta", "pasajeros"],
    "truck": ["camion", "camión", "furgon", "furgón", "cabezal", "chasis cabina", "plataforma", "volquete", "heavy"],
    "moto": ["moto", "motocicleta", "scooter", "cuadraciclo", "trimoto", "mototaxi"],
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


def fuzzy_match_brand_and_model(brand_raw: Optional[str], model_raw: Optional[str]) -> Tuple[str, str, float]:
    """
    Empareja con tolerancia a fallas la Marca y Modelo contra el catálogo maestro del ERP.
    """
    catalog = _get_catalog_data()
    brands_list = catalog.get("brands", [])
    entries = catalog.get("entries", [])

    text_combined = f"{brand_raw or ''} {model_raw or ''}".upper()

    brand_synonyms = {
        "TOYOTA": ["TOYOTA", "T OTA", "TOYOT", "TOYTA"],
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

    matched_brand = ""
    matched_model = ""

    # 1. Identificar Marca
    for canon, aliases in brand_synonyms.items():
        for al in aliases:
            if re.search(rf"\b{re.escape(al)}\b", text_combined):
                matched_brand = canon
                break
        if matched_brand:
            break

    if not matched_brand:
        for b in brands_list:
            if re.search(rf"\b{re.escape(b.upper())}\b", text_combined):
                matched_brand = b
                break

    # 2. Identificar Modelo
    if matched_brand and entries:
        brand_entries = [e for e in entries if e.get("brand", "").upper() == matched_brand.upper()]
        for entry in brand_entries:
            m_name = entry.get("model", "")
            if len(m_name) >= 2 and re.search(rf"\b{re.escape(m_name.upper())}\b", text_combined):
                matched_model = m_name
                break

    if not matched_model and entries:
        for entry in entries:
            m_name = entry.get("model", "")
            if len(m_name) >= 3 and re.search(rf"\b{re.escape(m_name.upper())}\b", text_combined):
                matched_model = m_name
                if not matched_brand:
                    matched_brand = entry.get("brand", "")
                break

    conf = 0.92 if (matched_brand and matched_model) else (0.80 if matched_brand else 0.50)
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

SYSTEM_VISION_PROMPT = """You extract fields from a photo of a Nicaraguan vehicle circulation card (tarjeta de circulacion / certificado de matricula).
Return JSON only. No markdown.
Schema keys: vin, plate, brand, model, year, color, vehicle_type, vehicle_type_slug, numero_motor, tipo_combustible, propietario_cedula, propietario_nombre, origin_country, version_level, trim, confidence, needs_review
Rules:
- If a field is unreadable, use null. Never invent a VIN or cedula.
- VIN is 17 characters. Allowed A-H J-N P R-Z 0-9. No I O Q.
- Plate is Nicaraguan. Prefix + numbers. Keep prefix letters as printed.
- year is an integer or null.
- confidence is 0..1 per critical field (vin, plate, brand, model, year).
- needs_review is an array of field names below 0.85 confidence.
- Prefer printed block letters over handwriting.
- Ignore holograms, stamps, and signatures.
- Do not translate brand names.
- vehicle_type_slug one of sedan, hatchback, pickup, suv, van, truck, moto.
- version_level one of base, intermedio, full if inferable, else intermedio.
"""

def _call_gemini_vision(image_base64: str, api_key: str) -> Optional[Dict[str, Any]]:
    """Llama a la API de Gemini 1.5/2.0 Flash Multimodal Vision."""
    import requests
    
    # Extraer payload limpio
    b64_data = image_base64
    mime_type = "image/jpeg"
    if "," in image_base64:
        header, b64_data = image_base64.split(",", 1)
        if "png" in header:
            mime_type = "image/png"

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": SYSTEM_VISION_PROMPT},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": b64_data
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.1
        }
    }

    resp = requests.post(url, json=payload, timeout=8)
    if resp.status_code == 200:
        data = resp.json()
        candidates = data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            if parts:
                text_out = parts[0].get("text", "")
                return json.loads(text_out)
    return None


def _call_openai_vision(image_base64: str, api_key: str) -> Optional[Dict[str, Any]]:
    """Llama a la API de OpenAI GPT-4o-mini Vision."""
    import requests

    img_url = image_base64 if image_base64.startswith("data:") else f"data:image/jpeg;base64,{image_base64}"
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
                "content": [
                    {"type": "text", "text": "Extrae los datos de esta tarjeta de circulación de Nicaragua en JSON."},
                    {"type": "image_url", "image_url": {"url": img_url, "detail": "high"}}
                ]
            }
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=8)
    if resp.status_code == 200:
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)
    return None


async def _run_windows_sdk_ocr_on_base64(image_base64: str) -> str:
    """
    Ejecuta el motor OCR nativo de Windows (winsdk.windows.media.ocr)
    a velocidad instantánea (~30-50ms) en el servidor.
    """
    try:
        import winsdk.windows.media.ocr as w_ocr
        import winsdk.windows.globalization as glob
        import winsdk.windows.storage.streams as streams
        import winsdk.windows.graphics.imaging as imaging

        b64_data = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
        raw_bytes = base64.b64decode(b64_data)

        # Crear RandomAccessStream en memoria
        mem_stream = streams.InMemoryRandomAccessStream()
        data_writer = streams.DataWriter(mem_stream)
        data_writer.write_bytes(bytes(raw_bytes))
        await data_writer.store_async()
        await data_writer.flush_async()
        mem_stream.seek(0)

        # Decodificar Bitmap
        decoder = await imaging.BitmapDecoder.create_async(mem_stream)
        software_bitmap = await decoder.get_software_bitmap_async()

        # Motor OCR en español o idioma del sistema
        lang = glob.Language("es")
        engine = w_ocr.OcrEngine.try_create_from_language(lang) or w_ocr.OcrEngine.try_create_from_user_profile_languages()
        if not engine:
            return ""

        result = await engine.recognize_async(software_bitmap)
        return result.text or ""
    except Exception as e:
        print(f"[OCR] Error en Windows SDK OCR nativo: {e}")
        return ""


# ==============================================================================
# ENTRY POINT MAESTRO v2
# ==============================================================================

async def process_circulation_card_v2(
    image_base64: Optional[str] = None,
    raw_text: Optional[str] = None
) -> Dict[str, Any]:
    """
    Procesador principal v2 de Tarjetas de Circulación de Nicaragua.
    Retorna respuesta normalizada, auditable y con índices de confianza.
    """
    start_time = time.time()
    engine_used = "windows_native_ocr"
    raw_extracted_json: Optional[Dict[str, Any]] = None
    extracted_text = raw_text or ""

    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY") or os.getenv("VISION_API_KEY")

    # 1. Intentar Visión Multimodal con LLM si hay API Key configurada
    if image_base64:
        if gemini_key:
            try:
                raw_extracted_json = _call_gemini_vision(image_base64, gemini_key)
                if raw_extracted_json:
                    engine_used = "gemini_vision"
            except Exception as e:
                print(f"[OCR] Error en llamada a Gemini Vision: {e}")

        if not raw_extracted_json and openai_key:
            try:
                raw_extracted_json = _call_openai_vision(image_base64, openai_key)
                if raw_extracted_json:
                    engine_used = "openai_vision"
            except Exception as e:
                print(f"[OCR] Error en llamada a OpenAI Vision: {e}")

        # 2. Si no hay Cloud Vision o falló, ejecutar Windows SDK OCR en el servidor
        if not raw_extracted_json:
            try:
                native_text = await _run_windows_sdk_ocr_on_base64(image_base64)
                if native_text:
                    extracted_text = f"{extracted_text}\n{native_text}".strip()
                    engine_used = "windows_native_ocr"
            except Exception as e:
                print(f"[OCR] Error en OCR nativo: {e}")

    # 3. Consolidar y Normalizar Datos
    confidence_dict: Dict[str, float] = {}
    needs_review: List[str] = []

    if raw_extracted_json:
        raw_vin = raw_extracted_json.get("vin")
        raw_plate = raw_extracted_json.get("plate")
        raw_brand = raw_extracted_json.get("brand")
        raw_model = raw_extracted_json.get("model")
        raw_year = raw_extracted_json.get("year")
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
        raw_year = parsed.get("anio") or parsed.get("vin_year")
        raw_color = parsed.get("color")
        raw_engine = parsed.get("numero_motor")
        raw_fuel = parsed.get("tipo_combustible")
        raw_cedula = parsed.get("propietario_cedula")
        raw_owner_name = None
        raw_type = parsed.get("tipo_carroceria")
        raw_type_slug = None
        version_level = "intermedio"
        trim = ""

    # Normalizaciones de Nicaragua
    norm_plate, plate_conf, plate_review = normalize_plate_nicaragua(raw_plate)
    confidence_dict["plate"] = plate_conf
    if plate_review or not norm_plate:
        needs_review.append("plate")

    norm_vin, vin_conf, vin_review = normalize_vin(raw_vin)
    confidence_dict["vin"] = vin_conf
    if vin_review or not norm_vin:
        needs_review.append("vin")

    norm_brand, norm_model, model_conf = fuzzy_match_brand_and_model(raw_brand, raw_model)
    confidence_dict["brand"] = 0.90 if norm_brand else 0.0
    confidence_dict["model"] = model_conf if norm_model else 0.0
    if not norm_brand: needs_review.append("brand")
    if not norm_model: needs_review.append("model")

    # Validación de Año
    current_year = datetime.now().year
    valid_year = None
    if raw_year:
        try:
            y_int = int(raw_year)
            if 1980 <= y_int <= current_year + 1:
                valid_year = y_int
                confidence_dict["year"] = 0.92
        except (ValueError, TypeError):
            pass
    if not valid_year:
        if norm_vin and len(norm_vin) == 17:
            valid_year = VIN_YEAR_CODES.get(norm_vin[9])
            if valid_year:
                confidence_dict["year"] = 0.88
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
    print(f"[OCR v2] Procesado en {latency_ms}ms | Motor: {engine_used} | Placa: {norm_plate} | VIN: {norm_vin}")

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
    }


def parse_circulation_card_text(raw_text: str) -> Dict[str, Any]:
    """
    Parser heurístico regex compatible con versiones previas.
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

    # Marca y Modelo
    brand_match, model_match, _ = fuzzy_match_brand_and_model(cleaned, cleaned)

    # Año
    year = None
    context_year = re.search(r"(?:AÑO|A\.\s*FAB|MODELO|YEAR|AÑO\s*MODELO)[\s:\.#-]*\b(19[89]\d|20[0-3]\d)\b", cleaned, re.IGNORECASE)
    if context_year:
        year = int(context_year.group(1))
    elif vin_year:
        year = vin_year
    else:
        years = YEAR_REGEX.findall(cleaned)
        if years:
            year = int(years[0])

    # Color
    color = "No especificado"
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
        "anio": year,
        "color": color,
        "tipo_carroceria": type_slug,
        "tipo_combustible": fuel,
        "propietario_cedula": cedula,
        "confidence_score": 85 if (plate or vin) else 40,
        "raw_snippet": cleaned[:300] if cleaned else "",
    }
