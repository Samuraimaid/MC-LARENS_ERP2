import { APP_ENV } from "./env";

function readWindowBase() {
  if (typeof window === "undefined") return "";
  const failover = String(window.__FAILOVER_API_BASE__ || "").trim();
  if (failover && (failover.startsWith("http://") || failover.startsWith("https://"))) {
    return failover;
  }
  const apiBase = String(window.__API_BASE__ || "").trim();
  if (apiBase && (apiBase.startsWith("http://") || apiBase.startsWith("https://"))) {
    return apiBase;
  }
  return "";
}

export function getRuntimeApiBase() {
  // 1. Priorizar URL personalizada en localStorage si existe
  if (typeof window !== "undefined") {
    try {
      const custom = window.localStorage?.getItem("erp_custom_api_base");
      if (custom && (custom.startsWith("http://") || custom.startsWith("https://"))) {
        return custom.replace(/\/$/, "");
      }
    } catch {}
  }

  // 2. Ventana de runtime si es URL absoluta
  const dynamic = readWindowBase();
  if (dynamic) return dynamic.replace(/\/$/, "");

  // 3. APP_ENV.apiBase configurado
  return String(APP_ENV.apiBase || "/api").replace(/\/$/, "");
}

export function getRuntimeOrigin() {
  const base = getRuntimeApiBase();
  if (base.startsWith("http://") || base.startsWith("https://")) {
    return base.replace(/\/api\/?$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

export function setRuntimeApiBase(nextBase) {
  const normalized = String(nextBase || "").trim().replace(/\/$/, "");
  if (typeof window !== "undefined") {
    window.__FAILOVER_API_BASE__ = normalized;
    window.__API_BASE__ = normalized;
    try {
      if (normalized) {
        window.localStorage?.setItem("erp_custom_api_base", normalized);
      } else {
        window.localStorage?.removeItem("erp_custom_api_base");
      }
    } catch {}
    window.dispatchEvent(new CustomEvent("erp:api-base-changed", { detail: { apiBase: normalized } }));
  }
}

export function buildApiUrl(path = "") {
  const base = getRuntimeApiBase();
  const suffix = String(path || "").startsWith("/") ? path : `/${path || ""}`;
  if (suffix.startsWith("/api/")) {
    return `${base}${suffix.replace(/^\/api/, "")}`;
  }
  return `${base}${suffix}`;
}