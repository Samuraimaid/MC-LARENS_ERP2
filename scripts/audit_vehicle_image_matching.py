import json
import re

with open('frontend/src/data/official_vehicle_catalog.json', 'r', encoding='utf-8') as f:
    official_catalog = json.load(f)['models']

BODY_DISTINGUISHING_TOKENS = {
    "doble": ["doble", "double", "crew"],
    "double": ["doble", "double", "crew"],
    "media": ["media", "extra", "king", "supercab", "club"],
    "extra": ["media", "extra", "king", "supercab", "club"],
    "king": ["media", "extra", "king", "supercab", "club"],
    "sencilla": ["sencilla", "single", "regular", "1 cabina", "una cabina"],
    "single": ["sencilla", "single", "regular", "1 cabina", "una cabina"],
    "sedan": ["sedan", "sedán"],
    "hatchback": ["hatchback", "hb"],
    "cross": ["cross"],
    "prado": ["prado"],
    "panel": ["panel", "carga", "furgon"],
    "techo": ["techo alto", "high roof"],
}

TRIM_AND_STOP_WORDS = set([
  "de", "del", "la", "el", "los", "las", "4x4", "4x2", "ano", "año", "presente", "present", "van", "pickup", "pick-up",
  "auto", "m/t", "a/t", "gasolina", "diesel", "hybrid", "hibrido", "híbrido", "electric", "electrico", "eléctrico",
  "turbo", "intercooler", "v6", "v8", "touring", "limited", "sport", "executive", "premium", "edition",
  "special", "custom", "standard", "classic", "plus", "pro", "active", "comfort", "elegance", "luxury", "line",
  "package", "pack", "ute", "truck", "car"
])

def find_matching_vehicle(vehicle):
    if not vehicle:
        return None
    brand = str(vehicle.get('brand') or '').lower().strip()
    model = str(vehicle.get('model') or vehicle.get('descriptor') or '').lower().strip()
    year = int(vehicle.get('year') or 0) or None

    normBrand = re.sub(r'[^a-z0-9]', '', brand)

    # Clean model text
    cleanedModel = re.sub(r'\[.*?\]|\(.*?\)', ' ', model)
    cleanedModel = re.sub(r'\b\d+\.\d+L?\b', ' ', cleanedModel, flags=re.IGNORECASE)

    rawTokens = [t.strip().lower() for t in re.split(r'[\s\-_/]+', cleanedModel)]
    primaryTokens = []
    secondaryTokens = []

    for t in rawTokens:
        if len(t) < 2:
            continue
        if t in TRIM_AND_STOP_WORDS:
            secondaryTokens.append(t)
        else:
            primaryTokens.append(t)

    vehicleCat = str(vehicle.get('vehicle_type_slug') or vehicle.get('body_type') or vehicle.get('category') or '').lower()

    if not official_catalog:
        return None

    brandOfficials = [b for b in official_catalog if normBrand == re.sub(r'[^a-z0-9]', '', str(b.get('brand_slug') or '').lower())]
    if not brandOfficials:
        return None

    bestOfficial = None
    bestOfficialScore = 0

    for b in brandOfficials:
        bModel = str(b.get('model_name') or '').lower()
        bModelTokens = set(re.split(r'[\s\-_/]+', bModel))
        bBaseSlug = str(b.get('model_slug') or '').lower()
        
        # 1. PURE MODEL NAME MATCHING
        modelMatchScore = 0
        hasDirectModelMatch = False

        for t in primaryTokens:
            if t == bModel or t in bModelTokens or t == bBaseSlug:
                modelMatchScore += 250
                hasDirectModelMatch = True
            elif f" {bModel} ".find(f" {t} ") >= 0 or f" {bBaseSlug} ".find(f" {t} ") >= 0:
                modelMatchScore += 200
                hasDirectModelMatch = True
            elif bModel.find(t) >= 0 or bBaseSlug.find(t) >= 0:
                modelMatchScore += 120
                hasDirectModelMatch = True

        for t in secondaryTokens:
            if t in bModelTokens or bModel.find(t) >= 0 or bBaseSlug.find(t) >= 0:
                modelMatchScore += 30

        # STRICT RULE: Must have at least one primary token match if primary tokens exist!
        if primaryTokens and not hasDirectModelMatch:
            continue

        # 2. BODY DISTINGUISHING TOKENS MATCHING
        bodyTokenScore = 0
        for token, synonyms in BODY_DISTINGUISHING_TOKENS.items():
            if any(syn in cleanedModel.lower() for syn in synonyms):
                if any(syn in bModel or syn in bBaseSlug for syn in synonyms):
                    bodyTokenScore += 120
                elif token in b.get('category', ''):
                    bodyTokenScore += 60

        # 3. CATEGORY / BODY TYPE MATCH BONUS
        categoryScore = 0
        if vehicleCat and b.get('category'):
            if vehicleCat == b.get('category'):
                categoryScore = 60
            elif vehicleCat in b.get('category') or b.get('category') in vehicleCat:
                categoryScore = 30

        # 4. YEAR MATCHING SCORE
        yearScore = 0
        if year and b.get('year_start'):
            y_start = b.get('year_start')
            y_end = b.get('year_end') or y_start
            if y_start <= year <= y_end:
                yearScore = 80
            elif abs(year - y_start) <= 2 or abs(year - y_end) <= 2:
                yearScore = 40
            elif abs(year - y_start) <= 5 or abs(year - y_end) <= 5:
                yearScore = 15

        totalScore = modelMatchScore + bodyTokenScore + categoryScore + yearScore
        if totalScore > bestOfficialScore:
            bestOfficialScore = totalScore
            bestOfficial = b

    return bestOfficial, bestOfficialScore

# Audit all major real-world ERP cases
audit_cases = [
    # TOYOTA CASES
    {"brand": "TOYOTA", "model": "HILUX", "year": 2021, "vehicle_type_slug": "camioneta_doble_cabina", "expected": "Hilux Doble Cabina"},
    {"brand": "TOYOTA", "model": "HILUX (2021)", "year": 2021, "vehicle_type_slug": "camioneta_doble_cabina", "expected": "Hilux Doble Cabina"},
    {"brand": "TOYOTA", "model": "HILUX (2021)", "year": 2021, "vehicle_type_slug": "suv", "expected": "Hilux"}, # Even if mistakenly labeled suv, must still pick Hilux!
    {"brand": "TOYOTA", "model": "HILUX CABINA Y MEDIA", "year": 2021, "vehicle_type_slug": "camioneta_cabina_media", "expected": "Hilux Cabina y Media"},
    {"brand": "TOYOTA", "model": "HILUX 1 CABINA", "year": 2021, "vehicle_type_slug": "camioneta_1_cabina", "expected": "Hilux Cabina Sencilla"},
    {"brand": "TOYOTA", "model": "COROLLA", "year": 2019, "vehicle_type_slug": "sedan", "expected": "Corolla"},
    {"brand": "TOYOTA", "model": "COROLLA (2019)", "year": 2019, "vehicle_type_slug": "suv", "expected": "Corolla"}, # Even if preset says suv, must pick Corolla!
    {"brand": "TOYOTA", "model": "COROLLA CROSS", "year": 2022, "vehicle_type_slug": "suv", "expected": "Corolla Cross"},
    {"brand": "TOYOTA", "model": "LAND CRUISER PRADO", "year": 2020, "vehicle_type_slug": "suv", "expected": "Prado"},
    {"brand": "TOYOTA", "model": "PRADO", "year": 2020, "vehicle_type_slug": "suv", "expected": "Prado"},
    {"brand": "TOYOTA", "model": "LAND CRUISER 200", "year": 2018, "vehicle_type_slug": "suv", "expected": "Land Cruiser 200"},
    {"brand": "TOYOTA", "model": "LAND CRUISER 300", "year": 2023, "vehicle_type_slug": "suv", "expected": "Land Cruiser 300"},
    {"brand": "TOYOTA", "model": "FORTUNER", "year": 2021, "vehicle_type_slug": "suv", "expected": "Fortuner"},
    {"brand": "TOYOTA", "model": "RAV4", "year": 2020, "vehicle_type_slug": "suv", "expected": "Rav4"},
    {"brand": "TOYOTA", "model": "YARIS SEDAN", "year": 2020, "vehicle_type_slug": "sedan", "expected": "Yaris Sedan"},
    {"brand": "TOYOTA", "model": "YARIS HATCHBACK", "year": 2020, "vehicle_type_slug": "hatchback", "expected": "Yaris Hatchback"},
    {"brand": "TOYOTA", "model": "HIACE", "year": 2018, "vehicle_type_slug": "microbus_pasajeros", "expected": "Hiace"},
    {"brand": "TOYOTA", "model": "RUSH", "year": 2022, "vehicle_type_slug": "suv", "expected": "Rush"},
    {"brand": "TOYOTA", "model": "RAIZE", "year": 2022, "vehicle_type_slug": "suv", "expected": "Raize"},
    {"brand": "TOYOTA", "model": "4RUNNER", "year": 2020, "vehicle_type_slug": "suv", "expected": "4runner"},

    # NISSAN CASES
    {"brand": "NISSAN", "model": "SENTRA", "year": 2020, "vehicle_type_slug": "sedan", "expected": "Sentra"},
    {"brand": "NISSAN", "model": "SENTRA (2020)", "year": 2020, "vehicle_type_slug": "sedan", "expected": "Sentra"},
    {"brand": "NISSAN", "model": "VERSA", "year": 2021, "vehicle_type_slug": "sedan", "expected": "Versa"},
    {"brand": "NISSAN", "model": "FRONTIER", "year": 2022, "vehicle_type_slug": "camioneta_doble_cabina", "expected": "Frontier Doble Cabina"},
    {"brand": "NISSAN", "model": "FRONTIER KING CAB", "year": 2021, "vehicle_type_slug": "camioneta_cabina_media", "expected": "Frontier King Cab"},
    {"brand": "NISSAN", "model": "FRONTIER SINGLE CAB", "year": 2021, "vehicle_type_slug": "camioneta_1_cabina", "expected": "Frontier Cabina Sencilla"},
    {"brand": "NISSAN", "model": "KICKS", "year": 2021, "vehicle_type_slug": "suv", "expected": "Kicks"},
    {"brand": "NISSAN", "model": "X-TRAIL", "year": 2022, "vehicle_type_slug": "suv", "expected": "Xtrail"},
    {"brand": "NISSAN", "model": "QASHQAI", "year": 2020, "vehicle_type_slug": "suv", "expected": "Qashqai"},
    {"brand": "NISSAN", "model": "PATHFINDER", "year": 2020, "vehicle_type_slug": "suv", "expected": "Pathfinder"},
    {"brand": "NISSAN", "model": "PATROL Y62", "year": 2020, "vehicle_type_slug": "suv", "expected": "Patrol Y62"},
    {"brand": "NISSAN", "model": "PATROL Y61", "year": 2012, "vehicle_type_slug": "suv", "expected": "Patrol Y61"},
    {"brand": "NISSAN", "model": "TERRA", "year": 2020, "vehicle_type_slug": "suv", "expected": "Terra"},
    {"brand": "NISSAN", "model": "URVAN NV350", "year": 2020, "vehicle_type_slug": "microbus_pasajeros", "expected": "Urvan"},
    {"brand": "NISSAN", "model": "MARCH", "year": 2019, "vehicle_type_slug": "hatchback", "expected": "March"},
    {"brand": "NISSAN", "model": "TIIDA SEDAN", "year": 2012, "vehicle_type_slug": "sedan", "expected": "Tiida Sedan"},
    {"brand": "NISSAN", "model": "TIIDA HATCHBACK", "year": 2012, "vehicle_type_slug": "hatchback", "expected": "Tiida Hatchback"},
    {"brand": "NISSAN", "model": "JUKE", "year": 2015, "vehicle_type_slug": "suv", "expected": "Juke"},
    {"brand": "NISSAN", "model": "MURANO", "year": 2018, "vehicle_type_slug": "suv", "expected": "Murano"},
    {"brand": "NISSAN", "model": "MAGNITE", "year": 2022, "vehicle_type_slug": "suv", "expected": "Magnite"},
    {"brand": "NISSAN", "model": "NV200", "year": 2018, "vehicle_type_slug": "microbus_carga", "expected": "Nv200"},
    {"brand": "NISSAN", "model": "CABSTAR", "year": 2015, "vehicle_type_slug": "camion_1_cabina", "expected": "Cabstar"},
]

print("=" * 80)
print(f"AUDITANDO {len(audit_cases)} CASOS DE VEHÍCULOS OFICIALES")
print("=" * 80)

passed = 0
failed = 0

for c in audit_cases:
    res = find_matching_vehicle(c)
    if not res:
        print(f"[FAIL] {c['brand']} {c['model']} ({c['year']}) -> NO MATCH (Expected: {c['expected']})")
        failed += 1
        continue
    
    match, score = res
    m_name = match.get('model_name', '')
    exp = c['expected'].lower()
    
    if exp in m_name.lower() or exp in match.get('lateral_image', '').lower():
        passed += 1
        print(f"[PASS] {c['brand']} {c['model']} ({c['year']}) -> {m_name} ({match.get('generation')}) | {match.get('lateral_image')}")
    else:
        failed += 1
        print(f"[FAIL] {c['brand']} {c['model']} ({c['year']}) -> MATCHED WRONG: {m_name} (Expected: {c['expected']})")

print("=" * 80)
print(f"RESULTADO: {passed} PASSED | {failed} FAILED ({passed/(passed+failed)*100:.1f}%)")
print("=" * 80)
