import re

VIN_CHARSET = set("0123456789ABCDEFGHJKLMNPRSTUVWXYZ")

def extract_vin_from_text(text: str):
    # 1. Look after CHASIS / VIN keywords
    m = re.search(r"(?:CHASIS|VIN|NO\.?\s*CHASIS|NUMERO\s*CHASIS|FRAME)[\s:\.#-]*([A-Z0-9IOQ]{11,20})", text, re.IGNORECASE)
    candidates = []
    if m:
        candidates.append(m.group(1))
    
    # 2. Extract all alphanumeric tokens of length 15-20
    tokens = re.findall(r"\b[A-Z0-9IOQ]{15,20}\b", text, re.IGNORECASE)
    candidates.extend(tokens)
    
    for cand in candidates:
        cand_clean = cand.upper()
        # Common OCR fixes for 17-char VIN
        fixed = cand_clean.replace('I', '1').replace('O', '0').replace('Q', '0')
        if len(fixed) == 17 and all(c in VIN_CHARSET for c in fixed):
            return fixed
        # If candidate is > 17, check any 17-char substring
        if len(fixed) > 17:
            for i in range(len(fixed) - 16):
                sub = fixed[i:i+17]
                if all(c in VIN_CHARSET for c in sub):
                    return sub

    return None

sample_texts = [
    "República de Nicaragua POLICIA NACIONAL CIRCULACION VEHICULAR Placa M 145835 CAMIONETA TOYOTA HILUX color BLANCO Motor 207854925 Chasis MROFR22G800550800 VIN 0009",
    "Nicaragua CIRCULACION VEHICULAR Placa LE 29646 Color ROJO Motor G4FDCHS30772 Chasis KNADM4A3XD6124749 VIN 0008",
    "POLICIA NACIONAL CIRCULACION VEHICULAR Placa CZ 13206 AUTOMOVIL TOYOTA YARIS SEDAN Motor 2NZ5032362 Chasis JTDBW923X01121180 VIN 0015",
    "CIRCULACION VEHICULAR Placa M 243616 BMW X3 28I Color BLANCO Motor A9821078 Chasis WBAWX9107G0K05752 VIN 0009",
]

for s in sample_texts:
    v = extract_vin_from_text(s)
    print(f"Text: {s[:50]}... => Extracted VIN: {v}")
