/**
 * MC-LARENS ERP2 - Bus de Sincronización de Sesión Multi-Ventana y Helper de Ventanas Independientes.
 * Permite abrir múltiples endpoints/módulos en ventanas y pestañas separadas en la misma PC
 * manteniendo sincronización instantánea de seguridad (Logout sincronizado, Conflicto de Sesión en otro PC, Timeout).
 */

const CHANNEL_NAME = "mclarens_session_bus";
const STORAGE_EVENT_KEY = "mclarens_session_bus_event";

let channel = null;
if (typeof window !== "undefined" && typeof window.BroadcastChannel !== "undefined") {
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    channel = null;
  }
}

/**
 * Emite un evento a todas las demás pestañas y ventanas abiertas en la misma PC.
 * @param {string} type - Tipo de evento ('LOGOUT', 'SESSION_CONFLICT', 'SESSION_IDLE_TIMEOUT', 'SESSION_EXPIRED', 'LOGIN_SUCCESS')
 * @param {object} payload - Información adicional del evento
 */
export function broadcastSessionEvent(type, payload = {}) {
  if (typeof window === "undefined") return;

  const eventData = {
    type,
    payload,
    timestamp: Date.now(),
    senderId: window.__ERP_WINDOW_ID || (window.__ERP_WINDOW_ID = `win_${Math.random().toString(36).slice(2, 9)}`),
  };

  // 1. Enviar vía BroadcastChannel
  if (channel) {
    try {
      channel.postMessage(eventData);
    } catch (err) {
      console.warn("[sessionBus] Error posting message to BroadcastChannel:", err);
    }
  }

  // 2. Fallback vía localStorage para máxima compatibilidad entre pestañas
  try {
    window.localStorage?.setItem(STORAGE_EVENT_KEY, JSON.stringify(eventData));
  } catch (err) {
    // ignorar errores de storage cuota
  }
}

/**
 * Suscribe un manejador para escuchar eventos emitidos por otras ventanas de la misma PC.
 * @param {function} callback - Función que recibe (eventData: { type, payload, timestamp, senderId })
 * @returns {function} Función de limpieza para desuscribirse
 */
export function subscribeSessionEvents(callback) {
  if (typeof window === "undefined" || typeof callback !== "function") {
    return () => {};
  }

  const currentWindowId = window.__ERP_WINDOW_ID || (window.__ERP_WINDOW_ID = `win_${Math.random().toString(36).slice(2, 9)}`);

  // Listener para BroadcastChannel
  const handleBroadcast = (event) => {
    try {
      const data = event?.data;
      if (data && data.senderId !== currentWindowId) {
        callback(data);
      }
    } catch (err) {
      console.error("[sessionBus] Error processing broadcast event:", err);
    }
  };

  // Listener para Storage Event (fallback)
  const handleStorage = (event) => {
    if (event.key === STORAGE_EVENT_KEY && event.newValue) {
      try {
        const data = JSON.parse(event.newValue);
        if (data && data.senderId !== currentWindowId) {
          callback(data);
        }
      } catch (err) {
        // ignorar json inválido
      }
    }
  };

  if (channel) {
    channel.addEventListener("message", handleBroadcast);
  }
  window.addEventListener("storage", handleStorage);

  return () => {
    if (channel) {
      channel.removeEventListener("message", handleBroadcast);
    }
    window.removeEventListener("storage", handleStorage);
  };
}

/**
 * Abre un módulo del ERP en una ventana independiente limpia (tipo App Window)
 * centrada en pantalla y optimizada para trabajo en pantallas secundarias o multitarea.
 * 
 * @param {string} href - Ruta relativa (ej. "/inventory", "/sales", "/cashier")
 * @param {string} title - Nombre del módulo para el título de ventana
 * @param {object} options - Opciones personalizadas de tamaño (width, height, standalone)
 * @returns {Window|null} Referencia a la nueva ventana abierta
 */
export function openIndependentWindow(href, title = "Módulo ERP", options = {}) {
  if (typeof window === "undefined") return null;

  const url = href.startsWith("http") ? href : `${window.location.origin}${href.startsWith("/") ? "" : "/"}${href}`;
  
  // Agregar parámetro identificador de ventana independiente
  const targetUrl = new URL(url);
  if (options.standalone !== false) {
    targetUrl.searchParams.set("window_mode", "standalone");
  }

  // Dimensiones óptimas calculadas según la pantalla actual
  const screenW = window.screen?.availWidth || 1600;
  const screenH = window.screen?.availHeight || 900;
  
  const width = options.width || Math.min(1440, Math.max(1024, Math.floor(screenW * 0.88)));
  const height = options.height || Math.min(960, Math.max(700, Math.floor(screenH * 0.88)));
  
  const left = options.left ?? Math.max(0, Math.floor((screenW - width) / 2) + (window.screenLeft || window.screenX || 0));
  const top = options.top ?? Math.max(0, Math.floor((screenH - height) / 2) + (window.screenTop || window.screenY || 0));

  const windowFeatures = [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "popup=yes",
    "menubar=no",
    "toolbar=no",
    "location=no",
    "status=no",
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");

  const cleanWindowName = `mclarens_win_${(title || "module").toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;

  try {
    const newWindow = window.open(targetUrl.toString(), cleanWindowName, windowFeatures);
    if (newWindow) {
      newWindow.focus();
      return newWindow;
    }
  } catch (err) {
    console.warn("[sessionBus] Error opening independent window:", err);
  }

  // Fallback si el bloqueador de popups impide la ventana popup
  return window.open(targetUrl.toString(), "_blank");
}
