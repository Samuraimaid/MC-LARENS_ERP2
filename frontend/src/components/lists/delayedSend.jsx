/**
 * U8 — Delayed send / navigate grace (~10s) for external outbound (WhatsApp).
 * Toast “Enviando en Ns…” + Deshacer before opening wa.me.
 * No email backend — FE schedule + cancel only.
 */
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const DELAYED_SEND_MS = 10000;

/** @type {Map<string, { timer: ReturnType<typeof setTimeout>, cancelled: boolean }>} */
const pending = new Map();

/**
 * Schedule opening a URL (or custom send) after delayMs.
 * @param {{
 *   url?: string,
 *   onSend?: () => void,
 *   delayMs?: number,
 *   description?: string,
 *   toastId?: string,
 *   target?: string,
 * }} opts
 * @returns {{ id: string, cancel: () => void }}
 */
export function scheduleDelayedSend({
  url,
  onSend,
  delayMs = DELAYED_SEND_MS,
  description,
  toastId,
  target = "_blank",
} = {}) {
  const id = toastId || `delayed-send-${Date.now()}`;
  cancelDelayedSend(id);

  const state = { timer: null, cancelled: false };
  pending.set(id, state);

  const fire = () => {
    pending.delete(id);
    toast.dismiss(id);
    if (state.cancelled) return;
    try {
      if (typeof onSend === "function") {
        onSend();
      } else if (url) {
        window.open(url, target, "noopener,noreferrer");
      }
    } catch {
      toast.error("No se pudo abrir el enlace");
    }
  };

  state.timer = setTimeout(fire, delayMs);

  const cancel = () => {
    cancelDelayedSend(id);
  };

  toast.custom(
    (t) => (
      <DelayedSendCard
        description={description}
        durationMs={delayMs}
        onCancel={() => {
          cancel();
          toast.dismiss(t);
          toast.message("Envío cancelado");
        }}
      />
    ),
    { id, duration: delayMs + 500 }
  );

  return { id, cancel };
}

export function cancelDelayedSend(id) {
  const state = pending.get(id);
  if (!state) return;
  state.cancelled = true;
  if (state.timer) clearTimeout(state.timer);
  pending.delete(id);
  toast.dismiss(id);
}

function DelayedSendCard({ description, durationMs, onCancel }) {
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

  const secs = Math.max(1, Math.ceil(remaining / 1000));
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
      data-testid="delayed-send-toast"
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
            className="text-[#25D366] transition-[stroke-dasharray] duration-100"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums text-foreground/80">
          {secs}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground leading-snug">
          Enviando en {secs}s…
        </p>
        {description ? (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            Tocá Deshacer para cancelar
          </p>
        )}
      </div>

      <button
        type="button"
        className="shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        onClick={onCancel}
        data-testid="delayed-send-cancel"
      >
        Deshacer
      </button>
    </div>
  );
}

export default scheduleDelayedSend;
