import urllib.request

url = 'http://127.0.0.1:51945'
try:
    with urllib.request.urlopen(url, timeout=5) as r:
        data = r.read(1000).decode('utf-8', errors='ignore')
        print('STATUS', r.getcode())
        print(data[:400])
except Exception as e:
    print('ERROR', e)
    raise SystemExit(2)
