import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TIER_LABELS, canChangeActivePriceTier } from "@/lib/priceTiers";
import { Tag } from "lucide-react";

export default function PriceTierSelector({
  user,
  pricingContext,
  activeTier,
  onTierChange,
  disabled = false,
  className = "",
}) {
  const allowed = pricingContext?.allowed_price_tiers || [];
  const canChange = canChangeActivePriceTier(user, pricingContext) && !disabled;
  const activeLabel = TIER_LABELS[activeTier] || pricingContext?.default_price_tier_label || "Precio 1";

  if (!pricingContext) return null;

  return (
    <div className={cn("rounded-lg border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-500/30 dark:bg-violet-950/20", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-violet-900 dark:text-violet-200">
          <Tag className="h-4 w-4" />
          <span>Rango de precios</span>
          <Badge variant="outline" className="border-violet-300 bg-white text-violet-800 dark:bg-violet-950">
            {activeLabel}
          </Badge>
        </div>
        {!canChange ? (
          <span className="text-[11px] text-muted-foreground">Tarifa fija para este perfil</span>
        ) : null}
      </div>
      {canChange && allowed.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {allowed.map((tier) => (
            <Button
              key={tier}
              type="button"
              size="sm"
              variant={tier === activeTier ? "default" : "outline"}
              className={cn(
                "h-8 text-xs",
                tier === activeTier && "bg-violet-700 hover:bg-violet-800",
              )}
              onClick={() => {
                if (tier !== activeTier) onTierChange?.(tier);
              }}
            >
              {TIER_LABELS[tier] || tier}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}