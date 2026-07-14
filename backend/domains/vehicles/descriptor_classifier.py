"""Classify catalog descriptor lines to silhouette slugs."""
from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any

from backend.domains.vehicles.type_resolver import CANONICAL_TYPE_LABELS, normalize_vehicle_type_text

ROOT = Path(__file__).resolve().parents[2]
OVERRIDES_PATH = ROOT / "data" / "vehicle-descriptor-types.json"
DEFAULT_SLUG = "sedan"

# Ordered regex rules on normalized descriptor + model token.
TEXT_RULES: list[tuple[str, str]] = [
    (r"\b(cabezal|tractocamion|tracto camion|truck-tractor|serie 700)\b", "cabezal"),
    (r"\b(camion de carga|camión de carga|box truck|npr|nqr|nkr|canter|fuso|actros|dyna|toyoace|hino serie)\b", "camion-carga"),
    (r"\b(ambulancia|coaster|minibus|microbus de pasajeros|minivan|odyssey|sienna|carnival|alhambra|sharan|galaxy|vellfire|alphard|granvia|innova|kijang)\b", "microbus-pasajeros"),
    (r"\b(furgon|furgón|cargo van|van de carga|transit|sprinter|ducato|boxer|jumper|master|nv350|liteace|townace|kangoo utilitario|partner utilitario)\b", "microbus-carga"),
    (r"\b(hiace|hiace commuter)\b", "microbus-pasajeros"),
    (r"\b(convertible|cabrio|cabriolet|roadster|spider|mx-5|miata)\b", "convertible"),
    (r"\b(station wagon|touring sports|touring|fielder|familiar|estate|variant|break|sw4)\b", "station-wagon"),
    (r"\b(hatch|hatchback|liftback|prius|yaris(?! cross)|fit|jazz|polo|golf(?! variant)|i20|march|micra|corsa|208|sandero|swift|cultus|mazda2|aygo|picanto|rio hb|fabia|clio hatch|punto|500e|leaf|bolt|spark|aveo hb)\b", "hatchback"),
    (r"\b(suv|crossover|sport utility|4runner|rav4|rav 4|cr-v|hr-v|pilot|pathfinder|x-trail|qashqai|kicks|tiguan|touareg|kodiaq|sportage|sorento|tucson|santa fe|palisade|explorer|escape|edge|bronco|equinox|tracker|trailblazer|captiva|duster|koleos|renegade|compass|cherokee|pajero|montero|outlander|cx-|forester|crosstrek|vitara|jimny|niro|ev6|bZ4X|fj cruiser|fortuner|sw4|raize|rush|creta|seltos|tiggo|h6|h2|x35|x55|x60|x70)\b", "suv"),
    (r"\b(pickup|camioneta|hilux|ranger|amarok|s10|l200|frontier|np300|colorado|canyon|navara|triton|saveiro|strada|oroch|montana|toro|titan|tacoma|tundra|maverick|ridgeline|bt-50|d-max|dmax|musso|acty truck|courier|wildtrak|dakota|ram 1500|silverado|f-150|f150)\b", "camioneta-cabina-y-media"),
    (r"\b(sedan|sedán|saloon|corolla|camry|accord|civic|sentra|altima|versa|jetta|passat|a4|a6|3 series|5 series|c-class|e-class|focus|fusion|malibu|impala|aveo|cobalt|cerato|rio|forte|optima|sonata|elantra|accent|verna|logan|symbol)\b", "sedan"),
]

# Model tokens without explicit body-style hints default by family.
MODEL_TOKEN_DEFAULTS: dict[str, str] = {
    "corolla": "sedan",
    "camry": "sedan",
    "yaris": "hatchback",
    "prius": "hatchback",
    "rav4": "suv",
    "hilux": "camioneta-cabina-y-media",
    "fortuner": "suv",
    "prado": "suv",
    "land cruiser": "suv",
    "4runner": "suv",
    "hiace": "microbus-pasajeros",
    "innova": "microbus-pasajeros",
    "coaster": "microbus-pasajeros",
    "dyna": "camion-carga",
    "ranger": "camioneta-cabina-y-media",
    "f-150": "camioneta-cabina-y-media",
    "silverado": "camioneta-cabina-y-media",
    "s10": "camioneta-cabina-y-media",
    "amarok": "camioneta-cabina-y-media",
    "l200": "camioneta-cabina-y-media",
    "frontier": "camioneta-cabina-y-media",
    "np300": "camioneta-cabina-y-media",
    "cr-v": "suv",
    "hr-v": "suv",
    "pilot": "suv",
    "fit": "hatchback",
    "civic": "sedan",
    "accord": "sedan",
    "tucson": "suv",
    "sportage": "suv",
    "sorento": "suv",
    "creta": "suv",
    "duster": "suv",
    "sandero": "hatchback",
    "logan": "sedan",
    "gol": "hatchback",
    "polo": "hatchback",
    "golf": "hatchback",
    "tiguan": "suv",
    "passat": "sedan",
    "jetta": "sedan",
    "beetle": "hatchback",
    "swift": "hatchback",
    "cultus": "hatchback",
    "mazda2": "hatchback",
    "mazda 2": "hatchback",
    "picanto": "hatchback",
    "fabia": "hatchback",
    "spark": "hatchback",
    "vezel": "suv",
    "hr-v": "suv",
    "x-trail": "suv",
    "qashqai": "suv",
    "kicks": "suv",
    "renegade": "suv",
    "compass": "suv",
    "cherokee": "suv",
    "outlander": "suv",
    "cx-5": "suv",
    "cx-30": "suv",
    "forester": "suv",
    "outback": "station-wagon",
    "kangoo": "microbus-carga",
    "berlingo": "microbus-carga",
    "partner": "microbus-carga",
    "transit": "microbus-carga",
    "nv200": "microbus-carga",
    "nv350": "microbus-carga",
    "hilux": "camioneta-cabina-y-media",
    "tacoma": "camioneta-cabina-y-media",
    "tundra": "camioneta-cabina-y-media",
    "colorado": "camioneta-cabina-y-media",
    "navara": "camioneta-cabina-y-media",
    "triton": "camioneta-cabina-y-media",
    "d-max": "camioneta-cabina-y-media",
    "dmax": "camioneta-cabina-y-media",
    "bt-50": "camioneta-cabina-y-media",
    "saveiro": "camioneta-cabina-y-media",
    "strada": "camioneta-cabina-y-media",
    "oroch": "camioneta-cabina-y-media",
    "montana": "camioneta-cabina-y-media",
    "toro": "camioneta-cabina-y-media",
}


def descriptor_key(brand: str, descriptor: str) -> str:
    brand_key = normalize_vehicle_type_text(brand).upper()
    return f"{brand_key}::{descriptor.strip()}"


@lru_cache(maxsize=1)
def _load_override_entries() -> dict[str, Any]:
    if not OVERRIDES_PATH.exists():
        return {}
    payload = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
    return payload.get("entries") or {}


def _normalize_match_text(*parts: str) -> str:
    text = " ".join(p for p in parts if p)
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return text.lower()


def _model_token(descriptor: str, model: str = "") -> str:
    base = (model or descriptor).split("(", 1)[0].strip().lower()
    return re.sub(r"\s+", " ", base)


def _parse_year_start(descriptor: str) -> int | None:
    token = re.search(r"\[(\d{4})", descriptor or "")
    if not token:
        return None
    try:
        return int(token.group(1))
    except ValueError:
        return None


def _apply_pickup_year_bias(slug: str, descriptor: str) -> str:
    if slug not in {"camioneta-1-cabina", "camioneta-cabina-y-media"}:
        return slug
    year_start = _parse_year_start(descriptor)
    if year_start is not None and year_start < 1997:
        return "camioneta-1-cabina"
    return slug


def _classify_from_rules(
    brand: str,
    descriptor: str,
    *,
    model: str = "",
    web_hints: list[str] | None = None,
) -> dict[str, Any]:
    combined = _normalize_match_text(brand, descriptor, model)
    slug: str | None = None
    source = "rules"

    if web_hints:
        from backend.domains.vehicles.web_vehicle_metadata import infer_slug_from_body_hints

        web_slug, _ = infer_slug_from_body_hints(web_hints)
        if web_slug:
            slug = web_slug
            source = "web_sync"

    if not slug:
        for pattern, candidate in TEXT_RULES:
            if re.search(pattern, combined, flags=re.IGNORECASE):
                slug = candidate
                break

    if not slug:
        token = _model_token(descriptor, model)
        for known_token, candidate in MODEL_TOKEN_DEFAULTS.items():
            if known_token in token or known_token in combined:
                slug = candidate
                break

    if not slug:
        slug = DEFAULT_SLUG

    slug = _apply_pickup_year_bias(slug, descriptor)
    return {
        "vehicle_type_slug": slug,
        "vehicle_type_label": CANONICAL_TYPE_LABELS.get(slug, slug.replace("-", " ").title()),
        "body_family": None,
        "classification_source": source,
        "catalog_status": "auto",
    }


def classify_descriptor(
    brand: str,
    descriptor: str,
    *,
    model: str = "",
    prefer_override: bool = True,
    web_hints: list[str] | None = None,
    refresh_stale_overrides: bool = True,
) -> dict[str, Any]:
    key = descriptor_key(brand, descriptor)
    if prefer_override:
        override = _load_override_entries().get(key)
        if override and override.get("default_silhouette_slug"):
            slug = str(override["default_silhouette_slug"])
            catalog_status = override.get("catalog_status", "validated")
            manual = str(override.get("classification_source") or "").strip().lower() == "manual"
            if refresh_stale_overrides and not manual and slug == DEFAULT_SLUG:
                rules_result = _classify_from_rules(brand, descriptor, model=model, web_hints=web_hints)
                if rules_result["vehicle_type_slug"] != DEFAULT_SLUG:
                    return {
                        **rules_result,
                        "catalog_status": catalog_status,
                    }
            return {
                "vehicle_type_slug": slug,
                "vehicle_type_label": CANONICAL_TYPE_LABELS.get(slug, slug),
                "body_family": override.get("body_family"),
                "classification_source": "override" if not manual else "manual",
                "catalog_status": catalog_status,
            }

    return _classify_from_rules(brand, descriptor, model=model, web_hints=web_hints)