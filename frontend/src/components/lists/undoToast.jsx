import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DEFAULT_MS = 10000;

/**
 * Toast destructivo reversible (~10s) con anillo de cuenta regresiva + Deshacer.
 * Preferir APIs soft (activar/desactivar). No inventar undo si no hay revert API.
 */
export function showUndoToast({
  message,
  description,
  durationMs = DEFAULT_MS,
  onUndo,
  toastId,
} = {}) {
  const id = toastId ?? `undo-${Date.now()}`;
  let undone = false;

  const handleUndo = async () => {
    if (undone) return;
    undone = true;
    toast.dismiss(id);
    try {
      await onUndo?.();
    } catch {
      toast.error("No se pudo deshacer");
    }
  };

  toast.custom(
    (t) => (
      <UndoToastCard
        message={message}
        description={description}
        durationMs={durationMs}
        onUndo={handleUndo}
        onDismiss={() => toast.dismiss(t)}
      />
    ),
    { id, duration: durationMs }
  );

  return id;
}

function UndoToastCard({ message, description, durationMs, onUndo, onDismiss }) {
  const [remaining, setRemaining] = useState(durationMs);

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const left = Math.max(0, durationMs - (Date.now() - start));
      setRemaining(left);
      if (left > 0) raf = requestAnimationFrame(tick);
    };
    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs]);

  const progress = remaining / durationMs;
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * progress;

  return (
    <div
      className={cn(
        "flex w-[min(92vw,360px)] items-center gap-3 rounded-xl border border-border/60",
        "bg-background/95 dark:bg-card/95 backdrop-blur-xl px-3.5 py-3 shadow-lg"
      )}
      data-testid="undo-toast"
      role="status"
    >
      <div className="relative h-7 w-7 shrink-0" aria-hidden>
        <svg className="h-7 w-7 -rotate-90" viewBox="0 0 28 28">
          <circle
            cx="14"
            cy="14"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-muted/40"
          />
          <circle
            cx="14"
            cy="14"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className="text-primary transition-[stroke-dasharray] duration-100"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums text-foreground/80">
          {Math.ceil(remaining / 1000)}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground leading-snug">{message}</p>
        {description ? (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
        ) : null}
      </div>

      <button
        type="button"
        className="shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        onClick={onUndo}
        data-testid="undo-toast-action"
      >
        Deshacer
      </button>

      <button
        type="button"
        className="shrink-0 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={onDismiss}
        aria-label="Cerrar"
      >
        ✕
      </button>
    </div>
  );
}

export default showUndoToast;
