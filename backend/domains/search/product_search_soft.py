"""Soft product search helpers for GET /products?q= (aliases; light fuzzy is FE-only).

Catalog UI filters client-side via productLookup.js. This module only expands
known brand typos so server-side q=/search= regex still finds DLAA/DS18/FOX
when the caller types DLLA / DSS18 / FOOX.
"""
from __future__ import annotations

import re
from typing import Iterable, List

# Query token (lowercased) → additional spellings to OR into Mongo regexes.
# Prefer canonical catalog brands (DLAA, DS18, FOX).
SEARCH_TOKEN_ALIASES: dict[str, list[str]] = {
    "dlla": ["dlaa"],
    "dlaal": ["dlaa"],
    "dss18": ["ds18"],
    "ds018": ["ds18"],
    "foox": ["fox"],
    "foxx": ["fox"],
    "f0x": ["fox"],
    "foxs": ["fox"],
}


def normalize_search_input(value: str | None) -> str:
    """Lowercase + collapse spaced/hyphenated DS18 forms."""
    s = str(value or "").strip().lower()
    if not s:
        return ""
    # DSS18 / DS 18 / DS-18 / DS_18 → ds18
    s = re.sub(r"\bdss?\s*[-_]?\s*18\b", "ds18", s)
    return s


def tokenize_search_query(value: str | None) -> list[str]:
    normalized = normalize_search_input(value)
    if not normalized:
        return []
    return [t for t in normalized.split() if t]


def expand_search_token(token: str) -> list[str]:
    t = str(token or "").strip().lower()
    if not t:
        return []
    extras = SEARCH_TOKEN_ALIASES.get(t, [])
    # preserve order, unique
    seen: set[str] = set()
    out: list[str] = []
    for item in (t, *extras):
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def expand_search_terms(value: str | None) -> list[str]:
    """
    Expand a free-text q=/search= value into unique regex terms.

    - Multi-token queries: expand each token's aliases, then return the union
      of all variants (Mongo $or still does substring OR across fields; FE
      keeps AND semantics on the full catalog load).
    - Single-token: return token + aliases.
    """
    tokens = tokenize_search_query(value)
    if not tokens:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for token in tokens:
        for variant in expand_search_token(token):
            if variant not in seen:
                seen.add(variant)
                out.append(variant)
    return out


def build_product_search_or_clauses(search_term: str | None) -> list[dict]:
    """
    Build Mongo $or clauses for product text fields, OR-ing brand alias variants.

    Escapes regex metacharacters. Empty/whitespace input → [].
    """
    terms = expand_search_terms(search_term)
    if not terms:
        return []

    fields = ("name", "sku", "description", "brand", "barcode")
    clauses: list[dict] = []
    for term in terms:
        pattern = re.escape(term)
        for field in fields:
            clauses.append({field: {"$regex": pattern, "$options": "i"}})
    return clauses
