const runtimeWindow = typeof window !== "undefined" ? window : undefined;
const metaEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const processEnv = typeof process !== "undefined" && process.env ? process.env : {};

export function isCapacitorNative() {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.Capacitor?.isNativePlatform?.() ||
    window.location?.protocol === "capacitor:" ||
    (window.location?.hostname === "localhost" && !window.location?.port && navigator?.userAgent?.includes("Android"))
  );
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
  if (runtimeWindow?.__API_BASE__) {
    return runtimeWindow.__API_BASE__;
  }

  // Si hay una URL de API personalizada guardada en el dispositivo móvil
  try {
    const custom = runtimeWindow?.localStorage?.getItem("erp_custom_api_base");
    if (custom && (custom.startsWith("http://") || custom.startsWith("https://"))) {
      return custom.replace(/\/$/, "");
    }
  } catch {}

  const backendUrl = readEnv("VITE_BACKEND_URL", "REACT_APP_BACKEND_URL");
  if (backendUrl) {
    return `${String(backendUrl).replace(/\/$/, "")}/api`;
  }

  // Si corre como app nativa Android en Capacitor, conectar a producción Cloud Run por defecto
  if (isCapacitorNative()) {
    return "https://mclarens-erp-836176703716.us-central1.run.app/api";
  }

  // Same-origin /api: nginx (Docker) o proxy de Vite reenvían al backend.
  // Evita cookies cross-origin en acceso LAN (ej. http://192.168.1.26:3000).
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