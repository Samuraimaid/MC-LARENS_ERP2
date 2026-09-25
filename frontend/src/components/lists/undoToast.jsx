import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  pushUndo,
  dropUndo,
  undoById,
  undoLatest,
  getUndoStack,
  ensureUndoHotkey,
  UNDO_STACK_TTL_MS,
} from "./undoStack";

const DEFAULT_MS = UNDO_STACK_TTL_MS;

/**
 * Toast destructivo reversible (~9s) con anillo + Deshacer.
 * U8: pushes onto shared undo stack (time machine); Cmd/Ctrl+Z undoes latest.
 * Preferir APIs soft (activar/desactivar). No inventar undo si no hay revert API.
 */
export function showUndoToast({
  message,
  description,
  durationMs = DEFAULT_MS,
  onUndo,
  toastId,
} = {}) {
  ensureUndoHotkey();
  const id = toastId ?? `undo-${Date.now()}`;

  pushUndo({
    id,
    label: message || "Acción",
    description,
    ttlMs: durationMs,
    onUndo: async () => {
      toast.dismiss(id);
      try {
        await onUndo?.();
      } catch {
        toast.error("No se pudo deshacer");
        throw new Error("undo_failed");
      }
    },
  });

  const handleUndo = async () => {
    const ok = await undoById(id);
    if (!ok) {
      // Already undone via hotkey or expired
      toast.dismiss(id);
    }
  };

  toast.custom(
    (t) => (
      <UndoToastCard
        message={message}
        description={description}
        durationMs={durationMs}
        stackDepth={Math.max(1, getUndoStack().length)}
        onUndo={handleUndo}
        onDismiss={() => {
          dropUndo(id);
          toast.dismiss(t);
        }}
      />
    ),
    {
      id,
      duration: durationMs,
      onAutoClose: () => dropUndo(id),
      onDismiss: () => dropUndo(id),
    }
  );

  return id;
}

/** Undo the latest stacked action (same as Cmd/Ctrl+Z). */
export async function undoLastAction() {
  try {
    const ok = await undoLatest();
    if (ok) toast.success("Cambio deshecho");
    return ok;
  } catch {
    toast.error("No se pudo deshacer");
    return false;
  }
}

function UndoToastCard({ message, description, durationMs, stackDepth, onUndo, onDismiss }) {
  const [remaining, setRemaining] = useState(durationMs);

  useEffect(() => {
    const start = Date.now();
    let raf;
    const tick = () => {
      const left = Math.max(0, durationMs - (Date.now() - start));
      setRemaining(left);
      if (left > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
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
        <p className="text-sm font-medium text-foreground leading-snug">
          {message}
          {stackDepth > 1 ? (
            <span
              className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-semibold text-muted-foreground"
              title={`${stackDepth} acciones en la pila · Ctrl/⌘+Z`}
              data-testid="undo-stack-depth"
            >
              {stackDepth}
            </span>
          ) : null}
        </p>
        {description ? (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            Ctrl/⌘+Z deshace la última
          </p>
        )}
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
