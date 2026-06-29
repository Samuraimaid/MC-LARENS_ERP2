import { useCallback, useEffect, useRef } from "react";
import { KDS_REFRESH_EVENT } from "@/lib/kdsHelpers";

export function useKdsPolling(fetchFn, { intervalMs = 30000, enabled = true } = {}) {
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const runFetch = useCallback(async () => {
    if (!enabled) return;
    await fetchRef.current();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;

    runFetch();
    const interval = window.setInterval(runFetch, intervalMs);
    const onRefresh = () => {
      runFetch();
    };
    window.addEventListener(KDS_REFRESH_EVENT, onRefresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener(KDS_REFRESH_EVENT, onRefresh);
    };
  }, [enabled, intervalMs, runFetch]);

  return runFetch;
}