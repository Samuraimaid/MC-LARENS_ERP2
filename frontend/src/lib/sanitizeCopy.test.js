import { describe, it, expect } from "vitest";
import { sanitizeProductCopy, sanitizeProductDescription } from "./sanitizeCopy";

describe("sanitizeProductDescription", () => {
  it("strips catalog metadata block after ---", () => {
    const raw = `Kit neblineros OEM.\n\n---\ncatalog_batch=dlaa_oem_ext_2026-09-12\nsource_sites=repuestosza.cl\nprice_note=raw=$ 54.530 CLP val=54530.0 cur=CLP usd=57.4\nisolation_product_id_prefix=prod_dlaa_oem2_\n`;
    expect(sanitizeProductDescription(raw)).toBe("Kit neblineros OEM.");
  });

  it("hides hex blobs", () => {
    const hex = "a".repeat(64) + "b".repeat(64);
    expect(sanitizeProductDescription(hex)).toBe("");
  });

  it("hides base64 blobs", () => {
    const b64 = "QWJjZGVmZ2hpams=".repeat(8);
    expect(sanitizeProductDescription(b64)).toBe("");
  });

  it("hides repetitive purple garbage titles", () => {
    const junk = "Lámina de púrpura del púrpura de púrpura del púrpura de púrpura del púrpura del púrpura";
    expect(sanitizeProductDescription(junk)).toBe("");
    expect(sanitizeProductCopy(junk, { fallback: "Producto" })).toBe("Producto");
  });

  it("keeps normal Spanish description", () => {
    expect(sanitizeProductDescription("Halógeno para Toyota Corolla 2000-2003.")).toContain("Halógeno");
  });
});