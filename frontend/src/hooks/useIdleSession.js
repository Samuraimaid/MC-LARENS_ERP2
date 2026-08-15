import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { API_BASE as API } from "@/lib/api";

/** How many seconds before idle timeout to start warning. */
export function warnWindowSeconds(idleMinutes) {
  const idleSec = Math.max(60, Math.round(Number(idleMinutes) || 60) * 60);
  // Ventas 5 min → last 90s; short policies → ~30% of idle, capped
  if (idleSec <= 5 * 60) return 90;
  if (idleSec <= 15 * 60) return 120;
  if (idleSec <= 30 * 60) return 150;
  return 180; // last 3 min for 1h roles
}

export function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Fluid display with centiseconds (for 7-segment idle UI). */
export function formatCountdownMs(remainingMs) {
  const totalMs = Math.max(0, Number(remainingMs) || 0);
  const totalSeconds = Math.floor(totalMs / 1000);
  const centiseconds = Math.floor((totalMs % 1000) / 10);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, "0");
  const cc = String(centiseconds).padStart(2, "0");
  if (minutes > 0) {
    return `${minutes}:${ss}.${cc}`;
  }
  return `${ss}.${cc}`;
}

/**
 * Client-side idle tracking aligned with server session_policy.idle_minutes.
 * On expire, caller should logout (free shared terminal) rather than lock with PIN.
 */
export function useIdleSession({
  enabled = true,
  idleMinutes = 60,
  paused = false,
  onExpire,
  heartbeatOnStay = true,
} = {}) {
  const idleMs = Math.max(60_000, Math.round(Number(idleMinutes) || 60) * 60_000);
  const warnSec = warnWindowSeconds(idleMinutes);
  const warnMs = warnSec * 1000;

  const [now, setNow] = useState(() => Date.now());
  const lastActivityRef = useRef(Date.now());
  const lastHeartbeatRef = useRef(0);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const markActivity = useCallback(
    (opts = {}) => {
      if (!enabled || paused) return;
      lastActivityRef.current = Date.now();
      expiredRef.current = false;

      if (!heartbeatOnStay) return;
      const force = Boolean(opts.forceHeartbeat);
      const sinceHb = Date.now() - lastHeartbeatRef.current;
      // Keep server last_seen fresh (server throttle ~30s)
      if (force || sinceHb >= 25_000) {
        lastHeartbeatRef.current = Date.now();
        axios
          .get(`${API}/auth/me`, { withCredentials: true, timeout: 8000 })
          .catch(() => {
            // 401 handled by AuthContext interceptor
          });
      }
    },
    [enabled, paused, heartbeatOnStay],
  );

  const stayActive = useCallback(async () => {
    lastActivityRef.current = Date.now();
    expiredRef.current = false;
    lastHeartbeatRef.current = Date.now();
    try {
      await axios.get(`${API}/auth/me`, { withCredentials: true, timeout: 8000 });
      return true;
    } catch {
      return false;
    }
  }, []);

  // Reset when idle policy or enable changes (e.g. re-login)
  useEffect(() => {
    if (!enabled) return;
    lastActivityRef.current = Date.now();
    expiredRef.current = false;
    setNow(Date.now());
  }, [enabled, idleMinutes]);

  // Activity listeners
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    let throttleTimer = null;
    const onActivity = () => {
      if (paused) return;
      if (throttleTimer) return;
      throttleTimer = window.setTimeout(() => {
        throttleTimer = null;
      }, 800);
      markActivity();
    };

    const events = ["pointerdown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true, capture: true }));

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Returning to tab: do not auto-extend silently for ventas shared PCs;
        // still refresh clock so countdown is accurate.
        setNow(Date.now());
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onActivity, { capture: true }));
      document.removeEventListener("visibilitychange", onVisibility);
      if (throttleTimer) window.clearTimeout(throttleTimer);
    };
  }, [enabled, paused, markActivity]);

  // 0.01s tick while in warning window for fluid 7-seg; 1s otherwise to save CPU
  useEffect(() => {
    if (!enabled) return undefined;
    let id = null;
    const schedule = () => {
      if (id != null) window.clearInterval(id);
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = idleMs - elapsed;
      const inWarn = remaining <= warnMs + 2000;
      id = window.setInterval(() => setNow(Date.now()), inWarn ? 10 : 1000);
    };
    schedule();
    // Re-evaluate interval cadence every second
    const cadenceId = window.setInterval(schedule, 1000);
    return () => {
      if (id != null) window.clearInterval(id);
      window.clearInterval(cadenceId);
    };
  }, [enabled, idleMs, warnMs]);

  const elapsed = now - lastActivityRef.current;
  const remainingMs = Math.max(0, idleMs - elapsed);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const isWarning = enabled && !paused && remainingMs <= warnMs && remainingMs > 0;
  const isCritical = isWarning && remainingSeconds <= 30;
  const isExpired = enabled && !paused && remainingMs <= 0;

  useEffect(() => {
    if (!isExpired || expiredRef.current) return;
    expiredRef.current = true;
    onExpireRef.current?.();
  }, [isExpired]);

  return useMemo(
    () => ({
      idleMinutes: Math.round(idleMs / 60_000),
      warnSeconds: warnSec,
      remainingSeconds,
      remainingMs,
      isWarning,
      isCritical,
      isExpired,
      markActivity,
      stayActive,
      formatRemaining: formatCountdown(remainingSeconds),
      formatRemainingFluid: formatCountdownMs(remainingMs),
    }),
    [
      idleMs,
      warnSec,
      remainingSeconds,
      remainingMs,
      isWarning,
      isCritical,
      isExpired,
      markActivity,
      stayActive,
    ],
  );
}
