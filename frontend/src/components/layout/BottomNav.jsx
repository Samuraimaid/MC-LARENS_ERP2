import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, BookOpen, Car, ClipboardList, FlaskConical, Search, ShoppingCart, Users } from "lucide-react";
import { cn } from "../../lib/utils";

const NAV_ITEMS = [
  { key: "notifications", label: "Alertas", icon: Bell },
  { key: "search", label: "Buscar", icon: Search },
  { key: "sales", label: "Ventas", icon: ShoppingCart },
  { key: "quotations", label: "Cotizac.", icon: ClipboardList },
  { key: "catalog", label: "Catálogo", icon: BookOpen },
  { key: "samples", label: "Muestras", icon: FlaskConical },
  { key: "customers", label: "Clientes", icon: Users },
  { key: "vehicles", label: "Vehículos", icon: Car },
];

/**
 * Fixed bottom navigation bar — rendered on phone-sized screens (<640px)
 * when the user is on the /workbench route.
 */
export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab = new URLSearchParams(location.search).get("tab") || "sales";

  const handlePress = (key) => {
    navigate(`/workbench?tab=${encodeURIComponent(key)}`, { replace: true });
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border/80 dark:border-slate-800/80 bg-background/90 dark:bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-black/50 safe-area-bottom"
      aria-label="Navegación principal"
    >
      <div className="flex h-16 items-stretch px-1">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const active = currentTab === key;
          return (
            <button
              key={key}
              onClick={() => handlePress(key)}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex flex-1 flex-col items-center justify-center gap-1 touch-action-manipulation transition-all duration-200",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              )}
            >
              {/* Active Top Glow Pill */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-full bg-primary shadow-sm shadow-primary/50" />
              )}
              <div className={cn(
                "relative flex items-center justify-center rounded-lg p-1 transition-all duration-200",
                active ? "bg-primary/10 ring-1 ring-primary/25 shadow-inner" : "group-hover:bg-muted/40"
              )}>
                <Icon
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    active ? "scale-110 text-primary" : "group-hover:scale-105"
                  )}
                />
              </div>
              <span className={cn(
                "text-[9.5px] leading-none font-medium truncate tracking-tight transition-all",
                active ? "font-bold text-primary" : "text-muted-foreground/90"
              )}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

