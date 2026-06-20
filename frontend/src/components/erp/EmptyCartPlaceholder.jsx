import React from "react";
import { PackageSearch, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

export default function EmptyCartPlaceholder({ className = "", flowType = "sale" }) {
  const isQuotation = flowType === "quotation";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center dark:border-slate-600 dark:bg-slate-800/40",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <ShoppingCart className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {isQuotation ? "Cotización sin productos" : "Carrito vacío"}
        </p>
        <p className="mx-auto max-w-xs text-xs text-muted-foreground">
          Busca productos en el paso 3 o usa el catálogo. Los ítems aparecerán aquí automáticamente.
        </p>
      </div>
      <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <PackageSearch className="h-3.5 w-3.5" />
        Paso 3: Seleccionar productos
      </p>
    </div>
  );
}