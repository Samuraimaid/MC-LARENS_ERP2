import re
import json
from pathlib import Path

VIN_CHARSET = set("0123456789ABCDEFGHJKLMNPRSTUVWXYZ")

NICARAGUA_DEPT_PREFIXES = [
    "RAAN", "RAAS", "LE", "CH", "MY", "GR", "CZ", "MT", "BO", "CT", "CO",
    "RI", "NS", "ES", "MZ", "MD", "JI", "RS", "AN", "AS", "RN", "TM",
    "ZC", "PN", "EN", "CD", "MI", "OI", "CC", "PJ", "ME", "M",
]
DEPT_PREFIX_REGEX = r"(?:" + "|".join(sorted(NICARAGUA_DEPT_PREFIXES, key=len, reverse=True)) + r")"

COLOR_MAP = {
    "BLANCO": ["BLANCO", "WHITE", "BLANCA", "PERLA", "NCO"],
    "NEGRO": ["NEGRO", "BLACK", "NEGRA", "AZABACHE"],
    "ROJO": ["ROJO", "RED", "ROJA", "GRANATE", "VINO", "ROJ"],
    "PLATA": ["PLATA", "SILVER", "PLATEADO", "PLATEADA"],
    "GRIS": ["GRIS", "GRAY", "GREY", "PLOMO", "GRIS OSCURO"],
    "AZUL": ["AZUL", "BLUE", "NAVY", "AZUL MARINO", "CELESTE"],
}

VEHICLE_TYPE_MAP = {
    "pickup": ["camioneta", "pickup", "pick-up", "doble cabina", "cabina sencilla", "yamioneta"],
    "suv": ["jeep", "suv", "rural", "station wagon", "crossover", "todo terreno", "4x4"],
    "sedan": ["automovil", "automóvil", "sedan", "sedán", "turismo", "ajtomovil"],
    "hatchback": ["hatchback", "compacto"],
    "van": ["microbus", "microbús", "van", "panel"],
    "truck": ["camion", "camión", "furgon", "furgón", "cabezal"],
    "moto": ["moto", "motocicleta", "scooter"],
}

def extract_plate(text: str):
    m = re.search(rf"\b({DEPT_PREFIX_REGEX})[\s\-_]?(\d{{1,3}})[\s\-_]?(\d{{2,4}})\b", text, re.IGNORECASE)
    if m:
        pref = m.group(1).upper()
        p1 = m.group(2)
        p2 = m.group(3)
        digits = f"{p1}{p2}"
        if len(digits) == 6:
            return f"{pref} {digits[:3]}-{digits[3:]}"
        return f"{pref} {digits}"
    m2 = re.search(rf"\b({DEPT_PREFIX_REGEX})[\s\-_]?(\d{{3,6}})\b", text, re.IGNORECASE)
    if m2:
        pref = m2.group(1).upper()
        digits = m2.group(2)
        if len(digits) == 6:
            return f"{pref} {digits[:3]}-{digits[3:]}"
        return f"{pref} {digits}"
    return None

def extract_vin(text: str):
    candidates = []
    m = re.search(r"(?:CHASIS|VIN|NO\.?\s*CHASIS|NUMERO\s*CHASIS|FRAME)[\s:\.#-]*([A-Z0-9IOQ]{11,25})", text, re.IGNORECASE)
    if m:
        candidates.append(m.group(1))
    tokens = re.findall(r"\b[A-Z0-9IOQ]{15,22}\b", text, re.IGNORECASE)
    candidates.extend(tokens)
    for cand in candidates:
        fixed = cand.upper().replace('I', '1').replace('O', '0').replace('Q', '0')
        if len(fixed) == 17 and all(c in VIN_CHARSET for c in fixed):
            return fixed
        if len(fixed) > 17:
            for i in range(len(fixed) - 16):
                sub = fixed[i:i+17]
                if all(c in VIN_CHARSET for c in sub):
                    return sub
    return None

def extract_engine(text: str):
    m = re.search(r"(?:MOTOR|ENGINE|NO\.?\s*MOTOR|NUMERO\s*MOTOR)[\s:\.#-]*([A-Z0-9]{5,18})", text, re.IGNORECASE)
    if m:
        c = m.group(1).upper().strip()
        if c not in ["DIESEL", "GASOLINA", "GASOIL", "CHASIS", "SERIE"]:
            return c
    return None

def extract_color(text: str):
    text_up = text.upper()
    for col, aliases in COLOR_MAP.items():
        for a in aliases:
            if re.search(rf"\b{re.escape(a)}\b", text_up) or f"COLOR {a}" in text_up or f"COLOR.{a}" in text_up or f"COLOR@{a}" in text_up:
                return col.capitalize()
    return "No especificado"

def extract_type(text: str, model: str = ""):
    combined = f"{text} {model}".lower()
    for stype, kws in VEHICLE_TYPE_MAP.items():
        for kw in kws:
            if kw in combined:
                return stype
    return "sedan"

def test_samples():
    samples = [
        ("images.jpg", "República de Nicaragua POLICIA NACIONAL CIRCULACION VEHICULAR Placa M 145835 YAMIONETA T OTA HILUX color BLANCO Motor 207854925 Chasis MROFR22G800550800 VIN 0009 Emisión 22 09 2017"),
        ("images (1).jpg", "Nicaragua CIRCULACION VEHICULAR Placa LE 29646 Color ROJO Motor G4FDCHS30772 Chasis KNADM4A3XD6124749 VIN 0008"),
        ("images (4).jpg", "República de Nicaragua POLICIA NACIONAL CIRCULACION VEHICULAR Placa CZ 13206 AUTOMOVIL TOYOTA YARIS SEDAN Motor 2NZ5032362 Chasis JTDBW923X01121180 VIN 0015 Emisión 16 12 2016"),
        ("images (6).jpg", "Ministerio de Gobernación CIRCULACION VEHICULAR Placa M 243616 BMW X3 28I Color BLANCO Motor A9821078 Chasis WBAWX9107G0K05752 VIN 0009 14 1 2016"),
    ]
    
    for fn, s in samples:
        pl = extract_plate(s)
        vn = extract_vin(s)
        eng = extract_engine(s)
        col = extract_color(s)
        tp = extract_type(s)
        print(f"=== {fn} ===")
        print(f"  Placa:  {pl}")
        print(f"  VIN:    {vn}")
        print(f"  Motor:  {eng}")
        print(f"  Color:  {col}")
        print(f"  Tipo:   {tp}")
        print()

if __name__ == "__main__":
    test_samples()
