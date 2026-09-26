#!/usr/bin/env python3
"""
McLarens ERP - Catalog QA Audit Tool (Read-Only)
=================================================

Performs a read-only audit of catalog products to detect data hygiene issues:
missing images, OCR garbage in names, excessively short names, and names
lacking brand/SKU context.

Endpoint Details:
-----------------
Frontend Reference:
  File: frontend/src/pages/CatalogPage.jsx (line 366)
  Call: axios.get(`${API}/products?limit=10000`, { withCredentials: true })
  where API = window.__ENV__?.VITE_API_BASE_URL || "/api"

Backend Reference:
  File: backend/server.py (line 7038)
  Route: @api_router.get("/products") -> /api/products
  Auth Requirement: await require_auth(request)
    - Cookie: session_token=<token>
    - Header: Authorization: Bearer <token>
    * Note: The script runs without auth if the listing is open or proxied;
      if 401 is returned, pass --token or --cookie (never hardcode PINs).

CSV Output Columns:
-------------------
sku, name, brand, has_image, name_len, flags

Flags:
  no_image              - Product has no image, null, whitespace, or Unsplash placeholder
  name_ocr_garbage      - Repetitive text (e.g. 'A CON A RE'), raw price dumps, hex/base64 blobs,
                          supplier metadata, high single-letter token ratio, or name > 95 chars
  name_too_short        - Name length < 4 characters or empty
  name_unrelated_tokens - Name contains neither the brand nor the SKU
"""

import argparse
import csv
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Set, Tuple

# Known supplier origin / OCR metadata patterns to detect as garbage
GARBAGE_PATTERNS = [
    re.compile(r"detalles\s+r[aá]pidos", re.I),
    re.compile(r"lugar\s+de\s+origen", re.I),
    re.compile(r"place\s+of\s+origin", re.I),
    re.compile(r"country\s+of\s+origin", re.I),
    re.compile(r"guangdong[,\s]+china", re.I),
    re.compile(r"made\s+in\s+china", re.I),
    re.compile(r"fabricado\s+en\s+china", re.I),
    re.compile(r"hecho\s+en\s+china", re.I),
    re.compile(r"\braw\s*=\s*[^;\n]*\bval\s*=\s*", re.I),
    re.compile(r"\b(catalog_batch|source_sites|price_note)\s*[:=]", re.I),
]

# Patterns for repeated phrase tokens typical of OCR scanning loops (e.g., "A CON A RE", "CON A CON", "DE CON DE")
REPEATED_PHRASE_PATTERNS = [
    re.compile(r"\b([A-Za-z]{1,4})\s+CON\s+\1\b", re.I),
    re.compile(r"\b([A-Za-z]{1,4})\s+DE\s+\1\b", re.I),
    re.compile(r"\b([A-Za-z]{1,4})\s+A\s+\1\b", re.I),
    re.compile(r"\b([A-Za-z]{2,})\s+\1\s+\1\b", re.I),  # 3 consecutive identical words
]

GENERIC_BRANDS: Set[str] = {
    "",
    "n/a",
    "na",
    "none",
    "generico",
    "genérico",
    "universal",
    "varios",
    "mclarens",
    "mc-larens",
    "desconocido",
}


def normalize_str(val: Any) -> str:
    """Strip, lowercase, and remove diacritics for uniform matching."""
    if not val:
        return ""
    text = str(val).strip()
    norm = unicodedata.normalize("NFD", text)
    return "".join(c for c in norm if unicodedata.category(c) != "Mn").lower()


def has_valid_image(product: Dict[str, Any]) -> bool:
    """
    Evaluates whether product contains a non-placeholder image.
    Matches frontend logic in frontend/src/lib/productImage.js:
      - Filters out empty/whitespace
      - Filters out images.unsplash.com placeholders
    """
    candidates = []

    # Check images array (strings or dicts)
    images_field = product.get("images")
    if isinstance(images_field, list):
        for img in images_field:
            if isinstance(img, str) and img.strip():
                candidates.append(img.strip())
            elif isinstance(img, dict):
                url = img.get("url") or img.get("gcs_url")
                if isinstance(url, str) and url.strip():
                    candidates.append(url.strip())

    # Check scalar image fields
    for field in ("image_url", "image", "media_url", "gcs_url"):
        val = product.get(field)
        if isinstance(val, str) and val.strip():
            candidates.append(val.strip())

    for u in candidates:
        if "images.unsplash.com" in u:
            continue
        if u.startswith("http://") or u.startswith("https://") or u.startswith("/"):
            return True
        if len(u) > 3:  # Valid relative path or filename
            return True

    return False


def is_name_ocr_garbage(name: str) -> Tuple[bool, List[str]]:
    """
    Heuristics for OCR scanning garbage:
    1. Excessively long names (e.g. whole scan paragraph dumped into title).
    2. Repetitions like 'A CON A RE', 'CON A CON', or repeated words.
    3. High proportion of broken/single-letter tokens.
    4. Supplier metadata / origin strings / price dump strings.
    5. Hex blobs / base64 blobs / corrupted characters.
    """
    reasons = []
    trimmed = name.strip()
    norm = normalize_str(trimmed)
    tokens = re.findall(r"[a-z0-9]+", norm)

    # 1. Excessively long title
    if len(trimmed) > 95 or len(tokens) > 16:
        reasons.append(f"long_title({len(trimmed)}c,{len(tokens)}words)")

    # 2. Origin/metadata patterns
    for pat in GARBAGE_PATTERNS:
        if pat.search(trimmed):
            reasons.append(f"metadata_artifact({pat.pattern})")
            break

    # 3. Repeated phrase / looping OCR tokens
    for pat in REPEATED_PHRASE_PATTERNS:
        if pat.search(trimmed):
            reasons.append("repeated_phrase_loop")
            break

    # High frequency repetition of same word (e.g. 'purpura del purpura de purpura')
    if len(tokens) >= 5:
        counts = {}
        for w in tokens:
            if len(w) >= 3:
                counts[w] = counts.get(w, 0) + 1
        if counts:
            max_w, max_cnt = max(counts.items(), key=lambda x: x[1])
            if max_cnt >= 3 and (max_cnt / len(tokens)) >= 0.35:
                reasons.append(f"word_repetition({max_w}:{max_cnt})")

    # 4. Broken tokens / High ratio of 1-letter tokens
    single_char_tokens = [t for t in tokens if len(t) == 1]
    if len(tokens) >= 4 and len(single_char_tokens) >= 3:
        if (len(single_char_tokens) / len(tokens)) >= 0.28:
            reasons.append(f"broken_single_char_tokens({len(single_char_tokens)}/{len(tokens)})")

    # 5. Hex / base64 blob check
    compact = re.sub(r"\s+", "", trimmed)
    if len(compact) >= 40:
        hex_match = len(re.findall(r"[0-9a-fA-F]", compact))
        if hex_match / len(compact) >= 0.90:
            reasons.append("hex_blob")

    # 6. Weird punctuation / scanning noise
    if re.search(r"[\^~\\\|]{2,}|\.\.\.\.+|___+|####+", trimmed):
        reasons.append("scanning_noise_symbols")

    return (len(reasons) > 0, reasons)


def is_name_unrelated_tokens(name: str, brand: str, sku: str) -> bool:
    """
    Checks if the name fails to contain either the brand or the SKU.
    Normalized token search:
      - Brand check: if brand is non-generic, checks if brand or any brand token (>=3 chars) is in name.
      - SKU check: checks if sku or core alphanumeric model identifier is in name.
    """
    norm_name = normalize_str(name)
    norm_brand = normalize_str(brand)
    norm_sku = normalize_str(sku)

    # If both brand and sku are empty or missing, cannot evaluate relation
    if not norm_brand and not norm_sku:
        return False

    brand_matched = False
    if norm_brand and norm_brand not in GENERIC_BRANDS:
        # Check full brand name
        if norm_brand in norm_name:
            brand_matched = True
        else:
            # Check brand sub-tokens (e.g. 'Toyota Motor' -> 'toyota')
            brand_words = [w for w in re.split(r"[^a-z0-9]+", norm_brand) if len(w) >= 3]
            if any(w in norm_name for w in brand_words):
                brand_matched = True

    sku_matched = False
    if norm_sku:
        clean_sku = re.sub(r"[^a-z0-9]", "", norm_sku)
        clean_name = re.sub(r"[^a-z0-9]", "", norm_name)
        if norm_sku in norm_name or (len(clean_sku) >= 4 and clean_sku in clean_name):
            sku_matched = True
        else:
            # Split SKU parts by hyphens/underscores (e.g., 'DLAA-TY-01' -> '01', 'ty-01')
            sku_parts = [p for p in re.split(r"[^a-z0-9]+", norm_sku) if len(p) >= 3]
            # Exclude very generic SKU category prefixes
            filtered_parts = [p for p in sku_parts if p not in {"pol", "pck", "acc", "dlaa", "led", "com"}]
            if filtered_parts and any(p in norm_name for p in filtered_parts):
                sku_matched = True

    # If neither brand nor SKU was matched in the product name
    return not (brand_matched or sku_matched)


def audit_product(product: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluates all audit criteria for a single product document."""
    sku = str(product.get("sku") or product.get("product_id") or "").strip()
    name = str(product.get("name") or "").strip()
    brand = str(product.get("brand") or "").strip()
    name_len = len(name)

    has_img = has_valid_image(product)
    flags: List[str] = []

    if not has_img:
        flags.append("no_image")

    if name_len < 4:
        flags.append("name_too_short")

    is_garbage, _reasons = is_name_ocr_garbage(name)
    if is_garbage:
        flags.append("name_ocr_garbage")

    # Only test unrelated tokens if the name is not already flagged as too short
    if name_len >= 4 and is_name_unrelated_tokens(name, brand, sku):
        flags.append("name_unrelated_tokens")

    return {
        "sku": sku,
        "name": name,
        "brand": brand,
        "has_image": "true" if has_img else "false",
        "name_len": name_len,
        "flags": "|".join(flags),
    }


def fetch_products_from_api(
    base_url: str,
    endpoint: str = "/api/products",
    limit: int = 10000,
    token: Optional[str] = None,
    cookie: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetches product catalog from the backend API.
    Handles authentication via Bearer token or session_token cookie.
    """
    clean_base = base_url.rstrip("/")
    clean_endpoint = endpoint if endpoint.startswith("/") else f"/{endpoint}"
    separator = "&" if "?" in clean_endpoint else "?"
    url = f"{clean_base}{clean_endpoint}{separator}limit={limit}"

    headers = {
        "User-Agent": "McLarens-ERP-CatalogAudit/1.0",
        "Accept": "application/json",
    }

    if token:
        headers["Authorization"] = f"Bearer {token.strip()}"
    if cookie:
        cookie_val = cookie.strip()
        if not cookie_val.startswith("session_token="):
            cookie_val = f"session_token={cookie_val}"
        headers["Cookie"] = cookie_val

    req = urllib.request.Request(url, headers=headers)
    print(f"Connecting to: {url} ...", file=sys.stderr)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read().decode("utf-8")
            parsed = json.loads(data)
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, dict) and "products" in parsed:
                return parsed["products"]
            if isinstance(parsed, dict) and "data" in parsed and isinstance(parsed["data"], list):
                return parsed["data"]
            print(f"Unexpected JSON structure from {url}: {type(parsed)}", file=sys.stderr)
            return []
    except urllib.error.HTTPError as err:
        if err.code == 401:
            print(
                "\n[401 Unauthorized] The products listing requires authentication.",
                file=sys.stderr,
            )
            print("Please provide a valid session token via:", file=sys.stderr)
            print("  --token <SESSION_TOKEN>             (Sent in Authorization: Bearer)", file=sys.stderr)
            print("  --cookie 'session_token=<TOKEN>'   (Sent in Cookie header)", file=sys.stderr)
            print("  or set the environment variable: SESSION_TOKEN=<TOKEN>", file=sys.stderr)
            print("  (Note: Do NOT hardcode PINs or commit credentials.)\n", file=sys.stderr)
            print("Alternatively, you can export the products JSON from DevTools and run:", file=sys.stderr)
            print("  python scripts/catalog_qa_audit.py --file <path_to_exported.json>\n", file=sys.stderr)
        else:
            print(f"HTTP Error {err.code}: {err.reason}", file=sys.stderr)
        raise
    except urllib.error.URLError as err:
        print(f"Connection error: {err.reason}", file=sys.stderr)
        raise


def run_self_test() -> int:
    """Runs a suite of deterministic test cases validating all heuristics."""
    print("Running Catalog QA Audit Heuristic Test Suite...", file=sys.stderr)
    test_cases = [
        # 1. Clean product
        {
            "doc": {
                "sku": "TY-COR-001",
                "name": "Toyota Corolla Halogeno TY-COR-001",
                "brand": "Toyota",
                "image_url": "https://storage.googleapis.com/mclarens-erp-products/products/corolla.jpg",
            },
            "expected_flags": "",
            "expected_img": "true",
        },
        # 2. Missing image
        {
            "doc": {
                "sku": "ACC-002",
                "name": "Toyota Yaris Neblinera DLAA",
                "brand": "Toyota",
                "images": [],
            },
            "expected_flags": "no_image",
            "expected_img": "false",
        },
        # 3. Unsplash placeholder image -> should count as no image
        {
            "doc": {
                "sku": "ACC-003",
                "name": "Nissan Sentra Halogeno",
                "brand": "Nissan",
                "image_url": "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd",
            },
            "expected_flags": "no_image",
            "expected_img": "false",
        },
        # 4. Name too short
        {
            "doc": {
                "sku": "FOO-1",
                "name": "LED",
                "brand": "Toyota",
                "image_url": "https://cdn.example.com/item.jpg",
            },
            "expected_flags": "name_too_short",
            "expected_img": "true",
        },
        # 5. OCR Garbage (repetitive phrase loop 'A CON A RE')
        {
            "doc": {
                "sku": "DLAA-01",
                "name": "DLAA HALOGENO A CON A RE LUGAR DE ORIGEN GUANGDONG CHINA",
                "brand": "DLAA",
                "image_url": "https://cdn.example.com/item.jpg",
            },
            "expected_flags": "name_ocr_garbage",
            "expected_img": "true",
        },
        # 6. OCR Garbage (excessive length + origin metadata)
        {
            "doc": {
                "sku": "SCAN-99",
                "name": "DLAA SCAN-99 Detalles Rapidos Lugar de Origen Guangdong China Fabricado en China Halogeno Auto Lampara Delantera Bombillo Para Carro",
                "brand": "DLAA",
                "images": ["/uploads/products/scan.jpg"],
            },
            "expected_flags": "name_ocr_garbage",
            "expected_img": "true",
        },
        # 7. Unrelated tokens (name has neither brand 'Brembo' nor SKU 'BRK-990')
        {
            "doc": {
                "sku": "BRK-990",
                "name": "Pastillas de freno delanteras ceramicas alta duracion",
                "brand": "Brembo",
                "images": ["https://cdn.example.com/pad.jpg"],
            },
            "expected_flags": "name_unrelated_tokens",
            "expected_img": "true",
        },
        # 8. Multiple flags: No image + OCR Garbage + Unrelated tokens
        {
            "doc": {
                "sku": "SPK-001",
                "name": "A CON A RE DETALLES RAPIDOS PARLANTE COAXIAL 6 PULGADAS",
                "brand": "Pioneer",
            },
            "expected_flags": "no_image|name_ocr_garbage|name_unrelated_tokens",
            "expected_img": "false",
        },
    ]

    passed = 0
    for idx, tc in enumerate(test_cases, 1):
        res = audit_product(tc["doc"])
        if res["flags"] == tc["expected_flags"] and res["has_image"] == tc["expected_img"]:
            passed += 1
        else:
            print(f"  [FAIL] Test {idx}:", file=sys.stderr)
            print(f"    Expected: flags='{tc['expected_flags']}', img={tc['expected_img']}", file=sys.stderr)
            print(f"    Got:      flags='{res['flags']}', img={res['has_image']}", file=sys.stderr)
            print(f"    Doc:      {tc['doc']}", file=sys.stderr)

    print(f"Result: {passed}/{len(test_cases)} tests passed.\n", file=sys.stderr)
    return 0 if passed == len(test_cases) else 1


def main():
    parser = argparse.ArgumentParser(
        description="McLarens ERP - Catalog QA Audit (Generates CSV with product flags)"
    )
    parser.add_argument(
        "--base",
        default=os.environ.get("ERP_BASE_URL", "https://mclarens-erp-836176703716.us-central1.run.app"),
        help="Base URL of McLarens ERP backend (default: https://mclarens-erp-836176703716.us-central1.run.app)",
    )
    parser.add_argument(
        "--endpoint",
        default="/api/products",
        help="Product listing endpoint (default: /api/products)",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("SESSION_TOKEN") or os.environ.get("AUTH_TOKEN"),
        help="Session token for Authorization: Bearer <token>",
    )
    parser.add_argument(
        "--cookie",
        default=os.environ.get("SESSION_COOKIE"),
        help="Cookie string, e.g. 'session_token=<TOKEN>'",
    )
    parser.add_argument(
        "--file",
        help="Path to local JSON file containing product list (offline / debug mode)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10000,
        help="Maximum products to fetch (default: 10000)",
    )
    parser.add_argument(
        "--out",
        default="catalog_qa_audit.csv",
        help="Path for output CSV file (default: catalog_qa_audit.csv, use '-' for stdout)",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run deterministic heuristic unit tests and exit",
    )

    args = parser.parse_args()

    if args.test:
        sys.exit(run_self_test())

    products: List[Dict[str, Any]] = []

    if args.file:
        print(f"Loading products from local file: {args.file} ...", file=sys.stderr)
        with open(args.file, "r", encoding="utf-8") as f:
            raw = json.load(f)
            if isinstance(raw, list):
                products = raw
            elif isinstance(raw, dict) and "products" in raw:
                products = raw["products"]
            else:
                products = [raw]
    else:
        try:
            products = fetch_products_from_api(
                base_url=args.base,
                endpoint=args.endpoint,
                limit=args.limit,
                token=args.token,
                cookie=args.cookie,
            )
        except Exception:
            sys.exit(1)

    print(f"Processing {len(products)} products through QA heuristics...", file=sys.stderr)

    fieldnames = ["sku", "name", "brand", "has_image", "name_len", "flags"]
    rows = [audit_product(p) for p in products]

    # Write CSV
    if args.out == "-":
        writer = csv.DictWriter(sys.stdout, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    else:
        out_path = args.out
        # Ensure parent directory exists if specified
        parent_dir = os.path.dirname(out_path)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)

        with open(out_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f"Report written to: {out_path}", file=sys.stderr)

    # Print summary metrics to stderr
    total = len(rows)
    no_img_cnt = sum(1 for r in rows if "no_image" in r["flags"])
    garbage_cnt = sum(1 for r in rows if "name_ocr_garbage" in r["flags"])
    too_short_cnt = sum(1 for r in rows if "name_too_short" in r["flags"])
    unrelated_cnt = sum(1 for r in rows if "name_unrelated_tokens" in r["flags"])
    clean_cnt = sum(1 for r in rows if not r["flags"])

    print("\n--- QA Audit Summary ---", file=sys.stderr)
    print(f"Total Products Audited: {total}", file=sys.stderr)
    print(f"Clean (No Flags):       {clean_cnt} ({clean_cnt/total*100:.1f}%)" if total else "Clean: 0", file=sys.stderr)
    print(f"Flag [no_image]:        {no_img_cnt} ({no_img_cnt/total*100:.1f}%)" if total else "no_image: 0", file=sys.stderr)
    print(f"Flag [name_ocr_garbage]: {garbage_cnt} ({garbage_cnt/total*100:.1f}%)" if total else "name_ocr_garbage: 0", file=sys.stderr)
    print(f"Flag [name_too_short]:  {too_short_cnt} ({too_short_cnt/total*100:.1f}%)" if total else "name_too_short: 0", file=sys.stderr)
    print(f"Flag [name_unrelated_tokens]: {unrelated_cnt} ({unrelated_cnt/total*100:.1f}%)" if total else "name_unrelated_tokens: 0", file=sys.stderr)
    print("------------------------\n", file=sys.stderr)


if __name__ == "__main__":
    main()
