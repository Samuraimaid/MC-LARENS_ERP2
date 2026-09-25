import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * U11 — friendly empty state that teaches the first action + CTA.
 * Spanish UI throughout.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionTestId,
  className,
  testId,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center",
        className,
      )}
      data-testid={testId}
    >
      {Icon ? (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-7 w-7" aria-hidden />
        </div>
      ) : null}
      <div className="space-y-1">
        {title ? <p className="text-sm font-semibold text-foreground">{title}</p> : null}
        {description ? (
          <p className="mx-auto max-w-sm text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actionLabel && typeof onAction === "function" ? (
        <Button
          type="button"
          size="sm"
          className="mt-1"
          onClick={onAction}
          disabled={actionDisabled}
          data-testid={actionTestId}
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
