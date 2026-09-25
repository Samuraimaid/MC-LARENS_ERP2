import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

/**
 * Barra sticky/flotante (Liquid Glass) sobre el área de búsqueda de listas.
 * Incluye búsqueda opcional, seleccionar/deseleccionar, conteo y slot de acciones bulk.
 */
export function ListSelectionBar({
  // Search (controlled) — omit searchValue to hide search slot and use `searchSlot` / children layout
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar…",
  searchTestId,
  searchSlot,
  hideSearch = false,

  // Selection
  selectedCount = 0,
  visibleCount = 0,
  allVisibleSelected = false,
  someVisibleSelected = false,
  onSelectAll,
  onDeselectAll,
  selectAllLabel = "Seleccionar todos",
  deselectLabel = "Deseleccionar",
  countLabel,

  // Bulk actions
  children,

  className,
  sticky = true,
  testId = "list-selection-bar",
  leading,
  trailing,
}) {
  const countText =
    countLabel != null
      ? countLabel
      : selectedCount === 1
        ? "1 seleccionado"
        : `${selectedCount} seleccionados`;

  const showSearch = !hideSearch && (searchSlot != null || typeof onSearchChange === "function");

  return (
    <div
      data-testid={testId}
      className={cn(
        "z-30 w-full border border-white/15 dark:border-white/10 bg-card/80 dark:bg-card/70 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)]",
        "rounded-xl px-3 py-2.5 sm:px-4",
        sticky && "sticky top-0",
        className
      )}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:flex-wrap">
        {leading ? <div className="shrink-0">{leading}</div> : null}

        {showSearch ? (
          <div className="relative min-w-0 flex-1 max-w-xl">
            {searchSlot != null ? (
              searchSlot
            ) : (
              <>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchValue ?? ""}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-9 h-9 bg-background/60"
                  data-testid={searchTestId}
                />
              </>
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <label className="inline-flex items-center gap-2 text-sm text-foreground/90 cursor-pointer select-none">
            <Checkbox
              checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
              onCheckedChange={() => onSelectAll?.()}
              aria-label={selectAllLabel}
              data-testid={`${testId}-select-all-check`}
            />
            <span className="whitespace-nowrap">
              {selectAllLabel}
              {visibleCount > 0 ? (
                <span className="text-muted-foreground"> ({visibleCount})</span>
              ) : null}
            </span>
          </label>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => onDeselectAll?.()}
            disabled={selectedCount === 0}
            data-testid={`${testId}-deselect`}
          >
            {deselectLabel}
          </Button>

          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
              selectedCount > 0
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/60 bg-muted/40 text-muted-foreground"
            )}
            data-testid={`${testId}-count`}
          >
            {countText}
          </span>
        </div>

        {(children || trailing) && (
          <div
            className="flex flex-wrap items-center gap-1.5 sm:ml-auto"
            data-testid={`${testId}-actions`}
          >
            {children}
            {trailing}
          </div>
        )}
      </div>
    </div>
  );
}

export default ListSelectionBar;
