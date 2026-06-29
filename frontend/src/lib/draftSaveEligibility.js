const hasMeaningfulNewVehicleDraft = (snapshot) => {
  const vehicleDraft = snapshot?.newVehicle || {};
  return Object.entries(vehicleDraft).some(([key, value]) => {
    if (key === "plate_prefix") {
      return String(value || "").trim() !== "" && value !== "M";
    }
    if (typeof value === "boolean") return value;
    return String(value || "").trim() !== "";
  });
};

/**
 * A sale/quote draft may be persisted only after step 1 (customer)
 * and step 2 (vehicle, carryout, or new vehicle flow) are complete.
 */
export const isSaleDraftSaveEligible = (snapshot) => {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (!snapshot.selectedCustomerId) return false;

  const flow = snapshot.vehicleFlowOption || "carryout";

  if (snapshot.showNewVehicleDialog || flow === "new") {
    return true;
  }

  if (flow === "registered") {
    return Boolean(snapshot.selectedVehicle);
  }

  if (flow === "carryout") {
    if (snapshot.isVehiclePickerVisible === false) return true;
    if (snapshot.isVehiclePickerVisible === undefined) {
      return Boolean(snapshot.selectedVehicle) || hasMeaningfulNewVehicleDraft(snapshot);
    }
    return false;
  }

  return false;
};

export const isPersistedDraftSnapshot = (snapshot) => isSaleDraftSaveEligible(snapshot);