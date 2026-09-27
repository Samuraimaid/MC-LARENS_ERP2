import React, { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

/**
 * Componente centinela para carga progresiva / scroll infinito estilo eBay.
 * Carga automáticamente el siguiente lote de elementos 300px antes de que el usuario
 * llegue al fondo de la pantalla, sin requerir clics manuales ni interrumpir la navegación.
 */
export default function InfiniteScrollSentinel({
  hasMore = false,
  onLoadMore,
  currentCount = 0,
  totalCount = 0,
  label = "productos",
}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      {
        root: null,
        rootMargin: "350px 0px", // Detecta 350px antes del final para carga imperceptible
        threshold: 0.01,
      }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  if (!hasMore && totalCount > 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2 select-none">
        <span className="h-0.5 w-6 bg-border rounded-full" />
        <span>Has llegado al final · {totalCount} {label}</span>
        <span className="h-0.5 w-6 bg-border rounded-full" />
      </div>
    );
  }

  if (hasMore) {
    return (
      <div
        ref={sentinelRef}
        className="py-6 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground select-none"
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/60 border border-border/60 shadow-sm animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Cargando más {label} ({currentCount} de {totalCount})...</span>
        </div>
      </div>
    );
  }

  return null;
}
