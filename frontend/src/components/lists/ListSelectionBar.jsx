import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

/**
 * Barra sticky/flotante (Liquid Glass) sobre el área de búsqueda de listas.
 * U3: tri-state checkbox; parcial → solo selecciona visibles;
 * tras seleccionar la página visible, CTA “Seleccionar los N que coinciden”.
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
  /** Full filtered / matching dataset size (live with filters). */
  matchingCount,
  allVisibleSelected = false,
  someVisibleSelected = false,
  /** True when every matching id is in the selection Set. */
  allMatchingSelected = false,
  onSelectAll,
  onDeselectAll,
  /** Select full filtered set (Gmail-style second step). */
  onSelectMatching,
  selectAllLabel,
  matchingSelectLabel,
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
  const resolvedMatching =
    matchingCount != null && Number.isFinite(Number(matchingCount))
      ? Number(matchingCount)
      : visibleCount;

  const isPaginatedMatching = resolvedMatching > visibleCount && visibleCount > 0;

  // Si hay más coincidencias que la página: el checkbox actúa sobre visibles;
  // el CTA “Seleccionar los N que coinciden” va en el prompt secundario (estilo Gmail).
  const defaultSelectLabel = isPaginatedMatching
    ? "Seleccionar página"
    : resolvedMatching > 0
      ? `Seleccionar los ${resolvedMatching} que coinciden`
      : "Seleccionar todos";

  const resolvedSelectAllLabel = selectAllLabel ?? defaultSelectLabel;

  const showMatchingPrompt =
    typeof onSelectMatching === "function" &&
    allVisibleSelected &&
    !allMatchingSelected &&
    resolvedMatching > visibleCount &&
    visibleCount > 0;

  const resolvedMatchingLabel =
    matchingSelectLabel ??
    `Seleccionar los ${resolvedMatching} que coinciden`;

  const countText =
    countLabel != null
      ? countLabel
      : selectedCount === 1
        ? "1 seleccionado"
        : `${selectedCount} seleccionados`;

  const showSearch = !hideSearch && (searchSlot != null || typeof onSearchChange === "function");

  const handleHeaderCheck = () => {
    // Partial / empty → select visibles only (never clear).
    // All visibles selected → clear visibles (deselect button clears all).
    onSelectAll?.();
  };

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
              onCheckedChange={handleHeaderCheck}
              aria-label={resolvedSelectAllLabel}
              data-testid={`${testId}-select-all-check`}
            />
            <span className="whitespace-nowrap">
              {resolvedSelectAllLabel}
              {isPaginatedMatching ? (
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

      {showMatchingPrompt ? (
        <div
          className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm"
          data-testid={`${testId}-matching-prompt`}
        >
          <span className="text-foreground/90">
            Los {visibleCount} de esta página están seleccionados.
          </span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-primary font-semibold"
            onClick={() => onSelectMatching?.()}
            data-testid={`${testId}-select-matching`}
          >
            {resolvedMatchingLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default ListSelectionBar;
