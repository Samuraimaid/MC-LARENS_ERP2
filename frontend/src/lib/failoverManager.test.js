import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(() => "toast-id"),
    dismiss: vi.fn(),
    success: vi.fn(),
  },
}));

describe("failoverManager", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    window.__FAILOVER_TUNNEL_MAIN__ = "https://tunnel-main.test";
    window.__FAILOVER_TUNNEL_NORTH__ = "https://tunnel-north.test";
    window.__FAILOVER_TUNNEL_SOUTH__ = "https://tunnel-south.test";
    delete window.__FAILOVER_API_BASE__;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("expone nodos LAN + túneles al iniciar", async () => {
    const axios = (await import("axios")).default;
    axios.get = vi.fn().mockResolvedValue({ status: 200 });

    const { startFailoverManager, getFailoverStatus, stopFailoverManager } = await import("./failoverManager");
    startFailoverManager();

    const status = getFailoverStatus();
    expect(status.nodes[0].id).toBe("local-lan");
    expect(status.nodes.length).toBeGreaterThanOrEqual(4);

    stopFailoverManager();
  });
});