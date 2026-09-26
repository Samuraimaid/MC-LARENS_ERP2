import { useEffect } from "react";
import { isAutosaveDirty } from "@/lib/autosaveStatus";
import {
  drainOfflineDraftQueue,
  getOfflineDraftQueueCount,
} from "@/lib/offlineDraftQueue";

const WORKBENCH_TABS = new Set(["catalog", "sales", "quotations"]);
const WORKBENCH_MODES = new Set(["sale-pick", "quote-pick"]);

let internalWorkbenchNavUntil = 0;

/** Same-origin /workbench tab catalog, sales, or quotations (optional sale-pick / quote-pick). */
export function isInternalWorkbenchDestination(url) {
  if (typeof window === "undefined" || !url) return false;
  try {
    const next = new URL(url, window.location.origin);
    if (next.origin !== window.location.origin) return false;
    const path = next.pathname.replace(/\/+$/, "") || "/";
    if (path !== "/workbench") return false;
    const tab = next.searchParams.get("tab") || "";
    if (!WORKBENCH_TABS.has(tab)) return false;
    const mode = next.searchParams.get("mode");
    if (mode && !WORKBENCH_MODES.has(mode)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Skip the leave-site prompt for this same-origin workbench hop. Dirty flag stays. */
export function markInternalWorkbenchNavigation(url) {
  if (!isInternalWorkbenchDestination(url)) return false;
  internalWorkbenchNavUntil = Date.now() + 4000;
  return true;
}

function shouldSkipUnloadPrompt() {
  return Date.now() < internalWorkbenchNavUntil;
}

/**
 * beforeunload when dirty unsaved draft or offline queue not drained.
 * Also drains queue on browser online.
 * Internal workbench hops (catalog / sales / quotations) do not set returnValue.
 */
export function useAutosaveLifecycle({ enabled = true } = {}) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    const shouldBlockUnload = () =>
      isAutosaveDirty() || getOfflineDraftQueueCount() > 0;

    const handleLinkClick = (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor || (anchor.target && anchor.target !== "_self")) return;
      markInternalWorkbenchNavigation(anchor.href);
    };

    const handleBeforeUnload = (event) => {
      if (shouldSkipUnloadPrompt()) return undefined;
      if (!shouldBlockUnload()) return undefined;
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    const handleOnline = () => {
      drainOfflineDraftQueue().catch(() => {});
    };

    window.addEventListener("click", handleLinkClick, true);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("online", handleOnline);

    if (typeof navigator !== "undefined" && navigator.onLine !== false) {
      drainOfflineDraftQueue().catch(() => {});
    }

    return () => {
      window.removeEventListener("click", handleLinkClick, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled]);
}

export default useAutosaveLifecycle;
