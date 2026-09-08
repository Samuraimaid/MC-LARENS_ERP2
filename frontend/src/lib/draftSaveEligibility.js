export const hasMeaningfulDraftContent = (snapshot) => {
  if (!snapshot || typeof snapshot !== "object") return false;

  // 1. Customer selected or customer search in progress
  if (snapshot.selectedCustomerId) return true;
  if (typeof snapshot.customerSearch === "string" && snapshot.customerSearch.trim() !== "") return true;

  // 2. New customer form in progress
  const customerDraft = snapshot.newCustomer || {};
  if (Object.entries(customerDraft).some(([k, v]) => {
    if (k === "customer_type" || k === "phone_prefix") return false;
    if (typeof v === "boolean") return v;
    return String(v || "").trim() !== "" && String(v) !== "0";
  })) {
    return true;
  }

  // 3. Vehicle selected or in progress
  if (snapshot.selectedVehicle) return true;
  if (snapshot.selectedVehicleData && typeof snapshot.selectedVehicleData === "object" && Object.keys(snapshot.selectedVehicleData).length > 0) return true;

  // 4. New vehicle form in progress
  const vehicleDraft = snapshot.newVehicle || {};
  if (Object.entries(vehicleDraft).some(([k, v]) => {
    if (k === "plate_prefix") return String(v || "").trim() !== "" && v !== "M";
    if (typeof v === "boolean") return v;
    return String(v || "").trim() !== "";
  })) {
    return true;
  }

  // 5. Cart items in progress
  if (Array.isArray(snapshot.cartItems) && snapshot.cartItems.length > 0) return true;

  // 6. Product search, notes, or discounts
  if (typeof snapshot.productSearch === "string" && snapshot.productSearch.trim() !== "") return true;
  if (typeof snapshot.notes === "string" && snapshot.notes.trim() !== "") return true;
  if (Number(snapshot.globalDiscount) > 0) return true;
  if (Array.isArray(snapshot.appliedDiscounts) && snapshot.appliedDiscounts.length > 0) return true;

  // 7. Payment or delivery configurations
  if (snapshot.paymentMethod && snapshot.paymentMethod !== "cash") return true;
  if (Array.isArray(snapshot.mixedPaymentMethods) && snapshot.mixedPaymentMethods.length > 0) return true;
  if (snapshot.logisticMode && snapshot.logisticMode !== "carryout") return true;
  if (snapshot.deliveryCost && String(snapshot.deliveryCost).trim() !== "" && String(snapshot.deliveryCost) !== "0") return true;
  if (snapshot.selectedMessengerId) return true;

  // 8. Tax / retention settings changed
  if (snapshot.applyIVA === true) return true;
  if (snapshot.applyRetention === true) return true;
  if (snapshot.currency && snapshot.currency !== "NIO") return true;

  // 9. Pricing tier or audit events
  if (snapshot.activePriceTier && snapshot.activePriceTier !== "precio1") return true;
  if (Array.isArray(snapshot.auditEvents) && snapshot.auditEvents.length > 0) return true;

  return false;
};

/**
 * A sale/quote draft is eligible for persistence if it contains any meaningful form data.
 */
export const isSaleDraftSaveEligible = (snapshot) => {
  return hasMeaningfulDraftContent(snapshot);
};

export const isPersistedDraftSnapshot = (snapshot) => isSaleDraftSaveEligible(snapshot);