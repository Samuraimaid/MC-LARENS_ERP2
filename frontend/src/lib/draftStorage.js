export function loadLocalDraftState(listKey, activeKey) {
  if (typeof window === "undefined") {
    return { draftTabs: [], activeDraftId: null };
  }
  try {
    const storedTabs = JSON.parse(window.localStorage.getItem(listKey) || "[]");
    const storedActive = window.localStorage.getItem(activeKey);
    return {
      draftTabs: Array.isArray(storedTabs) ? storedTabs : [],
      activeDraftId: storedActive || (storedTabs?.[0]?.id ?? null),
    };
  } catch (error) {
    return { draftTabs: [], activeDraftId: null };
  }
}

function getSnapshotUpdatedAtMs(value) {
  if (!value) return 0;
  try {
    const draft = typeof value === "string" ? JSON.parse(value) : value;
    const parsed = Date.parse(String(draft?.updatedAt || ""));
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (error) {
    return 0;
  }
}

function isSupervisorControlledReview(review) {
  if (!review || typeof review !== "object") return false;
  const status = String(review.status || "").toLowerCase();
  if (status === "blocked") return true;
  if (status === "released" && review.supervisor_changed) return true;
  return false;
}

function shouldReplaceLocalSnapshot(currentValue, incomingSnapshot, draftMeta = {}) {
  if (!currentValue) return true;

  const incomingAt = getSnapshotUpdatedAtMs(incomingSnapshot);
  const currentAt = getSnapshotUpdatedAtMs(currentValue);

  if (incomingAt > currentAt) return true;
  if (incomingAt < currentAt) return false;

  if (isSupervisorControlledReview(draftMeta.review)) {
    return true;
  }

  const draftUpdatedAt = Date.parse(String(draftMeta.updatedAt || ""));
  if (Number.isFinite(draftUpdatedAt) && draftUpdatedAt > currentAt) {
    return true;
  }

  return getDraftCompletenessScore(incomingSnapshot) >= getDraftCompletenessScore(currentValue);
}

function getDraftCompletenessScore(value) {
  if (!value) return 0;
  try {
    const draft = typeof value === "string" ? JSON.parse(value) : value;
    if (!draft || typeof draft !== "object") return 0;

    let score = 0;
    if (draft.selectedCustomerId) score += 4;
    if (draft.selectedVehicle) score += 3;
    if (draft.selectedVehicleData && typeof draft.selectedVehicleData === "object") score += 2;
    if (draft.selectedWarehouse) score += 1;
    if (draft.paymentMethod && draft.paymentMethod !== "cash") score += 1;
    if (Array.isArray(draft.cartItems) && draft.cartItems.length > 0) score += 6 + Math.min(draft.cartItems.length, 5);
    if (Number(draft.globalDiscount) > 0) score += 2;
    if ((draft.globalDiscountMode || "percent") !== "percent") score += 1;
    if (Array.isArray(draft.appliedDiscounts) && draft.appliedDiscounts.length > 0) score += 2 + draft.appliedDiscounts.length;
    if (draft.notes) score += 1;
    if (draft.customerSearch) score += 1;
    if (draft.productSearch) score += 1;
    if (draft.applyIVA === false) score += 1;
    if (draft.applyRetention) score += 1;
    return score;
  } catch (error) {
    return 0;
  }
}

export function mirrorServerDraftsToLocalStorage({
  listKey,
  activeKey,
  draftKeyPrefix,
  drafts,
  activeDraftId,
  allowEmptyOverwrite = false,
}) {
  if (typeof window === "undefined") return;

  const serverDrafts = Array.isArray(drafts) ? drafts : [];
  if (!allowEmptyOverwrite && serverDrafts.length === 0) {
    return;
  }

  const tabs = serverDrafts.map((draft, index) => ({
    id: draft.id,
    name: draft.name || `Borrador ${index + 1}`,
    updatedAt: draft.updatedAt || new Date().toISOString(),
    ownerUserId: draft.owner_user_id || null,
    ownerName: draft.owner_name || null,
    review: draft.review && typeof draft.review === "object" ? draft.review : undefined,
  }));

  window.localStorage.setItem(listKey, JSON.stringify(tabs));
  if (activeDraftId) {
    window.localStorage.setItem(activeKey, activeDraftId);
  } else {
    window.localStorage.removeItem(activeKey);
  }

  serverDrafts.forEach((draft) => {
    if (!draft?.id) return;
    const storageKey = `${draftKeyPrefix}${draft.id}`;
    const incomingSnapshot = draft.snapshot || {};
    const currentValue = window.localStorage.getItem(storageKey);
    const shouldReplace = shouldReplaceLocalSnapshot(currentValue, incomingSnapshot, draft);
    if (shouldReplace) {
      window.localStorage.setItem(storageKey, JSON.stringify(incomingSnapshot));
    }
  });
}

export function getDraftSnapshotFingerprint(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return "";
  const cart = Array.isArray(snapshot.cartItems)
    ? snapshot.cartItems
      .map((item) => [
        item?.product_id,
        item?.quantity,
        item?.unit_price,
        item?.discount,
      ].join(":"))
      .sort()
      .join("|")
    : "";
  return [
    snapshot.updatedAt || "",
    snapshot.selectedCustomerId || "",
    snapshot.selectedVehicle || "",
    snapshot.vehicleFlowOption || "",
    cart,
    snapshot.globalDiscount || 0,
    snapshot.globalDiscountMode || "percent",
  ].join("::");
}