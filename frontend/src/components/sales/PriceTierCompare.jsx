import React from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { ErpRollingCurrency } from "@/components/erp/ErpRollingNumber";
import { buildTierPriceCompare } from "@/lib/priceTiers";

export default function PriceTierCompare({
  product,
  activeTier,
  currency = "NIO",
  convertPrice = (v) => v,
  size = "sm",
  className = "",
}) {
  const compare = buildTierPriceCompare(product, activeTier);
  if (!compare.showCompare) {
    const price = convertPrice(compare.tierPrice || compare.precio1);
    return (
      <p className={cn(
        "inline-flex items-center gap-1 font-mono font-semibold",
        size === "lg" ? "text-[13px] font-extrabold" : "text-[11px]",
        className,
      )}
      >
        <ErpRollingCurrency value={price} currency={currency} />
      </p>
    );
  }

  return (
    <div className={cn("text-right leading-tight", className)}>
      <p className="font-mono text-[10px] text-muted-foreground line-through decoration-1">
        P1: {formatCurrency(convertPrice(compare.precio1), currency)}
      </p>
      <p className={cn(
        "inline-flex items-center gap-1 font-mono text-violet-800 dark:text-violet-300",
        size === "lg" ? "text-[13px] font-extrabold" : "text-[11px] font-bold",
      )}
      >
        <span className="text-[10px] font-medium uppercase tracking-wide">{compare.tierLabel}</span>
        <ErpRollingCurrency value={convertPrice(compare.tierPrice)} currency={currency} />
      </p>
      {compare.discountPercent > 0 ? (
        <p className="text-[10px] text-emerald-700">-{compare.discountPercent}%</p>
      ) : null}
    </div>
  );
}