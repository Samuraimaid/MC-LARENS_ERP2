import React from "react";
import PropTypes from "prop-types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Users, UtensilsCrossed, UserX, LogOut, CircleCheck } from "lucide-react";

const SUMMARY_ITEMS = [
  {
    key: "available",
    label: "Libres",
    icon: CircleCheck,
    tone: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  {
    key: "present",
    label: "Presentes",
    icon: Users,
    tone: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-200",
    dot: "bg-sky-500",
  },
  {
    key: "lunch",
    label: "Almuerzo",
    icon: UtensilsCrossed,
    tone: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200",
    dot: "bg-amber-400",
  },
  {
    key: "absent",
    label: "Ausentes",
    icon: UserX,
    tone: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200",
    dot: "bg-rose-500",
  },
  {
    key: "clocked_out",
    label: "Salieron",
    icon: LogOut,
    tone: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-200",
    dot: "bg-slate-500",
  },
];

export function AttendanceSummaryBar({ summary = {}, className }) {
  const total = SUMMARY_ITEMS.reduce(
    (sum, item) => sum + (Number(summary?.[item.key]) || 0),
    0
  );

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2",
        className
      )}
      data-testid="attendance-summary-bar"
    >
      <span className="text-[11px] font-medium text-foreground mr-1">
        Equipo hoy ({total})
      </span>
      {SUMMARY_ITEMS.map((item) => {
        const count = Number(summary?.[item.key]) || 0;
        const Icon = item.icon;
        return (
          <Badge
            key={item.key}
            variant="outline"
            className={cn("gap-1.5 text-[11px] font-normal", item.tone)}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", item.dot)} />
            <Icon className="h-3 w-3 opacity-70" />
            {item.label}: {count}
          </Badge>
        );
      })}
    </div>
  );
}

AttendanceSummaryBar.propTypes = {
  summary: PropTypes.object,
  className: PropTypes.string,
};