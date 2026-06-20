import React from "react";
import { cn } from "@/lib/utils";
import { ERP_SALE_FLOW_STEP_ICONS } from "@/lib/erpDesignSystem";

export default function SaleFlowStepProgress({ steps = [], className = "" }) {
  if (!steps.length) return null;

  return (
    <nav
      aria-label="Progreso del formulario"
      className={cn(
        "overflow-visible rounded-xl border border-border/70 bg-muted/20 px-4 py-3.5 sm:px-6 sm:py-4 lg:px-8",
        className
      )}
    >
      <ol className="flex min-h-[3.25rem] items-center gap-1 overflow-x-auto overflow-y-visible px-2 py-1 sm:min-h-[3.5rem] sm:gap-2 sm:px-3 sm:py-1.5 lg:px-4">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const state = step.done ? "done" : step.active ? "active" : step.locked ? "locked" : "pending";
          const StepIcon = ERP_SALE_FLOW_STEP_ICONS[step.id];

          return (
            <li
              key={step.id}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-1 overflow-visible sm:gap-2",
                index === 0 && "pl-0.5 sm:pl-1",
                isLast && "pr-0.5 sm:pr-1"
              )}
            >
              <div
                className={cn(
                  "flex min-w-0 flex-1 items-center justify-center gap-2 overflow-visible rounded-lg px-1 py-1.5 md:justify-start md:px-2 md:py-2",
                  state === "active" && "bg-primary/10 ring-1 ring-primary/30",
                  state === "done" && "text-emerald-700 dark:text-emerald-300",
                  state === "locked" && "opacity-45"
                )}
                title={step.locked ? "Completa el paso anterior" : step.label}
                aria-label={step.label}
              >
                <span
                  className={cn(
                    "box-border flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 sm:h-9 sm:w-9",
                    state === "done" && "border-emerald-500 bg-emerald-500 text-white shadow-sm",
                    state === "active" && "border-primary bg-primary text-primary-foreground shadow-sm",
                    state === "locked" && "border-muted-foreground/35 bg-muted text-muted-foreground",
                    state === "pending" && "border-border bg-background text-muted-foreground"
                  )}
                >
                  {StepIcon ? (
                    <StepIcon
                      className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                      strokeWidth={state === "done" ? 2.5 : 2.25}
                    />
                  ) : (
                    <span className="text-[11px] font-semibold">{step.id}</span>
                  )}
                </span>
                <span className="hidden min-w-0 truncate text-xs font-medium md:inline">
                  {step.label}
                </span>
              </div>
              {!isLast ? (
                <span
                  className={cn(
                    "hidden h-0.5 w-3 shrink-0 rounded-full md:block md:w-5",
                    step.done ? "bg-emerald-400/90" : "bg-border"
                  )}
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}