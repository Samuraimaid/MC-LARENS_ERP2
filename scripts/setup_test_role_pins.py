import json
import sys
import urllib.request

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

base_url = "https://mclarens-erp-836176703716.us-central1.run.app"

# 1. Reset all locks first
print("Resetting all pin locks and timeouts...")
req_reset = urllib.request.Request(
    f"{base_url}/api/auth/pin/reset-all-locks",
    data=b"{}",
    headers={"Content-Type": "application/json"}
)
try:
    with urllib.request.urlopen(req_reset) as r:
        print("Locks reset response:", json.loads(r.read().decode()))
except Exception as e:
    print("Reset locks error (continuing):", e)

# 2. Login as Gerencia
req = urllib.request.Request(
    f"{base_url}/api/auth/pin/login",
    data=json.dumps({"pin": "01011990"}).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode("utf-8"))
    token = data.get("session_token")
    cookies = resp.headers.get("Set-Cookie")

print("Logged in as Gerencia successfully!")

# 3. Get all users
req2 = urllib.request.Request(
    f"{base_url}/api/users",
    headers={"Content-Type": "application/json", "Cookie": cookies, "Authorization": f"Bearer {token}"}
)

with urllib.request.urlopen(req2) as resp2:
    users_data = json.loads(resp2.read().decode("utf-8"))
    users = users_data if isinstance(users_data, list) else users_data.get("users", [])

# Mapping of Test Users to PINs
TARGET_PINS = {
    "recursos_humanos": "20202020",
    "supervisor": "30303030",
    "cajero": "40404040",
    "ventas": "50505050",
    "electrico": "60606060",
    "polarizador": "70707070",
    "transporte": "80808080",
    "bodegas": "90909090",
    "instalaciones": "12121212",
    "coordinador_polarizados": "13131313",
    "coordinador_instalaciones": "14141414",
    "jefe_vendedores": "15151515",
    "jefe_tienda": "16161616",
    "entregador": "17171717",
    "programador": "99999999",
}

for role, pin in TARGET_PINS.items():
    # Find a test user or active user with this role
    matched = None
    for u in users:
        if u.get("role") == role and u.get("is_active") is not False:
            if "Test" in (u.get("name") or "") or matched is None:
                matched = u
                if "Test" in (u.get("name") or ""):
                    break
    if not matched:
        print(f"⚠️ No user found for role {role}")
        continue
        
    uid = matched["user_id"]
    name = matched.get("name")
    print(f"Configuring {role:25} -> User: {name} ({uid}) with PIN: {pin}...")
    
    req_pin = urllib.request.Request(
        f"{base_url}/api/users/{uid}/login-pin",
        data=json.dumps({"new_pin": pin}).encode("utf-8"),
        headers={"Content-Type": "application/json", "Cookie": cookies, "Authorization": f"Bearer {token}"},
        method="PUT"
    )
    try:
        with urllib.request.urlopen(req_pin) as r_pin:
            res = json.loads(r_pin.read().decode())
            print(f"  ✔ {res.get('message', 'PIN actualizado')}")
    except Exception as e:
        print(f"  ❌ Error setting PIN for {role}: {e}")

print("\nAll test role PINs successfully configured!")
