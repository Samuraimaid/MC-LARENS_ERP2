"""Discover vehicle models from public web sources and propose catalog additions."""
from __future__ import annotations

import asyncio
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from backend.domains.vehicles.catalog_versioning import backup_catalog_before_change
from backend.domains.vehicles.descriptor_classifier import classify_descriptor
from backend.domains.vehicles.vehicle_cab import infer_cab_variant_from_vpic
from backend.domains.vehicles.web_vehicle_metadata import (
    collect_web_body_hints,
    discover_model_titles_for_brand,
)

from backend.domains.vehicles.catalog_paths import resolve_backend_data_dir, resolve_catalog_path

CATALOG_PATH = resolve_catalog_path()
SYNC_STATE_PATH = resolve_backend_data_dir() / "vehicle-catalog-sync-state.json"
WIKI_API = "https://en.wikipedia.org/w/api.php"
WIKI_USER_AGENT = "MC-LARENS-ERP/1.0 (vehicle-catalog-sync; contact@local)"

BRAND_WIKI_CATEGORY: dict[str, str] = {
    "TOYOTA": "Category:Toyota vehicles",
    "HONDA": "Category:Honda vehicles",
    "NISSAN": "Category:Nissan vehicles",
    "FORD": "Category:Ford vehicles",
    "CHEVROLET": "Category:Chevrolet vehicles",
    "HYUNDAI": "Category:Hyundai vehicles",
    "KIA": "Category:Kia vehicles",
    "BMW": "Category:BMW vehicles",
    "MERCEDES": "Category:Mercedes-Benz vehicles",
    "AUDI": "Category:Audi vehicles",
    "VOLKSWAGEN": "Category:Volkswagen vehicles",
    "FIAT": "Category:Fiat vehicles",
    "RENAULT": "Category:Renault vehicles",
    "PEUGEOT": "Category:Peugeot vehicles",
    "CITROËN": "Category:Citroën vehicles",
    "CITROEN": "Category:Citroën vehicles",
    "SUBARU": "Category:Subaru vehicles",
    "MAZDA": "Category:Mazda vehicles",
    "MITSUBISHI": "Category:Mitsubishi vehicles",
    "SUZUKI": "Category:Suzuki vehicles",
    "JEEP": "Category:Jeep vehicles",
    "DODGE": "Category:Dodge vehicles",
    "GMC": "Category:GMC vehicles",
    "BYD": "Category:BYD vehicles",
    "ACURA": "Category:Acura vehicles",
    "LEXUS": "Category:Lexus vehicles",
    "INFINITI": "Category:Infiniti vehicles",
    "VOLVO": "Category:Volvo vehicles",
    "ISUZU": "Category:Isuzu vehicles",
    "RAM": "Category:Ram trucks",
    "TESLA": "Category:Tesla vehicles",
    "CHRYSLER": "Category:Chrysler vehicles",
    "SEAT": "Category:SEAT vehicles",
    "SKODA": "Category:Škoda vehicles",
    "OPEL": "Category:Opel vehicles",
    "VAUXHALL": "Category:Vauxhall vehicles",
    "MINI": "Category:Mini vehicles",
    "LAND ROVER": "Category:Land Rover vehicles",
    "JAGUAR": "Category:Jaguar vehicles",
    "PORSCHE": "Category:Porsche vehicles",
    "DAIHATSU": "Category:Daihatsu vehicles",
    "HINO": "Category:Hino vehicles",
    "SCANIA": "Category:Scania vehicles",
    "IVECO": "Category:Iveco vehicles",
    "FOTON": "Category:Foton vehicles",
    "JAC": "Category:JAC Motors vehicles",
    "CHANGAN": "Category:Changan vehicles",
    "GREAT WALL": "Category:Great Wall Motors vehicles",
    "HAVAL": "Category:Haval vehicles",
    "GEELY": "Category:Geely vehicles",
    "MG": "Category:MG vehicles",
    "SSANGYONG": "Category:KG Mobility vehicles",
    "DAEWOO": "Category:Daewoo vehicles",
}


def _norm(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _model_base(descriptor: str) -> str:
    return _norm(descriptor.split("(", 1)[0])


def load_catalog_entries() -> list[dict[str, Any]]:
    if not CATALOG_PATH.exists():
        return []
    payload = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    return list(payload.get("entries") or [])


def _catalog_model_tokens(entries: list[dict[str, Any]], brand: str) -> set[str]:
    tokens: set[str] = set()
    for entry in entries:
        if str(entry.get("brand") or "").upper() != brand.upper():
            continue
        descriptor = str(entry.get("descriptor") or "")
        model = str(entry.get("model") or "")
        tokens.add(_model_base(descriptor))
        tokens.add(_norm(model))
        for part in re.split(r"[/,&+]", descriptor.split("(", 1)[0]):
            part_token = _norm(part)
            if len(part_token) >= 2:
                tokens.add(part_token)
    return {token for token in tokens if token}


def _is_catalog_duplicate(title: str, catalog_tokens: set[str]) -> bool:
    token = _norm(title)
    if not token:
        return True
    if token in catalog_tokens:
        return True
    for existing in catalog_tokens:
        if len(existing) <= 3:
            continue
        if token == existing or token in existing or existing in token:
            return True
    return False


def _build_catalog_descriptor(title: str, web_meta: dict[str, Any] | None = None) -> str:
    """Shape web discoveries like native catalog lines (generation + years when known)."""
    base = str(title or "").strip()
    if not base:
        return "[descubierto web]"
    years = ""
    if web_meta:
        extract = str(web_meta.get("extract_preview") or "")
        year_match = re.search(r"\b(19|20)\d{2}\b", extract)
        if year_match:
            years = f" [{year_match.group(0)}-Presente]"
    return f"{base}{years or ' [descubierto web]'}"


def _clean_wiki_title(title: str) -> str | None:
    text = str(title or "").strip()
    if not text:
        return None
    blocked = (
        "category:",
        "list of",
        "template:",
        "motorcycle",
        "concept",
        "prototype",
        "racing",
        "engine",
        "platform",
        "factory",
    )
    lowered = text.lower()
    if any(marker in lowered for marker in blocked):
        return None
    text = re.sub(r"\s*\(.*?\)\s*$", "", text).strip()
    if len(text) < 2:
        return None
    return text


async def _fetch_wikidata_models(brand: str, limit: int = 80) -> list[str]:
    """Discover model names via Wikidata SPARQL (secondary source)."""
    query = f"""
    SELECT ?modelLabel WHERE {{
      ?model wdt:P176 ?manufacturer .
      ?manufacturer rdfs:label ?brandLabel .
      FILTER(CONTAINS(LCASE(?brandLabel), LCASE("{brand}")))
      ?model rdfs:label ?modelLabel .
      FILTER(LANG(?modelLabel) = "en")
    }}
    LIMIT {limit}
    """
    headers = {"User-Agent": WIKI_USER_AGENT}
    params = {"query": query, "format": "json"}
    titles: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=25.0, headers=headers) as client:
            response = await client.get("https://query.wikidata.org/sparql", params=params)
            response.raise_for_status()
            payload = response.json()
            bindings = payload.get("results", {}).get("bindings") or []
            for row in bindings:
                cleaned = _clean_wiki_title(row.get("modelLabel", {}).get("value") or "")
                if cleaned:
                    titles.append(cleaned)
    except Exception:
        return []
    return titles


async def _fetch_wikipedia_category_members(category: str, limit: int = 200) -> list[str]:
    titles: list[str] = []
    continue_token: str | None = None
    headers = {"User-Agent": WIKI_USER_AGENT}
    async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
        while len(titles) < limit:
            params: dict[str, Any] = {
                "action": "query",
                "format": "json",
                "list": "categorymembers",
                "cmtitle": category,
                "cmlimit": str(min(50, limit - len(titles))),
                "cmtype": "page",
            }
            if continue_token:
                params["cmcontinue"] = continue_token
            response = await client.get(WIKI_API, params=params)
            response.raise_for_status()
            payload = response.json()
            members = payload.get("query", {}).get("categorymembers") or []
            for member in members:
                cleaned = _clean_wiki_title(member.get("title") or "")
                if cleaned:
                    titles.append(cleaned)
            continue_token = payload.get("continue", {}).get("cmcontinue")
            if not continue_token:
                break
    return titles


async def discover_models_for_brand(brand: str, entries: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    entries = entries if entries is not None else load_catalog_entries()
    brand_key = str(brand or "").strip().upper()
    if not brand_key:
        return {"brand": brand, "error": "brand_required", "proposals": []}

    category = BRAND_WIKI_CATEGORY.get(brand_key)
    discovered: list[str] = []
    source = "wikipedia_category"
    error: str | None = None

    wiki_titles: list[str] = []
    wikidata_titles: list[str] = []

    if category:
        try:
            wiki_titles = await _fetch_wikipedia_category_members(category)
        except Exception as exc:
            error = f"wikipedia_error: {exc}"
    else:
        source = "unsupported_brand"
        error = "No Wikipedia category mapping for this brand yet."

    try:
        wikidata_titles = await _fetch_wikidata_models(brand_key)
    except Exception:
        wikidata_titles = []

    search_payload = await discover_model_titles_for_brand(brand_key, limit=50)
    search_titles = search_payload.get("titles") or []
    search_sources = search_payload.get("sources") or []

    discovered = list(dict.fromkeys([*wiki_titles, *wikidata_titles, *search_titles]))
    source_parts: list[str] = []
    if wiki_titles:
        source_parts.append("wikipedia_category")
    if wikidata_titles:
        source_parts.append("wikidata")
    if "wikipedia_search" in search_sources:
        source_parts.append("wikipedia_search")
    if "google_cse" in search_sources:
        source_parts.append("google_cse")
    source = "+".join(source_parts) if source_parts else source

    catalog_tokens = _catalog_model_tokens(entries, brand_key)
    candidate_titles: list[str] = []
    seen_proposals: set[str] = set()
    for title in discovered:
        token = _norm(title)
        if not token or token in seen_proposals:
            continue
        if _is_catalog_duplicate(title, catalog_tokens):
            continue
        seen_proposals.add(token)
        candidate_titles.append(title)
        if len(candidate_titles) >= 80:
            break

    semaphore = asyncio.Semaphore(4)

    async def _enrich_title(title: str) -> dict[str, Any]:
        async with semaphore:
            web_meta = await collect_web_body_hints(brand_key, title)
        web_hints = list(web_meta.get("body_hints") or [])
        descriptor = _build_catalog_descriptor(title, web_meta)
        classified = classify_descriptor(
            brand_key,
            descriptor,
            model=title,
            web_hints=web_hints,
            refresh_stale_overrides=False,
        )
        if web_meta.get("inferred_slug"):
            slug = str(web_meta["inferred_slug"])
            type_label = classified["vehicle_type_label"]
            classification_source = "web_sync"
        else:
            slug = classified["vehicle_type_slug"]
            type_label = classified["vehicle_type_label"]
            classification_source = classified.get("classification_source", "rules")

        return {
            "brand": brand_key,
            "descriptor": descriptor,
            "model": title,
            "engine": "por definir [G]",
            "label": f"{descriptor} - por definir [G]",
            "vehicle_type_slug": slug,
            "vehicle_type_label": type_label,
            "classification_source": classification_source,
            "source": source,
            "source_title": title,
            "web_metadata": {
                "matched_hint": web_meta.get("matched_hint"),
                "categories": (web_meta.get("categories") or [])[:4],
                "extract_preview": web_meta.get("extract_preview"),
                "sources": web_meta.get("sources") or [],
            },
            "review_status": "pending",
        }

    enriched = await asyncio.gather(*[_enrich_title(title) for title in candidate_titles[:60]])
    proposals: list[dict[str, Any]] = list(enriched)

    return {
        "brand": brand_key,
        "source": source,
        "discovered_count": len(discovered),
        "proposal_count": len(proposals),
        "proposals": proposals[:100],
        "error": error,
    }


async def sync_catalog_from_web(
    brands: list[str] | None = None,
    *,
    max_brands: int = 10,
) -> dict[str, Any]:
    entries = load_catalog_entries()
    all_brands = brands or sorted({str(e.get("brand") or "").upper() for e in entries if e.get("brand")})
    all_brands = [b for b in all_brands if b][:max_brands]

    results: list[dict[str, Any]] = []
    all_proposals: list[dict[str, Any]] = []
    for brand in all_brands:
        result = await discover_models_for_brand(brand, entries)
        results.append(
            {
                "brand": brand,
                "discovered_count": result.get("discovered_count", 0),
                "proposal_count": result.get("proposal_count", 0),
                "error": result.get("error"),
            }
        )
        all_proposals.extend(result.get("proposals") or [])

    state = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "brands_scanned": len(all_brands),
        "proposal_count": len(all_proposals),
        "results": results,
        "proposals": all_proposals,
    }
    SYNC_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    SYNC_STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
    return state


def build_catalog_summary(mongo_brands: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    entries = load_catalog_entries()
    master_brands = sorted({str(e.get("brand") or "").upper() for e in entries if e.get("brand")})
    mongo_brands = mongo_brands or []
    mongo_brand_names = sorted(
        {str(b.get("value") or b.get("name") or "").upper() for b in mongo_brands if b.get("value") or b.get("name")}
    )
    master_set = set(master_brands)
    mongo_set = set(mongo_brand_names)
    return {
        "master_catalog": {
            "entries": len(entries),
            "brands": len(master_brands),
        },
        "mongo_settings": {
            "brands": len(mongo_brand_names),
        },
        "divergence": {
            "only_in_master": sorted(master_set - mongo_set)[:20],
            "only_in_mongo": sorted(mongo_set - master_set)[:20],
            "shared_brands": len(master_set & mongo_set),
        },
        "recommendation": (
            "Usa el catálogo maestro JSON para registro de vehículos. "
            "MongoDB conserva variaciones/colores para filtros legacy."
        ),
    }


def apply_sync_proposals(
    proposals: list[dict[str, Any]],
    *,
    max_add: int = 100,
) -> dict[str, Any]:
    if not CATALOG_PATH.exists():
        raise FileNotFoundError(f"Catalog not found: {CATALOG_PATH}")

    version = backup_catalog_before_change(
        "sync_apply",
        meta={"proposal_count": len(proposals), "max_add": max_add},
    )

    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    entries: list[dict[str, Any]] = list(catalog.get("entries") or [])
    existing_labels = {_norm(e.get("label") or "") for e in entries}

    added = 0
    skipped = 0
    created: list[dict[str, Any]] = []

    for idx, proposal in enumerate(proposals[:max_add], start=1):
        review_status = str(proposal.get("review_status") or "pending").strip().lower()
        if review_status == "ignore":
            skipped += 1
            continue

        brand = str(proposal.get("brand") or "").strip().upper()
        descriptor = str(proposal.get("descriptor") or "").strip()
        engine = str(proposal.get("engine") or "por definir [G]").strip()
        model = str(proposal.get("model") or descriptor.split("(", 1)[0].strip()).strip()
        label = str(proposal.get("label") or f"{descriptor} - {engine}").strip()
        if not brand or not descriptor:
            skipped += 1
            continue
        if _norm(label) in existing_labels:
            skipped += 1
            continue

        classified = classify_descriptor(brand, descriptor, model=model)
        slug = str(proposal.get("vehicle_type_slug") or classified["vehicle_type_slug"])
        type_label = str(proposal.get("vehicle_type_label") or classified["vehicle_type_label"])
        row = {
            "id": f"{brand}::SYNC::{idx}",
            "brand": brand,
            "descriptor": descriptor,
            "model": model,
            "engine": engine,
            "fuel": "G",
            "label": label,
            "vehicle_type_slug": slug,
            "vehicle_type_label": type_label,
            "thumbnail_slug": slug,
            "classification_source": "web_sync",
        }
        entries.append(row)
        existing_labels.add(_norm(label))
        created.append(row)
        added += 1

    catalog["entries"] = entries
    catalog["total_rows"] = len(entries)
    catalog["generated_at_utc"] = datetime.now(timezone.utc).isoformat()
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "added": added,
        "skipped": skipped,
        "created": created,
        "total_rows": len(entries),
        "backup_version_id": version.get("version_id"),
    }


def load_last_sync_state() -> dict[str, Any]:
    if not SYNC_STATE_PATH.exists():
        return {"updated_at": None, "proposal_count": 0, "proposals": [], "results": []}
    return json.loads(SYNC_STATE_PATH.read_text(encoding="utf-8"))