import axios from "axios";
import { APP_ENV } from "./env";
import { getRuntimeApiBase } from "./runtimeApi";

export const API_BASE = APP_ENV.apiBase;
export function getApiBase() {
  return getRuntimeApiBase();
}
export const BUILD_TIME = APP_ENV.buildTime || "";
export const BUILD_ID = APP_ENV.buildId || "";
export const BUILD_VERSION = APP_ENV.buildVersion || "";

export const SESSION_TOKEN_KEY = "erp_session_token";
export const CACHED_USER_KEY = "erp_cached_user";

export function getStoredSessionToken() {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.localStorage?.getItem(SESSION_TOKEN_KEY) ||
      window.sessionStorage?.getItem(SESSION_TOKEN_KEY) ||
      null
    );
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token) {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      window.localStorage?.setItem(SESSION_TOKEN_KEY, token);
      window.sessionStorage?.setItem(SESSION_TOKEN_KEY, token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      window.localStorage?.removeItem(SESSION_TOKEN_KEY);
      window.sessionStorage?.removeItem(SESSION_TOKEN_KEY);
      delete axios.defaults.headers.common["Authorization"];
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage?.getItem(CACHED_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (typeof window === "undefined") return;
  try {
    if (user && typeof user === "object") {
      window.localStorage?.setItem(CACHED_USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage?.removeItem(CACHED_USER_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

// Global Axios Request Interceptor: Attach Bearer token and withCredentials automatically
axios.interceptors.request.use(
  (config) => {
    config.withCredentials = true;
    const token = getStoredSessionToken();
    if (token && !config.headers?.Authorization) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Set default header if initial token is present
const initialToken = getStoredSessionToken();
if (initialToken) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${initialToken}`;
}
