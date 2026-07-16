import React from "react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { TIER_LABELS } from "@/lib/priceTiers";
import { History } from "lucide-react";

const EVENT_LABELS = {
  tier_change: "Cambio de rango",
  line_price_edit: "Edición de precio",
  global_discount: "Descuento global",
  discount_code: "Código de descuento",
  supervisor_override: "Aprobación supervisor",
};

function formatEventDetail(event) {
  const details = event?.details || {};
  const type = String(event?.event_type || "");
  if (type === "tier_change") {
    return `${details.from_tier_label || details.from_tier || "?"} → ${details.to_tier_label || details.to_tier || "?"}`;
  }
  if (type === "line_price_edit") {
    return `${details.product_name || details.product_id || "Producto"}: ${details.old_price} → ${details.new_price}`;
  }
  if (type === "global_discount") {
    return `Descuento ${details.percent ?? details.value ?? ""}%`;
  }
  if (type === "discount_code") {
    return `Código: ${(details.codes || []).join(", ") || details.code || ""}`;
  }
  return JSON.stringify(details);
}

export default function DocumentAuditPanel({ events = [], activePriceTier, activePriceTierLabel }) {
  const sorted = [...(events || [])].sort(
    (a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")),
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
        <History className="h-4 w-4" />
        Historial interno (no impreso)
      </div>
      {activePriceTier ? (
        <p className="mb-2 text-xs text-muted-foreground">
          Rango activo:{" "}
          <Badge variant="outline">{activePriceTierLabel || TIER_LABELS[activePriceTier] || activePriceTier}</Badge>
        </p>
      ) : null}
      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin eventos de auditoría registrados.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((event) => (
            <li key={event.event_id || `${event.event_type}-${event.timestamp}`} className="rounded-md border bg-background px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="font-medium">{EVENT_LABELS[event.event_type] || event.event_type}</span>
                <span className="text-muted-foreground">{formatDate(event.timestamp)}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{formatEventDetail(event)}</p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                {event.actor_name}
                {event.actor_role ? ` (${String(event.actor_role).replace(/_/g, " ")})` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}