import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TIER_LABELS,
  TIER_PRECIO2,
  canChangeActivePriceTier,
  tierRequiresSupervisorApproval,
} from "@/lib/priceTiers";
import { useDialogMessages } from "@/context/DialogMessagesContext";
import { ShieldAlert, Tag } from "lucide-react";

export default function PriceTierSelector({
  user,
  pricingContext,
  activeTier,
  onTierChange,
  disabled = false,
  className = "",
  precio2ApprovalStatus = null,
}) {
  const { getMessage } = useDialogMessages();
  const precio2Hint = getMessage("pricing.precio2_hint");
  const allowed = pricingContext?.allowed_price_tiers || [];
  const canChange = canChangeActivePriceTier(user, pricingContext) && !disabled;
  const activeLabel = TIER_LABELS[activeTier] || pricingContext?.default_price_tier_label || "Precio 1";
  const activeNeedsApproval = tierRequiresSupervisorApproval(activeTier, user);
  const precio2RequiresApproval =
    pricingContext?.precio2_requires_approval !== false
    && allowed.includes(TIER_PRECIO2)
    && tierRequiresSupervisorApproval(TIER_PRECIO2, user);

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
          {activeNeedsApproval ? (
            <Badge
              variant="outline"
              className={cn(
                "inline-flex items-center gap-1 text-[10px]",
                precio2ApprovalStatus === "approved"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : precio2ApprovalStatus === "pending"
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-amber-300 bg-amber-50 text-amber-900",
              )}
            >
              <ShieldAlert className="h-3 w-3" />
              {precio2ApprovalStatus === "approved"
                ? "Precio 2 autorizado"
                : precio2ApprovalStatus === "pending"
                  ? "Esperando supervisión"
                  : "Requiere aprobación"}
            </Badge>
          ) : null}
        </div>
        {!canChange ? (
          <span className="text-[11px] text-muted-foreground">Tarifa fija para este perfil</span>
        ) : null}
      </div>
      {canChange && allowed.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {allowed.map((tier) => {
            const needsApproval = tier === TIER_PRECIO2 && precio2RequiresApproval;
            return (
              <Button
                key={tier}
                type="button"
                size="sm"
                variant={tier === activeTier ? "default" : "outline"}
                className={cn(
                  "h-8 text-xs",
                  tier === activeTier && "bg-violet-700 hover:bg-violet-800",
                  needsApproval && tier !== activeTier && "border-amber-300 text-amber-900",
                )}
                title={needsApproval ? "Precio 2 requiere aprobación de supervisión o gerencia" : undefined}
                onClick={() => {
                  if (tier !== activeTier) onTierChange?.(tier);
                }}
              >
                {TIER_LABELS[tier] || tier}
                {needsApproval ? " *" : ""}
              </Button>
            );
          })}
        </div>
      ) : null}
      {precio2RequiresApproval ? (
        <p className="mt-2 text-[11px] leading-snug text-amber-800/90 dark:text-amber-200/90">
          {precio2Hint.description}
        </p>
      ) : null}
    </div>
  );
}