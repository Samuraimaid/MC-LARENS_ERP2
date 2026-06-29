import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";
import { ClipboardList, Monitor, Smartphone } from "lucide-react";

const KDS_BY_ROLE = {
  polarizador: "/kds/polarizados",
  coordinador_polarizados: "/kds/polarizados",
  electrico: "/kds/instalaciones",
  instalaciones: "/kds/instalaciones",
  instalador: "/kds/instalaciones",
  coordinador_instalaciones: "/kds/instalaciones",
};

export function TechnicianKioskNav({ className }) {
  const location = useLocation();
  const { user } = useAuth();
  const role = String(user?.role || "").toLowerCase();
  const kdsHref = KDS_BY_ROLE[role] || "/kds/instalaciones";

  const items = [
    { href: "/technician", label: "Kiosko", icon: Smartphone },
    { href: "/my-completed-jobs", label: "Mis trabajos", icon: ClipboardList },
    { href: kdsHref, label: "KDS", icon: Monitor },
  ];

  return (
    <nav
      className={cn(
        "fixed bottom-0 inset-x-0 z-50 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-area-bottom",
        className
      )}
      data-testid="technician-kiosk-nav"
    >
      <div className="grid grid-cols-3 max-w-lg mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}