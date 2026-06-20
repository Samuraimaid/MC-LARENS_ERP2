import os
import os
import sys
import json
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
url = f"{BASE_URL}/api/drafts/backup"

def http_get(u):
    req = Request(u, method='GET')
    with urlopen(req, timeout=5) as r:
        return r.read(), r.getcode(), r.info().get_content_type()

def http_post(u, data):
    b = json.dumps(data).encode('utf-8')
    req = Request(u, data=b, headers={'Content-Type': 'application/json'}, method='POST')
    with urlopen(req, timeout=5) as r:
        return r.read(), r.getcode()

def http_delete(u):
    req = Request(u, method='DELETE')
    with urlopen(req, timeout=5) as r:
        return r.read(), r.getcode()

try:
    try:
        http_delete(url)
    except Exception:
        pass

    entries = [{"id": "a", "text": "one"}, {"id": "b", "text": "two"}]

    _, code = http_post(url, {"entries": entries})
    if code != 200:
        print('POST failed', code)
        sys.exit(2)

    body, code, ctype = http_get(url)
    if code != 200:
        print('GET failed', code)
        sys.exit(3)
    data = json.loads(body.decode('utf-8'))
    if data.get('entries') != entries:
        print('GET returned unexpected data', data)
        sys.exit(4)

    _, code = http_delete(url)
    if code != 200:
        print('DELETE failed', code)
        sys.exit(5)

    body, code, ctype = http_get(url)
    if code != 200:
        print('GET after delete failed', code)
        sys.exit(6)
    data = json.loads(body.decode('utf-8'))
    if data.get('entries', []) != []:
        print('DELETE verification failed', data)
        sys.exit(7)

    print('OK: drafts backup CRUD passed')
    sys.exit(0)

except Exception as e:
    print('ERROR', e)
    sys.exit(10)
