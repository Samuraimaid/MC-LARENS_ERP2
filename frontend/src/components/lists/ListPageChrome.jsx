import React from "react";
import { cn } from "@/lib/utils";
import { useListDensity } from "@/hooks/useListDensity";
import { ListDensityToggle } from "@/components/lists/ListDensityToggle";
import { BackToTopButton } from "@/components/lists/BackToTopButton";
import { densityTokens, normalizeListDensity } from "@/components/lists/listDensity";

/**
 * Chrome reutilizable: toggle de densidad + data-attr + back-to-top.
 * Envuelve el área de listado o se usa solo el toolbar.
 */
export function ListDensityToolbar({
  density,
  onDensityChange,
  className,
  children,
  testId,
}) {
  return (
    <div
      className={cn("ml-auto flex flex-wrap items-center gap-2", className)}
      data-testid={testId || "list-density-toolbar"}
    >
      <ListDensityToggle value={density} onChange={onDensityChange} />
      {children}
    </div>
  );
}

/**
 * Hook+wrapper listo para páginas: densidad global + back-to-top + tokens.
 */
export function useListPageChrome(opts = {}) {
  const densityApi = useListDensity(opts);
  const tokens = densityApi.tokens;
  return {
    ...densityApi,
    tokens,
    DensityToolbar: function BoundToolbar(props) {
      return (
        <ListDensityToolbar
          density={densityApi.density}
          onDensityChange={densityApi.setDensity}
          {...props}
        />
      );
    },
    BackToTop: function BoundBackToTop(props) {
      return <BackToTopButton {...props} />;
    },
    listProps: {
      "data-list-density": densityApi.density,
      className: undefined,
    },
    tableRowClass: tokens.tableRow,
    tableThumbClass: tokens.tableThumb,
  };
}

/**
 * Contenedor que marca `data-list-density` para estilos CSS/Tailwind hijos.
 */
export function DensityScope({ density, className, children, testId }) {
  const mode = normalizeListDensity(density);
  const t = densityTokens(mode);
  return (
    <div
      data-list-density={mode}
      data-testid={testId}
      className={cn("list-density-scope", className)}
      style={{
        "--list-row-min-h": mode === "compact" ? "40px" : mode === "cozy" ? "72px" : "56px",
      }}
    >
      {children}
    </div>
  );
}

export { densityTokens };
export default ListDensityToolbar;
