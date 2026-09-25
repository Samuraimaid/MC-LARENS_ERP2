# Densidad de listas homogénea (estilo Google) + Volver al inicio — 2026-09-25

**Branch:** `feat/google-list-density-homogeneo-20260925`  
**Base (stack):** `feat/lot-c-inventory-transfer-whatsapp-20260925` (#79)  
**Hold:** no merge / no deploy (junto con #77/#78/#79)

## Qué se entregó

### Módulo compartido `frontend/src/components/lists/`
| Archivo | Rol |
|---|---|
| `listDensity.js` | Modos `compact` / `comfortable` / `cozy`, labels ES **Delgada / Cómoda / Amplia**, tokens Tailwind, localStorage global `mclarens_list_density`, migración desde `mclarens_inventory_view_mode` |
| `ListDensityToggle.jsx` | Toggle segmentado (List / ListPlus / LayoutGrid) con lucide-animated |
| `DensityListItem.jsx` + `DensityList` | Fila Google: media + primary/secondary/meta + trailing + body opcional; Liquid Glass |
| `BackToTopButton.jsx` | FAB ChevronUp, label **«Volver al inicio»**, umbral ~400px, scroll de `main.erp-shell-main` o contenedor |
| `ListPageChrome.jsx` | Toolbar + hook de página + `DensityScope` |
| `animatedListIcons.jsx` | Puente lucide-animated → lucide-react |
| `index.js` | Barrel |

### Hook
- `frontend/src/hooks/useListDensity.js` — densidad global (homogeneidad ERP) + override opcional por página.

### Shell
- `MainLayout.jsx` — `BackToTopButton` global sobre `main.erp-shell-main`.

## Páginas cubiertas

| Página | Integración |
|---|---|
| **InventoryPage** | Reemplaza modos ad-hoc Lot C (`delgada`/`intermedia`/`columnas`) por densidad compartida. Compact = tabla densa; comfortable/cozy = filas lista (ya no grid 2 columnas). Toggle + BackToTop. |
| **CustomersPage** | `ListDensityToggle` + filas `DensityList` / `DensityListItem` + BackToTop |
| **VehiclesPage** | Idem Clients (DensityListItem + acciones en body) |
| **ProductTransfersPage** | Toggle + `densityTok.tableRow` en tablas + BackToTop |
| **UsersAdminPage** | Idem |
| **QuotationsPage** | Toggle + BackToTop |
| **SalesPage** | Toggle + BackToTop |
| **WarehousesPage** | Toggle + tableRow + BackToTop |
| **BranchesPage** | Idem |
| **DeliveriesPage** | Idem |
| **ReturnsPage** | Idem |
| **WarrantiesPage** | Idem |
| **WorkOrdersPage** | Idem |
| **CreditsPage** | Idem |
| **SamplesPage** | Idem |
| **PromotionsPage** | Idem |
| **HumanResourcesPage** | Idem (tablas RH) |

## Omitidas (con motivo)

| Área | Motivo |
|---|---|
| **KDS / tableros kanban** | No es lista scrollable tipo entidad; columnas kanban no aplican densidad Google list |
| **CatalogPage** | Rejilla de catálogo/product cards (otro patrón); Lot A tiene su propia UX de búsqueda |
| **CashierPage** | Paneles de factura / POS, no listado maestro |
| **CalendarPage** | Vista calendario |
| **DashboardPage / ServerDashboard / HyperVisor / FlowHealth** | Widgets / métricas |
| **AttendanceClockPage** | Reloj de asistencia |
| **TintOrdersPage** | Flujo operativo / tablero, no listado homogéneo |
| **Login / Settings / SystemSettings / Tutorials / AuthCallback** | Sin listados de entidades |
| **TechnicianMobile / DriverPortal / PublicOrderTracking** | Portales específicos |
| **Workbench / Coordinator / Approvals** (si son colas mixtas) | Se puede extender en follow-up; no prioritarios vs Inventario/Clientes/Vehículos |

## Persistencia
- Global: `localStorage.mclarens_list_density` ∈ `compact|comfortable|cozy`
- Migración automática desde Lot C: `mclarens_inventory_view_mode` (`delgada`→compact, `intermedia`→comfortable, `columnas`→cozy)
- Override por página opcional vía `useListDensity({ pageId, preferPageOverride: true })` (no usado por defecto para homogeneidad)

## Mapping Google
| Modo | ES | Google hint |
|---|---|---|
| compact | Delgada | dense list |
| comfortable | Cómoda | standard list + avatar |
| cozy | Amplia | roomy + thumb grande |

## PR / deploy
- Abrir PR **sin merge**.
- **Sin** deploy Cloud Run.
- Stack con #79; deploy único futuro junto a #77/#78/#79.
