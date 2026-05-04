# Here are your Instructions

Actualizacion 2026-04-01 - Frontend
-----------------------------------

- El frontend fue migrado de CRA/CRACO a Vite.
- El build del frontend se valida con `npm --prefix frontend run build` y `docker compose build frontend`.
- El frontend ya no presenta vulnerabilidades conocidas en `npm audit`.
- La configuracion nueva debe preferir variables `VITE_*`; se mantiene compatibilidad temporal con `REACT_APP_*`.
- Referencias operativas:
	- `README_FRONTEND_RUN.md`
	- `FRONTEND_MODERNIZATION_STATUS.md`
	- `frontend/README.md`
	- `POLITICAS_CAMBIOS_CODIGO.md`

Estado documental del build
---------------------------

Troubleshooting: Problemas de login por PIN y sesión (2026-03-28)
---------------------------------------------------------------

**Síntomas:**
- El login por PIN no persistía la sesión, el endpoint `/api/auth/me` devolvía 401 tras login exitoso.
- Cambios en backend/frontend o Docker no surtían efecto, posible caché o estado residual.

**Acciones tomadas:**
- Revisión y ajuste de CORS y atributos de cookie en backend (`server.py`).
- Confirmación de uso de `withCredentials: true` en frontend (Axios y fetch).
- Forzado de dominio de cookie a `localhost` y ajuste de SameSite/Path/Secure.
- Limpieza total de Docker: `docker compose down --rmi all --volumes --remove-orphans`.
- Rebuild completo: `docker compose up --build -d`.
- Pruebas de login con usuario PIN de prueba y validación de sesión con `/api/auth/me`.

**Resultado:**
- El rebuild completo resolvió el problema: la sesión persiste correctamente tras login por PIN y el sistema funciona como se espera.

**Pasos de verificación rápida:**
1. Ejecutar `docker compose down --rmi all --volumes --remove-orphans` para limpiar todo.
2. Ejecutar `docker compose up --build -d` para reconstruir y levantar servicios.
3. Probar login con usuario PIN válido (8 dígitos) y verificar `/api/auth/me`.
4. Si persiste el problema, limpiar caché del navegador y desregistrar service worker.

Para detalles y comandos exactos, ver también el archivo `memory/chat-log.md`.

- Última actualización documental: **2026-02-26**.
- Última actualización documental: **2026-02-27**.

## Local development (quick start)

1. Copy example env: `cp .env.example .env` and edit if needed.
2. Start services (uses Docker Compose):

```bash
./start-local.sh
```

3. Backend will be available at `http://localhost:8001` (default).
4. Run backend tests once services are up:

```bash
pytest backend/tests -q
```

Testing helpers and safety
-------------------------

- The backend exposes a test-only endpoint `POST /api/test/create-session` which creates a test admin session (used by the test harness).
- The test suite and CI explicitly promote a test user to admin instead of relying on automatic upserts in the backend.
-
In CI we create a test session and call the promotion endpoint during the job so tests run against a predictable admin user.

Post-publicación extendida (operativo)
--------------------------------------

- Ejecutar la suite extendida desde raíz del proyecto:

```powershell
./scripts/post_publish_extended_suite.ps1
```

- El script ejecuta Playwright en secuencia con `--workers=1`, incluyendo la verificación visual del botón de recuperación de sesión:
	- `e2e/login_reset_button_visual.spec.js`

- La suite también valida branding en runtime para ambas marcas:
	- `frontend/scripts/verify_topcar_branding.js`
	- `frontend/scripts/verify_mundo_branding.js`

- Criterio de aprobación: salida final `Suite extendida post-publicación: OK`.

Test endpoint exposure
----------------------

- The `POST /api/test/create-session` endpoint is restricted by the environment variable `ENABLE_TEST_ENDPOINTS`.
	- Set `ENABLE_TEST_ENDPOINTS=true` in CI and in local development if you need the test endpoint.
	- In production this variable should be absent or `false` so the test endpoint returns `404`.

If you prefer to run the backend directly, ensure `MONGO_URL` and `DB_NAME` are set in `.env` and run with Uvicorn.

Inicio recomendado (Windows)
----------------------------

- Usa `start-mundo.bat`: genera el build del frontend y levanta el backend que sirve la web y el API en el mismo puerto.
- Abre la app en `http://localhost:8001` (o `http://<IP_LOCAL>:8001` en red).
- Esto evita problemas de montaje en localhost y fallos de PIN por desalineacion de puertos o cache.

Autenticación PIN (modelo vigente)
----------------------------------

- El sistema usa PIN dual:
	- **PIN de login (8 dígitos)** para acceso a la aplicación.
	- **PIN de asistencia (4 dígitos)** para marcación en reloj kiosco.
- La autenticación operativa se realiza por PIN (sin dependencia de Google OAuth en el flujo de personal operativo).
- Para incidencias de acceso, usar el script de recuperación documentado en este archivo.

Atajo de reloj marcador por PIN (kiosco)
----------------------------------------

- El login soporta un PIN especial para abrir directamente el reloj marcador en modo kiosco (`/attendance-clock`).
- El valor se define por variable de entorno (sin hardcode en login):

```text
VITE_ATTENDANCE_KIOSK_SHORTCUT_PIN
```

- En Docker Compose debe configurarse en el servicio `frontend` en:
	- `build.args.VITE_ATTENDANCE_KIOSK_SHORTCUT_PIN`
	- `environment.VITE_ATTENDANCE_KIOSK_SHORTCUT_PIN`

- Compatibilidad temporal:
	- `REACT_APP_ATTENDANCE_KIOSK_SHORTCUT_PIN`

- Flujo operativo:
	1. Usuario digita el PIN especial en `/login`.
	2. El sistema redirige a `/attendance-clock`.
	3. Las marcaciones se registran por secuencia automática y reglas horarias del backend.

Recuperación de acceso PIN (soporte)
------------------------------------

- Se agregó un script de soporte para desbloquear intentos fallidos y/o resetear PIN de login directamente en la base activa del contenedor backend.
- Script principal (PowerShell): `scripts/support_reset_login_pin.ps1`
- Atajo Windows: `reset-login-pin.bat`

Ejemplos de uso:

```powershell
# Solo desbloquear usuario por nombre
.\reset-login-pin.bat -UserName Xinon -UnlockOnly

# Resetear + desbloquear por nombre y verificar login via API
.\reset-login-pin.bat -UserName Xinon -NewPin 01011990 -Verify

# Opción recomendada en casos ambiguos: usar user_id
.\reset-login-pin.bat -UserId user_d79e87db3659 -NewPin 01011990 -Verify
```

Notas:

- Si existe más de un usuario con el mismo nombre, el script detiene la operación y pide usar `-UserId` para evitar cambios en la cuenta equivocada.
- `-NewPin` exige 8 dígitos para login.
- `-UnlockOnly` no cambia PIN; solo limpia lockout e intentos fallidos.

Configuración de deducción por tardanza (RRHH)
----------------------------------------------

- Puedes cambiar en cualquier momento el monto de deducción automática por llegada tarde desde la configuración de asistencia.
- Ejemplo API (`PUT /api/hr/attendance/settings`) para fijar deducción de `100 NIO`:

```powershell
$body = @{
	scope = "global"
	settings = @{
		entry_start = "08:00"
		entry_tolerance_minutes = 10
		late_arrival_deduction_enabled = $true
		late_arrival_deduction_amount = 100
		late_arrival_deduction_currency = "NIO"
	}
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Put `
	-Uri "http://127.0.0.1:8001/api/hr/attendance/settings" `
	-ContentType "application/json" `
	-Body $body `
	-WebSession $session
```

- Nota: el endpoint requiere sesión autenticada con rol autorizado de RRHH/gerencia/supervisión.

- Variante por sucursal (`scope = "branch"`) para aplicar una política distinta sin afectar el resto:

```powershell
$body = @{
	scope = "branch"
	branch_id = "branch_main"
	settings = @{
		entry_start = "08:00"
		entry_tolerance_minutes = 10
		late_arrival_deduction_enabled = $true
		late_arrival_deduction_amount = 75
		late_arrival_deduction_currency = "NIO"
	}
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Put `
	-Uri "http://127.0.0.1:8001/api/hr/attendance/settings" `
	-ContentType "application/json" `
	-Body $body `
	-WebSession $session
```

- Sustituye `branch_main` por el `branch_id` real de la sucursal objetivo.

Listar `branch_id` disponibles (API)
------------------------------------

```powershell
(Invoke-RestMethod -Method Get `
	-Uri "http://127.0.0.1:8001/api/branches" `
	-WebSession $session
) | Select-Object branch_id, name, branch_kind
```

Alternativa por script:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\list_branch_ids.ps1 -SessionCookie $sessionId
```

Modelo operativo multi-sucursal (vigente)
-----------------------------------------

- `branch_main` → **Mundo de Accesorios** (sucursal central):
	- Instalaciones: ✅
	- Polarizados: ✅
	- Envíos locales/departamentales: ✅
- `branch_north` → **TopCar El Calvario**:
	- Instalaciones: ❌
	- Polarizados: ❌
	- Envíos locales/departamentales: ✅
- `branch_south` → **TopCar La Tigre**:
	- Instalaciones: ❌
	- Polarizados: ❌
	- Envíos locales/departamentales: ✅

Notas:

- El backend ya bloquea creación de órdenes de trabajo/polarizados en sucursales sin capacidad de instalación.
- Roles recomendados por sucursal: `gerencia`, `recursos_humanos`, `supervisor`, `ventas`, `bodegas`, `transporte`.

Bootstrap y asignación masiva de personal
-----------------------------------------

- Bootstrap completo de estructura base por sucursal (incluye perfiles sugeridos por tienda):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap_multibranch_staff.ps1 -SessionCookie $sessionId -RunSeed
```

- Reasignación masiva de usuarios existentes por `role + branch_id + warehouse_id` usando CSV:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\assign_users_to_branches.ps1 -CsvPath .\scripts\users_branch_mapping.template.csv -SessionCookie $sessionId -DryRun
```

- Quita `-DryRun` para aplicar cambios reales.

Historial de vendedores por cliente y sucursal
----------------------------------------------

- Al registrar una venta, el cliente se actualiza automáticamente con:
	- `salesperson_history`: historial de vendedores que le atendieron, por sucursal, con conteo de ventas.
	- `branch_visit_history`: historial de sucursales visitadas por el cliente.
	- `customer_segments`: segmentos atendidos (`minorista` / `mayorista`).
- Esto permite consultar en ficha de cliente qué vendedores le atendieron y en cuáles sucursales.

Cómo probar localmente en Codespaces
-----------------------------------

1. En Codespaces (o en un contenedor remoto), el backend se ejecuta normalmente en `0.0.0.0:8001`.
2. Para acceder desde tu máquina local (VS Code Desktop conectado al Codespace) forwardea el puerto `8001`:

	- Abre la vista **Ports** (View → Ports) o usa la paleta de comandos y ejecuta "Ports: Focus on Ports View".
	- Si aparece el puerto `8001`, selecciónalo y haz clic en **Forward** o en **Open in Browser**.
	- Si no aparece, haz clic en **Add Port**, introduce `8001` y luego forwardea la entrada creada.

3. Comprobaciones rápidas desde el terminal del Codespace:

```bash
ss -ltnp | grep ':8001'
curl -sS http://127.0.0.1:8001/api/ | jq .
```

4. En tu máquina local abre: `http://localhost:8001/api/` para comprobar que el servicio responde.

Notas de seguridad
-----------------

- Cambia el PIN por defecto en despliegues de producción y usa una variable de entorno segura.
- Asegúrate de que `ENABLE_TEST_ENDPOINTS` no esté activado en producción para evitar exposición de endpoints de pruebas.

Registro de cambios de la sesion (resumen)
-----------------------------------------

- Se agrego un modulo de catalogo con cards de producto, imagen grande, compatibilidad, modelos, colores, promos y botones para agregar a cotizacion o venta.
- Se agrego la ruta `/catalog` y el enlace del menu lateral para el catalogo.
- Al agregar desde catalogo, se abre automaticamente un borrador activo en ventas o cotizaciones.
- Se forzo rebuild con Docker Compose y se reviso el error de service worker/cache.
- Se agrego `eslint-webpack-plugin` en `devDependencies` para eliminar el warning del build.

Detalle completo del registro
-----------------------------

- Ver [memory/chat-log.md](memory/chat-log.md) para el detalle completo de la sesion, comandos y troubleshooting.

Pasos de verificacion rapida
----------------------------

1. Levantar servicios: `docker compose up -d --build`
2. Abrir catalogo: `http://localhost:8001/catalog`
3. Probar login con un usuario PIN activo y su **PIN de login de 8 dígitos**.
4. Si no ves cambios, limpia cache y desregistra el service worker en DevTools.

Regla pre-publicación (obligatoria)
-----------------------------------

- Ejecutar antes de cada publicación:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pre_publish_gate.ps1
```

- O modo reforzado:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pre_publish_gate.ps1 -IncludeDraftCheck
```

Publicar sin VS Code (Docker Desktop)
-------------------------------------

- Flujo recomendado para publicar siempre de la misma forma sin mantener VS Code abierto.
- Ejecuta gate obligatorio, reconstruye `backend` y `frontend` en Docker, verifica URLs y deja el sistema arriba.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish_via_docker_desktop.ps1
```

- Modo reforzado (incluye `draft-check`):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish_via_docker_desktop.ps1 -IncludeDraftCheck
```

- En Windows también puedes usar doble clic en:

```text
publish-docker-desktop.bat
```

- Para apagar servicios con doble clic en Windows:

```text
stop-docker-desktop.bat
```

- Para apagado total (equivalente a `docker compose down`) con doble clic:

```text
stop-docker-desktop-full.bat
```

- URLs de operación esperadas tras publicar:
	- Frontend: `http://localhost:3000`
	- Backend docs: `http://localhost:8001/docs`

Checklist rapido antes de compartir en red (LAN)
------------------------------------------------

1. Ejecutar publicación unificada:
	- `publish-docker-desktop.bat` (o el script PowerShell equivalente).
2. Confirmar contenedores arriba en Docker Desktop:
	- `mundo-frontend`, `mundo-backend`, `mundo-mongodb` en estado Running.
3. Verificar acceso local:
	- `http://localhost:3000` debe cargar la aplicación.
4. Compartir enlace LAN con otra PC de la misma red:
	- `http://<IP_LOCAL>:3000` (ejemplo: `http://192.168.1.52:3000`).
5. Si no abre en otra PC:
	- Validar misma red, permitir puerto 3000 en firewall y probar recarga completa del navegador.

Regla por keyword "build"
--------------------------

- Si una indicación de mejora/corrección incluye la palabra `build`, se debe ejecutar el gate obligatorio.
- Script de apoyo para aplicar la regla:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run_gate_on_instruction.ps1 -Instruction "ajustar login y build"
```

- Modo reforzado:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run_gate_on_instruction.ps1 -Instruction "fix inventario + build" -IncludeDraftCheck
```

- Además, el repositorio ahora incluye el workflow `Pre-Publish Gate` para reforzar esta validación en CI.

Modo de desarrollo con Docker Compose (nota)
-------------------------------------------
- Recomendado en desarrollo local: usar `docker-compose` para levantar `backend`, `mongodb` y `frontend` juntos. Esto permite a los servicios resolverse por nombre (`backend`) dentro de la red `mundo-network`.
- En Windows/WSL2 la app usa `frontend/nginx.conf` proxy a `http://backend:8001/api/` para evitar problemas de `host.docker.internal` y resoluciones IPv6.
- Para reproducir el entorno local con Docker Compose:
 - Para equipos con CPU modesta o recursos limitados, el primer arranque rinde mejor si se construye una sola vez y luego se levantan los servicios sin rebuild completo en cada uso.

```powershell
docker-compose up -d --build
# frontend -> http://localhost:3000 (o según mapeo)
# backend -> http://localhost:8001
```

- Flujo recomendado en equipos modestos:

```powershell
docker compose build mongodb backend frontend
docker compose up -d mongodb backend
docker compose up -d frontend
```

- Para uso diario, preferir `docker compose up -d` y reconstruir solo el servicio afectado.
- Evitar `docker compose down --volumes` salvo que realmente quieras reinicializar la base de datos y asumir un arranque mas costoso.

- Si observas warnings de IPv6 en los logs del frontend, la configuración añade `resolver 127.0.0.11 ipv6=off;` en `frontend/nginx.conf` para forzar resolución IPv4 dentro del contenedor.
 
Verificación de despliegue del frontend
---------------------------------------

Si haces cambios en `frontend/src` y esperas verlos en la UI, sigue estos pasos para asegurarte de que el bundle servido contiene tus cambios y que el navegador no muestra una versión en caché:

1) Reconstruir y levantar el frontend (recomendado sin cache):

- docker compose build --no-cache frontend
- docker compose up -d frontend

2) Verificar que nginx arrancó en el contenedor:

- docker logs --since 1m --tail 200 mundo-frontend

3) Comprobar que el bundle servido contiene tu cambio:

- Inspección rápida desde el host: abre `http://localhost:3000/static/js/main.*.js` y busca un token esperado (por ejemplo, un fragmento del arreglo `PLATE_PREFIXES`).
- Inspección dentro del contenedor: `docker exec mundo-frontend ls -la /usr/share/nginx/html/static/js` y luego `docker exec mundo-frontend sh -c "grep -n 'LE\",\"CH' /usr/share/nginx/html/static/js/*.js || true"`.
- Copiar el bundle para inspección local: `docker cp mundo-frontend:/usr/share/nginx/html/static/js/main.XXXXX.js .\frontend\build_main_from_container.js` y abrir el archivo localmente.

4) Limpiar caché / service worker en el navegador si aún ves contenido antiguo:

- DevTools → Application → Service Workers → Unregister (si existe).
- DevTools → Application → Clear storage → Clear site data.
- Hard reload (Ctrl+F5) o usar una ventana de incógnito.

5) Comprobar la UI final:

- Abrir `http://localhost:3000/sales` y verificar que el dropdown/módulo muestra los valores esperados.

Notas y solución de problemas

- Si el bundle en el servidor NO contiene el cambio: revisa que los archivos fuente estén guardados, vuelve a ejecutar la build con `--no-cache` y revisa la salida del build para errores.
- Si el bundle SÍ contiene el cambio pero la UI sigue mostrando lo viejo: es muy probable que el navegador esté sirviendo recursos cacheados (service worker). Sigue el paso 4 para forzar una carga limpia.

Si quieres, puedo añadir un pequeño script `scripts/verify_ui.ps1` que descargue el bundle y verifique tokens específicos automáticamente.

