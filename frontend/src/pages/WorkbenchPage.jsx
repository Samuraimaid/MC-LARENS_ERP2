import React, { Suspense, lazy, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Bell, BookOpen, Car, ClipboardList, FlaskConical, ShoppingCart, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function lazyNamedPage(loader, exportName) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[exportName] };
  });
}

const NotificationsPage = lazyNamedPage(() => import("./NotificationsPage"), "NotificationsPage");
const SalesPage = lazyNamedPage(() => import("./SalesPage"), "SalesPage");
const QuotationsPage = lazyNamedPage(() => import("./QuotationsPage"), "QuotationsPage");
const CatalogPage = lazyNamedPage(() => import("./CatalogPage"), "CatalogPage");
const SamplesPage = lazyNamedPage(() => import("./SamplesPage"), "SamplesPage");
const CustomersPage = lazyNamedPage(() => import("./CustomersPage"), "CustomersPage");
const VehiclesPage = lazyNamedPage(() => import("./VehiclesPage"), "VehiclesPage");

const TAB_CONFIG = [
  {
    key: "notifications",
    label: "Notificaciones",
    icon: Bell,
    component: NotificationsPage,
  },
  {
    key: "sales",
    label: "Ventas",
    icon: ShoppingCart,
    component: SalesPage,
  },
  {
    key: "quotations",
    label: "Cotizaciones",
    icon: ClipboardList,
    component: QuotationsPage,
  },
  {
    key: "catalog",
    label: "Catalogo",
    icon: BookOpen,
    component: CatalogPage,
  },
  {
    key: "samples",
    label: "Muestras",
    icon: FlaskConical,
    component: SamplesPage,
  },
  {
    key: "customers",
    label: "Clientes",
    icon: Users,
    component: CustomersPage,
  },
  {
    key: "vehicles",
    label: "Vehiculos",
    icon: Car,
    component: VehiclesPage,
  },
];

export function WorkbenchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = String(searchParams.get("tab") || "sales");
  const validTabKeys = useMemo(() => new Set(TAB_CONFIG.map((tab) => tab.key)), []);
  const activeTab = validTabKeys.has(requestedTab) ? requestedTab : "sales";

  const setActiveTab = (value) => {
    const nextValue = validTabKeys.has(value) ? value : "sales";
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", nextValue);
      return next;
    }, { replace: true });
  };

  const handleTabChange = (value) => {
    setActiveTab(value);
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-3 animate-fade-up-soft">
        {/* Tablet-only tab strip: visible on 640–1023px. Phones use BottomNav; desktop uses header tabs. */}
        <div className="hidden w-full pb-1 sm:block lg:hidden">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-md border bg-card p-1.5 sm:grid-cols-3">
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="group min-w-0 justify-center rounded-full border px-3 py-1.5 text-xs transition-all duration-150 hover:scale-[1.02] hover:shadow-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <Icon className="h-4 w-4 transition-transform duration-150 group-hover:scale-110 group-hover:-translate-y-0.5 group-data-[state=active]:scale-110" />
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
              <div className="rounded-md border bg-background p-1 sm:p-2 ui-panel animate-fade-up-soft">
                <Suspense
                  fallback={
                    <div className="min-h-[30vh] flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
