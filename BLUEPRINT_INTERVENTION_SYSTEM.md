# BLUEPRINT TÉCNICO: SISTEMA DE INTERVENCIÓN SUPERVISADA DE DOCUMENTOS
## ERP MC-LARENS 2026

**Fecha**: 15 Mayo 2026  
**Fase**: Diseño Arquitectónico (SIN IMPLEMENTACIÓN)  
**Status**: Listo para Ejecución  
**Versión**: 1.0 Production-Grade

---

## ÍNDICE EJECUTIVO

Este documento diseña el sistema completo de **Intervención Supervisada** para controlar edición centralizada de ventas y cotizaciones en situaciones especiales (límites excedidos, cambios post-creación, auditoría, etc.).

**No rompe nada existente. Reutiliza arquitectura actual. Totalmente incremental.**

---

# PARTE 1: MAPA COMPLETO DE IMPACTO

## 1.1 ARCHIVOS AFECTADOS

### NUEVOS ARCHIVOS (CREACIÓN OBLIGATORIA)

| Archivo | Propósito | Líneas Est. |
|---------|-----------|------------|
| `backend/services/intervention_service.py` | Core service para casos intervención | 800 |
| `backend/routes/intervention_routes.py` | Endpoints intervención | 1200 |
| `backend/models/intervention_models.py` | Modelos Pydantic para intervención | 400 |
| `backend/models/lock_models.py` | Modelos para locks de documento | 300 |
| `backend/models/audit_models.py` | Modelos auditoría intervención | 250 |
| `frontend/src/hooks/useIntervention.js` | Hook React para intervención | 400 |
| `frontend/src/hooks/useLockManager.js` | Hook para gestión de locks cliente | 350 |
| `frontend/src/components/InterventionOverlay.jsx` | Overlay UI para documento intervenido | 600 |
| `frontend/src/components/LockIndicator.jsx` | Indicador visual de lock | 250 |
| `frontend/src/components/InterventionRequest.jsx` | Diálogo solicitar intervención | 450 |
| `frontend/src/components/SupervisorDashboard.jsx` | Panel supervisor de intervenciones | 800 |
| `tests/test_intervention_service.py` | Tests unitarios service | 600 |
| `tests/test_intervention_api.py` | Tests integración API | 700 |
| `tests/test_intervention_concurrency.py` | Tests race conditions | 500 |

### ARCHIVOS MODIFICADOS (CAMBIOS MENORES)

| Archivo | Cambios | Líneas Afectadas |
|---------|---------|-----------------|
| `backend/server.py` | Incluir rutas intervención, middleware lock | ~150 |
| `backend/services/audit.py` | Extender para auditoría intervención | ~100 |
| `backend/models/` | Agregar campos venta/cotización | ~80 |
| `frontend/src/pages/SalesPage.jsx` | Estados intervención, botones, overlays | ~200 |
| `frontend/src/pages/QuotationsPage.jsx` | Estados intervención, botones, overlays | ~180 |
| `frontend/src/components/sales/SaleForm.jsx` | Readonly sections, validaciones | ~250 |
| `frontend/src/context/AuthContext.js` | Mapear intervention_lock en usuario | ~40 |
| `frontend/src/pages/NotificationsPage.jsx` | Mostrar intervención requests | ~120 |

### ARCHIVOS REUTILIZABLES (SIN CAMBIOS)

| Archivo | Razón |
|---------|-------|
| `backend/api/v1/websockets.py` | Estructura lista, agregar evento intervención |
| `backend/core/websocket_manager.py` | Reutilizar patrón para notificaciones intervención |
| `backend/models/sale.py`, `quotation.py` | Solo agregar campos nuevos, no refactor |
| `backend/services/audit.py` | Extender, no reescribir |

### ARCHIVOS OBSOLETOS/DEPRECATED (MANTENER PERO NO USAR)

| Archivo | Razón |
|---------|-------|
| `backend/services/approval_service.py` | Legacy no conectado, mantener para compatibilidad |
| `backend/api/v1/approvals.py` | Legacy WS, no activar en runtime principal |
| `backend/api/v1/websockets.py` | Existente, activar para intervención |

---

## 1.2 ENDPOINTS AFECTADOS

### NUEVOS ENDPOINTS (CREAR)

#### GESTIÓN DE INTERVENCIONES

```
POST   /api/interventions/request
       Request intervención en venta/cotización
       Body: { document_type, document_id, reason, scope }
       
POST   /api/interventions/{intervention_id}/assign
       Supervisor asigna caso a sí mismo
       Body: {}
       
POST   /api/interventions/{intervention_id}/lock/acquire
       Adquirir lock de documento
       Body: { scope }  # "global", "items", "section_name"
       
POST   /api/interventions/{intervention_id}/lock/heartbeat
       Renovar lock (cada 30s)
       Body: {}
       
POST   /api/interventions/{intervention_id}/modify
       Realizar cambios autorizados
       Body: { changes: {...}, reason }
       
POST   /api/interventions/{intervention_id}/approve
       Aprobar intervención y aplicar cambios
       Body: { resolution_reason }
       
POST   /api/interventions/{intervention_id}/reject
       Rechazar intervención
       Body: { resolution_reason }
       
GET    /api/interventions?state=...&document_type=...
       Listar casos intervención
       
GET    /api/interventions/{intervention_id}
       Obtener detalles caso
       
GET    /api/interventions/document/{document_type}/{document_id}
       Obtener caso activo para documento
```

#### LOCKS DE DOCUMENTO

```
POST   /api/document-locks/acquire
       Adquirir lock (sin intervención)
       Body: { document_type, document_id, scope }
       
POST   /api/document-locks/{lock_id}/release
       Liberar lock
       
POST   /api/document-locks/{lock_id}/heartbeat
       Renovar lock
       
GET    /api/document-locks/document/{document_type}/{document_id}
       Obtener locks activos
```

#### SNAPSHOTS Y AUDITORÍA

```
GET    /api/interventions/{intervention_id}/snapshots
       Obtener before/after snapshots
       
GET    /api/interventions/{intervention_id}/audit
       Obtener eventos auditoría intervención
```

### ENDPOINTS MODIFICADOS (AGREGAR VALIDACIÓN)

```
POST   /api/sales
       ↳ Validar no en intervención activa
       ↳ Si falla: incluir intervention_required=true, intervention_id
       
PUT    /api/sales/{sale_id}
       ↳ Validar lock de documento
       ↳ Si vendedor: rechazar si en intervención
       ↳ Si supervisor: permitir si tiene lock y token
       
PATCH  /api/sales/{sale_id}/commercial-terms
       ↳ Validar lock de sección comercial
       ↳ Registrar change en auditoría intervención
       
POST   /api/sales/{sale_id}/requests/edit
       ↳ SI límite excedido → crear intervención en lugar de sale_request
       
PATCH  /api/quotations/{id}
       ↳ Idem validación sales
       
PUT    /api/quotations/{id}/status
       ↳ Idem validación sales
```

---

## 1.3 MODELOS AFECTADOS

### NUEVOS MODELOS

| Modelo | Ubicación |
|--------|-----------|
| `InterventionCase` | `backend/models/intervention_models.py` |
| `DocumentLock` | `backend/models/lock_models.py` |
| `InterventionToken` | `backend/models/intervention_models.py` |
| `InterventionSnapshot` | `backend/models/intervention_models.py` |
| `InterventionAuditEvent` | `backend/models/audit_models.py` |
| `DocumentVersion` | `backend/models/` |

### MODELOS EXTENDIDOS

| Modelo | Cambios |
|--------|---------|
| `Sale` | Agregar: `intervention_id`, `intervention_locked`, `document_version`, `frozen_fields`, `lock_owner_id` |
| `Quotation` | Idem Sale |
| `User` | Agregar: `intervention_lock_expires_at` |
| `Notification` | Agregar: `intervention_id`, `intervention_action_required` |

---

## 1.4 ESTADOS AFECTADOS

### NUEVOS ESTADOS INTERVENCIÓN

```yaml
INTERVENCIÓN (documento):
  - created                      # Caso creado, esperando asignación
  - assigned                     # Supervisor asignó a sí mismo
  - in_review                    # Lock adquirido, supervisando
  - modifications_requested      # Supervisor pidió cambios a vendedor
  - modifications_provided       # Vendedor subió cambios
  - approved                     # Supervisor aprobó, cambios aplicados
  - rejected                     # Supervisor rechazó
  - expired                      # TTL venció sin resolver
  
TRANSICIONES VÁLIDAS:
  created → assigned
  assigned → in_review
  in_review → modifications_requested
  modifications_requested → modifications_provided → approved
  modifications_provided → in_review (rechazar cambios)
  [cualquiera] → rejected
  [cualquiera] → expired (timeout TTL)
```

### ESTADOS LOCK

```yaml
LOCK (documento):
  - free                         # Sin lock
  - locked                       # Lock activo
  - expired                      # Lock expiró
  - released                     # Liberado voluntariamente
```

### EXTENSIÓN WORKFLOW VENTA/COTIZACIÓN

```yaml
WORKFLOW DOCUMENTO:
  created
  → [SI intervención requerida] intervention_pending
    → intervention_in_progress
    → intervention_resolved (approved/rejected)
  → ready_for_caja / rejected
```

---

## 1.5 COMPONENTES FRONTEND AFECTADOS

| Componente | Cambios |
|-----------|---------|
| `SalesPage.jsx` | Mostrar estado intervención, botón "Solicitar Intervención", overlay readonly |
| `QuotationsPage.jsx` | Idem SalesPage |
| `SaleForm.jsx` | Readonly cuando intervención activa, indicadores lock, countdowns |
| `NotificationsPage.jsx` | Mostrar y actuar sobre intervention requests |
| `ApprovalsPage.jsx` | (Existente, compatible, agregar tipo intervención) |
| `MainLayout.jsx` | Icono intervención en badge notificaciones |
| `Sidebar.jsx` | Link nuevo: "Intervenciones Pendientes" (si supervisor) |

---

## 1.6 MIDDLEWARES AFECTADOS

| Middleware | Cambios |
|-----------|---------|
| `enforce_session_lock` | Agregar check: si documento en intervención activa, solo supervisor asignado puede editar |
| `enforce_runtime_permissions` | Agregar: si intervención activa, requerir `intervention:modify` |
| `hypervisor_runtime_audit` | Extender para loguear cambios intervención |

---

# PARTE 2: DISEÑO FINAL DE COLECCIONES MONGODB

## 2.1 COLECCIÓN: intervention_cases

```javascript
db.createCollection("intervention_cases", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "intervention_id",
        "document_type",
        "document_id",
        "document_version",
        "state",
        "requester_id",
        "requester_name",
        "reason",
        "scope",
        "created_at"
      ],
      properties: {
        // IDENTIFICADORES
        _id: { bsonType: "objectId" },
        intervention_id: {
          bsonType: "string",
          pattern: "^intv_[a-f0-9]{12}$",
          description: "Identificador único intervención"
        },
        document_type: {
          enum: ["sale", "quotation"],
          description: "Tipo documento intervenido"
        },
        document_id: {
          bsonType: "string",
          description: "ID del documento (sale_id o quotation_id)"
        },
        document_version: {
          bsonType: "int",
          description: "Versión documento al momento de crear intervención"
        },
        
        // ESTADO
        state: {
          enum: [
            "created",
            "assigned",
            "in_review",
            "modifications_requested",
            "modifications_provided",
            "approved",
            "rejected",
            "expired"
          ]
        },
        state_transitions: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              from_state: { bsonType: "string" },
              to_state: { bsonType: "string" },
              actor_id: { bsonType: "string" },
              actor_role: { bsonType: "string" },
              timestamp: { bsonType: "date" },
              reason: { bsonType: "string" }
            }
          }
        },
        
        // METADATA SOLICITUD
        requester_id: { bsonType: "string" },
        requester_name: { bsonType: "string" },
        requester_role: { bsonType: "string" },
        requester_branch_id: { bsonType: "string" },
        reason: { bsonType: "string", minLength: 10 },
        scope: {
          enum: ["global", "items", "commercial_terms", "section_specific"],
          description: "Qué se puede editar en intervención"
        },
        scope_fields: {
          bsonType: "array",
          items: { bsonType: "string" },
          description: "Campos específicos permitidos editar (si scope=section_specific)"
        },
        
        // ASIGNACIÓN SUPERVISOR
        assignee_id: { bsonType: ["string", "null"] },
        assignee_name: { bsonType: ["string", "null"] },
        assignee_role: { bsonType: ["string", "null"] },
        assigned_at: { bsonType: ["date", "null"] },
        assignment_reason: { bsonType: ["string", "null"] },
        
        // LOCK DE DOCUMENTO
        lock_owner_id: { bsonType: ["string", "null"] },
        lock_acquired_at: { bsonType: ["date", "null"] },
        lock_expires_at: { bsonType: ["date", "null"] },
        lock_heartbeat_at: { bsonType: ["date", "null"] },
        lock_scope: { enum: ["global", "items", "commercial_terms"], default: "global" },
        
        // SNAPSHOTS
        before_snapshot: {
          bsonType: ["object", "null"],
          description: "Estado documento antes intervención"
        },
        after_snapshot: {
          bsonType: ["object", "null"],
          description: "Estado documento después aprobación"
        },
        current_modifications: {
          bsonType: ["object", "null"],
          description: "Cambios pendientes que supervisor propone"
        },
        
        // TOKENS
        intervention_token: {
          bsonType: "string",
          pattern: "^token_[a-f0-9]{32}$"
        },
        resolution_token: { bsonType: ["string", "null"] },
        token_created_at: { bsonType: "date" },
        token_expires_at: { bsonType: "date" },
        
        // RESOLUCIÓN
        resolution_state: {
          enum: [null, "approved", "rejected"],
          default: null
        },
        resolution_reason: { bsonType: ["string", "null"] },
        resolution_approved_by: { bsonType: ["string", "null"] },
        resolution_timestamp: { bsonType: ["date", "null"] },
        
        // METADATA TEMPORAL
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
        expires_at: { bsonType: "date", description: "TTL intervención (48h default)" },
        
        // METADATA AUDITORÍA
        created_by_session_id: { bsonType: "string" },
        created_by_ip: { bsonType: "string" },
        audit_events_count: { bsonType: "int", default: 0 }
      }
    }
  }
});

// ÍNDICES
db.intervention_cases.createIndex({ intervention_id: 1 }, { unique: true });
db.intervention_cases.createIndex({ document_type: 1, document_id: 1 }, { sparse: true });
db.intervention_cases.createIndex({ document_type: 1, document_id: 1, state: 1 });
db.intervention_cases.createIndex({ state: 1, expires_at: 1 });
db.intervention_cases.createIndex({ assignee_id: 1, state: 1 });
db.intervention_cases.createIndex({ requester_id: 1, created_at: -1 });
db.intervention_cases.createIndex({ intervention_token: 1 }, { unique: true });
db.intervention_cases.createIndex(
  { expires_at: 1 },
  { expireAfterSeconds: 0 }  // TTL index
);
```

---

## 2.2 COLECCIÓN: document_locks

```javascript
db.createCollection("document_locks", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "lock_id",
        "document_type",
        "document_id",
        "owner_id",
        "scope",
        "acquired_at",
        "expires_at"
      ],
      properties: {
        _id: { bsonType: "objectId" },
        lock_id: {
          bsonType: "string",
          pattern: "^lock_[a-f0-9]{12}$"
        },
        
        // DOCUMENTO
        document_type: { enum: ["sale", "quotation"] },
        document_id: { bsonType: "string" },
        document_version: { bsonType: "int" },
        
        // PROPIETARIO
        owner_id: { bsonType: "string" },
        owner_role: { bsonType: "string" },
        owner_branch_id: { bsonType: "string" },
        
        // SCOPE LOCK
        scope: {
          enum: ["global", "items", "commercial_terms", "custom"],
          description: "Nivel granularidad lock"
        },
        locked_fields: {
          bsonType: ["array", "null"],
          items: { bsonType: "string" }
        },
        
        // INTERVENCIÓN ASOCIADA
        intervention_id: { bsonType: ["string", "null"] },
        
        // TEMPORAL
        acquired_at: { bsonType: "date" },
        expires_at: { bsonType: "date" },
        heartbeat_at: { bsonType: "date" },
        heartbeat_interval_ms: { bsonType: "int", default: 30000 },
        
        // METADATA
        lock_reason: { bsonType: "string" },
        created_by_session_id: { bsonType: "string" },
        created_by_ip: { bsonType: "string" }
      }
    }
  }
});

db.document_locks.createIndex({ lock_id: 1 }, { unique: true });
db.document_locks.createIndex({ document_type: 1, document_id: 1 }, { sparse: true });
db.document_locks.createIndex({ owner_id: 1, document_type: 1 });
db.document_locks.createIndex(
  { expires_at: 1 },
  { expireAfterSeconds: 0 }
);
```

---

## 2.3 COLECCIÓN: intervention_audit_events

```javascript
db.createCollection("intervention_audit_events", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "event_id",
        "intervention_id",
        "event_type",
        "timestamp"
      ],
      properties: {
        _id: { bsonType: "objectId" },
        event_id: {
          bsonType: "string",
          pattern: "^evt_[a-f0-9]{12}$"
        },
        intervention_id: { bsonType: "string" },
        
        // TIPO EVENTO
        event_type: {
          enum: [
            "intervention_created",
            "intervention_assigned",
            "lock_acquired",
            "lock_released",
            "modification_submitted",
            "modification_applied",
            "intervention_approved",
            "intervention_rejected",
            "intervention_expired",
            "state_changed",
            "snapshot_created"
          ]
        },
        
        // ACTOR
        actor_id: { bsonType: "string" },
        actor_name: { bsonType: "string" },
        actor_role: { bsonType: "string" },
        actor_branch_id: { bsonType: "string" },
        
        // DATOS EVENTO
        action_details: {
          bsonType: "object",
          additionalProperties: true
        },
        
        // CAMBIOS (si aplica)
        changes: {
          bsonType: ["object", "null"],
          properties: {
            field_name: { bsonType: "string" },
            old_value: { bsonType: ["string", "int", "double", "bool", "null"] },
            new_value: { bsonType: ["string", "int", "double", "bool", "null"] },
            change_reason: { bsonType: "string" }
          }
        },
        
        // SNAPSHOTS
        before_state: { bsonType: ["object", "null"] },
        after_state: { bsonType: ["object", "null"] },
        
        // CONTEXTO AUDITORÍA
        session_id: { bsonType: "string" },
        ip_address: { bsonType: "string" },
        user_agent: { bsonType: ["string", "null"] },
        hostname: { bsonType: ["string", "null"] },
        
        // TEMPORAL
        timestamp: { bsonType: "date" },
        duration_ms: { bsonType: ["int", "null"] },
        
        // ÍNDICES BÚSQUEDA
        document_type: { bsonType: "string" },
        document_id: { bsonType: "string" }
      }
    }
  }
});

db.intervention_audit_events.createIndex({ intervention_id: 1, timestamp: -1 });
db.intervention_audit_events.createIndex({ event_id: 1 }, { unique: true });
db.intervention_audit_events.createIndex({ actor_id: 1, timestamp: -1 });
db.intervention_audit_events.createIndex({ event_type: 1, timestamp: -1 });
db.intervention_audit_events.createIndex({ document_type: 1, document_id: 1, timestamp: -1 });
db.intervention_audit_events.createIndex({ timestamp: -1 });
```

---

## 2.4 COLECCIÓN: document_snapshots

```javascript
db.createCollection("document_snapshots", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "snapshot_id",
        "intervention_id",
        "snapshot_type",
        "document_data",
        "timestamp"
      ],
      properties: {
        _id: { bsonType: "objectId" },
        snapshot_id: {
          bsonType: "string",
          pattern: "^snap_[a-f0-9]{12}$"
        },
        intervention_id: { bsonType: "string" },
        
        // TIPO SNAPSHOT
        snapshot_type: {
          enum: ["before_intervention", "after_approval", "modification_point"],
          description: "Cuándo se tomó el snapshot"
        },
        
        // DOCUMENTO COMPLETO
        document_data: {
          bsonType: "object",
          additionalProperties: true,
          description: "Copia completa documento venta/cotización"
        },
        
        // INFORMACIÓN CLIENTE/VEHÍCULO (desnormalizado)
        customer_snapshot: { bsonType: ["object", "null"] },
        vehicle_snapshot: { bsonType: ["object", "null"] },
        
        // METADATA
        created_by: { bsonType: "string" },
        created_by_role: { bsonType: "string" },
        timestamp: { bsonType: "date" },
        reason: { bsonType: ["string", "null"] }
      }
    }
  }
});

db.document_snapshots.createIndex({ snapshot_id: 1 }, { unique: true });
db.document_snapshots.createIndex({ intervention_id: 1, snapshot_type: 1 });
db.document_snapshots.createIndex({ timestamp: -1 });
```

---

## 2.5 COLECCIÓN: intervention_tokens

```javascript
db.createCollection("intervention_tokens", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "token_id",
        "intervention_id",
        "token_type",
        "token_value",
        "issued_at",
        "expires_at"
      ],
      properties: {
        _id: { bsonType: "objectId" },
        token_id: {
          bsonType: "string",
          pattern: "^tok_[a-f0-9]{12}$"
        },
        intervention_id: { bsonType: "string" },
        
        // TOKEN
        token_type: {
          enum: ["intervention_access", "resolution_authority"]
        },
        token_value: {
          bsonType: "string",
          pattern: "^[a-f0-9]{64}$",
          description: "SHA256 token"
        },
        
        // PROPÓSITO
        token_purpose: { bsonType: "string" },
        required_role: { bsonType: "string" },
        
        // USAGE
        issued_to_id: { bsonType: "string" },
        issued_to_role: { bsonType: "string" },
        used: { bsonType: "bool", default: false },
        used_at: { bsonType: ["date", "null"] },
        used_by_id: { bsonType: ["string", "null"] },
        
        // TEMPORAL
        issued_at: { bsonType: "date" },
        expires_at: { bsonType: "date" },
        ttl_minutes: { bsonType: "int", default: 120 },
        
        // METADATA
        created_by_session_id: { bsonType: "string" },
        one_time_use: { bsonType: "bool", default: true }
      }
    }
  }
});

db.intervention_tokens.createIndex({ token_value: 1 }, { unique: true });
db.intervention_tokens.createIndex({ intervention_id: 1 });
db.intervention_tokens.createIndex({ token_type: 1, used: 1 });
db.intervention_tokens.createIndex(
  { expires_at: 1 },
  { expireAfterSeconds: 0 }
);
```

---

# PARTE 3: DISEÑO DE WORKFLOW

## 3.1 FLUJO COMPLETO: VENDEDOR → SUPERVISOR → CAJA

### FASE 1: VENDEDOR INICIA

```
[VENDEDOR crea venta/cotización]
       ↓
  Validación backend
       ↓
  ¿Excede límite descuento?
  ¿Requiere aprobación especial?
       ↓ SÍ
  [BACKEND crea InterventionCase]
  state = "created"
  Notifica a supervisores
       ↓
  [FRONTEND muestra]
  - Badge "Intervención Requerida"
  - Overlay readonly
  - Botón "Ver Detalles"
```

### FASE 2: SUPERVISOR ASIGNA Y REVISA

```
[SUPERVISOR ve notificación]
       ↓
  [Entra a panel intervenciones]
       ↓
  [Clic "Tomar Control" del caso]
  POST /api/interventions/{id}/assign
       ↓
  [BACKEND:]
  - Asigna InterventionCase a supervisor
  - state = "assigned"
  - Crea snapshot "before_intervention"
       ↓
  [SUPERVISOR adquiere lock]
  POST /api/interventions/{id}/lock/acquire
  scope = "global" | "items" | "commercial_terms"
       ↓
  [BACKEND:]
  - Crea DocumentLock
  - InterventionCase.state = "in_review"
  - Inicia heartbeat de lock (30s)
       ↓
  [SUPERVISOR ve documento readonly]
  - No puede editar
  - Aparecen secciones bloqueadas
  - Countdown TTL lock (48h típico)
```

### FASE 3: SUPERVISOR REVISA Y DECIDE

```
OPCIÓN A: Aprobación directa (cambios mínimos)
  [Clic "Aprobar Intervención"]
       ↓
  [Diálogo confirma]
       ↓
  POST /api/interventions/{id}/approve
  body: { resolution_reason }
       ↓
  [BACKEND:]
  - state = "approved"
  - Crea snapshot "after_approval"
  - Aplica cambios originales vendedor
  - Libera lock
  - Crea InterventionAuditEvent
       ↓
  [Venta lista para caja]

OPCIÓN B: Solicitar cambios al vendedor
  [Clic "Solicitar Cambios"]
       ↓
  [Diálogo: ingresa qué cambiar]
       ↓
  POST /api/interventions/{id}/modify
  body: { changes: {...}, reason }
       ↓
  [BACKEND:]
  - InterventionCase.state = "modifications_requested"
  - Almacena cambios propuestos en current_modifications
  - Notifica vendedor
  - Mantiene lock activo
       ↓
  [VENDEDOR ve]
  - Notificación "Supervisor pidió cambios"
  - Overlay detalla qué cambiar
  - Botón "Enviar Cambios Solicitados"
       ↓
  [VENDEDOR carga cambios]
  POST /api/interventions/{id}/modifications
       ↓
  [BACKEND:]
  - Almacena cambios en InterventionCase
  - state = "modifications_provided"
  - Notifica supervisor
       ↓
  [SUPERVISOR revisa]
  - Puede aprobar O pedir más cambios (loop)

OPCIÓN C: Rechazar intervención
  [Clic "Rechazar Intervención"]
       ↓
  [Diálogo: motivo]
       ↓
  POST /api/interventions/{id}/reject
  body: { resolution_reason }
       ↓
  [BACKEND:]
  - state = "rejected"
  - Libera lock
  - Venta vuelve a estado anterior
  - Notifica vendedor
  - Auditoría completa
```

### FASE 4: CAJA PROCESA

```
[DOCUMENTO aprobado]
       ↓
  workflow_state = "ready_for_caja"
       ↓
  [CAJERO ve documento]
  - Etiqueta: "Venta Intervenida por [Supervisor]"
  - Motivo intervención visible
  - No hay restricciones de edición caja
  - (Caja puede siempre anular después)
       ↓
  [Procesa normalmente]
```

### FASE 5: EXPIRACIÓN Y TIMEOUT

```
[Si pasan 48 horas sin resolución]
       ↓
  [BACKGROUND JOB detecta]
  state = "created" | "in_review"
  expires_at < ahora
       ↓
  [Actualiza]
  state = "expired"
  intervention_locked = false
  
  [NOTIFICACIÓN]
  "Intervención expirada, documento liberado"
```

---

## 3.2 MATRIZ DE TRANSICIONES VÁLIDAS

```
FROM STATE              TO STATE                CONDITIONS
─────────────────────  ──────────────────────  ─────────────────────
created                assigned                Supervisor presente
created                expired                 TTL > 48h
assigned               in_review               Lock adquirido
assigned               expired                 TTL venció
in_review              modifications_requested Supervisor decide cambios
in_review              approved                Supervisor aprueba
in_review              rejected                Supervisor rechaza
in_review              expired                 TTL venció
modifications_          modifications_provided  Vendedor envía cambios
requested              
modifications_         in_review               Supervisor revisa
provided               
modifications_         rejected                Supervisor rechaza
provided               
[CUALQUIERA]          expired                 TTL > 48h

TRANSICIONES INVÁLIDAS:
- assigned → rejected (debe pasar por in_review)
- modifications_requested → modifications_requested
- [CUALQUIERA] → created
```

---

# PARTE 4: DISEÑO DE LOCKS

## 4.1 TIPOS DE LOCK

### GLOBAL LOCK
```
Efecto: Documento 100% readonly para vendedor
Alcance: Todos los campos
Usuario: Solo supervisor asignado + caja

Cuándo:
  - Supervisor toma control documento
  - Intervención en estado "in_review"

Expiración:
  - TTL: 48 horas (renovable via heartbeat)
  - Renovación: Cada 30s si supervisor activo
  - Liberación manual: approve/reject intervención
```

### ITEM LOCK
```
Efecto: Solo ciertos items bloqueados
Alcance: Específico { product_id, ...}
Usuario: Vendedor puede editar otros items

Cuándo:
  - Supervisor bloquea item específico p/ auditoría
  - scope = "items"

Expiración:
  - TTL: 24 horas
```

### SECTION LOCK
```
Efecto: Solo sección comercial bloqueada
Alcance: { discount%, iva_rate, payment_method, ... }
Usuario: Vendedor puede editar items, vehículo, cliente

Cuándo:
  - scope = "commercial_terms"
  - comercial_terms_locked = true

Expiración:
  - TTL: 24 horas
```

---

## 4.2 CICLO DE VIDA LOCK

```
1. CREAR LOCK
   POST /api/interventions/{id}/lock/acquire
   {
     "scope": "global" | "items" | "commercial_terms",
     "document_type": "sale",
     "document_id": "sale_xxx",
     "reason": "Supervisor review intervention case"
   }
   
   BACKEND:
   - Genera lock_id = "lock_" + random(12)
   - Calcula expires_at = ahora + 48h
   - Inserta DocumentLock
   - InterventionCase.lock_owner_id = supervisor_id
   - state = "in_review"
   - Auditoría: "lock_acquired"

2. HEARTBEAT (cada 30s)
   POST /api/document-locks/{lock_id}/heartbeat
   
   BACKEND:
   - Valida lock existe y no expiró
   - Actualiza heartbeat_at = ahora
   - Extiende expires_at = ahora + 48h

3. LIBERAR LOCK (manual)
   POST /api/document-locks/{lock_id}/release
   O
   POST /api/interventions/{id}/approve | reject
   
   BACKEND:
   - Busca lock asociado
   - Marca released = true
   - Auditoría: "lock_released"

4. EXPIRACIÓN (automática)
   [BACKGROUND JOB cada 10 min]
   
   Detecta:
   - DocumentLock.expires_at < ahora
   - InterventionCase.lock_expires_at < ahora
   
   Acciones:
   - Marca lock como "expired"
   - Libera documento
   - Actualiza intervención state = "expired"
   - Notifica supervisor
```

---

## 4.3 PREVENCIÓN RACE CONDITIONS

### SCENARIO: DOS SUPERVISORES INTENTAN LOCK SIMULTÁNEO

```
SUPERVISOR A                          SUPERVISOR B
─────────────────────────────────────────────────────
POST lock/acquire
↓                                     POST lock/acquire
[BACKEND A: valida]                   ↓
[BACKEND B: valida]
[BACKEND A: inserta primero]          ↓
Lock.inserted_A                       [BACKEND B: busca]
↓                                     [B detecta lock existe]
Success A                             ↓
                                      Error 409: "Already locked"
                                      ↓
                                      SUPERVISOR B ve mensaje:
                                      "Supervisor X ya controla"
```

**IMPLEMENTACIÓN**:
```
1. Unique index: (document_type, document_id, lock_owner_id)
   + Sparse para permitir un solo lock por documento

2. Transacción:
   db.session.startTransaction()
   - Busca lock existente para doc
   - SI existe: rollback, error 409
   - SI no: crea, actualiza intervención
   - Auditoría
   db.session.commitTransaction()

3. Validación optimistic:
   Lock necesita document_version
   SI document cambió fuera intervención: error 409
```

### SCENARIO: CONCURRENCIA HEARTBEAT vs EXPIRE

```
HEARTBEAT THREAD                      EXPIRE JOB
─────────────────────────────────────────────────
[Cada 30s]                            [Cada 10 min]
     ↓
POST heartbeat
     ↓
[BACKEND: busca lock]
     ↓                                [Busca locks vencidos]
[Actualiza heartbeat_at]              ↓
[Extiende expires_at]                 [Detecta lock con
     ↓                                 expires_at < ahora]
Success                               ↓
                                      [Intenta marcar expired]
                                      ↓
                                      [Usa versión lock
                                       para evitar conflict]
                                      
SOLUCIÓN:
- Lock tiene version field
- Heartbeat incremente version
- Expire cheque version antes actuar
- SI versión cambió: skip, otro ganó
```

---

# PARTE 5: VERSIONADO DE DOCUMENTOS

## 5.1 OPTIMISTIC LOCKING

```
documento.document_version = 1
documento.last_updated = 2026-05-15T10:00:00Z
documento.lock_owner_id = null

[VENDEDOR intenta edit]
PATCH /api/sales/{id}
{
  "document_version": 1,    # Versión que vio el cliente
  "changes": {
    "items": [...],
    "discount": 5
  }
}

[BACKEND:]
sale = db.sales.findOne({sale_id})
SI sale.document_version != 1:
  → ERROR 409: "Stale document"
  → "Documento cambió. Recarga."
SI sale.intervention_locked:
  → ERROR 423: "Document locked"
SI sale.document_version == 1:
  → Incrementa version a 2
  → Aplica cambios
  → Auditoría

[CLIENTE recibe]
{
  "status": "ok",
  "document_version": 2
}

[SIGUIENTE EDIT]
Cliente DEBE usar version 2
```

---

## 5.2 MANEJO DE PESTAÑAS VIEJAS

```
[Usuario 1 abre SalesPage]
  ↓
[Carga venta con version 5]
  ↓
[Supervisor interviene]
  ↓
[version → 6]
  ↓
[Usuario 1 sigue con tab viejo]
  ↓
[Intenta editar con version 5]
  ↓
ERROR 409:
{
  "code": "STALE_DOCUMENT",
  "message": "El documento fue modificado",
  "current_version": 6,
  "your_version": 5,
  "action": "Recarga la página"
}

[FRONTEND:]
- Detecta error 409
- Muestra modal: "Documento modificado"
- Botón "Recargar"
- Desactiva form hasta recargar
```

---

## 5.3 ROLLBACK STRATEGY

```
[SUPERVISOR aprueba cambios]
  ↓
[BACKEND crea InterventionAuditEvent]
  ↓
SI error DB:
  - Rollback pending changes
  - Restaura document_version anterior
  - Limpia lock
  - Notifica: "Aprobación falló, intenta de nuevo"
  - Intervención sigue activa

[VENDEDOR puede ver:]
- "Aprobación falló"
- Botón "Reintentar"
- Estado: sigue en "modifications_provided"
```

---

# PARTE 6: FREEZE FINANCIERO

## 6.1 CAMPOS CONGELADOS

```
CATEGORÍA: MONTO BASE
- subtotal                # NO recalcular
- items[].unit_price      # Solo editable si scope=items
- items[].quantity        # Solo editable si scope=items
- items[].discount        # Bloqueado

CATEGORÍA: IMPUESTOS
- iva_rate                # Congelado
- iva_amount              # Congelado (recalculado solo si items editan)
- retention_rate          # Congelado
- retention_amount        # Congelado

CATEGORÍA: TOTALES
- total_legal             # Recalculado post-cambios
- net_to_collect          # Recalculado post-cambios
- discount_amount         # Congelado

CATEGORÍA: MONEDA
- currency                # Congelado
- exchange_rate           # Congelado
- exchange_rate_locked    # true

CATEGORÍA: PAGO
- payment_type            # Congelado
- payment_method          # Congelado
- credit_due_date         # Congelado

CATEGORÍA: COMERCIAL
- global_discount %       # Congelado
- discount_codes          # Congelado

CATEGORÍA: METADATA
- commercial_terms_locked # true (siempre en intervención)
```

---

## 6.2 REGLAS FREEZE

```
Intervención state = "in_review"
↓

VENDEDOR intenta edit:
- items prices           → BLOQUEADO
- descuentos             → BLOQUEADO
- iva_rate              → BLOQUEADO
- moneda                → BLOQUEADO
- payment method        → BLOQUEADO

SUPERVISOR puede:
- Modificar items[]
- Cambiar cantidades
- Cambiar clientes
- Cambiar vehículos
- NO puede cambiar:
  - Moneda
  - IVA rate
  - Payment method
  - (Salvo motivo especial + nueva intervención)

RECALCULACIÓN:
- Si items cambian → recalcula subtotal
- Si subtotal cambia + iva_rate frozen → recalcula iva_amount
- Si todo anterior → recalcula net_to_collect
- totals se recalculan siempre

Snapshot:
- before_snapshot: totales en el momento
- after_snapshot: totales después aprobación
- audit_event: registra qué congeló y qué permitió cambiar
```

---

# PARTE 7: SNAPSHOTS

## 7.1 SNAPSHOT BEFORE_INTERVENTION

```
Se toma cuando:
  InterventionCase.state = "assigned"
  Supervisor adquiere lock

Contenido:
{
  "snapshot_id": "snap_abc123xyz",
  "intervention_id": "intv_def456",
  "snapshot_type": "before_intervention",
  "timestamp": "2026-05-15T10:30:00Z",
  
  "document_data": {
    // DOCUMENTO COMPLETO
    "sale_id": "sale_xxx",
    "invoice_number": "INV-20260515-0001",
    "customer_id": "cust_yyy",
    "customer_name": "ACME Corp",
    
    // ITEMS
    "items": [
      {
        "product_id": "prod_1",
        "product_name": "Producto A",
        "quantity": 2,
        "unit_price": 100.00,
        "discount": 0,
        "subtotal": 200.00
      }
    ],
    
    // FINANCIERO
    "subtotal": 200.00,
    "iva_rate": 0.12,
    "iva_amount": 24.00,
    "total": 224.00,
    "discount_percent": 0,
    "discount_amount": 0,
    "net_to_collect": 224.00,
    
    // PAGO
    "payment_type": "cash",
    "payment_method": "cash",
    
    // VEHÍCULO
    "vehicle_id": "veh_zzz",
    "vehicle_description": "2023 Toyota Corolla",
    
    // METADATOS
    "created_at": "2026-05-15T09:00:00Z",
    "created_by": "user_vendedor_1",
    "created_by_name": "Juan Vendedor",
    "branch_id": "branch_main",
    "document_version": 1
  },
  
  "customer_snapshot": { ... },  # Cliente completo
  "vehicle_snapshot": { ... },   # Vehículo completo
  
  "created_by": "user_supervisor_1",
  "created_by_role": "gerencia",
  "reason": "Baseline before supervisor intervention"
}
```

---

## 7.2 SNAPSHOT AFTER_APPROVAL

```
Se toma cuando:
  InterventionCase.state = "approved"
  Cambios aprobados

Contenido:
{
  "snapshot_id": "snap_def456xyz",
  "intervention_id": "intv_def456",
  "snapshot_type": "after_approval",
  "timestamp": "2026-05-15T11:00:00Z",
  
  "document_data": {
    // Estado FINAL después aprobación
    "sale_id": "sale_xxx",
    
    // Items PUEDEN HABER CAMBIADO
    "items": [
      {
        "product_id": "prod_1",
        "quantity": 3,        # Cambió de 2 a 3
        "unit_price": 95.00,  # Cambió de 100 a 95
        "subtotal": 285.00
      }
    ],
    
    // Totales RECALCULADOS
    "subtotal": 285.00,
    "iva_amount": 34.20,
    "total": 319.20,
    "net_to_collect": 319.20,
    
    // Congelados siguen igual
    "iva_rate": 0.12,
    "payment_type": "cash",
    
    "document_version": 2  # Incrementó
  },
  
  "created_by": "user_supervisor_1",
  "created_by_role": "gerencia",
  "reason": "Approved intervention final state"
}
```

---

## 7.3 DIFF AUDIT

```
EVENTO AUDITORÍA:
{
  "event_id": "evt_xyz789",
  "event_type": "intervention_approved",
  "intervention_id": "intv_def456",
  
  "before_snapshot_id": "snap_abc123xyz",
  "after_snapshot_id": "snap_def456xyz",
  
  "changes": [
    {
      "field": "items[0].quantity",
      "old_value": 2,
      "new_value": 3,
      "impact": "subtotal increased by 95"
    },
    {
      "field": "items[0].unit_price",
      "old_value": 100.00,
      "new_value": 95.00,
      "impact": "unit price decreased"
    },
    {
      "field": "subtotal",
      "old_value": 200.00,
      "new_value": 285.00,
      "impact": "changed by supervisor review"
    },
    {
      "field": "document_version",
      "old_value": 1,
      "new_value": 2,
      "impact": "version incremented"
    }
  ],
  
  "timestamp": "2026-05-15T11:00:00Z",
  "actor": "supervisor_1",
  "actor_role": "gerencia"
}
```

---

# PARTE 8: AUDITORÍA COMPLETA

## 8.1 REGISTRO AUDITORÍA

```
EVENTO: intervention_created
────────────────────────────
intervention_id: intv_abc123
document_type: sale
document_id: sale_xxx
requester_id: user_vendedor_1
requester_name: Juan Vendedor
requester_role: ventas
requester_branch_id: branch_main

reason: "Descuento solicitado 15% excede límite 5%"
scope: "global"

timestamp: 2026-05-15T10:15:00Z
actor_session_id: sess_yyy
actor_ip: 192.168.1.100
hostname: vendedor-laptop

EVENTO: intervention_assigned
────────────────────────────
intervention_id: intv_abc123
assignee_id: user_supervisor_1
assignee_name: Pedro Supervisor
assignee_role: gerencia

timestamp: 2026-05-15T10:25:00Z
action: "Supervisor took control"
actor_session_id: sess_zzz
actor_ip: 192.168.1.101

EVENTO: lock_acquired
────────────────────
intervention_id: intv_abc123
lock_id: lock_def456
document_type: sale
document_id: sale_xxx
scope: "global"

timestamp: 2026-05-15T10:26:00Z
lock_expires_at: 2026-05-17T10:26:00Z

EVENTO: intervention_approved
────────────────────────────
intervention_id: intv_abc123
before_snapshot_id: snap_abc123xyz
after_snapshot_id: snap_def456xyz

changes:
  - field: items[0].quantity
    old: 2, new: 3
  - field: subtotal
    old: 200, new: 285

resolution_reason: "Items ajustados, descuento reducido a 3%"

timestamp: 2026-05-15T11:00:00Z
actor: user_supervisor_1
actor_role: gerencia
duration_minutes: 34
```

---

## 8.2 RETENCIÓN AUDITORÍA

```
Retención de eventos:
  - 7 años (por ley fiscal)
  - Almacenar en intervención_audit_events
  - No purgar nunca
  - Índice by timestamp para búsqueda

Búsquedas auditoría:
  - Intervención específica
  - Rango fechas
  - Actor específico
  - Documento específico
  - Evento tipo específico

Reportes auditoría:
  - "Intervenciones por supervisor"
  - "Intervenciones por sucursal"
  - "Intervenciones por motivo"
  - "Duración promedio intervención"
  - "Tasa aprobación/rechazo"
```

---

# PARTE 9: TOKENS

## 9.1 INTERVENTION_TOKEN

```
Propósito:
  - Autenticar supervisor acceso modificación
  - One-time use
  - TTL 2 horas
  - Asociado a intervención específica

Generación:
  POST /api/interventions/request
  {
    "document_type": "sale",
    "document_id": "sale_xxx",
    "reason": "Descuento excede límite"
  }
  
  [BACKEND genera token]
  - token_value = SHA256(random_bytes)
  - intervention_token = token_value
  - token_expires_at = ahora + 2h
  - Almacena en InterventionCase

Validación:
  [SUPERVISOR accede dashboard]
  [Frontend envía]
  Authorization: Bearer token_value
  
  [BACKEND valida]
  - Busca InterventionCase con token
  - Verifica not expired
  - Verifica assignee_id == usuario actual
  - Permite acceso a /api/interventions/{id}/modify

Invalidación:
  - TTL vence → automático
  - Intervención approved/rejected → invalidar
  - Nuevo assign → nuevo token
```

---

## 9.2 RESOLUTION_TOKEN

```
Propósito:
  - Confirmar acción resolve (approve/reject)
  - Prevenir resubmit accidental
  - One-time use
  - TTL 10 minutos

Generación:
  [SUPERVISOR clic "Aprobar Intervención"]
  
  [FRONTEND prepara]
  POST /api/interventions/{id}/approve
  {
    "resolution_reason": "Items ajustados satisfactoriamente",
    "csrf_token": "token_from_session"
  }
  
  [BACKEND genera resolution_token]
  - Si no existe: crea nueva
  - resolution_token = token_value
  - token_expires_at = ahora + 10min
  - one_time_use = true

Validación:
  [BACKEND procesa approve]
  - Validata resolution_token exists
  - Validata not used
  - Validata not expired
  - Marca used = true
  - Aplica aprobación

Reintento:
  [Si supervisor reentra]
  - Token ya usado → error "Already processed"
  - Muestra estado actual aprobación
```

---

## 9.3 CICLO COMPLETO TOKEN

```
t=0: Crear intervención
     → intervention_token generado
     → Válido 2 horas

t=15min: Supervisor accede
         → Usa intervention_token
         → Validación exitosa

t=45min: Supervisor declara aprobar
         → resolution_token generado
         → Válido 10 minutos

t=48min: POST approve con resolution_token
         → Validación exitosa
         → token marcado como used
         → Aprobación aplicada

t=49min: Supervisor recarga página
         → Ve estado "approved"
         → Si intenta POST approve again
         → Error 409: "Already processed with token X"
```

---

# PARTE 10: INTEGRACIÓN CON DRAFTS

## 10.1 DRAFT PROTECTION

```
Cuando:
  user_drafts existe
  usuario abre documento en intervención

Comportamiento:
  [FRONTEND carga draft]
  draft = localStorage.getItem("draft_sale_v1_sale_xxx")
  
  [GET documento del servidor]
  sale = GET /api/sales/sale_xxx
  
  SI sale.intervention_locked == true:
    draft.protected = true
    [FRONTEND:]
    - No puede restaurar desde draft
    - Draft se congelaa
    - Muestra: "Draft bloqueado por intervención"
    - Cita supervisor/motivo

SI intervention se aprueba:
  [Backend notifica]
  draft.protected = false
  draft_last_synced = approval_timestamp
  [FRONTEND:]
  - Draft se desbloquea
  - Pueda restaurar si quiere

SI intervention se rechaza:
  draft.protected = false
  [FRONTEND:]
  - Draft disponible
  - "Intervención rechazada, draft disponible"
```

---

## 10.2 DRAFT EXPIRATION CON INTERVENCIÓN

```
Normal (sin intervención):
  Draft expira después 30 días de inactividad

Con intervención:
  SI intervention.state = "in_review":
    Draft TTL extendido → expires = intervention.expires_at + 7 días
    Razón: supervisor puede necesitar revertir cambios post-aprobación
    
  SI intervention resuelta:
    Draft expira = approval_timestamp + 3 días
    (ventana para vendedor resolver inconsistencias)

Draft restore rules:
  - Solo vendedor original puede restaurar
  - SI intervención activa: permiso denegado
  - SI intervención aprobada: permitir restaurar
  - SI intervención rechazada: permitir restaurar
```

---

## 10.3 DRAFT SYNC CON AUDITORÍA

```
Draft tiene:
  - last_synced_document_version
  - last_synced_intervention_state
  - last_synced_timestamp

[VENDEDOR intenta restaurar draft]
  
  Cheques:
  1. draft.last_synced_document_version
     vs
     document.document_version
     
     SI version cambió:
     "Draft es antiguo, cambios se perdieron"
     Opción: "Ver qué cambió"
     
  2. draft.last_synced_intervention_state
     SI era "in_review" y ahora "approved":
     "Intervención se aprobó con otros cambios"
     "¿Descartar draft y usar versión aprobada?"
```

---

# PARTE 11: INTEGRACIÓN CON CAJA

## 11.1 IDENTIFICACIÓN DOCUMENTO INTERVENIDO

```
[CAJERO ve listado facturas]

Venta normal:
  INV-20260515-0001  | ACME | $224.00 | Pendiente Pago

Venta intervenida:
  INV-20260515-0002  | ACME | $319.20 | [INTERVENIDA] | Pendiente Pago
                                        ↑
                                     Badge rojo
                                     "Intervenida por Pedro"

[CAJERO clic en factura]

Panel derecha muestra:
  ┌─────────────────────────────┐
  │ INFORMACIÓN INTERVENCIÓN    │
  ├─────────────────────────────┤
  │ Estado: Aprobada            │
  │ Supervisor: Pedro Supervisor│
  │ Motivo: Ajuste items        │
  │ Aprobada: 15-05-2026 11:00 │
  ├─────────────────────────────┤
  │ CAMBIOS REALIZADOS          │
  │ - Qty item 1: 2 → 3         │
  │ - Total: $224 → $319        │
  ├─────────────────────────────┤
  │ SIN RESTRICCIONES DE CAJA   │
  │ (Caja puede anular siempre) │
  └─────────────────────────────┘
```

---

## 11.2 RESTRICCIONES CAJA

```
Factura normal:
  - Cajero puede anular si:
    - Autorización gerencia O
    - Dentro 1 hora de creación

Factura intervenida (APROBADA):
  - Cajero puede:
    - Cobrar normalmente
    - Editar items (si aún no pagada)
    - Anular siempre (¿Por qué intervenir si se anula?)
  
  - Cajero NO puede:
    - Cambiar moneda (congelado)
    - Cambiar payment method (congelado)
    - Cambiar IVA (congelado)
    
Factura intervenida (EN PROGRESO):
  - Status: "Intervention In Progress"
  - Cajero ve: "Esperando resolución..."
  - Restricción: No puede generar pago
  - Botón "Notificar supervisor"

Factura intervenida (RECHAZADA):
  - Status: "Intervention Rejected"
  - Cajero ve detalles de rechazo
  - NO puede procesar
  - Botón "Contactar supervisor"
```

---

# PARTE 12: FRONTEND REACT

## 12.1 CAMBIOS SALESPAGE.JSX

```
Estado local nuevo:
  [intervention, setIntervention] = useState(null)
  [isInterventionVisible, setIsInterventionVisible] = useState(false)
  [interventionCountdown, setInterventionCountdown] = useState(null)

Efectos nuevos:
  useEffect(() => {
    // Cada 5s: buscar intervención activa para este documento
    if (document.sale_id) {
      fetchIntervention(document.sale_id)
      .then(intv => {
        setIntervention(intv)
        if (intv && intv.state === 'in_review') {
          // Inicia countdown
          startCountdown(intv.lock_expires_at)
        }
      })
    }
  }, [document.sale_id])

UI nueva:
  SI intervención activa:
    <InterventionOverlay
      intervention={intervention}
      document={document}
      role={user.role}
      onRequest={handleRequest}
    />
  
  Botones que aparecen:
    {user.role === 'ventas' && !intervention && (
      <Button onClick={handleRequestIntervention}>
        Solicitar Intervención
      </Button>
    )}
    
    {user.role === 'gerencia' && intervention && (
      <>
        <Button onClick={handleTakeControl}>
          Tomar Control
        </Button>
        <Button onClick={handleApprove} variant="success">
          Aprobar
        </Button>
        <Button onClick={handleReject} variant="danger">
          Rechazar
        </Button>
      </>
    )}

Readonly sections cuando intervención activa:
  <SaleForm
    readonly={intervention?.state === 'in_review'}
    lockedSections={intervention?.scope_fields || []}
    readonlyMessage="Documento bloqueado por intervención"
  />
```

---

## 12.2 CAMBIOS QUOTATIONSPAGE.JSX

Idéntico a SalesPage:
- Mismo UI de intervención
- Mismo comportamiento lock
- Mismo flujo aprobación

---

## 12.3 CAMBIOS SALEFORM.JSX

```
Props nuevas:
  - intervention (obj | null)
  - isReadonly (bool)
  - lockedSections (array)
  - readonlyMessage (string)

Comportamiento campos:

SI intervention && isReadonly:
  Todos inputs:
    disabled={true}
    className="opacity-50 cursor-not-allowed"
  
  Aparece overlay:
    <div className="absolute inset-0 bg-overlay">
      <p>{readonlyMessage}</p>
      <LockIndicator
        lockedBy={intervention.assignee_name}
        expiresAt={intervention.lock_expires_at}
      />
    </div>

SI intervention && scope=items:
  Items bloqueados:
    <CartItem
      locked={true}
      reason="Item locked by supervisor"
    />
  
  Otros campos editable

SI intervention && scope=commercial_terms:
  Sección comercial bloqueada:
    <CommercialTerms
      locked={true}
      lockedFields={[
        "discount",
        "iva_rate",
        "payment_method",
        "exchange_rate"
      ]}
    />
  
  Items editables (si scope permite)
```

---

## 12.4 NUEVO COMPONENTE: InterventionOverlay.jsx

```
Props:
  - intervention: InterventionCase
  - document: Sale | Quotation
  - role: string (ventas | gerencia)
  - onRequest: callback
  - onApprove: callback
  - onReject: callback

Display:
  ┌──────────────────────────────────────┐
  │  ⚠️  INTERVENCIÓN: Estado Actual     │
  ├──────────────────────────────────────┤
  │  Status: in_review (desde 45 min)   │
  │  Supervisor: Pedro (pedro@email)    │
  │  Motivo: Desc > límite              │
  │  Scope: Global                      │
  │  Lock expira en: 47h 15min          │
  ├──────────────────────────────────────┤
  │  CAMBIOS SOLICITADOS:               │
  │  □ Cantidad item 1: 2 → 3           │
  │  □ Descuento: 5% → 3%              │
  │  □ Total: $224 → $285              │
  ├──────────────────────────────────────┤
  │  [Mensajes de supervisor]           │
  │  "Revisar cantidad, OK?"            │
  ├──────────────────────────────────────┤
  │  [Aprobar] [Rechazar] [Contactar]   │
  └──────────────────────────────────────┘

Comportamiento (por rol):

VENDEDOR:
  - Solo lectura
  - Botón "Solicitar Intervención" (si NO existe)
  - Botón "Responder a Cambios Solicitados" (si modifications_requested)

SUPERVISOR:
  - Botón "Tomar Control" (si state=created)
  - Panel edición (si state=in_review)
  - Botón "Aprobar"
  - Botón "Rechazar"
  - Botón "Solicitar Cambios" (si no aprobada)

CAJA:
  - Solo lectura
  - Muestra información: quién intervino, cuándo, qué cambió
  - NO bloquea procesamiento
```

---

## 12.5 NUEVO COMPONENTE: LockIndicator.jsx

```
Props:
  - lockedBy: string (supervisor name)
  - expiresAt: date
  - scope: string

Display (sticky top):
  ┌─────────────────────────────────┐
  │ 🔒 DOCUMENTO BLOQUEADO         │
  │ Por: Pedro Supervisor           │
  │ Vence en: 47h 15min 32s         │
  │ Scope: Global                   │
  └─────────────────────────────────┘

Countdown:
  - Actualiza cada segundo
  - Si < 1h: color rojo, anima
  - Si < 15min: parpadea
  - Si expiró: "Lock expiró, documento liberado"

Componente intermitente si < 15 min restante
```

---

## 12.6 NUEVO COMPONENTE: SupervisorDashboard.jsx

```
Props:
  - user: User

Display:
  ┌──────────────────────────────────────┐
  │ INTERVENCIONES PENDIENTES           │
  ├──────────────────────────────────────┤
  │ [Filtro] state: [created, in_review]│
  │ [Filtro] document_type: [all]       │
  ├──────────────────────────────────────┤
  │ CREADAS (4)                         │
  │ ├─ Sale #INV-001 (hace 2h)         │
  │ │  Vendedor: Juan | Desc: 15%      │
  │ │  [Tomar Control]                 │
  │ ├─ Quote #QT-045 (hace 30min)      │
  │ │  Vendedor: Maria | Desc: 20%     │
  │ │  [Tomar Control]                 │
  │ └─ ...                             │
  │                                    │
  │ EN REVISIÓN (2)                    │
  │ ├─ Sale #INV-002 (yo, 1h 20min)  │
  │ │  Estado: modifications_requested │
  │ │  [Ver Detalles] [Resolver]       │
  │ └─ Sale #INV-003 (otro, 2h)       │
  │    Estado: in_review               │
  │    [Ver Detalles]                  │
  └──────────────────────────────────────┘

Columnas tabla:
  - Doc ID
  - Vendedor
  - Motivo
  - Hace X tiempo
  - Estado
  - Acciones
```

---

# PARTE 13: WEBSOCKET VS POLLING

## 13.1 ANÁLISIS

### OPCIÓN A: SEGUIR POLLING (RECOMENDADO FASE 1)

```
VENTAJAS:
✓ Funciona hoy en el código existente
✓ Sin cambios infraestructura
✓ Compatible con todas las redes
✓ Fácil de implementar
✓ Sin estado servidor (stateless)
✓ Escalable horizontalmente

DESVENTAJAS:
✗ Latencia 5-10s
✗ Tráfico innecesario
✗ Batería (móvil)
✗ Load DB increases

CONFIGURACIÓN:
- Poll interval = 5s para intervención
- Poll interval = 30s para notificaciones
- Backoff exponencial si fail
```

### OPCIÓN B: MIGRAR WEBSOCKET (FASE 3/4)

```
VENTAJAS:
✓ Real-time (< 500ms)
✓ Bajo overhead tráfico
✓ Mejor UX
✓ Escalable con mensaje queues

DESVENTAJAS:
✗ Cambio significativo infraestructura
✗ Estado servidor (stateful)
✗ Conexiones persistentes
✗ Firewall/NAT issues posibles
✗ Más complejidad

RIESGOS:
- Conexión pierde → user offline
- Servidor cae → todos desconectados
- Escalabilidad requiere Redis pub/sub

IMPLEMENTACIÓN:
- Socket.io (recomendado)
- Redis para broadcast
- Fallback a polling si WS falla
```

### OPCIÓN C: HYBRID (RECOMENDADO FASE 2)

```
ESTRATEGIA:
1. Polling principal (5s)
2. WS para real-time críticas
3. Fallback automático

CRÍTICAS → WS:
- intervention state changed
- lock released
- timer < 5min

NO CRÍTICAS → Polling:
- notification list
- audit events
- countdown updates
```

---

## 13.2 DECISIÓN ARQUITECTÓNICA

```
RECOMENDACIÓN TIMELINE:

FASE 1 (Mes 1): Polling solamente
└─ Implementar intervention_cases + polling
└─ Alcance MVP
└─ Validar flujo con supervisores

FASE 2 (Mes 2): Hybrid
└─ Agregar WS para eventos críticos
└─ Mantener polling como fallback
└─ Monitorear latencia

FASE 3 (Mes 3): Full WS (opcional)
└─ Si usuarios reportan latencia
└─ Reemplazar polling por WS
└─ Mantener fallback siempre

PRIORIDAD:
1. Polling MVP stable
2. Test con usuarios reales
3. Entonces decidir WS
```

---

# PARTE 14: MIGRACIÓN SEGURA

## 14.1 FASE 1: BACKEND PARALELO (Semana 1-2)

```
Objetivo:
  Modelo + servicios + endpoints nuevos
  SIN romper flujo actual
  Sin activar en producción

Tareas:
  ✓ Crear intervention_models.py
  ✓ Crear lock_models.py
  ✓ Crear intervention_service.py
  ✓ Crear intervention_routes.py
  ✓ Crear migration script (add fields a Sale/Quotation)
  ✓ Crear tests unitarios
  ✓ Crear tests integración
  ✓ Código review + QA

Estado actual:
  - sale_requests sigue funcionando
  - approvals sigue funcionando
  - manager_authorizations sigue funcionando
  - NEW: intervention endpoints existen pero NO usados

Feature flag:
  FEATURE_INTERVENTIONS_ENABLED = False
  (Todos endpoints devuelven 503 si disabled)
```

---

## 14.2 FASE 2: BRIDGE (Semana 3)

```
Objetivo:
  Redirigir flujos legacy a intervention
  SIN cambiar frontend
  Ambos sistemas coexisten

Cambios backend:

1. POST /api/sales
   SI descuento > límite y FEATURE_INTERVENTIONS_ENABLED:
     → Crear intervention_case
     → Retornar intervention_id + intervention_required=true
   ELSE:
     → Sale request (legacy)

2. POST /api/sales/{id}/requests/edit
   SI FEATURE_INTERVENTIONS_ENABLED:
     → Crear intervention_case
     → Retornar como antes (compatibility)
   ELSE:
     → sale_requests (legacy)

3. Backend checks:
   - sale_requests sigue procesándose
   - intervention_cases paralelo
   - Auditoría ambos

Feature flag: FEATURE_INTERVENTIONS_ENABLED = True (test env)
```

---

## 14.3 FASE 3: FRONTEND OPTIONAL (Semana 4-5)

```
Objetivo:
  Frontend opcional muestra UI intervención
  SIN romper SaleForm actual

Cambios frontend:

1. SalesPage.jsx
   - Carga sale normal
   - Fetch intervention (si existe)
   - SI existe: mostrar InterventionOverlay
   - SaleForm sigue igual (puede ser readonly o no)

2. Componentes nuevos (desactivados):
   - InterventionOverlay
   - SupervisorDashboard (accesible pero sin notificaciones)

Feature flag: FRONTEND_INTERVENTIONS_ENABLED = True/False

Rol supervisor:
  - Puede acceder SupervisorDashboard
  - Puede tomar control
  - Puede editar documento bloqueado
  - Sale form reconoce intervention_locked

Rol vendedor:
  - Ve SaleForm normal
  - Si intervención activa: readonly + overlay
  - Puede ver motivo + supervisor
  - Puede solicitar cambios (si scope permite)

Rol caja:
  - Ve factura normal
  - Identifica si intervenida (badge)
  - NO tiene restricciones
```

---

## 14.4 FASE 4: DESCONEXIÓN LEGACY (Semana 6)

```
Objetivo:
  Remover sale_requests cuando intervention estable

Condiciones:
  ✓ Fase 3 estable 1 semana
  ✓ Sin bugs reportados
  ✓ Supervisores entrenados
  ✓ SLA met (aprobación < 4h)

Tareas deprecation:

1. Auditoría datos:
   - Exportar todo sale_requests activo → intervención
   - Validar migración 100%
   - Backup sale_requests colección

2. Código cleanup:
   - Remover endpoints sale_requests
   - Remover service sale_requests
   - Remover models sale_requests (mantener reference solo)
   - Remover frontend references

3. Notificaciones:
   - Usar SOLO intervention_events
   - Remover approval_events
   - Remover manager_auth_events

4. Test:
   - Todos tests pasar
   - Caja puede procesar
   - Auditoría funciona

Rollback:
  SI problema: FEATURE_INTERVENTIONS_ENABLED = False
  Vuelve a sale_requests
  Intervención cases se archivan
```

---

## 14.5 TIMELINE VISUAL

```
SEMANA 1-2: FASE 1 (Backend Parallel)
  ├─ Models + Service
  ├─ Endpoints
  ├─ Tests
  ├─ Code review
  └─ QA sign-off
     └─ FEATURE_INTERVENTIONS_ENABLED = False

SEMANA 3: FASE 2 (Bridge)
  ├─ Condicionales POST /sales
  ├─ Condicionales POST /requests/edit
  ├─ Tests integración
  ├─ Staging validation
  └─ QA sign-off
     └─ FEATURE_INTERVENTIONS_ENABLED = True (TEST)

SEMANA 4-5: FASE 3 (Frontend Optional)
  ├─ Componentes nuevos
  ├─ SalesPage cambios
  ├─ SupervisorDashboard
  ├─ Tests frontend
  ├─ User acceptance testing
  └─ QA sign-off
     └─ FEATURE_INTERVENTIONS_ENABLED = True (PROD)

SEMANA 6: FASE 4 (Legacy Removal)
  ├─ Data migration
  ├─ Code cleanup
  ├─ Final tests
  ├─ Production validation
  └─ Decommission sale_requests
     └─ FEATURE_INTERVENTIONS_ENABLED = always True

TIMELINE TOTAL: 6 semanas (mínimo)
```

---

#