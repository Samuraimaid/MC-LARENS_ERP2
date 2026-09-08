import { describe, expect, it } from "vitest";
import { isSaleDraftSaveEligible } from "./draftSaveEligibility";

describe("isSaleDraftSaveEligible", () => {
  it("rejects completely empty drafts", () => {
    expect(isSaleDraftSaveEligible({})).toBe(false);
    expect(isSaleDraftSaveEligible({ updatedAt: new Date().toISOString() })).toBe(false);
  });

  it("accepts drafts with only cart items (no customer yet)", () => {
    expect(isSaleDraftSaveEligible({
      cartItems: [{ product_id: "prod_1", quantity: 2, unit_price: 100 }],
    })).toBe(true);
  });

  it("accepts customer-only drafts while vehicle picker is open", () => {
    expect(isSaleDraftSaveEligible({
      selectedCustomerId: "c1",
      vehicleFlowOption: "carryout",
      isVehiclePickerVisible: true,
    })).toBe(true);
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

  it("accepts new customer in progress", () => {
    expect(isSaleDraftSaveEligible({
      newCustomer: { first_name: "Juan", phone: "88888888" },
    })).toBe(true);
  });

  it("accepts new vehicle dialog flow", () => {
    expect(isSaleDraftSaveEligible({
      selectedCustomerId: "c1",
      vehicleFlowOption: "new",
      showNewVehicleDialog: true,
    })).toBe(true);
  });

  it("accepts notes, discounts, or delivery details", () => {
    expect(isSaleDraftSaveEligible({ notes: "Entrega urgente por la tarde" })).toBe(true);
    expect(isSaleDraftSaveEligible({ globalDiscount: 5 })).toBe(true);
    expect(isSaleDraftSaveEligible({ logisticMode: "delivery", deliveryCost: "50" })).toBe(true);
  });
});