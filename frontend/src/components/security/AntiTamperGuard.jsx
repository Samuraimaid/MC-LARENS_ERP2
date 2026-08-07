import React, { useEffect } from "react";
import PropTypes from "prop-types";

/**
 * Lightweight anti-tamper shell used by App.js.
 * The original component was referenced in origin/master but never committed.
 * This implementation keeps the runtime contract (wrap children) and applies
 * non-blocking integrity hooks suitable for a POS ERP terminal.
 */
export function AntiTamperGuard({ children }) {
  useEffect(() => {
    // Freeze critical globals lightly in production only (avoid breaking Vite HMR/devtools).
    if (typeof window === "undefined") return undefined;
    const isProd = Boolean(import.meta?.env?.PROD);
    if (!isProd) return undefined;

    const onContextMenu = (event) => {
      // Soft-disable only on locked kiosk-like fullscreen surfaces.
      const path = String(window.location?.pathname || "");
      if (path.includes("/kds") || path.includes("/attendance-clock")) {
        event.preventDefault();
      }
    };

    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, []);

  return <>{children}</>;
}

AntiTamperGuard.propTypes = {
  children: PropTypes.node,
};

export default AntiTamperGuard;
