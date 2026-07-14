"""Fetch vehicle body-style hints from Wikipedia, Wikidata and optional Google CSE."""
from __future__ import annotations

import os
import re
import unicodedata
from typing import Any

import httpx

WIKI_API = "https://en.wikipedia.org/w/api.php"
WIKI_USER_AGENT = "MC-LARENS-ERP/1.0 (vehicle-catalog-sync; contact@local)"

# Wikidata / Wikipedia category and instance labels → ERP silhouette slug.
BODY_HINT_TO_SLUG: dict[str, str] = {
    "sport utility vehicle": "suv",
    "crossover suv": "suv",
    "crossover": "suv",
    "compact sport utility vehicle": "suv",
    "mid-size sport utility vehicle": "suv",
    "full-size sport utility vehicle": "suv",
    "subcompact crossover suv": "suv",
    "compact crossover suv": "suv",
    "suv": "suv",
    "pickup truck": "camioneta-cabina-y-media",
    "crew cab": "camioneta-cabina-y-media",
    "double cab": "camioneta-cabina-y-media",
    "extended cab": "camioneta-cabina-y-media",
    "compact pickup truck": "camioneta-cabina-y-media",
    "full-size pickup truck": "camioneta-cabina-y-media",
    "pickup": "camioneta-cabina-y-media",
    "hatchback": "hatchback",
    "supermini": "hatchback",
    "subcompact car": "hatchback",
    "city car": "hatchback",
    "compact car": "hatchback",
    "sedan": "sedan",
    "saloon": "sedan",
    "mid-size car": "sedan",
    "full-size car": "sedan",
    "executive car": "sedan",
    "luxury vehicle": "sedan",
    "station wagon": "station-wagon",
    "estate car": "station-wagon",
    "shooting brake": "station-wagon",
    "convertible": "convertible",
    "roadster": "convertible",
    "cabriolet": "convertible",
    "minivan": "microbus-pasajeros",
    "minibus": "microbus-pasajeros",
    "van": "microbus-carga",
    "cargo van": "microbus-carga",
    "panel van": "microbus-carga",
    "light commercial vehicle": "microbus-carga",
    "truck": "camion-carga",
    "box truck": "camion-carga",
    "tractor unit": "cabezal",
    "semi-trailer truck": "cabezal",
}

WIKI_CATEGORY_TO_SLUG: dict[str, str] = {
    "category:sport utility vehicles": "suv",
    "category:crossover sport utility vehicles": "suv",
    "category:compact sport utility vehicles": "suv",
    "category:mid-size sport utility vehicles": "suv",
    "category:full-size sport utility vehicles": "suv",
    "category:pickup trucks": "camioneta-cabina-y-media",
    "category:full-size pickup trucks": "camioneta-cabina-y-media",
    "category:compact pickup trucks": "camioneta-cabina-y-media",
    "category:ford f-series": "camioneta-cabina-y-media",
    "category:chevrolet silverado": "camioneta-cabina-y-media",
    "category:hatchbacks": "hatchback",
    "category:superminis": "hatchback",
    "category:compact cars": "hatchback",
    "category:subcompact cars": "hatchback",
    "category:sedans": "sedan",
    "category:station wagons": "station-wagon",
    "category:convertibles": "convertible",
    "category:minivans": "microbus-pasajeros",
    "category:vans": "microbus-carga",
    "category:cargo vans": "microbus-carga",
    "category:trucks": "camion-carga",
}

# More specific markers win over generic ones (e.g. pickup before truck).
CATEGORY_MARKER_PRIORITY: list[tuple[str, str]] = [
    ("pickup", "camioneta-cabina-y-media"),
    ("f-series", "camioneta-cabina-y-media"),
    ("silverado", "camioneta-cabina-y-media"),
    ("sport utility", "suv"),
    ("suv", "suv"),
    ("crossover", "suv"),
    ("supermini", "hatchback"),
    ("hatchback", "hatchback"),
    ("subcompact", "hatchback"),
    ("compact car", "hatchback"),
    ("sedan", "sedan"),
    ("station wagon", "station-wagon"),
    ("convertible", "convertible"),
    ("minivan", "microbus-pasajeros"),
    ("minibus", "microbus-pasajeros"),
    ("cargo van", "microbus-carga"),
    ("panel van", "microbus-carga"),
    ("cabezal", "cabezal"),
    ("tractor", "cabezal"),
    ("truck", "camion-carga"),
]


def _norm(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def infer_slug_from_body_hints(hints: list[str]) -> tuple[str | None, str | None]:
    """Return (slug, best_matching_hint) from ordered hint strings."""
    for hint in hints:
        normalized = _norm(hint)
        if not normalized:
            continue
        if normalized in BODY_HINT_TO_SLUG:
            return BODY_HINT_TO_SLUG[normalized], hint
        for key, slug in BODY_HINT_TO_SLUG.items():
            if key in normalized or normalized in key:
                return slug, hint
    return None, None


async def wikipedia_search_titles(query: str, *, limit: int = 15) -> list[str]:
    headers = {"User-Agent": WIKI_USER_AGENT}
    params = {
        "action": "opensearch",
        "search": query,
        "limit": str(limit),
        "namespace": "0",
        "format": "json",
    }
    try:
        async with httpx.AsyncClient(timeout=20.0, headers=headers) as client:
            response = await client.get(WIKI_API, params=params)
            response.raise_for_status()
            payload = response.json()
            if isinstance(payload, list) and len(payload) >= 2:
                return [str(title).strip() for title in payload[1] if str(title).strip()]
    except Exception:
        return []
    return []


async def wikipedia_page_categories(title: str) -> list[str]:
    headers = {"User-Agent": WIKI_USER_AGENT}
    params = {
        "action": "query",
        "format": "json",
        "titles": title,
        "prop": "categories",
        "cllimit": "50",
        "redirects": "1",
    }
    categories: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=20.0, headers=headers) as client:
            response = await client.get(WIKI_API, params=params)
            response.raise_for_status()
            pages = response.json().get("query", {}).get("pages") or {}
            for page in pages.values():
                for row in page.get("categories") or []:
                    title_value = str(row.get("title") or "").strip()
                    if title_value:
                        categories.append(title_value)
    except Exception:
        return []
    return categories


async def wikipedia_page_extract(title: str) -> str:
    headers = {"User-Agent": WIKI_USER_AGENT}
    params = {
        "action": "query",
        "format": "json",
        "titles": title,
        "prop": "extracts",
        "exintro": "1",
        "explaintext": "1",
        "redirects": "1",
    }
    try:
        async with httpx.AsyncClient(timeout=20.0, headers=headers) as client:
            response = await client.get(WIKI_API, params=params)
            response.raise_for_status()
            pages = response.json().get("query", {}).get("pages") or {}
            for page in pages.values():
                return str(page.get("extract") or "").strip()
    except Exception:
        return ""
    return ""


async def wikipedia_wikibase_item(title: str) -> str | None:
    headers = {"User-Agent": WIKI_USER_AGENT}
    params = {
        "action": "query",
        "format": "json",
        "titles": title,
        "prop": "pageprops",
        "ppprop": "wikibase_item",
        "redirects": "1",
    }
    try:
        async with httpx.AsyncClient(timeout=20.0, headers=headers) as client:
            response = await client.get(WIKI_API, params=params)
            response.raise_for_status()
            pages = response.json().get("query", {}).get("pages") or {}
            for page in pages.values():
                item = str(page.get("pageprops", {}).get("wikibase_item") or "").strip()
                if item:
                    return item
    except Exception:
        return None
    return None


async def wikidata_types_for_item(item_id: str, *, limit: int = 12) -> list[str]:
    if not item_id:
        return []
    query = f"""
    SELECT ?typeLabel WHERE {{
      VALUES ?item {{ wd:{item_id} }}
      ?item wdt:P31/wdt:P279* ?type .
      ?type rdfs:label ?typeLabel .
      FILTER(LANG(?typeLabel) = "en")
    }}
    LIMIT {limit}
    """
    headers = {"User-Agent": WIKI_USER_AGENT}
    params = {"query": query, "format": "json"}
    labels: list[str] = []
    blocked = {"entity", "type", "work", "phenomenon", "information", "intangible good", "type of object", "good/s"}
    try:
        async with httpx.AsyncClient(timeout=25.0, headers=headers) as client:
            response = await client.get("https://query.wikidata.org/sparql", params=params)
            response.raise_for_status()
            bindings = response.json().get("results", {}).get("bindings") or []
            for row in bindings:
                label = str(row.get("typeLabel", {}).get("value") or "").strip()
                if label and label.lower() not in blocked and label not in labels:
                    labels.append(label)
    except Exception:
        return []
    return labels


async def wikidata_types_for_title(title: str, *, limit: int = 12) -> list[str]:
    item_id = await wikipedia_wikibase_item(title)
    if not item_id:
        return []
    return await wikidata_types_for_item(item_id, limit=limit)


async def google_cse_search_titles(query: str, *, limit: int = 8) -> list[str]:
    api_key = os.getenv("GOOGLE_CSE_API_KEY", "").strip()
    cx = os.getenv("GOOGLE_CSE_CX", "").strip()
    if not api_key or not cx:
        return []
    params = {
        "key": api_key,
        "cx": cx,
        "q": query,
        "num": str(max(1, min(limit, 10))),
        "safe": "active",
    }
    titles: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get("https://www.googleapis.com/customsearch/v1", params=params)
            response.raise_for_status()
            items = response.json().get("items") or []
            for item in items:
                title = str(item.get("title") or "").strip()
                if title:
                    titles.append(re.sub(r"\s*-\s*Wikipedia.*$", "", title, flags=re.I).strip())
    except Exception:
        return []
    return titles


def slug_from_wikipedia_categories(categories: list[str]) -> tuple[str | None, str | None]:
    normalized = [_norm(category) for category in categories if category]
    for category, key in zip(categories, normalized):
        if key in WIKI_CATEGORY_TO_SLUG:
            return WIKI_CATEGORY_TO_SLUG[key], category
    for marker, slug in CATEGORY_MARKER_PRIORITY:
        for category, key in zip(categories, normalized):
            if marker in key:
                return slug, category
    return None, None


async def _title_has_vehicle_metadata(title: str) -> bool:
    if not title:
        return False
    categories = await wikipedia_page_categories(title)
    if categories:
        return True
    extract = await wikipedia_page_extract(title)
    if len(extract) >= 40:
        return True
    types = await wikidata_types_for_title(title)
    vehicle_markers = ("car", "vehicle", "suv", "pickup", "truck", "van", "hatchback", "sedan", "wagon")
    return any(any(marker in label.lower() for marker in vehicle_markers) for label in types)


async def _resolve_wikipedia_title(brand: str, model_title: str) -> str:
    model_key = str(model_title or "").strip()
    if not model_key:
        return ""
    brand_key = str(brand or "").strip()
    candidates: list[str] = []
    if brand_key and brand_key.lower() not in model_key.lower():
        candidates.append(f"{brand_key.title()} {model_key}")
        candidates.append(f"{brand_key} {model_key}")
    candidates.append(model_key)

    for candidate in candidates:
        if await _title_has_vehicle_metadata(candidate):
            return candidate

    for query in candidates:
        for found in await wikipedia_search_titles(query, limit=6):
            if found not in candidates and await _title_has_vehicle_metadata(found):
                return found
    return candidates[0] if candidates else model_key


async def collect_web_body_hints(brand: str, model_title: str) -> dict[str, Any]:
    """Aggregate body-style hints for a model from public web sources."""
    brand_key = str(brand or "").strip()
    model_key = str(model_title or "").strip()
    hints: list[str] = []
    sources: list[str] = []
    categories: list[str] = []
    extract = ""
    resolved_title = model_key

    if model_key:
        resolved_title = await _resolve_wikipedia_title(brand_key, model_key)
        categories = await wikipedia_page_categories(resolved_title)
        if categories:
            sources.append("wikipedia_categories")
            hints.extend(categories)

        wikidata_types = await wikidata_types_for_title(resolved_title)
        if wikidata_types:
            sources.append("wikidata_types")
            hints.extend(wikidata_types)

        extract = await wikipedia_page_extract(resolved_title)
        if extract:
            sources.append("wikipedia_extract")
            first_sentence = extract.split(".", 1)[0]
            hints.append(first_sentence[:240])

    slug, matched_hint = infer_slug_from_body_hints(hints)
    if not slug and categories:
        slug, matched_hint = slug_from_wikipedia_categories(categories)

    return {
        "resolved_title": resolved_title,
        "body_hints": hints[:20],
        "categories": categories[:12],
        "extract_preview": extract[:280] if extract else "",
        "inferred_slug": slug,
        "matched_hint": matched_hint,
        "sources": list(dict.fromkeys(sources)),
    }


async def discover_model_titles_for_brand(brand: str, *, limit: int = 40) -> dict[str, Any]:
    """Search Wikipedia (and optional Google CSE) for model titles under a brand."""
    brand_key = str(brand or "").strip()
    if not brand_key:
        return {"titles": [], "sources": []}

    queries = [
        f"{brand_key} car",
        f"{brand_key} SUV",
        f"{brand_key} pickup",
        f"{brand_key} vehicle model",
    ]
    titles: list[str] = []
    sources: list[str] = []

    for query in queries:
        found = await wikipedia_search_titles(query, limit=12)
        if found:
            sources.append("wikipedia_search")
        for title in found:
            if title not in titles:
                titles.append(title)
        if len(titles) >= limit:
            break

    google_titles = await google_cse_search_titles(f"{brand_key} vehicle models site:wikipedia.org", limit=10)
    if google_titles:
        sources.append("google_cse")
        for title in google_titles:
            if title not in titles:
                titles.append(title)

    return {
        "titles": titles[:limit],
        "sources": list(dict.fromkeys(sources)),
    }