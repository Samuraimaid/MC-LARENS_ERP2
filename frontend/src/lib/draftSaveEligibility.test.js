import { describe, expect, it } from "vitest";
import { isSaleDraftSaveEligible } from "./draftSaveEligibility";

describe("isSaleDraftSaveEligible", () => {
  it("rejects drafts without customer", () => {
    expect(isSaleDraftSaveEligible({ vehicleFlowOption: "carryout", isVehiclePickerVisible: false })).toBe(false);
  });

  it("rejects customer-only drafts while vehicle picker is open", () => {
    expect(isSaleDraftSaveEligible({
      selectedCustomerId: "c1",
      vehicleFlowOption: "carryout",
      isVehiclePickerVisible: true,
    })).toBe(false);
  });

  it("accepts carryout after picker is dismissed", () => {
    expect(isSaleDraftSaveEligible({
      selectedCustomerId: "c1",
      vehicleFlowOption: "carryout",
      isVehiclePickerVisible: false,
    })).toBe(true);
  });

  it("accepts registered vehicle drafts", () => {
    expect(isSaleDraftSaveEligible({
      selectedCustomerId: "c1",
      vehicleFlowOption: "registered",
      selectedVehicle: "v1",
      isVehiclePickerVisible: false,
    })).toBe(true);
  });

  it("accepts new vehicle dialog flow", () => {
    expect(isSaleDraftSaveEligible({
      selectedCustomerId: "c1",
      vehicleFlowOption: "new",
      showNewVehicleDialog: true,
    })).toBe(true);
  });
});