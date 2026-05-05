# Release v0.2.1-roles

Build documental actual: 2026-02-26

## Control de cambios - 2026-05-05 (Permisos, ventas y experiencia movil)

Estado de cierre
- Se consolidaron cambios funcionales en backend y frontend para mejorar operacion comercial, visual de ventas y navegacion movil.

Alcance funcional entregado
- Backend:
	- Nuevos roles operativos: `jefe_vendedores`, `jefe_tienda`.
	- Expansion de permisos funcionales para modulos comerciales e inventario segun rol.
	- `POST /inventory/add-stock` agregado para ingreso controlado de stock.
	- Restriccion aplicada: rol `bodegas` no usa actualizacion general de inventario, solo flujo de ingreso.

- Frontend:
	- Header operativo en `MainLayout` con nombre, rol y sucursal visibles.
	- Navegacion inferior movil para workbench (`BottomNav`) y hook `useDevice` para comportamiento responsive.
	- Refactor de formulario cliente/vehiculo a componente reutilizable.
	- Ajustes de UI en `SaleForm`:
		- tarjetas de productos (Paso 3) y carrito (Paso 4) alineadas a referencia visual,
		- precios con alineacion inferior derecha,
		- eliminada fila "otras tiendas" y su logica asociada en Paso 4.

Datos de apoyo
- Script agregado: `scripts/seed_managua_customers_vehicles.py` para carga idempotente de clientes/vehiculos de prueba.

Verificaciones aplicadas
- Diagnostico limpio en `frontend/src/components/sales/SaleForm.jsx`.
- Rebuild frontend por Docker Compose ejecutado para validar despliegue local.

## Control de cambios — 2026-03-28 (Login PIN y sesión)

Estado de cierre
- Se resolvió un problema donde el login por PIN no persistía la sesión y `/api/auth/me` devolvía 401 tras login.
- El problema se debía a residuos de caché, configuración de cookies y posibles inconsistencias en el entorno Docker.

Acciones ejecutadas
- Ajuste de CORS y atributos de cookie en backend (`server.py`).
- Confirmación de `withCredentials: true` en frontend.
- Forzado de dominio de cookie a `localhost` y ajuste de SameSite/Path/Secure.
- Limpieza total de Docker (`docker compose down --rmi all --volumes --remove-orphans`).
- Rebuild completo (`docker compose up --build -d`).
- Pruebas de login con usuario PIN de prueba y validación de sesión.

Resultado
- El rebuild completo resolvió el problema: la sesión persiste correctamente tras login por PIN y el sistema funciona como se espera.

Pasos de verificación rápida
1. Limpiar todo con `docker compose down --rmi all --volumes --remove-orphans`.
2. Rebuild y levantar servicios con `docker compose up --build -d`.
3. Probar login PIN y `/api/auth/me`.
4. Limpiar caché navegador si persiste el problema.

Regla obligatoria pre-publicación
- Antes de cada publicación se debe ejecutar el gate local de pre-publicación y solo publicar si el resultado es exitoso.
- Comando estándar (Windows/PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pre_publish_gate.ps1
```

- Modo reforzado (incluye draft-check frontend):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pre_publish_gate.ps1 -IncludeDraftCheck
```

- Si el script devuelve error, la publicación queda bloqueada hasta corregir la causa.
- Regla adicional: cuando una indicación de mejora/corrección incluya la palabra `build`, se debe ejecutar este gate antes de continuar.

Fecha: 2026-02-19 (tag: v0.2.1-roles)

Resumen breve
- Añadido flujo de aprobaciones por roles (ventas -> gerencia).
- Script e2e: `frontend/scripts/e2e_approvals_flow.js` para validar el flujo de aprobación.
- Ajustes backend: enforcement de roles y endpoints de approval/edit/delete (ver `backend/server.py`).
- Frontend: correcciones de ESLint (eliminadas imports no usados, reemplazos de catch vacíos), y mejoras en gestión de borradores (incluye `selectedCustomerId` / `selectedVehicle`).
- Build frontend generado (`frontend/build`) y contenedores `backend` y `frontend` reconstruidos localmente.

Verificaciones realizadas
- Ejecutadas pruebas unitarias en backend (`pytest`) — OK.
- Playwright draft-check automático — OK.
- Ejecución del e2e de aprobaciones — OK (ventas crea solicitud, gerencia aprueba, cambio aplicado).
- Lint: errores corregidos; quedan advertencias por dependencias de Hooks (6 warnings) intencionales.

Pasos siguientes recomendados
1. Empujar las imágenes Docker al registro remoto (necesito el destino y credenciales).
2. Crear la Release en GitHub (puedo generar la release desde la etiqueta `v0.2.1-roles`).
3. Revisar y resolver las advertencias de React Hook `exhaustive-deps` si se desea comportamiento estricto.

Notas técnicas
- Branch: `publish/roles-changes-20260210`.
- Tag creado: `v0.2.1-roles`.
- Archivos clave: `frontend/scripts/e2e_approvals_flow.js`, `backend/server.py`, `frontend/src/components/sales/SaleForm.jsx` (ajustes de persistencia de borrador), `frontend/src/pages/CustomersPage.jsx`.

Contacto
- Si quieres que empuje las imágenes, dime: registro (Docker Hub / GHCR / otro), nombre del repositorio objetivo y credenciales (o autorización para usar tu sesión Docker actual).

---

## Control de cambios — 2026-02-24

Estado de cierre
- Gate completo de pre-publicación ejecutado y aprobado en local (`scripts/pre_publish_gate.ps1`).
- Resultado: **PRE-PUBLICACION APROBADA** con base URL validada en `http://127.0.0.1:8001`.

Alcance funcional entregado
- Integración de decodificador VIN (vPIC) con opción manual/fallback para registro de cliente/vehículo.
- Endpoint backend habilitado: `GET /vehicles/decode-vin`.
- Reemplazo de imágenes de tarjetas por miniaturas de vehículo según color (con fallback SVG).

Verificaciones ejecutadas en gate
- Validación de contenedores clave: OK.
- Health check backend: OK.
- Prueba rápida de drafts backup: OK.
- Suite crítica backend (PIN, lockout, técnicos, importación): OK.
- Build frontend producción: OK.

Nota operativa
- Se mantiene advertencia no bloqueante en build por `ESLintWebpackPlugin` faltante; no impidió compilación ni aprobación del gate.

Estandar operativo (sin VS Code)
- A partir de esta fecha, toda publicación local debe ejecutarse con el flujo Docker Desktop unificado:
	- `powershell -ExecutionPolicy Bypass -File .\scripts\publish_via_docker_desktop.ps1`
- Para Windows (doble clic): `publish-docker-desktop.bat`.
- Para apagar servicios por doble clic: `stop-docker-desktop.bat`.
- Para apagado total por doble clic (`docker compose down`): `stop-docker-desktop-full.bat`.
- Este flujo aplica gate obligatorio pre-publicación, reconstruye/actualiza contenedores, valida disponibilidad de frontend y backend, y deja el entorno publicado.

Checklist operativo LAN (5 puntos)
- Ejecutar `publish-docker-desktop.bat`.
- Confirmar en Docker Desktop que `mundo-frontend`, `mundo-backend` y `mundo-mongodb` estén en Running.
- Verificar local: `http://localhost:3000`.
- Compartir en red: `http://<IP_LOCAL>:3000`.
- Si otra PC no abre: validar misma red, firewall puerto 3000 y recarga completa del navegador.

---

## Control de cambios — 2026-02-25

Estado de cierre
- Smoke final de Kardex ejecutado y aprobado en entorno local: **PASS=7 | FAIL=0**.
- Build activo verificado en frontend (`main.698050e8.js`) y servicios `backend/frontend/mongodb` en `Up`.

Alcance funcional entregado
- Inventario reorganizado en pestañas: `Inventario` y `Kardex`.
- Kardex: filtro por usuario específico con buscador y formato de lista `Nombre - Rol - Sucursal`.
- Kardex: buscador en selector de productos (por nombre o SKU).
- Kardex export: filtros por usuario/producto disponibles para CSV/Excel/PDF.

Ajuste de localización (UX)
- Exportaciones de Kardex ahora muestran nombres de bodegas en español (ej. `Bodega Central`) en lugar de IDs técnicos (`wh_main`) cuando aplica.
- Se añadió fallback de nombres en español para IDs de bodega conocidos en caso de registros históricos sin enriquecimiento.

Evidencia rápida
- Export filtrado de smoke: `test_reports/kardex_smoke_final.csv`.
- Export filtrado actor+producto: `test_reports/kardex_check_actor_product.csv`.

---

## Control de cambios — 2026-02-25 (Módulo RRHH)

Estado de cierre
- Módulo de Recursos Humanos incorporado en backend y frontend.
- Ruta frontend habilitada: `/human-resources`.
- Endpoint de validación: `GET /api/hr/summary`.

Alcance funcional entregado
- **Reloj marcador por PIN**: entrada laboral, salida/entrada de almuerzo y salida laboral.
- **Control laboral y nómina**: vacaciones, permisos, subsidios, viáticos, horas extras, bonificaciones, penalizaciones, multas y sanciones (ajustes).
- **Gestión de personal**: contrataciones, despidos, ascensos y sanciones.
- **Operación**: gastos operativos y órdenes de compra de insumos.
- **Herramientas por técnico** (instalador/eléctrico/polarizador): asignaciones, auditorías quincenales y descuentos automáticos por faltantes.

Regla quincenal implementada
- Programación de auditoría de herramientas dos veces por mes (corte 1 y 15).
- Al aplicar deducciones sobre auditoría con faltantes, se generan ajustes de nómina tipo `tool_missing_deduction`.

Smoke RRHH ejecutado
- Marcación por PIN: OK.
- Ajuste de nómina: OK.
- Vacación/permiso/subsidio: OK.
- Movimiento de personal: OK.
- Gasto operativo: OK.
- Orden de compra: OK.
- Asignación herramienta + auditoría + descuentos: OK.

---

## Control de cambios — 2026-02-25 (Reloj marcador kiosco)

Estado de cierre
- Pantalla kiosco de marcación habilitada y publicada en frontend.
- Ruta kiosco operativa: `/attendance-clock`.

Alcance funcional entregado
- Interfaz de reloj marcador tipo PIN pad numérico (estilo login) en formato de pantalla operativa.
- Integración de endpoint dedicado de marcación kiosco con secuencia automática por día:
	- Entrada a labores
	- Salida a almuerzo
	- Entrada de almuerzo
	- Salida laboral
- Reglas de horario activas en backend:
	- Entrada: 07:00 a 08:10
	- Salida a almuerzo: 10:00 a 16:00
	- Salida laboral: 17:30 (L-V), 16:00 (sábado), domingo no laborable

Seguridad y configuración
- PIN especial para abrir el reloj desde login movido a variable de entorno (sin hardcode en pantalla de login).
- Variable preferida: `VITE_ATTENDANCE_KIOSK_SHORTCUT_PIN`.
- Compatibilidad transitoria: `REACT_APP_ATTENDANCE_KIOSK_SHORTCUT_PIN`.
- Configurada en Docker Compose para `frontend` (build args + environment).

Verificación rápida
- `GET /attendance-clock` respondió 200.
- `env.js` publicado contiene `__ATTENDANCE_KIOSK_SHORTCUT_PIN__`.

---

## Control de cambios — 2026-02-26 (Alineación documental y soporte PIN)

Estado de cierre
- Documentación principal alineada al modelo PIN vigente.
- Fecha de build documental actualizada para trazabilidad operativa.

Alcance funcional/documental
- Login confirmado con **PIN de 8 dígitos**.
- Marcación kiosco confirmada con **PIN de 4 dígitos**.
- Script de soporte agregado para desbloqueo/reset de PIN de login:
	- `scripts/support_reset_login_pin.ps1`
	- `reset-login-pin.bat`

Validación rápida
- Ejecución de desbloqueo por soporte validada en entorno local para usuario de operación.

---

## Control de cambios — 2026-02-27 (Suite extendida + branding TopCar)

Estado de cierre
- Suite extendida post-publicación actualizada y validada en local.
- Branding TopCar actualizado con nueva fuente 16:9 y assets regenerados.

Alcance funcional/documental
- Script de validación post-publicación extendida ahora incluye:
	- `frontend/e2e/login_reset_button_visual.spec.js`
- Documentación operativa actualizada en `README.md` con comando y criterio de aprobación de la suite.
- Reprocesamiento de branding TopCar aplicado a:
	- `frontend/public/topcar-logo.png`
	- `frontend/public/topcar-favicon-32.png`

Validación rápida
- `./scripts/post_publish_extended_suite.ps1` ejecutado con resultado **7 passed** y salida final `Suite extendida post-publicación: OK`.

---

## Registro automÃ¡tico post-publicaciÃ³n

- 2026-02-27 11:01:54 | estado=OK | detalle=Suite Playwright + branding TopCar completadas.

---

## Registro automÃ¡tico post-publicaciÃ³n

- 2026-02-27 11:32:08 | estado=OK | detalle=Suite Playwright + branding TopCar y Mundo completadas.

---

## Registro automÃ¡tico post-publicaciÃ³n

- 2026-02-27 11:40:52 | estado=OK | detalle=Suite Playwright + branding TopCar y Mundo completadas.

---

## Control de cambios — 2026-02-27 (Limpieza typo de rol)

Estado de cierre
- Limpieza definitiva del typo de rol `progrmador` completada en código y datos persistidos.

Alcance aplicado
- Backend/frontend mantenidos con rol canónico `programador`.
- Verificación de base de datos ejecutada sobre colecciones:
	- `users`
	- `custom_roles`
	- `role_permissions`

Validación rápida
- Resultado de migración: `users 0 0`, `custom_roles 0 0`, `role_permissions 0 0`.
- Remanente final: `remaining 0 0 0` para `role = progrmador`.

---

## Control de cambios — 2026-02-27 (Rol Cajero para facturación)

Estado de cierre
- Rol `cajero` promovido a catálogo oficial del sistema (ya no depende solo de `custom_roles`).

Alcance aplicado
- Permisos por defecto habilitados para gestión de facturación y cliente:
	- `sales`, `quotations`, `credits`, `returns`
	- `customers`, `vehicles`, `followups`
- Visibilidad de ventas/cotizaciones para `cajero` alineada con `ventas` (scope por usuario).
- Endpoints de operación de facturas habilitados para `cajero` (estado de cotización, créditos, envío de factura, devoluciones).

Validación rápida
- `GET /api/roles` devuelve `cajero` con metadatos oficiales.

---

## Registro automÃ¡tico post-publicaciÃ³n

- 2026-02-27 17:54:02 | estado=FAIL | detalle=Suite extendida post-publicaciÃ³n fallÃ³ (exit code 1).

---

## Registro automÃ¡tico post-publicaciÃ³n

- 2026-02-27 17:55:06 | estado=OK | detalle=Suite Playwright + branding TopCar y Mundo completadas.

---

## Registro automÃ¡tico post-publicaciÃ³n

- 2026-03-03 08:57:29 | estado=FAIL | detalle=Suite extendida post-publicaciÃ³n fallÃ³ (exit code 1).

---

## Registro automÃ¡tico post-publicaciÃ³n

- 2026-03-03 08:59:36 | estado=FAIL | detalle=VerificaciÃ³n de branding TopCar fallÃ³ (exit code 1).

---

## Registro automÃ¡tico post-publicaciÃ³n

- 2026-03-03 09:03:14 | estado=OK | detalle=Suite Playwright + branding TopCar y Mundo completadas.

---

## Control de cambios — 2026-03-03 (Usuarios requeridos + publicación completa)

Estado de cierre
- Flujo completo ejecutado y aprobado: pre-publicación, rebuild/publicación de contenedores y post-publicación.
- Resultado final: **PRE-PUBLICACION APROBADA** + **Suite extendida post-publicación: OK**.

Alcance aplicado
- Gestión de usuarios PIN actualizada con campos requeridos de operación:
	- `name`, `last_name`, `phone`, `login_pin`, `role`, `branch_id`.
- Edición de usuario habilitada para `recursos_humanos`, `gerencia` y `programador`.
- UI de Usuarios actualizada para mostrar `Apellidos` en:
	- tabla principal de usuarios PIN
	- tabla de PIN Kiosko

Correcciones para estabilidad de validación
- Pruebas backend ajustadas al nuevo contrato de creación PIN:
	- `backend/tests/test_pin_integration.py`
	- `backend/tests/test_pin_lockout.py`
- Pruebas E2E/post-publicación ajustadas al nuevo payload y PIN vigente de Xinon.
- Verificadores de branding (`TopCar` y `Mundo`) robustecidos para reintentar login tras reset automático de PIN cuando el valor sembrado cambie.

Verificación operativa ejecutada
- `scripts/pre_publish_gate.ps1`: OK.
- `scripts/publish_via_docker_desktop.ps1`: OK (contenedores reconstruidos/actualizados).
- `scripts/post_publish_extended_suite.ps1`: OK (`7 passed` + branding TopCar/Mundo OK).
- Estado final de servicios:
	- `mundo-frontend` Up
	- `mundo-backend` Up
	- `mundo-mongodb` Up
