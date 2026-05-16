# PARTE 15: TESTING STRATEGY

## 15.1 UNIT TESTS (backend/services/intervention_service.py)

```python
test_intervention_create:
  ✓ Crear case con documento válido
  ✓ Validar campos requeridos
  ✓ Generar intervention_id único
  ✓ Generar intervention_token
  ✓ Set state = "created"
  ✗ Rechazar documento inválido

test_intervention_assign:
  ✓ Supervisor asigna a sí mismo
  ✓ Validar supervisor tiene role "gerencia"
  ✓ Crear snapshot "before_intervention"
  ✓ state = "assigned"
  ✓ Validar no puede asignar si ya assigned
  ✗ Rechazar si no supervisor

test_lock_acquire:
  ✓ Adquirir lock global
  ✓ Validar document_version
  ✓ Generar lock_id único
  ✓ Set expires_at = +48h
  ✓ Prevenir dos locks mismo doc
  ✗ Fallar si documento locked ya

test_lock_heartbeat:
  ✓ Renovar lock válido
  ✓ Incrementar expires_at +48h
  ✓ Actualizar heartbeat_at
  ✓ Validar owner_id match
  ✗ Fallar si lock expiró

test_intervention_approve:
  ✓ Aprobar intervención
  ✓ state = "approved"
  ✓ Crear snapshot "after_approval"
  ✓ Liberar lock
  ✓ Crear AuditEvent
  ✓ Generar resolution_token
  ✗ No aprobar si no assigned a usuario

test_intervention_reject:
  ✓ Rechazar intervención
  ✓ state = "rejected"
  ✓ Liberar lock
  ✓ No aplicar cambios
  ✓ Auditoría rechazo
  ✗ No rechazar si aprobada ya

test_snapshot_creation:
  ✓ Capturar estado antes
  ✓ Incluir todos campos documento
  ✓ Desnormalizar customer
  ✓ Desnormalizar vehículo
  ✓ Timestamp correcto
  ✗ Fallar si documento inválido

test_audit_event_logging:
  ✓ Loguear event_created
  ✓ Loguear state_transitions
  ✓ Incluir actor metadata
  ✓ Incluir IP + session
  ✓ Timestamp UTC
  ✗ Nunca purgar eventos

Coverage goal: > 95%
```

---

## 15.2 INTEGRATION TESTS (tests/test_intervention_api.py)

```python
test_full_flow_vendedor_request:
  SETUP: 
    - Usuario ventas loggeado
    - Sale creada con descuento 15%
  
  TEST:
    1. POST /api/interventions/request
       { document_type: "sale", document_id: "sale_xxx", reason: "..." }
    2. Validar respuesta:
       - status_code = 201
       - intervention_id retornado
       - state = "created"
       - requester_id = usuario.id
    3. GET /api/sales/sale_xxx
       - Validar intervention_id presente
       - Validar intervention_locked = false
    
  AUDITORÍA:
    - intervention_created event existe
    - Actor = vendedor
    - Timestamp correcto

test_full_flow_supervisor_takeover:
  SETUP:
    - Intervención creada
    - Supervisor loggeado
  
  TEST:
    1. POST /api/interventions/{id}/assign
    2. Validar state = "assigned"
    3. POST /api/interventions/{id}/lock/acquire
    4. Validar DocumentLock creado
    5. Validar intervención.lock_owner_id = supervisor
    6. PATCH /api/sales/{id} (intenta vendedor)
       → Error 423: "Document locked"
    
  AUDITORÍA:
    - lock_acquired event
    - state_transition event

test_supervisor_modifies_and_approves:
  SETUP:
    - Intervención asignada
    - Lock adquirido
  
  TEST:
    1. POST /api/interventions/{id}/modify
       { changes: { items: [...] }, reason: "..." }
       → state = "modifications_requested"
    2. Validar cambios almacenados
    3. POST /api/interventions/{id}/approve
       { resolution_reason: "..." }
    4. Validar:
       - state = "approved"
       - Lock liberado
       - Cambios aplicados a sale
       - snapshot after creado
       - document_version incrementó
    
  AUDITORÍA:
    - modification_submitted
    - intervention_approved
    - Ambos eventos linked

test_supervisor_rejects:
  SETUP:
    - Intervención en modifications_requested
  
  TEST:
    1. POST /api/interventions/{id}/reject
    2. Validar:
       - state = "rejected"
       - Sale NO modificada
       - Lock liberado
       - Notificación a vendedor
  
  AUDITORÍA:
    - intervention_rejected event

test_caja_processes_intervened_sale:
  SETUP:
    - Sale intervenida + aprobada
    - Cajero loggeado
  
  TEST:
    1. GET /api/sales/sale_xxx
       - Validar sale.intervention_id
       - Validar sale.intervention_locked = false
    2. POST /api/cashier/collect
       - Validar procesa sin restricciones
    3. Validar factura pagada + status = "paid"

test_draft_protection_during_intervention:
  SETUP:
    - Draft existente
    - Intervención activa
  
  TEST:
    1. GET /api/drafts/sale
       - Validar draft.protected = true
    2. Intentar restore
       → Error 409: "Draft protected"
    3. Intervención aprobada
       - Draft.protected = false
    4. Restore exitoso

test_websocket_lock_expired:
  SETUP:
    - WS conectado
    - Lock activo
  
  TEST:
    1. Esperar TTL vencer (48h simulated)
    2. Background job ejecuta
    3. WS recibe evento: "lock_expired"
    4. Frontend actualiza: documento liberado

Coverage goal: > 90%
```

---

## 15.3 CONCURRENCY TESTS (tests/test_intervention_concurrency.py)

```python
test_race_condition_double_assign:
  SETUP:
    - Intervención state = "created"
    - Dos supervisores activos
  
  TEST:
    1. SUPERVISOR A: POST assign (t=0)
    2. SUPERVISOR B: POST assign (t=0.1s)
    3. Validar:
       - A exitoso, state = "assigned"
       - B error 409: "Already assigned"
  
  VERIFICAR:
    - assignee_id = A (no B)
    - assigned_at = t(A)

test_race_condition_double_lock:
  SETUP:
    - Intervención state = "assigned"
    - Dos supervisores
  
  TEST:
    1. SUP A: POST lock/acquire (t=0)
    2. SUP B: POST lock/acquire (t=0.05s)
    3. Validar:
       - A exitoso: lock creado
       - B error 409: "Document locked"
    
  VERIFICAR:
    - DocumentLock.owner_id = A
    - lock_owner_id = A

test_race_condition_heartbeat_vs_expire:
  SETUP:
    - Lock activo
    - 30s heartbeat interval
    - 48h TTL
  
  TEST:
    1. [Simular tiempo: t=47h]
    2. Heartbeat thread: POST heartbeat (t=47h59m50s)
    3. Expire job: Busca locks vencidos (t=48h00m00s)
    4. Heartbeat extendió expires_at → t=95h
    5. Validar:
       - Expire job NO marca como expired
       - Lock sigue activo
       - Supervisor sigue con acceso

test_race_condition_modify_vs_lock_release:
  SETUP:
    - Intervención in_review
    - Lock activo
    - Supervisor A modifica
  
  TEST:
    1. SUP A: POST modify (t=0)
       { changes: {...} }
    2. OTHER: POST approve (t=0.2s)
       → Libera lock
    3. Validar:
       - Modify procesado antes approve
       - Cambios incluidos en snapshot after
       - Lock liberado post-approve

test_concurrent_sales_in_different_interventions:
  SETUP:
    - Sale 1 en intervención A (SUP-1)
    - Sale 2 en intervención B (SUP-2)
  
  TEST:
    1. SUP-1: modify sale_1 (t=0)
    2. SUP-2: modify sale_2 (t=0)
    3. SUP-1: approve (t=0.5s)
    4. SUP-2: approve (t=0.6s)
    5. Validar:
       - Ambas aprobadas sin conflict
       - Cada una con su snapshot
       - Auditoría separada

test_stale_document_version:
  SETUP:
    - Sale document_version = 1
    - Vendedor cargó con version 1
    - Supervisor cambió (version → 2)
  
  TEST:
    1. Vendedor: PATCH /sales
       { document_version: 1, changes: {...} }
    2. Validar:
       - Error 409: "Stale document"
       - Sale.document_version = 2
       - Cambios NO aplicados
    3. Vendedor carga: GET /sales/{id}
    4. Ve version = 2, se actualiza

test_simultaneous_inventory_deduction:
  SETUP:
    - Item con qty limitada
    - Dos vendedores crean sale con mismo item
  
  TEST:
    1. VEN A: POST sale (qty=5) (t=0)
    2. VEN B: POST sale (qty=5) (t=0.1s)
    3. Inventario = 8
    4. Validar:
       - A exitoso: inventario → 3
       - B error: "Insufficient inventory"
    5. VEN B intenta intervención
       - Intervención permite aumentar qty
       - Requiere aprobación supervisor

Load test:
  - 10 simultaneous supervisors
  - 100 concurrent modifications
  - Verificar:
    - Todos estados consistentes
    - Ningún deadlock
    - Ninguna corrupción data
    - Todos eventos auditados

Coverage goal: > 95%
```

---

## 15.4 TIMEOUT Y EXPIRATION TESTS

```python
test_lock_expires_at_ttl:
  SETUP:
    - Lock creado
    - TTL = 48h
  
  TEST:
    1. t=0: lock_acquired
       expires_at = 2026-05-17T10:00:00Z
    2. t=48h: Background job ejecuta
       - Detecta lock vencido
       - Marca estado = "expired"
       - Notifica supervisor
    3. t=48.1h: Supervisor intenta heartbeat
       - Error: "Lock expired"
    
test_intervention_expires_no_resolution:
  SETUP:
    - Intervención created
    - TTL = 48h
  
  TEST:
    1. t=0: state = "created"
       expires_at = 2026-05-17T10:00:00Z
    2. t=48h: Nadie la resolvió
    3. Background job:
       - state → "expired"
       - Libera lock
       - Notifica: "Intervención expirada"
    4. Documento vuelve a estado pre-intervención

test_token_expires_ttl:
  SETUP:
    - intervention_token generado
    - TTL = 2h
  
  TEST:
    1. t=0: token creado
       expires_at = 2026-05-15T12:00:00Z
    2. t=1h59m: Supervisor accede
       - Error 401: "Token expired"
    3. Nuevo token debe solicitarse
```

---

# PARTE 16: RIESGOS CRÍTICOS

## 16.1 RACE CONDITIONS

| Risk | Scenario | Mitigation |
|------|----------|-----------|
| Double assign | Dos supervisores claim | Unique index (doc, state, assignee) + transacción |
| Double lock | Dos supervisores lock | Unique index (doc, lock_owner) + sparse |
| Heartbeat vs expire | Simultáneamente | Version field en lock + optimistic check |
| Modify vs approve | Cambios post-aprobación | Timestamp + transaction ordering |
| Stale document | Vendedor edita versión vieja | document_version validation + 409 error |
| Concurrent inventory | Dos vendedores mismo item | Inventory.reserve() atómico |

---

## 16.2 DEADLOCKS

| Risk | Scenario | Mitigation |
|------|----------|-----------|
| A locks sale, B locks quotation | Circular dependency | Ordenar locks siempre: sale → quotation |
| Document + Inventory locks | Mismo orden siempre | Global lock ordering protocol |
| Session + Document locks | Deadlock en sesión | Timeouts 30s en todos locks |

---

## 16.3 DOBLE APROBACIÓN

| Risk | Scenario | Mitigation |
|------|----------|-----------|
| Resubmit mismo approve | Network retry | resolution_token one-time-use |
| Idempotency | Approvar 2x data correcta | Check approval_timestamp + 409 if exists |

---

## 16.4 OVERWRITE CONCURRENTE

| Risk | Scenario | Mitigation |
|------|----------|-----------|
| Vendedor + Supervisor editan | Conflict de cambios | Lock bloquea vendedor, snapshot audit trail |
| Caja + Supervisor editan | Post-aprobación | Caja siempre puede anular, audit trail |

---

## 16.5 CORRUPCIÓN DRAFTS

| Risk | Scenario | Mitigation |
|------|----------|-----------|
| Restaurar viejo draft | Over-write intervención | Check document_version + protection flag |
| Perder cambios | Draft no synced | Autosave + backup servidor |
| Expiración draft | TTL vence | TTL extendido durante intervención |

---

## 16.6 PÉRDIDA AUDITORÍA

| Risk | Scenario | Mitigation |
|------|----------|-----------|
| Evento no loguear | Error en auditoría | Try/catch + fallback logging |
| Purga accidental | Data cleanup | TTL disabled, manual retention 7 años |
| Snapshot corrupto | Corrupción JSON | Validación schema + backup |

---

## 16.7 BYPASS FRONTEND

| Risk | Scenario | Mitigation |
|------|----------|-----------|
| Editar bloqueado directamente | Postman API call | Backend valida lock + intervention_locked |
| Aprobación sin token | Direct API call | Validar resolution_token exists + one-time |
| Borrar auditoría | Direct MongoDB | Auditoría separada DB con permisos read-only |

---

## 16.8 INCONSISTENCIAS MONGODB

| Risk | Scenario | Mitigation |
|------|----------|-----------|
| Docum + Intervention fuera sync | Borrado parcial | Transacciones Multi-doc + rollback |
| Lock sin Intervención | Huérfano | Índice FK + cascade delete |
| Snapshot missing | Auditoría incompleta | Crear antes transacción |

---

## 16.9 PLAN MITIGACIÓN

```
Cada risk tiene:
1. PREVENCIÓN (diseño)
2. DETECCIÓN (logging/alerts)
3. RECUPERACIÓN (rollback)
4. VALIDACIÓN (tests)

Monitoreo:
  - Alert si race condition detectada
  - Alert si TTL a punto expirar
  - Alert si auditoría fallida
  - Reporte diario inconsistencias
```

---

# PARTE 17: ORDEN EXACTO IMPLEMENTACIÓN

## 17.1 CHECKLIST IMPLEMENTACIÓN

### FASE 1: BACKEND INFRASTRUCTURE (Semana 1)

#### Paso 1.1: Modelos Mongoose
```
ARCHIVO: backend/models/intervention_models.py
ACCIONES:
  ✓ Clase InterventionCase
    - intervention_id: str (unique)
    - document_type: enum (sale|quotation)
    - document_id: str
    - document_version: int
    - state: enum (8 estados)
    - requester_id, assignee_id, lock_owner_id
    - lock_expires_at, lock_heartbeat_at
    - before_snapshot, after_snapshot, current_modifications
    - intervention_token, resolution_token
    - created_at, updated_at, expires_at (TTL)
  
  ✓ Clase DocumentLock
    - lock_id: str (unique)
    - document_type, document_id
    - owner_id, scope
    - acquired_at, expires_at, heartbeat_at
    - intervention_id (FK)
  
  ✓ Clase InterventionToken
    - token_id: str (unique)
    - intervention_id: str
    - token_type: enum
    - token_value: str (SHA256)
    - used: bool
    - issued_at, expires_at
  
  TESTS:
    - Model creation
    - Validación campos requeridos
    - Índices creados

TIEMPO EST: 2 horas
```

#### Paso 1.2: Modelos Audit
```
ARCHIVO: backend/models/audit_models.py
ACCIONES:
  ✓ Clase InterventionAuditEvent
    - event_id: str (unique)
    - intervention_id: str
    - event_type: enum (10 tipos)
    - actor_id, actor_role, actor_branch_id
    - action_details: object
    - changes: array (before/after)
    - before_state, after_state
    - session_id, ip_address, hostname
    - timestamp, duration_ms
  
  ✓ Clase DocumentSnapshot
    - snapshot_id: str (unique)
    - intervention_id: str
    - snapshot_type: enum (before|after|modification)
    - document_data: object (completo documento)
    - customer_snapshot, vehicle_snapshot
    - created_by, created_by_role
    - timestamp, reason
  
  TESTS:
    - Event creation
    - Snapshot capture
    - Validación campos

TIEMPO EST: 1.5 horas
```

#### Paso 1.3: Migrations MongoDB
```
ARCHIVO: backend/scripts/migration_intervention_init.py
ACCIONES:
  ✓ CreateCollections:
    - db.intervention_cases (+ indexes)
    - db.document_locks (+ indexes)
    - db.intervention_tokens (+ indexes)
    - db.intervention_audit_events (+ indexes)
    - db.document_snapshots (+ indexes)
  
  ✓ ExtendCollections:
    - db.sales: agregar campos
      - intervention_id
      - intervention_locked
      - document_version
      - frozen_fields
      - lock_owner_id
    - db.quotations: idem
  
  ✓ Crear índices TTL
  
  TESTS:
    - Migration correcto
    - Collections existen
    - Índices activos
    - Campos nuevos en sales/quotations
  
  RUN: python backend/scripts/migration_intervention_init.py

TIEMPO EST: 1 hora
```

#### Paso 1.4: Core Service
```
ARCHIVO: backend/services/intervention_service.py
ACCIONES:
  ✓ Clase InterventionService
    Métodos:
    
    async create_intervention(
      document_type, document_id, requester_id, reason, scope
    ):
      - Generar intervention_id
      - Validar documento existe
      - Crear snapshot documento actual
      - Generar intervention_token
      - Crear InterventionCase (state=created)
      - Loguear auditoría
      - Retornar case + token
    
    async assign_case(intervention_id, assignee_id):
      - Validar assignee es supervisor
      - Validar state = created
      - Actualizar assignee_id, assigned_at
      - state = assigned
      - Crear snapshot "before_intervention"
      - Loguear auditoría
    
    async acquire_lock(intervention_id, scope):
      - Validar intervención assigned
      - Validar documento no locked
      - Generar lock_id
      - Crear DocumentLock
      - Actualizar intervention: lock_owner_id, lock_expires_at
      - state = in_review
      - Loguear auditoría
      - Retornar lock_id
    
    async heartbeat_lock(lock_id):
      - Validar lock exists + not expired
      - Actualizar heartbeat_at
      - Extender expires_at = +48h
      - Loguear si necesario
    
    async modify_intervention(intervention_id, changes, reason):
      - Validar intervención assigned a usuario
      - Validar lock activo
      - Almacenar changes en current_modifications
      - state = modifications_requested
      - Crear AuditEvent
      - Loguear cambios propuestos
    
    async approve_intervention(
      intervention_id, resolution_reason
    ):
      - Validar state != expired
      - Validar supervicor assigned
      - Validar lock activo
      - Crear snapshot "after_approval"
      - Aplicar cambios a documento (si existen)
      - Incrementar document_version
      - state = approved
      - Liberar lock
      - Generar resolution_token
      - Crear AuditEvent final
      - Notificar stakeholders
    
    async reject_intervention(
      intervention_id, resolution_reason
    ):
      - Validar supervisor assigned
      - state = rejected
      - NO aplicar cambios
      - Liberar lock
      - Crear AuditEvent
      - Notificar requester
    
    async expire_intervention(intervention_id):
      - state = expired
      - Liberar lock
      - Crear AuditEvent
      - Notificar todas partes
  
  TESTS:
    - Cada método testeado
    - Transacciones correctas
    - Auditoría completa
    - Errores manejados

TIEMPO EST: 4 horas
```

#### Paso 1.5: Routes Intervención
```
ARCHIVO: backend/routes/intervention_routes.py
ACCIONES:
  ✓ Endpoints API:
    
    POST /api/interventions/request
      require_auth()
      → InterventionService.create_intervention()
      → Retornar { intervention_id, token, ... }
    
    POST /api/interventions/{id}/assign
      require_roles(["gerencia"])
      → InterventionService.assign_case()
      → Retornar InterventionCase
    
    POST /api/interventions/{id}/lock/acquire
      require_roles(["gerencia"])
      → InterventionService.acquire_lock()
      → Retornar DocumentLock
    
    POST /api/interventions/{id}/lock/heartbeat
      require_roles(["gerencia"])
      → InterventionService.heartbeat_lock()
      → Retornar { expires_at, ... }
    
    POST /api/interventions/{id}/modify
      require_roles(["gerencia"])
      → InterventionService.modify_intervention()
      → Retornar InterventionCase
    
    POST /api/interventions/{id}/approve
      require_roles(["gerencia"])
      → InterventionService.approve_intervention()
      → Retornar { success, changes_applied, ... }
    
    POST /api/interventions/{id}/reject
      require_roles(["gerencia"])
      → InterventionService.reject_intervention()
      → Retornar { success, reason, ... }
    
    GET /api/interventions?state=...
      require_roles(["gerencia", "ventas"])
      → Listar intervenciones según filters
      → Retornar [ InterventionCase, ... ]
    
    GET /api/interventions/{id}
      require_auth()
      → Retornar InterventionCase + snapshots + audit
    
    GET /api/interventions/document/{type}/{id}
      require_auth()
      → Retornar case activo para documento
    
    GET /api/document-locks/document/{type}/{id}
      require_auth()
      → Retornar locks activos
  
  TESTS:
    - Cada endpoint probado
    - Autenticación correcta
    - Validaciones correctas
    - Errores retornados correctamente

TIEMPO EST: 3 horas
```

### FASE 1 SUBTOTAL: ~11.5 horas (1.5 días)

---

### FASE 2: INTEGRACIÓN BACKEND (Semana 2)

#### Paso 2.1: Modificar endpoints POST /sales
```
ARCHIVO: backend/server.py (endpoint create_sale)
CAMBIOS:
  
  Agregar validación POST /api/sales:
  
  IF limit_descriptor.exceeds(sale_data.discount):
    IF FEATURE_INTERVENTIONS_ENABLED:
      # Crear intervención
      case = await intervention_service.create_intervention(
        document_type="sale",
        document_id=sale_id,
        requester_id=user.user_id,
        reason=f"Descuento {sale_data.discount}% excede límite",
        scope="global"
      )
      # Retornar sale + intervention info
      return {
        "sale_id": sale_id,
        "status": "pending_intervention",
        "intervention_required": True,
        "intervention_id": case.intervention_id,
        "message": "Intervención requerida para procesar"
      }
    ELSE:
      # Legacy: sale_requests
      # ... código actual ...
  ELSE:
    # Sin intervención requerida
    # Procesar normalmente
  
  TESTS:
    - Create sale normal (sin intervención)
    - Create sale + intervención requerida
    - Retorno correcto en ambos casos
    - Intervención case creada
    - Sale pendiente intervención

TIEMPO EST: 1.5 horas
```

#### Paso 2.2: Validación lock en PATCH /sales/{id}
```
ARCHIVO: backend/server.py (endpoint update_sale)
CAMBIOS:
  
  Agregar validación antes cualquier PATCH:
  
  sale = db.sales.find_one({"sale_id": sale_id})
  
  IF sale.intervention_locked:
    user = await require_auth(request)
    intervention = db.intervention_cases.find_one(
      {"intervention_id": sale.intervention_id}
    )
    
    IF user.role != "gerencia" OR intervention.lock_owner_id != user.user_id:
      raise HTTPException(
        status_code=423,
        detail={
          "message": "Documento bloqueado por intervención",
          "intervention_id": intervention.intervention_id,
          "locked_by": intervention.assignee_name,
          "lock_expires_at": intervention.lock_expires_at
        }
      )
    
    # Supervisor: permitir
    # Aplicar cambios
    # Loguear en intervención auditoría
  
  # Validar document_version (optimistic locking)
  IF payload.document_version != sale.document_version:
    raise HTTPException(
      status_code=409,
      detail={
        "message": "Documento cambió",
        "current_version": sale.document_version,
        "your_version": payload.document_version
      }
    )
  
  TESTS:
    - Vendedor intenta editar documento bloqueado → 423
    - Supervisor con lock puede editar → success
    - Versión vieja → 409
    - Auditoría registra cambios

TIEMPO EST: 1 hora
```

#### Paso 2.3: Integración PATCH /sales/{id}/commercial-terms
```
ARCHIVO: backend/server.py (endpoint update_sale_commercial_terms)
CAMBIOS:
  
  Agregar validación similar anterior:
  
  IF sale.commercial_terms_locked:
    # Solo supervisor con lock
    # Validación idéntica a paso 2.2
  
  # Registrar auditoría intervención
  IF sale.intervention_id:
    await intervention_service.log_field_change(
      intervention_id=sale.intervention_id,
      field="commercial_terms",
      old_value={...},
      new_value={...},
      actor_id=user.user_id
    )
  
  TESTS:
    - Vendedor no puede cambiar términos bloqueados
    - Supervisor puede con lock
    - Auditoría registra

TIEMPO EST: 0.75 horas
```

#### Paso 2.4: Integración POST /sales/{id}/requests/edit (Bridge)
```
ARCHIVO: backend/server.py (endpoint request_sale_edit)
CAMBIOS:
  
  IF FEATURE_INTERVENTIONS_ENABLED:
    # Crear intervención en lugar de sale_request
    case = await intervention_service.create_intervention(
      document_type="sale",
      document_id=sale_id,
      requester_id=user.user_id,
      reason=payload.reason,
      scope="section_specific",
      scope_fields=["items", "customer", "vehicle"]
    )
    return {
      "status": "intervention_requested",
      "intervention_id": case.intervention_id,
      "message": "Solicitud de intervención enviada"
    }
  ELSE:
    # Legacy: sale_requests
    # Código actual
  
  TESTS:
    - Feature flag OFF: usa sale_requests
    - Feature flag ON: usa intervención

TIEMPO EST: 0.75 horas
```

#### Paso 2.5: Cotizaciones (replicar de Sales)
```
ARCHIVOS:
  - backend/server.py (endpoints quotations)
  - Agregar mismas validaciones POST/PATCH cotizaciones
  
  Endpoints:
    POST /api/quotations
      - Validar intervención requerida
    
    PATCH /api/quotations/{id}
      - Validar lock
      - Validar document_version
    
    PUT /api/quotations/{id}/status
      - Idem validación

TESTS:
  - Idénticos a sales

TIEMPO EST: 1.5 horas
```

#### Paso 2.6: Extensión audit_service
```
ARCHIVO: backend/services/audit.py
CAMBIOS:
  
  Agregar método:
  
  async def log_intervention_event(
    intervention_id,
    event_type,
    actor_id,
    actor_role,
    action_details,
    changes=None,
    before_state=None,
    after_state=None
  ):
    # Loguear en intervención_audit_events
    # Incluir metadata (IP, session, etc.)
    # Validar campos requeridos
    # Retornar event_id
  
  TESTS:
    - Eventos loguean correctamente
    - Auditoría nunca falla (fallback logging)

TIEMPO EST: 1 hora
```

#### Paso 2.7: Middleware y hooks
```
ARCHIVOS:
  - backend/server.py (modificar middleware)
  
  CAMBIOS:
  
  1. enforce_session_lock() middleware:
     Agregar check:
     IF documento en intervención + no supervisor asignado:
       return 423 "Session locked due to intervention"
  
  2. hypervisor_runtime_audit() middleware:
     Extender para loguear cambios intervención
  
  3. Background job: ExpireInterventions
     Every 10 minutes:
       - Buscar interventions: state != resolved, expires_at < ahora
       - state → expired
       - Liberar lock
       - Notificar
  
  4. Background job: ExpireLocks
     Every 5 minutes:
       - Buscar locks: expires_at < ahora
       - Liberar
       - Actualizar intervención
       - Notificar
  
  TESTS:
    - Middleware funciona
    - Background jobs ejecutan
    - TTL expirations trabajam correctamente

TIEMPO EST: 2 horas
```

#### Paso 2.8: Tests Integración Fase 2
```
ARCHIVO: tests/test_intervention_api.py
ACCIONES:
  ✓ Test vendedor request intervención
  ✓ Test supervisor assign
  ✓ Test lock acquire
  ✓ Test documento bloqueado
  ✓ Test approve
  ✓ Test reject
  ✓ Test TTL expire
  ✓ Test bridge legacy
  ✓ Test caja procesa
  
  Coverage: > 90%

TIEMPO EST: 4 horas
```

### FASE 2 SUBTOTAL: ~11.5 horas (1.5 días)

**FASE 1+2 SUBTOTAL: ~23 horas (3 días)**

---

### FASE 3: FRONTEND OPTIONAL (Semana 3-4)

#### Paso 3.1: Hooks React
```
ARCHIVOS:
  - frontend/src/hooks/useIntervention.js
  - frontend/src/hooks/useLockManager.js

ACCIONES:
  
  useIntervention(documentId, documentType):
    - Fetch intervención activa
    - Poll cada 5s
    - Retornar { intervention, isLoading, error }
  
  useLockManager(lockId):
    - Heartbeat automático (cada 30s)
    - Countdown TTL
    - Renovación automática
    - Retornar { remainingTime, isExpired, error }

TIEMPO EST: 2 horas
```

#### Paso 3.2: Componentes nuevos
```
ARCHIVOS:
  - frontend/src/components/InterventionOverlay.jsx
  - frontend/src/components/LockIndicator.jsx
  - frontend/src/components/InterventionRequest.jsx
  - frontend/src/components/SupervisorDashboard.jsx

COMPONENTES:
  
  InterventionOverlay:
    - Muestra estado intervención
    - Botones vendor/supervisor
    - Cambios pendientes
    - Lock countdown
  
  LockIndicator:
    - Sticky lock info
    - Countdown TTL
    - Parpadea si < 15min
  
  InterventionRequest:
    - Diálogo solicitar intervención
    - Campo "reason"
    - Confirmación
  
  SupervisorDashboard:
    - Tabla intervenciones
    - Filtros state/type
    - Acciones rápidas
    - Bell icon notifications

TIEMPO EST: 5 horas
```

#### Paso 3.3: Modificar SalesPage.jsx
```
ARCHIVO: frontend/src/pages/SalesPage.jsx
CAMBIOS:
  
  Estado nuevo:
    [intervention, setIntervention] = useState(null)
    [isInterventionVisible, setIsInterventionVisible] = useState(false)
  
  useEffect(() => {
    if (document.sale_id) {
      const intv = await fetchIntervention(document.sale_id)
      setIntervention(intv)
    }
  }, [document.sale_id])
  
  Render:
    SI intervención:
      <InterventionOverlay ... />
    
    <SaleForm
      readonly={intervention?.state === 'in_review'}
      intervention={intervention}
    />

TIEMPO EST: 1.5 horas
```

#### Paso 3.4: Modificar SaleForm.jsx
```
ARCHIVO: frontend/src/components/sales/SaleForm.jsx
CAMBIOS:
  
  Props nuevas:
    - intervention
    - isReadonly
    - lockedSections
  
  Comportamiento:
    SI isReadonly:
      - Todos inputs disabled
      - Overlay con message + lock indicator
    
    SI scope=items:
      - Items bloqueados, otros editables
    
    SI scope=commercial_terms:
      - Sección comercial bloqueada

TIEMPO EST: 2 horas
```

#### Paso 3.5: Modificar NotificationsPage.jsx
```
ARCHIVO: frontend/src/pages/NotificationsPage.jsx
CAMBIOS:
  
  Agregar tipo notificación:
    - intervention_requested
    - intervention_assigned
    - intervention_approved
    - intervention_rejected
  
  Acciones:
    - [Tomar Control]
    - [Ver Detalles]
    - [Responder Cambios]

TIEMPO EST: 1.5 horas
```

#### Paso 3.6: Modificar AuthContext.js
```
ARCHIVO: frontend/src/context/AuthContext.js
CAMBIOS:
  
  Agregar en userData:
    - intervention_lock_expires_at
    - intervention_id (si aplica)
  
  Sincronizar cada fetch /auth/me

TIEMPO EST: 0.5 horas
```

#### Paso 3.7: Tests Frontend
```
ARCHIVO: tests/
ACCIONES:
  ✓ Test useIntervention hook
  ✓ Test useLockManager hook
  ✓ Test InterventionOverlay render
  ✓ Test LockIndicator countdown
  ✓ Test SaleForm readonly
  ✓ Test SupervisorDashboard
  ✓ Test NotificationsPage intervención types
  
  Coverage: > 85%

TIEMPO EST: 3 horas
```

### FASE 3 SUBTOTAL: ~15.5 horas (2 días)

---

### FASE 4: DESCONEXIÓN LEGACY (Semana 5)

#### Paso 4.1: Data migration
```
SCRIPT: backend/scripts/migration_legacy_to_intervention.py
ACCIONES:
  
  1. Buscar todo sale_requests pendiente
  2. Para cada uno:
     - Crear InterventionCase equivalente
     - Mapear estado
     - Copiar auditores
  3. Validar 100% migrado
  4. Backup sale_requests colección
  5. Marcar legacy como deprecated

TIEMPO EST: 2 horas
```

#### Paso 4.2: Remover endpoints legacy
```
ARCHIVOS:
  - backend/server.py
  
CAMBIOS:
  - Remover POST /api/sales/{id}/requests/edit
  - Remover POST /api/sales/{id}/requests/cancel
  - Remover POST /api/approvals
  - Remover GET /api/approvals
  - Remover endpoints manager_authorizations (si no usado)
  
  REEMPLAZOS: Ya existen en intervention_routes

TIEMPO EST: 0.5 horas
```

#### Paso 4.3: Remover servicios legacy
```
ARCHIVOS:
  - backend/services/approval_service.py (eliminar)
  - backend/api/v1/approvals.py (eliminar, WS legacy)
  - backend/api/v1/websockets.py (actualizar si aplica)
  
  REPLACEMENTS: intervention_service + intervention_routes

TIEMPO EST: 0.5 horas
```

#### Paso 4.4: Limpieza frontend
```
ARCHIVOS:
  - frontend/src/pages/ApprovalsPage.jsx (actualizar si existe)
  - frontend/src/components/GerenteApprovalPanel.jsx (deprecate)
  - Remover referencias a sale_requests
  
  REPLACEMENTS: SupervisorDashboard

TIEMPO EST: 1 hora
```

#### Paso 4.5: Validación final
```
TESTS:
  ✓ Todos endpoints exitosos
  ✓ No hay referencias legacy
  ✓ Auditoría completa
  ✓ Caja funciona
  ✓ Supervisores pueden intervenir
  ✓ Vendedores ver estado
  ✓ Load tests (100 intervenciones paralelas)
  
  Despliegue:
  ✓ Backup completo
  ✓ Rollback plan tesado
  ✓ Feature flag check (FEATURE_INTERVENTIONS_ENABLED = always True)
  ✓ Notificación usuarios

TIEMPO EST: 3 horas
```

### FASE 4 SUBTOTAL: ~7 horas (1 día)

---

## 17.2 TIMELINE TOTAL

```
SEMANA 1:
  L: Paso 1.1-1.2 (Modelos)
  Ma: Paso 1.3-1.4 (Migration + Service)
  Mi: Paso 1.5 (Routes) + QA
  J-V: Tests + Code Review
  
SEMANA 2:
  L: Paso 2.1-2.2 (Integración sales)
  Ma: Paso 2.3-2.5 (Commercial terms + Quotations)
  Mi: Paso 2.6-2.7 (Audit + Middleware)
  J-V: Tests Fase 2 + Code Review
  
SEMANA 3-4:
  L-Mi (Semana 3): Paso 3.1-3.4 (Hooks + Componentes)
  J-V (Semana 3): Paso 3.5-3.7 (NotificationsPage + Tests)
  L-Mi (Semana 4): UserAcceptance Testing + Refinements
  J-V (Semana 4): Bug fixes + Stabilization
  
SEMANA 5:
  L-Mi: Paso 4.1-4.4 (Migration + Cleanup)
  J-V: Paso 4.5 (Validación + Deployment)
  
TOTAL: 5 semanas
HORAS CODING: ~36.5 horas (equivalente a 1 dev fulltime, 1 semana+)
HORAS QA/TESTING: ~15 horas
HORAS CODE REVIEW: ~5 horas
TOTAL PROYECTO: ~56.5 horas (1 dev, 7 días completos)
```

---

# CONCLUSIÓN

Este blueprint proporciona:

1. ✅ Mapa completo de impacto (archivos, endpoints, modelos)
2. ✅ Diseño MongoDB detallado (5 colecciones, índices, validaciones)
3. ✅ Workflow exacto (7 estados, transiciones validadas)
4. ✅ Sistema de locks multi-nivel (global, items, section)
5. ✅ Versionado optimistic (document_version, stale checks)
6. ✅ Freeze financiero (campos congelados por scope)
7. ✅ Snapshots before/after (auditoría completa)
8. ✅ Auditoría 7 años (retención, no purga)
9. ✅ Tokens one-time (intervención + resolución)
10. ✅ Integración drafts (protección durante intervención)
11. ✅ Integración caja (identificación + restricciones)
12. ✅ UI React completa (overlay, dashboard, indicadores)
13. ✅ Polling vs WebSocket (estrategia gradual)
14. ✅ Migración segura (4 fases, feature flags, rollback)
15. ✅ Testing exhaustivo (unit, integration, concurrency)
16. ✅ Mitigación riesgos (16 riesgos críticos, soluciones)
17. ✅ Orden exacto implementación (17 pasos detallados, 36.5 horas)

**LISTO PARA EJECUCIÓN SIN ROMPER ERP EXISTENTE**

---
