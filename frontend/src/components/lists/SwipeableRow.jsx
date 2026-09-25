import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { showUndoToast } from "./undoToast";

const DEFAULT_REVEAL = 72;
const DEFAULT_COMMIT = 112;
const DEFAULT_MAX = 148;
const LOCK_SLOP = 8;
/** Horizontal wins when |dx| > |dy| * HORIZ_RATIO (angle ~40° from vertical). */
const HORIZ_RATIO = 1.15;
const PEEK_STORAGE_KEY = "mclarens.ux.u7.swipePeekSeen";
const PEEK_OFFSET = 48;
const UNDO_MS = 5000;

/** Elastic dampen before commit line; past commit resistance drops. */
export function dampenSwipe(rawAbs, commitPx = DEFAULT_COMMIT, maxPx = DEFAULT_MAX) {
  const x = Math.max(0, Number(rawAbs) || 0);
  if (x <= commitPx) {
    // Soft rubber-band toward commit
    return commitPx * (1 - Math.exp(-x / (commitPx * 0.72)));
  }
  // Past commit: resistance drops — travel approaches max quickly
  const over = x - commitPx;
  const headroom = Math.max(8, maxPx - commitPx);
  const eased = commitPx + headroom * (1 - Math.exp(-over / (headroom * 0.55)));
  return Math.min(maxPx, eased);
}

function isTouchCapable() {
  return (
    typeof window !== "undefined" &&
    ("ontouchstart" in window || (navigator && navigator.maxTouchPoints > 0))
  );
}

function fireHapticOnce(armedRef) {
  if (armedRef.current) return;
  armedRef.current = true;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(14);
    }
  } catch {
    /* desktop / blocked */
  }
}

function DefaultSafeIcon({ className }) {
  return <Check className={className} aria-hidden />;
}

function DefaultDestroyIcon({ className }) {
  return <Ban className={className} aria-hidden />;
}

/**
 * SwipeableRow (U7 / video 07) — touch-first horizontal swipe.
 *
 * Two-stage:
 *  1) Short swipe → reveal action buttons under the row (no fire)
 *  2) Past commit line + release → fire action
 *
 * Semantics (never swap):
 *  - Swipe RIGHT → safe only (green/primary reveal)
 *  - Swipe LEFT  → destructive only (red reveal)
 *
 * Angle-lock: vertical intent yields to list scroll / PullToRefresh.
 * Desktop / no-touch: no-op wrapper (children only).
 * Full-swipe destroy: NO confirm modal — undo toast (~5s) when reversible.
 */
export function SwipeableRow({
  children,
  className,
  contentClassName,
  /** Safe action revealed by swipe-right. { label, icon?, onAction, undo?: { message, description?, onUndo, durationMs? } } */
  safeAction = null,
  /** Destructive action revealed by swipe-left. Same shape; always red. */
  destroyAction = null,
  disabled = false,
  /** 'touch' = bind only on touch devices (default); true = always; false = never */
  enabled = "touch",
  revealPx = DEFAULT_REVEAL,
  commitPx = DEFAULT_COMMIT,
  maxPx = DEFAULT_MAX,
  /** One-time peek hint on first launch (localStorage). */
  peekHint = true,
  peekStorageKey = PEEK_STORAGE_KEY,
  testId = "swipeable-row",
}) {
  const wrapRef = useRef(null);
  const contentRef = useRef(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const offsetRef = useRef(0);
  const lockRef = useRef(null); // null | 'h' | 'v'
  const trackingRef = useRef(false);
  const hapticArmedRef = useRef(false);
  const pastCommitRef = useRef(false);
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);
  const [pastCommit, setPastCommit] = useState(false);
  const [touchOn, setTouchOn] = useState(false);
  const [peeking, setPeeking] = useState(false);

  const setOffsetBoth = useCallback((v) => {
    offsetRef.current = v;
    setOffset(v);
  }, []);

  useEffect(() => {
    setTouchOn(isTouchCapable());
  }, []);

  const gesturesOn =
    !disabled &&
    (enabled === true || (enabled === "touch" && touchOn)) &&
    (!!safeAction || !!destroyAction);

  // One-time peek: nudge right then left to hint both sides, then settle.
  useEffect(() => {
    if (!gesturesOn || !peekHint) return undefined;
    if (typeof window === "undefined") return undefined;
    try {
      if (window.localStorage.getItem(peekStorageKey) === "1") return undefined;
    } catch {
      return undefined;
    }

    let cancelled = false;
    const timers = [];
    const markSeen = () => {
      try {
        window.localStorage.setItem(peekStorageKey, "1");
      } catch {
        /* private mode */
      }
    };

    // Defer so first paint is clean
    timers.push(
      window.setTimeout(() => {
        if (cancelled) return;
        setPeeking(true);
        setSettling(true);
        setOffsetBoth(PEEK_OFFSET);
        timers.push(
          window.setTimeout(() => {
            if (cancelled) return;
            setOffsetBoth(-PEEK_OFFSET);
            timers.push(
              window.setTimeout(() => {
                if (cancelled) return;
                setOffsetBoth(0);
                timers.push(
                  window.setTimeout(() => {
                    if (cancelled) return;
                    setSettling(false);
                    setPeeking(false);
                    markSeen();
                  }, 320)
                );
              }, 420)
            );
          }, 480)
        );
      }, 700)
    );

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [gesturesOn, peekHint, peekStorageKey, setOffsetBoth]);

  const closeRow = useCallback(
    (animate = true) => {
      if (animate) setSettling(true);
      setOffsetBoth(0);
      pastCommitRef.current = false;
      setPastCommit(false);
      hapticArmedRef.current = false;
      if (animate) {
        window.setTimeout(() => setSettling(false), 280);
      } else {
        setSettling(false);
      }
    },
    [setOffsetBoth]
  );

  const fireAction = useCallback(
    async (action, kind) => {
      if (!action || typeof action.onAction !== "function") {
        closeRow(true);
        return;
      }
      closeRow(true);
      try {
        await action.onAction();
      } catch {
        /* caller toasts */
      }
      const undo = action.undo;
      if (undo && typeof undo.onUndo === "function") {
        showUndoToast({
          message: undo.message || (kind === "destroy" ? "Acción realizada" : "Listo"),
          description: undo.description || "Puedes deshacer durante unos segundos",
          durationMs: undo.durationMs ?? UNDO_MS,
          onUndo: undo.onUndo,
        });
      }
    },
    [closeRow]
  );

  useEffect(() => {
    if (!gesturesOn) return undefined;
    const el = wrapRef.current;
    if (!el) return undefined;

    const onStart = (e) => {
      if (peeking) return;
      if (!e.touches || e.touches.length !== 1) return;
      // Ignore starts on interactive controls (checkbox, buttons, links)
      const t = e.target;
      if (
        t &&
        typeof t.closest === "function" &&
        t.closest('button, a, input, textarea, select, [role="checkbox"], [data-no-swipe]')
      ) {
        trackingRef.current = false;
        return;
      }
      trackingRef.current = true;
      lockRef.current = null;
      hapticArmedRef.current = false;
      pastCommitRef.current = false;
      setPastCommit(false);
      setSettling(false);
      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
    };

    const onMove = (e) => {
      if (!trackingRef.current || peeking) return;
      if (!e.touches || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startXRef.current;
      const dy = e.touches[0].clientY - startYRef.current;

      if (!lockRef.current) {
        if (Math.abs(dx) < LOCK_SLOP && Math.abs(dy) < LOCK_SLOP) return;
        // Angle lock: vertical intent → yield to scroll / PullToRefresh
        if (Math.abs(dy) > Math.abs(dx) * HORIZ_RATIO) {
          lockRef.current = "v";
          trackingRef.current = false;
          if (offsetRef.current !== 0) closeRow(true);
          return;
        }
        if (Math.abs(dx) > Math.abs(dy) * HORIZ_RATIO) {
          lockRef.current = "h";
        } else {
          return; // still ambiguous
        }
      }

      if (lockRef.current !== "h") return;

      // Clamp direction to available actions (never swap semantics)
      let raw = dx;
      if (raw > 0 && !safeAction) raw = 0;
      if (raw < 0 && !destroyAction) raw = 0;

      if (e.cancelable) e.preventDefault();

      const sign = raw >= 0 ? 1 : -1;
      const dampened = dampenSwipe(Math.abs(raw), commitPx, maxPx) * sign;
      setOffsetBoth(dampened);

      const crossed = Math.abs(dampened) >= commitPx;
      if (crossed !== pastCommitRef.current) {
        pastCommitRef.current = crossed;
        setPastCommit(crossed);
        if (crossed) fireHapticOnce(hapticArmedRef);
      }
    };

    const onEnd = () => {
      if (!trackingRef.current && lockRef.current !== "h") {
        trackingRef.current = false;
        lockRef.current = null;
        return;
      }
      const wasHorizontal = lockRef.current === "h";
      trackingRef.current = false;
      lockRef.current = null;
      if (!wasHorizontal) return;

      const cur = offsetRef.current;
      const abs = Math.abs(cur);

      // Stage 2: past commit + release → fire
      if (abs >= commitPx) {
        if (cur > 0 && safeAction) {
          fireAction(safeAction, "safe");
          return;
        }
        if (cur < 0 && destroyAction) {
          fireAction(destroyAction, "destroy");
          return;
        }
      }

      // Stage 1: short swipe — snap to reveal resting position (buttons visible)
      if (abs >= revealPx * 0.55) {
        setSettling(true);
        const rest = (cur > 0 ? 1 : -1) * revealPx;
        // Only rest if that side has an action
        if ((rest > 0 && safeAction) || (rest < 0 && destroyAction)) {
          setOffsetBoth(rest);
          pastCommitRef.current = false;
          setPastCommit(false);
          hapticArmedRef.current = false;
          window.setTimeout(() => setSettling(false), 260);
          return;
        }
      }

      closeRow(true);
    };

    const onCancel = () => {
      trackingRef.current = false;
      lockRef.current = null;
      closeRow(true);
    };

    const optsPassive = { passive: true };
    const optsMove = { passive: false };
    el.addEventListener("touchstart", onStart, optsPassive);
    el.addEventListener("touchmove", onMove, optsMove);
    el.addEventListener("touchend", onEnd, optsPassive);
    el.addEventListener("touchcancel", onCancel, optsPassive);

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove, optsMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [
    gesturesOn,
    peeking,
    safeAction,
    destroyAction,
    commitPx,
    maxPx,
    revealPx,
    closeRow,
    fireAction,
    setOffsetBoth,
  ]);

  // Tap revealed button
  const onRevealTap = (kind, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (kind === "safe" && safeAction) fireAction(safeAction, "safe");
    if (kind === "destroy" && destroyAction) fireAction(destroyAction, "destroy");
  };

  // Close on outside click / escape while revealed
  useEffect(() => {
    if (!gesturesOn || offset === 0 || settling && Math.abs(offset) < 2) return undefined;
    if (Math.abs(offset) < revealPx * 0.4) return undefined;

    const onDocPointer = (e) => {
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target)) return;
      closeRow(true);
    };
    const onKey = (e) => {
      if (e.key === "Escape") closeRow(true);
    };
    document.addEventListener("pointerdown", onDocPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [gesturesOn, offset, settling, revealPx, closeRow]);

  if (!gesturesOn) {
    return (
      <div className={className} data-testid={testId} data-swipe="off">
        {children}
      </div>
    );
  }

  const showSafe = offset > 2 && !!safeAction;
  const showDestroy = offset < -2 && !!destroyAction;
  const safeLabel = safeAction?.label || "Completar";
  const destroyLabel = destroyAction?.label || "Desactivar";
  const SafeIcon = safeAction?.icon || DefaultSafeIcon;
  const DestroyIcon = destroyAction?.icon || DefaultDestroyIcon;

  return (
    <div
      ref={wrapRef}
      className={cn("relative overflow-hidden touch-pan-y", className)}
      data-testid={testId}
      data-swipe="on"
      data-swipe-offset={Math.round(offset)}
      data-swipe-past-commit={pastCommit ? "true" : "false"}
      data-swipe-peeking={peeking ? "true" : "false"}
    >
      {/* Underlays — safe on LEFT (revealed by swipe-right), destroy on RIGHT */}
      <div
        className="absolute inset-0 z-0 flex"
        aria-hidden={!(showSafe || showDestroy)}
      >
        <div
          className={cn(
            "flex h-full items-stretch justify-start",
            "bg-emerald-600 text-white",
            !showSafe && "opacity-0"
          )}
          style={{ width: Math.max(0, offset) }}
          data-testid={`${testId}-safe-underlay`}
        >
          <button
            type="button"
            className={cn(
              "flex h-full min-w-[72px] flex-col items-center justify-center gap-0.5 px-3",
              "text-xs font-semibold tracking-wide",
              pastCommit && offset > 0 && "scale-110"
            )}
            style={{
              transition: settling ? "transform 0.2s ease" : "transform 0.12s ease",
              transform: pastCommit && offset > 0 ? "scale(1.12)" : "scale(1)",
            }}
            onClick={(e) => onRevealTap("safe", e)}
            tabIndex={showSafe ? 0 : -1}
            data-testid={`${testId}-safe-btn`}
          >
            <SafeIcon
              className={cn(
                "h-5 w-5 transition-transform",
                pastCommit && offset > 0 && "scale-125"
              )}
            />
            <span>{safeLabel}</span>
          </button>
        </div>
        <div className="flex-1" />
        <div
          className={cn(
            "flex h-full items-stretch justify-end",
            "bg-red-600 text-white",
            !showDestroy && "opacity-0"
          )}
          style={{ width: Math.max(0, -offset) }}
          data-testid={`${testId}-destroy-underlay`}
        >
          <button
            type="button"
            className={cn(
              "flex h-full min-w-[72px] flex-col items-center justify-center gap-0.5 px-3",
              "text-xs font-semibold tracking-wide"
            )}
            style={{
              transition: settling ? "transform 0.2s ease" : "transform 0.12s ease",
              transform: pastCommit && offset < 0 ? "scale(1.12)" : "scale(1)",
            }}
            onClick={(e) => onRevealTap("destroy", e)}
            tabIndex={showDestroy ? 0 : -1}
            data-testid={`${testId}-destroy-btn`}
          >
            <DestroyIcon
              className={cn(
                "h-5 w-5 transition-transform",
                pastCommit && offset < 0 && "scale-125"
              )}
            />
            <span>{destroyLabel}</span>
          </button>
        </div>
      </div>

      {/* Sliding content */}
      <div
        ref={contentRef}
        className={cn("relative z-10 bg-transparent", contentClassName)}
        style={{
          transform: offset !== 0 ? `translate3d(${offset}px,0,0)` : undefined,
          transition: settling
            ? "transform 0.28s cubic-bezier(0.22, 1.15, 0.36, 1)"
            : "none",
          willChange: offset !== 0 ? "transform" : undefined,
          touchAction: "pan-y",
        }}
        data-testid={`${testId}-content`}
        onClick={(e) => {
          // Tap content while revealed → close (don't fire row click until closed)
          if (Math.abs(offsetRef.current) > 8) {
            e.stopPropagation();
            e.preventDefault();
            closeRow(true);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

export { PEEK_STORAGE_KEY, UNDO_MS as SWIPE_UNDO_MS };
export default SwipeableRow;
