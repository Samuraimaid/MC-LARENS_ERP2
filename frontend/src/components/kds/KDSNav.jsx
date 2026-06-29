import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Monitor, Package, Palette, Wrench } from "lucide-react";

const KDS_ROUTES = [
  {
    href: "/kds/bodega",
    label: "Bodega",
    shortLabel: "Despacho",
    icon: Package,
    testId: "kds-nav-bodega",
  },
  {
    href: "/kds/instalaciones",
    label: "Instalaciones",
    shortLabel: "Inst. + Eléc.",
    icon: Wrench,
    testId: "kds-nav-instalaciones",
  },
  {
    href: "/kds/polarizados",
    label: "Polarizados",
    shortLabel: "Polarizado",
    icon: Palette,
    testId: "kds-nav-polarizados",
  },
];

export function getKdsScreenMeta(pathname) {
  const match = KDS_ROUTES.find((route) => pathname.startsWith(route.href));
  if (match) {
    return {
      title: `KDS · ${match.label}`,
      subtitle: match.shortLabel,
    };
  }
  if (pathname === "/kds") {
    return { title: "KDS · Pantallas operativas", subtitle: "Selecciona departamento" };
  }
  return { title: "PANTALLA DE ÓRDENES", subtitle: "" };
}

export function KDSNav({ compact = false }) {
  const location = useLocation();

  return (
    <nav
      className={cn(
        "flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1",
        compact ? "flex-wrap" : "overflow-x-auto"
      )}
      aria-label="Navegación KDS"
    >
      {KDS_ROUTES.map((route) => {
        const Icon = route.icon;
        const active = location.pathname === route.href || location.pathname.startsWith(`${route.href}/`);
        return (
          <Link
            key={route.href}
            to={route.href}
            data-testid={route.testId}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{compact ? route.shortLabel : route.label}</span>
          </Link>
        );
      })}
      <div className="hidden lg:flex items-center gap-1 ml-auto pr-1 text-xs text-muted-foreground">
        <Monitor className="h-3.5 w-3.5" />
        Actualización automática cada 30s
      </div>
    </nav>
  );
}