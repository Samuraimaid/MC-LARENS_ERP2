const runtimeWindow = typeof window !== "undefined" ? window : undefined;
const metaEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const processEnv = typeof process !== "undefined" && process.env ? process.env : {};

export const PRODUCTION_CLOUD_RUN_API = "https://mclarens-erp-836176703716.us-central1.run.app/api";

export function isCapacitorNative() {
  if (typeof window === "undefined") return false;

  // 1. Global Capacitor runtime
  if (
    window.Capacitor?.isNativePlatform?.() ||
    window.Capacitor?.getPlatform?.() === "android" ||
    window.Capacitor?.getPlatform?.() === "ios"
  ) {
    return true;
  }

  // 2. Protocolos nativos
  if (window.location?.protocol === "capacitor:" || window.location?.protocol === "ionic:") {
    return true;
  }

  // 3. WebView de Android en Capacitor (corre en localhost o https://localhost sin puerto)
  const hostname = window.location?.hostname || "";
  const port = window.location?.port || "";
  const origin = window.location?.origin || "";
  if ((hostname === "localhost" || hostname === "127.0.0.1" || origin === "https://localhost") && !port) {
    return true;
  }

  // 4. Bandera de compilación Capacitor
  if (metaEnv.VITE_IS_CAPACITOR === "true" || processEnv.VITE_IS_CAPACITOR === "true") {
    return true;
  }

  return false;
}

function readEnv(...keys) {
  for (const key of keys) {
    const value = metaEnv[key] ?? processEnv[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return "";
}

function buildApiBase() {
  // 1. Si hay una URL de API personalizada guardada en el dispositivo móvil
  try {
    const custom = runtimeWindow?.localStorage?.getItem("erp_custom_api_base");
    if (custom && (custom.startsWith("http://") || custom.startsWith("https://"))) {
      return custom.replace(/\/$/, "");
    }
  } catch {}

  // 2. Si corre como app nativa Android/iOS en Capacitor, conectar a producción Cloud Run por defecto
  if (isCapacitorNative()) {
    return PRODUCTION_CLOUD_RUN_API;
  }

  // 3. Si hay variable de entorno explícita configurada con URL absoluta
  const backendUrl = readEnv("VITE_BACKEND_URL", "REACT_APP_BACKEND_URL");
  if (backendUrl && (backendUrl.startsWith("http://") || backendUrl.startsWith("https://"))) {
    return `${String(backendUrl).replace(/\/$/, "")}/api`;
  }

  // 4. Runtime window __API_BASE__ solo si es una URL absoluta
  if (
    runtimeWindow?.__API_BASE__ &&
    runtimeWindow.__API_BASE__ !== "/api" &&
    (runtimeWindow.__API_BASE__.startsWith("http://") || runtimeWindow.__API_BASE__.startsWith("https://"))
  ) {
    return runtimeWindow.__API_BASE__;
  }

  // 5. Fallback web same-origin /api (nginx Docker o Vite proxy)
  return "/api";
}

export const APP_ENV = {
  apiBase: buildApiBase(),
  authUrl: readEnv("VITE_AUTH_URL", "REACT_APP_AUTH_URL"),
  buildId: runtimeWindow?.__BUILD_ID__ || readEnv("VITE_APP_BUILD_ID", "REACT_APP_BUILD_ID"),
  buildTime: runtimeWindow?.__BUILD_TIME__ || readEnv("VITE_APP_BUILD_TIME", "REACT_APP_BUILD_TIME"),
  buildVersion: runtimeWindow?.__BUILD_VERSION__ || readEnv("VITE_APP_VERSION", "REACT_APP_VERSION") || "0.2.0-beta.0",
  attendanceKioskShortcutPin: String(
    runtimeWindow?.__ATTENDANCE_KIOSK_SHORTCUT_PIN__ ??
      readEnv("VITE_ATTENDANCE_KIOSK_SHORTCUT_PIN", "REACT_APP_ATTENDANCE_KIOSK_SHORTCUT_PIN")
  ),
  isProduction: Boolean(metaEnv.PROD || processEnv.NODE_ENV === "production"),
  isNative: isCapacitorNative(),
  devApiProxyTarget: readEnv("VITE_DEV_API_PROXY_TARGET", "DEV_API_PROXY_TARGET"),
};