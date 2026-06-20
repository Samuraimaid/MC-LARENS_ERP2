# Reporte Técnico: Análisis Completo del Flujo de Aprobaciones de Ventas

**Fecha de Análisis**: 2025-01-15  
**Archivos Analizados**:
- `backend/services/approval_service.py` (completo)
- `backend/models/approval_request.py` (modelo)
- `backend/server.py` (endpoints y lógica relacionada)

**Tipo de Análisis**: Auditoría - Flujo Completo de Aprobaciones

---

## 1. Estado General del Sistema de Aprobaciones

### 📊 Resumen Ejecutivo

**Hallazgo Crítico**: Existen **DOS SISTEMAS PARALELOS DE APROBACIÓN** completamente desacoplados:

1. **Sistema A**: `approval_service.py` + `ApprovalRequestModel` (Para DESCUENTO_TARJETA, ANULACION, DEVOLUCION)
2. **Sistema B**: `sale_requests` (Para EDICIÓN y ANULACIÓN de ventas)

Además existe:

3. **Sistema C**: `approvals` (Para edición/eliminación de VEHÍCULOS y CLIENTES)

**Estado**: 🔴 **FRAGMENTADO - MÚLTIPLES IMPLEMENTACIONES NO INTEGRADAS**

---

## 2. Sistema A: approval_service.py (Incompleto)

### 2.1 Modelo: ApprovalRequestModel

**Ubicación**: `backend/models/approval_request.py`

```python
class ApprovalRequestModel(BaseModel):
    id: Optional[str] = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    sale_id: str
    cajero_id: str
    tipo: Literal["DESCUENTO_TARJETA", "ANULACION", "DEVOLUCION"]
    monto_afectado: float
    justificacion: str
    status: Literal["pending", "approved", "rejected"] = "pending"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    token_autorizacion: Optional[str] = None
```

**Campos Soportados**:
- ✅ `id` - Identificador MongoDB ObjectId
- ✅ `sale_id` - Referencia a venta
- ✅ `cajero_id` - Quién solicita
- ✅ `tipo` - Tipo de solicitud (3 opciones)
- ✅ `monto_afectado` - Monto impactado
- ✅ `justificacion` - Razón de solicitud
- ✅ `status` - pending|approved|rejected
- ✅ `resolved_at` - Timestamp de resolución
- ✅ `resolved_by` - ID del aprobador
- ✅ `token_autorizacion` - Token único

**Colección MongoDB**: `approval_requests`

---

### 2.2 Funciones en approval_service.py

#### 2.2.1 Crear Solicitud de Aprobación

```python
def create_approval_request(data) -> ApprovalRequestModel:
    collection = get_collection(COLLECTION)
    approval = ApprovalRequestModel(**data.dict())
    collection.insert_one(approval.model_dump(by_alias=True))
    return approval
```

**Estado**: 🟢 **FUNCIONAL**

**Qué hace**:
- Instancia `ApprovalRequestModel` desde datos
- Inserta en colección `approval_requests`
- Retorna el objeto creado

**Validaciones**: ✅ Pydantic valida tipos

---

#### 2.2.2 Obtener Solicitud por ID

```python
def get_approval_request_by_id(approval_id: str) -> ApprovalRequestModel:
    collection = get_collection(COLLECTION)
    doc = collection.find_one({"_id": approval_id})
    if not doc:
        raise HTTPException(404, "Solicitud no encontrada")
    return ApprovalRequestModel(**doc)
```

**Estado**: 🟢 **FUNCIONAL**

**Qué hace**:
- Busca por `_id` en collection `approval_requests`
- Retorna HTTPException 404 si no existe
- Convierte a modelo Pydantic

---

#### 2.2.3 Resolver (Aprobar/Rechazar) Solicitud

```python
def resolve_approval_request(approval_id: str, data: Any, user: Any):
    collection = get_collection(COLLECTION)
    approval = get_approval_request_by_id(approval_id)
    
    if approval.status != "pending":
        raise HTTPException(400, "Ya resuelta")
    
    if not verify_manager_pin(user.id, data.pin):
        raise HTTPException(403, "PIN incorrecto o no enviado")
    
    update = {
        "status": data.status,
        "resolved_at": datetime.utcnow(),
        "resolved_by": user.id
    }
    
    token = None
    if data.status == "approved":
        update_venta_status(approval.sale_id, "APPROVED")  # ⚠️ STUB
        token = generate_token_autorizacion(approval.sale_id)
        update["token_autorizacion"] = token
    
    collection.update_one({"_id": approval_id}, {"$set": update})
    return {"status": data.status, "token_autorizacion": token}
```

**Estado**: 🔴 **ROTO - CRÍTICO**

**Problemas Identificados**:

1. **`update_venta_status()` es un stub** (línea 16 de venta_service.py):
   ```python
   def update_venta_status(sale_id: str, status: str):
       pass  # ❌ NO HACE NADA
   ```
   
2. **La venta NUNCA se actualiza**:
   - Se aproeba la solicitud ✅
   - Se genera token ✅
   - Pero la venta NO cambia de estado ❌

3. **Sin endpoint para esta función**:
   - `resolve_approval_request()` está definida pero NO ESTÁ EXPUESTA como endpoint HTTP
   - No hay `@api_router.post()` asociado
   - No se puede llamar desde frontend

4. **Flujo incompleto**:
   - Solicitud → ¿Aprobación? → ¿Notificación? → ¿Auditoría? → ❌ FALTA TODO

---

### 2.3 Conclusión Sistema A

| Aspecto | Estado | Evidencia |
|--------|--------|-----------|
| Modelo definido | ✅ | ApprovalRequestModel completo |
| Crear solicitud | ✅ | create_approval_request() funcional |
| Obtener solicitud | ✅ | get_approval_request_by_id() funcional |
| Resolver solicitud | ❌ | resolve_approval_request() expuesta pero rota |
| Actualizar venta | ❌ | update_venta_status() es stub |
| Endpoint HTTP | ❌ | No existe endpoint para resolveapproval |
| Notificación | ❌ | No implementada |
| Auditoría | ❌ | No implementada |

**Conclusión**: 🔴 **SISTEMA A = INCOMPLETO Y NO EXPUESTO**

---

## 3. Sistema B: sale_requests (Implementado y Funcional)

### 3.1 Tipo de Solicitudes Soportadas

```python
# request_type puede ser:
- "edit"    # Edición de factura
- "cancel"  # Anulación de factura
```

### 3.2 Flujo de Edición: Solicitud → Aprobación → Actualización

#### Paso 1: Solicitar Edición

**Endpoint**: `POST /sales/{sale_id}/requests/edit`

```python
@api_router.post("/sales/{sale_id}/requests/edit")
async def request_sale_edit(sale_id: str, payload: SaleRequestPayload, request: Request):
    # Roles: ventas, supervisor, cajero, gerencia, recursos_humanos
    
    # Valida existencia de venta
    sale = await db.sales.find_one({"sale_id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(404, "Sale not found")
    
    # Valida acceso del usuario a la venta
    if not can_access_sale_for_user(user, sale):
        raise HTTPException(403, "No autorizado")
    
    # Valida razón mínima
    reason = str(payload.reason or "").strip()
    if len(reason) < 10:
        raise HTTPException(400, "La razón debe tener al menos 10 caracteres")
    
    # Crea documento de solicitud
    request_id = f"sreq_{uuid.uuid4().hex[:12]}"
    request_doc = {
        "request_id": request_id,
        "sale_id": sale_id,
        "invoice_number": sale.get("invoice_number"),
        "request_type": "edit",
        "reason": reason,
        "status": "pending",
        "branch_id": sale.get("branch_id"),
        "requested_by": user.user_id,
        "requested_by_name": user.name,
        "created_at": now_iso,
        "resolved_at": None,
        "resolved_by": None,
    }
    
    # Persiste en DB
    await db.sale_requests.insert_one(request_doc)
    
    # Notifica a supervisores de la sucursal
    await _notify_branch_reviewers(
        branch_id=str(sale.get("branch_id") or ""),
        message=f"Solicitud de edición de factura {sale.get('invoice_number')} ({user.name})",
        metadata={
            "type": "sale_edit_request",
            "request_id": request_id,
            "sale_id": sale_id,
            "invoice_number": sale.get("invoice_number"),
        },
        dedupe_seed=f"sale_edit_request:{request_id}",
    )
    
    return {"message": "Solicitud de edición enviada", "request_id": request_id}
```

**Estado**: ✅ **FUNCIONAL**

**Validaciones**:
- ✅ Usuario autenticado
- ✅ Venta existe
- ✅ Usuario tiene acceso a venta
- ✅ Razón >= 10 caracteres

**Datos Almacenados**:
- ✅ request_id único
- ✅ Referencia a sale_id e invoice_number
- ✅ Usuario solicitante
- ✅ Razón
- ✅ Timestamp

**Notificación**:
- ✅ Se notifica a supervisores de sucursal

---

#### Paso 2: Aprobar Edición

**Endpoint**: `POST /sales/requests/{request_id}/approve-edit`

```python
@api_router.post("/sales/requests/{request_id}/approve-edit")
async def approve_sale_edit_request(request_id: str, request: Request):
    # Roles: gerencia, recursos_humanos
    approver = await require_roles(request, ["gerencia", "recursos_humanos"])
    
    # Obtiene solicitud
    req = await db.sale_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(404, "Solicitud no encontrada")
    
    # Valida que sea de tipo "edit"
    if str(req.get("request_type") or "") != "edit":
        raise HTTPException(400, "Solicitud no corresponde a edición")
    
    # Valida estado
    req_status = str(req.get("status") or "")
    if req_status != "pending":
        if req_status == "approved":
            # Idempotencia: si ya está aprobada, retorna OK
            await _close_sale_request_notifications(request_id, "edit")
            return {"message": "Solicitud ya estaba aprobada", "request_id": request_id}
        raise HTTPException(400, "Solicitud ya procesada")
    
    now_iso = _utc_now().isoformat()
    
    # Actualiza solicitud → APPROVED
    await db.sale_requests.update_one(
        {"request_id": request_id},
        {
            "$set": {
                "status": "approved",
                "resolved_at": now_iso,
                "resolved_by": approver.user_id,
                "resolved_by_name": approver.name,
            }
        },
    )
    
    await _close_sale_request_notifications(request_id, "edit")
    
    # 🔑 ACTUALIZA VENTA
    sale_id = str(req.get("sale_id") or "")
    await db.sales.update_one(
        {"sale_id": sale_id},
        {
            "$set": {
                "edit_request_status": "approved",
                "edit_request_id": request_id,
                "edit_approved_at": now_iso,
                "updated_at": now_iso,
            }
        },
    )
    
    # Notifica al solicitante
    requester_id = str(req.get("requested_by") or "")
    if requester_id:
        await create_notification_entry(
            message=f"Tu solicitud de edición de factura {req.get('invoice_number')} fue aprobada",
            recipient_id=requester_id,
            metadata={
                "type": "sale_edit_request_approved",
                "request_id": request_id,
                "sale_id": sale_id,
            },
            dedupe_key=f"sale_edit_request_approved:{request_id}:{requester_id}",
        )
    
    return {"message": "Solicitud de edición aprobada", "request_id": request_id}
```

**Estado**: ✅ **FUNCIONAL**

**Cambios en venta**:
```javascript
{
    "edit_request_status": "approved",
    "edit_request_id": request_id,
    "edit_approved_at": now_iso,
    "updated_at": now_iso,
}
```

**Flujo Completo**:
- ✅ Obtiene solicitud
- ✅ Valida tipo y estado
- ✅ Marca solicitud como aprobada
- ✅ Actualiza venta con refs de solicitud
- ✅ Notifica solicitante
- ✅ Cierra notificaciones pendientes

---

### 3.3 Flujo de Cancelación: Solicitud → Aprobación → Actualización

#### Paso 1: Solicitar Cancelación

**Endpoint**: `POST /sales/{sale_id}/requests/cancel`

```python
@api_router.post("/sales/{sale_id}/requests/cancel")
async def request_sale_cancel(sale_id: str, payload: SaleRequestPayload, request: Request):
    # Roles: ventas, supervisor, cajero, gerencia, recursos_humanos
    
    user = await require_roles(request, ["ventas", "supervisor", "cajero", "gerencia", "recursos_humanos"])
    
    # Valida existencia
    sale = await db.sales.find_one({"sale_id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(404, "Sale not found")
    
    # Valida acceso
    if not can_access_sale_for_user(user, sale):
        raise HTTPException(403, "No autorizado para solicitar anulación de esta factura")
    
    # Valida razón
    reason = str(payload.reason or "").strip()
    if len(reason) < 10:
        raise HTTPException(400, "La razón debe tener al menos 10 caracteres")
    
    # Crea solicitud
    request_id = f"sreq_{uuid.uuid4().hex[:12]}"
    now_iso = _utc_now().isoformat()
    request_doc = {
        "request_id": request_id,
        "sale_id": sale_id,
        "invoice_number": sale.get("invoice_number"),
        "request_type": "cancel",
        "reason": reason,
        "status": "pending",
        "branch_id": sale.get("branch_id"),
        "requested_by": user.user_id,
        "requested_by_name": user.name,
        "created_at": now_iso,
        "resolved_at": None,
        "resolved_by": None,
    }
    
    await db.sale_requests.insert_one(request_doc)
    
    # Notifica supervisores
    await _notify_branch_reviewers(
        branch_id=str(sale.get("branch_id") or ""),
        message=f"Solicitud de anulación de factura {sale.get('invoice_number')} ({user.name})",
        metadata={
            "type": "sale_cancel_request",
            "request_id": request_id,
            "sale_id": sale_id,
            "invoice_number": sale.get("invoice_number"),
        },
        dedupe_seed=f"sale_cancel_request:{request_id}",
    )
    
    return {"message": "Solicitud de anulación enviada", "request_id": request_id}
```

**Estado**: ✅ **FUNCIONAL**

---

#### Paso 2: Aprobar Cancelación

**Endpoint**: `POST /sales/requests/{request_id}/approve-cancel`

```python
@api_router.post("/sales/requests/{request_id}/approve-cancel")
async def approve_sale_cancel_request(request_id: str, request: Request):
    # Roles: gerencia, recursos_humanos
    approver = await require_roles(request, ["gerencia", "recursos_humanos"])
    
    # Obtiene solicitud
    req = await db.sale_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(404, "Solicitud no encontrada")
    
    # Valida tipo
    if str(req.get("request_type") or "") != "cancel":
        raise HTTPException(400, "Solicitud no corresponde a anulación")
    
    # Valida estado
    req_status = str(req.get("status") or "")
    if req_status != "pending":
        if req_status == "approved":
            await _close_sale_request_notifications(request_id, "cancel")
            return {"message": "Solicitud ya estaba aprobada", "request_id": request_id}
        raise HTTPException(400, "Solicitud ya procesada")
    
    # Obtiene venta
    sale_id = str(req.get("sale_id") or "")
    sale = await db.sales.find_one({"sale_id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(404, "Sale not found")
    
    # Valida que no esté ya cancelada
    if str(sale.get("invoice_state") or "").lower() == "cancelled":
        raise HTTPException(400, "La factura ya está anulada")
    
    # Valida que no esté pagada (restriction)
    if str(sale.get("payment_status") or "").lower() == "paid":
        raise HTTPException(400, "No se puede anular una factura ya pagada")
    
    now_iso = _utc_now().isoformat()
    reason = str(req.get("reason") or "Solicitud de anulación")
    
    # 🔑 ACTUALIZA VENTA
    await db.sales.update_one(
        {"sale_id": sale_id},
        {
            "$set": {
                "invoice_state": "cancelled",
                "cancel_reason": "Solicitud aprobada",
                "cancel_justification_internal": reason,
                "cancel_authorized_by": approver.user_id,
                "cancelled_by": approver.user_id,
                "cancelled_by_name": approver.name,
                "cancelled_at": now_iso,
                "updated_at": now_iso,
            }
        },
    )
    
    # Actualiza solicitud
    await db.sale_requests.update_one(
        {"request_id": request_id},
        {
            "$set": {
                "status": "approved",
                "resolved_at": now_iso,
                "resolved_by": approver.user_id,
                "resolved_by_name": approver.name,
            }
        },
    )
    
    await _close_sale_request_notifications(request_id, "cancel")
    
    # Notifica solicitante
    requester_id = str(req.get("requested_by") or "")
    if requester_id:
        await create_notification_entry(
            message=f"Tu solicitud de anulación de factura {req.get('invoice_number')} fue aprobada",
            recipient_id=requester_id,
            metadata={
                "type": "sale_cancel_request_approved",
                "request_id": request_id,
                "sale_id": sale_id,
            },
            dedupe_key=f"sale_cancel_request_approved:{request_id}:{requester_id}",
        )
    
    return {"message": "Solicitud de anulación aprobada", "request_id": request_id}
```

**Estado**: ✅ **FUNCIONAL**

**Cambios en venta**:
```javascript
{
    "invoice_state": "cancelled",           // Marca como cancelada
    "cancel_reason": "Solicitud aprobada",
    "cancel_justification_internal": reason,
    "cancel_authorized_by": approver.user_id,
    "cancelled_by": approver.user_id,
    "cancelled_by_name": approver.name,
    "cancelled_at": now_iso,
    "updated_at": now_iso,
}
```

**Validaciones Críticas**:
- ✅ No permite cancelar facturas ya pagadas
- ✅ No permite cancelar facturas ya canceladas
- ✅ Requiere razón >= 10 caracteres

---

### 3.4 Conclusión Sistema B

| Aspecto | Estado | Evidencia |
|--------|--------|-----------|
| Solicitar edición | ✅ | POST /sales/{id}/requests/edit |
| Aprobar edición | ✅ | POST /sales/requests/{id}/approve-edit |
| Actualizar venta (edit) | ✅ | Campos: edit_request_status, edit_request_id, etc. |
| Solicitar anulación | ✅ | POST /sales/{id}/requests/cancel |
| Aprobar anulación | ✅ | POST /sales/requests/{id}/approve-cancel |
| Actualizar venta (cancel) | ✅ | Campos: invoice_state, cancel_reason, cancelled_at, etc. |
| Notificación | ✅ | create_notification_entry() |
| Auditoría | ✅ | Timestamp y user_id registrados |
| Restricciones | ✅ | Valida estado de pago, no permite duplicados |
| Idempotencia | ✅ | Maneja caso de re-approval |

**Conclusión**: 🟢 **SISTEMA B = COMPLETAMENTE IMPLEMENTADO Y FUNCIONAL**

---

## 4. Sistema C: approvals (Para Vehículos y Clientes)

### 4.1 Tipos de Aprobación

```python
approval_type ∈ {
    "delete_vehicle",
    "edit_vehicle",
    "edit_customer",
    "delete_customer",
}
```

### 4.2 Endpoints

| Endpoint | Método | Propósito | Estado |
|----------|--------|-----------|--------|
| `/api/approvals` | POST | Crear solicitud | ✅ Funcional |
| `/api/approvals` | GET | Listar solicitudes | ✅ Funcional |
| `/api/approvals/{approval_id}/approve` | PUT | Aprobar | ✅ Funcional |
| `/api/approvals/{approval_id}/reject` | PUT | Rechazar | ✅ Funcional |
| `/api/approvals/{approval_id}` | DELETE | Eliminar | ✅ Funcional |

### 4.3 Conclusión Sistema C

**Estado**: 🟢 **FUNCIONAL**

Pero **NO está relacionado con VENTAS**, solo con vehículos y clientes.

---

## 5. Ubicación de update_venta_status()

### 5.1 ¿Dónde se define?

**Archivo**: `backend/services/venta_service.py`

```python
def update_venta_status(sale_id: str, status: str):
    # Actualiza el estado de la venta en la base de datos
    pass  # ❌ STUB - NO IMPLEMENTADO
```

**Línea**: Aprox. línea 3-4

---

### 5.2 ¿Dónde se llama?

**Archivo**: `backend/services/approval_service.py`

**Línea**: 16 (en función `resolve_approval_request`)

```python
if data.status == "approved":
    update_venta_status(approval.sale_id, "APPROVED")  # ⚠️ INTENTA LLAMAR
    token = generate_token_autorizacion(approval.sale_id)
    update["token_autorizacion"] = token
```

**Problema**: La función existe pero no hace nada. El import es:

```python
from backend.services.venta_service import update_venta_status, generate_token_autorizacion
```

---

### 5.3 ¿Existe otra implementación funcional?

**Respuesta**: SÍ, pero con DIFERENTE NOMBRE.

En `server.py`, NO se usa `update_venta_status()`. En su lugar:

#### Para Edición:
```python
await db.sales.update_one(
    {"sale_id": sale_id},
    {
        "$set": {
            "edit_request_status": "approved",
            "edit_request_id": request_id,
            "edit_approved_at": now_iso,
            "updated_at": now_iso,
        }
    },
)
```

#### Para Cancelación:
```python
await db.sales.update_one(
    {"sale_id": sale_id},
    {
        "$set": {
            "invoice_state": "cancelled",
            "cancel_reason": "Solicitud aprobada",
            "cancel_justification_internal": reason,
            "cancel_authorized_by": approver.user_id,
            "cancelled_by": approver.user_id,
            "cancelled_by_name": approver.name,
            "cancelled_at": now_iso,
            "updated_at": now_iso,
        }
    },
)
```

**Conclusión**: Cada endpoint hace su propia actualización. No hay función centralizada.

---

## 6. ¿Qué Debería Hacer update_venta_status()?

### 6.1 Propósito Original (Según Contexto)

Basado en el modelo `ApprovalRequestModel` que define `tipo` como:

```python
tipo: Literal["DESCUENTO_TARJETA", "ANULACION", "DEVOLUCION"]
```

La función debería actualizar el estado de la venta según el tipo de aprobación:

### 6.2 Implementación Esperada

```python
async def update_venta_status(sale_id: str, status: str, approval_type: str = None):
    """
    Actualiza el estado de venta según aprobación.
    
    Args:
        sale_id: ID de la venta
        status: "APPROVED" o "REJECTED"
        approval_type: "DESCUENTO_TARJETA" | "ANULACION" | "DEVOLUCION"
    """
    
    if status == "APPROVED":
        if approval_type == "DESCUENTO_TARJETA":
            # Marca descuento como autorizado
            await db.sales.update_one(
                {"sale_id": sale_id},
                {
                    "$set": {
                        "discount_authorized": True,
                        "discount_authorized_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )
        
        elif approval_type == "ANULACION":
            # Marca venta como cancelada
            await db.sales.update_one(
                {"sale_id": sale_id},
                {
                    "$set": {
                        "invoice_state": "cancelled",
                        "cancelled_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )
        
        elif approval_type == "DEVOLUCION":
            # Marca devolución como autorizada
            await db.sales.update_one(
                {"sale_id": sale_id},
                {
                    "$set": {
                        "return_authorized": True,
                        "return_authorized_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )
    
    elif status == "REJECTED":
        # Similar para rechazos
        pass
```

---

## 7. Tabla Comparativa: Todos los Endpoints de Aprobación

| Acción | Endpoint | Método | Función | Sistema | Funciona | Parcial | Roto |
|--------|----------|--------|---------|---------|----------|---------|------|
| Solicitar descuento tarjeta | - | - | - | A | ❌ | - | ✅ |
| Aprobar descuento tarjeta | - | - | - | A | ❌ | - | ✅ |
| Solicitar anulación venta | `/sales/{id}/requests/cancel` | POST | request_sale_cancel | B | ✅ | - | - |
| Aprobar anulación venta | `/sales/requests/{id}/approve-cancel` | POST | approve_sale_cancel_request | B | ✅ | - | - |
| Solicitar edición venta | `/sales/{id}/requests/edit` | POST | request_sale_edit | B | ✅ | - | - |
| Aprobar edición venta | `/sales/requests/{id}/approve-edit` | POST | approve_sale_edit_request | B | ✅ | - | - |
| Solicitar devolución | - | - | - | A | ❌ | - | ✅ |
| Aprobar devolución venta | `/returns/{id}/approve` | PUT | approve_return | Returns | ✅ | - | - |
| Crear aprobación (vehículos/clientes) | `/api/approvals` | POST | create_approval | C | ✅ | - | - |
| Listar aprobaciones | `/api/approvals` | GET | list_approvals | C | ✅ | - | - |
| Aprobar vehículo/cliente | `/api/approvals/{id}/approve` | PUT | approve_request | C | ✅ | - | - |
| Rechazar vehículo/cliente | `/api/approvals/{id}/reject` | PUT | reject_request | C | ✅ | - | - |

---

## 8. Qué Datos Deberían Modificarse en sales

### 8.1 Cuando se Aprueba Edición de Venta

**Campos Modificados**:
```javascript
{
    "edit_request_status": "approved",      // Estado de la solicitud
    "edit_request_id": request_id,          // Ref a solicitud
    "edit_approved_at": datetime,           // Timestamp
    "updated_at": datetime,                 // Actualización general
}
```

**Lo que FALTA**:
- ❌ No se especifica QUÉ CAMPOS se van a editar
- ❌ No hay validación de cambios permitidos
- ❌ No hay historial de cambios (antes/después)

---

### 8.2 Cuando se Aprueba Cancelación de Venta

**Campos Modificados**:
```javascript
{
    "invoice_state": "cancelled",           // Estado de factura
    "cancel_reason": "Solicitud aprobada",  // Razón
    "cancel_justification_internal": reason,// Justificación
    "cancel_authorized_by": user_id,        // Quién autorizó
    "cancelled_by": user_id,                // Quién ejecutó
    "cancelled_by_name": name,              // Nombre
    "cancelled_at": datetime,               // Timestamp
    "updated_at": datetime,                 // Actualización general
}
```

**Lo que FALTA**:
- ❌ No se devuelve inventario
- ❌ No se reversa crédito del cliente
- ❌ No se reversa pago (si fue pagado)

---

### 8.3 Cuando se Aprobaría Descuento Tarjeta (NO IMPLEMENTADO)

**Campos que DEBERÍA modificar**:
```javascript
{
    "discount_authorized": true,            // Flag de autorización
    "discount_authorized_by": user_id,      // Quién autorizó
    "discount_authorized_at": datetime,     // Timestamp
    "discount_authorization_code": token,   // Token único
}
```

**Actualmente**: No se modifica nada (stub)

---

## 9. Búsqueda Completa de Palabras Clave

### 9.1 Ocurrencias de "update_venta_status"

| Archivo | Línea | Contexto |
|---------|-------|----------|
| approval_service.py | 16 | Llama cuando se aprueba (pero es stub) |
| venta_service.py | 3-4 | Definida como stub (pass) |

**Total**: 2 ocurrencias (1 definición + 1 llamada)

**Estado**: ❌ FUNCIÓN NO IMPLEMENTADA

---

### 9.2 Ocurrencias de "approval"

**En server.py**: ~50 líneas

- 5 líneas: configuración de roles
- 5 líneas: mappeo de permisos
- 35 líneas: endpoints de approvals (vehículos/clientes)

**En approval_service.py**: 27 líneas (completo)

**En approval_request.py**: 24 líneas (modelo)

**Estado**: Sistema A fragmentado, Sistema C funcional

---

### 9.3 Ocurrencias de "approve"

**En server.py**: ~200 líneas

- Approve return: 1 endpoint
- Approve edit request: 1 endpoint
- Approve cancel request: 1 endpoint
- Approve vehicle/customer: 1 endpoint

**Total**: 4 endpoints de aprobación funcionales

---

### 9.4 Ocurrencias de "reject"

**En server.py**: ~100 líneas

- Reject return: 1 endpoint
- Reject vehículo/cliente: 1 endpoint

**Total**: 2 endpoints de rechazo

---

### 9.5 Ocurrencias de "cancel_request" / "edit_request"

**En server.py**: ~150 líneas

- request_sale_edit: 1 endpoint
- approve_sale_edit_request: 1 endpoint
- request_sale_cancel: 1 endpoint
- approve_sale_cancel_request: 1 endpoint

**Total**: 4 endpoints de solicitudes de venta

---

## 10. Flujo Completo: Solicitud → Aprobación → Actualización → Notificación → Auditoría

### 10.1 Flujo de Cancelación (FUNCIONANDO)

```
┌──────────────────────────────────────────────────────────────────┐
│ USUARIO SOLICITA CANCELACIÓN                                      │
├──────────────────────────────────────────────────────────────────┤
│ POST /sales/{sale_id}/requests/cancel                             │
│ Input: reason (>= 10 caracteres)                                  │
│                                                                    │
│ 1. Valida: usuario, venta, acceso, razón                          │
│ 2. Crea solicitud en sale_requests (status=pending)               │
│ 3. Genera request_id (sreq_XXXXX)                                 │
│ 4. Notifica supervisores vía _notify_branch_reviewers()           │
│ 5. Retorna request_id                                             │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ GERENCIA/RECURSOS_HUMANOS APRUEBA                                 │
├──────────────────────────────────────────────────────────────────┤
│ POST /sales/requests/{request_id}/approve-cancel                  │
│ Input: (none, auth by role)                                       │
│                                                                    │
│ 1. Obtiene solicitud (status debe ser pending)                    │
│ 2. Valida: venta no pagada, no cancelada                          │
│ 3. ACTUALIZA VENTA:                                               │
│    - invoice_state = "cancelled"                                  │
│    - cancel_reason = "Solicitud aprobada"                         │
│    - cancelled_by = approver.user_id                              │
│    - cancelled_at = now                                           │
│    - updated_at = now                                             │
│ 4. Actualiza solicitud (status=approved, resolved_at, resolved_by)│
│ 5. Cierra notificaciones pendientes                               │
│ 6. NOTIFICA solicitante vía create_notification_entry()           │
│ 7. Retorna success                                                │
└──────────────────────────────────────────────────────────────────┘

RESULTADO: ✅ Flujo completo
- Solicitud ✅
- Aprobación ✅
- Actualización venta ✅
- Notificación ✅
- Auditoría ⚠️ (solo timestamps y user_id, sin log audit formal)
```

---

### 10.2 Flujo de Edición (FUNCIONANDO)

```
Idéntico a cancelación pero:
- request_type = "edit"
- Actualiza: edit_request_status, edit_request_id, edit_approved_at
- NO valida restricciones de pago
```

---

### 10.3 Flujo de Descuento Tarjeta (ROTO)

```
┌──────────────────────────────────────────────────────────────────┐
│ ¿DÓNDE SE SOLICITA? ❌ NO EXISTE ENDPOINT                         │
├──────────────────────────────────────────────────────────────────┤
│ Se presume que debería ser:                                       │
│ POST /sales/{sale_id}/requests/discount-authorization             │
│ Input: tipo=DESCUENTO_TARJETA, monto_afectado, justificacion    │
│                                                                    │
│ Pero esto NO EXISTE en server.py                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ ¿DÓNDE SE APRUEBA? ❌ NO EXISTE ENDPOINT                          │
├──────────────────────────────────────────────────────────────────┤
│ Se presume que sería:                                             │
│ POST /approvals/{approval_id}/resolve                             │
│ Input: status (approved/rejected), pin                            │
│                                                                    │
│ resolve_approval_request() EXISTE pero:                           │
│ - No tiene @api_router decorator → NO EXPUESTA                    │
│ - Llama update_venta_status() que es STUB                         │
│ - No retorna token correctamente                                  │
└──────────────────────────────────────────────────────────────────┘

RESULTADO: ❌ Flujo NO IMPLEMENTADO
```

---

## 11. Matriz de Completitud por Tipo de Solicitud

| Tipo Solicitud | Solicitar | Aprobar | Rechazar | Actualizar Venta | Notificar | Auditar | Status |
|---|---|---|---|---|---|---|---|
| Edición venta | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | 🟡 |
| Cancelación venta | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | 🟡 |
| Descuento tarjeta | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🔴 |
| Anulación (Sistema A) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🔴 |
| Devolución | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | 🟢 |
| Edit vehículo | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | 🟢 |
| Delete vehículo | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | 🟢 |
| Edit cliente | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | 🟢 |
| Delete cliente | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | 🟢 |

**Leyenda**:
- ✅ Implementado correctamente
- ⚠️ Implementado pero incompleto
- ❌ No implementado

---

## 12. Problemas Críticos Identificados

### 12.1 CRÍTICO: update_venta_status() es un Stub

**Impacto**: 
- Sistema A (approval_service) no funciona
- Modelo ApprovalRequestModel no se puede usar
- Flujos de DESCUENTO_TARJETA, ANULACION, DEVOLUCION rompen en aprobación

**Evidencia**:
```python
# venta_service.py línea 3-4
def update_venta_status(sale_id: str, status: str):
    pass  # ❌ NO IMPLEMENTADO
```

---

### 12.2 CRÍTICO: Sistema A No Tiene Endpoints

**Impacto**:
- ApprovalRequestModel existe pero no se puede usar
- approval_service.py no está expuesto como API
- No hay endpoint para crear/resolver aprobaciones

**Evidencia**:
```python
# approval_service.py líneas 16-27
# resolve_approval_request() NO tiene @api_router decorator
def resolve_approval_request(approval_id: str, data: Any, user: Any):
    # ...
```

---

### 12.3 GRAVE: Dos Sistemas Paralelos Sin Integración

**Impacto**:
- Sistema A usa ApprovalRequestModel (venta_service, approval_requests collection)
- Sistema B usa sale_requests (directamente en server.py, sale_requests collection)
- Ambos hacen cosas diferentes
- Confusión de implementación

**Implicaciones**:
- El modelo ApprovalRequestModel con `tipo: DESCUENTO_TARJETA|ANULACION|DEVOLUCION` nunca se usa
- sale_requests solo soporta "edit" y "cancel"
- Devoluciones se manejan en colección aparte "returns"

---

### 12.4 GRAVE: Falta de Auditoría Formal

**Impacto**:
- No hay llamadas a `audit_service.log_audit_event()` en flujos de aprobación
- Solo se registran timestamps y user_id
- No hay trazabilidad de qué cambió en cada venta

**Comparación**:
```python
# En edición de vehículo (TIENE AUDITORÍA)
await audit_service.log_audit_event(
    action="edit_vehicle",
    actor_id=approver.user_id,
    actor_name=approver.name,
    entity="vehicle",
    entity_id=vehicle_id,
    metadata={"changes": changes, "approval_id": approval_id},
)

# En cancelación de venta (SIN AUDITORÍA)
# Solo se registra timestamp y user_id en la venta misma
```

---

### 12.5 GRAVE: Cancelación No Revierte Inventario Ni Crédito

**Impacto**:
- Al cancelar venta, NO se devuelve inventario
- Al cancelar venta de crédito, NO se reduce credit_balance
- Datos financieros quedan inconsistentes

**Código Actual**:
```python
# approve_sale_cancel_request() NO incluye:
# - await db.inventory.update_one() para incrementar stock
# - await db.customers.update_one() para decrementar credit_balance
```

---

## 13. Recomendaciones de Implementación

### Prioridad 1: CRÍTICO

1. **Implementar update_venta_status()**
   - Debe ser async
   - Debe soportar: DESCUENTO_TARJETA, ANULACION, DEVOLUCION
   - Debe actualizar sales con estado apropiado

2. **Exponer resolve_approval_request() como endpoint HTTP**
   - Agregar `@api_router.post("/approvals/{approval_id}/resolve")`
   - Requerir autenticación y PIN manager
   - Retornar token de autorización

3. **Centralizar lógica de aprobaciones**
   - Unificar Sistema A y Sistema B
   - O mantener separados pero bien documentados
   - Evitar duplicación de funcionalidad

---

### Prioridad 2: IMPORTANTE

1. **Agregar auditoría a flujos de aprobación**
   - Llamar `audit_service.log_audit_event()` en aprobar/rechazar
   - Registrar cambios específicos

2. **Implementar devolución de inventario en cancelación**
   - Cuando se cancela venta, incrementar stock
   - Registrar movimiento de inventario

3. **Implementar reversión de crédito en cancelación**
   - Cuando se cancela venta de crédito, decrementar credit_balance
   - Validar que no pase el límite

---

### Prioridad 3: IMPORTANTE

1. **Crear endpoints faltantes**
   - POST /sales/{id}/requests/discount-authorization
   - Validar descuentos no excedan límites

2. **Documentar cambios permitidos en edición**
   - Definir qué campos pueden editarse tras cancelación
   - Validar cambios permitidos

3. **Agregar rechazo de solicitudes**
   - Endpoint para rechazar edición
   - Endpoint para rechazar cancelación
   - Notificar solicitante

---

## 14. Conclusiones Finales

### Estado General

**Calificación**: 🟡 **PARCIALMENTE FUNCIONAL CON GAPS CRÍTICOS**

- ✅ **Funcional**: Edición y cancelación de ventas via sale_requests
- ✅ **Funcional**: Aprobaciones de vehículos y clientes
- ✅ **Funcional**: Devoluciones de ventas
- ❌ **No Funcional**: Sistema A (approval_service.py) - NO expuesto
- ❌ **No Funcional**: Descuentos tarjeta - NO implementado
- ❌ **No Funcional**: update_venta_status() - Stub

### Impacto en Usuario

**Lo que NO Funciona**:
1. Solicitar/aprobar descuento tarjeta
2. Usar modelo ApprovalRequestModel
3. Sistema de aprobaciones de tipo DESCUENTO_TARJETA|ANULACION|DEVOLUCION
4. Auditoría formal de aprobaciones

**Lo que SÍ Funciona**:
1. Editar venta (con aprobación)
2. Cancelar venta (con aprobación y restricciones)
3. Devolver venta (con aprobación)
4. Aprobar/rechazar cambios en vehículos y clientes

### Recomendación Inmediata

**Acción**: Implementar `update_venta_status()` y exponer `resolve_approval_request()` como endpoint HTTP.

**Esfuerzo**: 2-4 horas

**Impacto**: Habilitar flujo completo de aprobaciones de ventas

---

**Fin del Reporte Técnico**  
**Fecha**: 2025-01-15  
**Versión**: 1.0  
**Autor**: Análisis de Codebase - ERP MC-LARENS
