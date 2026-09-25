import { useEffect } from "react";
import { isAutosaveDirty } from "@/lib/autosaveStatus";
import {
  drainOfflineDraftQueue,
  getOfflineDraftQueueCount,
} from "@/lib/offlineDraftQueue";

/**
 * beforeunload when dirty unsaved draft or offline queue not drained.
 * Also drains queue on browser online.
 */
export function useAutosaveLifecycle({ enabled = true } = {}) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    const shouldBlockUnload = () =>
      isAutosaveDirty() || getOfflineDraftQueueCount() > 0;

    const handleBeforeUnload = (event) => {
      if (!shouldBlockUnload()) return undefined;
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    const handleOnline = () => {
      drainOfflineDraftQueue().catch(() => {});
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("online", handleOnline);

    if (typeof navigator !== "undefined" && navigator.onLine !== false) {
      drainOfflineDraftQueue().catch(() => {});
    }

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled]);
}

export default useAutosaveLifecycle;
