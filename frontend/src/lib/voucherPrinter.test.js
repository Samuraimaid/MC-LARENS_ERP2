import { describe, expect, it } from "vitest";
import { isValidVoucherScanCode, normalizeVoucherScanCode } from "./voucherPrinter";

describe("voucherPrinter", () => {
  it("normalizes scanner wrappers and case", () => {
    expect(normalizeVoucherScanCode("*inv-20260627-0004*")).toBe("INV-20260627-0004");
  });

  it("validates invoice barcode format", () => {
    expect(isValidVoucherScanCode("INV-20260627-0004")).toBe(true);
    expect(isValidVoucherScanCode("Juan Perez")).toBe(false);
  });
});