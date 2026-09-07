import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import axios from "axios";
import { startFailoverManager } from "@/lib/failoverManager.js";

import { initAntiDevtoolsShield } from "@/lib/antiDevtools.js";

// Sesión por cookie HTTP: obligatorio en login PIN y acceso LAN.
axios.defaults.withCredentials = true;
startFailoverManager();
initAntiDevtoolsShield();

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
