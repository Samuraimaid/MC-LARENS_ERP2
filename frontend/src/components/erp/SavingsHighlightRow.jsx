import React from "react";
import { Tag } from "lucide-react";
import { ErpRollingCurrency } from "@/components/erp/ErpRollingNumber";
import { ERP_SEMANTIC_TONES } from "@/lib/erpDesignSystem";
import { cn } from "@/lib/utils";

const SAVINGS_THRESHOLD = 0.01;

export default function SavingsHighlightRow({ amount = 0, currency = "NIO", className = "" }) {
  if (!Number.isFinite(amount) || amount < SAVINGS_THRESHOLD) return null;

  return (
    <div className={cn(ERP_SEMANTIC_TONES.savings.shell, "flex items-center justify-between gap-2", className)}>
      <span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold", ERP_SEMANTIC_TONES.savings.label)}>
        <Tag className="h-4 w-4 shrink-0" />
        Usted Ahorra en esta Compra:
      </span>
      <ErpRollingCurrency
        value={amount}
        currency={currency}
        className={cn("text-sm", ERP_SEMANTIC_TONES.savings.amount)}
      />
    </div>
  );
}