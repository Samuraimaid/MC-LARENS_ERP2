import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_SCROLL_ROOT = "main.erp-shell-main";
const DEFAULT_THRESHOLD = 72;
const DEFAULT_MAX_PULL = 128;
const DEFAULT_SETTLE = 52;
const TOP_EPSILON = 2;

function resolveScrollRoot(scrollRoot) {
  if (scrollRoot === null || scrollRoot === "window" || scrollRoot === "document") {
    return null;
  }
  if (typeof scrollRoot === "string") {
    return document.querySelector(scrollRoot);
  }
  if (scrollRoot && scrollRoot.current) return scrollRoot.current;
  if (scrollRoot instanceof Element) return scrollRoot;
  return document.querySelector(DEFAULT_SCROLL_ROOT);
}

function getScrollTop(root) {
  if (!root) {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }
  return root.scrollTop || 0;
}

/** Elastic resistance: further drag → diminishing travel (not 1:1). */
export function dampenPull(rawDy, maxPull = DEFAULT_MAX_PULL) {
  const x = Math.max(0, Number(rawDy) || 0);
  return maxPull * (1 - Math.exp(-x / (maxPull * 0.85)));
}

function fireHapticOnce(armedRef) {
  if (armedRef.current) return;
  armedRef.current = true;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(12);
    }
  } catch {
    /* no-op desktop / blocked */
  }
}

/**
 * Pull-to-refresh (touch-first) para listas que scrollean en
 * `main.erp-shell-main` (ERP shell) o en window (portales móviles).
 *
 * Requisitos U1 / video 01:
 * - Umbral: solo refresca al soltar pasado el threshold; abajo = snap back
 * - Resistencia elástica (no 1:1)
 * - Handoff stretch → spinner al cruzar umbral
 * - Haptic corto en umbral si navigator.vibrate
 * - Rubber-band al soltar (no hard stop)
 * - Scroll vivo mientras corre el fetch (no freeze / no blank)
 */
export function PullToRefresh({
  onRefresh,
  disabled = false,
  threshold = DEFAULT_THRESHOLD,
  maxPull = DEFAULT_MAX_PULL,
  settlePx = DEFAULT_SETTLE,
  scrollRoot = DEFAULT_SCROLL_ROOT,
  children,
  className,
  pullLabel = "Desliza para actualizar",
  releaseLabel = "Suelta para actualizar",
  refreshingLabel = "Actualizando…",
  testId = "pull-to-refresh",
}) {
  const wrapRef = useRef(null);
  const pullingRef = useRef(false);
  const startYRef = useRef(0);
  const pullRef = useRef(0);
  const hapticArmedRef = useRef(false);
  const refreshingRef = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const setPullBoth = useCallback((v) => {
    pullRef.current = v;
    setPull(v);
  }, []);

  const runRefresh = useCallback(async () => {
    if (refreshingRef.current || typeof onRefreshRef.current !== "function") return;
    refreshingRef.current = true;
    setRefreshing(true);
    setSettling(true);
    setPullBoth(settlePx);
    try {
      await onRefreshRef.current();
    } catch {
      /* caller toasts; always settle */
    } finally {
      // Rubber-band settle to 0 (CSS transition via settling=true)
      requestAnimationFrame(() => {
        setPullBoth(0);
        window.setTimeout(() => {
          setSettling(false);
          setRefreshing(false);
          refreshingRef.current = false;
          hapticArmedRef.current = false;
        }, 380);
      });
    }
  }, [settlePx, setPullBoth]);

  useEffect(() => {
    if (disabled || typeof onRefreshRef.current !== "function") return undefined;

    const isTouch = () =>
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0);

    // Touch-first: skip binding on pure desktop (no touch points)
    if (!isTouch()) return undefined;

    const getRoot = () => resolveScrollRoot(scrollRoot);

    const onTouchStart = (e) => {
      if (refreshingRef.current) return;
      if (!e.touches || e.touches.length !== 1) return;
      const root = getRoot();
      if (getScrollTop(root) > TOP_EPSILON) {
        pullingRef.current = false;
        return;
      }
      pullingRef.current = true;
      startYRef.current = e.touches[0].clientY;
      hapticArmedRef.current = false;
      setSettling(false);
    };

    const onTouchMove = (e) => {
      if (!pullingRef.current || refreshingRef.current) return;
      if (!e.touches || e.touches.length !== 1) return;
      const root = getRoot();
      const scrollTop = getScrollTop(root);
      const dy = e.touches[0].clientY - startYRef.current;

      // User scrolled away from top — abort pull
      if (scrollTop > TOP_EPSILON && dy <= 0) {
        pullingRef.current = false;
        setPullBoth(0);
        return;
      }

      if (dy <= 0 || scrollTop > TOP_EPSILON) {
        if (pullRef.current > 0) setPullBoth(0);
        return;
      }

      // Actively pulling: resist browser overscroll
      if (e.cancelable) e.preventDefault();

      const next = dampenPull(dy, maxPull);
      setPullBoth(next);
      if (next >= threshold) fireHapticOnce(hapticArmedRef);
    };

    const onTouchEnd = () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      const current = pullRef.current;
      if (current >= threshold && !refreshingRef.current) {
        runRefresh();
        return;
      }
      // Snap back below threshold (rubber-band via CSS)
      setSettling(true);
      setPullBoth(0);
      hapticArmedRef.current = false;
      window.setTimeout(() => setSettling(false), 320);
    };

    const onTouchCancel = () => {
      pullingRef.current = false;
      setSettling(true);
      setPullBoth(0);
      hapticArmedRef.current = false;
      window.setTimeout(() => setSettling(false), 320);
    };

    // Listen on scroll root (or document for window) so we catch gestures
    // even when the finger starts on list children.
    const root = getRoot();
    const target = root || document;
    const opts = { passive: false };
    target.addEventListener("touchstart", onTouchStart, { passive: true });
    target.addEventListener("touchmove", onTouchMove, opts);
    target.addEventListener("touchend", onTouchEnd, { passive: true });
    target.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      target.removeEventListener("touchstart", onTouchStart);
      target.removeEventListener("touchmove", onTouchMove, opts);
      target.removeEventListener("touchend", onTouchEnd);
      target.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [disabled, scrollRoot, threshold, maxPull, runRefresh, setPullBoth]);

  const pastThreshold = pull >= threshold || refreshing;
  const progress = Math.min(1, pull / threshold);
  const showIndicator = pull > 4 || refreshing;

  const label = refreshing
    ? refreshingLabel
    : pastThreshold
      ? releaseLabel
      : pullLabel;

  return (
    <div
      ref={wrapRef}
      className={cn("relative", className)}
      data-testid={testId}
      data-ptr-pull={Math.round(pull)}
      data-ptr-refreshing={refreshing ? "true" : "false"}
    >
      <div
        aria-hidden={!showIndicator}
        className={cn(
          "pointer-events-none absolute left-0 right-0 z-20 flex flex-col items-center justify-end",
          "overflow-hidden",
          !showIndicator && "opacity-0"
        )}
        style={{
          top: 0,
          height: Math.max(pull, refreshing ? settlePx : 0),
          transition: settling ? "height 0.35s cubic-bezier(0.22, 1.15, 0.36, 1)" : "none",
        }}
        data-testid={`${testId}-indicator`}
      >
        <div
          className={cn(
            "mb-2 flex items-center gap-2 rounded-full border border-white/20 dark:border-white/10",
            "bg-card/70 dark:bg-card/55 backdrop-blur-xl px-3 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
            "text-xs font-medium text-foreground/90"
          )}
        >
          <span
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-full",
              "bg-primary/10 text-primary transition-transform duration-200"
            )}
            style={{
              transform: refreshing
                ? "scale(1)"
                : `rotate(${Math.min(180, progress * 180)}deg) scale(${0.85 + progress * 0.15})`,
            }}
          >
            {pastThreshold ? (
              <Loader2
                className={cn("h-4 w-4", (refreshing || pastThreshold) && "animate-spin")}
                aria-hidden
              />
            ) : (
              <ArrowDown className="h-4 w-4" aria-hidden />
            )}
          </span>
          <span>{label}</span>
        </div>
      </div>

      <div
        style={{
          transform: pull > 0 || refreshing ? `translateY(${pull}px)` : undefined,
          transition: settling
            ? "transform 0.35s cubic-bezier(0.22, 1.15, 0.36, 1)"
            : "none",
          // Do NOT lock pointer-events / overflow while fetching — scroll stays alive
          willChange: pull > 0 || refreshing ? "transform" : undefined,
        }}
        data-testid={`${testId}-content`}
      >
        {children}
      </div>
    </div>
  );
}

export default PullToRefresh;
