import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  formatCameraLabel,
  getCameraDisplayName,
  isBarcodeDetectorSupported,
} from "./barcodeScanner";

describe("barcodeScanner", () => {
  let originalBarcodeDetector;

  beforeEach(() => {
    originalBarcodeDetector = window.BarcodeDetector;
  });

  afterEach(() => {
    if (originalBarcodeDetector) {
      window.BarcodeDetector = originalBarcodeDetector;
    } else {
      delete window.BarcodeDetector;
    }
  });

  it("detects native barcode support when API exists", () => {
    window.BarcodeDetector = function BarcodeDetector() {};
    expect(isBarcodeDetectorSupported()).toBe(true);
  });

  it("reports unsupported when API is missing", () => {
    delete window.BarcodeDetector;
    expect(isBarcodeDetectorSupported()).toBe(false);
  });

  it("formats rear camera labels", () => {
    expect(formatCameraLabel({ label: "camera2 0, facing back" }, 0)).toBe("Cámara trasera");
  });

  it("shows active camera name from list", () => {
    const cameras = [
      { id: "a", label: "front camera" },
      { id: "b", label: "back camera" },
    ];
    expect(getCameraDisplayName(cameras, "b")).toBe("Cámara trasera");
  });
});