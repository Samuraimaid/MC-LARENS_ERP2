/**
 * U10 — Optimistic UI boundaries (video 10).
 *
 * SAFE (optimistic OK): pin / star / soft activate-deactivate / notification prefs /
 * theme-adjacent toggles — apply local state immediately → API → rollback + ES toast on fail.
 *
 * NEVER optimistic: Pay, Transfer, hard Delete, payments/collect, warehouse transfers,
 * PIN unlock, billing exchange / taxes — wait for server truth and show «Procesando…».
 * Do not use this helper on those paths.
 */

import { toast } from "sonner";

export const OPTIMISTIC_SAFE = Object.freeze({
  TOGGLE: "toggle",
  PIN: "pin",
  STAR: "star",
  SOFT_ACTIVATE: "soft_activate",
  PREFS: "prefs",
});

/** Categories that must never call optimisticUpdate. Documented for audits. */
export const OPTIMISTIC_FORBIDDEN = Object.freeze({
  PAY: "pay",
  TRANSFER: "transfer",
  HARD_DELETE: "hard_delete",
  COLLECT: "collect",
  PIN_UNLOCK: "pin_unlock",
  BILLING_EXCHANGE: "billing_exchange",
});

const DEFAULT_ERROR_ES = "No se pudo guardar el cambio";

/**
 * Apply local UI immediately, run the request, rollback + Spanish error toast on failure.
 *
 * @param {object} opts
 * @param {() => void} opts.apply — mutate local state now
 * @param {() => (void|Promise<void>)} opts.request — server call
 * @param {() => void} opts.rollback — restore previous local state
 * @param {string} [opts.errorMessage] — Spanish toast on failure
 * @param {() => (void|Promise<void>)} [opts.onSuccess] — after successful request
 * @param {boolean} [opts.rethrow=false] — rethrow after rollback/toast
 * @returns {Promise<boolean>} true if request succeeded
 */
export async function optimisticUpdate({
  apply,
  request,
  rollback,
  errorMessage = DEFAULT_ERROR_ES,
  onSuccess,
  rethrow = false,
} = {}) {
  if (typeof apply !== "function" || typeof request !== "function" || typeof rollback !== "function") {
    throw new Error("optimisticUpdate requires apply, request, and rollback");
  }

  apply();

  try {
    await request();
    if (typeof onSuccess === "function") {
      await onSuccess();
    }
    return true;
  } catch (err) {
    try {
      rollback();
    } catch {
      /* ignore rollback errors — still surface the original failure */
    }
    const detail = err?.response?.data?.detail;
    let message = errorMessage;
    if (typeof detail === "string" && detail.trim()) {
      message = detail.trim();
    } else if (detail && typeof detail === "object" && typeof detail.message === "string" && detail.message.trim()) {
      message = detail.message.trim();
    }
    toast.error(message);
    if (rethrow) throw err;
    return false;
  }
}

/**
 * Dev/audit guard — throws if a forbidden category is passed.
 * Call at the top of money/transfer handlers so regressions fail loudly in tests.
 */
export function assertNotOptimistic(category, context = "") {
  const banned = Object.values(OPTIMISTIC_FORBIDDEN);
  if (banned.includes(category)) {
    const where = context ? ` (${context})` : "";
    throw new Error(
      `U10: «${category}» must never use optimistic UI${where}. Wait for server + show Procesando…`
    );
  }
}
