import requests, sys

try:
    r = requests.post('http://127.0.0.1:8002/api/auth/pin/login', json={'pin':'010190'}, timeout=10)
    print('STATUS', r.status_code)
    print(r.headers.get('content-type'))
    print(r.text)
except Exception as e:
    print('ERROR', type(e).__name__, str(e))
