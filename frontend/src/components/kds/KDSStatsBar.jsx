import React from "react";
import { cn } from "@/lib/utils";

export function KDSStatsBar({ items = [] }) {
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-sm",
            item.tone || "bg-muted/60 text-foreground"
          )}
        >
          <div className={cn("w-3 h-3 rounded-full shrink-0", item.dot || "bg-primary")} />
          <span>
            {item.label}: <strong>{item.value ?? 0}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}