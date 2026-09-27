import { useEffect, useRef, useState, useCallback } from "react";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Hook para la purga proactiva y silenciosa de memoria en pantallas de uso prolongado
 * (KDS Bodega, KDS Instalaciones, KDS Polarizado, Reloj Marcador).
 *
 * Se ejecuta de manera completamente transparente cada 6 horas sin forzar recarga
 * del navegador ni provocar parpadeos o pérdida de sesión en los kioscos.
 */
export function useSilentMemoryPurge({
  intervalMs = SIX_HOURS_MS,
  screenName = "Kiosk",
  onPurge = null,
} = {}) {
  const [lastPurgedAt, setLastPurgedAt] = useState(() => new Date());
  const timerRef = useRef(null);

  const performSilentPurge = useCallback(() => {
    try {
      const startTime = performance.now();

      // 1. Limpieza de Blob URLs creadas en runtime (imágenes de vehículos, recibos, audios)
      if (typeof window !== "undefined" && window.__trackedBlobUrls instanceof Set) {
        window.__trackedBlobUrls.forEach((url) => {
          try {
            URL.revokeObjectURL(url);
          } catch (_) {}
        });
        window.__trackedBlobUrls.clear();
      }

      // 2. Liberación de contextos de Canvas desconectados
      if (typeof document !== "undefined") {
        const detachedCanvases = document.querySelectorAll("canvas[data-transient='true']");
        detachedCanvases.forEach((canvas) => {
          try {
            const ctx = canvas.getContext("2d");
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.remove();
          } catch (_) {}
        });
      }

      // 3. Notificación a suscriptores locales de la pantalla
      if (typeof onPurge === "function") {
        try {
          onPurge();
        } catch (_) {}
      }

      // 4. Disparo de evento global para que componentes desechen caché secundaria
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("erp:silent-memory-purged", {
            detail: { screen: screenName, timestamp: new Date().toISOString() },
          })
        );
      }

      // 5. Recolección de basura segura si el navegador Kiosk/Chromium expone window.gc
      if (typeof window !== "undefined" && typeof window.gc === "function") {
        try {
          window.gc();
        } catch (_) {}
      }

      const elapsed = Math.round(performance.now() - startTime);
      const now = new Date();
      setLastPurgedAt(now);

      console.info(
        `[useSilentMemoryPurge:${screenName}] Purga silenciosa de 6h ejecutada en ${elapsed}ms a las ${now.toLocaleTimeString("es-NI")}. Heap optimizado sin recarga.`
      );
    } catch (err) {
      console.warn(`[useSilentMemoryPurge:${screenName}] Advertencia no bloqueante durante purga:`, err);
    }
  }, [screenName, onPurge]);

  useEffect(() => {
    timerRef.current = setInterval(performSilentPurge, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [performSilentPurge, intervalMs]);

  return {
    lastPurgedAt,
    triggerPurge: performSilentPurge,
  };
}
