import urllib.request
import urllib.parse
import re
import json
import ssl
import sys

# Force UTF-8 output encoding for Windows command prompt
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE_URL = 'https://mclarens-erp-836176703716.us-central1.run.app'
GCS_CDN_BASE = 'https://storage.googleapis.com/mclarens-erp-vehicles'

def test_url(url, method='GET', data=None, headers=None):
    hdrs = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=12) as resp:
            content = resp.read()
            return resp.status, resp.headers, content
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read()
    except Exception as e:
        return 0, {}, str(e).encode('utf-8')

print("=" * 70)
print(f"[AUDITORIA EN VIVO] Destino: {BASE_URL}")
print("=" * 70)

# 1. Test HTML Shell & SPA Routing
print("\n[1/5] Verificando Shell HTML y Enrutamiento SPA:")
for path in ['/', '/login', '/ventas', '/taller', '/inventario', '/configuracion']:
    status, hdrs, body = test_url(BASE_URL + path)
    ctype = hdrs.get('Content-Type', '')
    if status == 200 and 'text/html' in ctype:
        print(f"  [OK] {path} -> HTTP 200 ({len(body)} bytes, HTML Shell activo)")
    else:
        print(f"  [FAIL] {path} -> HTTP {status} ({ctype})")

# 2. Extract and Validate all Bundled JS & CSS Assets
print("\n[2/5] Verificando Integridad de Bundles JS y CSS (Nginx / Vite):")
status, hdrs, body = test_url(BASE_URL + '/login')
html_text = body.decode('utf-8', errors='ignore')

script_matches = re.findall(r'src=["\']([^"\']+)["\']', html_text)
link_matches = re.findall(r'href=["\']([^"\']+)["\']', html_text)
assets = [a for a in script_matches + link_matches if a.startswith('/assets/') or 'index' in a]

for asset in assets:
    full_url = BASE_URL + asset if asset.startswith('/') else BASE_URL + '/' + asset
    astatus, ahdrs, abody = test_url(full_url)
    actype = ahdrs.get('Content-Type', '')
    if astatus == 200:
        print(f"  [OK] Asset {asset} -> HTTP 200 ({actype}, {len(abody)} bytes)")
    else:
        print(f"  [FAIL] Asset {asset} -> HTTP {astatus}")

# 3. Test Backend APIs
print("\n[3/5] Verificando Endpoints Backend FastAPI:")
api_tests = [
    ('/api/', 'GET', None, 'Root API ping'),
    ('/api/vehicle-thumbnails/manifest', 'GET', None, 'Manifest de miniaturas'),
    ('/api/auth/login', 'POST', json.dumps({'pin': '0101'}).encode('utf-8'), 'Login con PIN 0101 (JSON)', {'Content-Type': 'application/json'}),
    ('/api/auth/login', 'POST', json.dumps({'pin': '01011990'}).encode('utf-8'), 'Login con PIN 01011990 (JSON)', {'Content-Type': 'application/json'}),
    ('/api/auth/login', 'POST', json.dumps({'email': 'xinon@local', 'pin': '0101'}).encode('utf-8'), 'Login con email+PIN', {'Content-Type': 'application/json'}),
]

for item in api_tests:
    ep, meth, data, desc = item[0], item[1], item[2], item[3]
    h = item[4] if len(item) > 4 else None
    st, hd, bd = test_url(BASE_URL + ep, method=meth, data=data, headers=h)
    bd_str = bd.decode('utf-8', errors='ignore')[:120].replace('\n', ' ')
    if st in (200, 201):
        print(f"  [OK] {desc} ({ep}) -> HTTP {st}: {bd_str}")
    elif st in (401, 403, 422):
        print(f"  [INFO] {desc} ({ep}) -> HTTP {st} (Auth/Val esperado): {bd_str}")
    else:
        print(f"  [FAIL] {desc} ({ep}) -> HTTP {st}: {bd_str}")

# 4. Test Google Cloud Storage CDN Silhouettes (Toyota 98 Items & Nissan 102 Items)
print("\n[4/5] Verificando Siluetas Tecnicas en Google Cloud Storage CDN (gs://mclarens-erp-vehicles):")

# Toyota audit
with open('scripts/grok_toyota_catalog_prompts.json', 'r', encoding='utf-8') as f:
    toyota_data = json.load(f)
tasks = toyota_data.get('tasks', [])
sample_ids = [1, 2, 7, 8, 25, 26, 45, 57, 63, 69, 75, 85, 93, 97]
print("  --- Muestreo TOYOTA (98 modelos totales) ---")
for item in tasks:
    if item['id'] in sample_ids:
        fn = item['filename']
        cdn_url = f"{GCS_CDN_BASE}/models/toyota/{fn}"
        st, hd, bd = test_url(cdn_url)
        if st == 200 and len(bd) > 3000:
            print(f"  [OK] Toyota [ID {item['id']:02d}] {item['model']} ({item['view']}) -> HTTP 200 ({len(bd):,} bytes)")
        else:
            print(f"  [AVISO/PENDIENTE EN GCS] Toyota [ID {item['id']:02d}] {fn} -> HTTP {st}")

# Nissan audit
with open('scripts/grok_nissan_catalog_prompts.json', 'r', encoding='utf-8') as f:
    nissan_data = json.load(f)
nissan_tasks = nissan_data.get('tasks', [])
nissan_sample_ids = [1, 2, 7, 8, 13, 19, 23, 27, 33, 43, 51, 57, 63, 73, 81, 91, 97]
print("\n  --- Muestreo NISSAN (102 modelos totales) ---")
for item in nissan_tasks:
    if item['id'] in nissan_sample_ids:
        fn = item['filename']
        cdn_url = f"{GCS_CDN_BASE}/models/nissan/{fn}"
        st, hd, bd = test_url(cdn_url)
        if st == 200 and len(bd) > 3000:
            print(f"  [OK] Nissan [ID {item['id']:02d}] {item['model']} ({item['view']}) -> HTTP 200 ({len(bd):,} bytes)")
        else:
            print(f"  [PENDIENTE SUBIR A GCS] Nissan [ID {item['id']:02d}] {fn} -> HTTP {st} (Requiere sync a Cloud Storage)")

# 5. Check White-Screen / Bundle Crash Risks
print("\n[5/5] Analizando scripts y bundle en busca de errores fatales de React:")
for asset in assets:
    if asset.endswith('.js'):
        full_url = BASE_URL + asset if asset.startswith('/') else BASE_URL + '/' + asset
        astatus, ahdrs, abody = test_url(full_url)
        js_text = abody.decode('utf-8', errors='ignore')
        has_error_boundary = 'ErrorBoundary' in js_text or 'componentDidCatch' in js_text or 'getDerivedStateFromError' in js_text
        print(f"  Analisis de Bundle {asset}:")
        print(f"     - Tamano: {len(abody):,} bytes")
        print(f"     - Error Boundary detectado en bundle: {'Si (Protegido contra pantallazos blancos)' if has_error_boundary else 'No'}")

print("\n" + "=" * 70)
print("[FIN AUDITORIA EN VIVO] Todos los checks completados.")
print("=" * 70)
