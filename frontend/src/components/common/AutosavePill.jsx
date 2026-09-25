import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CloudOff,
  Loader2,
  PenLine,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AUTOSAVE_DEBOUNCE_MS,
  AUTOSAVE_QUEUE_EVENT,
  AUTOSAVE_STATUS,
  AUTOSAVE_STATUS_ERROR_DETAIL_ES,
  AUTOSAVE_STATUS_EVENT,
  getAutosaveStatusLabel,
} from "@/lib/autosaveStatus";
import {
  drainOfflineDraftQueue,
  getOfflineDraftQueueCount,
  isBrowserOffline,
} from "@/lib/offlineDraftQueue";

/**
 * Liquid Glass autosave status pill (U5 / video 05).
 * Escribiendo… / Guardando… / Guardado / Sin conexión / Error · Reintentar
 * "Guardado" only after server confirm (SYNCED).
 */
export default function AutosavePill({
  className,
  sourceFilter = null,
  visibleWhenIdle = false,
  onRetry = null,
  testId = "autosave-pill",
}) {
  const [status, setStatus] = useState(AUTOSAVE_STATUS.IDLE);
  const [queueCount, setQueueCount] = useState(() => getOfflineDraftQueueCount());
  const [detail, setDetail] = useState("");
  const [busyRetry, setBusyRetry] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onStatus = (event) => {
      const next = event?.detail?.status;
      if (!next) return;
      const src = event?.detail?.source;
      if (sourceFilter && src && src !== sourceFilter) return;
      setStatus(next);
      if (next === AUTOSAVE_STATUS.ERROR) {
        setDetail(event?.detail?.message || AUTOSAVE_STATUS_ERROR_DETAIL_ES);
      } else {
        setDetail("");
      }
      if (typeof event?.detail?.queueCount === "number") {
        setQueueCount(event.detail.queueCount);
      }
    };

    const onQueue = (event) => {
      if (typeof event?.detail?.count === "number") {
        setQueueCount(event.detail.count);
      } else {
        setQueueCount(getOfflineDraftQueueCount());
      }
    };

    const onOnline = () => {
      drainOfflineDraftQueue().catch(() => {});
    };
    const onOffline = () => {
      setStatus(AUTOSAVE_STATUS.OFFLINE);
    };

    window.addEventListener(AUTOSAVE_STATUS_EVENT, onStatus);
    window.addEventListener(AUTOSAVE_QUEUE_EVENT, onQueue);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    if (isBrowserOffline()) {
      setStatus(AUTOSAVE_STATUS.OFFLINE);
    }
    setQueueCount(getOfflineDraftQueueCount());

    return () => {
      window.removeEventListener(AUTOSAVE_STATUS_EVENT, onStatus);
      window.removeEventListener(AUTOSAVE_QUEUE_EVENT, onQueue);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [sourceFilter]);

  const handleRetry = useCallback(async () => {
    if (busyRetry) return;
    setBusyRetry(true);
    try {
      if (typeof onRetry === "function") {
        await onRetry();
      } else {
        await drainOfflineDraftQueue();
      }
    } finally {
      setBusyRetry(false);
    }
  }, [busyRetry, onRetry]);

  const effective =
    isBrowserOffline() && status !== AUTOSAVE_STATUS.SYNCING
      ? AUTOSAVE_STATUS.OFFLINE
      : status;

  const label = getAutosaveStatusLabel(effective);
  const showSynced = effective === AUTOSAVE_STATUS.SYNCED;
  const isPureIdle = !label || effective === AUTOSAVE_STATUS.IDLE;
  if (!visibleWhenIdle && isPureIdle && !showSynced && queueCount === 0) {
    return null;
  }

  let Icon = Check;
  let tone =
    "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  let iconSpin = false;

  switch (effective) {
    case AUTOSAVE_STATUS.TYPING:
    case AUTOSAVE_STATUS.SAVING:
      Icon = PenLine;
      tone = "border-violet-500/35 bg-violet-500/10 text-violet-800 dark:text-violet-200";
      break;
    case AUTOSAVE_STATUS.SYNCING:
    case AUTOSAVE_STATUS.RECOVERING:
      Icon = Loader2;
      tone = "border-sky-500/35 bg-sky-500/10 text-sky-800 dark:text-sky-200";
      iconSpin = true;
      break;
    case AUTOSAVE_STATUS.OFFLINE:
    case AUTOSAVE_STATUS.DISCONNECTED:
      Icon = CloudOff;
      tone = "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100";
      break;
    case AUTOSAVE_STATUS.ERROR:
      Icon = AlertCircle;
      tone = "border-destructive/40 bg-destructive/10 text-destructive";
      break;
    case AUTOSAVE_STATUS.SYNCED:
    default:
      Icon = Check;
      tone = "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
      break;
  }

  const showRetry =
    effective === AUTOSAVE_STATUS.ERROR ||
    ((effective === AUTOSAVE_STATUS.OFFLINE || effective === AUTOSAVE_STATUS.DISCONNECTED) &&
      queueCount > 0);

  const displayLabel = label || (showSynced ? "Guardado" : "");

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm",
        "backdrop-blur-xl bg-background/70 supports-[backdrop-filter]:bg-background/55",
        "erp-liquid-panel animate-fade-up-soft",
        tone,
        className
      )}
      role="status"
      aria-live="polite"
      title={
        effective === AUTOSAVE_STATUS.ERROR
          ? detail || AUTOSAVE_STATUS_ERROR_DETAIL_ES
          : queueCount > 0
            ? `${displayLabel} · cola ${queueCount}`
            : `${displayLabel} · debounce ${AUTOSAVE_DEBOUNCE_MS}ms`
      }
      data-testid={testId}
      data-autosave-status={effective}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", iconSpin && "animate-spin")} aria-hidden />
      <span>{displayLabel}</span>
      {queueCount > 0 ? (
        <span
          className="ml-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-foreground/10 px-1 text-[10px] font-semibold tabular-nums"
          data-testid={`${testId}-queue-badge`}
          title={`${queueCount} en cola offline`}
        >
          {queueCount}
        </span>
      ) : null}
      {showRetry ? (
        <button
          type="button"
          className="ml-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold hover:bg-foreground/10 disabled:opacity-60"
          onClick={handleRetry}
          disabled={busyRetry}
          data-testid={`${testId}-retry`}
          aria-label="Reintentar guardado"
        >
          <RefreshCw className={cn("h-3 w-3", busyRetry && "animate-spin")} />
          Reintentar
        </button>
      ) : null}
    </div>
  );
}
