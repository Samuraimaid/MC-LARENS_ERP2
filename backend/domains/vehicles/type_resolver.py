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
    (r"\b(pickup|camioneta)\b", "camioneta-1-cabina"),
    (r"\b(convertible|cabrio|cabriolet)\b", "convertible"),
    (r"\b(station wagon|wagon|familiar|estate|break)\b", "station-wagon"),
    (r"\b(suv|crossover|sport utility)\b", "suv"),
    (r"\b(hatchback large|hatchback|hatch/|hatch )\b", "hatchback"),
    (r"\b(sedan|sedán|saloon)\b", "sedan"),
    (r"\b(minivan|microbus)\b", "microbus-pasajeros"),
]


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


def infer_slug_from_model_text(model: str = "", brand: str = "", descriptor: str = "") -> str | None:
    combined = normalize_vehicle_type_text(" ".join(part for part in [brand, model, descriptor] if part))
    if not combined:
        return None

    # Parenthetical hints in catalog labels, e.g. "(pickup doble cabina)".
    for group in re.findall(r"\(([^)]+)\)", combined):
        slug = _match_text_rules(group)
        if slug:
            return slug

    return _match_text_rules(combined)


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
    model_slug = infer_slug_from_model_text(model=model, brand=brand, descriptor=descriptor)
    body_slug = infer_slug_from_vpic_body_class(body_class)

    # Curated catalog lines beat legacy defaults like vehicle_type="sedan".
    if descriptor_slug and (not direct or (direct == "sedan" and descriptor_slug != "sedan")):
        return descriptor_slug
    # Legacy records often have vehicle_type="sedan" from old defaults; trust catalog model hints.
    if model_slug and (not direct or (direct == "sedan" and model_slug != "sedan")):
        return model_slug
    if direct:
        return direct
    if body_slug:
        return body_slug

    if allow_default:
        return DEFAULT_SLUG
    return None


def resolve_vehicle_record_slug(vehicle: dict[str, Any] | None, *, allow_default: bool = False) -> str | None:
    vehicle = vehicle or {}
    preset = str(vehicle.get("vehicle_type_slug") or vehicle.get("thumbnail_slug") or "").strip().lower()
    if preset and preset != DEFAULT_SLUG:
        return preset

    brand = str(vehicle.get("brand") or "").strip()
    model = str(vehicle.get("model") or "").strip()
    if not brand and not model:
        return None

    slug = resolve_vehicle_thumbnail_slug(
        str(vehicle.get("vehicle_type") or vehicle.get("type") or vehicle.get("body_type") or ""),
        brand=brand,
        model=model,
        descriptor=str(vehicle.get("descriptor") or ""),
        body_class=str(vehicle.get("body_class") or vehicle.get("vpic_body_class") or ""),
        allow_default=allow_default,
    )
    return slug


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