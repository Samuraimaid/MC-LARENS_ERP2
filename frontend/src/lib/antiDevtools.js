/**
 * MC-LARENS ERP 2.0 - Módulo de Blindaje Anti-DevTools y Anti-Tampering
 * Protege la integridad de la aplicación bloqueando herramientas de depuración,
 * atajos de inspección, clic derecho y monitoreando intentos de acceso no autorizados.
 */

let shieldInitialized = false;
let devtoolsOpenDetected = false;

/**
 * Muestra la pantalla de bloqueo de seguridad cuando se detecta apertura de DevTools
 */
function triggerSecurityLockout() {
  if (devtoolsOpenDetected) return;
  devtoolsOpenDetected = true;

  try {
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("user_session");
    localStorage.removeItem("last_active_pin_user");
  } catch (e) {
    // Ignorar errores de storage
  }

  // Notificar al backend si es posible
  try {
    if (navigator.sendBeacon) {
      const payload = JSON.stringify({
        event: "DEVTOOLS_TAMPER_DETECTED",
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
      navigator.sendBeacon("/api/hypervisor/tamper-alert", payload);
    }
  } catch (e) {
    // Fail silently
  }

  // Desplegar bloqueo visual de seguridad
  const overlay = document.createElement("div");
  overlay.id = "mclarens-security-lockout-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.backgroundColor = "#09090b";
  overlay.style.color = "#ffffff";
  overlay.style.zIndex = "2147483647";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "24px";
  overlay.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  overlay.style.textAlign = "center";

  overlay.innerHTML = `
    <div style="max-width: 520px; background: #18181b; border: 1px solid #7f1d1d; border-radius: 16px; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
      <div style="width: 64px; height: 64px; border-radius: 50%; background: #450a0a; color: #ef4444; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; font-size: 32px;">
        🛡️
      </div>
      <h2 style="font-size: 20px; font-weight: 800; color: #fca5a5; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
        Acceso Restringido por Seguridad
      </h2>
      <p style="font-size: 13px; color: #d4d4d8; line-height: 1.6; margin-bottom: 16px;">
        Se ha detectado un intento de apertura de <strong>Herramientas de Desarrollo / Inspección de Código</strong>.
      </p>
      <div style="background: #27272a; border-radius: 8px; padding: 12px; font-size: 11px; color: #a1a1aa; text-align: left; margin-bottom: 24px; border-left: 3px solid #ef4444;">
        <strong>Política de Seguridad MC-LARENS ERP:</strong><br />
        Este evento ha sido registrado en la bitácora inmutable de auditoría <strong>HyperVisor</strong> con la IP del terminal, fecha y hora. El acceso a esta sesión ha sido revocado.
      </div>
      <button onclick="window.location.href='/login'" style="background: #dc2626; hover: background: #b91c1c; color: #ffffff; font-weight: 700; font-size: 13px; padding: 10px 24px; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
        Volver a Iniciar Sesión
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Ejecutar trampa de depuración en loop para congelar ejecución de inspector
  setInterval(() => {
    (function () {
      return false;
    }
      ["constructor"]("debugger")
      ["call"]());
  }, 500);
}

/**
 * Inicializa todos los bloqueos anti-DevTools
 */
export function initAntiDevtoolsShield() {
  if (shieldInitialized || typeof window === "undefined") return;
  shieldInitialized = true;

  // 1. Bloqueo de Clic Derecho (Menú Contextual)
  // 1. Bloqueo de Menú Contextual Nativo del Navegador (se sustituye por el menú custom de AntiTamperGuard)
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  // 2. Bloqueo de Atajos de Teclado (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U, Ctrl+S)
  window.addEventListener("keydown", (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
    const shift = e.shiftKey;
    const key = (e.key || "").toUpperCase();
    const code = e.keyCode || e.which;

    // F12 (code 123)
    if (key === "F12" || code === 123) {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityLockout();
      return false;
    }

    // Ctrl+Shift+I (Inspect), Ctrl+Shift+J (Console), Ctrl+Shift+C (Element picker), Ctrl+Shift+K (Firefox)
    if (ctrlOrCmd && shift && (key === "I" || key === "J" || key === "C" || key === "K" || code === 73 || code === 74 || code === 67 || code === 75)) {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityLockout();
      return false;
    }

    // Ctrl+U (Ver código fuente)
    if (ctrlOrCmd && (key === "U" || code === 85)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+S (Guardar página)
    if (ctrlOrCmd && (key === "S" || code === 83)) {
      const targetTag = String(e.target?.tagName || "").toLowerCase();
      if (targetTag !== "input" && targetTag !== "textarea") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
  }, { capture: true });

  // 3. Sanitización de Consola en Producción
  try {
    const isProd = !import.meta.env?.DEV && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
    if (isProd) {
      const noop = () => {};
      window.console.log = noop;
      window.console.info = noop;
      window.console.debug = noop;
      window.console.dir = noop;
      window.console.table = noop;
      
      // Advertencia disuasoria oficial
      setTimeout(() => {
        try {
          console.clear();
        } catch (e) {}
      }, 1000);
    }
  } catch (e) {
    // Ignorar
  }

  // 4. Detección Activa por Redimensionamiento de Viewport (DevTools Docked)
  const threshold = 160;
  const checkDimensions = () => {
    if (devtoolsOpenDetected) return;
    const widthDiff = window.outerWidth - window.innerWidth > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;
    if (widthDiff || heightDiff) {
      // Verificar si no es por zoom del navegador
      const isZoomed = Math.abs(window.devicePixelRatio - 1) > 0.3;
      if (!isZoomed && window.outerWidth > 400 && window.outerHeight > 300) {
        triggerSecurityLockout();
      }
    }
  };

  window.addEventListener("resize", checkDimensions, { passive: true });

  // 5. Detección Activa por Tiempo de Ejecución (Timing Profiling Trap)
  let timingCheckCount = 0;
  const timingTrapInterval = setInterval(() => {
    if (devtoolsOpenDetected) {
      clearInterval(timingTrapInterval);
      return;
    }
    const start = performance.now();
    // Expresión que se evalúa lento cuando DevTools está escuchando
    const regex = /./;
    regex.toString = function () {
      timingCheckCount++;
      return "mclarens_shield";
    };
    const end = performance.now();
    if (end - start > 100) {
      triggerSecurityLockout();
    }
  }, 2000);
}
