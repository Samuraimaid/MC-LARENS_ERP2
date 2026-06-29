"""Build Toyota pilot descriptor-type profiles and patch vehicle catalog."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = ROOT / "frontend" / "src" / "data" / "vehicleCatalog.json"
FE_TYPES_PATH = ROOT / "frontend" / "src" / "data" / "vehicleDescriptorTypes.json"
BE_TYPES_PATH = ROOT / "backend" / "data" / "vehicle-descriptor-types.json"

# slug -> body_family helper
PICKUP = "pickup"
SUV = "suv"
SEDAN = "sedan"
HATCH = "hatchback"
WAGON = "station-wagon"
MPV = "mpv"
VAN_CARGO = "van-cargo"
VAN_PAX = "van-passenger"
TRUCK = "truck"
TRACTOR = "tractor"

SC1 = "camioneta-1-cabina"
SCM = "camioneta-cabina-y-media"


def profile(
    slug: str,
    *,
    family: str,
    notes: str = "",
    cabs: list[str] | None = None,
    status: str = "validated",
) -> dict:
    payload = {
        "default_silhouette_slug": slug,
        "body_family": family,
        "catalog_status": status,
        "validation_notes": notes,
    }
    if cabs:
        payload["cab_variants"] = cabs
    return payload


# Exact descriptor -> profile (122 catalog lines + additions)
TOYOTA_PROFILES: dict[str, dict] = {
    # SUVs
    "4Runner (N60) [1984-1989]": profile("suv", family=SUV, notes="SUV derivado de pickup, chasis con largueros."),
    "4Runner (N120) [1989-1995]": profile("suv", family=SUV),
    "4Runner (N180) [1995-2002]": profile("suv", family=SUV),
    "4Runner (N210) [2002-2009]": profile("suv", family=SUV),
    "4Runner (N280) [2009-2024]": profile("suv", family=SUV),
    "4Runner (N310) [2025-Presente]": profile("suv", family=SUV),
    "C-HR [2016-Presente]": profile("suv", family=SUV, notes="Crossover compacto."),
    "Corolla Cross (XG10) [2020-Presente]": profile("suv", family=SUV),
    "Fortuner (AN50) [2004-2015]": profile("suv", family=SUV, notes="SUV sobre plataforma IMV/Hilux."),
    "Fortuner (AN150) [2015-Presente]": profile("suv", family=SUV),
    "Highlander (XU20) [2000-2007]": profile("suv", family=SUV),
    "Highlander (XU40) [2007-2013]": profile("suv", family=SUV),
    "Highlander (XU50) [2013-2019]": profile("suv", family=SUV),
    "Highlander (XU70) [2019-Presente]": profile("suv", family=SUV),
    "Land Cruiser 60 (J60) [1980-1990]": profile("suv", family=SUV),
    "Land Cruiser 70 (J70) [1984-Presente]": profile("suv", family=SUV, notes="Utilitario/SUV; existe variante pickup con silueta de 1 cabina."),
    "Land Cruiser 80 (J80) [1990-1997]": profile("suv", family=SUV),
    "Land Cruiser 100 (J100) [1998-2007]": profile("suv", family=SUV),
    "Land Cruiser 200 (J200) [2007-2021]": profile("suv", family=SUV),
    "Land Cruiser 300 (J300) [2021-Presente]": profile("suv", family=SUV),
    "Land Cruiser Prado (J120) [2002-2009]": profile("suv", family=SUV),
    "Land Cruiser Prado (J150) [2009-2015]": profile("suv", family=SUV),
    "Prado (J70) [1984-1996]": profile("suv", family=SUV),
    "Prado (J90) [1996-2002]": profile("suv", family=SUV),
    "Prado (J120) [2002-2009]": profile("suv", family=SUV),
    "Prado (J150) [2009-2023]": profile("suv", family=SUV),
    "Prado (J250) [2024-Presente]": profile("suv", family=SUV),
    "RAV4 (XA10) [1994-2000]": profile("suv", family=SUV),
    "RAV4 (XA20) [2000-2005]": profile("suv", family=SUV),
    "RAV4 (XA30) [2005-2012]": profile("suv", family=SUV),
    "RAV4 (XA40) [2012-2018]": profile("suv", family=SUV),
    "RAV4 (XA50) [2018-Presente]": profile("suv", family=SUV),
    "Toyota Mega Cruiser [1995-2001]": profile("suv", family=SUV, notes="SUV militar derivado de Land Cruiser 70."),
    "FJ Cruiser [2006-2022]": profile("suv", family=SUV, notes="SUV retro; añadido al catálogo en piloto Toyota."),
    "Yaris Cross (XP210) [2020-Presente]": profile("suv", family=SUV, notes="Crossover; añadido al catálogo."),
    "Raize (A200) [2019-Presente]": profile("suv", family=SUV, notes="SUV subcompacto DNGA; añadido al catálogo."),
    "Rush (AC) [2006-Presente]": profile("suv", family=SUV, notes="SUV compacto para mercados emergentes."),
    "SW4 (Fortuner Brasil) [2004-Presente]": profile("suv", family=SUV, notes="Alias brasileño de Fortuner."),
    "bZ4X [2022-Presente]": profile("suv", family=SUV, notes="SUV eléctrico e-TNGA."),
    # Sedanes
    "Camry (V10) [1982-1986]": profile("sedan", family=SEDAN),
    "Camry (V20) [1986-1992]": profile("sedan", family=SEDAN),
    "Camry (XV10) [1991-1996]": profile("sedan", family=SEDAN),
    "Camry (XV20) [1996-2001]": profile("sedan", family=SEDAN),
    "Camry (XV30) [2001-2006]": profile("sedan", family=SEDAN),
    "Camry (XV40) [2006-2011]": profile("sedan", family=SEDAN),
    "Camry (XV50) [2011-2017]": profile("sedan", family=SEDAN),
    "Camry (XV70) [2017-2024]": profile("sedan", family=SEDAN),
    "Camry (XV80) [2024-Presente]": profile("sedan", family=SEDAN),
    "Corolla (E70) [1979-1983]": profile("sedan", family=SEDAN),
    "Corolla (E80) [1983-1987]": profile("sedan", family=SEDAN),
    "Corolla (E90) [1987-1991]": profile("sedan", family=SEDAN),
    "Corolla (E100) [1991-1995]": profile("sedan", family=SEDAN),
    "Corolla (E110) [1995-2000]": profile("sedan", family=SEDAN),
    "Corolla (E120) [2000-2006]": profile("sedan", family=SEDAN),
    "Corolla (E140/150) [2006-2013]": profile("sedan", family=SEDAN),
    "Corolla (E170/180) [2013-2019]": profile("sedan", family=SEDAN),
    "Corolla (E210) [2018-Presente]": profile("sedan", family=SEDAN, notes="En varios mercados también hatch; en LATAM predominante sedán."),
    "Avalon (XX10) [1994-1999]": profile("sedan", family=SEDAN),
    "Avalon (XX20) [2000-2004]": profile("sedan", family=SEDAN),
    "Avalon (XX30) [2005-2012]": profile("sedan", family=SEDAN),
    "Avalon (XX40) [2013-2018]": profile("sedan", family=SEDAN),
    "Avalon (XX50) [2019-2022]": profile("sedan", family=SEDAN),
    "Crown [1980-Presente]": profile("sedan", family=SEDAN, notes="Berlina ejecutiva."),
    "Echo [1999-2005]": profile("sedan", family=SEDAN, notes="Sedán compacto (Platz/Yaris sedán en otros mercados)."),
    "Etios (sedán) [2012-2021]": profile("sedan", family=SEDAN, notes="Sedán regional Brasil/India; añadido al catálogo."),
    "86 / GT86 (ZN6) [2012-2021]": profile("sedan", family=SEDAN, notes="Coupé deportivo; silueta sedán como aproximación."),
    "GR86 (ZN8) [2021-Presente]": profile("sedan", family=SEDAN, notes="Coupé deportivo."),
    "Supra (A60) [1981-1986]": profile("sedan", family=SEDAN, notes="Coupé deportivo."),
    "Supra (A70) [1986-1993]": profile("sedan", family=SEDAN),
    "Supra (A80) [1993-2002]": profile("sedan", family=SEDAN),
    "Supra (A90/J29) [2019-Presente]": profile("sedan", family=SEDAN),
    # Hatchback
    "Yaris (XP10) [1999-2005]": profile("hatchback", family=HATCH),
    "Yaris (XP90) [2005-2013]": profile("hatchback", family=HATCH),
    "Yaris (XP130) [2011-2019]": profile("hatchback", family=HATCH),
    "Yaris (XP210) [2020-Presente]": profile("hatchback", family=HATCH),
    "Prius (XW10) [1997-2003]": profile("hatchback", family=HATCH, notes="Liftback híbrido."),
    "Prius (XW20) [2003-2009]": profile("hatchback", family=HATCH),
    "Prius (XW30) [2009-2015]": profile("hatchback", family=HATCH),
    "Prius (XW50) [2015-2022]": profile("hatchback", family=HATCH),
    "Prius (XW60) [2022-Presente]": profile("hatchback", family=HATCH),
    "Matrix [2002-2014]": profile("hatchback", family=HATCH, notes="Liftback compacto."),
    "Celica (A60-T230) [1981-2006]": profile("hatchback", family=HATCH, notes="Coupé/liftback deportivo."),
    "Etios (hatch) [2012-2021]": profile("hatchback", family=HATCH, notes="Hatch regional; añadido al catálogo."),
    "Starlet (XP210) [2020-Presente]": profile("hatchback", family=HATCH, notes="City car hatch; añadido al catálogo."),
    # Station wagon
    "Corolla Touring Sports (E210) [2018-Presente]": profile(
        "station-wagon", family=WAGON, notes="Familiar/Fielder E210; añadido al catálogo."
    ),
    # Pickups
    "Hilux (N30/40) [1979-1983]": profile(SC1, family=PICKUP, cabs=["1 cabina"], notes="Generación compacta; principalmente cabina simple."),
    "Hilux (N50/60) [1983-1988]": profile(SC1, family=PICKUP, cabs=["1 cabina", "doble cabina"]),
    "Hilux (N80-110) [1988-1997]": profile(SC1, family=PICKUP, cabs=["1 cabina", "doble cabina"]),
    "Hilux (N140-170) [1997-2005]": profile(SC1, family=PICKUP, cabs=["1 cabina", "cabina y media", "doble cabina"]),
    "Hilux (N140/N150/N160/N170) [1997-2005]": profile(SC1, family=PICKUP, cabs=["1 cabina", "cabina y media", "doble cabina"], status="alias_generacion"),
    "Hilux (AN10/20) [2004-2015]": profile(SCM, family=PICKUP, cabs=["1 cabina", "cabina y media", "doble cabina"]),
    "Hilux (AN120) [2015-Presente]": profile(
        SCM,
        family=PICKUP,
        cabs=["1 cabina", "cabina y media", "doble cabina"],
        notes="Motores GD 2.4L/2.8L + 2.7L nafta. Retail LATAM mayormente doble cabina.",
    ),
    "Hilux GR Sport [2019-Presente]": profile(SCM, family=PICKUP, cabs=["doble cabina"]),
    "Hilux Vigo (nombre regional) [2004-2015]": profile(SCM, family=PICKUP, cabs=["1 cabina", "doble cabina"], status="alias_generacion"),
    "Toyota Pickup (Hilux USA) [1980-1995]": profile(SC1, family=PICKUP, cabs=["1 cabina", "cabina y media"]),
    "Tacoma (1ra gen) [1995-2004]": profile(SCM, family=PICKUP, cabs=["1 cabina", "cabina y media", "doble cabina"]),
    "Tacoma (2da gen) [2005-2015]": profile(SCM, family=PICKUP, cabs=["1 cabina", "cabina y media", "doble cabina"]),
    "Tacoma (3ra gen) [2015-2023]": profile(SCM, family=PICKUP, cabs=["1 cabina", "cabina y media", "doble cabina"]),
    "Tacoma (4ta gen) [2024-Presente]": profile(SCM, family=PICKUP, cabs=["1 cabina", "cabina y media", "doble cabina"]),
    "Tundra (1ra gen) [1999-2006]": profile(SCM, family=PICKUP, cabs=["1 cabina", "cabina y media", "doble cabina"]),
    "Tundra (2da gen) [2007-2021]": profile(SCM, family=PICKUP, cabs=["1 cabina", "cabina y media", "doble cabina"]),
    "Tundra (3ra gen) [2021-Presente]": profile(SCM, family=PICKUP, cabs=["1 cabina", "cabina y media", "doble cabina"]),
    "Land Cruiser 70 Pickup [1984-Presente]": profile(
        SC1, family=PICKUP, cabs=["1 cabina", "cabina y media"], notes="Pickup LC70; añadido al catálogo."
    ),
    # MPV / pasajeros
    "Alphard (1ra gen) [2002-2008]": profile("microbus-pasajeros", family=MPV),
    "Alphard (2da gen) [2008-2015]": profile("microbus-pasajeros", family=MPV),
    "Alphard (3ra gen) [2015-2023]": profile("microbus-pasajeros", family=MPV),
    "Alphard (4ta gen) [2023-Presente]": profile("microbus-pasajeros", family=MPV),
    "Vellfire (2008-Presente)": profile("microbus-pasajeros", family=MPV),
    "Granvia [1995-2002]": profile("microbus-pasajeros", family=MPV),
    "Granvia (moderno) [2019-Presente]": profile("microbus-pasajeros", family=MPV),
    "Grand Hiace / Regius [1997-2002]": profile("microbus-pasajeros", family=MPV),
    "Innova (AN40) [2004-2015]": profile("microbus-pasajeros", family=MPV),
    "Innova (AN150) [2016-Presente]": profile("microbus-pasajeros", family=MPV, notes="Innova Crysta; añadido al catálogo."),
    "Kijang Innova (Asia) [2004-2015]": profile("microbus-pasajeros", family=MPV, status="alias_generacion"),
    "Coaster (B20/30) [1982-1993]": profile("microbus-pasajeros", family=MPV, notes="Minibús."),
    "Coaster (B40/50) [1993-2016]": profile("microbus-pasajeros", family=MPV),
    "Coaster (B60/70) [2017-Presente]": profile("microbus-pasajeros", family=MPV),
    "Toyota Ambulancias (Hiace/Coaster derivados) [1980-Presente]": profile(
        "microbus-pasajeros", family=MPV, notes="Derivados de van/minibús."
    ),
    "Sienna (XL10) [1997-2003]": profile("microbus-pasajeros", family=MPV, notes="Minivan NA; añadido al catálogo."),
    "Sienna (XL20) [2003-2010]": profile("microbus-pasajeros", family=MPV),
    "Sienna (XL30) [2010-2017]": profile("microbus-pasajeros", family=MPV),
    "Sienna (XL40) [2017-Presente]": profile("microbus-pasajeros", family=MPV),
    # Vans
    "Hiace (H50/60/70) [1982-1989]": profile("microbus-pasajeros", family=VAN_PAX, notes="Combi/furgón; default pasajeros."),
    "Hiace (H100) [1989-2004]": profile("microbus-pasajeros", family=VAN_PAX),
    "Hiace (H100 ultimas versiones) [~2000-2004]": profile("microbus-pasajeros", family=VAN_PAX, status="validated"),
    "Hiace (H200) [2004-Presente]": profile("microbus-pasajeros", family=VAN_PAX),
    "Hiace (H300) [2019-Presente]": profile("microbus-pasajeros", family=VAN_PAX),
    "LiteAce / TownAce (M30/R20) [1982-1991]": profile("microbus-carga", family=VAN_CARGO),
    "LiteAce / TownAce (M40/R40) [1992-2007]": profile("microbus-carga", family=VAN_CARGO),
    "LiteAce / TownAce (S400) [2008-Presente]": profile("microbus-carga", family=VAN_CARGO),
    # Camiones
    "Dyna / ToyoAce (U60/U90) [1984-1995]": profile("camion-carga", family=TRUCK),
    "Dyna (U100-U400) [1995-2011]": profile("camion-carga", family=TRUCK),
    "Dyna (U600-U800) [2011-Presente]": profile("camion-carga", family=TRUCK),
    "Toyota Dyna [2000-2010+]": profile("camion-carga", family=TRUCK, status="alias_generacion"),
    "Toyota ToyoAce [2000-2010+]": profile("camion-carga", family=TRUCK, status="alias_generacion"),
    "Hino Serie 300 (ligero) [2000-Presente]": profile("camion-carga", family=TRUCK, notes="Camión liviano Hino (marca Toyota Group)."),
    "Hino Serie 500 (mediano) [1980-Presente]": profile("camion-carga", family=TRUCK),
    "Hino Serie 700 (pesado) [1997-Presente]": profile("cabezal", family=TRACTOR, notes="Tracto/camión pesado."),
}

TOYOTA_CATALOG_ADDITIONS: list[tuple[str, str, str, str]] = [
    # descriptor, model, engine, fuel
    ("Innova (AN150) [2016-Presente]", "Innova", "2.0L [G]", "G"),
    ("Innova (AN150) [2016-Presente]", "Innova", "2.7L [G]", "G"),
    ("Innova (AN150) [2016-Presente]", "Innova", "2.4L [D]", "D"),
    ("Innova (AN150) [2016-Presente]", "Innova", "2.8L [D]", "D"),
    ("Etios (sedán) [2012-2021]", "Etios", "1.3L [G]", "G"),
    ("Etios (sedán) [2012-2021]", "Etios", "1.5L [G]", "G"),
    ("Etios (hatch) [2012-2021]", "Etios", "1.3L [G]", "G"),
    ("Etios (hatch) [2012-2021]", "Etios", "1.5L [G]", "G"),
    ("Yaris Cross (XP210) [2020-Presente]", "Yaris Cross", "1.5L [G]", "G"),
    ("Yaris Cross (XP210) [2020-Presente]", "Yaris Cross", "híbrido [H]", "H"),
    ("Raize (A200) [2019-Presente]", "Raize", "1.0L [G]", "G"),
    ("Raize (A200) [2019-Presente]", "Raize", "1.2L [G]", "G"),
    ("Rush (AC) [2006-Presente]", "Rush", "1.5L [G]", "G"),
    ("Corolla Touring Sports (E210) [2018-Presente]", "Corolla Touring Sports", "1.8L [G]", "G"),
    ("Corolla Touring Sports (E210) [2018-Presente]", "Corolla Touring Sports", "2.0L [G]", "G"),
    ("Corolla Touring Sports (E210) [2018-Presente]", "Corolla Touring Sports", "híbrido [H]", "H"),
    ("SW4 (Fortuner Brasil) [2004-Presente]", "SW4", "2.7L [G]", "G"),
    ("SW4 (Fortuner Brasil) [2004-Presente]", "SW4", "2.8L [D]", "D"),
    ("FJ Cruiser [2006-2022]", "FJ Cruiser", "4.0L [G]", "G"),
    ("bZ4X [2022-Presente]", "bZ4X", "eléctrico [E]", "E"),
    ("Starlet (XP210) [2020-Presente]", "Starlet", "1.0L [G]", "G"),
    ("Starlet (XP210) [2020-Presente]", "Starlet", "1.2L [G]", "G"),
    ("Land Cruiser 70 Pickup [1984-Presente]", "Land Cruiser 70 Pickup", "4.5L [D]", "D"),
    ("Sienna (XL10) [1997-2003]", "Sienna", "3.0L V6 [G]", "G"),
    ("Sienna (XL20) [2003-2010]", "Sienna", "3.3L V6 [G]", "G"),
    ("Sienna (XL30) [2010-2017]", "Sienna", "3.5L V6 [G]", "G"),
    ("Sienna (XL40) [2017-Presente]", "Sienna", "3.5L V6 [G]", "G"),
    ("Sienna (XL40) [2017-Presente]", "Sienna", "híbrido [H]", "H"),
]

HIACE_H100_LATE_DESCRIPTOR = "Hiace (H100 ultimas versiones) [~2000-2004]"


def extract_model(descriptor: str) -> str:
    return descriptor.split("(", 1)[0].strip() or descriptor.strip()


def catalog_engine_tokens(labels: list[str]) -> list[str]:
    engines: list[str] = []
    for label in labels:
        token = label.rsplit(" - ", 1)[-1].strip()
        if token:
            engines.append(token)
    return sorted(set(engines))


def fix_catalog_entries(entries: list[dict]) -> tuple[list[dict], int]:
    fixes = 0
    fixed: list[dict] = []
    seen_labels: set[str] = set()

    for entry in entries:
        if entry.get("brand") != "TOYOTA":
            fixed.append(entry)
            continue

        label = entry.get("label") or ""
        descriptor = entry.get("descriptor") or ""
        engine = entry.get("engine") or ""

        # Repair malformed 1KD Hiace row.
        if descriptor in {"Hiace (H100", "Hiace (H100 - últimas versiones) [~2000-2004]"} or (
            "Hiace (H100" in label
            and "1KD-FTV" in label
            and entry.get("id", "").startswith(("TOYOTA::FIXED_1KD::", "TOYOTA::Hiace (H100"))
        ):
            entry = {
                **entry,
                "id": "TOYOTA::Hiace (H100 - ultimas versiones) [~2000-2004]::1",
                "descriptor": HIACE_H100_LATE_DESCRIPTOR,
                "model": "Hiace",
                "engine": "3.0L 1KD-FTV [D]",
                "fuel": "D",
                "label": f"{HIACE_H100_LATE_DESCRIPTOR} - 3.0L 1KD-FTV [D]",
            }
            fixes += 1

        norm_label = label.lower().strip()
        if norm_label in seen_labels:
            continue
        seen_labels.add(norm_label)
        fixed.append(entry)

    return fixed, fixes


def append_catalog_additions(entries: list[dict]) -> tuple[list[dict], int]:
    existing = {(e.get("brand"), (e.get("label") or "").lower()) for e in entries}
    added = 0
    out = list(entries)

    for idx, (descriptor, model, engine, fuel) in enumerate(TOYOTA_CATALOG_ADDITIONS, start=1):
        label = f"{descriptor} - {engine}"
        key = ("TOYOTA", label.lower())
        if key in existing:
            continue
        out.append(
            {
                "id": f"TOYOTA::PILOT_ADD::{idx}",
                "brand": "TOYOTA",
                "descriptor": descriptor,
                "model": model,
                "engine": engine,
                "fuel": fuel,
                "label": label,
            }
        )
        existing.add(key)
        added += 1

    return out, added


def build_entries_payload(catalog_entries: list[dict]) -> dict[str, dict]:
    lines: dict[str, list[str]] = {}
    for entry in catalog_entries:
        if entry.get("brand") != "TOYOTA":
            continue
        key = f"TOYOTA::{entry['descriptor']}"
        lines.setdefault(key, []).append(entry["label"])

    payload: dict[str, dict] = {}
    for key, labels in sorted(lines.items()):
        descriptor = key.split("::", 1)[1]
        profile = TOYOTA_PROFILES.get(descriptor)
        if not profile:
            raise KeyError(f"Missing Toyota profile for descriptor: {descriptor}")

        item = dict(profile)
        item["catalog_engines"] = catalog_engine_tokens(labels)
        payload[key] = item

    # Ensure profiles exist for additions even before catalog merge in dry runs
    for descriptor in TOYOTA_PROFILES:
        key = f"TOYOTA::{descriptor}"
        if key not in payload:
            item = dict(TOYOTA_PROFILES[descriptor])
            item["catalog_engines"] = []
            item["catalog_status"] = "catalog_pending"
            payload[key] = item

    return payload


def write_types_files(entries_payload: dict[str, dict]) -> None:
    doc = {
        "version": 1,
        "pilot_brand": "TOYOTA",
        "updated_at": datetime.now(timezone.utc).date().isoformat(),
        "notes": (
            "Perfiles curados para piloto Toyota. default_silhouette_slug define la silueta ERP; "
            "cab_variants documenta configuraciones reales cuando aplica."
        ),
        "entries": entries_payload,
    }
    text = json.dumps(doc, indent=2, ensure_ascii=False) + "\n"
    FE_TYPES_PATH.write_text(text, encoding="utf-8")
    BE_TYPES_PATH.write_text(text, encoding="utf-8")


def patch_catalog() -> dict[str, int]:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    entries = catalog.get("entries") or []

    entries, catalog_fixes = fix_catalog_entries(entries)
    entries, catalog_additions = append_catalog_additions(entries)

    payload = build_entries_payload(entries)
    write_types_files(payload)

    toyota_entries = [e for e in entries if e.get("brand") == "TOYOTA"]
    catalog["entries"] = entries
    catalog["total_rows"] = len(entries)
    catalog["generated_at_utc"] = datetime.now(timezone.utc).isoformat()
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "toyota_profiles": len(payload),
        "toyota_catalog_entries": len(toyota_entries),
        "catalog_fixes": catalog_fixes,
        "catalog_additions": catalog_additions,
    }


def main() -> None:
    stats = patch_catalog()
    print("Toyota pilot build complete:")
    for key, value in stats.items():
        print(f"  {key}={value}")

    # Coverage check
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))["entries"]
    descriptors = {e["descriptor"] for e in catalog if e.get("brand") == "TOYOTA"}
    missing = sorted(descriptors - set(TOYOTA_PROFILES.keys()))
    extra = sorted(set(TOYOTA_PROFILES.keys()) - descriptors)
    print(f"  descriptors_in_catalog={len(descriptors)}")
    print(f"  profiles_defined={len(TOYOTA_PROFILES)}")
    if missing:
        print("  MISSING_PROFILES:")
        for item in missing:
            print(f"    - {item}")
    if extra:
        print("  profiles_without_catalog_entry={0}".format(len(extra)))


if __name__ == "__main__":
    main()