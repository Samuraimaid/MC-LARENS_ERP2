import requests

# Configuración
BASE_URL = 'http://localhost:8001/api'
SESSION_COOKIE = {'session_token': 'c4fa5d7b9d1c619ff42ec485c49c8d79'}  # Obtenido tras login PIN

# Roles a crear (excepto electrico, instalaciones, polarizador)
ROLES = [
    ('gerencia', 'Gerencia'),
    ('supervisor', 'Supervisor'),
    ('ventas', 'Ventas'),
    ('transporte', 'Transporte'),
    ('bodegas', 'Bodegas'),
]

# Sucursales
BRANCHES = [
    ('branch_north', 'TopCar El Calvario'),
    ('branch_south', 'TopCar La Tigre'),
]

# Datos base para usuarios
NAMES = {
    'gerencia':    ('Ana', 'Gerente'),
    'supervisor':  ('Luis', 'Supervisor'),
    'ventas':      ('Carlos', 'Ventas'),
    'transporte':  ('Pedro', 'Transporte'),
    'bodegas':     ('Sofia', 'Bodegas'),
}

# PIN base para pruebas (debe ser único por usuario)
PIN_BASE = 2000

for branch_id, branch_name in BRANCHES:
    for idx, (role, role_label) in enumerate(ROLES):
        name, last_name = NAMES[role]
        pin = str(PIN_BASE + idx).zfill(8)
        # Teléfono en formato 88##-####, solo números
        # Ejemplo: 8810-2000, 8811-2001, etc. (único por usuario y sucursal)
        phone_prefix = 88_00 + idx  # 8800, 8801, ...
        branch_offset = 0 if branch_id == 'branch_north' else 50
        phone_number = phone_prefix * 10000 + branch_offset + (2000 + idx)
        phone_str = f"{str(phone_number)[:4]}-{str(phone_number)[4:]}"
        payload = {
            'name': name,
            'last_name': last_name + f' {branch_name}',
            'phone': phone_str,
            'role': role,
            'login_pin': pin,
            'branch_id': branch_id
        }
        print(f'Creando usuario: {payload}')
        r = requests.post(f'{BASE_URL}/users/pin', json=payload, cookies=SESSION_COOKIE, timeout=15)
        print(f'Status: {r.status_code} - {r.text[:200]}')
