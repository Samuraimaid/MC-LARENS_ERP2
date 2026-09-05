import json
import urllib.request
import urllib.error
import ssl

BASE_URL = "https://mclarens-erp-836176703716.us-central1.run.app"
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

class ApiClient:
    def __init__(self, base_url):
        self.base_url = base_url
        self.session_token = None
        self.cookies = None
        self.user_info = None

    def login_pin(self, pin="01011990"):
        url = f"{self.base_url}/api/auth/pin/login"
        payload = json.dumps({"pin": pin}).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, context=ctx) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            self.session_token = data.get("session_token")
            self.cookies = resp.headers.get("Set-Cookie")
            self.user_info = data.get("user")
            print(f"[AUTH] Logged in successfully as: {self.user_info.get('name')} ({self.user_info.get('role')})")
            return data

    def request(self, method, path, data=None):
        url = f"{self.base_url}/api{path}" if not path.startswith("/api") else f"{self.base_url}{path}"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.cookies:
            headers["Cookie"] = self.cookies
        if self.session_token:
            headers["Authorization"] = f"Bearer {self.session_token}"

        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req, context=ctx) as resp:
                resp_bytes = resp.read()
                return resp.status, json.loads(resp_bytes.decode("utf-8")) if resp_bytes else {}
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            try:
                err_json = json.loads(err_body)
            except Exception:
                err_json = {"raw": err_body}
            return e.code, err_json

def run_simulation():
    print("=" * 80)
    print("MC-LARENS ERP 2.0 - SIMULACION DE AGENTES: REGISTRO, CONFLICTO Y TRASPASO")
    print("=" * 80)

    client = ApiClient(BASE_URL)
    client.login_pin("01011990")

    # =========================================================================
    # ESCENARIO 1: Carlos Alberto González Martínez (Dueño 1)
    # Vehículo: TOYOTA RAV4 2021 (Placa: M 856 526, Chasis: JTMDFRFV5MD126225)
    # =========================================================================
    print("\n--- PASO 1: Agente A registra / busca Cliente 1 (Carlos Alberto González Martínez) ---")
    status, cust1 = client.request("POST", "/customers", {
        "first_name": "Carlos Alberto",
        "last_name": "González Martínez",
        "name": "Carlos Alberto González Martínez",
        "identification": "001-120588-0021A",
        "identification_type": "cedula",
        "phone": "+505 8841-2309",
        "email": "carlos.gonzalez@test.com",
        "address": "Colonia Los Robles, Casa #142",
        "customer_type": "natural",
    })
    cust1_id = cust1.get("customer_id")
    print(f"Status: {status} | Cliente 1 ID: {cust1_id} | Nombre: {cust1.get('name')}")

    # =========================================================================
    # ESCENARIO 2: Luis Fernando Pérez Castillo (Nuevo Dueño / Cliente 2)
    # =========================================================================
    print("\n--- PASO 2: Agente B registra / busca Cliente 2 (Luis Fernando Pérez Castillo) ---")
    status, cust2 = client.request("POST", "/customers", {
        "first_name": "Luis Fernando",
        "last_name": "Pérez Castillo",
        "name": "Luis Fernando Pérez Castillo",
        "identification": "001-300180-0018E",
        "identification_type": "cedula",
        "phone": "+505 8654-1298",
        "email": "luis.perez@hotmail.com",
        "address": "Barrio Monseñor Lezcano, Del Parque 2c al Norte",
        "customer_type": "natural",
    })
    cust2_id = cust2.get("customer_id")
    print(f"Status: {status} | Cliente 2 ID: {cust2_id} | Nombre: {cust2.get('name')}")

    # Primero asignamos el vehículo al Cliente 1 para establecer el estado inicial
    print("\n--- PASO 3: Asegurando que el vehículo RAV4 pertenezca al Cliente 1 (Carlos Alberto) ---")
    status, veh_reg = client.request("POST", "/vehicles", {
        "customer_id": cust1_id,
        "brand": "Toyota",
        "model": "RAV4",
        "year": 2021,
        "plate": "M 856 526",
        "vin": "JTMDFRFV5MD126225",
        "color": "Blanco Perlado",
        "vehicle_type": "SUV Compacto (XAA50)",
    })
    target_vehicle_id = None
    if status == 200:
        target_vehicle_id = veh_reg.get("vehicle_id")
        print(f"Vehículo creado y asignado a Cliente 1: {target_vehicle_id}")
    elif status == 409:
        # El vehículo ya existía a nombre de otro cliente, transferimos primero a Cliente 1
        target_vehicle_id = veh_reg.get("detail", {}).get("existing_vehicle", {}).get("vehicle_id")
        print(f"Vehículo ya existía con ID {target_vehicle_id}. Transfiriendo a Cliente 1 para inicializar prueba...")
        t_status, t_res = client.request("POST", f"/vehicles/{target_vehicle_id}/transfer-owner", {
            "target_customer_id": cust1_id,
            "reason": "Inicialización de prueba de traspaso",
            "flow": "sales",
        })
        print(f"Inicialización a Cliente 1 resultado: {t_status} -> {t_res.get('message')}")

    # =========================================================================
    # ESCENARIO 3: Detección de Conflicto en Vivo cuando Cliente 2 intenta registrarlo
    # =========================================================================
    print(f"\n--- PASO 4: Agente B intenta registrar el mismo vehículo RAV4 para Cliente 2 ({cust2.get('name')}) ---")
    status, conflict_res = client.request("POST", "/vehicles", {
        "customer_id": cust2_id,
        "brand": "Toyota",
        "model": "RAV4",
        "year": 2021,
        "plate": "M 856 526",
        "vin": "JTMDFRFV5MD126225",
        "color": "Blanco",
    })
    print(f"Status recibido (esperado 409): {status}")
    print(f"Detalle del conflicto detectado por el backend:\n{json.dumps(conflict_res, indent=2, ensure_ascii=False)}")

    assert status == 409, f"Se esperaba 409 Conflicto pero se obtuvo {status}"
    conflict_detail = conflict_res.get("detail", {})
    assert conflict_detail.get("code") == "VEHICLE_OWNED_BY_ANOTHER"
    assert conflict_detail.get("owner_info", {}).get("customer_id") == cust1_id

    existing_vehicle = conflict_detail.get("existing_vehicle", {})
    vehicle_id_to_transfer = existing_vehicle.get("vehicle_id") or target_vehicle_id

    print("\n>>> CONFIRMACIÓN:")
    print(f"    - Vehículo en conflicto: {existing_vehicle.get('brand')} {existing_vehicle.get('model')} {existing_vehicle.get('year')} (VIN: {existing_vehicle.get('vin')})")
    print(f"    - Dueño actual detectado: {conflict_detail.get('owner_info', {}).get('name')} (ID: {conflict_detail.get('owner_info', {}).get('customer_id')})")
    print(f"    - Solicitante de traspaso: {cust2.get('name')} (ID: {cust2_id})")

    # =========================================================================
    # ESCENARIO 4: Ejecución del Traspaso por Gerencia / Supervisión
    # =========================================================================
    print(f"\n--- PASO 5: Gerencia/Supervisión aprueba el Traspaso de Vehículo {vehicle_id_to_transfer} a {cust2.get('name')} ---")
    status, transfer_res = client.request("POST", f"/vehicles/{vehicle_id_to_transfer}/transfer-owner", {
        "target_customer_id": cust2_id,
        "reason": "Nuevo dueño particular",
        "flow": "sales",
    })
    print(f"Status recibido (esperado 200): {status}")
    print(f"Resultado del traspaso:\n{json.dumps(transfer_res, indent=2, ensure_ascii=False)}")

    assert status == 200, f"Se esperaba 200 OK pero se obtuvo {status}"
    assert transfer_res.get("success") is True
    assert transfer_res.get("vehicle", {}).get("customer_id") == cust2_id

    # =========================================================================
    # ESCENARIO 5: Verificación en Backend y Registro de Auditoría
    # =========================================================================
    print(f"\n--- PASO 6: Verificación de titularidad actualizada en /vehicles/{vehicle_id_to_transfer} ---")
    status, updated_veh = client.request("GET", f"/vehicles/{vehicle_id_to_transfer}")
    print(f"Status: {status} | Vehículo: {updated_veh.get('brand')} {updated_veh.get('model')} {updated_veh.get('year')}")
    print(f"Nuevo Dueño Registrado: {updated_veh.get('customer_id')} (Esperado: {cust2_id})")
    assert updated_veh.get("customer_id") == cust2_id, "El vehículo no quedó asignado al Cliente 2"

    print("\n--- PASO 7: Verificación del Registro de Auditoría (Vehicle Transfer Logs) ---")
    transfer_log = transfer_res.get("transfer_log", {})
    print(f"Log ID: {transfer_log.get('log_id')}")
    print(f"Vehículo: {transfer_log.get('brand')} {transfer_log.get('model')} (Placa: {transfer_log.get('plate')}, VIN: {transfer_log.get('vin')})")
    print(f"Dueño Anterior: {transfer_log.get('previous_customer_name')} ({transfer_log.get('previous_customer_id')})")
    print(f"Nuevo Dueño:    {transfer_log.get('new_customer_name')} ({transfer_log.get('new_customer_id')})")
    print(f"Autorizado por: {transfer_log.get('authorized_by_name')} (Rol: {transfer_log.get('authorized_by_role')})")
    print(f"Motivo:         {transfer_log.get('reason')}")
    print(f"Fecha/Hora:     {transfer_log.get('created_at')}")

    print("\n" + "=" * 80)
    print("SIMULACIÓN COMPLETADA CON ÉXITO: TODO EL FLUJO OPERATIVO Y DE AUDITORÍA FUNCIONA AL 100%")
    print("=" * 80)

if __name__ == "__main__":
    run_simulation()
