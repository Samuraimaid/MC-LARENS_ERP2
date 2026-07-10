import axios from "axios";
import { buildApiUrl } from "@/lib/runtimeApi";

let cachedProfile = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

export async function fetchNodeProfile({ force = false } = {}) {
  const now = Date.now();
  if (!force && cachedProfile && now - cachedAt < CACHE_MS) {
    return cachedProfile;
  }
  const response = await axios.get(buildApiUrl("/server-appliance/profile"), {
    timeout: 4000,
    withCredentials: true,
  });
  cachedProfile = response.data;
  cachedAt = now;
  if (typeof window !== "undefined") {
    window.__NODE_PROFILE__ = cachedProfile;
  }
  return cachedProfile;
}

export function getCachedNodeProfile() {
  if (cachedProfile) return cachedProfile;
  if (typeof window !== "undefined" && window.__NODE_PROFILE__) {
    return window.__NODE_PROFILE__;
  }
  return null;
}

export function isRouteEnabledByNodeProfile(route, profile = getCachedNodeProfile()) {
  if (!profile) return true;
  const normalized = String(route || "").split("?")[0].replace(/\/$/, "") || "/";
  const disabled = new Set(profile.disabled_routes || []);
  for (const blocked of disabled) {
    const base = String(blocked).replace(/\/$/, "");
    if (normalized === base || normalized.startsWith(`${base}/`)) {
      return false;
    }
  }
  return true;
}