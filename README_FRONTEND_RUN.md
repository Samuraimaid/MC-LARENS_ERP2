MUNDO DE ACCESORIOS - Frontend run notes
======================================

Este archivo resume como ejecutar y validar el frontend despues de la migracion a Vite.

Actualizacion 2026-05-05
------------------------

- Workbench ya incluye navegacion inferior movil en telefonos (`frontend/src/components/layout/BottomNav.jsx`).
- `MainLayout` ahora muestra nombre de usuario, rol y sucursal en el encabezado operativo.
- Se movio formulario cliente/vehiculo a componente reutilizable (`frontend/src/components/customers/CustomerVehicleFormTabs.jsx`).
- Se ajusto `SaleForm` en Paso 3 y Paso 4 para paridad visual (stock a la izquierda, precio alineado abajo a la derecha).
- Se retiro la fila de "otras tiendas" del carrito (Paso 4) y su logica asociada.

Estado actual
-------------

- Frontend con Vite para desarrollo local y build de produccion.
- Build estatico generado en `frontend/build/`.
- Backend por defecto en `http://localhost:8001/api`.
- `docker compose build frontend` validado con el Dockerfile vigente.

Desarrollo local
----------------

```powershell
npm --prefix frontend install
npm --prefix frontend run dev
```

- Servidor Vite: `http://localhost:3000`
- Proxy `/api`: configurado en `frontend/vite.config.js`

Build local
-----------

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run preview
```

Contenedor frontend
-------------------

```powershell
docker compose build frontend
docker compose up -d frontend
```

En equipos con CPU limitada:

- Construye el frontend solo cuando haya cambios reales en `frontend/` o en su Dockerfile.
- Para uso normal del stack ya construido, evita repetir `docker compose build frontend`.
- Si solo necesitas volver a publicar el contenedor con la imagen ya creada, usa `docker compose up -d frontend`.
- Si el primer build tarda bastante, es esperable; las siguientes subidas suelen ser mas rapidas mientras se conserve la cache de Docker.

Variables de entorno
--------------------

Preferir `VITE_*` en configuracion nueva:

- `VITE_BACKEND_URL`
- `VITE_AUTH_URL`
- `VITE_ATTENDANCE_KIOSK_SHORTCUT_PIN`
- `VITE_DEV_API_PROXY_TARGET`
- `VITE_APP_VERSION`
- `VITE_APP_BUILD_TIME`
- `VITE_APP_BUILD_ID`

Compatibilidad transitoria:

- `REACT_APP_*` sigue soportado desde `frontend/src/lib/env.js` para no romper despliegues previos.

Atajo de reloj marcador por PIN
-------------------------------

- El login soporta un PIN especial para abrir directamente `/attendance-clock`.
- El valor se resuelve por este orden:
	1. `window.__ATTENDANCE_KIOSK_SHORTCUT_PIN__` desde `env.js`
	2. `VITE_ATTENDANCE_KIOSK_SHORTCUT_PIN`
	3. `REACT_APP_ATTENDANCE_KIOSK_SHORTCUT_PIN`

Validaciones recientes
----------------------

- `npm --prefix frontend run lint`: OK
- `npm --prefix frontend run build`: OK
- `npm --prefix frontend audit`: OK
- `docker compose build frontend`: OK
- `npm --prefix frontend install axios@^1.16.0`: aplicado para remediar advisories de seguridad en cliente HTTP.
- Verificacion en vivo en navegador de VS Code (`http://localhost:3000/login`):
	- Render correcto de pantalla de login.
	- Estado `Conexion con servidor: OK` visible.
	- Teclado PIN funcional con ingreso de 8 digitos.
	- Intento de login invalido responde `401` de forma controlada (sin ruptura de UI).

Referencia adicional
--------------------

- Ver `FRONTEND_MODERNIZATION_STATUS.md` para el resumen tecnico completo y siguientes optimizaciones.
