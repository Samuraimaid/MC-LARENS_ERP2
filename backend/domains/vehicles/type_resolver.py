"""Resolve ERP vehicle records to silhouette slug with model/VIN fallbacks."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any

DEFAULT_SLUG = "default"
DESCRIPTOR_TYPES_PATH = Path(__file__).resolve().parents[2] / "data" / "vehicle-descriptor-types.json"
_DESCRIPTOR_TYPE_CACHE: dict[str, Any] | None = None

TYPE_ALIASES: dict[str, str] = {
    "hatchback": "hatchback",
    "sedan": "sedan",
    "sedán": "sedan",
    "convertible": "convertible",
    "cabrio": "convertible",
    "cabriolet": "convertible",
    "suv": "suv",
    "crossover": "suv",
    "station wagon": "station-wagon",
    "wagon": "station-wagon",
    "familiar": "station-wagon",
    "break": "station-wagon",
    "camioneta 1 cabina": "camioneta-1-cabina",
    "camioneta una cabina": "camioneta-1-cabina",
    "pickup 1 cabina": "camioneta-1-cabina",
    "camioneta cabina y media": "camioneta-cabina-y-media",
    "cabina y media": "camioneta-cabina-y-media",
    "crew cab": "camioneta-cabina-y-media",
    "camioneta doble cabina": "camioneta-cabina-y-media",
    "microbus de carga": "microbus-carga",
    "microbús de carga": "microbus-carga",
    "van de carga": "microbus-carga",
    "microbus de pasajeros": "microbus-pasajeros",
    "microbús de pasajeros": "microbus-pasajeros",
    "minibus": "microbus-pasajeros",
    "minibús": "microbus-pasajeros",
    "camion de carga": "camion-carga",
    "camión de carga": "camion-carga",
    "truck": "camion-carga",
    "cabezal": "cabezal",
    "tracto": "cabezal",
    "tractocamion": "cabezal",
    "tractocamión": "cabezal",
    "pickup": "camioneta-1-cabina",
    "camioneta": "camioneta-1-cabina",
    "hatchback large": "hatchback",
    "large car": "sedan",
    "small sport utility vehicle": "suv",
}

# Human labels used in product compatibility and legacy records.
CANONICAL_TYPE_LABELS: dict[str, str] = {
    "hatchback": "Hatchback",
    "sedan": "Sedán",
    "convertible": "Convertible",
    "suv": "SUV",
    "station-wagon": "Station Wagon",
    "camioneta-1-cabina": "Camioneta 1 Cabina",
    "camioneta-cabina-y-media": "Camioneta Doble Cabina",
    "microbus-carga": "Microbús de Carga",
    "microbus-pasajeros": "Microbus de Pasajeros",
    "camion-carga": "Camion de Carga",
    "cabezal": "Cabezal",
}

VPIC_BODY_CLASS_MAP: dict[str, str] = {
    "pickup": "camioneta-1-cabina",
    "crew cab pickup": "camioneta-cabina-y-media",
    "extended cab pickup": "camioneta-cabina-y-media",
    "sport utility vehicle": "suv",
    "multipurpose passenger vehicle": "suv",
    "crossover utility vehicle": "suv",
    "hatchback": "hatchback",
    "hatchback/liftback/notchback": "hatchback",
    "sedan": "sedan",
    "sedan/saloon": "sedan",
    "wagon": "station-wagon",
    "convertible": "convertible",
    "cabriolet": "convertible",
    "van": "microbus-carga",
    "minivan": "microbus-pasajeros",
    "cargo van": "microbus-carga",
    "incomplete - chassis cab": "cabezal",
    "truck": "camion-carga",
    "truck-tractor": "cabezal",
}

# Ordered rules: first match wins. Patterns are applied to normalized free text.
TEXT_RULES: list[tuple[str, str]] = [
    (r"\b(doble cabina|double cab|crew cab|cabina y media|crewman)\b", "camioneta-cabina-y-media"),
    (r"\b(1 cabina|una cabina|cabina simple|single cab)\b", "camioneta-1-cabina"),
    (r"\b(camioneta doble cabina)\b", "camioneta-cabina-y-media"),
    (r"\b(camioneta 1 cabina|pickup 1 cabina)\b", "camioneta-1-cabina"),
    (r"\b(microbus de pasajeros|microbús de pasajeros|minibus|minivan de pasajeros)\b", "microbus-pasajeros"),
    (r"\b(microbus de carga|microbús de carga|van de carga|cargo van)\b", "microbus-carga"),
    (r"\b(cabezal|tractocamion|tracto camion|tractor truck)\b", "cabezal"),
    (r"\b(camion de carga|camión de carga|box truck|camion carga)\b", "camion-carga"),
    (r"\b(pickup doble cabina|pickup double cab)\b", "camioneta-cabina-y-media"),
    (r"\b(pickup cabina simple|pickup single cab)\b", "camioneta-1-cabina"),
    # Explicit pickup model tokens (records often only store brand+model, no body type)
    (
        r"\b(hilux|tacoma|tundra|ranger|amarok|s10|l200|frontier|np300|colorado|canyon|"
        r"navara|triton|saveiro|strada|oroch|montana|toro|titan|maverick|ridgeline|"
        r"bt-50|d-max|dmax|musso|wildtrak|silverado|f-150|f150|gladiator|canyon)\b",
        "camioneta-cabina-y-media",
    ),
    (r"\b(pickup|camioneta)\b", "camioneta-1-cabina"),
    (r"\b(convertible|cabrio|cabriolet)\b", "convertible"),
    (r"\b(station wagon|wagon|familiar|estate|break)\b", "station-wagon"),
    # Common SUVs (e.g. X-Trail) before generic hatch/sedan
    (
        r"\b(x-trail|xtrail|qashqai|rav4|cr-v|hr-v|tucson|sportage|sorento|duster|"
        r"tracker|equinox|pathfinder|4runner|fortuner|prado|land cruiser|cx-5|cx-30|"
        r"forester|outlander|kicks|creta|seltos|tiguan|escape|explorer)\b",
        "suv",
    ),
    (r"\b(suv|crossover|sport utility)\b", "suv"),
    (r"\b(hatchback large|hatchback|hatch/|hatch )\b", "hatchback"),
    (r"\b(sedan|sedán|saloon)\b", "sedan"),
    (r"\b(minivan|microbus)\b", "microbus-pasajeros"),
]

# Model tokens without body-style words (Hilux, X-Trail, …)
MODEL_TOKEN_DEFAULTS: dict[str, str] = {
    "hilux": "camioneta-cabina-y-media",
    "tacoma": "camioneta-cabina-y-media",
    "tundra": "camioneta-cabina-y-media",
    "ranger": "camioneta-cabina-y-media",
    "amarok": "camioneta-cabina-y-media",
    "s10": "camioneta-cabina-y-media",
    "l200": "camioneta-cabina-y-media",
    "frontier": "camioneta-cabina-y-media",
    "np300": "camioneta-cabina-y-media",
    "colorado": "camioneta-cabina-y-media",
    "navara": "camioneta-cabina-y-media",
    "triton": "camioneta-cabina-y-media",
    "d-max": "camioneta-cabina-y-media",
    "dmax": "camioneta-cabina-y-media",
    "bt-50": "camioneta-cabina-y-media",
    "silverado": "camioneta-cabina-y-media",
    "f-150": "camioneta-cabina-y-media",
    "f150": "camioneta-cabina-y-media",
    "x-trail": "suv",
    "xtrail": "suv",
    "qashqai": "suv",
    "rav4": "suv",
    "cr-v": "suv",
    "hr-v": "suv",
    "tucson": "suv",
    "sportage": "suv",
    "sorento": "suv",
    "duster": "suv",
    "fortuner": "suv",
    "prado": "suv",
    "4runner": "suv",
    "pathfinder": "suv",
    "kicks": "suv",
    "corolla": "sedan",
    "camry": "sedan",
    "civic": "sedan",
    "accord": "sedan",
    "sentra": "sedan",
    "yaris": "hatchback",
    "swift": "hatchback",
    "spark": "hatchback",
    "prius": "hatchback",
    "gol": "hatchback",
}

# Stale defaults often written by older UI/import paths — model inference beats these.
WEAK_PRESET_SLUGS = frozenset({"", "default", "sedan", "hatchback"})


def normalize_vehicle_type_text(value: str = "") -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def _match_text_rules(text: str) -> str | None:
    if not text:
        return None
    for pattern, slug in TEXT_RULES:
        if re.search(pattern, text, flags=re.IGNORECASE):
            return slug
    return None


def _load_descriptor_type_entries() -> dict[str, Any]:
    global _DESCRIPTOR_TYPE_CACHE
    if _DESCRIPTOR_TYPE_CACHE is not None:
        return _DESCRIPTOR_TYPE_CACHE
    if not DESCRIPTOR_TYPES_PATH.exists():
        _DESCRIPTOR_TYPE_CACHE = {}
        return _DESCRIPTOR_TYPE_CACHE
    payload = json.loads(DESCRIPTOR_TYPES_PATH.read_text(encoding="utf-8"))
    _DESCRIPTOR_TYPE_CACHE = payload.get("entries") or {}
    return _DESCRIPTOR_TYPE_CACHE


def _descriptor_type_key(brand: str = "", descriptor: str = "") -> str | None:
    brand_key = normalize_vehicle_type_text(brand).upper()
    descriptor_key = str(descriptor or "").strip()
    if not brand_key or not descriptor_key:
        return None
    return f"{brand_key}::{descriptor_key}"


def infer_slug_from_descriptor(brand: str = "", descriptor: str = "") -> str | None:
    key = _descriptor_type_key(brand, descriptor)
    if not key:
        return None
    profile = _load_descriptor_type_entries().get(key) or {}
    slug = str(profile.get("default_silhouette_slug") or "").strip()
    return slug or None


def _match_model_token_defaults(text: str) -> str | None:
    if not text:
        return None
    # Longer tokens first (e.g. "land cruiser" / "x-trail" before short noise)
    for token, slug in sorted(MODEL_TOKEN_DEFAULTS.items(), key=lambda item: len(item[0]), reverse=True):
        if re.search(rf"\b{re.escape(token)}\b", text, flags=re.IGNORECASE):
            return slug
    return None


def infer_slug_from_model_text(model: str = "", brand: str = "", descriptor: str = "") -> str | None:
    combined = normalize_vehicle_type_text(" ".join(part for part in [brand, model, descriptor] if part))
    if not combined:
        return None

    # Parenthetical hints in catalog labels, e.g. "(pickup doble cabina)".
    for group in re.findall(r"\(([^)]+)\)", combined):
        slug = _match_text_rules(group) or _match_model_token_defaults(group)
        if slug:
            return slug

    token_slug = _match_model_token_defaults(combined)
    if token_slug:
        return token_slug

    return _match_text_rules(combined)


def _infer_slug_from_descriptor_fuzzy(brand: str = "", model: str = "") -> str | None:
    """Match brand+model against catalog descriptor keys when full descriptor is missing."""
    brand_key = normalize_vehicle_type_text(brand).upper()
    model_key = normalize_vehicle_type_text(model)
    if not brand_key or not model_key:
        return None
    model_token = model_key.split("(")[0].strip()
    if len(model_token) < 2:
        return None

    best_slug = None
    best_score = 0
    for key, profile in _load_descriptor_type_entries().items():
        if not key.startswith(f"{brand_key}::"):
            continue
        descriptor = key.split("::", 1)[1]
        desc_norm = normalize_vehicle_type_text(descriptor)
        # e.g. "hilux (an120) [2015-presente]" contains "hilux"
        if model_token not in desc_norm and not desc_norm.startswith(model_token):
            continue
        slug = str((profile or {}).get("default_silhouette_slug") or "").strip()
        if not slug:
            continue
        score = 100 if desc_norm.startswith(model_token) else 50
        # Prefer more specific modern dual-cab defaults when multiple Hilux generations match
        if score > best_score:
            best_score = score
            best_slug = slug
    return best_slug


def infer_slug_from_vpic_body_class(body_class: str = "") -> str | None:
    raw = normalize_vehicle_type_text(body_class)
    if not raw:
        return None
    if raw in VPIC_BODY_CLASS_MAP:
        return VPIC_BODY_CLASS_MAP[raw]
    for key, slug in VPIC_BODY_CLASS_MAP.items():
        if key in raw:
            return slug
    return _match_text_rules(raw)


def resolve_vehicle_thumbnail_slug(
    vehicle_type: str = "",
    *,
    brand: str = "",
    model: str = "",
    descriptor: str = "",
    body_class: str = "",
    allow_default: bool = True,
) -> str | None:
    raw_type = normalize_vehicle_type_text(vehicle_type)
    if raw_type and raw_type in TYPE_ALIASES:
        direct = TYPE_ALIASES[raw_type]
    else:
        direct = _match_text_rules(raw_type)

    descriptor_slug = infer_slug_from_descriptor(brand=brand, descriptor=descriptor)
    fuzzy_slug = None if descriptor_slug else _infer_slug_from_descriptor_fuzzy(brand=brand, model=model)
    model_slug = infer_slug_from_model_text(model=model, brand=brand, descriptor=descriptor)
    body_slug = infer_slug_from_vpic_body_class(body_class)

    # Priority: exact catalog descriptor → fuzzy catalog by model → model/token rules
    # → free-text vehicle_type (unless weak legacy) → VPIC body class.
    if descriptor_slug:
        return descriptor_slug
    if fuzzy_slug:
        return fuzzy_slug
    if model_slug and (not direct or direct in WEAK_PRESET_SLUGS or model_slug != direct):
        # Prefer model family (Hilux→pickup, Civic→sedan) over stale vehicle_type
        if not direct or direct in WEAK_PRESET_SLUGS:
            return model_slug
        if model_slug.startswith("camioneta") and direct in WEAK_PRESET_SLUGS | {"convertible", "suv"}:
            return model_slug
        if model_slug == "suv" and direct in WEAK_PRESET_SLUGS | {"convertible"}:
            return model_slug
        if model_slug == "sedan" and direct in {"hatchback", "convertible", "suv", "station-wagon"}:
            return model_slug
        if model_slug == "hatchback" and direct in {"sedan", "convertible", "suv"}:
            return model_slug
    if model_slug and not direct:
        return model_slug
    if direct:
        return direct
    if body_slug:
        return body_slug
    if model_slug:
        return model_slug

    if allow_default:
        return DEFAULT_SLUG
    return None


def resolve_vehicle_record_slug(vehicle: dict[str, Any] | None, *, allow_default: bool = False) -> str | None:
    vehicle = vehicle or {}
    preset = str(vehicle.get("vehicle_type_slug") or vehicle.get("thumbnail_slug") or "").strip().lower()

    brand = str(vehicle.get("brand") or "").strip()
    model = str(vehicle.get("model") or "").strip()
    if not brand and not model:
        return preset if preset and preset != DEFAULT_SLUG else None

    vehicle_type = str(
        vehicle.get("vehicle_type") or vehicle.get("type") or vehicle.get("body_type") or ""
    )
    descriptor = str(vehicle.get("descriptor") or "")
    inferred = resolve_vehicle_thumbnail_slug(
        vehicle_type,
        brand=brand,
        model=model,
        descriptor=descriptor,
        body_class=str(vehicle.get("body_class") or vehicle.get("vpic_body_class") or ""),
        allow_default=False,
    )
    model_slug = infer_slug_from_model_text(model=model, brand=brand, descriptor=descriptor)

    # Model/catalog inference always beats a stored vehicle_type_slug when they conflict.
    # NOTE: "sedan"/"hatchback" are weak as *presets*, but valid as *inferred* results
    # (e.g. Civic → sedan must win over stale vehicle_type_slug=hatchback).
    if inferred:
        if not preset or preset in WEAK_PRESET_SLUGS or preset == DEFAULT_SLUG:
            return inferred
        if preset != inferred:
            if model_slug and model_slug == inferred:
                return inferred
            if inferred.startswith("camioneta") and preset in {"hatchback", "sedan", "convertible", "suv"}:
                return inferred
            if inferred == "suv" and preset in {"hatchback", "sedan", "convertible"}:
                return inferred
            if inferred == "sedan" and preset in {"hatchback", "convertible", "suv", "station-wagon"}:
                return inferred
            if inferred == "hatchback" and preset in {"sedan", "convertible", "suv"}:
                # Only keep hatchback inference when model text implies hatch (not pure sedan tokens)
                if model_slug == "hatchback":
                    return inferred

    if preset and preset != DEFAULT_SLUG:
        return preset

    if inferred:
        return inferred

    if allow_default:
        return DEFAULT_SLUG
    return None


def infer_canonical_vehicle_type_label(
    vehicle_type: str = "",
    *,
    brand: str = "",
    model: str = "",
    descriptor: str = "",
    body_class: str = "",
) -> str | None:
    slug = resolve_vehicle_thumbnail_slug(
        vehicle_type,
        brand=brand,
        model=model,
        descriptor=descriptor,
        body_class=body_class,
        allow_default=False,
    )
    if not slug:
        return None
    return CANONICAL_TYPE_LABELS.get(slug, slug.replace("-", " ").title())