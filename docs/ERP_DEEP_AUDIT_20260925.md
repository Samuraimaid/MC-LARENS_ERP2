# McLarens ERP — Deep Audit LIVE + Repo

**Cuándo:** 2026-09-24 11:50 PM CT (America/Managua)  
**Base live:** https://mclarens-erp-836176703716.us-central1.run.app  
**Repo:** Samuraimaid/MC-LARENS_ERP2 `master` (@7d980fd5 local)  
**JSON:** `/workspace/erp_deep_audit_20260925.json`  
**Probe raw:** `/workspace/audit_live_probe_20260925.json`

## Resumen ejecutivo

- Contadores: **P0=5 · P1=5 · P2=4** (incluye 1 control positivo P2).
- Los 7 dead-ends conocidos **siguen vigentes** (attendance Test*, KDS tech vacío sin assign, coords PIN, seed bodegas↔entregador, legacy cobrar en FE, BOLA branch-peer by design, rate-limit OK con spacing).
- **Nuevo P0 crítico de authz:** `ROLE_EQUIVALENCE["recursos_humanos"]="gerencia"` → RRHH crea productos (y hereda todo `require_roles` que liste gerencia). Contradice `HYPERVISOR_READONLY_ROLES`.
- **KDS root cause (código):** `build_work_order_visibility_query` fuerza `technician_id=user.user_id` para instalaciones/electrico/polarizador → cola unassigned invisible. Tras assign a branch techs con att PIN válido, esos techs sí ven sus cards; Test* no.
- **Attendance:** att pins branch (4110/4106/4107) OK; Test* 4455/6677/7788 inválidos; assign a Diego/Joaquin/Ariana → 200; Test* → Ausente.
- **Caja:** `POST /cashier/invoices/{id}/collect` con `sesion_id` rechaza factura ya pagada (OK). FE aún usa legacy `/caja/facturas/.../cobrar`.
- **QC gate OK:** completed/delivered sin QC → 400.
- **Side-effects de auditoría (no prod wipe):** assigns a Diego/Joaquin/Ariana; clock-ins; productos AUDIT_* desactivados; tint reasignado. Xinon PIN intacto.

### Top hallazgos
1. P0 Authz RH≡gerencia  
2. P0 PIN sync (coords + bodegas/entregador + Mia + Test att)  
3. P0 KDS unassigned oculto a técnicos  
4. P1 FE cobrar legacy  
5. P1 WO cross-tech status PUT  

## Hallazgos P0

### P0-ATT-TEST-PINS — Attendance PINs Test* técnicos inválidos → Ausente → no se puede asignar WO
- **Síntoma:** Clock-in con 4455/6677/7788 → 401 PIN inválido. Assign a Test Instalaciones/Eléctrico/Polarizador → 400 '... no está disponible: Ausente'.
- **Evidencia:** `{"live_clock_in": [{"name": "Test Instalaciones", "att_pin": "4455", "login_pin": "44556677", "http": 401, "detail": "{'error': 'UNAUTHORIZED', 'message': 'PIN inválido', 'status_code': 401, 'path': '/api/hr/timeclock/kiosk-punch'}", "verdict": "CLOCK_FAIL"}, {"name": "Test Eléctrico", "att_pin": "6677", "login_pin": "66778899", "http": 401, "detail": "{'error': 'UNAUTHORIZED', 'message': 'PIN inválido', 'status_code': 401, 'path': '/api/hr/timeclock/kiosk-punch'}", "verdict": "CLOCK_FAIL"}, {"name": "Test Polarizador", "att_pin": "7788", "login_pin": "77889900", "http": 401, "detail": "{'error': 'UNAUTHORIZED', 'message': 'PIN inválido', 'status_code': 401, 'path': '/api/hr/timeclock/kiosk-punch'}", "verdict": "CLOCK_FAIL"}], "live_assign": [{"wo": "wo_426322a9", "tech": "Test Instalaciones", "tech_id": "user_seed_5c90443cf0", "tech_role": "instalaciones", "http": 400, "detail": "{'erro`
- **Impacto taller:** Cola de taller no se puede asignar a usuarios Test*; bloquea flujo coordinador→técnico en ambientes QA y degradación si prod usa mismos seeds.
- **Fix sugerido:** Resync attendance_pin_hash desde pins_table.json (4455/6677/7788) vía scripts/sync_seed_users_pins.py o admin PIN reset; verificar kiosk-punch.
- **Tamaño:** S (seed/ops) · **Pack:** 1
- **Files:** backend/data/seeds/pins_table.json, scripts/sync_seed_users_pins.py, backend/domains/hr/attendance_status.py

### P0-PIN-COORD — Login PINs coordinadores fallan (usuarios existen)
- **Síntoma:** 00130009 coordinador_instalaciones y 00140000 coordinador_polarizados → 401 PIN incorrecto. Users activos en /users.
- **Evidencia:** `{"login": [{"name_seed": "Test Coord. Instalaciones", "role_seed": "coordinador_instalaciones", "login_pin": "00130009", "attendance_pin": "0013", "http": 401, "verdict": "FAIL", "name_live": null, "role_live": null, "branch_live": null, "detail": "{'message': 'PIN incorrecto', 'remaining_attempts': 4, 'failed_attempts': 1, 'max_attempts': 5, 'lockout_until': None, 'lockout_seconds': 0, 'status_c", "branch_seed": "Todas / Central"}, {"name_seed": "Test Coord. Polarizados", "role_seed": "coordinador_polarizados", "login_pin": "00140000", "attendance_pin": "0014", "http": 401, "verdict": "FAIL", "name_live": null, "role_live": null, "branch_live": null, "detail": "{'message': 'PIN incorrecto', 'remaining_attempts': 4, 'failed_attempts': 1, 'max_attempts': 5, 'lockout_until': None, 'lockout_seconds': 0, 'status_c", "branch_seed": "Todas / Central"}], "users_exist": {"Test Coord. Instalacion`
- **Impacto taller:** Sin coordinadores no hay tablero operativo de asignación por depto; gerencia debe intervenir manualmente.
- **Fix sugerido:** Reset login_pin_hash de ambos a 00130009 / 00140000; sync att 0014 para coord polarizados.
- **Tamaño:** S (seed/ops) · **Pack:** 1
- **Files:** scripts/sync_seed_users_pins.py, backend/data/seeds/pins_table.json

### P0-PIN-BODEGAS-SWAP — Seed drift: 33445566 es entregador; Test Bodegas / Mia Andres / 00150005 rotos
- **Síntoma:** PIN 33445566 (tabla: Test Bodegas) login → Test Entregador/entregador. 00150005 entregador 401. Mia Andres 41090003 login+att 401. Test Bodegas user existe con role bodegas pero sin PIN tabla.
- **Evidencia:** `{"login_swap": {"name_seed": "Test Bodegas", "role_seed": "bodegas", "branch_seed": "Todas / Central", "login_pin": "33445566", "attendance_pin": "3344", "http": 200, "name_live": "Test Entregador", "role_live": "entregador", "branch_live": "branch_main", "user_id": "user_seed_0d85a2c577", "match_role": false, "match_name": false, "verdict": "ROLE_SWAP"}, "fails": [{"name_seed": "Test Entregador", "role_seed": "entregador", "login_pin": "00150005", "attendance_pin": "0015", "http": 401, "verdict": "FAIL", "name_live": null, "role_live": null, "branch_live": null, "detail": "{'message': 'PIN incorrecto', 'remaining_attempts': 2, 'failed_attempts': 3, 'max_attempts': 5, 'lockout_until': None, 'lockout_seconds': 0, 'status_c", "branch_seed": "Todas / Central"}, {"name_seed": "Mia Andres", "role_seed": "bodegas", "login_pin": "41090003", "attendance_pin": "4109", "http": 401, "verdict": "FAI`
- **Impacto taller:** No hay Test Bodegas usable en wh_main; despachos main dependen de gerencia. Entregador seed PIN muerto.
- **Fix sugerido:** Reasignar login/att pins según pins_table: Test Bodegas=33445566/3344, Test Entregador=00150005/0015, Mia Andres=41090003/4109.
- **Tamaño:** S (seed/ops) · **Pack:** 1
- **Files:** scripts/sync_seed_users_pins.py, backend/data/seeds/pins_table.json

### P0-AUTHZ-RH-AS-GERENCIA — ROLE_EQUIVALENCE mapea recursos_humanos→gerencia: RH puede mutar catálogo
- **Síntoma:** POST /products como Test Recursos Humanos → 200 crea producto. Código require_roles([gerencia,supervisor,bodegas,jefe_tienda]) pero resolve_effective_role('recursos_humanos')=='gerencia'.
- **Evidencia:** `{"live": [{"actor": "recursos_humanos", "role": "recursos_humanos", "method": "POST", "path": "/products", "http": 200, "detail": "{'name': 'AUDIT_SHOULD_FAIL', 'sku': 'AUDIT_X', 'price': 1.0, 'created_at': '2026-09-25T05:47:46.410748+00:00', 'product_id': 'product_73be0c255747', 'precio1': 1.0, 'precio2': 0.9", "flag": "UNEXPECTED_ALLOW"}, {"actor": "recursos_humanos", "role": "recursos_humanos", "method": "POST", "path": "/inventory/adjust", "http": 405, "detail": "Method Not Allowed"}, {"actor": "recursos_humanos", "role": "recursos_humanos", "method": "POST", "path": "/sales", "http": 403, "detail": "{'error': 'FORBIDDEN_ROLE', 'message': \"El rol 'recursos_humanos' no está autorizado para realizar esta creación de venta.\", 'allowed_roles': ['jefe_tienda', 'ventas', 'gerencia', "}, {"actor": "recursos_humanos", "role": "recursos_humanos", "method": "DELETE", "path": "/caja/facturas/`
- **Impacto taller:** RRHH obtiene privilegios de gerencia en todo require_roles que incluya gerencia (productos, y potencialmente caja/stock/otros).
- **Fix sugerido:** Quitar 'recursos_humanos':'gerencia' de ROLE_EQUIVALENCE; usar allowlist explícita por endpoint. Respetar HYPERVISOR_READONLY_ROLES.
- **Tamaño:** M · **Pack:** 1
- **Files:** backend/server.py

### P0-KDS-TECH-FILTER — KDS /kds/orders oculta cola pending/unassigned a técnicos (solo ven technician_id=self)
- **Síntoma:** Gerencia ve 4 WOs; Test Instalaciones/Eléctrico/Polarizador ven 0. Tras assign a Diego/Joaquin/Ariana, esos branch techs sí ven sus WOs; Test* siguen en 0.
- **Evidencia:** `{"pre": {"gerencia": {"orders": 4, "role": "gerencia"}, "ventas": {"orders": 4, "role": "ventas"}, "instalaciones": {"orders": 0, "role": "instalaciones"}, "electrico": {"orders": 0, "role": "electrico"}, "polarizador": {"orders": 0, "role": "polarizador"}, "bodegas_north": {"orders": 0, "role": "bodegas"}, "supervisor": {"orders": 4, "role": "supervisor"}, "entregador_maybe": {"orders": 4, "role": "entregador"}}, "post_assign": {"instalaciones": {"orders": 0, "name": "Test Instalaciones"}, "electrico": {"orders": 0, "name": "Test Eléctrico"}, "polarizador": {"orders": 0, "name": "Test Polarizador"}, "diego": {"orders": 2, "name": "Diego Ariana"}, "joaquin": {"orders": 1, "name": "Joaquin Sofia"}, "ariana": {"orders": 1, "name": "Ariana Sebastian"}, "gerencia": {"orders": 4, "name": "Xinon"}}, "code": "build_work_order_visibility_query: electrico/instalaciones/polarizador set technician_`
- **Impacto taller:** Técnico no ve trabajos pendientes de su depto hasta que alguien se los asigne; si assign falla (Ausente) el KDS queda vacío — dead-end de piso.
- **Fix sugerido:** Para roles técnicos: permitir department match AND (technician_id=self OR technician_id null/unassigned). Coordinadores ya ven depto completo.
- **Tamaño:** M · **Pack:** 1
- **Files:** backend/server.py (build_work_order_visibility_query), frontend/src/pages/kds/KDSInstallationsPage.jsx


## Hallazgos P1

### P1-FE-COBRAR-LEGACY — CashierPage UI sigue posteando /caja/facturas/.../cobrar (legacy)
- **Síntoma:** frontend CashierPage.jsx axios.post(.../caja/facturas/${sale_id}/cobrar). Path preferido con idempotencia F1: /cashier/invoices/.../collect. Legacy exige schema pagos[].monto_origen; collect rechaza 'ya pagada' correctamente.
- **Evidencia:** `{"fe": "frontend/src/pages/CashierPage.jsx:~1458", "live_legacy": [], "live_collect": [{"path": "POST /cashier/invoices/sale_a52b7c96c8cf/collect", "http": 400, "detail": "{'error': 'BAD_REQUEST', 'message': \"El campo 'sesion_id' es requerido\", 'status_code': 400, 'path': '/api/cashier/invoices/sale_a52b7c96c8cf/collect'}"}, {"path": "collect_no_session", "http": 400, "detail": "{'error': 'BAD_REQUEST', 'message': \"El campo 'sesion_id' es requerido\", 'status_code': 400, 'path': '/api/cashier/invoices/sale_a52b7c96c8cf/collect'}"}, {"path": "collect_paid_retry", "http": 400, "detail": "{'error': 'BAD_REQUEST', 'message': \"El campo 'sesion_id' es requerido\", 'status_code': 400, 'path': '/api/cashier/invoices/sale_a52b7c96c8cf/collect'}"}]}`
- **Impacto taller:** Riesgo de cobros fallidos / schemas divergentes; dual-path complica idempotencia y tests.
- **Fix sugerido:** Cambiar FE a POST /cashier/invoices/{id}/collect (mantener adapter legacy server-side o deprecar con 410).
- **Tamaño:** S · **Pack:** 2
- **Files:** frontend/src/pages/CashierPage.jsx, backend/server.py

### P1-WO-CROSS-TECH-STATUS — Cualquier técnico autenticado puede PUT status en WO de otro (solo require_auth)
- **Síntoma:** Test Instalaciones PUT /work-orders/wo_426322a9 (asignada a Diego Ariana) status=in_progress → 200. update_work_order no valida technician_id==actor ni ownership.
- **Evidencia:** `{"live": [{"test_inst_progress_others_wo": 200, "detail": "{\"message\":\"Work order updated\"}"}, {"diego_progress_own": 401, "detail": "{\"error\":\"UNAUTHORIZED\",\"message\":\"Unauthorized\",\"status_code\":401,\"path\":\"/api/work-orders/wo_426322a9\"}"}], "code": "async def update_work_order: user=await require_auth(request)  # no ownership check on status"}`
- **Impacto taller:** Contaminación de estados / comisiones / KDS; técnico puede mover OT ajenas.
- **Fix sugerido:** Si role in field techs: exigir wo.technician_id==user.user_id (o null para self-claim). Supervisores/coords/gerencia exentos.
- **Tamaño:** S · **Pack:** 2
- **Files:** backend/server.py

### P1-JEFE-EQUIV-SUPERVISOR — ROLE_EQUIVALENCE eleva jefe_tienda/jefe_vendedores a supervisor en require_roles
- **Síntoma:** Mismo mecanismo que RH→gerencia: jefe_* pasan checks pensados para supervisor.
- **Evidencia:** `{"code": "ROLE_EQUIVALENCE jefe_vendedores/jefe_tienda → supervisor"}`
- **Impacto taller:** Superficie de privilegio mayor a la documentada; puede mutar operaciones de supervisor.
- **Fix sugerido:** Reemplazar equivalence global por grant lists explícitas por endpoint.
- **Tamaño:** M · **Pack:** 2
- **Files:** backend/server.py

### P1-TINT-NO-ATTENDANCE — Assign de tint-orders NO valida asistencia (inconsistente vs WO)
- **Síntoma:** PUT /tint-orders/TINT-9CAFDAAE/assign?technician_id=Test Polarizador → 200 aunque att pin 7788 inválido / Ausente en WO.
- **Evidencia:** `{"live": [{"tint_assign_q": "Test Polarizador", "http": 200, "detail": "{\"message\":\"Orden de polarizado asignada\",\"tint_order_id\":\"TINT-9CAFDAAE\",\"technician_id\":\"user_seed_5590b3196b\",\"technician_name\":\"Test Polarizador\"}"}, {"tint_assign_q": "Ariana Sebastian", "http": 200, "detail": "{\"message\":\"Orden de polarizado asignada\",\"tint_order_id\":\"TINT-9CAFDAAE\",\"technician_id\":\"user_91bc0707a7de\",\"technician_name\":\"Ariana Sebastian\"}"}], "code": "assign_tint_order: no build_technician_attendance_snapshot"}`
- **Impacto taller:** Se puede asignar polarizado a ausente; WO del mismo tech sí bloquea.
- **Fix sugerido:** Reusar gate de attendance de WO en assign_tint_order (misma snapshot).
- **Tamaño:** S · **Pack:** 2
- **Files:** backend/server.py

### P1-SELF-PROGRESS-WITHOUT-ASSIGN — Técnico puede avanzar WO pending→in_progress→quality_check sin assignment
- **Síntoma:** E2E previo + código: PUT status no exige assignment_status=assigned. Known WOs quedaron quality_check con technician_id null antes del audit assign.
- **Evidencia:** `{"known_wos_before_assign": "technician_id null + quality_check + pending_assignment", "code": "update_work_order status branch sin check assignment"}`
- **Impacto taller:** Bypass del flujo coordinador; métricas de asignación/comisión inconsistentes.
- **Fix sugerido:** Opcional policy: status≠pending requiere technician_id; o auto-claim on first in_progress.
- **Tamaño:** S · **Pack:** 2
- **Files:** backend/server.py


## Hallazgos P2

### P2-MISSING-ROUTES — Rutas conveniencia 404 (/tint-orders/pending, /dispatch/pending, /dispatch-orders, /coordinador/board)
- **Síntoma:** Probes GET → 404 API route not found / Tint order not found. Rutas reales: PUT /tint-orders/{id}/assign|start|window|complete; PUT /dispatch/{id}/start|deliver-item; GET /coordinator/board (EN).
- **Evidencia:** `{"workflows": [{"path": "/coordinador/board", "http": 404, "detail": "{'error': 'NOT_FOUND', 'message': 'API route not found', 'status_code': 404, 'path': '/api/coordinador/board'}"}, {"path": "/tint-orders/pending", "http": 404, "detail": "{'error': 'NOT_FOUND', 'message': 'Tint order not found', 'status_code': 404, 'path': '/api/tint-orders/pending'}"}, {"path": "/dispatch/pending", "http": 404, "detail": "{'error': 'NOT_FOUND', 'message': 'Dispatch order not found', 'status_code': 404, 'path': '/api/dispatch/pending'}"}, {"path": "/dispatch-orders?limit=10", "http": 404, "detail": "{'error': 'NOT_FOUND', 'message': 'API route not found', 'status_code': 404, 'path': '/api/dispatch-orders'}"}, {"path": "/tint-orders/TINT-9CAFDAAE/assign", "http": 405, "detail": "Method Not Allowed"}, {"path": "/tint-orders/TINT-9CAFDAAE/start", "http": 405, "detail": "Method Not Allowed"}, {"path": "/ti`
- **Impacto taller:** Scripts/FE legacy pueden apuntar a paths muertos; confusión ops.
- **Fix sugerido:** Documentar paths canónicos; aliases 308 o eliminar refs FE.
- **Tamaño:** S · **Pack:** 2
- **Files:** backend/server.py, frontend/src

### P2-BOLA-BRANCH-PEER — Visibilidad same-branch peer sales (no owner-only) para roles con branch_id
- **Síntoma:** build_sales_visibility_query: ventas/cajero=owner-only; otros con branch_id ven toda la sucursal. Ventas Test vio 4 sales (propias campos seller_* escasos en payload).
- **Evidencia:** `{"code": "build_sales_visibility_query", "note": "Prior known #6 — by design?"}`
- **Impacto taller:** Bajo si es diseño multi-vendedor piso; riesgo BOLA si se esperaba owner-only para más roles.
- **Fix sugerido:** Confirmar producto: documentar o endurecer owner-only donde aplique.
- **Tamaño:** S (policy) · **Pack:** 2
- **Files:** backend/server.py, backend/core/authz_bola.py

### P2-RATE-LIMIT-LOGIN — Rate limit login intermitente en matrices multi-PIN
- **Síntoma:** Varios 429 RATE_LIMIT_EXCEEDED en ráfagas; retries OK tras espera.
- **Evidencia:** `{"examples": [{"name_seed": "Test Coord. Instalaciones", "role_seed": "coordinador_instalaciones", "branch_seed": "Todas / Central", "login_pin": "00130009", "attendance_pin": "0013", "http": 429, "verdict": "RATE_LIMIT", "detail": "{'error': 'RATE_LIMIT_EXCEEDED', 'message': 'Demasiados intentos de acceso en pocos segundos. Por favor espera antes de reintentar.', 'retry_after_seconds': 2}"}, {"name_seed": "Test Gerencia", "role_seed": "gerencia", "branch_seed": "Todas / Central", "login_pin": "00010009", "attendance_pin": "0001", "http": 429, "verdict": "RATE_LIMIT", "detail": "{'error': 'RATE_LIMIT_EXCEEDED', 'message': 'Demasiados intentos de acceso en pocos segundos. Por favor espera antes de reintentar.', 'retry_after_seconds': 1}"}, {"name_seed": "Test Jefe de Vendedores", "role_seed": "jefe_vendedores", "branch_seed": "Todas / Central", "login_pin": "00060003", "attendance_pin": "`
- **Impacto taller:** E2E/ops scripts frágiles; no afecta usuario único normal.
- **Fix sugerido:** Backoff en runners; header bypass solo staging.
- **Tamaño:** S · **Pack:** 2
- **Files:** backend/middlewares/rate_limit.py

### P2-QC-GATE-OK — (Control positivo) Completar WO sin QC aprobado correctamente bloqueado
- **Síntoma:** PUT status=completed/delivered sin QC → 400. /quality-control/pending → 3 items.
- **Evidencia:** `{"workflows": [{"path": "PUT /work-orders/wo_abfe09bb status=completed", "http": 400, "detail": "{'error': 'BAD_REQUEST', 'message': 'No se puede marcar como Completado sin un Control de Calidad aprobado. Use POST /quality-control con approved=true.', 'status_code': 400, 'path': '/api/work-orders"}, {"path": "PUT /work-orders/wo_abfe09bb status=delivered", "http": 400, "detail": "{'error': 'BAD_REQUEST', 'message': 'No se puede marcar como Entregado sin aprobación de Control de Calidad (QC_Passed). Envíe la orden a QC y obtenga aprobación del supervisor.', 'status_code': 400, "}]}`
- **Impacto taller:** N/A — comportamiento correcto.
- **Fix sugerido:** Mantener; no cambiar en deploy de unblock.
- **Tamaño:** n/a · **Pack:** None


## Matriz seed drift (login + attendance)

| PIN login | Seed name/role | Live name/role | Login | Att pin | Att result |
|---|---|---|---|---|---|
| ***0002 | Leonardo Mariana/bodegas | Leonardo Mariana / bodegas | OK (200) | 4120 | n/a |
| ***0003 | Mia Andres/bodegas | - / - | FAIL (401) | 4109 | CLOCK_FAIL |
| ***5566 | Test Bodegas/bodegas | Test Entregador / entregador | ROLE_SWAP (200) | 3344 | CLOCK_OK |
| ***0005 | Emiliano Mia/cajero | Emiliano Mia / cajero | OK (200) | 4104 | n/a |
| ***4455 | Test Cajero/cajero | Test Cajero / cajero | OK (200) | 2233 | n/a |
| ***0009 | Test Coord. Instalaciones/coordinador_instalaciones | - / - | FAIL (401) | 0013 | CLOCK_OK |
| ***0000 | Test Coord. Polarizados/coordinador_polarizados | - / - | FAIL (401) | 0014 | CLOCK_FAIL |
| ***0002 | Joaquin Sofia/electrico | Joaquin Sofia / electrico | OK (200) | 4106 | CLOCK_OK |
| ***8899 | Test ElÃ©ctrico/electrico | Test Eléctrico / electrico | OK (200) | 6677 | n/a |
| ***0005 | Test Entregador/entregador | - / - | FAIL (401) | 0015 | CLOCK_FAIL |
| ***0018 | Test Admin/gerencia | Test Admin / gerencia | OK (200) | 1018 | n/a |
| ***0009 | Test Gerencia/gerencia | Test Gerencia / gerencia | OK (200) | 0001 | n/a |
| ***0000 | Valeria Emiliano/gerencia | Valeria Emiliano / gerencia | OK (200) | 4101 | n/a |
| ***1990 | Xinon/gerencia | Xinon / gerencia | OK (200) | 0101 | n/a |
| ***0002 | Diego Ariana/instalaciones | Diego Ariana / instalaciones | OK (200) | 4110 | CLOCK_OK |
| ***6677 | Test Instalaciones/instalaciones | Test Instalaciones / instalaciones | OK (200) | 4455 | CLOCK_FAIL |
| ***0009 | Test Jefe de Tienda/jefe_tienda | Test Jefe de Tienda / jefe_tienda | OK (200) | 0007 | n/a |
| ***0003 | Test Jefe de Vendedores/jefe_vendedores | Test Jefe de Vendedores / jefe_vendedores | OK (200) | 0006 | n/a |
| ***0004 | Ariana Sebastian/polarizador | Ariana Sebastian / polarizador | OK (200) | 4107 | CLOCK_OK |
| ***9900 | Test Polarizador/polarizador | Test Polarizador / polarizador | OK (200) | 7788 | CLOCK_FAIL |
| ***0001 | Test Programador/programador | Test Programador / programador | OK (200) | 0016 | n/a |
| ***0011 | Test Recursos Humanos/recursos_humanos | Test Recursos Humanos / recursos_humanos | OK (200) | 8899 | n/a |
| ***0006 | Martina Dylan/supervisor | Martina Dylan / supervisor | OK (200) | 4103 | n/a |
| ***3344 | Test Supervisor/supervisor | Test Supervisor / supervisor | OK (200) | 1122 | n/a |
| ***0003 | Test Transporte/transporte | Test Transporte / transporte | OK (200) | 0010 | n/a |
| ***0004 | Camila/ventas | - / - | RATE_LIMIT (429) | 9201 | n/a |
| ***7788 | Test Ventas/ventas | Test Ventas / ventas | OK (200) | 5566 | n/a |

### Lectura rápida drift
- **ROLE_SWAP:** 33445566 → Test Entregador (seed decía Test Bodegas).
- **FAIL login:** 00130009 (coord inst, confirmado en retry), 00140000 (coord polar), 00150005 (entregador), 41090003 (Mia Andres).
- **Att FAIL:** 4455, 6677, 7788, 0014, 0015, 4109.
- **Att OK (branch):** 4110 Diego, 4106 Joaquin, 4107 Ariana.
- Users huérfanos de PIN (existen en DB, login seed muerto): coords, Mia, Test Entregador; Test Bodegas existe pero PIN robado por entregador.

## Mapa KDS (qué ve cada rol) — post-assign audit

| Actor | Role | /kds/orders | board counts | sample WO |
|---|---|---|---|---|
| instalaciones (Test Instalaciones) | instalaciones | 0 | {'bodega': 0, 'instalaciones': 0, 'electrico': 0, 'polarizados': 0} | - |
| electrico (Test Eléctrico) | electrico | 0 | {'bodega': 0, 'instalaciones': 0, 'electrico': 0, 'polarizados': 0} | - |
| polarizador (Test Polarizador) | polarizador | 0 | {'bodega': 0, 'instalaciones': 0, 'electrico': 0, 'polarizados': 0} | - |
| diego (Diego Ariana) | instalaciones | 2 | {'bodega': 0, 'instalaciones': 2, 'electrico': 0, 'polarizados': 0} | wo_426322a9(pending/Diego Ariana), wo_abfe09bb(quality_check/Diego Ariana) |
| joaquin (Joaquin Sofia) | electrico | 1 | {'bodega': 0, 'instalaciones': 0, 'electrico': 1, 'polarizados': 0} | wo_0d6f3733(quality_check/Joaquin Sofia) |
| ariana (Ariana Sebastian) | polarizador | 1 | {'bodega': 0, 'instalaciones': 0, 'electrico': 0, 'polarizados': 1} | wo_9e12c33c(quality_check/Ariana Sebastian) |
| gerencia (Xinon) | gerencia | 4 | {'bodega': 0, 'instalaciones': 2, 'electrico': 1, 'polarizados': 1} | wo_426322a9(pending/Diego Ariana), wo_9e12c33c(quality_check/Ariana Sebastian), wo_abfe09bb(quality_check/Diego Ariana) |

### Interpretación
| Rol | Ve unassigned pending depto? | Ve solo asignados a sí? | Notas |
|---|---|---|---|
| gerencia | Sí (todo) | — | counts full board |
| supervisor | Sí (branch) | — | igual gerencia en sample |
| ventas | Via sale visibility / WO link | — | vio 4 pre-assign |
| instalaciones/electrico/polarizador (Test*) | **No** | Sí, pero 0 si Ausente/no assign | dead-end |
| branch tech con assign | No unassigned ajenos | **Sí los suyos** | Diego 2, Joaquin 1, Ariana 1 |
| tint-orders | Sin filtro technician en backend | polarizador ve lista tint | inconsistente vs WO |
| bodegas | warehouse dispatches | — | 0 tras DSP completed |
| entregador (PIN swap) | branch fallback | — | vio 4 WOs pre-assign |

**¿Intencional?** Parcialmente: modelo “coordinador asigna → técnico ejecuta”. Pero con coords sin login + att Test* rotos + filtro `technician_id=self`, el piso ve KDS vacío. **Bug operativo** aunque el filtro sea “by design”.

## Plan de deploys mínimos (1–2)

### Deploy Pack 1 — **Ops unblock** (recomendado único si hay que elegir)
**Nombre sugerido PR:** `fix/ops-unblock-pins-kds-rh-authz-20260925`

| # | Fix | Finding | Archivos |
|---|---|---|---|
| 1 | Sync live PINs desde `pins_table.json` (login+att) | P0-ATT / P0-PIN-COORD / P0-PIN-BODEGAS-SWAP | `scripts/sync_seed_users_pins.py`, seed JSON, one-shot ops job |
| 2 | KDS tech ve unassigned de su department | P0-KDS-TECH-FILTER | `backend/server.py` `build_work_order_visibility_query` |
| 3 | Quitar RH→gerencia equivalence | P0-AUTHZ-RH-AS-GERENCIA | `backend/server.py` `ROLE_EQUIVALENCE` |

**Smoke pack 1:**
1. Login coords 00130009 / 00140000 OK  
2. 33445566 → Test Bodegas; 00150005 → entregador; 41090003 → Mia  
3. kiosk 4455/6677/7788 clock_in; assign Test* WO → 200  
4. Tech `/kds/orders?department=instalaciones` muestra pending unassigned  
5. RH `POST /products` → 403  

### Deploy Pack 2 — **Hygiene** (opcional, siguiente ventana)
**Nombre sugerido PR:** `fix/hygiene-cashier-wo-ownership-tint-att-20260925`

| # | Fix | Finding | Archivos |
|---|---|---|---|
| 1 | FE collect path | P1-FE-COBRAR-LEGACY | `frontend/src/pages/CashierPage.jsx` |
| 2 | WO status ownership | P1-WO-CROSS-TECH-STATUS (+ opcional self-progress policy) | `backend/server.py` `update_work_order` |
| 3 | Tint assign attendance | P1-TINT-NO-ATTENDANCE | `backend/server.py` `assign_tint_order` |
| 4 | Narrow jefe_* equivalence | P1-JEFE-EQUIV-SUPERVISOR | `backend/server.py` |

**Smoke pack 2:** cobro UI collect; tech A≠B WO 403; tint Ausente 400; double-collect 400.

## Confirmación known-list

| # | Known | ¿Sigue true? | Notas audit |
|---|---|---|---|
| 1 | Att 4455/6677/7788 → Ausente | **Sí** | Branch att OK; Test* fail |
| 2 | KDS pending hidden from tech | **Sí** | Root cause: technician_id filter |
| 3 | Coord PINs 00130009/00140000 fail | **Sí** | Users exist, active |
| 4 | Seed 33445566 entregador; 00150005 fail; Test Bodegas unknown | **Sí** | + Mia 41090003 fail |
| 5 | Legacy cobrar vs collect | **Sí (FE)** | Legacy endpoint vive; FE lo usa; collect más limpio/idempotente |
| 6 | Same-branch BOLA peer | **Sí / by design?** | ventas owner-only; otros branch scope |
| 7 | Rate limit hygiene OK | **Sí** | 429 solo en ráfaga; soft spacing OK |

## Notas método
- Auth live: `POST /api/auth/pin/login`; att: `POST /api/hr/timeclock/kiosk-punch`.
- Reuso IDs E2E; no se crearon ventas nuevas.
- GitHub MCP needsAuth; código vía clone local + `gh` auth OK.

---
_Generado para Xinon/Case · deep audit 20260925 · audit-only (sin implementar fixes)_
