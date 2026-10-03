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
  Activity,

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
  Video,
  ExternalLink,
  AppWindow,
  Copy,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { toast } from "sonner";
import { openIndependentWindow } from "../../lib/sessionBus";
import { getBrandingForBranch, formatUserBranchLabel } from "../../lib/branding";
import { APP_ENV } from "../../lib/env";
import { fetchNodeProfile, getCachedNodeProfile, isRouteEnabledByNodeProfile } from "../../lib/nodeProfile";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["gerencia", "recursos_humanos"] },
  { name: "Salud del Flujo", href: "/ops/flow-health", icon: Activity, roles: ["gerencia", "supervisor", "programador", "jefe_tienda"] },
  { name: "Buscador ERP", href: "/workbench?tab=search", icon: Search, roles: ["all"] },
  { name: "Centro Unificado", href: "/workbench", icon: PanelsTopLeft, roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"] },
  { name: "Caja", href: "/cashier", icon: Wallet, roles: ["gerencia", "supervisor", "programador", "cajero"] },
  { name: "Cotizaciones", href: "/quotations", icon: FileText, roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"] },
  { name: "Ventas", href: "/sales", icon: ShoppingCart, roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"] },
  { name: "Catálogo", href: "/catalog", icon: Tag, roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"] },
  { name: "Muestras", href: "/samples", icon: FlaskConical, roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"] },
  { name: "Coord. Polarizados", href: "/coordinator/polarizados", icon: Palette, roles: ["gerencia", "supervisor", "coordinador_polarizados"] },
  { name: "Coord. Instalaciones", href: "/coordinator/instalaciones", icon: Wrench, roles: ["gerencia", "supervisor", "coordinador_instalaciones"] },
  { name: "Mis Trabajos Realizados", href: "/my-completed-jobs", icon: ClipboardList, roles: ["gerencia", "supervisor", "instalaciones", "electrico", "polarizador", "coordinador_instalaciones", "coordinador_polarizados"] },
  { name: "KDS Instalaciones", href: "/kds/instalaciones", icon: Monitor, roles: ["gerencia", "supervisor", "instalaciones", "electrico", "coordinador_instalaciones"] },
  { name: "KDS Polarizados", href: "/kds/polarizados", icon: Monitor, roles: ["gerencia", "supervisor", "polarizador", "coordinador_polarizados"] },
  { name: "Inventario", href: "/inventory", icon: Package, roles: ["gerencia", "supervisor", "bodegas", "jefe_tienda"] },
  { name: "Despacho", href: "/dispatch", icon: PackageCheck, roles: ["gerencia", "supervisor", "bodegas", "jefe_tienda"] },
  { name: "Entregas", href: "/deliveries", icon: Truck, roles: ["gerencia", "supervisor", "transporte", "entregador"] },
  { name: "Clientes", href: "/customers", icon: Users, roles: ["gerencia", "supervisor", "ventas", "cajero", "jefe_vendedores", "jefe_tienda"] },
  { name: "Vehículos", href: "/vehicles", icon: Car, roles: ["gerencia", "supervisor", "ventas", "jefe_vendedores", "jefe_tienda"] },
  { name: "Control de Calidad", href: "/quality-control", icon: ClipboardCheck, roles: ["gerencia", "supervisor", "coordinador_instalaciones", "coordinador_polarizados", "jefe_tienda"] },
  { name: "Garantías", href: "/warranties", icon: Shield, roles: ["gerencia", "supervisor", "instalaciones"] },
  { name: "Créditos", href: "/credits", icon: CreditCard, roles: ["gerencia", "supervisor", "ventas", "cajero", "jefe_vendedores", "jefe_tienda"] },
  { name: "Devoluciones", href: "/returns", icon: RotateCcw, roles: ["gerencia", "supervisor", "ventas", "cajero", "jefe_vendedores", "jefe_tienda"] },
  { name: "Promociones", href: "/promotions", icon: Tag, roles: ["gerencia", "supervisor", "jefe_vendedores", "jefe_tienda"] },
  { name: "Calendario", href: "/calendar", icon: Calendar, roles: ["gerencia", "supervisor", "instalaciones", "coordinador_instalaciones"] },
  { name: "Reportes", href: "/reports", icon: TrendingUp, roles: ["gerencia", "supervisor", "jefe_vendedores", "jefe_tienda"] },
  { name: "Recursos Humanos", href: "/human-resources", icon: Briefcase, roles: ["gerencia", "recursos_humanos", "supervisor"] },
  { name: "Sucursales", href: "/branches", icon: Building2, roles: ["gerencia"] },
  { name: "Bodegas", href: "/warehouses", icon: Warehouse, roles: ["gerencia", "supervisor"] },
  { name: "Usuarios", href: "/users", icon: Users, roles: ["gerencia"] },
  { name: "Videos Promocionales", href: "/settings?tab=videos", icon: Video, roles: ["publicidad"] },
  { name: "Configuración", href: "/settings", icon: Settings, roles: ["gerencia"] },
  { name: "Tutoriales", href: "/help/tutorials", icon: BookOpen, roles: ["all"] },
];

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
  const branchLabel = formatUserBranchLabel(user);

  const routePermissionMap = {
    "/dashboard": "dashboard",
    // /ops/flow-health: role-gated only (gerencia/supervisor/programador/jefe_tienda)
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

    const normalizedRole = String(user?.role || "").toLowerCase();
    if (normalizedRole === "publicidad") {
      return item.href.startsWith("/settings") || item.href === "/help/tutorials";
    }

    if (item.href === "/dashboard") {
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
  const [contextMenu, setContextMenu] = React.useState({
    visible: false,
    x: 0,
    y: 0,
    item: null,
  });

  // Cerrar menú contextual flotante al hacer clic afuera, scroll, resize o Escape
  React.useEffect(() => {
    if (!contextMenu.visible) return;

    const handleClose = () => setContextMenu((prev) => ({ ...prev, visible: false }));
    const handleKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
    };

    window.addEventListener("click", handleClose);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu.visible]);

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
    <div className={cn("erp-shell-sidebar flex h-full flex-col border-r border-border bg-card", isIconOnly ? "w-20" : "w-64")}>
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
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const menuWidth = 240;
                      const menuHeight = 175;
                      const x = Math.min(e.clientX, window.innerWidth - menuWidth - 12);
                      const y = Math.min(e.clientY, window.innerHeight - menuHeight - 12);
                      setContextMenu({
                        visible: true,
                        x: Math.max(12, x),
                        y: Math.max(12, y),
                        item,
                      });
                    }}
                    data-testid={`nav-${item.href.replace("/", "")}`}
                    className={cn(
                      "group haptic-feedback touch-action-manipulation relative flex rounded-sm py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isIconOnly ? "justify-center px-2" : "items-center justify-between px-3",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <div className={cn("flex items-center", isIconOnly ? "relative" : "gap-2.5")}>
                      <Icon className="icon-spring h-4 w-4 shrink-0" />
                      {!isIconOnly ? <span className="truncate">{item.name}</span> : null}
                      {item.href === '/notifications' && unread > 0 && (
                        <Badge className={cn(isIconOnly ? "absolute -right-1 top-1/2 h-4 min-w-4 -translate-y-1/2 px-1 text-[9px] leading-none" : "ml-2")}>{unread}</Badge>
                      )}
                    </div>

                    {!isIconOnly && (
                      <button
                        type="button"
                        title={`Abrir ${item.name} en ventana aparte`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openIndependentWindow(item.href, item.name);
                          toast.success(`Abriendo ${item.name} en ventana independiente`, { duration: 2500 });
                        }}
                        className={cn(
                          "opacity-0 group-hover:opacity-75 hover:!opacity-100 p-1 rounded transition-opacity shrink-0",
                          isActive
                            ? "text-primary-foreground hover:bg-primary-foreground/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="font-medium">Ir a {item.name}</p>
                  <p className="text-[10px] text-muted-foreground">Clic derecho para abrir en ventana aparte</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Menú Contextual Flotante de Clic Derecho */}
      {contextMenu.visible && contextMenu.item && (
        <div
          className="fixed z-[9999] w-64 rounded-xl border border-border/80 bg-popover/95 backdrop-blur-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100 text-popover-foreground"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 px-2.5 py-2 text-xs font-semibold border-b border-border/50 text-foreground">
            {React.createElement(contextMenu.item.icon, { className: "h-4 w-4 text-primary shrink-0" })}
            <span className="truncate">{contextMenu.item.name}</span>
          </div>

          <div className="py-1 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                openIndependentWindow(contextMenu.item.href, contextMenu.item.name);
                toast.success(`Abriendo ${contextMenu.item.name} en ventana independiente`, { duration: 2500 });
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg text-foreground hover:bg-accent/80 hover:text-accent-foreground transition-colors text-left"
            >
              <AppWindow className="h-4 w-4 text-primary shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium">Abrir en ventana independiente</span>
                <span className="text-[10px] text-muted-foreground">Ventana limpia para segunda pantalla</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                window.open(contextMenu.item.href, "_blank");
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg text-foreground hover:bg-accent/80 hover:text-accent-foreground transition-colors text-left"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium">Abrir en nueva pestaña</span>
                <span className="text-[10px] text-muted-foreground">Pestaña estándar del navegador</span>
              </div>
            </button>

            <div className="my-1 h-px bg-border/50" />

            <button
              type="button"
              onClick={() => {
                const fullUrl = `${window.location.origin}${contextMenu.item.href}`;
                if (navigator.clipboard?.writeText) {
                  navigator.clipboard.writeText(fullUrl);
                  toast.info("Enlace copiado al portapapeles", { duration: 2000 });
                }
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-foreground hover:bg-accent/80 hover:text-accent-foreground transition-colors text-left"
            >
              <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>Copiar enlace directo</span>
            </button>
          </div>
        </div>
      )}

      <Separator />

      {!isIconOnly ? <div className="border-t border-border px-3 py-1" /> : null}
    </div>
    </TooltipProvider>
  );
}
