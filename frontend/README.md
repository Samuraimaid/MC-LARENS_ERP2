# Frontend ERP

Frontend React migrado a Vite para desarrollo local, build de produccion y pruebas.

## Scripts

- `npm run dev`: levanta el servidor de desarrollo de Vite en `http://localhost:3000`.
- `npm run build`: genera `public/env.js` y construye la salida de produccion en `build/`.
- `npm run preview`: sirve localmente el build generado.
- `npm run lint`: ejecuta ESLint sobre `src/**/*.{js,jsx}`.
- `npm test`: ejecuta la suite configurada con Vitest.

## Variables de entorno

El frontend prioriza variables `VITE_*` y conserva compatibilidad temporal con `REACT_APP_*`. La configuracion runtime se expone mediante `public/env.js`.

- `VITE_BACKEND_URL` o `REACT_APP_BACKEND_URL`
- `VITE_AUTH_URL` o `REACT_APP_AUTH_URL`
- `VITE_ATTENDANCE_KIOSK_SHORTCUT_PIN` o `REACT_APP_ATTENDANCE_KIOSK_SHORTCUT_PIN`
- `VITE_DEV_API_PROXY_TARGET` o `DEV_API_PROXY_TARGET`

## Build y Docker

El build final queda en `build/` y el Dockerfile publica esos archivos estaticos con Nginx.

## Notas de migracion

- El HTML principal ahora es `index.html` en la raiz del frontend.
- El proxy `/api` se resuelve desde `vite.config.js`.
- Los archivos heredados de CRA/CRACO ya no forman parte del flujo de build.
