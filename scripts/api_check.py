#!/usr/bin/env python3
import json
import urllib.request
import urllib.error

BASE = 'http://localhost:8002'
PIN = '010190'

def post_json(path, data, headers=None):
    url = BASE + path
    b = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=b, headers={'Content-Type': 'application/json', **(headers or {})}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode('utf-8')
            return resp.getcode(), json.loads(body), resp.getheaders()
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode('utf-8')
            return e.code, json.loads(body), e.headers.items()
        except Exception:
            return e.code, {'error': str(e)}, []
    except Exception as e:
        return None, {'error': str(e)}, []

def get_json(path, token=None):
    url = BASE + path
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode('utf-8')
            return resp.getcode(), json.loads(body)
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode('utf-8')
            return e.code, json.loads(body)
        except Exception:
            return e.code, {'error': str(e)}
    except Exception as e:
        return None, {'error': str(e)}

if __name__ == '__main__':
    print('Logging in with PIN (Xinon)')
    code, data, headers = post_json('/api/auth/pin/login', {'pin': PIN})
    print('Login HTTP code:', code)
    print(json.dumps(data, indent=2, ensure_ascii=False))

    token = None
    if isinstance(data, dict) and data.get('session_token'):
        token = data['session_token']
        print('Obtained session_token (in response JSON)')
    else:
        # try to read Set-Cookie header
        for k,v in headers:
            if k.lower() == 'set-cookie' and 'session_token=' in v:
                # crude parse
                parts = v.split(';')
                for part in parts:
                    if part.strip().startswith('session_token='):
                        token = part.strip().split('=',1)[1]
                        print('Obtained session_token from Set-Cookie header')
                        break
    
    if not token:
        print('No session token available; cannot perform authenticated requests')
    else:
        for path in ['/api/branches', '/api/warehouses', '/api/users']:
            print('\nGET', path)
            code, body = get_json(path, token)
            print('HTTP', code)
            print(json.dumps(body, indent=2, ensure_ascii=False))
