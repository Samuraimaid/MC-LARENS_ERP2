import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from "sonner";
import {
  optimisticUpdate,
  assertNotOptimistic,
  OPTIMISTIC_FORBIDDEN,
} from "./optimisticUpdate";

describe("optimisticUpdate (U10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies locally, runs request, skips rollback on success", async () => {
    const apply = vi.fn();
    const request = vi.fn().mockResolvedValue(undefined);
    const rollback = vi.fn();
    const onSuccess = vi.fn();

    const ok = await optimisticUpdate({ apply, request, rollback, onSuccess });

    expect(ok).toBe(true);
    expect(apply).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledOnce();
    expect(rollback).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("rollbacks and shows Spanish error toast on failure", async () => {
    const apply = vi.fn();
    const request = vi.fn().mockRejectedValue({
      response: { data: { detail: "Fallo de red" } },
    });
    const rollback = vi.fn();

    const ok = await optimisticUpdate({
      apply,
      request,
      rollback,
      errorMessage: "No se pudo guardar el cambio",
    });

    expect(ok).toBe(false);
    expect(apply).toHaveBeenCalledOnce();
    expect(rollback).toHaveBeenCalledOnce();
    expect(toast.error).toHaveBeenCalledWith("Fallo de red");
  });

  it("uses Spanish errorMessage when API detail missing", async () => {
    const ok = await optimisticUpdate({
      apply: () => {},
      request: async () => {
        throw new Error("network");
      },
      rollback: () => {},
      errorMessage: "Error al actualizar promoción",
    });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Error al actualizar promoción");
  });

  it("assertNotOptimistic throws for pay/transfer/collect", () => {
    expect(() => assertNotOptimistic(OPTIMISTIC_FORBIDDEN.PAY)).toThrow(/never use optimistic/i);
    expect(() => assertNotOptimistic(OPTIMISTIC_FORBIDDEN.TRANSFER, "truck")).toThrow(/truck/);
    expect(() => assertNotOptimistic(OPTIMISTIC_FORBIDDEN.COLLECT)).toThrow(/collect/);
  });
});
