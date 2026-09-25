import { describe, expect, it } from "vitest";
import { humanApiError, HUMAN_API_ERROR_DEFAULT } from "./humanApiError";

describe("humanApiError", () => {
  it("maps SKU already exists with a fix", () => {
    expect(humanApiError("SKU already exists")).toMatch(/SKU ya existe/i);
  });

  it("maps Product not found with a fix", () => {
    expect(humanApiError("Product not found")).toMatch(/producto/i);
  });

  it("maps Customer not found inviting register", () => {
    expect(humanApiError({ detail: "Customer not found" })).toMatch(/registrarlo/i);
  });

  it("unwraps axios-shaped errors", () => {
    const err = { response: { data: { detail: "Vehicle not found" } } };
    expect(humanApiError(err)).toMatch(/vehículo/i);
  });

  it("keeps friendly Spanish details", () => {
    expect(humanApiError("Completa los campos obligatorios")).toBe("Completa los campos obligatorios");
  });

  it("uses default for raw ERROR operation failed", () => {
    expect(humanApiError("ERROR: operation failed")).toBe(HUMAN_API_ERROR_DEFAULT);
  });

  it("uses custom fallback when empty", () => {
    expect(humanApiError(null, "No se pudo crear el producto")).toBe("No se pudo crear el producto");
  });
});
