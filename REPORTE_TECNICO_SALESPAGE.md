# Reporte Técnico: SalesPage.jsx

**Archivo**: `frontend/src/pages/SalesPage.jsx`  
**Tipo**: Página React Funcional (Hook-based)  
**Última modificación**: 2026-05-08 (backup disponible)  
**Líneas de código**: ~2,500+  
**Complejidad**: Muy Alta

---

## 1. Descripción Funcional Completa

### Propósito Principal
`SalesPage` es la página central de gestión de ventas del ERP. Implementa un sistema completo de:
- **Creación de ventas** con soporte para múltiples monedas (NIO/USD)
- **Gestión de borradores** (drafts) con sincronización servidor-cliente
- **Carrito de compras** con cálculo de totales, descuentos e IVA
- **Tablero de control** con vista de borradores, facturas abiertas y cerradas
- **Gestión de clientes** (creación inline durante venta)
- **Gestión de vehículos** (compatibilidad, transferencia de stock, consulta de vehículos del cliente)
- **Autorización gerencial** para productos "solo para llevar"
- **Operaciones de factura** (impresión, descarga, WhatsApp, edición, anulación)

### Características Principales
1. **Soporte Multi-Moneda**: Conversión NIO ↔ USD en tiempo real
2. **Sistema de Borradores Persistentes**: Sincronización bidireccional servidor-cliente
3. **Cálculo de Totales Avanzado**: Descuentos por código, descuentos globales, retención IR, IVA
4. **Validaciones de Compatibilidad**: Productos vs vehículos
5. **Control de Inventario**: Verificación de stock, solicitudes de traslado
6. **Autorización Multi-nivel**: Gerentes pueden autorizar y anular facturas
7. **Interfaz Responsive**: Adaptación a desktop/tablet/mobile con tabs
8. **Historial de Sincronización**: Estados de guardado automático (saving, saved, error)

---

## 2. Componentes Importados

### UI Components (shadcn/ui)
```javascript
Card, CardContent, CardHeader, CardTitle          // Contenedores principales
Button, Input, Badge, Label                        // Elementos de formulario
Select, SelectContent, SelectItem, SelectTrigger, SelectValue // Seleccionadores
Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
Checkbox, Separator, Switch, ScrollArea            // Controles adicionales
Tabs, TabsContent, TabsList, TabsTrigger          // Navegación por pestañas
SearchableSelect                                   // Selecciones con búsqueda
```

### Icons (lucide-react)
```javascript
FilePlus2, Search, CreditCard, Printer, Download, RefreshCw, Wrench, Package
ShieldCheck, Car, XCircle, User, Truck, Tag, Percent, ArrowRightLeft
Building2, Eye, Eraser, Save
```

### Context y Utilities
```javascript
useAuth()                                           // Autenticación y permisos
formatCurrency, formatDate, getStatusColor, PAYMENT_TYPES // Utilidades de formato
cn()                                                // Concatenación de clases
```

### Librerías Externas
```javascript
axios                                               // Solicitudes HTTP
sonner (toast)                                      // Notificaciones
```

### Componentes Personalizados
```javascript
SaleForm                                            // Formulario embebido de ventas
```

---

## 3. Hooks Utilizados

### React Hooks Standard
```javascript
useCallback()       // Memorización de funciones (syncDraftToServer, createDraftTab)
useEffect()         // Efectos secundarios (múltiples)
useMemo()           // Memorización de valores computados (filteredCustomers, etc.)
useRef()            // Referencias (draftTabsRef, draftSyncTimersRef)
useState()          // Gestión de estado (25+ estados)
```

### Hooks Personalizados
```javascript
useAuth()           // Acceso a autenticación y permisos
```

---

## 4. Estados (useState)

### Datos Principales
```javascript
const [sales, setSales] = useState([])              // Lista de ventas del servidor
const [customers, setCustomers] = useState([])      // Lista de clientes
const [products, setProducts] = useState([])        // Catálogo de productos
const [warehouses, setWarehouses] = useState([])    // Bodegas disponibles
const [vehicles, setVehicles] = useState([])        // Vehículos registrados
const [inventory, setInventory] = useState([])      // Inventario de bodegas
const [sellers, setSellers] = useState([])          // Lista de vendedores
const [branches, setBranches] = useState([])        // Sucursales
```

### Estados de Carga
```javascript
const [loading, setLoading] = useState(true)        // Carga inicial
const [isRefreshingData, setIsRefreshingData] = useState(false) // Refresco manual
```

### Búsqueda y Filtrado
```javascript
const [search, setSearch] = useState("")            // Búsqueda por factura/cliente
const [filterPayment, setFilterPayment] = useState("all")  // Filtro tipo pago
const [filterStatus, setFilterStatus] = useState("all")    // Filtro estado
const [filterSeller, setFilterSeller] = useState("all")    // Filtro vendedor
const [filterBranch, setFilterBranch] = useState("all")    // Filtro sucursal
const [customerSearch, setCustomerSearch] = useState("")   // Búsqueda de clientes
const [productSearch, setProductSearch] = useState("")     // Búsqueda de productos
```

### Formulario de Venta (Borrador Activo)
```javascript
const [selectedCustomer, setSelectedCustomer] = useState(null)
const [selectedVehicle, setSelectedVehicle] = useState("")
const [selectedWarehouse, setSelectedWarehouse] = useState("")
const [cartItems, setCartItems] = useState([])
const [paymentType, setPaymentType] = useState("cash")
const [mixedPaymentMethods, setMixedPaymentMethods] = useState([])
const [globalDiscount, setGlobalDiscount] = useState(0)
const [creditDays] = useState(30)                   // Constante (no modificable)
const [deliveryRequired] = useState(false)          // Constante
const [deliveryAddress] = useState("")              // Constante
const [notes, setNotes] = useState("")
```

### Tributación y Moneda
```javascript
const [applyIVA, setApplyIVA] = useState(true)
const [applyRetention, setApplyRetention] = useState(false)
const [retentionRate, setRetentionRate] = useState(2)
const [ivaRate, setIvaRate] = useState(DEFAULT_IVA_RATE)
const [currency, setCurrency] = useState("NIO")
const [exchangeRate, setExchangeRate] = useState(DEFAULT_USD_NIO_RATE)
const [effectiveIvaRate, setEffectiveIvaRate] = useState(DEFAULT_IVA_RATE)
```

### Descuentos
```javascript
const [discountCode, setDiscountCode] = useState("")
const [appliedDiscounts, setAppliedDiscounts] = useState([])
```

### Autorización de Gerente
```javascript
const [showAuthDialog, setShowAuthDialog] = useState(false)
const [authProducts, setAuthProducts] = useState([])
const [managerAuthCode, setManagerAuthCode] = useState("")
```

### Transferencia de Inventario
```javascript
const [showTransferDialog, setShowTransferDialog] = useState(false)
const [transferProduct, setTransferProduct] = useState(null)
const [transferFromWarehouse, setTransferFromWarehouse] = useState("")
```

### Advertencias
```javascript
const [compatibilityWarnings, setCompatibilityWarnings] = useState([])
```

### Nuevo Cliente
```javascript
const [showNewCustomer, setShowNewCustomer] = useState(false)
const [newCustomerTab, setNewCustomerTab] = useState("customer")
const [newCustomer, setNewCustomer] = useState({...})  // Objeto con 14 propiedades
```

### UI y Control
```javascript
const [showNewSale, setShowNewSale] = useState(true)  // Mostrar/ocultar formulario
const [saleFormRenderNonce, setSaleFormRenderNonce] = useState(0)  // Forzar re-render
```

### Borradores (Drafts)
```javascript
const [draftTabs, setDraftTabs] = useState([])
const [activeDraftId, setActiveDraftId] = useState(null)
const [draftsLoaded, setDraftsLoaded] = useState(false)
const [showArchivedSales, setShowArchivedSales] = useState(false)
const [draftSaveState, setDraftSaveState] = useState("idle")  // idle|saving|saved|error
const [draftSavedAt, setDraftSavedAt] = useState(null)
```

### Diálogos de Impresión
```javascript
const [showPrintPrompt, setShowPrintPrompt] = useState(false)
const [showClearSaleConfirm, setShowClearSaleConfirm] = useState(false)
const [printSaleData, setPrintSaleData] = useState(null)
```

### Navegación
```javascript
const [boardTab, setBoardTab] = useState("drafts")  // drafts|open|closed
```

---

## 5. Efectos (useEffect)

### Efecto 1: Limpieza de Drafts Heredados
```javascript
useEffect(() => {
  // Limpia claves de localStorage de drafts heredados (legacy)
  // Se ejecuta una sola vez al montar
  // Dependencias: [LEGACY_DRAFT_ACTIVE_KEY, LEGACY_DRAFT_LIST_KEY, LEGACY_DRAFT_PREFIX, userDraftScopeToken]
}, [LEGACY_DRAFT_ACTIVE_KEY, LEGACY_DRAFT_LIST_KEY, LEGACY_DRAFT_PREFIX, userDraftScopeToken]);
```

### Efecto 2: Cargar Datos Iniciales
```javascript
useEffect(() => {
  fetchData();  // Se ejecuta al montar
}, []);
```

### Efecto 3: Emit Autosave Status
```javascript
useEffect(() => {
  emitAutosaveStatus(AUTOSAVE_STATUS.SYNCED, { source: "sales" });
  return () => {
    emitAutosaveStatus(AUTOSAVE_STATUS.SYNCED, { source: "sales" });
  };
}, []);
```

### Efecto 4: Refresh Automático de Tasas (Cada 30s)
```javascript
useEffect(() => {
  // Obtiene tasa de cambio USD->NIO e IVA efectivo cada 30 segundos
  // Dependencias: []
  refreshRate() // Promise.all([fetchEffectiveUsdNioRate, fetchEffectiveIvaRate])
}, []);
```

### Efecto 5: Cargar Borradores del Servidor
```javascript
useEffect(() => {
  // Sincroniza borradores del servidor a localStorage
  // Maneja fallback a localStorage si el servidor no está disponible
  // Emite estado RECOVERING -> SYNCED o DISCONNECTED
  // Dependencias: [DRAFT_ACTIVE_KEY, DRAFT_FLOW, DRAFT_KEY_PREFIX, DRAFT_LIST_KEY, userDraftScopeToken]
}, [DRAFT_ACTIVE_KEY, DRAFT_FLOW, DRAFT_KEY_PREFIX, DRAFT_LIST_KEY, userDraftScopeToken]);
```

### Efecto 6: Persistencia de Tab List en localStorage
```javascript
useEffect(() => {
  // Guarda draftTabs en localStorage cada vez que cambia
  // Solo si draftsLoaded === true
  // Dependencias: [DRAFT_LIST_KEY, draftTabs, draftsLoaded]
}, [DRAFT_LIST_KEY, draftTabs, draftsLoaded]);
```

### Efecto 7: Persistencia de Active Draft ID
```javascript
useEffect(() => {
  // Guarda el ID del borrador activo en localStorage
  // Solo si draftsLoaded === true
  // Dependencias: [DRAFT_ACTIVE_KEY, activeDraftId, draftsLoaded]
}, [DRAFT_ACTIVE_KEY, activeDraftId, draftsLoaded]);
```

### Efecto 8: Mantener draftTabsRef Actualizado
```javascript
useEffect(() => {
  draftTabsRef.current = draftTabs;
}, [draftTabs]);
```

### Efecto 9: Limpiar Timers de Sincronización
```javascript
useEffect(() => {
  return () => {
    draftSyncTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    draftSyncTimersRef.current.clear();
  };
}, []);
```

### Efecto 10: Sincronizar Active Draft ID al Servidor
```javascript
useEffect(() => {
  if (!draftsLoaded) return;
  setServerDraftActive(DRAFT_FLOW, activeDraftId).catch(() => {
    // keep local state if server sync fails
  });
}, [DRAFT_FLOW, activeDraftId, draftsLoaded]);
```

### Efecto 11: Sincronizar Estado de SalesPage con Borrador Activo
```javascript
useEffect(() => {
  // Cuando cambia el activeDraftId, carga el borrador del storage
  // y sincroniza los estados de la página (customer, vehicle, cart, etc.)
  // Dependencias: [activeDraftId, customers]
}, [activeDraftId, customers]);
```

### Efecto 12: Restaurar Visibilidad del Formulario
```javascript
useEffect(() => {
  // Lee del localStorage si el formulario debe estar visible
  // Solo se ejecuta si user y window existen
  // Dependencias: [formVisibilityStorageKey, user]
}, [formVisibilityStorageKey, user]);
```

### Efecto 13: Persistencia de Visibilidad del Formulario
```javascript
useEffect(() => {
  // Guarda estado de visibilidad del formulario en localStorage
  // Dependencias: [formVisibilityStorageKey, showNewSale, user]
}, [formVisibilityStorageKey, showNewSale, user]);
```

### Efecto 14: Creación Automática de Primer Borrador
```javascript
useEffect(() => {
  if (!draftsLoaded || !showNewSale || !canCreateSales) return;
  if (activeDraftId) return;
  createDraftTab();  // Crea un borrador si no hay uno activo
}, [activeDraftId, canCreateSales, createDraftTab, draftsLoaded, showNewSale]);
```

### Efecto 15: Refresco Periódico y en Foco
```javascript
useEffect(() => {
  // Refresca datos cada 30 segundos
  // También refresca cuando ventana recibe foco (focus event)
  // Dependencias: [fetchData]
  const intervalId = window.setInterval(refreshData, 30000);
  window.addEventListener("focus", refreshData);
  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener("focus", refreshData);
  };
}, [fetchData]);
```

### Efecto 16: Retorno de Catálogo al Formulario de Venta
```javascript
useEffect(() => {
  if (!draftsLoaded) return;
  if (typeof window === "undefined") return;
  const flag = window.localStorage.getItem("catalog_open_draft");
  if (flag !== "sale") return;
  openActiveDraft();
  window.localStorage.removeItem("catalog_open_draft");
}, [draftsLoaded, openActiveDraft]);
```

---

## 6. Llamadas API Identificadas

### 6.1 Endpoints de Lectura (GET)

| Endpoint | Método | Propósito | Fallback |
|----------|--------|----------|---------|
| `/sales` | GET | Obtener todas las ventas | No |
| `/customers` | GET | Obtener lista de clientes | No |
| `/products` | GET | Obtener catálogo de productos | No |
| `/warehouses` | GET | Obtener bodegas disponibles | `{ data: [] }` |
| `/vehicles` | GET | Obtener vehículos registrados | No |
| `/inventory` | GET | Obtener inventario de bodegas | `{ data: [] }` |
| `/users` | GET | Obtener lista de usuarios | `{ data: [] }` |
| `/branches` | GET | Obtener sucursales | `{ data: [] }` |
| `/products/:id/check-compatibility/:vehicleId` | GET | Verificar compatibilidad producto-vehículo | Retorna `{ compatible: true }` |
| `/print/invoice-pdf/:saleId` | GET | Obtener PDF de factura | Error toast |
| `/print/thermal/:saleId` | GET | Obtener formato térmico (80mm) | Error toast |
| `/sales/:id/pdf` | GET | Descargar PDF de venta | Fallback a TXT |
| `/auth/me` | GET | Obtener usuario autenticado | (AuthContext) |
| `/permissions/me` | GET | Obtener permisos del usuario | (AuthContext) |
| `/drafts/backup` | GET | Recuperar backup de borradores | (AuthContext) |

### 6.2 Endpoints de Escritura (POST)

| Endpoint | Método | Propósito | Payload |
|----------|--------|----------|---------|
| `/sales` | POST | Crear nueva venta | `{ customer_id, vehicle_id, items[], discount, payment_type, currency, ... }` |
| `/payments/checkout` | POST | Generar sesión Stripe | `{ sale_id, origin_url }` |
| `/inventory/transfer-request` | POST | Solicitar traslado de inventario | `{ product_id, from_warehouse_id, to_warehouse_id, quantity, reason }` |
| `/auth/manager/generate-code` | POST | Generar código de autorización gerencial | Sin body |
| `/sales/:id/requests/edit` | POST | Solicitar edición de factura | `{ reason }` |
| `/sales/:id/requests/cancel` | POST | Solicitar anulación de factura | `{ reason }` |
| `/caja/facturas/:id/anular` | POST | Anular factura directamente (gerencia) | `{ motivo, justificacion_interna, autorizado_por }` |
| `/customers` | POST | Crear nuevo cliente | `{ name, first_name, last_name, tax_id, email, phone, address, credit_limit }` |
| `/vehicles` | POST | Crear nuevo vehículo | `{ customer_id, plate, brand, model, year, color, vin }` |
| `/drafts/backup` | POST | Guardar backup de borradores | `{ entries[] }` |

### 6.3 Endpoints Personalizados (Server Drafts)

| Función | Endpoint Base | Propósito |
|---------|---------------|----------|
| `fetchServerDraftBundle(flow)` | `/drafts/:flow/bundle` | Obtener todos los borradores de un flujo |
| `saveServerDraft(flow, id, data)` | `/drafts/:flow/:id` | Guardar/actualizar un borrador |
| `deleteServerDraft(flow, id)` | `/drafts/:flow/:id` | Eliminar un borrador |
| `setServerDraftActive(flow, id)` | `/drafts/:flow/:id/active` | Marcar como borrador activo |

### 6.4 Tasa de Cambio e IVA

| Función | Origen | Propósito |
|---------|--------|----------|
| `fetchEffectiveUsdNioRate()` | `lib/exchangeRate.js` | Obtener tasa USD->NIO actual |
| `fetchEffectiveIvaRate()` | `lib/taxRate.js` | Obtener IVA vigente |

---

## 7. Endpoints Consumidos

### Categoría: Ventas
- **POST `/sales`**: Crear venta → `response: { sale_id, invoice_number, requires_manager_auth?, work_order_id? }`
- **GET `/sales`**: Listar ventas (con filtros incluidos)

### Categoría: Clientes
- **GET `/customers`**: Listar todos los clientes
- **POST `/customers`**: Crear cliente → `response: { customer_id }`

### Categoría: Vehículos
- **GET `/vehicles`**: Listar vehículos registrados
- **POST `/vehicles`**: Registrar nuevo vehículo
- **GET `/products/:id/check-compatibility/:vehicleId`**: Validar compatibilidad

### Categoría: Productos e Inventario
- **GET `/products`**: Catálogo completo de productos
- **GET `/inventory`**: Estado de inventario por warehouse
- **GET `/warehouses`**: Listar bodegas
- **POST `/inventory/transfer-request`**: Solicitar traslado

### Categoría: Facturación y Caja
- **POST `/caja/facturas/:id/anular`**: Anular factura (gerencia/RRHH)
- **POST `/sales/:id/requests/edit`**: Solicitar edición
- **POST `/sales/:id/requests/cancel`**: Solicitar anulación

### Categoría: Impresión
- **GET `/print/invoice-pdf/:saleId`**: PDF completo de factura
- **GET `/print/thermal/:saleId`**: Formato térmico 80mm
- **GET `/sales/:saleId/pdf`**: Descarga alternativa PDF

### Categoría: Autorización
- **POST `/auth/manager/generate-code`**: Generar código de gerente

### Categoría: Pagos
- **POST `/payments/checkout`**: Crear sesión de pago Stripe

### Categoría: Usuarios y Permisos
- **GET `/users`**: Listar usuarios (filtro: role == ventas|gerencia)
- **GET `/branches`**: Listar sucursales

### Categoría: Borradores (Draft Management)
- **GET `/drafts/:flow/bundle`**: Recuperar borradores (flow = "sale")
- **POST `/drafts/:flow/:id`**: Guardar borrador
- **DELETE `/drafts/:flow/:id`**: Eliminar borrador
- **POST `/drafts/:flow/:id/active`**: Marcar como activo

---

## 8. Dependencias

### 8.1 Clientes (`customers`)
**Cómo se obtiene**: `GET /customers` (fetchData)  
**Usado en**:
- Búsqueda y filtrado de clientes en carrito
- Selección de cliente para venta
- Creación de nuevo cliente
- Resolución de nombres en vista previa de borradores
- Resolución de teléfono para envío por WhatsApp
- Validación de cliente seleccionado antes de crear venta

**Estructura esperada**:
```javascript
{
  customer_id: string|number,
  name: string,
  first_name: string,
  last_name: string,
  customer_type: string,        // "natural" o "empresa"
  tax_id: string,
  email: string,
  phone: string,
  address: string,
  credit_limit: number
}
```

**Relación**: 1:N (un cliente puede tener múltiples ventas y vehículos)

---

### 8.2 Cotizaciones (`quotes`)
**Mención**: No se consume directamente en SalesPage  
**Nota**: Existe página separada `QuotationsPage.jsx` para gestión de cotizaciones  
**Posible relación**: Una venta puede generarse desde una cotización (no implementado en SalesPage)

---

### 8.3 Inventario (`inventory`)
**Cómo se obtiene**: `GET /inventory` (fallback: `{ data: [] }`)  
**Usado en**:
- Verificación de stock antes de agregar producto al carrito
- Cálculo de stock disponible por warehouse
- Solicitud de traslado entre warehouses cuando hay stock en otro lugar
- Validación de cantidad máxima en carrito

**Estructura esperada**:
```javascript
{
  product_id: string|number,
  warehouse_id: string|number,
  quantity: number
}
```

**Métodos de consulta**:
- `getProductStock(productId, warehouseId)`: Obtiene cantidad en warehouse específico
- `getOtherWarehouseStock(productId, currentWarehouseId)`: Obtiene stock en otros warehouses

**Flujo crítico**:
```
Agregar producto → Verificar stock en warehouse seleccionado
  ├─ Si hay stock: Agregar al carrito
  ├─ Si NO hay pero existe en otro: Mostrar diálogo de traslado
  └─ Si NO hay en ningún lado: Mostrar toast de error
```

---

### 8.4 Caja (`cash_session`)
**Cómo se obtiene**: Implícitamente en `/sales` (vendidas con `cash_session_id`)  
**Usado en**:
- Filtrado de facturas "abiertas en caja" (invoiceState == "open" o cash_session_id existe)
- Determinación de cierre de sesión de caja

**Estructura esperada** (en venta):
```javascript
{
  sale_id: string|number,
  cash_session_id: string|number,
  invoice_state: string,        // "open", "closed", "cancelled"
  payment_status: string,       // "pending", "paid"
  created_at: ISO8601_string
}
```

**Tablero**: "FACTURAS ABIERTAS EN CAJA" muestra ventas donde:
- `invoice_state !== "cancelled"` AND
- (`invoice_state === "open"` OR (`cash_session_id` existe AND `payment_status !== "paid"`))

---

### 8.5 Créditos (`credits`)
**Cómo se obtiene**: No se consulta directamente  
**Usado en**:
- Selección de método de pago: `paymentType === "credit"`
- Asignación de plazo: `credit_days: paymentType === "credit" ? 30 : null`
- Validación de límite de crédito en cliente (si aplicara en backend)

**Flujo de crédito**:
1. Usuario selecciona "Crédito" como payment_type
2. Sistema establece credit_days = 30 (hardcoded)
3. Backend valida límite de crédito disponible
4. Venta se crea con `payment_type: "credit"`

---

### 8.6 Aprobaciones (`manager_authorization`)
**Cómo se obtiene**: Respuesta del servidor al intentar crear venta  
**Usado en**:
- Validación de "Solo para llevar": Si `response.data.requires_manager_auth === true`
- Diálogo de autorización: Muestra lista de productos en `authProducts`
- Autorización: Usuario gerente genera código, vendedor lo ingresa

**Flujo de autorización**:
```
Crear Venta
  ├─ Backend valida productos "solo para llevar"
  ├─ Si requiere autorización:
  │  ├─ Mostrar diálogo con lista de productos
  │  ├─ Usuario gerente genera código: POST /auth/manager/generate-code
  │  ├─ Vendedor ingresa código en diálogo
  │  ├─ Reintentar venta con `manager_authorization_code: code`
  └─ Si OK: Venta creada, mostrar invoice_number
```

**Estructura esperada** (respuesta):
```javascript
{
  requires_manager_auth: boolean,
  products: [
    { product_id, product_name, reason }
  ]
}
```

---

## 9. Flujo Completo de una Venta

### Fase 1: Inicialización (Montaje de Página)

```
1. Cargar datos iniciales
   ├─ GET /sales, /customers, /products, /warehouses, /vehicles, /inventory, /users, /branches
   └─ Inicializar estado de página

2. Cargar borradores desde servidor
   ├─ GET /drafts/sale/bundle
   ├─ Sincronizar a localStorage
   ├─ Establecer drafts y active draft
   └─ Emitir estado SYNCED o DISCONNECTED

3. Refresco automático cada 30s
   ├─ Fetch datos
   ├─ Fetch tasa de cambio USD->NIO
   └─ Fetch IVA vigente
```

### Fase 2: Selección de Cliente

```
Opción A: Cliente Existente
  1. Usuario escribe en campo de búsqueda de cliente
  2. Se filtran clientes: customers.filter(c => 
       c.name.includes(search) || c.phone.includes(search) || c.tax_id.includes(search))
  3. Usuario selecciona cliente de lista
  4. setSelectedCustomer(customer)
  5. Se cargan vehículos del cliente: vehicles.filter(v => v.customer_id === customer.customer_id)

Opción B: Cliente Nuevo
  1. Usuario hace clic en "Crear nuevo cliente"
  2. Abre diálogo con tabs: "Cliente" y "Vehículo"
  3. Ingresa datos del cliente (nombre, teléfono, etc.)
  4. Opcionalmente agrega vehículo (marca, modelo, año, placa, color, VIN)
  5. POST /customers { name, first_name, last_name, tax_id, email, phone, ... }
  6. Cliente creado: setCustomers([...customers, newCustomer])
  7. Si agreg vehículo: POST /vehicles { customer_id, plate, brand, model, year, color, vin }
  8. setSelectedCustomer(newCustomer)
```

### Fase 3: Selección de Vehículo (Opcional)

```
1. Si cliente tiene vehículos registrados:
   ├─ Mostrar selector de vehículos del cliente
   └─ Usuario selecciona o deja vacío
2. setSelectedVehicle(vehicleId)
3. Si se selecciona vehículo:
   └─ Se usa para validar compatibilidad de productos
```

### Fase 4: Adición de Productos al Carrito

```
1. Usuario ingresa en búsqueda de producto
   └─ filteredProducts = products.filter(p => p.name.includes(search) || p.sku.includes(search))

2. Usuario hace clic en "Agregar" para un producto
   ├─ Verificar stock: getProductStock(product.product_id, selectedWarehouse)
   │  ├─ Si stock > 0:
   │  │  ├─ Si vehículo seleccionado: GET /products/:id/check-compatibility/:vehicleId
   │  │  ├─ Si incompatible: Mostrar warning (toast + lista)
   │  │  ├─ Agregar al carrito o incrementar cantidad
   │  │  └─ setCartItems([...cartItems, newItem] o update cantidad)
   │  │
   │  ├─ Si stock = 0 pero existe en otro warehouse:
   │  │  ├─ Mostrar diálogo de traslado
   │  │  ├─ Usuario selecciona warehouse origen
   │  │  ├─ POST /inventory/transfer-request { product_id, from_warehouse_id, to_warehouse_id, quantity: 1, reason: "Venta - Solicitud de traslado" }
   │  │  └─ Toast: "Solicitud de traslado enviada a supervisor"
   │  │
   │  └─ Si stock = 0 en todos:
   │     └─ Toast error: "No tiene stock disponible"

3. Item agregado al carrito con estructura:
   {
     product_id, product_name, image,
     quantity, unit_price (en USD),
     discount (%), warehouse_id,
     installation_type, with_installation, installation_price
   }
```

### Fase 5: Configuración de Pago y Tributación

```
1. Seleccionar tipo de pago
   ├─ "cash" (Contado)
   ├─ "card" (Tarjeta)
   ├─ "credit" (Crédito → credit_days = 30)
   ├─ "transfer" (Transferencia)
   └─ "stripe" (Stripe)

2. Configurar IVA
   ├─ Toggle: "Aplicar IVA" (por defecto: ON)
   ├─ Si ON: se aplica ivaRate (obtenido del servidor)
   └─ Tax = subtotal * (ivaRate / 100)

3. Configurar Retención IR (opcional)
   ├─ Toggle: "Aplicar Retención"
   ├─ Seleccionar tasa (default: 2%)
   └─ Retention = subtotal * (retentionRate / 100)

4. Seleccionar moneda
   ├─ NIO (Córdobas) o USD (Dólares)
   ├─ Todos los precios se convierten usando exchangeRate
   └─ convertPrice(priceUSD) = currency === "NIO" ? priceUSD * exchangeRate : priceUSD

5. Aplicar descuentos
   ├─ Descuento por código: Ingresar código → POST validation (backend)
   ├─ Descuento global: % sobre subtotal
   └─ Descuento por línea: % en cada item del carrito
   
   Nota: Los descuentos SOLO se aplican si paymentType permite descuentos
   (checked en `paymentMethodsAllowDiscounts()`)
```

### Fase 6: Cálculo de Totales

```
calculateTotals() retorna:
{
  subtotal: sum(item.price * item.qty * (1 - item.discount%))
            + sum(installation_price * qty si with_installation)
  
  discountFromCodes: sum de códigos de descuento aplicados
  
  globalDiscountAmount: subtotal * (globalDiscount / 100)
  
  subtotalAfterDiscounts: subtotal - discountFromCodes - globalDiscountAmount
  
  tax: applyIVA ? subtotalAfterDiscounts * (ivaRate / 100) : 0
  
  retention: applyRetention ? subtotal * (retentionRate / 100) : 0
  
  total: subtotalAfterDiscounts + tax - retention
  
  totalInUSD: currency === "USD" ? total : total / exchangeRate
  totalInNIO: currency === "NIO" ? total : total * exchangeRate
}

IMPORTANTE: Si payment_type NO permite descuentos:
  - discountFromCodes = 0
  - globalDiscountAmount = 0
```

### Fase 7: Envío de Venta al Servidor

```
1. Validación previa
   ├─ selectedCustomer debe estar seleccionado
   ├─ cartItems.length > 0
   └─ user tiene permiso "sales:create"

2. Preparar payload:
   POST /sales {
     customer_id,
     vehicle_id (null si no seleccionado),
     items: [
       {
         product_id, quantity, discount,
         warehouse_id, with_installation
       }
     ],
     discount: globalDiscount (%),
     payment_type,
     payment_method: paymentType,
     mixed_payment_methods: [],
     credit_days: paymentType === "credit" ? 30 : null,
     delivery_required: false,
     delivery_address: null,
     manager_authorization_code: null (si no requiere auth),
     apply_iva: applyIVA,
     iva_rate: ivaRate,
     currency,
     exchange_rate: exchangeRate,
     discount_codes: appliedDiscounts.map(d => d.code),
     total_amount: totals.total,
     notes
   }

3. Respuesta del servidor
   ├─ Si response.data.requires_manager_auth === true:
   │  ├─ Mostrar diálogo de autorización
   │  ├─ Listar productos que requieren autorización
   │  ├─ Usuario gerente genera código: POST /auth/manager/generate-code
   │  ├─ Código se ingresa en diálogo
   │  └─ Reintentar venta con manager_authorization_code
   │
   ├─ Si OK (response.status 200):
   │  ├─ sale_id, invoice_number, work_order_id?, discount_codes?
   │  ├─ Toast: "Venta [invoice_number] creada exitosamente"
   │  ├─ Si payment_type === "stripe":
   │  │  ├─ POST /payments/checkout { sale_id, origin_url }
   │  │  └─ window.location.href = checkoutRes.data.url (redirige a Stripe)
   │  ├─ Mostrar diálogo de impresión: ¿Térmica o PDF?
   │  ├─ resetSaleForm()
   │  └─ Cerrar borrador si existe
   │
   └─ Si error:
      └─ Toast error con detalle del backend
```

### Fase 8: Borrador (Draft Management)

```
CICLO DE BORRADOR (Background):

1. Usuario edita formulario → Cambios en estados (selectedCustomer, cartItems, etc.)

2. SaleForm emite onDraftPersist(snapshot)
   ├─ markDraftSaving()
   ├─ window.localStorage.setItem(DRAFT_KEY_PREFIX + draftId, JSON.stringify(snapshot))
   └─ updateDraftTabMeta(draftId, snapshot)

3. updateDraftTabMeta() programa sincronización:
   ├─ scheduleDraftSync(draftId, snapshot, name) — Espera 500ms
   ├─ Después 500ms: syncDraftToServer(draftId, snapshot, name)
   │  ├─ POST /drafts/sale/:draftId { name, snapshot }
   │  ├─ Si OK: markDraftSaved() — Emite SYNCED
   │  └─ Si error: markDraftSaveError() — Emite DISCONNECTED
   └─ Actualiza draftTabs con nombre y updatedAt

CERRAR BORRADOR:
  1. Usuario hace clic en "X" en tab de borrador
  2. closeDraftTab(draftId)
     ├─ window.localStorage.removeItem(DRAFT_KEY + draftId)
     ├─ setDraftTabs(prev => prev.filter(tab => tab.id !== draftId))
     ├─ Si era activo: setActiveDraftId(next || null)
     └─ DELETE /drafts/sale/:draftId (async, no espera)

CAMBIAR BORRADOR ACTIVO:
  1. Usuario hace clic en otro borrador en tablero
  2. setActiveDraftId(newDraftId)
  3. setActiveDraftId trigger useEffect
  4. readDraft(newDraftId) y cargar todos los estados
  5. SaleForm se re-renderiza con initialData del nuevo draft
```

### Fase 9: Operaciones Post-Venta

```
IMPRIMIR:
  1. Usuario hace clic en icono de impresora
  2. Mostrar diálogo: ¿Térmico (80mm) o PDF membretado?
  3. Opción Térmica: GET /print/thermal/:saleId → printWindow
  4. Opción PDF: GET /print/invoice-pdf/:saleId → window.open(blob)

ENVIAR POR WHATSAPP:
  1. Usuario hace clic en icono WhatsApp
  2. Resolver teléfono: sale.customer_phone || customer.phone
  3. Verificar que invoice PDF existe: GET /print/invoice-pdf/:saleId
  4. Construir mensaje: "Hola [customer], aquí tu factura [invoice_number]"
  5. Abrir: https://wa.me/[phone]?text=[encoded_message]

DESCARGAR:
  1. Usuario hace clic en icono de descarga
  2. Intentar GET /sales/:saleId/pdf (PDF generado)
  3. Si falla: Fallback a TXT con datos de venta
  4. Descargar como: factura_[invoice_number].pdf o .txt

EDITAR/ANULAR:
  - Si usuario es gerencia/RRHH: Puede anular directamente
    └─ POST /caja/facturas/:saleId/anular { motivo, justificacion_interna }
  
  - Si usuario es vendedor: Debe solicitar
    ├─ Edición: POST /sales/:saleId/requests/edit { reason }
    ├─ Anulación: POST /sales/:saleId/requests/cancel { reason }
    └─ Toast: "Solicitud enviada a Gerencia/RRHH"
```

---

## 10. Posibles Errores o Funcionalidades Incompletas

### 🔴 CRÍTICOS

1. **Sincronización de Drafts al Cambiar Usuario**
   - ⚠️ **Problema**: Si usuario A abre borrador, cambia de sesión a usuario B, y vuelve a usuario A, el borrador podría estar desincronizado
   - 📍 **Ubicación**: useEffect de activeDraftId
   - **Solución propuesta**: Invalidar borradores al cambiar de usuario (detectar en AuthContext)

2. **Cálculo de Descuentos con Payment Methods**
   - ⚠️ **Problema**: `paymentMethodsAllowDiscounts()` se usa para filtrar descuentos, pero si cambia el método de pago DESPUÉS de aplicar descuentos, estos no se recalculan
   - 📍 **Ubicación**: `calculateTotals()` y `useEffect` de paymentType
   - **Solución propuesta**: Agregar useEffect que limpie discounts si payment_type cambia a uno no permitido

3. **Autorización de Gerente - Código Hardcodeado**
   - ⚠️ **Problema**: `POST /auth/manager/generate-code` genera código, pero no hay validación del código ingresado
   - 📍 **Ubicación**: `submitWithAuth()` → `createSale(managerAuthCode)`
   - **Solución propuesta**: Backend debe validar el código antes de crear venta

4. **Traslado de Inventario - No Bloquea Carrito**
   - ⚠️ **Problema**: Si usuario solicita traslado pero no lo aprueba, puede intentar crear venta sin stock
   - 📍 **Ubicación**: `requestTransfer()` + `addToCart()`
   - **Solución propuesta**: Marcar producto como "en solicitud de traslado" en carrito, validar en backend

### 🟡 IMPORTANTES

5. **Retención IR - Aplicación Solo en Subtotal**
   - ⚠️ **Problema**: Retención se calcula sobre subtotal original, no sobre subtotal después de descuentos
   - 📍 **Ubicación**: `calculateTotals()` - línea `const retention = draft.applyRetention ? subtotal * ...`
   - **Nota normativa**: Verificar con contabilidad si es intención o error

6. **Conversión de Moneda - Precisión Decimal**
   - ⚠️ **Problema**: Multiplicación/división repetida de exchangeRate puede generar errores de redondeo
   - 📍 **Ubicación**: Múltiples `convertPrice()`, `totalInUSD`, `totalInNIO`
   - **Solución propuesta**: Usar librearía decimal.js o toFixed(2) en puntos críticos

7. **Compatibilidad de Vehículos - No Bloquea**
   - ⚠️ **Problema**: Si producto es incompatible, se agrega al carrito de todas formas (solo warning)
   - 📍 **Ubicación**: `addToCart()` - respuesta `compatResult.compatible === false`
   - **Solución propuesta**: Permitir agregar pero con modal de confirmación

8. **Sincronización de Datos Cada 30s**
   - ⚠️ **Problema**: Si hay muchas ventas en paralelo, el polling puede recargar muchos datos innecesariamente
   - 📍 **Ubicación**: `useEffect` con `window.setInterval(refreshData, 30000)`
   - **Solución propuesta**: Usar WebSocket o EventSource en lugar de polling

### 🟠 MENORES / POTENCIALES

9. **Selección de Warehouse Inicial**
   - ⚠️ **Problema**: Si warehouses está vacío, selectedWarehouse se establece como "" pero otros efectos asumen que existe
   - 📍 **Ubicación**: `fetchData()` - setSelectedWarehouse con warehouse_id
   - **Solución propuesta**: Validar que selectedWarehouse existe antes de usarlo en filtros

10. **Campos Hardcodeados en Venta**
    - ⚠️ **Problema**: `creditDays = 30`, `deliveryRequired = false`, `deliveryAddress = ""` son constantes (useState con []dependencia)
    - 📍 **Ubicación**: Líneas ~290-295
    - **Nota**: Estos valores nunca se cambian. ¿Son intención?

11. **Nueva Conexión de Cliente - Nombre Incompleto**
    - ⚠️ **Problema**: Campo "Nombres" es "first_name" pero se guarda como nombre completo
    - 📍 **Ubicación**: `createNewCustomer()` - newCustomer.first_name
    - **Solución propuesta**: Usar "first_name" y "last_name" separados en la estructura

12. **Borrador Vacío - No Se Elimina**
    - ⚠️ **Problema**: `isDraftEmpty()` detecta borradores vacíos pero no se eliminan automáticamente después de cierto tiempo
    - 📍 **Ubicación**: `isDraftEmpty()` sin limpieza automática
    - **Solución propuesta**: GC de borradores vacíos > 1 hora en backend

13. **Mensaje de Whatsapp - No Acorta URL**
    - ⚠️ **Problema**: Se envía URL larga de PDF. Si PDF requiere autenticación, receptor no puede abrirlo
    - 📍 **Ubicación**: `sendInvoiceWhatsApp()`
    - **Solución propuesta**: Generar URL firmada temporalmente o compartir token de acceso

14. **Impresión Térmica - Sin Validación de Impresora**
    - ⚠️ **Problema**: `printThermalSale()` abre ventana print pero no verifica si impresora 80mm está disponible
    - 📍 **Ubicación**: `printThermalSale()`
    - **Solución propuesta**: Toast informativo: "Configure impresora térmica en configuración"

15. **Nuevo Vehículo - Validación de Placa Incompleta**
    - ⚠️ **Problema**: `formatPlateNumber()` valida formato pero NO verifica si placa ya existe
    - 📍 **Ubicación**: `createNewCustomer()` - registro de vehículo
    - **Solución propuesta**: Backend debe validar placa única

16. **Estado Autosave - No Comunica al Usuario**
    - ⚠️ **Problema**: Estados `draftSaveState` y `draftSavedAt` no se muestran en UI (solo emiten evento)
    - 📍 **Ubicación**: Múltiples `markDraftSaved()` etc
    - **Solución propuesta**: Mostrar indicador visual: "Guardando...", "Guardado ✓", "Error ✗"

### ❓ DUDAS / REQUERIMIENTOS

17. **Flujo de Crédito - Validación de Límite**
    - ❓ **Pregunta**: ¿Se valida límite de crédito del cliente en backend antes de crear venta?
    - 📍 **Ubicación**: `createSale()` - no hay pre-validación en frontend
    - **Recomendación**: Agregar validación en SaleForm o SalesPage

18. **Descuentos por Código - Validación Backend**
    - ❓ **Pregunta**: Códigos están hardcodeados en `applyDiscountCode()`. ¿Hay validación de backend?
    - 📍 **Ubicación**: `applyDiscountCode()` - const codes = { DESC10, DESC20, ... }
    - **Recomendación**: Mover validación a backend, API endpoint: `POST /discounts/validate`

19. **Instalación de Productos**
    - ❓ **Pregunta**: ¿Campo `installation_type` ("required"|"optional"|"not_available") viene del backend?
    - 📍 **Ubicación**: `addToCart()` - `const installationType = product.installation_type`
    - **Recomendación**: Confirmar estructura de respuesta en `GET /products`

20. **Métodos de Pago Mixtos**
    - ❓ **Pregunta**: `mixedPaymentMethods` está en estado pero nunca se edita en UI. ¿Se edita en SaleForm?
    - 📍 **Ubicación**: Estado `mixedPaymentMethods` sin setter visible en SalesPage
    - **Recomendación**: Documentar flujo de pago mixto en SaleForm

---

## 11. Archivos Relacionados que Deben Revisarse

### 📁 Componentes

| Archivo | Propósito | Criticidad |
|---------|----------|-----------|
| `SaleForm.jsx` | Formulario embebido de ventas con carrito | **CRÍTICA** |
| `SearchableSelect.jsx` | Componente de selección con búsqueda | Alta |
| `card.jsx`, `button.jsx`, `input.jsx`, etc. | Componentes UI base | Media |

### 📁 Contexto y Autenticación

| Archivo | Propósito | Criticidad |
|---------|----------|-----------|
| `context/AuthContext.js` | Proveedor de autenticación y permisos | **CRÍTICA** |
| `lib/userUiPreferences.js` | Preferencias de sonido y tema | Media |

### 📁 Librerías y Utilitarios

| Archivo | Propósito | Criticidad |
|---------|----------|-----------|
| `lib/api.js` | Configuración base de API | Alta |
| `lib/utils.js` | Funciones de formato (formatCurrency, formatDate, etc.) | Alta |
| `lib/draftStorage.js` | Funciones de lectura/escritura de borradores | **CRÍTICA** |
| `lib/serverDrafts.js` | Funciones de sincronización servidor | **CRÍTICA** |
| `lib/autosaveStatus.js` | Emisión de estado de guardado | Alta |
| `lib/exchangeRate.js` | Obtención de tasa USD->NIO | Alta |
| `lib/taxRate.js` | Obtención de IVA vigente | Alta |
| `lib/vehicleThumbnail.js` | Generación de miniaturas de vehículos | Media |
| `lib/vehicleCatalog.js` | Catálogo de vehículos (marcas, modelos, años) | Alta |
| `lib/formatters.js` | Validadores y formateadores (cedula, placa, etc.) | Alta |
| `lib/paymentMethods.js` | Normalización y validación de métodos de pago | **CRÍTICA** |
| `lib/uiSounds.js` | Reproducción de sonidos de interfaz | Media |
| `lib/branding.js` | Constantes de branding (TOPCAR_BRANCH_IDS) | Media |

### 📁 Páginas Relacionadas

| Archivo | Propósito | Criticidad |
|---------|----------|-----------|
| `pages/QuotationsPage.jsx` | Gestión de cotizaciones (posible relación) | Media |
| `pages/InventoryPage.jsx` | Gestión de inventario (stock, transferencias) | Alta |
| `pages/CustomersPage.jsx` | Gestión de clientes | Media |
| `pages/CashierPage.jsx` | Cierre de caja y sesiones | Alta |
| `pages/CreditsPage.jsx` | Gestión de créditos a clientes | Alta |
| `pages/ApprovalsPage.jsx` | Aprobaciones de solicitudes (editar, anular) | Alta |
| `pages/ReportsPage.jsx` | Reportes de ventas | Media |

### 📁 Backend Endpoints

**⚠️ Confirmar existencia y estructura de respuesta de**:
- `POST /sales` - Crear venta (validator de manager_auth_code, retorno de invoice_number)
- `GET /drafts/:flow/bundle` - Bundle de borradores
- `POST /drafts/:flow/:id` - Guardar draft
- `GET /products/:id/check-compatibility/:vehicleId` - Validar compatibilidad
- `POST /inventory/transfer-request` - Solicitar traslado
- `POST /auth/manager/generate-code` - Generar código de gerente
- `POST /caja/facturas/:id/anular` - Anular factura
- `GET /print/invoice-pdf/:id` - Generar PDF de factura
- `GET /print/thermal/:id` - Formato térmico

### 📁 Configuración

| Archivo | Propósito | Criticidad |
|---------|----------|-----------|
| `lib/env.js` | Variables de entorno (API_BASE, AUTH_URL) | **CRÍTICA** |

---

## Resumen Ejecutivo

### Estadísticas de Código
- **Total de líneas**: ~2,500+
- **Estados (useState)**: 37
- **Efectos (useEffect)**: 16
- **Callbacks (useCallback)**: 8
- **Memos (useMemo)**: 4
- **Refs**: 2

### Dependencias Críticas
1. **AuthContext** - Validación de permisos en cada operación
2. **SaleForm** - Lógica delegada de formulario embebido
3. **Sincronización de Drafts** - Complejo sistema de borradores cliente-servidor
4. **Métodos de Pago** - Lógica de validación y descuentos según tipo
5. **Compatibilidad de Vehículos** - Validación asincrónica

### Puntos de Riesgo
1. ⚠️ Sincronización de datos con polling cada 30s (sin WebSocket)
2. ⚠️ Borradores sin validación de cambios de usuario
3. ⚠️ Códigos de descuento hardcodeados
4. ⚠️ Autorización de gerente sin validación local
5. ⚠️ Errores de redondeo con conversión de monedas

### Mejoras Sugeridas
1. Implementar WebSocket para datos en tiempo real
2. Agregar validación exhaustiva de descuentos con backend
3. Implementar indicador visual de estado de guardado
4. Validar límite de crédito antes de crear venta
5. Agregar GC automático de borradores vacíos

---

**Generado**: $(date)  
**Versión**: 1.0  
**Analista**: Sistema de Análisis Automático
