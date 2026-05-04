Resumen de cambios y pasos para migración/validación de `customers`

---

Actualizacion 2026-04-01 - Modernizacion del frontend

- Se completo la migracion del frontend desde CRA/CRACO a Vite.
- Se eliminaron archivos heredados del flujo anterior y se actualizo el Dockerfile del frontend para trabajar con el lockfile vigente.
- Se resolvio el conflicto `react-day-picker` + `date-fns` alineando `date-fns` a la rama compatible.
- Se agrego code-splitting por rutas en `frontend/src/App.js` con `React.lazy` + `Suspense`.
- Se centralizo el acceso a variables de entorno en `frontend/src/lib/env.js` para priorizar `VITE_*` y conservar compatibilidad transitoria con `REACT_APP_*`.

Validacion ejecutada

- `npm --prefix frontend run lint`: OK
- `npm --prefix frontend run build`: OK
- `npm --prefix frontend audit`: OK
- `docker compose build frontend`: OK

Trabajo siguiente recomendado

1. Mover Compose y scripts de despliegue a nombres `VITE_*`.
2. Medir tamano de bundle en CI para detectar regresiones.
3. Evaluar upgrades mayores separados de seguridad: React 19, Tailwind 4, ESLint moderno, Zod 4.

- Se añadió `backend/scripts/migrate_customers_is_active.py` para fijar `is_active=True` en documentos sin ese campo.
- Se añadió `backend/scripts/create_customers_validator.py` para crear/actualizar el validador de la colección `customers`.
- Se añadió `backend/tests/test_customer_integration.py` que verifica POST -> GET list.
- El `Dockerfile` del backend ahora ejecuta ambos scripts en el `entrypoint` antes de arrancar la app.

Comandos para ejecutar localmente:

1) Ejecutar migración manualmente:

```bash
MONGO_URL="mongodb://localhost:27017" MONGO_DB="erp" python backend/scripts/migrate_customers_is_active.py
```

2) Aplicar validador manualmente:

```bash
MONGO_URL="mongodb://localhost:27017" MONGO_DB="erp" python backend/scripts/create_customers_validator.py
```

3) Ejecutar la prueba de integración:

```bash
pytest -q backend/tests/test_customer_integration.py::test_create_customer_appears_in_list
```

4) Para producción / despliegue en contenedores: el entrypoint del backend ejecuta la migración y aplica el validador automáticamente antes de iniciar `uvicorn`.

---

Actualización 2026-02-27 — Limpieza de rol typo `progrmador`

- Se completó la remediación del typo de rol para conservar únicamente `programador`.
- Se confirmó saneamiento de referencias en código backend/frontend.
- Se ejecutó verificación en MongoDB para colecciones operativas:
	- `users`
	- `custom_roles`
	- `role_permissions`
- Resultado reportado: `remaining 0 0 0` para `role = progrmador`.

---

Actualización 2026-03-03 — Reglas de usuario requeridas + ciclo de publicación

- Se alineó el contrato de creación/edición de usuarios PIN para requerir:
	- `name`
	- `last_name`
	- `phone` (formato `0000-0000`)
	- `login_pin` (8 dígitos)
	- `role`
	- `branch_id`
- Se habilitó la edición de esos campos para roles:
	- `recursos_humanos`
	- `gerencia`
	- `programador`
- Se actualizó la UI de administración de usuarios para capturar/editar `apellidos` y mostrarlos en ambas tablas operativas.

Validación ejecutada

- Pre-publicación (`scripts/pre_publish_gate.ps1`): **OK**.
- Publicación/rebuild (`scripts/publish_via_docker_desktop.ps1`): **OK**.
- Post-publicación (`scripts/post_publish_extended_suite.ps1`): **OK**.

Ajustes de pruebas para mantener compatibilidad con el nuevo contrato

- Backend:
	- `backend/tests/test_pin_integration.py`
	- `backend/tests/test_pin_lockout.py`
- Frontend E2E/smoke:
	- `frontend/e2e/capture_login_console.spec.js`
	- `frontend/e2e/create_customer.spec.js`
	- `frontend/e2e/kiosk_ui_smoke.spec.js`
	- `frontend/e2e/login_ui_interaction.spec.js`
	- `frontend/tests/pin_login.spec.js`
- Branding checks robustecidos:
	- `frontend/scripts/verify_topcar_branding.js`
	- `frontend/scripts/verify_mundo_branding.js`
