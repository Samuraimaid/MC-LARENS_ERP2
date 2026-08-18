"""
Circulation Card (Tarjeta de Circulación) OCR and Text Parser.
Extracts VIN (Chassis), License Plate, Year, Brand, Model, and Vehicle Color
from raw text extracted via OCR or direct input.
"""

import re
from typing import Any, Dict, List, Optional

# Standard 17-char VIN regex (excluding letters I, O, Q)
VIN_REGEX = re.compile(r"\b([A-HJ-NPR-Z0-9]{17})\b", re.IGNORECASE)

# Latin American & Standard License Plate Patterns (e.g., M 324-912, M 123456, RJ 1234, LE 12345, etc.)
PLATE_PATTERNS = [
    re.compile(r"(?:PLACA|MATRICULA|MATR[IÍ]CULA|NO\.?\s*PLACA|REGISTRO)[\s:\.#-]*([A-Z]{1,3}[-\s]?\d{3}[-\s]?\d{3})", re.IGNORECASE),
    re.compile(r"(?:PLACA|MATRICULA|MATR[IÍ]CULA|NO\.?\s*PLACA|REGISTRO)[\s:\.#-]*([A-Z]{1,3}[-\s]?\d{3,6})", re.IGNORECASE),
    re.compile(r"\b([A-Z]{1,2}[-\s]?\d{3}[-\s]?\d{3})\b", re.IGNORECASE),
    re.compile(r"\b([A-Z]{1,3}[-\s]?\d{4,6})\b", re.IGNORECASE),
    re.compile(r"\b(\d{3,6}[-\s]?[A-Z]{1,3})\b", re.IGNORECASE),
]

# Color keywords mapping
COLOR_KEYWORDS = {
    "BLANCO": ["BLANCO", "WHITE", "BLANCA"],
    "NEGRO": ["NEGRO", "BLACK", "NEGRA"],
    "PLATA": ["PLATA", "SILVER", "PLATEADO", "PLATEADA"],
    "GRIS": ["GRIS", "GRAY", "GREY"],
    "AZUL": ["AZUL", "BLUE", "NAVY"],
    "ROJO": ["ROJO", "RED", "ROJA"],
    "VINO": ["VINO", "BURGUNDY", "BURDEOS", "TINTO"],
    "VERDE": ["VERDE", "GREEN"],
    "AMARILLO": ["AMARILLO", "YELLOW", "AMARILLA"],
    "DORADO": ["DORADO", "GOLD", "DORADA", "ORO"],
    "BEIGE": ["BEIGE", "BEIG", "ARENA", "CREMA"],
    "CAFÉ": ["CAFE", "CAFÉ", "BROWN", "MARRON", "MARRÓN"],
    "NARANJA": ["NARANJA", "ORANGE", "ANARANJADO"],
    "CHAMPAGNE": ["CHAMPAGNE", "CHAMPAN"],
    "BRONCE": ["BRONCE", "BRONZE"],
}

# Recognized Brands
KNOWN_BRANDS = [
    "TOYOTA", "NISSAN", "HYUNDAI", "KIA", "CHEVROLET", "FORD", "MITSUBISHI",
    "SUZUKI", "HONDA", "MAZDA", "ISUZU", "VOLKSWAGEN", "BMW", "MERCEDES-BENZ",
    "MERCEDES", "AUDI", "JEEP", "SUBARU", "RAM", "GMC", "PEUGEOT", "RENAULT",
    "FIAT", "BYD", "GEELY", "CHERY", "GREAT WALL", "JAC", "CHANGAN", "HINO",
    "MACK", "FREIGHTLINER", "INTERNATIONAL", "LAND ROVER", "LEXUS", "VOLVO",
    "DODGE", "CHRYSLER", "CADILLAC", "LINCOLN", "PORSCHE", "MINI"
]


def clean_ocr_text(raw_text: str) -> str:
    if not raw_text:
        return ""
    # Normalize common OCR character confusions in automotive context
    return raw_text.replace("\r", "\n")


def extract_vin_from_text(text: str) -> Optional[str]:
    """Finds a valid 17-character VIN in OCR text."""
    if not text:
        return None
    
    # 1. Contextual match near 'CHASIS' or 'VIN'
    context_match = re.search(
        r"(?:CHASIS|CHASSIS|VIN|NIV|SERIE|CUADRO|MOTOR/CHASIS)[\s:\.#-]*([A-HJ-NPR-Z0-9]{17})",
        text,
        re.IGNORECASE
    )
    if context_match:
        vin = context_match.group(1).upper()
        if "I" not in vin and "O" not in vin and "Q" not in vin:
            return vin

    # 2. General 17-character alphanumeric match
    for match in VIN_REGEX.finditer(text):
        candidate = match.group(1).upper()
        if "I" not in candidate and "O" not in candidate and "Q" not in candidate:
            return candidate

    return None


def extract_plate_from_text(text: str) -> Optional[str]:
    """Extracts vehicle license plate from OCR text."""
    if not text:
        return None

    for pattern in PLATE_PATTERNS:
        match = pattern.search(text)
        if match:
            plate = match.group(1).strip().upper()
            # Avoid picking up the VIN or short strings
            if len(plate) >= 4 and len(plate) <= 10 and not re.match(r"^[A-Z]{4,}$", plate):
                return plate

    return None


def extract_color_from_text(text: str) -> Optional[str]:
    """Identifies vehicle color from text."""
    if not text:
        return None
    upper_text = text.upper()
    for canonical_color, aliases in COLOR_KEYWORDS.items():
        for alias in aliases:
            # Word boundary check
            if re.search(rf"\b{re.escape(alias)}\b", upper_text):
                return canonical_color
    return None


def extract_year_from_text(text: str) -> Optional[int]:
    """Extracts 4-digit year from OCR text."""
    if not text:
        return None
    # Look for year near 'AÑO' or 'MODELO'
    context_year = re.search(
        r"(?:AÑO|A\.\s*FAB|MODELO|YEAR|AÑO\s*MODELO)[\s:\.#-]*\b(19[89]\d|20[0-3]\d)\b",
        text,
        re.IGNORECASE
    )
    if context_year:
        return int(context_year.group(1))

    # General year search
    years = re.findall(r"\b(19[89]\d|20[0-3]\d)\b", text)
    if years:
        return int(years[0])
    return None


def extract_brand_from_text(text: str) -> Optional[str]:
    """Extracts known automotive brand."""
    if not text:
        return None
    upper_text = text.upper()
    for brand in KNOWN_BRANDS:
        if re.search(rf"\b{re.escape(brand)}\b", upper_text):
            return brand
    return None


def parse_circulation_card_text(raw_text: str) -> Dict[str, Any]:
    """
    Parses OCR text of a vehicle registration card and returns structured fields.
    """
    cleaned = clean_ocr_text(raw_text)
    vin = extract_vin_from_text(cleaned)
    plate = extract_plate_from_text(cleaned)
    color = extract_color_from_text(cleaned)
    year = extract_year_from_text(cleaned)
    brand = extract_brand_from_text(cleaned)

    confidence = 0
    if vin: confidence += 40
    if plate: confidence += 25
    if brand: confidence += 15
    if year: confidence += 10
    if color: confidence += 10

    return {
        "vin": vin,
        "plate": plate,
        "color": color or "No especificado",
        "year": year,
        "brand": brand,
        "confidence_score": confidence,
        "raw_text_snippet": cleaned[:300] if cleaned else "",
    }
