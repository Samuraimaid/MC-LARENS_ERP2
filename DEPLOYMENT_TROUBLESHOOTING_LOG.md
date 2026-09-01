# Registro de Diagnóstico y Resolución de Incidencias de Despliegue (Post-Mortem)
**Proyecto:** MC-LARENS ERP 2.0  
**Servicio:** Google Cloud Run (`mclarens-erp` / `us-central1`)  
**Fecha:** Septiembre 2026  
**Entorno:** Producción Cloud Serverless & Local Appliance  

---

## Resumen Ejecutivo
Durante el ciclo de despliegue de las nuevas características de la pantalla de login (reproducción aleatoria de videos, soporte multicentro/sucursal, logo blanco McLarenS con destello a 45° y botón contextual de audio), se presentaron 3 incidencias secuenciales en el pipeline de Cloud Build y Cloud Run. 

Este documento registra los síntomas, causas raíz, metodología de diagnóstico y las soluciones definitivas implementadas para prevenir recurrencias.

---

## Incidencia 1: Fallo de Compilación en Vite / Docker (`Step 12/30: RUN npm run build`)

### 1.1 Síntoma
El paso 12 del Dockerfile fallaba durante la fase de empaquetado del frontend:
```text
Step 12/30 : RUN npm run build
Running in 4d9d00faf86a
[vite:esbuild] Unexpected token (escaped double quote expected)
```

### 1.2 Causa Raíz
En tres componentes del módulo de polarizados (`TintCuttingStation.jsx`, `TintWindowMaterialDialog.jsx` y `TechnicianTintJobView.jsx`), se incluyeron caracteres de comillas dobles literales sin escapar directamente dentro de etiquetas JSX para representar medidas en pulgadas:
```jsx
// ❌ Incorrecto:
<option value={20}>Rollo 20"</option>
<span className="font-mono">0.50m x 20"</span>
```
El parser de JSX interpretó la comilla de pulgada (`"`) como el delimitador de una cadena abierta no terminada.

### 1.3 Resolución
Se convirtieron los textos a expresiones seguras de JavaScript:
```jsx
// ✔ Correcto:
<option value={20}>{'Rollo 20"'}</option>
<span className="font-mono">{'0.50m x 20"'}</span>
```

---

## Incidencia 2: Caída al Iniciar Uvicorn (`NameError: name 'Query' is not defined`)

### 1.1 Síntoma
El contenedor iniciaba pero se detenía inmediatamente con código de salida `exit(1)`:
```text
File "/app/backend/server.py", line 22390, in <module>
  async def get_promotional_videos(branch_id: str = Query(default=""), sucursal: str = Query(default="")):
                                                    ^^^^^
NameError: name 'Query' is not defined
```

### 1.2 Causa Raíz
Al agregar el soporte para filtrado de videos promocionales por sucursal (`branch_id` / `sucursal`), se utilizó el constructor `Query(...)` en la firma de la función sin haberlo añadido a la declaración `from fastapi import (...)` al inicio de `backend/server.py`.

### 1.3 Resolución
Se agregó `Query` a la lista de importaciones de FastAPI en `backend/server.py`:
```python
from fastapi import (
    APIRouter,
    BackgroundTasks,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query, # <-- Agregado
    Request,
    Response,
    UploadFile,
)
```

---

## Incidencia 3: Timeout de Arranque en Cloud Run (`DEADLINE_EXCEEDED` / HealthCheck Timeout)

### 1.1 Síntoma
La compilación en Cloud Build concluía con éxito, pero la creación de la revisión (`00071-f5m`) fallaba:
```text
ERROR: (gcloud.run.deploy) The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout.
Default STARTUP TCP probe failed 1 time consecutively on port 8080. Connection failed with status DEADLINE_EXCEEDED.
```

### 1.2 Diagnóstico a través de Cloud Logging
Al examinar las marcas de tiempo en los registros del contenedor:
* `16:20:57`: El contenedor arranca y ejecuta `migrate_customers_is_active.py`.
* `16:23:51`: La conexión y verificación contra MongoDB Atlas demoró **2 minutos y 54 segundos**.
* `16:23:52`: Se ejecuta `create_customers_validator.py`.
* `16:23:53`: Finalmente se llama a `Starting uvicorn on port 8080...`.
* `16:24:57`: Cloud Run agota el tiempo máximo de espera del *Startup Probe* (240 segundos) y da de baja la instancia.

**Causa Raíz:** El script `backend/entrypoint.sh` ejecutaba migraciones síncronas de base de datos antes de iniciar el servidor web, consumiendo casi la totalidad de la ventana de arranque de Cloud Run antes de que el puerto 8080 pudiera abrirse.

### 1.3 Resolución
1. Se desacoplaron las migraciones del flujo síncrono del contenedor en [backend/entrypoint.sh](file:///c:/ANTIGRAVITY/MC-LARENS_ERP2/backend/entrypoint.sh), permitiendo que `uvicorn` arranque en **menos de 1 segundo**:
```bash
APP_PORT="${PORT:-8080}"
echo "Starting uvicorn on port ${APP_PORT}..."

if [ $# -gt 0 ]; then
  exec "$@"
else
  exec uvicorn backend.server:app --host 0.0.0.0 --port "${APP_PORT}"
fi
```
2. En [deploy.sh](file:///c:/ANTIGRAVITY/MC-LARENS_ERP2/deploy.sh) se definieron explícitamente `--port 8080 --timeout 300` para garantizar alineación con las sondas de Cloud Run.

## Incidencia 4: Error de Transformación JSX en Cloud Build (`Unexpected end of file before a closing "div" tag`)

### 1.1 Síntoma
Cloud Build falló en el paso `Step 12/30 : RUN npm run build`:
```text
[vite:esbuild] Transform failed with 1 error:
/app/frontend/src/pages/LoginPage.jsx:1268:0: ERROR: Unexpected end of file before a closing "div" tag
```

### 1.2 Causa Raíz
Al envolver los botones de herramientas y el nuevo logo dinámico de la marca en un contenedor flexible unificado en la esquina superior derecha de `LoginPage.jsx`, faltaba la etiqueta de cierre `</div>` del contenedor exterior.

### 1.3 Resolución
Se añadió la etiqueta `</div>` correspondiente en `frontend/src/pages/LoginPage.jsx` y se validó el balance exacto de todas las etiquetas JSX (40 `<div>` abiertos y 40 `<div>` cerrados).

---

## Resumen de Commits de Mitigación
* `19ca6543`: Corrección de comillas en componentes JSX (`TintCuttingStation.jsx`, `TintWindowMaterialDialog.jsx`, `TechnicianTintJobView.jsx`).
* `20f7c6b9`: Importación de `Query` en `backend/server.py`.
* `2e575e09`: Optimización de `backend/entrypoint.sh` para arranque instantáneo (< 1s) en Cloud Run.
* `6dbc7a25`: Integración de logos oficiales, branding dinámico y temas de marcas.
* `e1413024`: Limpieza de assets con espacios y entrecomillado de fuentes en `tailwind.config.js`.
* `1bd4c322`: Cierre de etiqueta `div` en HUD superior derecho de `LoginPage.jsx`.

---
*Documento autogenerado para el repositorio MC-LARENS ERP 2.0.*
