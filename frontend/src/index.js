import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import axios from "axios";
import { startFailoverManager } from "@/lib/failoverManager.js";

// Sesión por cookie HTTP: obligatorio en login PIN y acceso LAN.
axios.defaults.withCredentials = true;
startFailoverManager();

// Manejador global de errores de Vite por desactualización de chunks tras despliegues
window.addEventListener("vite:preloadError", (event) => {
  console.warn("[Vite Preload] Chunk desactualizado detectado tras despliegue. Recargando...");
  const lastReload = sessionStorage.getItem("last_chunk_preload_reload");
  const now = Date.now();
  if (!lastReload || now - Number(lastReload) > 10000) {
    sessionStorage.setItem("last_chunk_preload_reload", String(now));
    window.location.reload();
  }
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Global Axios instrumentation for debugging API responses in the browser.
// Logs requests/responses to the devtools console and exposes the last log
// on `window.__LAST_API_LOG__` for easy inspection.
try {
  axios.interceptors.request.use((cfg) => {
    try {
      const tag = `[API REQ] ${cfg.method?.toUpperCase() || 'GET'} ${cfg.url}`;
      console.info(tag, { headers: cfg.headers, data: cfg.data });
      window.__LAST_API_LOG__ = { type: 'request', tag, headers: cfg.headers, data: cfg.data, ts: Date.now() };
    } catch (e) {
      // ignore
    }
    return cfg;
  });

  axios.interceptors.response.use(
    (resp) => {
      try {
        const tag = `[API RESP] ${resp.status} ${resp.config?.method?.toUpperCase() || 'GET'} ${resp.config?.url}`;
        console.info(tag, resp.data);
        window.__LAST_API_LOG__ = { type: 'response', tag, status: resp.status, data: resp.data, ts: Date.now() };
      } catch (e) { /* ignore logging errors */ }
      return resp;
    },
    (err) => {
      try {
        const cfg = err.config || {};
        const status = err.response?.status || 'ERR';
        const body = err.response?.data;
        const tag = `[API ERR] ${status} ${cfg.method?.toUpperCase() || 'GET'} ${cfg.url || ''}`;
        console.warn(tag, { status, body });
        window.__LAST_API_LOG__ = { type: 'error', tag, status, body, ts: Date.now() };
      } catch (e) { /* ignore response logging errors */ }
      return Promise.reject(err);
    }
  );
} catch (e) {
  // If axios isn't available at load time, skip instrumentation.
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });

  if (window.caches && window.caches.keys) {
    window.caches.keys().then((keys) => {
      keys.forEach((key) => window.caches.delete(key));
    });
  }
}
