import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { cn } from "../../lib/utils";
import { useRoles } from "../../lib/useRoles";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Car,
  FileText,
  Wrench,
  Monitor,
  TrendingUp,
  Settings,
  Lock,
  Sun,
  Moon,
  Truck,
  Tag,
  Building2,
  Warehouse,
  CreditCard,
  Wallet,
  RotateCcw,
  Calendar,
  Shield,
  Cog,
  ClipboardCheck,
  ClipboardList,
  Calculator,

  PackageCheck,
  ArrowRightLeft,
  Palette,
  BookOpen,
  FlaskConical,
  Bell,
  Briefcase,
  Eye,
  Search,
  PanelsTopLeft,
  LogOut,
  Smartphone,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { getBrandingForBranch } from "../../lib/branding";
import { APP_ENV } from "../../lib/env";
import { fetchNodeProfile, getCachedNodeProfile, isRouteEnabledByNodeProfile } from "../../lib/nodeProfile";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["gerencia", "recursos_humanos"] },
  { name: "Buscador ERP", href: "/search", icon: Search, roles: ["all"] },
  { name: "Centro Unificado", href: "/workbench", icon: PanelsTopLeft, roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"] },
  { name: "Caja", href: "/cashier", icon: Wallet, roles: ["gerencia", "supervisor", "programador", "cajero"] },
  { name: "Inventario", href: "/inventory", icon: Package, roles: ["gerencia", "supervisor", "bodegas", "jefe_tienda"] },
  { name: "Despacho", href: "/dispatch", icon: PackageCheck, roles: ["gerencia", "supervisor", "bodegas", "jefe_tienda"] },
  { name: "Traslados de Productos", href: "/product-transfers", icon: ArrowRightLeft, roles: ["gerencia", "supervisor", "bodegas"] },
  { name: "Coord. Instalaciones", href: "/coordinator/instalaciones", icon: Wrench, roles: ["gerencia", "supervisor", "coordinador_instalaciones"] },
  { name: "Coord. Polarizados", href: "/coordinator/polarizados", icon: Palette, roles: ["gerencia", "supervisor", "coordinador_polarizados"] },
  { name: "Kiosko Técnico", href: "/technician", icon: Smartphone, roles: ["instalaciones", "instalador", "electrico", "polarizador"] },
  { name: "Órdenes de Trabajo", href: "/work-orders", icon: Wrench, roles: ["gerencia", "supervisor", "instalaciones", "electrico"] },
  { name: "Mis Trabajos Realizados", href: "/my-completed-jobs", icon: ClipboardList, roles: ["gerencia", "supervisor", "instalaciones", "electrico", "polarizador", "coordinador_instalaciones", "coordinador_polarizados"] },
  { name: "Polarizados", href: "/tint-orders", icon: Palette, roles: ["gerencia", "supervisor", "instalaciones", "polarizador"] },
  { name: "Calendario", href: "/calendar", icon: Calendar, roles: ["gerencia", "supervisor", "instalaciones"] },
  { name: "Control de Calidad", href: "/quality-control", icon: ClipboardCheck, roles: ["gerencia", "supervisor", "coordinador_instalaciones"] },
  { name: "KDS Bodega", href: "/kds/bodega", icon: Monitor, roles: ["gerencia", "supervisor", "bodegas", "jefe_tienda"] },
  { name: "KDS Instalaciones", href: "/kds/instalaciones", icon: Monitor, roles: ["gerencia", "supervisor", "instalaciones", "electrico", "coordinador_instalaciones"] },
  { name: "KDS Polarizados", href: "/kds/polarizados", icon: Monitor, roles: ["gerencia", "supervisor", "polarizador", "coordinador_polarizados"] },
  { name: "Entregas", href: "/deliveries", icon: Truck, roles: ["gerencia", "supervisor", "transporte"] },
  { name: "Créditos", href: "/credits", icon: CreditCard, roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"] },
  { name: "Devoluciones", href: "/returns", icon: RotateCcw, roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"] },
  { name: "Garantías", href: "/warranties", icon: Shield, roles: ["gerencia", "supervisor", "instalaciones"] },
  { name: "Promociones", href: "/promotions", icon: Tag, roles: ["gerencia", "supervisor", "jefe_vendedores", "jefe_tienda"] },
  { name: "Reportes", href: "/reports", icon: TrendingUp, roles: ["gerencia", "supervisor", "jefe_vendedores", "jefe_tienda"] },
  { name: "Contabilidad", href: "/accounting", icon: Calculator, roles: ["gerencia", "recursos_humanos", "supervisor"] },
  { name: "Recursos Humanos", href: "/human-resources", icon: Briefcase, roles: ["gerencia", "supervisor", "recursos_humanos"] },
  { name: "HyiperVisor", href: "/hypervisor", icon: Eye, roles: ["gerencia", "programador", "recursos_humanos"] },
  { name: "Centro Servidor", href: "/server-dashboard", icon: Monitor, roles: ["gerencia", "programador"] },
  { name: "Sucursales", href: "/branches", icon: Building2, roles: ["gerencia"] },
  { name: "Bodegas", href: "/warehouses", icon: Warehouse, roles: ["gerencia", "supervisor"] },
  { name: "Usuarios", href: "/users", icon: Users, roles: ["gerencia"] },
  { name: "Configuración", href: "/settings", icon: Settings, roles: ["gerencia"] },
  { name: "Tutoriales", href: "/help/tutorials", icon: BookOpen, roles: ["all"] },
];

const BRANCH_LABELS = {
  branch_main: "Mundo de Accesorios",
  branch_north: "TopCar El Calvario",
  branch_south: "TopCar La Tigre",
};

export function Sidebar({ onToggleCalculator, mode = "full", onNavigate, onToggleSessionLock }) {
  const { user, hasRole, hasPermission, logout } = useAuth();
  const navigate = useNavigate();
  const rolesMap = useRoles();
  const { resolvedMode, toggleMode } = useTheme();
  const location = useLocation();
  const buildVersion = APP_ENV.buildVersion;
  const branding = getBrandingForBranch(user?.branch_id);
  const isIconOnly = mode === "icon";
  const logoSrc = `${branding.logo}${String(branding.logo).includes("?") ? "&" : "?"}v=${encodeURIComponent(buildVersion)}`;
  const branchLabel = BRANCH_LABELS[user?.branch_id] || user?.branch_id || "Sucursal no asignada";

  const routePermissionMap = {
    "/dashboard": "dashboard",
    "/notifications": "notifications",
    "/search": "sales",
    "/workbench": "sales",
    "/followups": "followups",
    "/sales": "sales",
    "/catalog": "catalog",
    "/samples": "samples",
    "/quotations": "quotations",
    "/inventory": "inventory",
    "/dispatch": "dispatch",
    "/product-transfers": "inventory",
    "/customers": "customers",
    "/vehicles": "vehicles",
    "/approvals": "approvals",
    "/coordinator/instalaciones": "coordinator_instalaciones",
    "/coordinator/polarizados": "coordinator_polarizados",
    "/technician": "work_orders",
    "/work-orders": "work_orders",
    "/my-completed-jobs": "technician_completed_jobs",
    "/tint-orders": "tint_orders",
    "/calendar": "calendar",
    "/quality-control": "quality_control",
    "/kds": "kds",
    "/kds/bodega": "kds",
    "/kds/instalaciones": "kds",
    "/kds/polarizados": "kds",
    "/deliveries": "deliveries",
    "/credits": "credits",
    "/returns": "returns",
    "/warranties": "warranties",
    "/promotions": "promotions",
    "/reports": "reports",
    "/accounting": "accounting",
    "/human-resources": "human_resources",
    "/branches": "branches",
    "/warehouses": "warehouses",
    "/users": "users",
    "/settings": "settings",
    "/system-settings": "system_settings",
    "/help/tutorials": "tutorials",
  };

  const [nodeProfile, setNodeProfile] = React.useState(() => getCachedNodeProfile());

  React.useEffect(() => {
    fetchNodeProfile().then(setNodeProfile).catch(() => {});
  }, []);

  const filteredNav = navigation.filter((item) => {
    if (!isRouteEnabledByNodeProfile(item.href, nodeProfile)) {
      return false;
    }

    if (item.href === "/dashboard") {
      const normalizedRole = String(user?.role || "").toLowerCase();
      const canSeeDashboard = normalizedRole === "gerencia" || normalizedRole === "recursos_humanos";
      if (!canSeeDashboard) return false;
    }

    if (item.href.startsWith("/kds") && user?.role === "cajero") return false;
    const roleAllowed = item.roles.includes("all") || hasRole(item.roles);
    if (!roleAllowed) return false;
    const permissionKey = routePermissionMap[item.href];
    if (!permissionKey) return roleAllowed;
    return hasPermission(permissionKey, "view");
  });

  const [unread, setUnread] = React.useState(0);



  const handleLogout = async () => {
    await logout();
    onNavigate?.();
    navigate("/login", { replace: true });
  };
  React.useEffect(() => {
    let mounted = true;
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/notifications/unread-count', { credentials: 'include' });
        if (!mounted) return;
        if (res.ok) {
          const json = await res.json();
          setUnread(json.unread || 0);
        }
      } catch (e) { /* ignore fetch errors for unread count */ }
    };
    fetchUnread();
    const t = setInterval(fetchUnread, 30000);
    // listen for optimistic updates from notifications page
    const onChange = () => { fetchUnread(); };
    window.addEventListener('notifications:changed', onChange);
    return () => { mounted = false; clearInterval(t); window.removeEventListener('notifications:changed', onChange); };
  }, []);

  return (
    <TooltipProvider delayDuration={500}>
    <div className={cn("flex h-full flex-col border-r border-border bg-card", isIconOnly ? "w-20" : "w-64")}>
      {/* Logo */}
      <div className={cn("flex items-center justify-center overflow-hidden border-b border-border", isIconOnly ? "h-20 p-2" : "h-28 p-1.5")}>
        <img
          src={logoSrc}
          alt={branding.brandName}
          className={cn("object-contain", isIconOnly ? "h-14 w-14" : "h-[92%] w-full")}
        />
      </div>

      {/* Navigation */}
      <ScrollArea className={cn("flex-1 py-4", isIconOnly ? "px-2" : "px-3")}>
        <nav className="space-y-1">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.href}
                    onClick={() => onNavigate?.()}
                    data-testid={`nav-${item.href.replace("/", "")}`}
                    className={cn(
                        "group haptic-feedback touch-action-manipulation flex rounded-sm py-2 text-sm font-medium transition-colors",
                      isIconOnly ? "justify-center px-2" : "items-center gap-3 px-3",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <div className={cn("flex items-center", isIconOnly ? "relative" : "gap-2")}>
                        <Icon className="icon-spring h-4 w-4" />
                      {!isIconOnly ? item.name : null}
                      {item.href === '/notifications' && unread > 0 && (
                        <Badge className={cn(isIconOnly ? "absolute -right-1 top-1/2 h-4 min-w-4 -translate-y-1/2 px-1 text-[9px] leading-none" : "ml-2")}>{unread}</Badge>
                      )}
                    </div>
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">Ir a {item.name}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator />

      {!isIconOnly ? <div className="border-t border-border px-3 py-1" /> : null}

      {/* User section eliminada, ahora en el header superior */}
    </div>
    </TooltipProvider>
  );
}
