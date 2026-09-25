import React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  LIST_DENSITY_META,
  LIST_DENSITY_MODES,
  normalizeListDensity,
} from "@/components/lists/listDensity";
import {
  AnimatedListIcon,
  AnimatedListPlusIcon,
  AnimatedLayoutGridIcon,
} from "@/components/lists/animatedListIcons";

const MODE_ICONS = {
  compact: AnimatedListIcon,
  comfortable: AnimatedListPlusIcon,
  cozy: AnimatedLayoutGridIcon,
};

/**
 * Control segmentado de densidad (Delgada / Cómoda / Amplia).
 * Reutilizable en barras de herramientas de cualquier listado ERP.
 */
export function ListDensityToggle({
  value,
  onChange,
  className,
  showLabels = true,
  size = "sm",
  testId = "list-density-toggle",
  "aria-label": ariaLabel = "Densidad de lista",
}) {
  const current = normalizeListDensity(value);

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground hidden sm:inline">Vista</span>
      <ToggleGroup
        type="single"
        value={current}
        onValueChange={(v) => {
          if (v) onChange?.(normalizeListDensity(v));
        }}
        variant="outline"
        size={size}
        className="rounded-full border border-border/60 bg-card/70 p-0.5 backdrop-blur-md shadow-sm"
        data-testid={testId}
        aria-label={ariaLabel}
      >
        {LIST_DENSITY_MODES.map((mode) => {
          const meta = LIST_DENSITY_META[mode];
          const Icon = MODE_ICONS[mode];
          return (
            <ToggleGroupItem
              key={mode}
              value={mode}
              title={meta.title}
              aria-label={meta.label}
              className="rounded-full px-2.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              data-testid={`list-density-${mode}`}
            >
              <Icon className="h-4 w-4 mr-0 md:mr-1" />
              {showLabels ? (
                <span className="hidden md:inline text-xs">{meta.shortLabel}</span>
              ) : null}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}

export default ListDensityToggle;
