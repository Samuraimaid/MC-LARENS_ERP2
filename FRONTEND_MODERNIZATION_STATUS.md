# Frontend Modernization Status

Actualizado: 2026-05-04

## Completado

- Migracion del frontend desde CRA/CRACO a Vite.
- Eliminacion de archivos heredados del flujo anterior (`craco.config.js`, `src/setupProxy.js`, `public/index.html`).
- Ajuste del Dockerfile para usar `npm ci` con el lockfile vigente.
- Resolucion del conflicto entre `react-day-picker` y `date-fns` alineando `date-fns` a `3.6.0`.
- Limpieza de `npm audit` hasta dejar el frontend sin vulnerabilidades conocidas.
- Remediacion de vulnerabilidades moderadas de red en frontend al actualizar `axios` a `^1.16.0`.
- Soporte para JSX en archivos `.js` y `.jsx` del proyecto bajo Vite.
- Code-splitting real por rutas usando `React.lazy` y `Suspense` en `frontend/src/App.js`.
- Unificacion de acceso a configuracion runtime y build mediante `frontend/src/lib/env.js`.
- Migracion de Compose, Docker y scripts operativos para publicar primero variables `VITE_*`.
- Verificacion en vivo de UI desde navegador integrado de VS Code en `http://localhost:3000/login`.

## Validaciones ejecutadas

- `npm --prefix frontend run lint`
- `npm --prefix frontend run build`
- `npm --prefix frontend audit`
- `docker compose build frontend`
- `docker compose up -d frontend`
- Prueba UI en vivo (VS Code browser): login renderizado, teclado PIN funcional, respuesta controlada en intento con PIN invalido.

## Variables de entorno

Preferidas:

- `VITE_BACKEND_URL`
- `VITE_AUTH_URL`
- `VITE_ATTENDANCE_KIOSK_SHORTCUT_PIN`
- `VITE_DEV_API_PROXY_TARGET`
- `VITE_APP_VERSION`
- `VITE_APP_BUILD_TIME`
- `VITE_APP_BUILD_ID`

Compatibilidad transitoria conservada:

- `REACT_APP_BACKEND_URL`
- `REACT_APP_AUTH_URL`
- `REACT_APP_ATTENDANCE_KIOSK_SHORTCUT_PIN`
- `REACT_APP_VERSION`
- `REACT_APP_BUILD_TIME`
- `REACT_APP_BUILD_ID`

La prioridad de resolucion actual es:

1. Runtime injectado en `public/env.js` y `window.__*`.
2. Variables `VITE_*`.
3. Variables `REACT_APP_*` para compatibilidad hacia atras.

## Siguiente trabajo sugerido

1. Partir modulos internos especialmente pesados dentro de pantallas como ventas, inventario y reportes.
2. Añadir medicion de tamano de bundle en CI para detectar regresiones de carga inicial.
3. Retirar definitivamente los alias `REACT_APP_*` una vez que no existan despliegues dependientes del esquema anterior.