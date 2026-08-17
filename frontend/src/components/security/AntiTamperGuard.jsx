import React, { useEffect, useState, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import {
  ShieldAlert,
  Lock,
  AlertTriangle,
  KeyRound,
  CheckCircle2,
  Copy,
  Scissors,
  ClipboardPaste,
  RefreshCw,
  Camera,
  Maximize2,
  Minimize2,
  Search,
  Calculator,
  Moon,
  Sun,
  LogOut,
  Download,
  Share2,
  X,
  Check,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import axios from "axios";

export function AntiTamperGuard({ children }) {
  const { user, logout } = useAuth();
  const { resolvedMode, toggleMode } = useTheme();

  // Estados de bloqueo por manipulación (DevTools)
  const [isTamperBlocked, setIsTamperBlocked] = useState(false);
  const [incidentData, setIncidentData] = useState(null);
  const [unlockPin, setUnlockPin] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const lastReportRef = useRef(0);

  // Menú contextual personalizado (Estilo Google Sheets)
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    targetInput: null,
    selectedText: "",
    isEditable: false,
  });
  const [actionFeedback, setActionFeedback] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Modal de Captura de Pantalla
  const [screenshotModal, setScreenshotModal] = useState({
    isOpen: false,
    imageUrl: "",
    isCapturing: false,
  });

  const reportTamperIncident = useCallback(
    async (triggerAction, extraDetails = {}) => {
      if (user?.role === "gerencia" || user?.role === "programador") {
        return;
      }
      const now = Date.now();
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
    },
    [user]
  );

  useEffect(() => {
    // 1. Bloqueo estricto de atajos de DevTools y Código Fuente
    const handleKeyDown = (e) => {
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        reportTamperIncident("F12_KEY_PRESS", { key: e.key });
        return false;
      }

      if (e.ctrlKey && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        reportTamperIncident("DEVTOOLS_INSPECT_SHORTCUT", { key: e.key });
        return false;
      }

      if (e.ctrlKey && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
        e.stopPropagation();
        reportTamperIncident("VIEW_SOURCE_SHORTCUT", { key: e.key });
        return false;
      }

      if (e.key === "Escape") {
        setContextMenu((prev) => ({ ...prev, visible: false }));
      }
    };

    // 2. Interceptar Clic Derecho para desplegar MENÚ ESTILO GOOGLE SHEETS
    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const target = e.target;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const windowSelection = window.getSelection()?.toString() || "";
      const inputSelection =
        isInput && target.selectionStart !== undefined
          ? target.value.substring(target.selectionStart, target.selectionEnd)
          : "";
      const textToCopy = inputSelection || windowSelection;

      const menuWidth = 230;
      const menuHeight = 360;
      const x = Math.min(e.clientX, window.innerWidth - menuWidth - 12);
      const y = Math.min(e.clientY, window.innerHeight - menuHeight - 12);

      setContextMenu({
        visible: true,
        x: Math.max(10, x),
        y: Math.max(10, y),
        targetInput: isInput ? target : null,
        selectedText: textToCopy,
        isEditable: isInput,
      });

      return false;
    };

    const handleGlobalClick = () => {
      setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("contextmenu", handleContextMenu, true);
    window.addEventListener("click", handleGlobalClick);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("contextmenu", handleContextMenu, true);
      window.removeEventListener("click", handleGlobalClick);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [reportTamperIncident]);

  const showFeedback = (msg) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(""), 1800);
  };

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  // Acciones de Portapapeles
  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      const text = contextMenu.selectedText;
      if (text) {
        await navigator.clipboard.writeText(text);
      } else {
        document.execCommand("copy");
      }
      showFeedback("¡Copiado!");
    } catch {
      document.execCommand("copy");
      showFeedback("¡Copiado!");
    }
    closeContextMenu();
  };

  const handleCut = async (e) => {
    e.stopPropagation();
    const target = contextMenu.targetInput;
    if (target && target.selectionStart !== undefined) {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const cutText = val.substring(start, end);
      if (cutText) {
        try {
          await navigator.clipboard.writeText(cutText);
        } catch {
          document.execCommand("cut");
        }
        target.value = val.substring(0, start) + val.substring(end);
        target.selectionStart = target.selectionEnd = start;
        target.dispatchEvent(new Event("input", { bubbles: true }));
        showFeedback("¡Cortado!");
      }
    } else {
      document.execCommand("cut");
      showFeedback("¡Cortado!");
    }
    closeContextMenu();
  };

  const handlePaste = async (e) => {
    e.stopPropagation();
    const target = contextMenu.targetInput;
    try {
      const text = await navigator.clipboard.readText();
      if (target && text) {
        target.focus();
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        const val = target.value;
        target.value = val.substring(0, start) + text + val.substring(end);
        target.selectionStart = target.selectionEnd = start + text.length;
        target.dispatchEvent(new Event("input", { bubbles: true }));
        showFeedback("¡Pegado!");
      } else {
        document.execCommand("paste");
        showFeedback("¡Pegado!");
      }
    } catch {
      document.execCommand("paste");
      showFeedback("¡Pegado!");
    }
    closeContextMenu();
  };

  // Recarga Fuerte / Hard Refresh (Limpiar caché del navegador)
  const handleHardReload = (e) => {
    e.stopPropagation();
    closeContextMenu();
    if (window.caches) {
      caches.keys().then((names) => {
        for (const name of names) caches.delete(name);
      });
    }
    window.location.reload(true);
  };

  // Captura de Pantalla (Carga dinámica de html2canvas / fallback nativo)
  const handleCaptureScreen = async (e) => {
    e.stopPropagation();
    closeContextMenu();
    setScreenshotModal({ isOpen: true, imageUrl: "", isCapturing: true });

    try {
      // 1. Intentar cargar html2canvas dinámicamente si no está presente
      const getHtml2Canvas = () =>
        new Promise((resolve) => {
          if (window.html2canvas) return resolve(window.html2canvas);
          const script = document.createElement("script");
          script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          script.onload = () => resolve(window.html2canvas);
          script.onerror = () => resolve(null);
          document.head.appendChild(script);
        });

      const h2c = await getHtml2Canvas();

      if (h2c) {
        const canvas = await h2c(document.body, {
          useCORS: true,
          allowTaint: true,
          scale: window.devicePixelRatio || 1.5,
          logging: false,
        });
        const dataUrl = canvas.toDataURL("image/png");
        setScreenshotModal({ isOpen: true, imageUrl: dataUrl, isCapturing: false });
      } else if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ preferCurrentTab: true });
        const track = stream.getVideoTracks()[0];
        const imageCapture = new window.ImageCapture(track);
        const bitmap = await imageCapture.grabFrame();
        track.stop();
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0);
        setScreenshotModal({ isOpen: true, imageUrl: canvas.toDataURL("image/png"), isCapturing: false });
      } else {
        alert("Tu navegador no soporta captura directa de pantalla.");
        setScreenshotModal({ isOpen: false, imageUrl: "", isCapturing: false });
      }
    } catch (err) {
      console.warn("Screenshot canceled or error", err);
      setScreenshotModal({ isOpen: false, imageUrl: "", isCapturing: false });
    }
  };

  // Pantalla Completa (Modo Kiosko)
  const handleToggleFullscreen = (e) => {
    e.stopPropagation();
    closeContextMenu();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Herramientas de Vendedores
  const handleOpenSearch = (e) => {
    e.stopPropagation();
    closeContextMenu();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
  };

  const handleOpenCalculator = (e) => {
    e.stopPropagation();
    closeContextMenu();
    window.dispatchEvent(new CustomEvent("erp:open-tool", { detail: { tool: "calculator" } }));
  };

  const handleLogout = (e) => {
    e.stopPropagation();
    closeContextMenu();
    if (logout) {
      logout();
    } else {
      window.location.href = "/login";
    }
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!unlockPin) return;
    setIsUnlocking(true);
    setUnlockError("");

    try {
      const res = await axios.post("/api/auth/pin/login", { pin: unlockPin });
      const pinUser = res.data?.user;
      if (
        pinUser &&
        (pinUser.role === "gerencia" ||
          pinUser.role === "programador" ||
          pinUser.role === "supervisor")
      ) {
        setIsTamperBlocked(false);
        setUnlockPin("");
        setIncidentData(null);
      } else {
        setUnlockError("Se requiere PIN de Gerencia o Supervisor para desbloquear.");
      }
    } catch {
      setUnlockError("PIN de gerencia incorrecto o no autorizado.");
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <>
      {/* Menú Contextual Estilo Google Sheets */}
      {contextMenu.visible && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-[999999] w-[220px] rounded-xl border border-zinc-200 bg-white/95 py-1.5 shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-100 text-zinc-800 text-xs font-medium animate-in fade-in zoom-in-95 duration-100 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Grupo 1: Edición y Portapapeles */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Copy className="h-4 w-4 text-zinc-500" />
            <span className="flex-1">Copiar</span>
            <span className="text-[10px] text-zinc-400 font-mono">Ctrl+C</span>
          </button>

          {contextMenu.isEditable && (
            <button
              type="button"
              onClick={handleCut}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Scissors className="h-4 w-4 text-zinc-500" />
              <span className="flex-1">Cortar</span>
              <span className="text-[10px] text-zinc-400 font-mono">Ctrl+X</span>
            </button>
          )}

          {contextMenu.isEditable && (
            <button
              type="button"
              onClick={handlePaste}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ClipboardPaste className="h-4 w-4 text-zinc-500" />
              <span className="flex-1">Pegar</span>
              <span className="text-[10px] text-zinc-400 font-mono">Ctrl+V</span>
            </button>
          )}

          <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />

          {/* Grupo 2: Acciones del Sistema */}
          <button
            type="button"
            onClick={handleHardReload}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4 text-blue-500" />
            <span className="flex-1">Recargar Fuerte</span>
            <span className="text-[10px] text-zinc-400 font-mono">Ctrl+F5</span>
          </button>

          <button
            type="button"
            onClick={handleCaptureScreen}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Camera className="h-4 w-4 text-emerald-500" />
            <span className="flex-1">Captura y Compartir</span>
            <ChevronRight className="h-3 w-3 text-zinc-400 ml-auto" />
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4 text-zinc-500" />
            ) : (
              <Maximize2 className="h-4 w-4 text-zinc-500" />
            )}
            <span className="flex-1">{isFullscreen ? "Salir Pantalla Completa" : "Pantalla Completa"}</span>
            <span className="text-[10px] text-zinc-400 font-mono">F11</span>
          </button>

          <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />

          {/* Grupo 3: Herramientas Rápidas de Vendedor */}
          <button
            type="button"
            onClick={handleOpenSearch}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Search className="h-4 w-4 text-amber-500" />
            <span className="flex-1">Buscar Producto / Stock</span>
            <span className="text-[10px] text-zinc-400 font-mono">Ctrl+K</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCalculator}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Calculator className="h-4 w-4 text-indigo-500" />
            <span className="flex-1">Calculadora / USD</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMode();
              closeContextMenu();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {resolvedMode === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-400" />
            )}
            <span className="flex-1">
              {resolvedMode === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
            </span>
          </button>

          <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />

          {/* Grupo 4: Cerrar Sesión */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-red-500/10 text-red-600 dark:text-red-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="flex-1 font-semibold">Cerrar Sesión</span>
          </button>

          {actionFeedback && (
            <div className="mx-2 mt-1.5 flex items-center justify-center gap-1 rounded-md bg-emerald-500/10 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" /> {actionFeedback}
            </div>
          )}
        </div>
      )}

      {/* Modal de Previsualización y Compartir Captura de Pantalla */}
      {screenshotModal.isOpen && (
        <div className="fixed inset-0 z-[99999999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-w-2xl w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 text-zinc-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-emerald-500" />
                <h3 className="text-base font-bold">Captura de Pantalla del ERP</h3>
              </div>
              <button
                type="button"
                onClick={() => setScreenshotModal({ isOpen: false, imageUrl: "", isCapturing: false })}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-col items-center">
              {screenshotModal.isCapturing ? (
                <div className="flex flex-col items-center justify-center py-16 text-sm text-zinc-500">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary mb-2" />
                  <span>Generando captura de pantalla de alta resolución...</span>
                </div>
              ) : (
                <div className="max-h-[50vh] overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-inner">
                  <img
                    src={screenshotModal.imageUrl}
                    alt="Captura ERP"
                    className="w-full h-auto object-contain rounded-lg"
                  />
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(screenshotModal.imageUrl);
                    const blob = await res.blob();
                    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
                    alert("¡Imagen copiada al portapapeles con éxito!");
                  } catch {
                    alert("No se pudo copiar directamente; puedes usar el botón Descargar.");
                  }
                }}
                className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar Imagen
              </button>

              <a
                href={screenshotModal.imageUrl}
                download={`captura_erp_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "_")}.png`}
                className="flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-4 py-2 text-xs font-bold text-white transition-colors shadow-md shadow-primary/30"
              >
                <Download className="h-3.5 w-3.5" /> Descargar PNG
              </a>

              <button
                type="button"
                onClick={() => {
                  const msg = encodeURIComponent("Adjunto captura de comprobante / pantalla del ERP MC-Larens.");
                  window.open(`https://api.whatsapp.com/send?text=${msg}`, "_blank");
                }}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition-colors shadow-md shadow-emerald-700/30"
              >
                <Share2 className="h-3.5 w-3.5" /> Compartir en WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pantalla de Bloqueo por Manipulación Indebida (DevTools Blackout) */}
      {isTamperBlocked && (
        <div className="fixed inset-0 z-[9999999] flex flex-col items-center justify-center bg-black/98 p-6 text-white backdrop-blur-3xl animate-in fade-in duration-300 select-none">
          <div className="relative max-w-lg w-full rounded-2xl border border-red-500/40 bg-zinc-950/90 p-8 shadow-2xl shadow-red-950/80 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-950/60 border-2 border-red-500/80 shadow-lg shadow-red-500/30 animate-pulse">
              <ShieldAlert className="h-10 w-10 text-red-500" />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-red-400 sm:text-2xl uppercase">
              Terminal Bloqueada por Seguridad
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Se detectó un intento no autorizado de acceso a herramientas de inspección o código fuente del sistema.
            </p>

            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 text-left text-xs space-y-2 font-mono">
              <div className="flex justify-between border-b border-zinc-800/80 pb-1.5">
                <span className="text-zinc-500">Operador Activo:</span>
                <span className="font-semibold text-zinc-200">
                  {incidentData?.user || user?.name || "No autenticado"}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/80 pb-1.5">
                <span className="text-zinc-500">Rol / Sucursal:</span>
                <span className="text-zinc-300 uppercase">
                  {incidentData?.role || user?.role || "Operativo"} ·{" "}
                  {incidentData?.branch || user?.branch_id || "Central"}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-800/80 pb-1.5">
                <span className="text-zinc-500">Fecha y Hora:</span>
                <span className="text-amber-400">
                  {incidentData?.timestamp || new Date().toLocaleString("es-NI")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Estado de Auditoría:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Transmitido a Gerencia
                </span>
              </div>
            </div>

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
                <Lock className="h-4 w-4" />{" "}
                {isUnlocking ? "Verificando..." : "Desbloquear Terminal"}
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
