/**
 * U14 — command palette registry (Páginas + Acciones).
 * Pages mirror Sidebar roles; actions only navigate or call existing client flows.
 */

import {
  Bell,
  Building2,
  Calendar,
  Car,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Lock,
  Monitor,
  Moon,
  Package,
  PackageCheck,
  Palette,
  PanelsTopLeft,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Sun,
  Tag,
  TrendingUp,
  Truck,
  Users,
  Video,
  Warehouse,
  Wallet,
  Wrench,
  Activity,
  BookOpen,
  Briefcase,
  PlusCircle,
  MonitorSmartphone,
} from "lucide-react";
import { isRouteEnabledByNodeProfile } from "./nodeProfile";
import { isSellerRole, usesRestrictedNavigation } from "./roleHome";

/** @typedef {'page' | 'action'} CommandGroupKind */

/**
 * @typedef {object} CommandDef
 * @property {string} id
 * @property {string} label
 * @property {CommandGroupKind} group
 * @property {any} [icon]
 * @property {string[]} [roles]
 * @property {string} [permission]
 * @property {string} [href]
 * @property {string[]} [keywords]
 * @property {boolean} [async]
 * @property {(ctx: CommandRunContext) => (void|Promise<void>|CommandDef[])} [run]
 * @property {CommandDef[]} [children]
 */

/**
 * @typedef {object} CommandRunContext
 * @property {(to: string) => void} navigate
 * @property {(mode: string) => void} [setMode]
 * @property {() => void} [toggleMode]
 * @property {() => void} [onLockSession]
 * @property {object} [user]
 */

export const COMMAND_GROUP_LABELS = {
  recent: "Recientes",
  action: "Acciones",
  page: "Páginas",
};

/** Page catalog — keep role lists aligned with Sidebar navigation. */
export const COMMAND_PAGES = [
  { id: "page-dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["gerencia", "recursos_humanos"], keywords: ["inicio", "panel"] },
  { id: "page-flow-health", label: "Salud del Flujo", href: "/ops/flow-health", icon: Activity, roles: ["gerencia", "supervisor", "programador", "jefe_tienda"], keywords: ["ops"] },
  { id: "page-search", label: "Buscador ERP", href: "/workbench?tab=search", icon: Search, roles: ["all"], keywords: ["buscar", "search"] },
  { id: "page-workbench", label: "Centro Unificado", href: "/workbench", icon: PanelsTopLeft, roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"], keywords: ["workbench"] },
  { id: "page-cashier", label: "Caja", href: "/cashier", icon: Wallet, roles: ["gerencia", "supervisor", "programador", "cajero"], keywords: ["pos"] },
  { id: "page-quotations", label: "Cotizaciones", href: "/quotations", icon: FileText, roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"], keywords: ["quote"] },
  { id: "page-sales", label: "Ventas", href: "/sales", icon: ShoppingCart, roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"] },
  { id: "page-catalog", label: "Catálogo", href: "/catalog", icon: Tag, roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"] },
  { id: "page-samples", label: "Muestras", href: "/samples", icon: FlaskConical, roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"] },
  { id: "page-coord-pol", label: "Coord. Polarizados", href: "/coordinator/polarizados", icon: Palette, roles: ["gerencia", "supervisor", "coordinador_polarizados"] },
  { id: "page-coord-inst", label: "Coord. Instalaciones", href: "/coordinator/instalaciones", icon: Wrench, roles: ["gerencia", "supervisor", "coordinador_instalaciones"] },
  { id: "page-my-jobs", label: "Mis Trabajos Realizados", href: "/my-completed-jobs", icon: ClipboardList, roles: ["gerencia", "supervisor", "instalaciones", "electrico", "polarizador", "coordinador_instalaciones", "coordinador_polarizados"] },
  { id: "page-kds-inst", label: "KDS Instalaciones", href: "/kds/instalaciones", icon: Monitor, roles: ["gerencia", "supervisor", "instalaciones", "electrico", "coordinador_instalaciones"] },
  { id: "page-kds-pol", label: "KDS Polarizados", href: "/kds/polarizados", icon: Monitor, roles: ["gerencia", "supervisor", "polarizador", "coordinador_polarizados"] },
  { id: "page-inventory", label: "Inventario", href: "/inventory", icon: Package, roles: ["gerencia", "supervisor", "bodegas", "jefe_tienda"], keywords: ["stock", "productos"] },
  { id: "page-dispatch", label: "Despacho", href: "/dispatch", icon: PackageCheck, roles: ["gerencia", "supervisor", "bodegas", "jefe_tienda"] },
  { id: "page-deliveries", label: "Entregas", href: "/deliveries", icon: Truck, roles: ["gerencia", "supervisor", "transporte", "entregador"] },
  { id: "page-customers", label: "Clientes", href: "/customers", icon: Users, roles: ["gerencia", "supervisor", "ventas", "cajero", "jefe_vendedores", "jefe_tienda"] },
  { id: "page-vehicles", label: "Vehículos", href: "/vehicles", icon: Car, roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"] },
  { id: "page-qc", label: "Control de Calidad", href: "/quality-control", icon: ClipboardCheck, roles: ["gerencia", "supervisor", "coordinador_instalaciones", "coordinador_polarizados", "jefe_tienda"] },
  { id: "page-warranties", label: "Garantías", href: "/warranties", icon: Shield, roles: ["gerencia", "supervisor", "instalaciones"] },
  { id: "page-credits", label: "Créditos", href: "/credits", icon: CreditCard, roles: ["gerencia", "supervisor", "ventas", "cajero", "jefe_vendedores", "jefe_tienda"] },
  { id: "page-returns", label: "Devoluciones", href: "/returns", icon: RotateCcw, roles: ["gerencia", "supervisor", "ventas", "cajero", "jefe_vendedores", "jefe_tienda"] },
  { id: "page-promotions", label: "Promociones", href: "/promotions", icon: Tag, roles: ["gerencia", "supervisor", "jefe_vendedores", "jefe_tienda"] },
  { id: "page-calendar", label: "Calendario", href: "/calendar", icon: Calendar, roles: ["gerencia", "supervisor", "instalaciones", "coordinador_instalaciones"] },
  { id: "page-reports", label: "Reportes", href: "/reports", icon: TrendingUp, roles: ["gerencia", "supervisor", "jefe_vendedores", "jefe_tienda"] },
  { id: "page-hr", label: "Recursos Humanos", href: "/human-resources", icon: Briefcase, roles: ["gerencia", "recursos_humanos", "supervisor"] },
  { id: "page-branches", label: "Sucursales", href: "/branches", icon: Building2, roles: ["gerencia"] },
  { id: "page-warehouses", label: "Bodegas", href: "/warehouses", icon: Warehouse, roles: ["gerencia", "supervisor"] },
  { id: "page-users", label: "Usuarios", href: "/users", icon: Users, roles: ["gerencia"] },
  { id: "page-videos", label: "Videos Promocionales", href: "/settings?tab=videos", icon: Video, roles: ["publicidad", "gerencia"] },
  { id: "page-settings", label: "Configuración", href: "/settings", icon: Settings, roles: ["gerencia"], keywords: ["ajustes", "settings"] },
  { id: "page-notifications", label: "Notificaciones", href: "/notifications", icon: Bell, roles: ["all"], keywords: ["avisos"] },
  { id: "page-tutorials", label: "Tutoriales", href: "/help/tutorials", icon: BookOpen, roles: ["all"], keywords: ["ayuda", "help"] },
  { id: "page-ajustes-alias", label: "Ajustes", href: "/settings", icon: Settings, roles: ["gerencia"], keywords: ["configuracion", "configuración"] },
];

const ROUTE_PERMISSION_MAP = {
  "/dashboard": "dashboard",
  "/sales": "sales",
  "/quotations": "quotations",
  "/inventory": "inventory",
  "/catalog": "catalog",
  "/customers": "customers",
  "/vehicles": "vehicles",
  "/workbench": "workbench",
  "/cashier": "cashier",
  "/deliveries": "deliveries",
  "/credits": "credits",
  "/returns": "returns",
  "/warranties": "warranties",
  "/promotions": "promotions",
  "/reports": "reports",
  "/human-resources": "human_resources",
  "/branches": "branches",
  "/warehouses": "warehouses",
  "/users": "users",
  "/settings": "settings",
  "/help/tutorials": "tutorials",
  "/notifications": "notifications",
};

/**
 * @param {{ hasRole: Function, hasPermission: Function, user?: object, nodeProfile?: object|null }} opts
 * @returns {CommandDef[]}
 */
export function buildAccessiblePages({ hasRole, hasPermission, user, nodeProfile }) {
  const normalizedRole = String(user?.role || "").toLowerCase();
  return COMMAND_PAGES.filter((item) => {
    if (item.href && !isRouteEnabledByNodeProfile(item.href.split("?")[0], nodeProfile)) {
      return false;
    }
    if (normalizedRole === "publicidad") {
      return item.href?.startsWith("/settings") || item.href === "/help/tutorials";
    }
    if (item.href === "/dashboard") {
      if (!(normalizedRole === "gerencia" || normalizedRole === "recursos_humanos")) return false;
    }
    if (item.href?.startsWith("/kds") && normalizedRole === "cajero") return false;
    const roles = item.roles || ["all"];
    const roleAllowed = roles.includes("all") || hasRole(roles);
    if (!roleAllowed) return false;
    const path = (item.href || "").split("?")[0];
    const permissionKey = item.permission || ROUTE_PERMISSION_MAP[path];
    if (!permissionKey) return true;
    // Mirror Sidebar: if permissions map is empty, hasPermission returns true
    return hasPermission(permissionKey, "view");
  }).map((item) => ({
    ...item,
    group: "page",
    run: ({ navigate }) => {
      if (item.href) navigate(item.href);
    },
  }));
}

/**
 * Seller/cajero prefer workbench tabs for sale/quote flows.
 * @param {object|null|undefined} user
 * @param {string} path
 */
function salesHomeForUser(user, fallback) {
  if (isSellerRole(user?.role) || usesRestrictedNavigation(user?.role)) {
    return "/workbench?tab=sales";
  }
  return fallback;
}

function quotationsHomeForUser(user, fallback) {
  if (isSellerRole(user?.role) || usesRestrictedNavigation(user?.role)) {
    return "/workbench?tab=quotations";
  }
  return fallback;
}

/**
 * @param {{ hasRole: Function, user?: object }} opts
 * @returns {CommandDef[]}
 */
export function buildAccessibleActions({ hasRole, user }) {
  /** @type {CommandDef[]} */
  const actions = [
    {
      id: "action-new-sale",
      label: "Nueva venta",
      group: "action",
      icon: PlusCircle,
      roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"],
      keywords: ["crear venta", "sale"],
      run: ({ navigate }) => navigate(salesHomeForUser(user, "/sales")),
    },
    {
      id: "action-new-quote",
      label: "Nueva cotización",
      group: "action",
      icon: FileText,
      roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"],
      keywords: ["quote", "cotizar"],
      run: ({ navigate }) => navigate(quotationsHomeForUser(user, "/quotations")),
    },
    {
      id: "action-new-product",
      label: "Nuevo producto",
      group: "action",
      icon: Package,
      roles: ["gerencia", "supervisor", "bodegas", "jefe_tienda"],
      keywords: ["inventario", "sku"],
      run: ({ navigate }) => navigate("/inventory"),
    },
    {
      id: "action-new-customer",
      label: "Nuevo cliente",
      group: "action",
      icon: Users,
      roles: ["gerencia", "supervisor", "ventas", "cajero", "jefe_vendedores", "jefe_tienda"],
      run: ({ navigate }) => navigate("/customers"),
    },
    {
      id: "action-open-search",
      label: "Abrir buscador ERP",
      group: "action",
      icon: Search,
      roles: ["all"],
      run: ({ navigate }) => navigate("/workbench?tab=search"),
    },
    {
      id: "action-notifications",
      label: "Ver notificaciones",
      group: "action",
      icon: Bell,
      roles: ["all"],
      run: ({ navigate }) => navigate("/notifications"),
    },
    {
      id: "action-theme",
      label: "Cambiar tema",
      group: "action",
      icon: MonitorSmartphone,
      roles: ["all"],
      keywords: ["dark", "light", "modo", "apariencia"],
      children: [
        {
          id: "action-theme-light",
          label: "Claro",
          group: "action",
          icon: Sun,
          run: ({ setMode }) => setMode?.("light"),
        },
        {
          id: "action-theme-dark",
          label: "Oscuro",
          group: "action",
          icon: Moon,
          run: ({ setMode }) => setMode?.("dark"),
        },
        {
          id: "action-theme-system",
          label: "Sistema",
          group: "action",
          icon: Monitor,
          run: ({ setMode }) => setMode?.("system"),
        },
      ],
    },
    {
      id: "action-toggle-theme",
      label: "Alternar claro / oscuro",
      group: "action",
      icon: Sun,
      roles: ["all"],
      run: ({ toggleMode }) => toggleMode?.(),
    },
    {
      id: "action-lock-session",
      label: "Bloquear sesión",
      group: "action",
      icon: Lock,
      roles: ["all"],
      keywords: ["pin", "lock"],
      run: ({ onLockSession }) => onLockSession?.(),
    },
    {
      id: "action-go-settings",
      label: "Ir a ajustes",
      group: "action",
      icon: Settings,
      roles: ["gerencia"],
      run: ({ navigate }) => navigate("/settings"),
    },
    {
      id: "action-refresh-notifications",
      label: "Actualizar notificaciones",
      group: "action",
      icon: Bell,
      roles: ["all"],
      async: true,
      keywords: ["async", "spinner"],
      run: async () => {
        // Existing client signal — no new backend endpoint
        try {
          await fetch("/api/notifications/unread-count", { credentials: "include" });
        } catch {
          /* still emit so listeners refresh */
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("notifications:changed"));
        }
        // Brief yield so the row spinner is visible even on fast LAN
        await new Promise((r) => setTimeout(r, 280));
      },
    },
  ];

  return actions.filter((item) => {
    const roles = item.roles || ["all"];
    return roles.includes("all") || hasRole(roles);
  });
}

/**
 * Resolve a recent row back to a live command when possible.
 * @param {{ id: string }} recent
 * @param {CommandDef[]} pool
 */
export function resolveCommandById(recent, pool) {
  return (pool || []).find((c) => c.id === recent?.id) || null;
}
