import { APP_ENV } from "./env";

function readWindowBase() {
  if (typeof window === "undefined") return "";
  return String(window.__FAILOVER_API_BASE__ || window.__API_BASE__ || "").trim();
}

export function getRuntimeApiBase() {
  const dynamic = readWindowBase();
  if (dynamic) return dynamic.replace(/\/$/, "");
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