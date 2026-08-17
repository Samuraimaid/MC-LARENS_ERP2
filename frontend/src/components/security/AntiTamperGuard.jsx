import React, { useEffect, useState, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import { ShieldAlert, Lock, AlertTriangle, KeyRound, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";

export function AntiTamperGuard({ children }) {
  const { user } = useAuth();
  const [isTamperBlocked, setIsTamperBlocked] = useState(false);
  const [incidentData, setIncidentData] = useState(null);
  const [unlockPin, setUnlockPin] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const lastReportRef = useRef(0);

  const reportTamperIncident = useCallback(async (triggerAction, extraDetails = {}) => {
    const now = Date.now();
    // Throttle reports to avoid spamming the backend
    if (now - lastReportRef.current < 4000) return;
    lastReportRef.current = now;

    const payload = {
      trigger_action: triggerAction,
      details: extraDetails,
      window_metrics: {
        outerWidth: window.outerWidth,
        innerWidth: window.innerWidth,
        outerHeight: window.outerHeight,
        innerHeight: window.innerHeight,
      },
      branch_id: user?.branch_id || "branch_main",
      user_hint: user
        ? {
            user_id: user.user_id,
            name: user.name,
            role: user.role,
            email: user.email,
            branch_id: user.branch_id,
          }
        : null,
    };

    try {
      const res = await axios.post("/api/security/tamper-incident", payload);
      setIncidentData(res.data);
    } catch (err) {
      console.warn("Security report fallback", err);
      setIncidentData({
        timestamp: new Date().toLocaleString("es-NI"),
        user: user?.name || "Usuario no autenticado",
        role: user?.role || "Operador",
        branch: user?.branch_id || "Sucursal Local",
      });
    }

    setIsTamperBlocked(true);
  }, [user]);

  useEffect(() => {
    // 1. Bloqueo estricto de atajos de teclado de DevTools y Código Fuente
    const handleKeyDown = (e) => {
      // F12
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        reportTamperIncident("F12_KEY_PRESS", { key: e.key });
        return false;
      }

      // Ctrl + Shift + I / J / C (DevTools & Inspector)
      if (e.ctrlKey && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        reportTamperIncident("DEVTOOLS_INSPECT_SHORTCUT", { key: e.key });
        return false;
      }

      // Ctrl + U (Ver código fuente HTML)
      if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
        e.stopPropagation();
        reportTamperIncident("VIEW_SOURCE_SHORTCUT", { key: e.key });
        return false;
      }

      // Ctrl + S (Guardar página)
      if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 2. Bloqueo de Clic Derecho (Context Menu)
    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // 3. Detección activa de DevTools abiertas por dimensiones
    const checkDevToolsDimensions = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      if (widthThreshold || heightThreshold) {
        reportTamperIncident("DEVTOOLS_DOCK_OPENED", {
          deltaWidth: window.outerWidth - window.innerWidth,
          deltaHeight: window.outerHeight - window.innerHeight,
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("contextmenu", handleContextMenu, true);
    const intervalId = setInterval(checkDevToolsDimensions, 1500);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("contextmenu", handleContextMenu, true);
      clearInterval(intervalId);
    };
  }, [reportTamperIncident]);

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!unlockPin) return;
    setIsUnlocking(true);
    setUnlockError("");

    try {
      const res = await axios.post("/api/auth/pin/login", { pin: unlockPin });
      const pinUser = res.data?.user;
      if (pinUser && (pinUser.role === "gerencia" || pinUser.role === "programador" || pinUser.role === "supervisor")) {
        setIsTamperBlocked(false);
        setUnlockPin("");
        setIncidentData(null);
      } else {
        setUnlockError("Se requiere PIN de Gerencia o Supervisor para desbloquear la terminal.");
      }
    } catch {
      setUnlockError("PIN de gerencia incorrecto o no autorizado.");
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <>
      {isTamperBlocked && (
        <div className="fixed inset-0 z-[9999999] flex flex-col items-center justify-center bg-black/98 p-6 text-white backdrop-blur-3xl animate-in fade-in duration-300 select-none">
          <div className="relative max-w-lg w-full rounded-2xl border border-red-500/40 bg-zinc-950/90 p-8 shadow-2xl shadow-red-950/80 text-center">
            {/* Encabezado con Icono Pulsante */}
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-950/60 border-2 border-red-500/80 shadow-lg shadow-red-500/30 animate-pulse">
              <ShieldAlert className="h-10 w-10 text-red-500" />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-red-400 sm:text-2xl uppercase">
              Terminal Bloqueada por Seguridad
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Se detectó un intento no autorizado de acceso a herramientas de inspección o código fuente del sistema.
            </p>

            {/* Ficha de Auditoría en Tiempo Real */}
            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 text-left text-xs space-y-2 font-mono">
              <div className="flex justify-between border-b border-zinc-800/80 pb-1.5">
                <span className="text-zinc-500">Operador Activo:</span>
                <span className="font-semibold text-zinc-200">{incidentData?.user || user?.name || "No autenticado"}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/80 pb-1.5">
                <span className="text-zinc-500">Rol / Sucursal:</span>
                <span className="text-zinc-300 uppercase">{incidentData?.role || user?.role || "Operativo"} · {incidentData?.branch || user?.branch_id || "Central"}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/80 pb-1.5">
                <span className="text-zinc-500">Fecha y Hora:</span>
                <span className="text-amber-400">{incidentData?.timestamp || new Date().toLocaleString("es-NI")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Estado de Auditoría:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Transmitido a Gerencia
                </span>
              </div>
            </div>

            {/* Formulario de Desbloqueo de Gerencia */}
            <form onSubmit={handleUnlock} className="mt-6 space-y-3">
              <div className="relative">
                <input
                  type="password"
                  maxLength={8}
                  placeholder="PIN de Gerencia para desbloquear"
                  value={unlockPin}
                  onChange={(e) => setUnlockPin(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-sm font-semibold tracking-widest text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  autoFocus
                />
                <KeyRound className="absolute right-3.5 top-3.5 h-4 w-4 text-zinc-500" />
              </div>

              {unlockError && (
                <p className="text-xs text-red-400 font-medium flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> {unlockError}
                </p>
              )}

              <button
                type="submit"
                disabled={isUnlocking || !unlockPin}
                className="w-full rounded-xl bg-red-600 hover:bg-red-500 py-3 text-sm font-bold text-white transition-colors disabled:opacity-50 shadow-md shadow-red-900/50 flex items-center justify-center gap-2"
              >
                <Lock className="h-4 w-4" /> {isUnlocking ? "Verificando..." : "Desbloquear Terminal"}
              </button>
            </form>
          </div>
        </div>
      )}
      {children}
    </>
  );
}

AntiTamperGuard.propTypes = {
  children: PropTypes.node,
};

export default AntiTamperGuard;
