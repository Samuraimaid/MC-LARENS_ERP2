# Análisis Completo: Flujo de Cancelación de Ventas

**Fecha**: 2025-01-15  
**Objetivo**: Análisis detallado de crear venta vs cancelar venta - Identificar inconsistencias post-cancelación

---

## 1. Flujo create_sale() - Todas las Operaciones

### 1.1 Validaciones Iniciales (Sin Modificaciones de DB)

```python
1. Obtiene sesión de caja (find_one, no modifica)
2. Valida sesión activa/abierta (read-only)
3. Valida idempotencia (find_one, puede retornar venta existente)
4. Obtiene cliente (find_one, no modifica)
5. Obtiene cotización (find_one, no modifica) - Si aplica
6. Obtiene muestras de cliente (find, no modifica)
7. Valida stock de inventario (find_one, no modifica)
8. Valida autorización de gerente (find_one, no modifica) - Si aplica
```

---

### 1.2 Modificaciones de Base de Datos en create_sale()

| Orden | Colección | Operación | Campo(s) Modificado(s) | Impacto |
|-------|-----------|-----------|------------------------|---------|
| **1** | `sales` | `insert_one()` | (nuevo documento) | Crea factura |
| **2** | `customers` | `update_one()` | `last_sale_at`, `last_sale_branch_id`, `last_sale_branch_name`, `total_sales_count`, `customer_segments` | Historial cliente |
| **3** | `customers` | `update_one()` | `salesperson_history.$.sales_count`, `salesperson_history.$.last_sale_at`, `salesperson_history.$.last_sale_id` | Historial vendedor |
| **4** | `customers` | `update_one()` (insert si no existe) | `salesperson_history` (nuevo elemento en array) | Primer vendedor con cliente |
| **5** | `customers` | `update_one()` | `branch_visit_history.$.visit_count`, `branch_visit_history.$.last_visit_at` | Historial visitas |
| **6** | `customers` | `update_one()` (insert si no existe) | `branch_visit_history` (nuevo elemento en array) | Primera visita sucursal |
| **7** | `audit_logs` | `insert` (vía audit_service) | evento de auditoría | Log de creación |
| **8** | `inventory` | `update_one()` (por cada item) | `quantity` (decrementa), `last_updated` | Descuenta stock |
| **9** | `inventory_movements` | `insert` (vía audit_service) | movimiento de inventario | Auditoría de stock |
| **10** | `sample_requests` | `update_one()` (si aplica) | `status` → "consumed", `sale_id` | Marca muestras usadas |
| **11** | `customers` | `update_one()` | `credit_balance` (incrementa) | Crédito adeudado |
| **12** | `quotations` | `update_one()` (si aplica) | `status` → "converted" | Marca cotización convertida |
| **13** | `manager_authorizations` | `update_one()` (si aplica) | `used` → True, `used_at` | Marca autorización usada |
| **14** | `work_orders` | `insert_one()` (si requiere instalación) | (nuevo documento) | Orden de instalación |
| **15** | `notifications` | `insert` (si hay técnico o sin técnico) | (nuevo documento) | Notificación a técnico |
| **16** | `sales` | `update_one()` | `work_order_id` | Vincula orden de trabajo |
| **17** | `dispatch_orders` | `insert_one()` (si requiere entrega) | (nuevo documento) | Orden de despacho |
| **18** | `sales` | `update_one()` | `dispatch_id` | Vincula orden de despacho |

**TOTAL**: 18 operaciones de DB, 13 colecciones modificadas

---

## 2. Desglose Detallado de Operaciones create_sale()

### 2.1 OPERACIÓN 1: Insertar Venta en sales

```python
await db.sales.insert_one(doc)
```

**Campos Creados**:
```javascript
{
    "sale_id": "sale_XXXXXXXXXX",
    "invoice_number": "INV-2025-001",
    "quotation_id": null,  // opcional
    "customer_id": "cust_ABC123",
    "customer_name": "Cliente XYZ",
    "branch_id": "branch_main",
    "salesperson_id": "user_vendedor",
    "salesperson_name": "Juan Pérez",
    "items": [
        {
            "product_id": "prod_1",
            "product_name": "Producto A",
            "quantity": 2,
            "unit_price": 100.00,
            "discount": 0,
            "subtotal": 200.00,
            "warehouse_id": "wh_main",
            "installation_type": "optional",
            "with_installation": false,
            "display_note": ""
        }
    ],
    "subtotal": 200.00,
    "tax": 24.00,  // IVA 12%
    "discount": 0.00,
    "total": 224.00,
    "payment_type": "cash",  // cash, credit, card, transfer, stripe
    "payment_status": "paid",  // pending si no es cash
    "payment_method": "cash",
    "sale_channel": "minorista",  // o mayorista
    "credit_due_date": null,  // si payment_type == credit
    "delivery_required": false,
    "delivery_address": null,
    "delivery_status": null,
    "notes": null,
    "has_installation": false,
    "iva_rate": 0.12,
    "iva_amount": 24.00,
    "total_legal": 224.00,
    "discounts_applied_amount": 0.00,
    "discounts_blocked_by_method": false,
    "retention_rate": 0.0,
    "retention_amount": 0.0,
    "net_to_collect": 224.00,
    "print_format": "thermal80",
    "retention_receipt_required": false,
    "pos_bank_withholding_expected": 0.0,
    "commercial_terms_locked": false,
    "settlement_warnings": [],
    "created_at": "2025-01-15T10:30:00Z",
    "cash_session_id": "session_123",
    "warehouse_dispatch_status": "not_required",
    "workflow_state": "created",
    "idempotency_key": null
}
```

---

### 2.2 OPERACIÓN 2-6: Actualizar customers

#### 2.2.1 Operación 2: General History

```python
await db.customers.update_one(
    {"customer_id": customer["customer_id"]}, 
    {
        "$set": {
            "last_sale_at": doc.get("created_at"),
            "last_sale_branch_id": user_branch_id,
            "last_sale_branch_name": branch_name,
        },
        "$addToSet": {
            "customer_segments": sale_channel,
        },
        "$inc": {
            "total_sales_count": 1,
        },
    }
)
```

**Campos Modificados en customers**:
- `last_sale_at` ← timestamp
- `last_sale_branch_id` ← branch_id
- `last_sale_branch_name` ← nombre sucursal
- `customer_segments` ← añade "minorista" o "mayorista" (si no existe)
- `total_sales_count` ← incrementa en 1

---

#### 2.2.2 Operación 3-4: Salesperson History (Intenta update, si no modifica inserta)

```python
history_key = {
    "customer_id": customer["customer_id"],
    "salesperson_history.user_id": user.user_id,
    "salesperson_history.branch_id": user_branch_id,
}
await db.customers.update_one(
    history_key,
    {
        "$inc": {
            "salesperson_history.$.sales_count": 1,
        },
        "$set": {
            "salesperson_history.$.last_sale_at": doc.get("created_at"),
            "salesperson_history.$.salesperson_name": user.name,
            "salesperson_history.$.branch_name": branch_name,
            "salesperson_history.$.last_sale_id": doc.get("sale_id"),
        },
    },
)

# Si modified_count == 0, inserta nuevo
if history_inc.modified_count == 0:
    await db.customers.update_one(
        {"customer_id": customer["customer_id"]},
        {
            "$push": {
                "salesperson_history": {
                    "user_id": user.user_id,
                    "salesperson_name": user.name,
                    "role": user.role,
                    "branch_id": user_branch_id,
                    "branch_name": branch_name,
                    "first_sale_at": doc.get("created_at"),
                    "last_sale_at": doc.get("created_at"),
                    "last_sale_id": doc.get("sale_id"),
                    "sales_count": 1,
                }
            }
        },
    )
```

**Campos Modificados en customers.salesperson_history[]**:
- `sales_count` ← +1 (o crea con 1)
- `last_sale_at` ← timestamp
- `last_sale_id` ← sale_id
- O crea nuevo elemento si es primer vendedor

---

#### 2.2.3 Operación 5-6: Branch Visit History (Similar a salesperson)

```python
branch_visit_inc = await db.customers.update_one(
    {
        "customer_id": customer["customer_id"],
        "branch_visit_history.branch_id": user_branch_id,
    },
    {
        "$inc": {
            "branch_visit_history.$.visit_count": 1,
        },
        "$set": {
            "branch_visit_history.$.branch_name": branch_name,
            "branch_visit_history.$.last_visit_at": doc.get("created_at"),
        },
    },
)

if branch_visit_inc.modified_count == 0:
    await db.customers.update_one(
        {"customer_id": customer["customer_id"]},
        {
            "$push": {
                "branch_visit_history": {
                    "branch_id": user_branch_id,
                    "branch_name": branch_name,
                    "first_visit_at": doc.get("created_at"),
                    "last_visit_at": doc.get("created_at"),
                    "visit_count": 1,
                }
            }
        },
    )
```

**Campos Modificados en customers.branch_visit_history[]**:
- `visit_count` ← +1 (o crea con 1)
- `last_visit_at` ← timestamp
- O crea nuevo elemento si primera visita

---

### 2.3 OPERACIÓN 7: Auditoría

```python
await audit_service.log_audit_event(
    action="sale_create",
    actor_id=user.user_id,
    actor_name=user.name,
    actor_role=user.role,
    entity="sale",
    entity_id=doc.get("sale_id"),
    branch_id=user_branch_id,
    metadata={
        "customer_id": sale_data.customer_id,
        "total": doc.get("total"),
        "payment_type": doc.get("payment_type"),
        "items_count": len(doc.get("items") or []),
    },
)
```

**Colección**: `audit_logs` (u `audit_events`)

**Documento creado**: Registro de auditoría con action="sale_create"

---

### 2.4 OPERACIÓN 8-9: Descuento de Inventario

```python
for inv_item in inventory_updates:  # Por cada item de la venta
    if inv_item.get("warehouse_id") and inv_item.get("quantity", 0) > 0:
        product_id = inv_item.get("product_id")
        warehouse_id = inv_item.get("warehouse_id")
        
        # OPERACIÓN 8: Actualizar cantidad en inventory
        await db.inventory.update_one(
            {
                "product_id": product_id,
                "warehouse_id": warehouse_id,
            },
            {
                "$inc": {"quantity": -inv_item.get("quantity", 0)},
                "$set": {"last_updated": datetime.now(timezone.utc).isoformat()},
            },
        )
        
        # OPERACIÓN 9: Auditoría de movimiento
        await audit_service.log_inventory_movement(
            product_id=product_id,
            warehouse_id=warehouse_id,
            quantity_change=-int(inv_item.get("quantity", 0)),  # Negativo
            reason="sale",
            actor=user,
            branch_id=user_branch_id,
            reference_id=doc.get("sale_id"),
            metadata={"customer_id": sale_data.customer_id},
        )
```

**Colecciones**:
- `inventory`: quantity decrementa
- `inventory_movements`: nuevo registro de movimiento

**Ejemplo**: Si venta tiene 2 unidades de producto X en warehouse Y:
- `inventory[product_X, warehouse_Y].quantity` ← -2
- Crea movimiento: `reason="sale"`, `quantity_change=-2`

---

### 2.5 OPERACIÓN 10: Marcar Muestras como Consumidas

```python
for usage in sample_usage:  # Si se usaron muestras
    if usage.get("sample_id"):
        await db.sample_requests.update_one(
            {"sample_id": usage.get("sample_id")},
            {
                "$set": {
                    "status": "consumed",
                    "sale_id": doc.get("sale_id"),
                }
            },
        )
```

**Colección**: `sample_requests`

**Cambios**: 
- `status` → "consumed"
- `sale_id` → referencia a venta creada

---

### 2.6 OPERACIÓN 11: Incrementar Credit Balance (Solo para Crédito)

```python
if sale_data.payment_type == "credit":
    await db.customers.update_one(
        {"customer_id": customer["customer_id"]},
        {"$inc": {"credit_balance": total}},
    )
```

**Colección**: `customers`

**Campo**: `credit_balance` ← +total (ej: +224.00)

**Nota**: Se incrementa porque el cliente DEBE al negocio

---

### 2.7 OPERACIÓN 12: Marcar Cotización como Convertida

```python
if sale_data.quotation_id:
    await db.quotations.update_one(
        {"quotation_id": sale_data.quotation_id}, 
        {"$set": {"status": "converted"}}
    )
```

**Colección**: `quotations`

**Campo**: `status` → "converted"

---

### 2.8 OPERACIÓN 13: Marcar Autorización de Gerente como Usada

```python
if items_requiring_manager_auth and sale_data.manager_authorization_code:
    await db.manager_authorizations.update_one(
        {"code": sale_data.manager_authorization_code},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}},
    )
```

**Colección**: `manager_authorizations`

**Campos**: 
- `used` → True
- `used_at` → timestamp

---

### 2.9 OPERACIÓN 14-16: Crear Orden de Trabajo (Si Requiere Instalación)

```python
if needs_work_order:
    work_order_doc = {
        "work_order_id": f"wo_{uuid.uuid4().hex[:8]}",
        "sale_id": doc["sale_id"],
        "invoice_number": invoice_number,
        "customer_id": customer["customer_id"],
        "customer_name": customer["name"],
        "vehicle_id": sale_data.vehicle_id,
        "vehicle_info": vehicle_info,
        "branch_id": user_branch_id,
        "items": items_requiring_installation,
        "status": "pending",
        "priority": "normal",
        "estimated_time": total_install_time,
        "actual_time": None,
        "technician_id": assigned_technician.get("user_id") if assigned_technician else None,
        "technician_name": assigned_technician.get("name") if assigned_technician else None,
        "start_time": None,
        "end_time": None,
        "quality_score": None,
        "notes": f"Orden generada automáticamente desde venta {invoice_number}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "auto_generated": True,
    }
    
    # OPERACIÓN 14: Insertar orden
    await db.work_orders.insert_one(work_order_doc)
    work_order_id = work_order_doc["work_order_id"]
    
    # OPERACIÓN 15: Crear notificación
    if assigned_technician and assigned_technician.get("user_id"):
        await create_notification_entry(
            message=f"Nueva orden de instalación {work_order_id} asignada: venta {invoice_number}",
            recipient_id=assigned_technician.get("user_id"),
            metadata={
                "type": "work_order_assigned",
                "work_order_id": work_order_id,
                "sale_id": doc.get("sale_id"),
                "invoice_number": invoice_number,
            },
            dedupe_key=f"work_order_assigned:{work_order_id}",
        )
    elif doc.get("salesperson_id"):
        await create_notification_entry(
            message=f"Orden {work_order_id} creada sin técnico disponible",
            recipient_id=doc.get("salesperson_id"),
            metadata={
                "type": "work_order_unassigned",
                "work_order_id": work_order_id,
                "sale_id": doc.get("sale_id"),
                "invoice_number": invoice_number,
            },
            dedupe_key=f"work_order_unassigned:{work_order_id}",
        )
    
    # OPERACIÓN 16: Vincular orden a venta
    await db.sales.update_one(
        {"sale_id": doc["sale_id"]}, 
        {"$set": {"work_order_id": work_order_id}}
    )
```

**Colecciones**:
- `work_orders`: nuevo documento
- `notifications`: nuevo documento (si hay técnico o sin técnico)
- `sales`: actualiza work_order_id

---

### 2.10 OPERACIÓN 17-18: Crear Orden de Despacho (Si Requiere Entrega)

```python
dispatch_doc = await create_dispatch_order_from_sale(doc, customer)
if dispatch_doc:
    dispatch_id = dispatch_doc.get("dispatch_id")
    
    # OPERACIÓN 17: (implícito en create_dispatch_order_from_sale)
    # Inserta en dispatch_orders
    
    # OPERACIÓN 18: Vincular a venta
    await db.sales.update_one(
        {"sale_id": doc["sale_id"]},
        {"$set": {"dispatch_id": dispatch_id}},
    )
```

**Colecciones**:
- `dispatch_orders`: nuevo documento
- `sales`: actualiza dispatch_id

---

## 3. Flujo approve_sale_cancel_request() - Operaciones

### 3.1 Validaciones (Sin Modificaciones)

```python
1. Obtiene solicitud (find_one, no modifica)
2. Valida tipo == "cancel" (read-only)
3. Obtiene venta (find_one, no modifica)
4. Valida invoice_state != "cancelled" (read-only)
5. Valida payment_status != "paid" (read-only)
```

---

### 3.2 Modificaciones de Base de Datos

| Orden | Colección | Operación | Campo(s) Modificado(s) | Acción |
|-------|-----------|-----------|------------------------|--------|
| **1** | `sales` | `update_one()` | `invoice_state`, `cancel_reason`, `cancel_justification_internal`, `cancel_authorized_by`, `cancelled_by`, `cancelled_by_name`, `cancelled_at`, `updated_at` | Marca como cancelada |
| **2** | `sale_requests` | `update_one()` | `status`, `resolved_at`, `resolved_by`, `resolved_by_name` | Marca solicitud como aprobada |
| **3** | `notifications` | manipulación | (close pending) | Cierra notificaciones de solicitud |
| **4** | `notifications` | `insert` | (nueva notificación) | Notifica al solicitante |

**TOTAL**: 4 operaciones, 3 colecciones modificadas

---

### 3.3 Desglose Detallado

#### 3.3.1 OPERACIÓN 1: Actualizar Venta

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

**Campos NUEVOS en sales**:
- `invoice_state` → "cancelled"
- `cancel_reason` → "Solicitud aprobada"
- `cancel_justification_internal` → reason
- `cancel_authorized_by` → user_id
- `cancelled_by` → user_id
- `cancelled_by_name` → name
- `cancelled_at` → timestamp
- `updated_at` → timestamp

---

#### 3.3.2 OPERACIÓN 2: Actualizar Solicitud

```python
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
```

**Campos MODIFICADOS en sale_requests**:
- `status` → "approved" (era "pending")
- `resolved_at` → timestamp (era None)
- `resolved_by` → user_id (era None)
- `resolved_by_name` → name (era None)

---

#### 3.3.3 OPERACIÓN 3: Cerrar Notificaciones

```python
await _close_sale_request_notifications(request_id, "cancel")
```

**Lógica** (extraída de búsqueda anterior):
```python
# Busca notificaciones pendientes para esta solicitud
# Las marca como leídas o las elimina/archiva
# Colección: notifications
```

---

#### 3.3.4 OPERACIÓN 4: Notificar Solicitante

```python
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
```

**Colección**: `notifications`

**Documento**: Nueva notificación para requester_id

---

## 4. MATRIZ COMPARATIVA: create_sale vs approve_sale_cancel_request

| Recurso | create_sale (Operación) | approve_sale_cancel_request (Operación) | ¿Reversión Existe? | Estado |
|---------|---|---|---|---|
| **sales** | INSERT (op. 1) | UPDATE invoice_state="cancelled" (op. 1) | ✅ Parcial | ⚠️ |
| **inventory** | DECREMENT quantity (op. 8) | NADA | ❌ | 🔴 CRÍTICO |
| **inventory_movements** | INSERT audit (op. 9) | NADA | ❌ | 🔴 CRÍTICO |
| **customers.last_sale_*** | UPDATE (op. 2) | NADA | ❌ | 🟡 |
| **customers.total_sales_count** | INCREMENT +1 (op. 2) | NADA | ❌ | 🔴 CRÍTICO |
| **customers.customer_segments** | ADDTOSET (op. 2) | NADA | ❌ | 🟡 |
| **customers.salesperson_history** | INSERT/UPDATE (op. 3-4) | NADA | ❌ | 🔴 CRÍTICO |
| **customers.branch_visit_history** | INSERT/UPDATE (op. 5-6) | NADA | ❌ | 🔴 CRÍTICO |
| **customers.credit_balance** | INCREMENT +total (op. 11) | NADA | ❌ | 🔴 CRÍTICO |
| **audit_logs** | INSERT (op. 7) | NADA (solo para cancelación) | ⚠️ Asimétrico | 🟡 |
| **sample_requests** | UPDATE status="consumed" (op. 10) | NADA | ❌ | 🔴 CRÍTICO |
| **quotations** | UPDATE status="converted" (op. 12) | NADA | ❌ | 🔴 CRÍTICO |
| **manager_authorizations** | UPDATE used=True (op. 13) | NADA | ❌ | 🔴 CRÍTICO |
| **work_orders** | INSERT (op. 14) | NADA | ❌ | 🔴 CRÍTICO |
| **notifications** | INSERT (op. 15) | NADA (crea nueva) | ⚠️ | 🟡 |
| **dispatch_orders** | INSERT (op. 17) | NADA | ❌ | 🔴 CRÍTICO |
| **sale_requests** | N/A | UPDATE status="approved" (op. 2) | ✅ | 🟢 |

---

## 5. INCONSISTENCIAS IDENTIFICADAS POST-CANCELACIÓN

### 5.1 Inconsistencias CRÍTICAS (Alto Impacto)

#### 5.1.1 Inventario NO Revertido

**Problema**:
- `create_sale()` descuenta: `inventory.quantity -= items_qty`
- `approve_sale_cancel_request()` NO incrementa: `inventory.quantity += items_qty`

**Resultado**: Stock permanentemente descuido

**Ejemplo**:
```
Antes de venta:   inventory[prod_A, wh_1].quantity = 100
Después de venta: inventory[prod_A, wh_1].quantity = 98  (venta de 2 unidades)
Cancelo venta:    inventory[prod_A, wh_1].quantity = 98  (SIN CAMBIOS) ❌

Estado ideal:     inventory[prod_A, wh_1].quantity = 100
```

**Impacto**: Disponibilidad de stock falsa, no se pueden vender artículos "cancelados"

---

#### 5.1.2 Credit Balance NO Revertido

**Problema**:
- `create_sale()` incrementa (solo crédito): `customers.credit_balance += total`
- `approve_sale_cancel_request()` NO decrementa

**Resultado**: Cliente aparenta deber más de lo que realmente debe

**Ejemplo**:
```
Cliente con crédito:
Antes:             credit_balance = 500.00
Venta $224 crédito: credit_balance = 724.00  (debe 724 al negocio)
Cancelo venta:      credit_balance = 724.00  (SIN CAMBIOS) ❌

Estado ideal:       credit_balance = 500.00
```

**Impacto**: Reportes de créditos incorrectos, cobros incorrectos, límites de crédito afectados

---

#### 5.1.3 Contador de Ventas NO Revertido

**Problema**:
- `create_sale()` incrementa: `customers.total_sales_count += 1`
- `approve_sale_cancel_request()` NO decrementa

**Resultado**: Cliente aparenta tener más compras de las que realmente tiene

**Ejemplo**:
```
Antes:             total_sales_count = 10
Crea venta:        total_sales_count = 11
Cancela venta:     total_sales_count = 11  (SIN CAMBIOS) ❌

Estado ideal:      total_sales_count = 10
```

**Impacto**: Estadísticas de cliente incorrectas, reportes de desempeño falsos

---

#### 5.1.4 Historial de Vendedor NO Revertido

**Problema**:
- `create_sale()` incrementa: `customers.salesperson_history[...].sales_count += 1`
- `approve_sale_cancel_request()` NO decrementa

**Resultado**: Vendedor aparenta tener más ventas de las que realmente tiene

**Impacto**: Comisiones incorrectas, métricas de desempeño falso

---

#### 5.1.5 Historial de Visitas NO Revertido

**Problema**:
- `create_sale()` incrementa: `customers.branch_visit_history[...].visit_count += 1`
- `approve_sale_cancel_request()` NO modifica

**Resultado**: Sucursal aparenta más visitas del cliente

**Impacto**: Estadísticas de tráfico falso

---

#### 5.1.6 Órdenes de Trabajo NO Eliminadas/Canceladas

**Problema**:
- `create_sale()` crea: `work_orders.insert_one()` (si requiere instalación)
- `approve_sale_cancel_request()` NO elimina ni marca como cancelada

**Resultado**: Orden de trabajo "huérfana" sin venta asociada

**Impacto**:
- Técnico recibe orden de venta cancelada
- Orden en sistema sin contexto
- Reportes de trabajo incompletos

---

#### 5.1.7 Órdenes de Despacho NO Eliminadas/Canceladas

**Problema**:
- `create_sale()` crea: `dispatch_orders.insert_one()` (si requiere entrega)
- `approve_sale_cancel_request()` NO elimina ni marca como cancelada

**Resultado**: Orden de despacho "huérfana"

**Impacto**:
- Personal de logística ve despachos fantasma
- Reportes incompletos
- Confusión operacional

---

#### 5.1.8 Muestras NO Desmaracadas como Consumidas

**Problema**:
- `create_sale()` marca: `sample_requests.status = "consumed"` (si se usaron)
- `approve_sale_cancel_request()` NO revierte a estado anterior

**Resultado**: Muestra permanece marcada como consumida

**Impacto**:
- Muestra no disponible para otros clientes
- Depósito de muestras incompleto

---

#### 5.1.9 Cotización NO Desmaracada como Convertida

**Problema**:
- `create_sale()` marca: `quotations.status = "converted"` (si venta de cotización)
- `approve_sale_cancel_request()` NO revierte

**Resultado**: Cotización permanece en estado "convertida" aunque venta se cancele

**Impacto**:
- Cotización no puede re-convertirse
- Cliente no puede crear otra venta con misma cotización
- Datos de flujo comercial inconsistentes

---

### 5.2 Inconsistencias IMPORTANTES (Impacto Medio)

#### 5.2.1 Auditoría Asimétrica

**Problema**:
- `create_sale()` crea: `audit_logs.insert()` con action="sale_create"
- `approve_sale_cancel_request()` NO crea: `audit_logs.insert()` con action="sale_cancel"

**Resultado**: Falta trazabilidad formal de cancelación

**Impacto**:
- Auditoría incompleta
- No hay registro formal de quién/cuándo canceló
- Difícil investigación de discrepancias

---

#### 5.2.2 Notificaciones NO Coordindadas

**Problema**:
- `create_sale()` crea notificaciones a técnico (si hay orden)
- `approve_sale_cancel_request()` crea notificación a solicitante
- PERO no notifica a técnico que su orden fue cancelada

**Resultado**: Técnico no se entera de que trabajo fue cancelado

**Impacto**: Técnico recibe orden y no entiende por qué se cancela

---

#### 5.2.3 Autorización de Gerente NO Desmaracada

**Problema**:
- `create_sale()` marca: `manager_authorizations.used = True` (si requería)
- `approve_sale_cancel_request()` NO revierte

**Resultado**: Código de autorización permanece como usado

**Impacto**: Código no puede reutilizarse (puede ser intended o bug)

---

### 5.3 Inconsistencias MENORES (Impacto Bajo)

#### 5.3.1 Last Sale Info No Actualizada

**Problema**:
- `create_sale()` actualiza: `customers.last_sale_at`, `customers.last_sale_branch_id`
- `approve_sale_cancel_request()` NO los revierte

**Resultado**: `last_sale_at` permanece pointing a venta cancelada

**Impacto**: Bajo, es información "informativa", no transaccional

---

#### 5.3.2 Movement Audit NO Revertido

**Problema**:
- `create_sale()` crea: `inventory_movements` con reason="sale"
- `approve_sale_cancel_request()` NO crea contramovimiento con reason="sale_cancelled"

**Resultado**: Auditoría de inventario incomplete

**Impacto**: Bajo, pero afecta trazabilidad

---

## 6. Operaciones Necesarias para Reversión Completa

### 6.1 OPERACIONES REQUERIDAS (En Orden)

| # | Recurso | Operación Requerida | Criticidad | Dependencias |
|---|---------|-------------------|-----------|---|
| 1 | `inventory` | `$inc quantity += qty_descuento` | 🔴 CRÍTICO | Ninguna |
| 2 | `inventory_movements` | `INSERT reason="sale_cancelled"` | 🔴 CRÍTICO | Op. 1 |
| 3 | `customers.credit_balance` | `$inc credit_balance -= total` (si crédito) | 🔴 CRÍTICO | Ninguna |
| 4 | `customers.total_sales_count` | `$inc total_sales_count -= 1` | 🔴 CRÍTICO | Ninguna |
| 5 | `customers.salesperson_history[].sales_count` | `$inc -= 1` | 🔴 CRÍTICO | Ninguna |
| 6 | `customers.branch_visit_history[].visit_count` | `$inc -= 1` (si primera visita, eliminar) | 🟡 IMPORTANTE | Ninguna |
| 7 | `sample_requests` | `UPDATE status = revertir a anterior` | 🔴 CRÍTICO | Necesita guardar estado anterior |
| 8 | `quotations` | `UPDATE status = "approved"` (si era converted) | 🔴 CRÍTICO | Ninguna |
| 9 | `manager_authorizations` | `UPDATE used = False` (optional, depende de negocio) | 🟡 IMPORTANTE | Ninguna |
| 10 | `work_orders` | `UPDATE status = "cancelled"` (NO eliminar) | 🔴 CRÍTICO | Ninguna |
| 11 | `dispatch_orders` | `UPDATE status = "cancelled"` (NO eliminar) | 🔴 CRÍTICO | Ninguna |
| 12 | `notifications` | `INSERT notif para técnico: "Orden cancelada"` | 🟡 IMPORTANTE | Op. 10 |
| 13 | `audit_logs` | `INSERT action="sale_cancelled"` | 🟡 IMPORTANTE | Ninguna |
| 14 | `sales` | `UPDATE invoice_state="cancelled"` | ✅ HECHO | Todas anteriores |

---

## 7. Problemas de Implementación

### 7.1 Información Perdida

**Problema Principal**: Al cancelar venta, NO se registra "estado anterior" de recursos

**Ejemplos**:

1. **sample_requests**: ¿Cuál era el status ANTES de "consumed"?
   - Era "delivered" o "return_requested"?
   - Se necesita guardar estado anterior en venta o en sample

2. **quotations**: Si cotización fue convertida, se puede revertir, pero:
   - ¿Qué si hay MÚLTIPLES ventas de misma cotización (si system lo permite)?
   - Se vuelven a convertir todas?

3. **last_sale_***: ¿Cuál era la venta anterior al cliente?
   - Se borra y deja cliente sin "last sale"?
   - Se busca venta anterior no cancelada?

---

### 7.2 Transaccionalidad

**Problema**: Operaciones de cancelación NO son atómicas

**Escenario de Falla**:
```
1. Cancela venta ✅
2. Intenta revertir inventario → FALLA ❌
   → Ahora: venta cancelada pero stock descuentado
   → Sistema inconsistente

3. Intenta revertir crédito → FALLA ❌
   → Ahora: venta cancelada, stock OK, crédito descuentado
   → Sistema en estado inválido
```

**Solución**: Usar transacciones de MongoDB (cambiar collection.find_one + update a transaction)

---

### 7.3 Validaciones Insuficientes

**Problema**: approve_sale_cancel_request() valida poco

```python
# Valida:
✅ Venta no pagada
✅ Venta no cancelada
✅ Solicitud pendiente

# NO valida:
❌ ¿Tiene orden de trabajo en progreso?
❌ ¿Tiene pago parcial recibido?
❌ ¿Tiene devolución parcial?
❌ ¿Es venta de hace > 30 días? (política?)
```

---

## 8. Complejidad Estimada de Reversión

### 8.1 Desglose por Componente

| Componente | Complejidad | Razón | Esfuerzo |
|-----------|-----------|-------|---------|
| **Inventario** | **MEDIA** | Revertir $inc, crear audit | 2-3 horas |
| **Crédito** | **BAJA** | Revertir $inc simple | 30 min |
| **Contadores Cliente** | **BAJA** | Revertir $inc simple | 30 min |
| **Muestras** | **MEDIA** | Necesita guardar estado anterior | 1-2 horas |
| **Cotizaciones** | **MEDIA** | Lógica condicional | 1 hora |
| **Órdenes de Trabajo** | **BAJA** | Solo cambiar status | 30 min |
| **Órdenes de Despacho** | **BAJA** | Solo cambiar status | 30 min |
| **Auditoría** | **BAJA** | Crear nuevo registro | 30 min |
| **Transaccionalidad** | **ALTA** | Refactorizar para usar transactions | 3-4 horas |
| **Testing** | **ALTA** | Pruebas de todos escenarios | 4-6 horas |

### 8.2 COMPLEJIDAD GENERAL: **ALTA**

```
Total Esfuerzo Estimado: 12-18 horas
- Si es Refactor: +4-6 horas (transactions)
- Si incluye Testing: +4-6 horas
- Si incluye DevOps (rollbacks): +2-3 horas

Riesgo: ALTO
- Muchas dependencias entre operaciones
- Cambios en múltiples colecciones
- Posible inconsistencia de datos
- Afecta auditoría fiscal (si aplica)
```

---

## 9. Plan Técnico de Reversión (Más Seguro)

### 9.1 Enfoque Recomendado: INCREMENTAL + SAFE

```
FASE 1: Preparación (2 horas)
─────────────────────────────
1. Agregar campos "antes de venta" a sales collection:
   - snapshot_inventory: {product_id: qty_antes, ...}
   - snapshot_customer: {credit_balance_antes, total_sales_count_antes, ...}
   - snapshot_quotation_status: status_antes
   - snapshot_samples: [{sample_id, status_antes}, ...]

2. Modificar create_sale() para capturar estado anterior:
   ✅ Antes de insertar venta, guardar estado actual en sales
   ✅ Esto es RETROACTIVO (opcional para ventas nuevas)

FASE 2: Lógica de Cancelación (4-5 horas)
──────────────────────────────────────────
3. Crear función async def revert_sale_effects(sale_id):
   
   3a. Leer venta + snapshots
   3b. Verificar que sea seguro revertir (validaciones)
   3c. Ejecutar operaciones EN ORDEN:
       - Revertir inventario ($inc +qty)
       - Crear audit de reversión
       - Revertir crédito ($inc -total)
       - Revertir contadores
       - Revertir muestras (usando snapshot)
       - Revertir cotización
       - Cancelar órdenes (status = cancelled, NOT delete)
       - Crear auditoría formal
   
   3d. Marcar venta como "fully_reverted" = true

4. Modificar approve_sale_cancel_request():
   - Llamar revert_sale_effects(sale_id)
   - Manejar excepciones y rollback

FASE 3: Transaccionalidad (3-4 horas)
─────────────────────────────────────
5. Envolver revert_sale_effects() en transaction de MongoDB:
   - Si falla ANY operación → ROLLBACK de todas
   - Garantiza consistencia

FASE 4: Testing (4-6 horas)
───────────────────────────
6. Casos de prueba:
   - Venta cash, sin instalación, sin entrega → cancelar → verificar
   - Venta crédito, con instalación → cancelar → verificar TODO
   - Venta de cotización → cancelar → cotización debe permitir re-convertir
   - Venta con muestras → cancelar → muestras disponibles nuevamente
   - Cancelación fallida → rollback completo
   - Venta ya pagada → no permitir cancelación
```

---

### 9.2 Approach ALTERNATIVO: Soft Delete (Más Seguro)

```
En lugar de REVERTIR todo, simplemente:

1. Marcar venta como "cancelled"
2. NO tocar inventario ni crédito
3. CREAR TRANSACCIÓN INVERSA:
   
   Crear nuevo documento "sale_reversal":
   {
       "reversal_id": "rev_XXX",
       "original_sale_id": "sale_XXX",
       "status": "cancelled",
       "reversal_effects": {
           "inventory_adjustments": [
               {"product_id": X, "qty": +qty}
           ],
           "credit_adjustment": -total,
           "...": "..."
       },
       "created_at": now,
       "created_by": approver.user_id
   }

Ventajas:
✅ No modifica datos existentes
✅ Fácil auditar (venta original intacta)
✅ Fácil rollback (borra reversal)

Desventajas:
❌ Requiere lógica para calcular "neto" (sale + reversal)
❌ Más complejo de consultar/reportar
```

---

## 10. RECOMENDACIÓN FINAL

### 10.1 Acción Inmediata: CRÍTICO

**Implementar Reversión de ESTOS recursos** (80% del problema):

1. **inventory**: Revertir decremento
2. **customers.credit_balance**: Revertir incremento (si crédito)
3. **customers.total_sales_count**: Revertir incremento
4. **customers.salesperson_history[].sales_count**: Revertir incremento
5. **work_orders**: Marcar como cancelled (no eliminar)
6. **dispatch_orders**: Marcar como cancelled (no eliminar)
7. **quotations**: Revertir status a "approved" (si fue converted)
8. **audit_logs**: Crear entrada de cancelación

**Esfuerzo**: 6-8 horas (sin transaction)

---

### 10.2 Acción Secundaria: IMPORTANTE

1. Agregar snapshots en create_sale() para state anterior
2. Implementar transacción MongoDB
3. Agregar validaciones de cancelación

**Esfuerzo**: 6-8 horas

---

### 10.3 Acción Futura: MEJORÍA

1. Implementar "sale_reversals" como soft delete approach
2. Refactor reporting para consolidar sale + reversals
3. Auditoría formal con trail completo

**Esfuerzo**: 10+ horas

---

## RESUMEN EJECUTIVO

| Aspecto | Hallazgo |
|--------|----------|
| **Operaciones create_sale()** | 18 operaciones en 13 colecciones |
| **Operaciones cancelación** | 4 operaciones en 3 colecciones |
| **Reversiones Implementadas** | 2 de 16 (12.5%) |
| **Inconsistencias CRÍTICAS** | 9 |
| **Inconsistencias IMPORTANTES** | 3 |
| **Complejidad** | 🔴 ALTA |
| **Riesgo** | 🔴 ALTO |
| **Esfuerzo Corrección** | 12-18 horas (full) / 6-8 horas (mínimo viable) |
| **Recomendación** | Implementar reversión de inventario + crédito + contadores + órdenes como PRIORITARIO |

---

**Fin del Análisis**  
**Fecha**: 2025-01-15  
**Versión**: 1.0
