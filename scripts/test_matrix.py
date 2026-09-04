import json

# Simulating frontend JavaScript compatibility engine logic
def simulate_resolve_vehicle_category(vehicle):
    direct_slug = str(
        vehicle.get("vehicle_type_slug") or
        vehicle.get("type") or
        vehicle.get("body_type") or
        vehicle.get("category") or
        ""
    ).lower().strip()

    category_aliases = {
        "hatchback": "hatchback",
        "compacto": "hatchback",
        "hb": "hatchback",
        "pickup": "camioneta_doble_cabina",
        "pick-up": "camioneta_doble_cabina",
        "camioneta-doble-cabina": "camioneta_doble_cabina",
        "camioneta_doble_cabina": "camioneta_doble_cabina",
        "st/wagon": "suv",
        "station wagon": "station_wagon",
        "todo terreno": "suv",
        "jeep": "suv",
        "van": "microbus_pasajeros",
        "microbus": "microbus_pasajeros",
        "camion": "camion_1_cabina",
        "truck": "camion_1_cabina",
        "moto": "moto",
    }

    if direct_slug in ["sedan", "hatchback", "suv", "camioneta_doble_cabina", "camioneta_cabina_media", "camioneta_1_cabina", "station_wagon", "microbus_pasajeros", "microbus_techo_alto", "microbus_carga", "camion_1_cabina", "camion_2_cabinas", "camion_carga_furgon", "moto"]:
        return direct_slug
    if direct_slug in category_aliases:
        return category_aliases[direct_slug]

    brand = str(vehicle.get("brand") or "").lower()
    model = str(vehicle.get("model") or "").lower()
    text = f"{direct_slug} {brand} {model}"

    if any(k in text for k in ["camion", "cabezal", "npr", "nqr", "dyna", "canter", "dutro", "k2700"]):
        return "camion_1_cabina"
    if any(k in text for k in ["hilux", "frontier", "d-max", "dmax", "l200", "ranger", "amarok", "tacoma", "tundra", "f-150", "f150", "silverado", "colorado", "poer", "wingle", "pickup"]):
        return "camioneta_doble_cabina"
    if any(k in text for k in ["hiace", "urvan", "nv350", "h-1", "starex", "transit", "sprinter", "microbus", "van"]):
        return "microbus_pasajeros"
    if any(k in text for k in ["x1", "x2", "x3", "x4", "x5", "x6", "x7", "q3", "q5", "q7", "glc", "gle", "gls", "cr-v", "crv", "hr-v", "rav4", "tucson", "santa fe", "sportage", "sorento", "prado", "4runner", "fortuner", "patrol", "pathfinder", "montero", "outlander", "duster", "kicks", "tracker", "explorer", "escape", "edge", "suv"]):
        return "suv"
    if any(k in text for k in ["picanto", "spark", "march", "swift", "i10", "grand i10", "golf", "polo", "fit", "hatchback"]):
        return "hatchback"
    if any(k in text for k in ["moto", "motocicleta", "atv", "pulsar"]):
        return "moto"

    return "sedan"

def simulate_get_product_vehicle_compatibility(product, vehicle):
    sku = str(product.get("sku") or "").upper()
    name = str(product.get("name") or "").lower()
    category = simulate_resolve_vehicle_category(vehicle)

    is_sedan_vehicle = category == "sedan" or category in ["coupe", "convertible"]
    is_hatchback_vehicle = category == "hatchback"
    is_suv_vehicle = category in ["suv", "station_wagon"]
    is_pickup_vehicle = category in ["pickup", "camioneta_doble_cabina", "camioneta_cabina_media", "camioneta_1_cabina"]
    is_van_vehicle = category in ["van", "microbus_pasajeros", "microbus_techo_alto", "microbus_carga"]
    is_truck_vehicle = category in ["truck", "camion_1_cabina", "camion_2_cabinas", "camion_carga_furgon"]
    is_moto_vehicle = category in ["moto", "atv"]

    if is_moto_vehicle:
        return {"isCompatible": False, "badge": "No aplica a motos"}

    if sku == "POL-DEL-001":
        return {"isCompatible": True, "badge": "Compatible (Vidrios Delanteros)"}
    if sku == "POL-FRA-SUP":
        return {"isCompatible": True, "badge": "Compatible (Franja Parabrisas)"}

    is_sedan_tint = sku == "POL-SED-COM" or "-SED-" in sku
    is_hb_tint = sku == "POL-HB-COM" or "-HB-" in sku
    is_suv_tint = sku == "POL-SUV-COM" or "-SUV-" in sku
    is_pck_tint = sku == "POL-PCK-COM" or "-PCK-" in sku
    is_van_tint = sku == "POL-VAN-COM" or "-VAN-" in sku
    is_trk_tint = sku == "POL-TRK-COM" or "-TRK-" in sku or sku == "POL-CAM-COM"

    if is_suv_vehicle:
        if is_suv_tint: return {"isCompatible": True, "badge": "Compatible (SUV / Station Wagon)"}
        return {"isCompatible": False, "badge": "No compatible"}
    elif is_pickup_vehicle:
        if is_pck_tint: return {"isCompatible": True, "badge": "Compatible (Camioneta Pickup)"}
        return {"isCompatible": False, "badge": "No compatible"}
    elif is_sedan_vehicle:
        if is_sedan_tint: return {"isCompatible": True, "badge": "Compatible (Sedán / Auto)"}
        if is_hb_tint: return {"isCompatible": True, "badge": "Compatible (Auto Compacto)"}
        return {"isCompatible": False, "badge": "No compatible"}
    elif is_hatchback_vehicle:
        if is_hb_tint: return {"isCompatible": True, "badge": "Compatible (Hatchback / Compacto)"}
        if is_sedan_tint: return {"isCompatible": True, "badge": "Compatible (Sedán / Auto)"}
        return {"isCompatible": False, "badge": "No compatible"}
    elif is_van_vehicle:
        if is_van_tint: return {"isCompatible": True, "badge": "Compatible (Microbús / Van)"}
        return {"isCompatible": False, "badge": "No compatible"}
    elif is_truck_vehicle:
        if is_trk_tint: return {"isCompatible": True, "badge": "Compatible (Camión / Cabezal)"}
        return {"isCompatible": False, "badge": "No compatible"}

    return {"isCompatible": True, "badge": "Compatible"}

def run_suite():
    with open('./backend/data/seeds/core_seed.json', 'r', encoding='utf-8') as f:
        products = json.load(f)['collections']['products']

    pol_products = [p for p in products if str(p.get('sku', '')).startswith('POL-')]

    vehicles = [
        {"brand": "BMW", "model": "X3 [2000-Presente]", "year": 2016, "expected_cat": "suv", "expected_sku": "POL-SUV-COM"},
        {"brand": "Toyota", "model": "Hilux Revo 4x4", "year": 2019, "expected_cat": "camioneta_doble_cabina", "expected_sku": "POL-PCK-COM"},
        {"brand": "Toyota", "model": "Corolla LE", "year": 2018, "expected_cat": "sedan", "expected_sku": "POL-SED-COM"},
        {"brand": "Kia", "model": "Picanto Ion", "year": 2017, "expected_cat": "hatchback", "expected_sku": "POL-HB-COM"},
        {"brand": "Toyota", "model": "Hiace Techo Alto", "year": 2016, "expected_cat": "microbus_pasajeros", "expected_sku": "POL-VAN-COM"},
        {"brand": "Isuzu", "model": "NPR 4.5T", "year": 2015, "expected_cat": "camion_1_cabina", "expected_sku": "POL-TRK-COM"},
    ]

    for v in vehicles:
        cat = simulate_resolve_vehicle_category(v)
        assert cat == v["expected_cat"], f"Category mismatch for {v['brand']} {v['model']}: got {cat}, expected {v['expected_cat']}"

        # Test compatibility against all polarizados
        compat_skus = []
        for p in pol_products:
            res = simulate_get_product_vehicle_compatibility(p, v)
            if res["isCompatible"] and p["sku"] in ["POL-SED-COM", "POL-HB-COM", "POL-SUV-COM", "POL-PCK-COM", "POL-VAN-COM", "POL-TRK-COM"]:
                compat_skus.append(p["sku"])

        print(f"Vehicle: {v['brand']} {v['model']} ({cat}) -> Matched Complete Tint SKUs: {compat_skus}")
        assert v["expected_sku"] in compat_skus, f"Expected SKU {v['expected_sku']} not in compatible SKUs {compat_skus}"

    print("\nALL VEHICLE COMPATIBILITY TESTS PASSED PERFECTLY!")

if __name__ == '__main__':
    run_suite()
