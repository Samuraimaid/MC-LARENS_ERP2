import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/** Default hold duration from video 06 (~300ms ring). */
export const HOLD_TO_CONFIRM_MS = 320;

/**
 * Press-and-hold confirm (U6 / video 06 Destructive UX).
 * Progress ring fills while held; release early cancels — nothing fires.
 * Completes only after holdMs continuous press → onConfirm.
 */
export function HoldToConfirmButton({
  children,
  onConfirm,
  holdMs = HOLD_TO_CONFIRM_MS,
  variant = "destructive",
  size = "default",
  disabled = false,
  loading = false,
  className,
  ringClassName,
  testId = "hold-to-confirm",
  title,
  type = "button",
  ...rest
}) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const startRef = useRef(0);
  const rafRef = useRef(0);
  const doneRef = useRef(false);
  const pointerIdRef = useRef(null);

  const clearRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const reset = useCallback(() => {
    clearRaf();
    setHolding(false);
    setProgress(0);
    doneRef.current = false;
    pointerIdRef.current = null;
    startRef.current = 0;
  }, [clearRaf]);

  useEffect(() => () => clearRaf(), [clearRaf]);

  const tick = useCallback(() => {
    const elapsed = Date.now() - startRef.current;
    const p = Math.min(1, elapsed / holdMs);
    setProgress(p);
    if (p >= 1) {
      if (!doneRef.current) {
        doneRef.current = true;
        clearRaf();
        setHolding(false);
        setProgress(1);
        Promise.resolve(onConfirm?.()).finally(() => {
          // Allow a brief full-ring flash then reset
          window.setTimeout(reset, 120);
        });
      }
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [clearRaf, holdMs, onConfirm, reset]);

  const begin = useCallback(
    (e) => {
      if (disabled || loading || doneRef.current) return;
      if (e?.pointerType === "mouse" && e.button !== 0) return;
      e?.preventDefault?.();
      try {
        e?.currentTarget?.setPointerCapture?.(e.pointerId);
        pointerIdRef.current = e.pointerId;
      } catch {
        /* ignore */
      }
      doneRef.current = false;
      startRef.current = Date.now();
      setHolding(true);
      setProgress(0);
      clearRaf();
      rafRef.current = requestAnimationFrame(tick);
    },
    [clearRaf, disabled, loading, tick],
  );

  const end = useCallback(
    (e) => {
      if (pointerIdRef.current != null && e?.pointerId != null && e.pointerId !== pointerIdRef.current) {
        return;
      }
      try {
        e?.currentTarget?.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      if (doneRef.current) return;
      // Release early → cancel; nothing fires
      reset();
    },
    [reset],
  );

  const onKeyDown = useCallback(
    (e) => {
      if (disabled || loading) return;
      if (e.key === " " || e.key === "Enter") {
        if (e.repeat) return;
        e.preventDefault();
        begin(e);
      }
    },
    [begin, disabled, loading],
  );

  const onKeyUp = useCallback(
    (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        end(e);
      }
    },
    [end],
  );

  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * progress;
  const busy = disabled || loading;

  return (
    <button
      type={type}
      disabled={busy}
      title={title || "Mantener pulsado para confirmar"}
      aria-label={typeof children === "string" ? children : title || "Mantener para confirmar"}
      aria-busy={loading || holding}
      data-testid={testId}
      data-holding={holding ? "true" : "false"}
      data-progress={progress.toFixed(2)}
      className={cn(
        buttonVariants({ variant, size }),
        "relative select-none touch-manipulation",
        holding && "scale-[0.98]",
        className,
      )}
      onPointerDown={begin}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={(e) => {
        // Only cancel if we were tracking this pointer and it left without capture
        if (holding && !doneRef.current && pointerIdRef.current == null) end(e);
      }}
      onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onClick={(e) => {
        // Block accidental click-fire; hold path owns confirm
        e.preventDefault();
        e.stopPropagation();
      }}
      {...rest}
    >
      <span className="relative z-[1] inline-flex items-center gap-2">
        {(holding || progress > 0) && (
          <span className="relative h-5 w-5 shrink-0" aria-hidden>
            <svg className="h-5 w-5 -rotate-90" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.25"
                strokeWidth="2.5"
                className={ringClassName}
              />
              <circle
                cx="12"
                cy="12"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference}`}
                className={cn("transition-[stroke-dasharray] duration-75", ringClassName)}
              />
            </svg>
          </span>
        )}
        {loading ? "…" : children}
      </span>
    </button>
  );
}

HoldToConfirmButton.propTypes = {
  children: PropTypes.node,
  onConfirm: PropTypes.func,
  holdMs: PropTypes.number,
  variant: PropTypes.oneOf(["default", "destructive", "outline", "secondary", "ghost", "link"]),
  size: PropTypes.oneOf(["default", "sm", "lg", "icon"]),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  className: PropTypes.string,
  ringClassName: PropTypes.string,
  testId: PropTypes.string,
  title: PropTypes.string,
  type: PropTypes.string,
};

export default HoldToConfirmButton;
