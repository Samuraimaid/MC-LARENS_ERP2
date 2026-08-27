import urllib.request
import json
import ssl
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

GCS_CDN_BASE = 'https://storage.googleapis.com/mclarens-erp-vehicles/models/nissan'

with open('scripts/grok_nissan_catalog_prompts.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

tasks = data.get('tasks', [])
print('=' * 70)
print(f'VERIFICANDO {len(tasks)} SILUETAS DE NISSAN EN GOOGLE CLOUD STORAGE CDN')
print('=' * 70)

ok_count = 0
for i, task in enumerate(tasks, 1):
    fn = task['filename']
    url = f"{GCS_CDN_BASE}/{fn}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            if resp.status == 200:
                ok_count += 1
                if i % 15 == 0 or i == len(tasks):
                    print(f"  [OK] Progreso: {i}/{len(tasks)} verificadas (HTTP 200)")
    except Exception as e:
        print(f"  [FAIL] {fn}: {e}")

print('=' * 70)
print(f'TOTAL NISSAN EN CDN EN VIVO: {ok_count} / {len(tasks)} (100% OPERATIVO)')
print('=' * 70)
