import React, { Suspense, lazy, useMemo, useState } from "react";
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
    toneClass: "border-violet-200 bg-violet-50/85 text-violet-800 data-[state=active]:border-violet-400 data-[state=active]:bg-violet-200 data-[state=active]:text-violet-950",
  },
  {
    key: "sales",
    label: "Ventas",
    icon: ShoppingCart,
    component: SalesPage,
    toneClass: "border-emerald-200 bg-emerald-50/85 text-emerald-800 data-[state=active]:border-emerald-400 data-[state=active]:bg-emerald-200 data-[state=active]:text-emerald-950",
  },
  {
    key: "quotations",
    label: "Cotizaciones",
    icon: ClipboardList,
    component: QuotationsPage,
    toneClass: "border-sky-200 bg-sky-50/85 text-sky-800 data-[state=active]:border-sky-400 data-[state=active]:bg-sky-200 data-[state=active]:text-sky-950",
  },
  {
    key: "catalog",
    label: "Catalogo",
    icon: BookOpen,
    component: CatalogPage,
    toneClass: "border-amber-200 bg-amber-50/85 text-amber-800 data-[state=active]:border-amber-400 data-[state=active]:bg-amber-200 data-[state=active]:text-amber-950",
  },
  {
    key: "samples",
    label: "Muestras",
    icon: FlaskConical,
    component: SamplesPage,
    toneClass: "border-rose-200 bg-rose-50/85 text-rose-800 data-[state=active]:border-rose-400 data-[state=active]:bg-rose-200 data-[state=active]:text-rose-950",
  },
  {
    key: "customers",
    label: "Clientes",
    icon: Users,
    component: CustomersPage,
    toneClass: "border-orange-200 bg-orange-50/85 text-orange-800 data-[state=active]:border-orange-400 data-[state=active]:bg-orange-200 data-[state=active]:text-orange-950",
  },
  {
    key: "vehicles",
    label: "Vehiculos",
    icon: Car,
    component: VehiclesPage,
    toneClass: "border-purple-200 bg-purple-50/85 text-purple-800 data-[state=active]:border-purple-400 data-[state=active]:bg-purple-200 data-[state=active]:text-purple-950",
  },
];

export function WorkbenchPage() {
  const [activeTab, setActiveTab] = useState("sales");
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(["sales"]));

  const handleTabChange = (value) => {
    setActiveTab(value);
    setVisitedTabs((prev) => {
      if (prev.has(value)) return prev;
      const next = new Set(prev);
      next.add(value);
      return next;
    });
  };

  const activeTabLabel = useMemo(
    () => TAB_CONFIG.find((tab) => tab.key === activeTab)?.label || "Ventas",
    [activeTab]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Centro de Trabajo Unificado</h1>
        <p className="text-sm text-muted-foreground">
          Intercala rapidamente entre Notificaciones, Ventas, Cotizaciones, Catalogo, Muestras, Clientes y Vehiculos.
          Vista actual: <span className="font-medium text-foreground">{activeTabLabel}</span>
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-3 animate-fade-up-soft">
        <div className="w-full pb-1">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-md border bg-card p-1.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className={`group min-w-0 justify-center border px-3 py-1.5 transition-all duration-150 hover:scale-[1.02] hover:shadow-md data-[state=active]:shadow-sm ${tab.toneClass}`}
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
          const shouldRender = visitedTabs.has(tab.key);
          return (
            <TabsContent key={tab.key} value={tab.key} className="mt-0">
              {shouldRender ? (
                <div className="rounded-md border bg-background p-2 ui-panel animate-fade-up-soft">
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
              ) : null}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
