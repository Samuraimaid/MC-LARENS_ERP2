import axios from "axios";
import { API_BASE as API } from "@/lib/api";

/**
 * Request a short-lived one-time reauth token after PIN confirmation.
 * Backend: POST /auth/reauth → { reauth_token, expires_at, ttl_seconds }
 */
export async function requestReauthToken(pin, action = null) {
  const body = { pin: String(pin || "").trim() };
  if (action) body.action = action;
  const res = await axios.post(`${API}/auth/reauth`, body, { withCredentials: true });
  return res.data;
}

/**
 * Build axios config with X-Reauth-Token header.
 */
export function withReauthHeader(config = {}, reauthToken) {
  const next = { ...config, withCredentials: true };
  next.headers = {
    ...(config.headers || {}),
    ...(reauthToken ? { "X-Reauth-Token": reauthToken } : {}),
  };
  return next;
}

/**
 * Parse REAUTH_REQUIRED / REAUTH_INVALID from axios error.
 */
export function parseReauthError(error) {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;
  const code = typeof detail === "object" ? detail?.code : null;
  const action = typeof detail === "object" ? detail?.action : null;
  const message =
    (typeof detail === "object" ? detail?.message : null) ||
    (typeof detail === "string" ? detail : null) ||
    error?.message ||
    "Confirmación requerida";
  return {
    isReauthRequired: status === 403 && code === "REAUTH_REQUIRED",
    isReauthInvalid: status === 403 && code === "REAUTH_INVALID",
    action,
    message,
    code,
    status,
  };
}

/**
 * Run an API call that may require reauth.
 * promptPin: async (actionKey, message) => pin string | null (null = cancel)
 */
export async function withReauth(actionKey, requestFn, { promptPin, pin: prefilledPin } = {}) {
  const tryOnce = async (reauthToken) => requestFn(reauthToken);

  // Prefer explicit PIN when caller already collected it
  if (prefilledPin) {
    const { reauth_token } = await requestReauthToken(prefilledPin, actionKey);
    return tryOnce(reauth_token);
  }

  try {
    return await tryOnce(null);
  } catch (error) {
    const info = parseReauthError(error);
    if (!info.isReauthRequired && !info.isReauthInvalid) throw error;
    if (typeof promptPin !== "function") throw error;
    const pin = await promptPin(info.action || actionKey, info.message);
    if (!pin) {
      const cancel = new Error("Reauth cancelled");
      cancel.code = "REAUTH_CANCELLED";
      throw cancel;
    }
    const { reauth_token } = await requestReauthToken(pin, info.action || actionKey);
    return tryOnce(reauth_token);
  }
}

/**
 * Prompt for 8-digit PIN (simple fallback when no modal is mounted).
 * Returns cleaned pin or null if cancelled/invalid.
 */
export function promptLoginPin(message = "Ingresa tu PIN de 8 dígitos para confirmar:") {
  const raw = window.prompt(message);
  if (raw == null) return null;
  const pin = String(raw).replace(/\D/g, "").slice(0, 8);
  if (pin.length !== 8) {
    throw new Error("El PIN debe tener 8 dígitos");
  }
  return pin;
}

/**
 * Obtain reauth token via browser prompt (for one-off sensitive downloads).
 */
export async function promptReauthToken(action, message) {
  const pin = promptLoginPin(message);
  if (!pin) {
    const err = new Error("Reauth cancelled");
    err.code = "REAUTH_CANCELLED";
    throw err;
  }
  const data = await requestReauthToken(pin, action);
  return data.reauth_token;
}

/**
 * Session expiry / idle codes from require_auth 401 detail.
 */
export function parseSessionError(error) {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;
  const code = typeof detail === "object" ? detail?.code : null;
  const message =
    (typeof detail === "object" ? detail?.message : null) ||
    (typeof detail === "string" ? detail : null);
  return {
    isSessionError:
      status === 401 &&
      (code === "SESSION_IDLE_TIMEOUT" ||
        code === "SESSION_EXPIRED" ||
        code === "SESSION_INVALID" ||
        message === "Invalid session" ||
        message === "Unauthorized"),
    code: code || (status === 401 ? "SESSION_INVALID" : null),
    message: message || "Sesión inválida",
  };
}
