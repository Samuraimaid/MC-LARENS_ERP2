import React, { Suspense, lazy, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  Bell, BookOpen, Car, ClipboardList, FlaskConical, Search, 
  ShoppingCart, Users, Command, Sparkles, Zap
} from "lucide-react";
import UniversalSearchPanel from "@/components/search/UniversalSearchPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function lazyNamedPage(loader, exportName) {
  return lazy(async () => {
    try {
      const module = await loader();
      return exportName ? { default: module[exportName] } : module;
    } catch (error) {
      console.warn(`[Workbench Lazy] Error cargando sub-pestaña (${exportName || 'default'}). Verificando versión...`, error);
      const isDynamicImportError =
        error?.message?.includes("Failed to fetch dynamically imported module") ||
        error?.message?.includes("Importing a module script failed") ||
        error?.name === "ChunkLoadError";

      const key = "last_lazy_reload_wb_" + (exportName || "root");
      const lastReload = sessionStorage.getItem(key);
      const now = Date.now();

      if (isDynamicImportError && (!lastReload || now - Number(lastReload) > 8000)) {
        sessionStorage.setItem(key, String(now));
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });
}

const NotificationsPage = lazyNamedPage(() => import("./NotificationsPage"), "NotificationsPage");
const SalesPage = lazyNamedPage(() => import("./SalesPage"), "SalesPage");
const QuotationsPage = lazyNamedPage(() => import("./QuotationsPage"), "QuotationsPage");
const CatalogPage = lazyNamedPage(() => import("./CatalogPage"), "CatalogPage");
const SamplesPage = lazyNamedPage(() => import("./SamplesPage"), "SamplesPage");
const CustomersPage = lazyNamedPage(() => import("./CustomersPage"), "CustomersPage");
const VehiclesPage = lazyNamedPage(() => import("./VehiclesPage"), "VehiclesPage");

function WorkbenchSearchTab() {
  return <UniversalSearchPanel embedded />;
}

const TAB_CONFIG = [
  {
    key: "notifications",
    label: "Notificaciones",
    icon: Bell,
    component: NotificationsPage,
    shortcut: "1",
  },
  {
    key: "search",
    label: "Buscador",
    icon: Search,
    component: WorkbenchSearchTab,
    shortcut: "2",
  },
  {
    key: "sales",
    label: "Ventas",
    icon: ShoppingCart,
    component: SalesPage,
    shortcut: "3",
  },
  {
    key: "quotations",
    label: "Cotizaciones",
    icon: ClipboardList,
    component: QuotationsPage,
    shortcut: "4",
  },
  {
    key: "catalog",
    label: "Catálogo",
    icon: BookOpen,
    component: CatalogPage,
    shortcut: "5",
  },
  {
    key: "samples",
    label: "Muestras",
    icon: FlaskConical,
    component: SamplesPage,
    shortcut: "6",
  },
  {
    key: "customers",
    label: "Clientes",
    icon: Users,
    component: CustomersPage,
    shortcut: "7",
  },
  {
    key: "vehicles",
    label: "Vehículos",
    icon: Car,
    component: VehiclesPage,
    shortcut: "8",
  },
];

export function WorkbenchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedTab = String(searchParams.get("tab") || "sales");
  const validTabKeys = useMemo(() => new Set(TAB_CONFIG.map((tab) => tab.key)), []);
  const activeTab = validTabKeys.has(requestedTab) ? requestedTab : "sales";

  const setActiveTab = useCallback((value) => {
    const nextValue = validTabKeys.has(value) ? value : "sales";
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", nextValue);
      return next;
    }, { replace: true });
  }, [validTabKeys, setSearchParams]);

  const handleTabChange = (value) => {
    setActiveTab(value);
  };

  // Keyboard shortcut switching: Alt+1..8 or F2/F3/F4
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore when inside input/textarea unless Alt is pressed
      const target = e.target;
      const isInput = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= TAB_CONFIG.length) {
          e.preventDefault();
          setActiveTab(TAB_CONFIG[num - 1].key);
          return;
        }
      }

      if (!isInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.key === "F2") {
          e.preventDefault();
          setActiveTab("sales");
        } else if (e.key === "F3") {
          e.preventDefault();
          setActiveTab("quotations");
        } else if (e.key === "F4") {
          e.preventDefault();
          setActiveTab("catalog");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveTab]);

  const currentTabMeta = useMemo(() => {
    return TAB_CONFIG.find((t) => t.key === activeTab) || TAB_CONFIG[2];
  }, [activeTab]);

  const CurrentIcon = currentTabMeta.icon;

  return (
    <div className="space-y-3 pb-8">
      {/* Workbench Cockpit Header Bar */}
      <div className="workbench-cockpit-bar flex flex-wrap items-center justify-between gap-2.5 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30 shadow-inner shrink-0">
            <CurrentIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold tracking-tight text-foreground uppercase truncate font-microgramma">
                {currentTabMeta.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden sm:inline">Activo</span>
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate hidden md:block">
              Centro de operaciones comerciales y gestión unificada
            </p>
          </div>
        </div>

        {/* Quick Context Switcher & Shortcut Guide */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="hidden lg:flex items-center gap-1 bg-muted/40 dark:bg-slate-900/60 border border-border/80 dark:border-slate-800/80 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("sales")}
              className={cn(
                "px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors",
                activeTab === "sales"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Ventas (F2)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("quotations")}
              className={cn(
                "px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors",
                activeTab === "quotations"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Cotizaciones (F3)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("catalog")}
              className={cn(
                "px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors",
                activeTab === "catalog"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Catálogo (F4)
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab("search")}
            className="h-7 sm:h-8 gap-1.5 px-2.5 text-xs rounded-lg border-border/80 dark:border-slate-800/80 bg-background/50 hover:bg-background/80 shadow-xs"
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Buscar</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 text-[9px] font-mono opacity-70 bg-muted px-1 rounded">
              Alt+2
            </kbd>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-3 animate-fade-up-soft">
        {/* Tablet-only tab strip: visible on 640–1023px. Phones use BottomNav; desktop uses header tabs. */}
        <div className="hidden w-full pb-1 sm:block lg:hidden">
          <TabsList className="grid h-auto w-full grid-cols-4 gap-1.5 rounded-xl border border-border/80 dark:border-slate-800/80 bg-card/80 dark:bg-slate-950/80 p-1.5 shadow-sm backdrop-blur-md">
            {TAB_CONFIG.map((tab, idx) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className={cn(
                    "group relative min-w-0 justify-center rounded-lg border border-transparent px-2.5 py-1.5 text-xs transition-all duration-150",
                    "hover:bg-muted/60 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold"
                  )}
                >
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 transition-transform duration-150 group-hover:scale-110 group-data-[state=active]:scale-105 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {TAB_CONFIG.map((tab) => {
          const PageComponent = tab.component;
          return (
            <TabsContent key={tab.key} value={tab.key} className="mt-0">
              <div
                className={cn(
                  "rounded-2xl border border-border/80 dark:border-slate-800/80 bg-card/50 dark:bg-slate-950/40 backdrop-blur-xl shadow-lg shadow-black/5 ui-panel animate-fade-up-soft",
                  ["sales", "quotations"].includes(tab.key) ? "p-0" : "p-2.5 sm:p-4"
                )}
              >
                <Suspense
                  fallback={
                    <div className="min-h-[35vh] flex flex-col items-center justify-center gap-3">
                      <div className="relative flex h-10 w-10 items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                      <span className="text-xs text-muted-foreground font-mono animate-pulse">
                        Cargando {tab.label.toLowerCase()}…
                      </span>
                    </div>
                  }
                >
                  <PageComponent />
                </Suspense>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

