import React from "react";
import { Tag } from "lucide-react";
import { ErpRollingCurrency } from "@/components/erp/ErpRollingNumber";
import { ERP_SEMANTIC_TONES } from "@/lib/erpDesignSystem";
import { cn } from "@/lib/utils";

const SAVINGS_THRESHOLD = 0.01;

export default function SavingsHighlightRow({ amount = 0, currency = "NIO", className = "" }) {
  if (!Number.isFinite(amount) || amount < SAVINGS_THRESHOLD) return null;

  const shellTone = ERP_SEMANTIC_TONES?.savings?.shell || "rounded-lg border border-green-200 bg-green-50/90 px-3 py-2 dark:border-green-500/35 dark:bg-green-500/10";
  const labelTone = ERP_SEMANTIC_TONES?.savings?.label || "text-green-800 dark:text-green-300";
  const amountTone = ERP_SEMANTIC_TONES?.savings?.amount || "font-mono font-semibold text-green-700 dark:text-green-400";

  return (
    <div className={cn(shellTone, "flex items-center justify-between gap-2", className)}>
      <span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold", labelTone)}>
        <Tag className="h-4 w-4 shrink-0" />
        Usted Ahorra en esta Compra:
      </span>
      <ErpRollingCurrency
        value={amount}
        currency={currency}
        className={cn("text-sm", amountTone)}
      />
    </div>
  );
}