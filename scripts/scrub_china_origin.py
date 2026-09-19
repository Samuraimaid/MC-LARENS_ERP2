#!/usr/bin/env python3
"""
Scrub China origin from all local seed files and prepare report.
Tag: scrub_china_origin_20260919
"""

import json
import re
import os
import sys

SEED_FILE = os.path.join(os.path.dirname(__file__), "..", "backend", "data", "seeds", "all_catalogs_unified_seed.json")
REPORT_FILE = os.path.join(os.path.dirname(__file__), "reports", "SCRUB_CHINA_ORIGIN_20260919.json")
DOCS_REPORT_FILE = os.path.join(os.path.dirname(__file__), "..", "docs", "SCRUB_CHINA_ORIGIN_20260919.json")

CHINA_PATTERNS = [
    re.compile(r'detalles\s+r[aá]pidos\s+lugar\s+de\s+origen\s*:\s*guangdong[,\s]*china\b', re.IGNORECASE),
    re.compile(r'detalles\s+r[aá]pidos\s+lugar\s+de\s+origen\s*:\s*china\b', re.IGNORECASE),
    re.compile(r'detalles\s+r[aá]pidos\s+origen\s*:\s*guangdong[,\s]*china\b', re.IGNORECASE),
    re.compile(r'detalles\s+r[aá]pidos\s+origen\s*:\s*china\b', re.IGNORECASE),
    re.compile(r'lugar\s+de\s+origen\s*:\s*guangdong[,\s]*china\b', re.IGNORECASE),
    re.compile(r'lugar\s+de\s+origen\s*:\s*china\b', re.IGNORECASE),
    re.compile(r'origen\s*:\s*guangdong[,\s]*china\b', re.IGNORECASE),
    re.compile(r'origen\s*:\s*china\b', re.IGNORECASE),
    re.compile(r'place\s+of\s+origin\s*:\s*guangdong[,\s]*china\b', re.IGNORECASE),
    re.compile(r'place\s+of\s+origin\s*:\s*china\b', re.IGNORECASE),
    re.compile(r'country\s+of\s+origin\s*:\s*china\b', re.IGNORECASE),
    re.compile(r'made\s+in\s+china\b', re.IGNORECASE),
    re.compile(r'hecho\s+en\s+china\b', re.IGNORECASE),
    re.compile(r'fabricado\s+en\s+china\b', re.IGNORECASE),
    re.compile(r'guangdong[,\s]+china\b', re.IGNORECASE),
]

def clean_text_field(text):
    if not text or not isinstance(text, str):
        return text
    
    cleaned = text
    for pat in CHINA_PATTERNS:
        cleaned = pat.sub('', cleaned)
    
    # Clean up empty or dangling "Detalles rápidos" header
    cleaned = re.sub(r'^\s*detalles\s+r[aá]pidos[:\s-]*(?:\r?\n|$)', '', cleaned, flags=re.IGNORECASE | re.MULTILINE)
    cleaned = re.sub(r'detalles\s+r[aá]pidos[:\s-]*\n', '\n', cleaned, flags=re.IGNORECASE)
    
    # Clean empty lines and excessive spaces
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    cleaned = re.sub(r'[ \t]{2,}', ' ', cleaned)
    return cleaned.strip()

def clean_dict_or_list(obj):
    if isinstance(obj, dict):
        new_dict = {}
        for k, v in obj.items():
            if str(k).lower() in ["lugar de origen", "origen", "place of origin", "country of origin"]:
                # omit this key entirely if it mentions china or guangdong
                if isinstance(v, str) and any(word in v.lower() for word in ["china", "guangdong"]):
                    continue
            new_dict[k] = clean_dict_or_list(v)
        return new_dict
    elif isinstance(obj, list):
        return [clean_dict_or_list(item) for item in obj]
    elif isinstance(obj, str):
        return clean_text_field(obj)
    return obj

def scrub_seed_file():
    if not os.path.exists(SEED_FILE):
        print(f"Seed file not found: {SEED_FILE}")
        return
    
    with open(SEED_FILE, 'r', encoding='utf-8') as f:
        products = json.load(f)
    
    total = len(products)
    modified_count = 0
    samples = []
    
    for idx, prod in enumerate(products):
        orig_desc = prod.get("description", "")
        orig_specs = prod.get("specifications", {})
        
        has_china_before = False
        if isinstance(orig_desc, str) and ("china" in orig_desc.lower() or "guangdong" in orig_desc.lower()):
            has_china_before = True
        if str(orig_specs).lower().find("china") != -1 or str(orig_specs).lower().find("guangdong") != -1:
            has_china_before = True
            
        cleaned_prod = clean_dict_or_list(prod)
        
        # Add tag if modified
        if has_china_before:
            modified_count += 1
            tags = cleaned_prod.get("tags") or []
            if isinstance(tags, list):
                if "scrub_china_origin_20260919" not in tags:
                    tags.append("scrub_china_origin_20260919")
                cleaned_prod["tags"] = tags
            
            if len(samples) < 10:
                samples.append({
                    "product_id": prod.get("product_id"),
                    "sku": prod.get("sku"),
                    "name": prod.get("name"),
                    "before_description": orig_desc[:120] + ("..." if len(orig_desc) > 120 else ""),
                    "after_description": cleaned_prod.get("description", "")[:120] + ("..." if len(cleaned_prod.get("description", "")) > 120 else ""),
                })
        
        products[idx] = cleaned_prod
    
    with open(SEED_FILE, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    
    report = {
        "timestamp": "2026-09-19T08:25:00-06:00",
        "tag": "scrub_china_origin_20260919",
        "total_products_checked": total,
        "products_modified": modified_count,
        "samples": samples
    }
    
    os.makedirs(os.path.dirname(REPORT_FILE), exist_ok=True)
    with open(REPORT_FILE, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        
    os.makedirs(os.path.dirname(DOCS_REPORT_FILE), exist_ok=True)
    with open(DOCS_REPORT_FILE, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        
    print(f"Scrubbed {modified_count} / {total} products in {SEED_FILE}")
    print(f"Report saved to {REPORT_FILE} and {DOCS_REPORT_FILE}")

if __name__ == "__main__":
    scrub_seed_file()
