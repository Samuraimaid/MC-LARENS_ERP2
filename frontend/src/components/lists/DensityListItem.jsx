import React from "react";
import { cn } from "@/lib/utils";
import { densityTokens, normalizeListDensity } from "@/components/lists/listDensity";

/**
 * Fila de lista estilo Google: media izquierda + primary/secondary + trailing.
 * Liquid Glass compatible (borde suave / backdrop) sin “card chaos”.
 */
export function DensityListItem({
  density = "comfortable",
  media,
  mediaFallback,
  primary,
  secondary,
  meta,
  trailing,
  children,
  onClick,
  className,
  active = false,
  disabled = false,
  as: Comp = "div",
  testId,
  glass = true,
}) {
  const mode = normalizeListDensity(density);
  const t = densityTokens(mode);
  const isCozy = mode === "cozy";
  const hasBody = children != null && children !== false;

  return (
    <Comp
      data-testid={testId}
      data-list-density={mode}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "group w-full text-left transition-colors",
        hasBody || isCozy ? "flex h-full flex-col" : "flex items-center",
        glass
          ? "rounded-xl border border-white/15 dark:border-white/10 bg-card/65 dark:bg-card/50 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:border-primary/25 hover:bg-card/80"
          : "rounded-lg hover:bg-muted/50",
        active && "ring-2 ring-primary/40 border-primary/30",
        disabled && "opacity-60 pointer-events-none",
        onClick && !disabled && "cursor-pointer ui-interactive",
        className
      )}
    >
      <div className={cn("flex w-full", isCozy ? "flex-1 flex-col items-stretch" : "items-center", !isCozy && t.row)}>
        {(media || mediaFallback) && (
          <div
            className={cn(
              "relative shrink-0 overflow-hidden bg-muted/40 flex items-center justify-center text-muted-foreground",
              isCozy
                ? "h-40 w-full rounded-none [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>svg]:h-12 [&>svg]:w-12"
                : t.media
            )}
          >
            {media || mediaFallback}
          </div>
        )}
        <div className={cn("min-w-0 flex-1 flex flex-col gap-0.5", isCozy && "px-4 pt-4 pb-3")}>
          {primary ? <div className={cn("truncate", t.primary)}>{primary}</div> : null}
          {secondary ? <div className={cn("truncate", t.secondary)}>{secondary}</div> : null}
          {meta ? <div className={cn("truncate", t.secondary)}>{meta}</div> : null}
        </div>
        {trailing ? (
          <div
            className={cn("shrink-0 flex items-center justify-end", isCozy ? "w-full px-4 pb-4" : t.trailing)}
            onClick={(e) => e.stopPropagation()}
          >
            {trailing}
          </div>
        ) : null}
      </div>
      {hasBody ? (
        <div className={cn("w-full border-t border-border/40", t.cardPad)} onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      ) : null}
    </Comp>
  );
}

/**
 * Contenedor de lista con gap según densidad.
 */
export function DensityList({ density = "comfortable", className, children, testId }) {
  const mode = normalizeListDensity(density);
  const t = densityTokens(mode);
  return (
    <div
      data-testid={testId}
      data-list-density={mode}
      className={cn(mode === "cozy" ? "grid grid-cols-1 sm:grid-cols-2 items-stretch" : "flex flex-col", t.listGap, className)}
    >
      {children}
    </div>
  );
}

export default DensityListItem;
