#!/usr/bin/env python3
"""
Scrub China origin from live ERP catalog products via HTTP API.
Target: https://mclarens-erp-836176703716.us-central1.run.app
Tag: scrub_china_origin_20260919
"""

import json
import re
import os
import sys
import urllib.request
import urllib.error
import ssl

API_URL = os.environ.get("ERP_API_URL", "https://mclarens-erp-836176703716.us-central1.run.app/api")
GERENCIA_PIN = os.environ.get("GERENCIA_PIN", "4729")
REPORT_FILE = os.path.join(os.path.dirname(__file__), "reports", "SCRUB_CHINA_ORIGIN_LIVE_20260919.json")
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
                if isinstance(v, str) and any(word in v.lower() for word in ["china", "guangdong"]):
                    continue
            new_dict[k] = clean_dict_or_list(v)
        return new_dict
    elif isinstance(obj, list):
        return [clean_dict_or_list(item) for item in obj]
    elif isinstance(obj, str):
        return clean_text_field(obj)
    return obj

def http_json_request(url, method="GET", data=None, headers=None):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    req_headers = {"User-Agent": "AntigravityScrub/1.0"}
    if headers:
        req_headers.update(headers)
    
    encoded_data = None
    if data is not None:
        encoded_data = json.dumps(data).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    
    req = urllib.request.Request(url, data=encoded_data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"error": body}
    except Exception as e:
        return 0, {"error": str(e)}

def main():
    print(f"Connecting to live API: {API_URL}")
    
    # 1. Login with Gerencia PIN to get session cookie/token if required
    login_url = f"{API_URL}/users/pin-login"
    status, login_res = http_json_request(login_url, method="POST", data={"pin": GERENCIA_PIN})
    print(f"PIN Login status: {status} -> {login_res.get('user', {}).get('name', 'User')}")
    
    auth_headers = {}
    token = login_res.get("token") or login_res.get("access_token")
    if token:
        auth_headers["Authorization"] = f"Bearer {token}"
        
    # 2. Fetch all products
    products_url = f"{API_URL}/products?limit=10000"
    status, products = http_json_request(products_url, method="GET", headers=auth_headers)
    if not isinstance(products, list):
        print(f"Failed to fetch products list: {products}")
        return
    
    total = len(products)
    print(f"Total live products fetched: {total}")
    
    modified_count = 0
    success_put_count = 0
    failed_put_count = 0
    samples = []
    
    for prod in products:
        prod_id = prod.get("product_id") or prod.get("id") or prod.get("_id")
        orig_desc = prod.get("description", "")
        orig_specs = prod.get("specifications", {})
        
        has_china_before = False
        if isinstance(orig_desc, str) and ("china" in orig_desc.lower() or "guangdong" in orig_desc.lower()):
            has_china_before = True
        if str(orig_specs).lower().find("china") != -1 or str(orig_specs).lower().find("guangdong") != -1:
            has_china_before = True
            
        if not has_china_before:
            continue
            
        modified_count += 1
        cleaned_prod = clean_dict_or_list(prod)
        
        tags = cleaned_prod.get("tags") or []
        if isinstance(tags, list):
            if "scrub_china_origin_20260919" not in tags:
                tags.append("scrub_china_origin_20260919")
            cleaned_prod["tags"] = tags
            
        if len(samples) < 10:
            samples.append({
                "product_id": prod_id,
                "sku": prod.get("sku"),
                "name": prod.get("name"),
                "before_description": orig_desc[:120] + ("..." if len(orig_desc) > 120 else ""),
                "after_description": cleaned_prod.get("description", "")[:120] + ("..." if len(cleaned_prod.get("description", "")) > 120 else ""),
            })
            
        # Send PUT update
        put_url = f"{API_URL}/products/{prod_id}"
        put_status, put_res = http_json_request(put_url, method="PUT", data=cleaned_prod, headers=auth_headers)
        if put_status in [200, 201, 204]:
            success_put_count += 1
        else:
            failed_put_count += 1
            print(f"PUT failed for {prod_id} ({put_status}): {put_res}")
            
    print(f"\nScrub Summary:")
    print(f"  Total Checked: {total}")
    print(f"  Products with China Origin: {modified_count}")
    print(f"  Successful PUT updates: {success_put_count}")
    print(f"  Failed PUT updates: {failed_put_count}")
    
    report = {
        "timestamp": "2026-09-19T08:25:00-06:00",
        "tag": "scrub_china_origin_20260919",
        "api_url": API_URL,
        "total_products_checked": total,
        "products_with_china_origin": modified_count,
        "successful_updates": success_put_count,
        "failed_updates": failed_put_count,
        "samples": samples
    }
    
    os.makedirs(os.path.dirname(REPORT_FILE), exist_ok=True)
    with open(REPORT_FILE, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        
    os.makedirs(os.path.dirname(DOCS_REPORT_FILE), exist_ok=True)
    with open(DOCS_REPORT_FILE, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        
    print(f"Saved reports to {REPORT_FILE} and {DOCS_REPORT_FILE}")

if __name__ == "__main__":
    main()
