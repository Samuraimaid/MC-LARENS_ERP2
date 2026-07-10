import { describe, expect, it } from "vitest";
import { isRouteEnabledByNodeProfile } from "./nodeProfile";

describe("nodeProfile", () => {
  it("bloquea rutas deshabilitadas por perfil BODEGA_PURA", () => {
    const profile = {
      node_type: "BODEGA_PURA",
      disabled_routes: ["/workbench", "/sales", "/human-resources"],
    };
    expect(isRouteEnabledByNodeProfile("/sales", profile)).toBe(false);
    expect(isRouteEnabledByNodeProfile("/dispatch", profile)).toBe(true);
  });
});