import { isErpDraftSupervisor } from "@/lib/erpDesignSystem";

export const SELLER_GLOBAL_DISCOUNT_MAX_PERCENT = 2;
export const SELLER_GLOBAL_DISCOUNT_MAX_NIO = 500;

export function normalizeDraftReview(raw) {
  const base = {
    status: "idle",
    watching_by_user_id: null,
    watching_by_name: null,
    blocked_by_user_id: null,
    blocked_by_name: null,
    blocked_at: null,
    released_at: null,
    released_by_user_id: null,
    released_by_name: null,
    supervisor_changed: false,
    locked_product_ids: [],
    seller_added_product_ids: [],
  };
  if (!raw || typeof raw !== "object") return base;
  const status = String(raw.status || "idle").toLowerCase();
  return {
    ...base,
    ...raw,
    status: ["idle", "watching", "blocked", "released"].includes(status) ? status : "idle",
    supervisor_changed: Boolean(raw.supervisor_changed),
    locked_product_ids: Array.isArray(raw.locked_product_ids) ? raw.locked_product_ids.map(String) : [],
    seller_added_product_ids: Array.isArray(raw.seller_added_product_ids)
      ? raw.seller_added_product_ids.map(String)
      : [],
  };
}

export function isDraftBlockedForSeller(review) {
  return normalizeDraftReview(review).status === "blocked";
}

export function isDraftReleasedWithRestrictions(review) {
  const normalized = normalizeDraftReview(review);
  return normalized.status === "released" && normalized.supervisor_changed;
}

export function isDraftSupervisorTouched(review) {
  return normalizeDraftReview(review).supervisor_changed;
}

export function canSellerOpenDraft(tab, review, currentUserId, userRole) {
  if (!tab) return false;
  const isOwn = !tab.ownerUserId || String(tab.ownerUserId) === String(currentUserId || "");
  if (!isOwn) return isErpDraftSupervisor(userRole);
  return !isDraftBlockedForSeller(review);
}

export function canSellerDeleteDraft(tab, review, currentUserId, userRole) {
  if (!tab) return false;
  const isOwn = !tab.ownerUserId || String(tab.ownerUserId) === String(currentUserId || "");
  if (!isOwn) return isErpDraftSupervisor(userRole);
  if (isErpDraftSupervisor(userRole)) return true;
  return !isDraftSupervisorTouched(review);
}

export function getSellerCartLineLockState(productId, review) {
  const normalized = normalizeDraftReview(review);
  if (!normalized.supervisor_changed || normalized.status !== "released") {
    return { locked: false, deletable: true };
  }
  const pid = String(productId || "");
  const lockedIds = new Set(normalized.locked_product_ids.map(String));
  const sellerAddedIds = new Set(normalized.seller_added_product_ids.map(String));
  if (sellerAddedIds.has(pid)) {
    return { locked: false, deletable: true };
  }
  if (lockedIds.has(pid)) {
    return { locked: true, deletable: false };
  }
  return { locked: false, deletable: false };
}

export function getSellerGlobalDiscountLimit({ mode = "percent", currency = "NIO", exchangeRate = 36.5, subtotal = 0 }) {
  const rate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 36.5;
  const normalizedMode = mode === "fixed" ? "fixed" : "percent";
  if (normalizedMode === "fixed") {
    return currency === "USD" ? Number((SELLER_GLOBAL_DISCOUNT_MAX_NIO / rate).toFixed(2)) : SELLER_GLOBAL_DISCOUNT_MAX_NIO;
  }
  const percentCap = SELLER_GLOBAL_DISCOUNT_MAX_PERCENT;
  const amountCap = currency === "USD"
    ? Number((SELLER_GLOBAL_DISCOUNT_MAX_NIO / rate).toFixed(2))
    : SELLER_GLOBAL_DISCOUNT_MAX_NIO;
  const subtotalNum = Math.max(0, Number(subtotal) || 0);
  const percentAsAmount = subtotalNum > 0 ? subtotalNum * (percentCap / 100) : amountCap;
  return Math.min(percentCap, subtotalNum > 0 ? (amountCap / subtotalNum) * 100 : percentCap);
}

export function clampSellerGlobalDiscount({
  value,
  mode = "percent",
  currency = "NIO",
  exchangeRate = 36.5,
  subtotal = 0,
  isSupervisor = false,
}) {
  const numericValue = Math.max(0, Number(value) || 0);
  if (isSupervisor) return numericValue;
  const limit = getSellerGlobalDiscountLimit({ mode, currency, exchangeRate, subtotal });
  if (mode === "fixed") {
    return Math.min(numericValue, limit);
  }
  return Math.min(numericValue, limit);
}

export function sellerGlobalDiscountExceeded({
  value,
  mode = "percent",
  currency = "NIO",
  exchangeRate = 36.5,
  subtotal = 0,
  isSupervisor = false,
}) {
  if (isSupervisor) return false;
  const numericValue = Math.max(0, Number(value) || 0);
  const limit = getSellerGlobalDiscountLimit({ mode, currency, exchangeRate, subtotal });
  if (mode === "fixed") {
    return numericValue > limit + 0.0001;
  }
  return numericValue > limit + 0.0001;
}

export function detectReviewTransition(prevReview, nextReview) {
  const prev = normalizeDraftReview(prevReview);
  const next = normalizeDraftReview(nextReview);
  if (prev.status !== "blocked" && next.status === "blocked") {
    return "blocked";
  }
  if (prev.status !== "released" && next.status === "released") {
    return "released";
  }
  if (prev.status === "blocked" && next.status !== "blocked") {
    return "unblocked";
  }
  return null;
}

export function mergeDraftTabsWithReview(serverDrafts, currentTabs = []) {
  const currentById = new Map((currentTabs || []).map((tab) => [tab.id, tab]));
  return (Array.isArray(serverDrafts) ? serverDrafts : []).map((draft) => {
    const existing = currentById.get(draft.id) || {};
    return {
      id: draft.id,
      name: draft.name || existing.name,
      updatedAt: draft.updatedAt || existing.updatedAt,
      ownerUserId: draft.owner_user_id || existing.ownerUserId || null,
      ownerName: draft.owner_name || existing.ownerName || null,
      review: normalizeDraftReview(draft.review),
      snapshotUpdatedAt: draft.snapshot?.updatedAt || existing.snapshotUpdatedAt || null,
    };
  });
}