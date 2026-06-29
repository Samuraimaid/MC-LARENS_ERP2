import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getCameraContextError,
  getRecommendedCameraUrl,
  mapCameraStartError,
} from "./cameraAccess";

describe("cameraAccess", () => {
  let originalSecureContext;
  let originalMediaDevices;

  beforeEach(() => {
    originalSecureContext = window.isSecureContext;
    originalMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [] }) },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: originalSecureContext,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    });
  });

  it("maps permission errors clearly", () => {
    expect(mapCameraStartError({ name: "NotAllowedError", message: "Permission denied" }))
      .toMatch(/Permiso de cámara/i);
  });

  it("maps insecure context errors clearly", () => {
    expect(mapCameraStartError({ message: "Only secure origins are allowed" }))
      .toMatch(/HTTPS/i);
  });

  it("maps gesture activation errors clearly", () => {
    expect(mapCameraStartError({ message: "Transient activation is required" }))
      .toMatch(/Activar cámara/i);
  });

  it("returns empty context error on secure localhost", () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    expect(getCameraContextError()).toBe("");
  });

  it("builds recommended camera url from hostname", () => {
    expect(getRecommendedCameraUrl("192.168.1.25")).toBe("https://192.168.1.25:3443");
  });
});