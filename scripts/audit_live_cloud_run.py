import urllib.request
import re

def main():
    base_url = "https://mclarens-erp-836176703716.us-central1.run.app"
    url = f"{base_url}/"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode("utf-8")
        print("HTML content:\n", html)
        scripts = re.findall(r'src=["\']([^"\']+)["\']', html)
        print("\nReferenced scripts:", scripts)

    for s in scripts:
        s_url = f"{base_url}{s}" if s.startswith("/") else s
        try:
            s_req = urllib.request.Request(s_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(s_req) as s_resp:
                content = s_resp.read().decode("utf-8", errors="ignore")
                print(f"\n--- SCRIPT {s} ({len(content)} bytes) ---")
                has_brand_mosaic = "BrandMosaic" in content or "DS18" in content or "FOX Shox" in content
                has_tacho = "Tachometer" in content or "tacometro" in content
                print(f"Has BrandMosaic/DS18: {has_brand_mosaic}")
                print(f"Has Tachometer: {has_tacho}")
        except Exception as e:
            print(f"Error reading {s_url}: {e}")

    # Also test checking /brands/ds18.png directly
    brand_urls = [
        f"{base_url}/brands/ds18.png",
        f"{base_url}/brands/fox.png",
        f"{base_url}/brands/pioneer.jpg",
        f"{base_url}/api/health",
        f"{base_url}/api/"
    ]
    print("\n--- CHECKING BRAND ASSETS ON LIVE SERVER ---")
    for b_url in brand_urls:
        try:
            b_req = urllib.request.Request(b_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(b_req) as b_resp:
                print(f"{b_url} -> Status {b_resp.status}, Content-Type: {b_resp.headers.get('Content-Type')}, Size: {len(b_resp.read())} bytes")
        except Exception as e:
            print(f"{b_url} -> Error: {e}")

if __name__ == "__main__":
    main()
