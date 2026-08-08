# HTTPS :3443 — Cámara y escáner de códigos de barras

## Para qué sirve el puerto 3443

Chrome/Android/iOS **solo permiten `getUserMedia` (cámara)** en un **contexto seguro**:

- `https://…`
- o `http://localhost` / `http://127.0.0.1` (excepción del PC)

En la red de la tienda (tablets, celulares) se usa:

| Uso | URL |
|-----|-----|
| PC en la tienda | `http://localhost:3000` o `http://<IP_LAN>:3000` |
| **Móvil / tablet con cámara-escáner** | **`https://<IP_LAN>:3443`** |
| Misma máquina, HTTPS local | **`https://localhost:3443`** o **`https://127.0.0.1:3443`** |

Mapeo Docker:

```text
host 3000 → contenedor 80  (HTTP)
host 3443 → contenedor 443 (HTTPS + certificado local)
```

Código relacionado:

- `frontend/src/lib/cameraAccess.js` → `getRecommendedCameraUrl()` devuelve `https://{host}:3443`
- `frontend/src/lib/barcodeScanner.js` → exige contexto seguro antes de abrir cámara
- `frontend/nginx.conf` → `listen 443 ssl` + headers de secure context
- `frontend/docker-entrypoint.sh` → genera `server.crt` / `server.key` con SAN (DNS + IPs)
- `scripts/rebuild-frontend-https.ps1` → regenera cert con la IP LAN actual
- `scripts/setup_store_infrastructure.ps1` → setup tienda (HTTPS + firewall 3000/3443/8001)

## Pantalla blanca en `http://…:3000`

Si el HTTP fuerza `Content-Security-Policy: upgrade-insecure-requests`, el navegador
intenta cargar `/assets/*.js` por HTTPS en el puerto 3000 (sin TLS) y la SPA queda en blanco
(`ERR_SSL_PROTOCOL_ERROR`).

**Correcto:** en `frontend/nginx.conf` el bloque `listen 80` **no** debe enviar
`upgrade-insecure-requests`. La cámara usa solo `:3443` (HTTPS).

## Error típico: `400 The plain HTTP request was sent to HTTPS port`

Aparece si abres:

```text
http://localhost:3443     ❌  (HTTP en puerto HTTPS)
```

Debes abrir:

```text
https://localhost:3443    ✅
https://192.168.x.x:3443  ✅  (IP de la PC del ERP en la LAN)
```

Nginx **no puede redirigir** HTTP→HTTPS en el mismo socket SSL: la petición HTTP cruda a 443 solo produce ese 400.

## Cómo reparar / regenerar el puerto HTTPS

### 1) Contenedores arriba

```powershell
docker compose up -d
docker compose ps
```

Debes ver `mundo-frontend` healthy con `0.0.0.0:3443->443/tcp`.

### 2) Regenerar certificado con la IP LAN actual

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\rebuild-frontend-https.ps1
```

Equivale a detectar IP con `scripts/detect-lan-ip.ps1` y recrear el frontend con:

```text
HTTPS_CERT_IPS=127.0.0.1,<tu-ip-lan>
HTTPS_CERT_DNS=localhost
```

Verificar SAN del certificado:

```powershell
docker exec mundo-frontend sh -c "openssl x509 -in /etc/nginx/certs/server.crt -noout -text | grep -A2 'Subject Alternative Name'"
```

Debe listar `DNS:localhost`, `IP:127.0.0.1` y tu IP LAN.

### 3) Setup completo de tienda (HTTPS + firewall)

Como **Administrador**:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup_store_infrastructure.ps1
```

Abre firewall TCP **3000, 3443, 8001** y regenera HTTPS.

### 4) Probar en el móvil (misma Wi‑Fi que la PC del ERP)

1. En la PC: anota la IP LAN (`ipconfig` o el script `detect-lan-ip.ps1`).
2. En el móvil abre: **`https://<IP_LAN>:3443/login`**
3. Si Chrome avisa “No es seguro” (certificado autofirmado):
   - **Avanzado** → **Continuar al sitio**
   - La cámara puede funcionar igual; el candado rojo es el cert local, no un fallo del puerto.
4. Entra al flujo de inventario/ventas con escáner de cámara.

### 5) CORS / cookies

El backend debe permitir el origen HTTPS en `CORS_ORIGINS` (ver `docker-compose.yml`), por ejemplo:

```text
https://localhost:3443
https://127.0.0.1:3443
https://<IP_LAN>:3443
```

Tras cambiar `CORS_ORIGINS`:

```powershell
docker compose up -d --force-recreate backend
```

## Checklist rápido

| Check | Comando / acción |
|-------|------------------|
| Frontend HTTP | `http://127.0.0.1:3000` → 200 |
| Frontend HTTPS | `https://127.0.0.1:3443` → 200 (aceptar cert) |
| No uses HTTP en 3443 | `http://…:3443` → 400 esperado |
| Cert con tu IP | `rebuild-frontend-https.ps1` |
| Firewall | `setup_store_infrastructure.ps1` como Admin |
| Cámara en código | Solo en `window.isSecureContext` |

## Resumen

- **3443 no está “caído”** si ves el 400 de “plain HTTP… HTTPS port”: estás usando **http** en un puerto **https**.
- URL correcta para escáner con cámara: **`https://<host>:3443`**.
- Si la IP de la PC cambió, regenera el cert con `scripts/rebuild-frontend-https.ps1`.
