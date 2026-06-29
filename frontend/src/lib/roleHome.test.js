import { describe, expect, it } from "vitest";
import {
  ROLE_HOME_MATRIX,
  canAccessCashier,
  getRoleHomePath,
  isCashierKioskRole,
  isCashierRole,
  isSellerRole,
  usesRestrictedNavigation,
} from "./roleHome";

describe("roleHome routing policy", () => {
  it("keeps gerencia out of cashier kiosk mode", () => {
    expect(isCashierRole("gerencia")).toBe(false);
    expect(isCashierKioskRole("gerencia")).toBe(false);
    expect(canAccessCashier("gerencia")).toBe(true);
    expect(usesRestrictedNavigation("gerencia")).toBe(false);
    expect(getRoleHomePath("gerencia")).toBe("/workbench");
  });

  it("routes Xinon-like gerencia user to workbench, not cashier", () => {
    expect(getRoleHomePath("gerencia")).toBe("/workbench");
    expect(usesRestrictedNavigation("gerencia")).toBe(false);
  });

  it("routes dedicated cashier to kiosk", () => {
    expect(getRoleHomePath("cajero")).toBe("/cashier");
    expect(isCashierKioskRole("cajero")).toBe(true);
    expect(usesRestrictedNavigation("cajero")).toBe(true);
    expect(canAccessCashier("cajero")).toBe(true);
  });

  it("blocks ventas from cashier API but keeps seller restricted nav", () => {
    expect(canAccessCashier("ventas")).toBe(false);
    expect(isSellerRole("ventas")).toBe(true);
    expect(usesRestrictedNavigation("ventas")).toBe(true);
    expect(getRoleHomePath("ventas")).toBe("/workbench");
  });

  it("routes technician roles to mobile kiosk", () => {
    expect(getRoleHomePath("instalaciones")).toBe("/technician");
    expect(getRoleHomePath("polarizador")).toBe("/technician");
  });

  it("documents matrix entries consistently", () => {
    for (const row of ROLE_HOME_MATRIX) {
      expect(getRoleHomePath(row.role)).toBe(row.home);
      expect(usesRestrictedNavigation(row.role)).toBe(row.restrictedNav);
      expect(canAccessCashier(row.role)).toBe(row.canAccessCashier);
    }
  });
});