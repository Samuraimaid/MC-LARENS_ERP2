import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, BookOpen, Car, ClipboardList, FlaskConical, ShoppingCart, Users } from "lucide-react";
import { cn } from "../../lib/utils";

const NAV_ITEMS = [
  { key: "notifications", label: "Alertas", icon: Bell },
  { key: "sales", label: "Ventas", icon: ShoppingCart },
  { key: "quotations", label: "Cotizac.", icon: ClipboardList },
  { key: "catalog", label: "Catálogo", icon: BookOpen },
  { key: "samples", label: "Muestras", icon: FlaskConical },
  { key: "customers", label: "Clientes", icon: Users },
  { key: "vehicles", label: "Vehículos", icon: Car },
];

/**
 * Fixed bottom navigation bar — only rendered on phone-sized screens (<640px)
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
      className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 safe-area-bottom"
      aria-label="Navegación principal"
    >
      <div className="flex h-16 items-stretch">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const active = currentTab === key;
          return (
            <button
              key={key}
              onClick={() => handlePress(key)}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 touch-action-manipulation transition-colors duration-150",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground active:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-transform duration-150",
                  active ? "scale-110" : ""
                )}
              />
              <span className={cn("text-[10px] leading-none font-medium truncate", active ? "font-semibold" : "")}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
