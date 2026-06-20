import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function DirectoryPagination({
  pagination,
  loading = false,
  onPrev,
  onNext,
  className,
}) {
  if (!pagination) return null;

  const { start, end, total, canPrev, hasMore } = pagination;

  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-2 border-t bg-muted/10 text-xs text-muted-foreground ${className || ""}`}>
      <span>
        {loading
          ? "Cargando..."
          : total === 0
            ? "Sin resultados"
            : `Mostrando ${start}–${end} de ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={loading || !canPrev}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={loading || !hasMore}
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}