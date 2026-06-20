# Reporte Técnico: Backend - Servicio de Ventas

**Archivo Principal**: `backend/services/venta_service.py`  
**Archivo Implementación**: `backend/server.py` (función `create_sale`)  
**Fecha de Análisis**: 2025-01-15  
**Tipo de Análisis**: Auditoría Backend - Completitud de Funcionalidad

---

## 1. Estado del Archivo venta_service.py

### ⚠️ ESTADO CRÍTICO: ARCHIVO VACÍO/PLACEHOLDER

El archivo `backend/services/venta_service.py` contiene **SOLO dos funciones incompletas (stubs)**:

```python
# Placeholder for venta_service helpers

def update_venta_status(sale_id: str, status: str):
    # Actualiza el estado de la venta en la base de datos
    pass

def generate_token_autorizacion(sale_id: str) -> str:
    # Genera un token único para la autorización
    import uuid
    return str(uuid.uuid4())
```

**Implicaciones**:
- ❌ No hay lógica de negocio centralizada para ventas
- ❌ La función `update_venta_status()` es un stub (no implementada)
- ❌ La lógica de ventas está implementada directamente en `server.py`
- ⚠️ Violación de patrón de arquitectura MVC/modular

---

## 2. Implementación Real de Ventas

La lógica de ventas se encuentra implementada en **`backend/server.py`** mediante:

### 2.1 Endpoint: POST /api/sales

```python
@api_router.post("/sales")
async def create_sale(sale_data: SaleCreate, request: Request):
    # Implementación completa de creación de venta (~700 líneas)
```

### 2.2 Schemas de Entrada (FastAPI Pydantic)

```python
class SaleCreate(BaseModel):
    customer_id: str                              # REQUERIDO
    vehicle_id: Optional[str]                     # Opcional
    quotation_id: Optional[str]                   # Desde cotización
    items: List[SaleItemInput]                    # Líneas de venta
    payment_type: str                             # cash|card|credit|transfer|stripe
    payment_method: Optional[str]                 # Alternativa a payment_type
    discount: float                               # % descuento global (0-100)
    currency: Optional[str]                       # USD|NIO
    exchange_rate: Optional[float]                # Tasa USD->NIO
    credit_days: Optional[int]                    # Si payment_type == "credit"
    delivery_required: bool                       # Requiere entrega
    delivery_address: Optional[str]               # Dirección de entrega
    notes: Optional[str]                          # Notas internas
    cash_session_id: Optional[str]                # Sesión de caja específica
    idempotency_key: Optional[str]                # Evitar duplicados
    manager_authorization_code: Optional[str]    # Autorización gerencial
```

### 2.3 Modelo de Salida

```python
class Sale(BaseModel):
    sale_id: str                                  # Generado: sale_XXXXXXXXXX
    invoice_number: str                           # Generado secuencialmente
    customer_id: str
    customer_name: str
    branch_id: str
    salesperson_id: str
    salesperson_name: str
    items: List[SaleItem]
    subtotal: float
    tax: float                                    # IVA calculado
    discount: float                               # Descuento aplicado
    total: float
    payment_type: str
    payment_status: str                           # pending|paid
    payment_method: str
    sale_channel: str                             # minorista|mayorista
    credit_due_date: Optional[datetime]
    delivery_required: bool
    delivery_address: Optional[str]
    delivery_status: Optional[str]                # pending|in_transit|delivered
    notes: Optional[str]
    has_installation: bool
    iva_rate: float
    iva_amount: float
    retention_rate: float
    retention_amount: float
    created_at: datetime
    work_order_id: Optional[str]                  # Si requiere instalación
    dispatch_id: Optional[str]                    # Si requiere entrega
```

---

## 3. Funciones Implementadas en server.py

### 3.1 Función Principal: create_sale

**Responsabilidades**:
1. ✅ Validación de usuario y autenticación
2. ✅ Selección de sesión de caja
3. ✅ Idempotencia (key duplicada)
4. ✅ Validación de cotización
5. ✅ Procesamiento de items y inventario
6. ✅ Cálculo de totales (IVA, descuentos)
7. ✅ Verificación de límite de crédito
8. ✅ Autorización gerencial
9. ✅ Generación de factura
10. ✅ Creación de orden de trabajo
11. ✅ Creación de orden de despacho
12. ✅ Actualización de historial de cliente
13. ✅ Auditoría

### 3.2 Funciones Auxiliares en server.py

```python
# Gestión de tasas
async def _get_billing_iva_rate() -> float
    # Obtiene IVA del día

async def _currency_code(raw: str) -> str
    # Normaliza código de moneda

async def _normalize_method_name(method: str) -> str
    # Normaliza nombre de método de pago

# Validaciones de autorización
async def _enforce_seller_global_discount_limits(actor, subtotal, discount_percent, currency, exchange_rate)
    # Valida límites de descuento por vendedor

# Cálculo de settlement
def _build_sale_settlement(...)
    # Calcula detalles tributarios y comerciales

def _compute_items_subtotal(items) -> float
    # Suma precios de items

def _extract_retention_profile_from_customer(customer) -> str
    # Extrae perfil de retención del cliente

# Trabajo y despacho
async def pick_available_technician(branch_id: str)
    # Selecciona técnico disponible

async def create_dispatch_order_from_sale(sale_doc, customer)
    # Crea orden de despacho

async def create_notification_entry(message, recipient_id, metadata, dedupe_key)
    # Envía notificación

async def generate_invoice_number() -> str
    # Genera número de factura

async def get_default_warehouse_for_branch(branch_id: str)
    # Obtiene bodega por defecto

async def ensure_warehouse_belongs_to_branch(warehouse_id, branch_id)
    # Valida warehouse-branch

async def ensure_branch_service_enabled(branch_id, service_key, error_msg)
    # Valida servicios habilitados

async def can_access_sale_for_user(user, sale) -> bool
    # Control de acceso
```

### 3.3 Endpoint Adicional: GET /sales/{sale_id}

```python
@api_router.get("/sales/{sale_id}")
async def get_sale(sale_id: str, request: Request)
    # Obtiene venta por ID
```

### 3.4 Endpoint: POST /sales/preview-settlement

```python
@api_router.post("/sales/preview-settlement")
async def preview_sale_settlement(payload: SaleSettlementPreviewRequest, request: Request)
    # Preview de cálculos de venta ANTES de crear
```

### 3.5 Endpoint: PATCH /sales/{sale_id}/commercial-terms

```python
@api_router.patch("/sales/{sale_id}/commercial-terms")
async def update_sale_commercial_terms(...)
    # Actualiza términos comerciales (IVA, retención, método de pago)
```

---

## 4. Modelos Utilizados

### Base de Datos (MongoDB)

| Colección | Uso | Campos Críticos |
|-----------|-----|-----------------|
| `sales` | Almacenar ventas | sale_id, invoice_number, customer_id, items[], total, payment_type |
| `customers` | Referencia de cliente | customer_id, name, credit_limit, credit_balance |
| `products` | Catálogo | product_id, name, price, installation_type, installation_price |
| `inventory` | Stock por warehouse | product_id, warehouse_id, quantity |
| `warehouses` | Almacenes | warehouse_id, name, branch_id |
| `quotations` | Cotizaciones | quotation_id, status (approved/converted), valid_until |
| `caja_sesiones` | Sesiones de caja | session_id, branch_id, estado (abierta/cerrada) |
| `vehicles` | Vehículos de cliente | vehicle_id, customer_id, plate, brand, model |
| `manager_authorizations` | Tokens de gerente | code, used, expires_at |
| `work_orders` | Órdenes de instalación | work_order_id, sale_id, status, technician_id |
| `work_order_assignments` | Asignaciones | (Implícito en work_orders) |
| `sample_requests` | Muestras | sample_id, customer_id, product_id, status, quantity |
| `users` | Usuarios | user_id, name, role, branch_id |
| `branches` | Sucursales | branch_id, name, installations_enabled |

### Schemas Pydantic (en server.py)

```python
class SaleCreate         # Input para POST /sales
class SaleItem          # Ítem en carrito
class Sale              # Modelo de venta
class SaleItemInput     # Item en request
class SaleSettlementPreviewRequest  # Preview de cálculos
class SaleCommercialTermsUpdate     # Actualizar términos
```

---

## 5. Dependencias Identificadas

### 5.1 Clientes (Customers)

**Cómo se integra**:
```python
customer = await db.customers.find_one(
    {"customer_id": sale_data.customer_id}, {"_id": 0}
)
if not customer:
    raise HTTPException(404, "Customer not found")
```

**Datos utilizados del cliente**:
- ✅ `customer_id` - Identificador
- ✅ `name` - Nombre para factura
- ✅ `customer_type` - Determina channel (minorista/mayorista)
- ✅ `credit_limit` - Validación de crédito
- ✅ `credit_balance` - Saldo actual de crédito

**Actualizaciones realizadas**:
- ✅ `last_sale_at` - Timestamp de última venta
- ✅ `total_sales_count` - Contador incrementado
- ✅ `salesperson_history` - Historial por vendedor
- ✅ `branch_visit_history` - Historial por sucursal
- ✅ `credit_balance` - Incrementado si pago a crédito

**Dependencia**: 🟢 **FUERTE Y COMPLETA**

---

### 5.2 Cotizaciones (Quotations)

**Cómo se integra**:
```python
if sale_data.quotation_id:
    quotation = await db.quotations.find_one(
        {"quotation_id": sale_data.quotation_id}, {"_id": 0}
    )
    if not quotation:
        raise HTTPException(404, "Quotation not found")
    if quotation.get("status") != "approved":
        raise HTTPException(400, "Quotation is not approved for conversion")
    valid_until = quotation.get("valid_until")
    if valid_until < datetime.now(timezone.utc):
        raise HTTPException(400, "Quotation has expired")
    # Marca como convertida
    await db.quotations.update_one(
        {"quotation_id": sale_data.quotation_id}, 
        {"$set": {"status": "converted"}}
    )
```

**Validaciones**:
- ✅ Cotización existe
- ✅ Estado = "approved"
- ✅ Cliente coincide
- ✅ No expirada
- ✅ Marca como convertida

**Dependencia**: 🟢 **COMPLETA PERO OPCIONAL**

---

### 5.3 Inventario (Inventory)

**Cómo se integra**:
```python
# Para cada item en sale_data.items:
if product.get("product_type") != "service":
    inv = await db.inventory.find_one(
        {"product_id": item["product_id"], "warehouse_id": warehouse_id}
    )
    required_qty = item["quantity"]  # Menos muestras si aplica
    
    if required_qty > 0 and (not inv or inv["quantity"] < required_qty):
        raise HTTPException(400, "Insufficient inventory")
    
    # Después de crear venta, actualiza:
    await db.inventory.update_one(
        {"product_id": product_id, "warehouse_id": warehouse_id},
        {"$inc": {"quantity": -required_qty}}
    )
```

**Funcionalidades**:
- ✅ Verifica stock ANTES de crear venta
- ✅ Integración con muestras (sample_requests)
- ✅ Decrementa cantidad después
- ✅ Auditoría de movimientos
- ⚠️ NO maneja traslados entre warehouses

**Dependencia**: 🟢 **FUERTE Y CORRECTA**

---

### 5.4 Caja (Cash Sessions)

**Cómo se integra**:
```python
# Obtiene sesión de caja activa
active_session = await db.caja_sesiones.find_one(
    {"branch_id": user_branch_id, "estado": "abierta"},
    sort=[("opened_at", -1)]
)
selected_cash_session_id = active_session.get("session_id")
```

**Validaciones**:
- ✅ Sesión activa en la misma sucursal
- ✅ Estado = "abierta"
- ✅ Vincula venta a sesión
- ⚠️ NO verifica cierre de sesión
- ⚠️ NO calcula cambio

**Dependencia**: 🟡 **PARCIAL**

---

### 5.5 Créditos (Credits)

**Cómo se integra**:
```python
if sale_data.payment_type == "credit":
    available_credit = customer.get("credit_limit", 0) - customer.get("credit_balance", 0)
    if total > available_credit:
        raise HTTPException(400, "Exceeds credit limit")
    
    # Después de crear venta:
    await db.customers.update_one(
        {"customer_id": customer["customer_id"]},
        {"$inc": {"credit_balance": total}}
    )
    
    # Establece fecha vencimiento:
    credit_due_date = datetime.now(timezone.utc) + timedelta(days=sale_data.credit_days)
```

**Funcionalidades**:
- ✅ Valida límite de crédito
- ✅ Incrementa saldo
- ✅ Calcula fecha vencimiento
- ⚠️ NO crea documento de crédito separado
- ⚠️ NO tiene flujo de cobro/seguimiento

**Dependencia**: 🟡 **PARCIAL**

---

### 5.6 Facturación (Invoicing)

**Cómo se integra**:
```python
invoice_number = await generate_invoice_number()

sale = Sale(
    invoice_number=invoice_number,
    subtotal=round(subtotal, 2),
    tax=round(tax, 2),
    discount=round(total_discount, 2),
    total=round(total, 2),
    iva_rate=iva_rate_decimal,
    iva_amount=round(tax, 2),
    total_legal=round(total, 2),
    payment_type=sale_data.payment_type,
    payment_status="pending" if sale_data.payment_type != "cash" else "paid"
)
```

**Cálculos**:
- ✅ Genera número de factura único
- ✅ Calcula IVA
- ✅ Calcula descuentos
- ✅ Define estado de pago
- ⚠️ NO genera PDF
- ⚠️ NO gestiona retenciones IR completas

**Dependencia**: 🟢 **FUERTE**

---

### 5.7 Aprobaciones (Manager Authorization)

**Cómo se integra**:
```python
# Identifica productos "solo para llevar"
if product.get("installation_type") == "not_available" and wants_installation:
    items_requiring_manager_auth.append(...)

# Valida autorización si es necesario
if items_requiring_manager_auth and not sale_data.manager_authorization_code:
    raise HTTPException(400, detail={
        "error": "REQUIRES_MANAGER_AUTH",
        "products": items_requiring_manager_auth,
    })

# Verifica código
if items_requiring_manager_auth and sale_data.manager_authorization_code:
    auth_valid = await db.manager_authorizations.find_one({
        "code": sale_data.manager_authorization_code,
        "used": False,
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()},
    })
    if not auth_valid:
        raise HTTPException(400, "Código de autorizacion inválido o expirado")
    # Marca como usado
    await db.manager_authorizations.update_one(
        {"code": sale_data.manager_authorization_code},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
    )
```

**Funcionalidades**:
- ✅ Identifica productos que requieren autorización
- ✅ Valida código de autorización
- ✅ Verifica expiración
- ✅ Marca como usado (evita reutilización)
- ⚠️ Autorización es REACTIVA (tras intento fallido)
- ⚠️ No integra con approval_service.py

**Dependencia**: 🟡 **PARCIAL**

---

## 6. Confirmación: ¿Implementa Completamente POST /sales?

### ✅ SÍ, IMPLEMENTADO EN LÍNEAS GENERALES

Pero con **reservas críticas**:

#### ✅ Implementado Correctamente

1. **Validaciones básicas**
   - ✅ Usuario autenticado
   - ✅ Cliente existe
   - ✅ Items existen en catálogo
   - ✅ Stock disponible

2. **Cálculos de totales**
   - ✅ Subtotal de items
   - ✅ IVA aplicable
   - ✅ Descuentos globales
   - ✅ Total final

3. **Gestión de estado**
   - ✅ Persiste en DB
   - ✅ Genera ID único
   - ✅ Genera número de factura
   - ✅ Marca timestamp

4. **Integraciones**
   - ✅ Decrementa inventario
   - ✅ Actualiza cliente
   - ✅ Crea orden de trabajo si necesario
   - ✅ Crea orden de despacho si necesario

#### ⚠️ Faltantes o Incompletos

1. **Retención IR** (CRÍTICO)
   - ⚠️ Se define `retention_rate: 0.0` (siempre cero)
   - ⚠️ No se lee del cliente o configuración
   - ⚠️ No se aplica en cálculo de total

2. **Métodos de pago mixtos**
   - ⚠️ `mixed_payment_methods` se define vacío
   - ⚠️ No hay lógica para distribuir montos

3. **Validación de límites de descuento**
   - ✅ Existe `_enforce_seller_global_discount_limits()`
   - ⚠️ Pero NO valida por método de pago

4. **Créditos**
   - ✅ Valida límite
   - ⚠️ No crea documento de crédito formal
   - ⚠️ No integra con CreditsPage

5. **Validación de compatibilidad vehículo-producto**
   - ❌ NO EXISTE
   - Frontend tiene `checkCompatibility()`, backend NO

---

## 7. Soporte de Características

### 7.1 IVA (Impuesto al Valor Agregado)

**Estado**: 🟢 **IMPLEMENTADO**

```python
iva_rate_percent = await _get_billing_iva_rate()  # Obtiene del servidor
iva_rate_decimal = iva_rate_percent / 100.0
tax = subtotal * iva_rate_decimal
```

**Detalles**:
- ✅ Obtiene tasa del día (dynamic)
- ✅ Aplica a subtotal
- ✅ Se redondea a 2 decimales
- ✅ Se incluye en cálculo de total

**Verificación**: En archivo `server.py` alrededor de línea 4,800

---

### 7.2 Retención IR (Impuesto a la Renta)

**Estado**: 🔴 **NO IMPLEMENTADO**

```python
retention_rate: 0.0,              # SIEMPRE CERO
retention_amount: 0.0,
```

**Evidencia de falta de implementación**:
1. `retention_rate` se inicializa como `0.0` (hardcodeado)
2. No hay lectura de `_extract_retention_profile_from_customer()`
3. No se aplica en cálculo de `total`
4. Campo `retention_rate_hint` en SaleCommercialTermsUpdate pero no se usa en create_sale

**Impacto**: Las ventas NO están calculando retención IR según RNC/norma fiscal

---

### 7.3 Multi-Moneda

**Estado**: 🟡 **PARCIALMENTE IMPLEMENTADO**

```python
raw_sale_currency = getattr(sale_data, "currency", "USD")
sale_currency = _currency_code(raw_sale_currency)
raw_sale_exchange_rate = getattr(sale_data, "exchange_rate", None)
sale_exchange_rate = float(raw_sale_exchange_rate) if raw_sale_exchange_rate is not None else None
```

**Detalles**:
- ✅ Acepta `currency` (USD|NIO)
- ✅ Acepta `exchange_rate`
- ⚠️ SE ALMACENAN pero NO se usan en cálculos
- ⚠️ Los precios de items están siempre en USD
- ⚠️ Conversión se hace en FRONTEND, no en backend

**Problema crítico**: 
```python
# Prices are always from products (in USD)
price = product["price"]  # USD
# La venta se crea con precios en USD
# El exchange_rate se guarda pero NO se aplica en los cálculos
```

**Impacto**: El tipo de cambio es informativo, no funcional

---

### 7.4 Descuentos

**Estado**: 🟡 **PARCIALMENTE IMPLEMENTADO**

```python
total_discount = subtotal * (sale_data.discount / 100)
total = subtotal + tax - total_discount
```

**Detalles**:
- ✅ Aplica descuento global (%)
- ✅ Acepta descuentos por item
- ✅ Valida contra límites de vendedor (`_enforce_seller_global_discount_limits()`)
- ⚠️ Descuentos NO validados por método de pago
- ⚠️ NO hay integración con códigos de descuento
- ⚠️ NO hay validación de máximo descuento por cliente

**Funcionalidad de descuentos por código**: 
- ❌ Frontend: sí, tiene `applyDiscountCode()`
- ❌ Backend: NO, no hay endpoint `/discounts/validate`

---

### 7.5 Créditos

**Estado**: 🟡 **PARCIALMENTE IMPLEMENTADO**

```python
if sale_data.payment_type == "credit":
    available_credit = customer.get("credit_limit", 0) - customer.get("credit_balance", 0)
    if total > available_credit:
        raise HTTPException(400, "Exceeds credit limit")
    
    credit_due_date = datetime.now(timezone.utc) + timedelta(days=sale_data.credit_days)
    
    # Después de crear venta:
    await db.customers.update_one(
        {"customer_id": customer["customer_id"]},
        {"$inc": {"credit_balance": total}}
    )
```

**Detalles**:
- ✅ Valida límite de crédito
- ✅ Calcula fecha de vencimiento
- ✅ Incrementa saldo
- ⚠️ No crea documento formal de crédito
- ⚠️ No integra con CreditsPage para cobros
- ⚠️ No tiene seguimiento de pagos parciales

---

### 7.6 Métodos de Pago Mixtos

**Estado**: 🔴 **NO IMPLEMENTADO**

```python
# Existe el campo pero siempre vacío:
mixed_payment_methods: List[Dict[str, Any]] = []
```

**Evidencia**:
1. En schema `SaleCreate`: NO existe campo `mixed_payment_methods`
2. En modelo `Sale`: se define como `[]` pero nunca se modifica
3. No hay lógica para distribuir montos entre métodos
4. Frontend SalesPage.jsx tiene `mixedPaymentMethods` pero Backend NO lo procesa

**Impacto**: No se pueden crear ventas con múltiples métodos de pago (ej: 50% efectivo + 50% tarjeta)

---

## 8. Diferencias: Frontend vs Backend

### Matriz de Comparación

| Dato/Funcionalidad | Frontend Envía | Backend Procesa | Estado |
|-------------------|---|---|---|
| `customer_id` | ✅ Sí | ✅ Sí | ✅ OK |
| `vehicle_id` | ✅ Sí (opcional) | ✅ Sí | ✅ OK |
| `items[]` | ✅ Sí (con qty, price, discount) | ✅ Sí | ✅ OK |
| `paymentType` | ✅ Sí (cash\|card\|credit\|transfer\|stripe) | ✅ Parcial | ⚠️ GAP |
| `paymentType == "stripe"` | ✅ Sí, se procesa | ✅ No implementado | ❌ ERROR |
| `globalDiscount` | ✅ Sí (%) | ✅ Sí | ✅ OK |
| `currency` | ✅ Sí (USD\|NIO) | ✅ Se almacena | ⚠️ INFORMATIVO |
| `exchangeRate` | ✅ Sí (float) | ✅ Se almacena | ⚠️ INFORMATIVO |
| `applyIVA` | ✅ Sí (boolean) | ⚠️ Se aplica siempre | ⚠️ GAP |
| `applyRetention` | ✅ Sí (boolean) | ❌ No procesado | ❌ ERROR |
| `retentionRate` | ✅ Sí (%) | ❌ No procesado | ❌ ERROR |
| `discountCode` | ✅ Sí (string) | ❌ No procesado | ❌ ERROR |
| `appliedDiscounts[]` | ✅ Sí (array) | ❌ No procesado | ❌ ERROR |
| `mixedPaymentMethods[]` | ✅ Sí (array) | ❌ No procesado | ❌ ERROR |
| `creditDays` | ✅ Sí (int) | ✅ Sí | ✅ OK |
| `managerAuthorizationCode` | ✅ Sí (string) | ✅ Sí | ✅ OK |
| `selectedWarehouse` | ✅ Sí (por item) | ✅ Sí | ✅ OK |

---

## 9. Endpoints Dependientes de Servicio de Ventas

### 9.1 Endpoints Directos

| Endpoint | Método | Ubicación | Propósito | Estado |
|----------|--------|-----------|----------|--------|
| `/api/sales` | POST | server.py:~4,700 | Crear venta | ✅ Implementado |
| `/api/sales/{sale_id}` | GET | server.py | Obtener venta | ✅ Implementado |
| `/api/sales/preview-settlement` | POST | server.py | Preview cálculos | ✅ Implementado |
| `/api/sales/{sale_id}/commercial-terms` | PATCH | server.py | Actualizar términos | ✅ Implementado |

### 9.2 Endpoints Relacionados (Dependencias Inversas)

| Recurso | Endpoint | Acciona sobre | Relación |
|---------|----------|----------------|----------|
| Inventario | `POST /inventory/transfer-request` | Solicita traslado desde venta | Consumidor de sales |
| Órdenes de Trabajo | `POST /work_orders` | Generado automáticamente desde venta | Dependiente |
| Órdenes de Despacho | `POST /dispatch` | Generado automáticamente desde venta | Dependiente |
| Caja | `POST /caja/close-session` | Toma ventas de sesión | Consumidor |
| Aprobaciones | `POST /approvals` | Solicita aprobación de venta | Consumidor |
| Créditos | `GET /credits/{customer_id}` | Valida límite de crédito | Consumidor |
| Notificaciones | `POST /notifications` | Emite eventos de venta | Dependiente |
| Auditoría | `POST /audit-logs` | Registra creación de venta | Dependiente |

### 9.3 Endpoints que Llaman a Funciones de venta_service.py

**En la aplicación actual**: ⚠️ NINGUNO

Porque `venta_service.py` solo tiene stubs. La lógica está en `server.py`.

**Funciones que DEBERÍAN estar en venta_service.py**:
1. `update_venta_status()` - Usada por approval_service.py (línea 16)
2. `generate_token_autorizacion()` - Usada por approval_service.py (línea 24)

**Problemas**:
- `update_venta_status()` es `pass` - no hace nada
- Se llamaría si se aprueba una solicitud, pero no actualiza la venta real

---

## 10. Errores Críticos que Impiden Crear Venta Real

### 🔴 CRÍTICO 1: Retención IR = 0 Siempre

```python
retention_rate: 0.0,              # ❌ HARDCODEADO
retention_amount: 0.0,
```

**Problema**: Las ventas nunca tienen retención IR, aunque la ley puede requerirla.

**Impacto en usuario**: 
- Facturas con totales incorrectos según normativa RNC
- Auditoría fiscal fallará
- Reportes de retención incompletos

---

### 🔴 CRÍTICO 2: Descuentos por Código NO Soportado

Frontend envía:
```javascript
const [appliedDiscounts, setAppliedDiscounts] = useState([])
```

Backend recibe pero IGNORA:
```python
# NO existe en SaleCreate schema
# NO hay lectura de descuentos.code
# NO hay validación con base de datos
```

**Problema**: Si usuario aplica código de descuento en frontend, se pierde en backend.

**Impacto**: Descuentos no se aplican realmente.

---

### 🔴 CRÍTICO 3: Métodos de Pago Mixtos NO Soportados

Frontend envía:
```javascript
const [mixedPaymentMethods, setMixedPaymentMethods] = useState([])
```

Backend NO procesa:
```python
# SaleCreate no tiene campo mixed_payment_methods
# No hay lógica de distribución de montos
```

**Problema**: No se pueden hacer ventas como "50% efectivo + 50% tarjeta"

**Impacto**: Solo un método de pago por venta.

---

### 🔴 CRÍTICO 4: paymentType Stripe NO Implementado

Frontend intenta:
```javascript
if (paymentType === "stripe") {
    POST /payments/checkout { sale_id, origin_url }
}
```

Backend crea venta pero:
```python
# Endpoint /payments/checkout NO existe en server.py
# No hay integración con Stripe SDK
# payment_status se marca como "pending" siempre para stripe
```

**Problema**: Las ventas Stripe NO se pueden procesar realmente.

**Impacto**: Usuarios no pueden completar pagos con tarjeta.

---

### 🟠 GRAVE 5: Compatibilidad Vehículo-Producto NO Validada

Frontend intenta:
```javascript
GET /products/:id/check-compatibility/:vehicleId
```

Backend:
```python
# Endpoint NO existe en server.py
# No hay validación en create_sale()
```

**Problema**: Se pueden vender accesorios incompatibles con vehículo.

**Impacto**: Devoluciones de clientes, quejas de compatibilidad.

---

### 🟠 GRAVE 6: IVA "Opcional" Pero Siempre Se Aplica

Frontend envía:
```javascript
const [applyIVA, setApplyIVA] = useState(true)
```

Backend ignora:
```python
# SaleCreate no tiene campo apply_iva
# El IVA siempre se aplica
tax = subtotal * iva_rate_decimal  # Sin condicional
```

**Problema**: Usuario marca "no aplicar IVA" pero se aplica igual.

**Impacto**: Discrepancia entre lo que usuario ve y lo que se crea.

---

### 🟠 GRAVE 7: update_venta_status() No Hace Nada

En `approval_service.py`:
```python
update_venta_status(approval.sale_id, "APPROVED")
```

En `venta_service.py`:
```python
def update_venta_status(sale_id: str, status: str):
    pass  # ❌ NO HACE NADA
```

**Problema**: Si se aprueba una solicitud de edición/anulación, la venta NO se actualiza.

**Impacto**: Flujo de aprobaciones roto.

---

### 🟠 GRAVE 8: Conversión de Moneda Almacenada Pero No Usada

```python
sale_exchange_rate = float(raw_sale_exchange_rate)
# ... se almacena en doc ...
doc["exchange_rate"] = sale_exchange_rate
# ... pero NO se usa en cálculos

# Los precios de items están SIEMPRE en USD
price = product["price"]  # USD
item_subtotal = (price * qty) * (1 - discount / 100)  # USD
```

**Problema**: El tipo de cambio es informativo, no funcional.

**Impacto**: Ventas en NIO tienen precios incorrectos.

---

## 11. Funciones Incompletas o Vacías en venta_service.py

| Función | Líneas | Estado | Impacto |
|---------|--------|--------|--------|
| `update_venta_status()` | 3-4 | 🔴 Vacía (pass) | Aprobaciones no funcionan |
| `generate_token_autorizacion()` | 6-7 | 🟢 Implementada | Genera UUID, OK |

---

## 12. Matriz Comparativa: Funcionalidad Frontend vs Backend

| Funcionalidad | Frontend | Backend | Estado | Severidad |
|---|---|---|---|---|
| Crear venta básica | ✅ Envía | ✅ Procesa | ✅ OK | - |
| Validar cliente | ✅ UI | ✅ Valida DB | ✅ OK | - |
| Validar productos | ✅ UI | ✅ Valida DB | ✅ OK | - |
| Validar stock | ✅ Aviso | ✅ Rechaza | ✅ OK | - |
| IVA aplicable | ✅ Toggle | ❌ Ignorado | ❌ FALLA | 🔴 CRÍTICO |
| Retención IR | ✅ Toggle + % | ❌ Ignorado | ❌ FALLA | 🔴 CRÍTICO |
| Descuentos globales | ✅ % | ✅ Calcula | ✅ OK | - |
| Descuentos por código | ✅ Aplica | ❌ Ignora | ❌ FALLA | 🔴 CRÍTICO |
| Pago Stripe | ✅ Flujo | ❌ No implementado | ❌ FALLA | 🔴 CRÍTICO |
| Pago crédito | ✅ UI | ✅ Valida + incrementa | ✅ PARCIAL | 🟡 |
| Pago mixto | ✅ UI | ❌ No soportado | ❌ FALLA | 🔴 CRÍTICO |
| Multi-moneda | ✅ Selecciona | ✅ Almacena | ⚠️ INFORMATIVO | 🟡 |
| Compatibilidad vehículo | ✅ Valida | ❌ No existe endpoint | ❌ FALLA | 🟠 GRAVE |
| Autorización gerencial | ✅ Flujo completo | ✅ Valida código | ✅ OK | - |
| Órdenes de trabajo | ✅ Espera | ✅ Auto-genera | ✅ OK | - |
| Órdenes de despacho | ✅ Espera | ✅ Auto-genera | ✅ OK | - |
| Borradores persistentes | ✅ Sincroniza | ❌ No integrado | ❌ FALLA | 🟠 GRAVE |

---

## 13. Análisis de Riesgos

### Riesgo Nivel 1: BLOQUEADOR

- ❌ **Retención IR**: Sistema de tributación incompleto
- ❌ **Descuentos por código**: Función anunciada pero no funciona
- ❌ **Métodos mixtos**: Función anunciada pero no funciona
- ❌ **Stripe**: Sistema de pago anunciado pero no implementado
- ❌ **update_venta_status()**: Función crítica es un stub

### Riesgo Nivel 2: FUNCIONAL

- ⚠️ **Compatibilidad vehículo**: Validación faltante
- ⚠️ **Multi-moneda**: Conversión no aplicada
- ⚠️ **IVA configurable**: Siempre se aplica
- ⚠️ **Borradores**: No persisten en backend

### Riesgo Nivel 3: DATA

- ⚠️ **Créditos**: Sin documento formal
- ⚠️ **Descuentos**: Sin auditoría centralizada
- ⚠️ **Cambio**: No se maneja en ventas en efectivo

---

## 14. Conclusiones y Recomendaciones

### Estado General

**Calificación**: 🟡 **OPERACIONAL CON GAPS CRÍTICOS**

La funcionalidad básica de crear ventas funciona (clientes, productos, inventario, órdenes de trabajo). Sin embargo, hay **5 características críticas anunciadas en el frontend que NO funcionan en el backend**:

1. Retención IR
2. Descuentos por código
3. Métodos de pago mixtos
4. Pago Stripe
5. Conversión de moneda

### Arquitectura

**Problema**: `venta_service.py` es un placeholder. Toda la lógica está en `server.py` (~700 líneas en una función).

**Recomendación**: 
- Refactorizar `create_sale()` en `venta_service.py`
- Implementar funciones modulares: `validate_sale()`, `calculate_sale_totals()`, `process_inventory()`, etc.

### Prioridades de Corrección

1. 🔴 **URGENTE**: Implementar `update_venta_status()` en venta_service.py
2. 🔴 **URGENTE**: Implementar Retención IR
3. 🔴 **URGENTE**: Implementar validación de compatibilidad vehículo
4. 🟠 **IMPORTANTE**: Implementar descuentos por código
5. 🟠 **IMPORTANTE**: Implementar métodos de pago mixtos
6. 🟠 **IMPORTANTE**: Implementar integración Stripe

---

**Generado**: 2025-01-15  
**Versión**: 1.0  
**Alcance**: Análisis Completo Backend - Servicio de Ventas
