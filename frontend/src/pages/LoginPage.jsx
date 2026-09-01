import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Loader2, Sun, Moon, Calculator, ArrowLeftRight, Info, Lock, ShieldAlert, Server, Volume2, VolumeX } from "lucide-react";
import { API_BASE as API, setStoredSessionToken, setStoredUser } from "@/lib/api";
import { APP_ENV } from "@/lib/env";
import { playLoginPinpadSound } from "@/lib/uiSounds";
import { useDevice } from "../hooks/useDevice";
import { formatCurrency } from "../lib/utils";
import { getRoleHomePath } from "@/lib/roleHome";
import { SevenSegCountdown } from "@/components/auth/SevenSegCountdown";
import ServerConnectionDialog from "../components/common/ServerConnectionDialog";
import BackgroundPromoVideo from "@/components/auth/BackgroundPromoVideo";
import { getBrandInfoForVideo } from "@/lib/promoVideos";

// Connectivity check interval (ms)
const CONNECTIVITY_POLL_INTERVAL = 10000;
const PIN_LENGTH = 8;
/** Tick every 0.01s so centiseconds scroll fluidly on the 7-segment display. */
const LOCKOUT_TICK_MS = 10;

/** Format remaining ms as huge countdown with centiseconds: M:SS.cc or SS.cc */
function formatLockoutCountdown(remainingMs) {
  const totalMs = Math.max(0, Number(remainingMs) || 0);
  const totalSeconds = Math.floor(totalMs / 1000);
  const centiseconds = Math.floor((totalMs % 1000) / 10);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, "0");
  const cc = String(centiseconds).padStart(2, "0");
  if (minutes > 0) {
    return `${minutes}:${ss}.${cc}`;
  }
  return `${ss}.${cc}`;
}

function formatTime(date) {
  if (!date) return "";
  return date.toLocaleTimeString("es-NI", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDateFull(date) {
  if (!date) return "";
  const dayName = date.toLocaleDateString("es-NI", { weekday: "short" }).toUpperCase().replace(".", "");
  const day = date.getDate();
  const month = date.toLocaleDateString("es-NI", { month: "long" });
  const year = date.getFullYear();
  return `${day} de ${month} de ${year} · ${dayName}`;
}

const ATTENDANCE_KIOSK_SHORTCUT_PIN = (typeof window !== 'undefined' && window.__ATTENDANCE_KIOSK_SHORTCUT_PIN__)
  ? String(window.__ATTENDANCE_KIOSK_SHORTCUT_PIN__)
  : APP_ENV.attendanceKioskShortcutPin;

export function LoginPage() {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const { resolvedMode, toggleMode, setMode, setSkin, watermarkOpacity } = useTheme();
  const device = useDevice();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState("unknown"); // unknown, ok, down
  const [checkingBackend, setCheckingBackend] = useState(false);
  // lastBackendCheck state removed (was unused)
  const [authStatus, setAuthStatus] = useState("idle"); // idle, success, error
  const [showResetWarning, setShowResetWarning] = useState(false);
  const pinInputRef = useRef(null);
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(null);
  const [lockoutRemainingMs, setLockoutRemainingMs] = useState(0);
  const [showLoginInfo, setShowLoginInfo] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [showGerenciaUnlock, setShowGerenciaUnlock] = useState(false);
  const [unlockPin, setUnlockPin] = useState("");
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockError, setUnlockError] = useState(null);
  const unlockPinInputRef = useRef(null);
  const isPinLocked = Boolean(lockoutUntil && lockoutRemainingMs > 0);
  const buildVersion = APP_ENV.buildVersion;
  const buildTimeRaw = APP_ENV.buildTime;
  const buildTime = buildTimeRaw ? new Date(buildTimeRaw) : null;
  const buildTimeLabel = buildTime
    ? buildTime.toLocaleString("es-NI", { dateStyle: "medium", timeStyle: "short" })
    : "desconocida";

  // Reloj Digital, Estado OSD, Audio, Herramientas y Marca de Video Activo
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isPinpadVisible, setIsPinpadVisible] = useState(true);
  const [isWakeButtonVisible, setIsWakeButtonVisible] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [currentPlayingVideo, setCurrentPlayingVideo] = useState(null);
  const brandInfo = useMemo(() => getBrandInfoForVideo(currentPlayingVideo), [currentPlayingVideo]);
  const osdTimerRef = useRef(null);
  const wakeTimerRef = useRef(null);

  const resetOsdTimer = useCallback(() => {
    setIsPinpadVisible(true);
    setIsWakeButtonVisible(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current);

    osdTimerRef.current = setTimeout(() => {
      setIsPinpadVisible(false);
      // Tras ocultar el teclado, el botón de PIN permanece visible durante 3 latidos (9.2s) antes de hacer fadeout
      wakeTimerRef.current = setTimeout(() => {
        setIsWakeButtonVisible(false);
      }, 9200);
    }, 5000);
  }, []);

  const handleWakeActivity = useCallback(() => {
    setIsWakeButtonVisible(true);
    if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current);
    if (!isPinpadVisible) {
      wakeTimerRef.current = setTimeout(() => {
        setIsWakeButtonVisible(false);
      }, 9200);
    }
  }, [isPinpadVisible]);

  useEffect(() => {
    resetOsdTimer();
    return () => {
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
      if (wakeTimerRef.current) clearTimeout(wakeTimerRef.current);
    };
  }, [resetOsdTimer]);

  const [activeTool, setActiveTool] = useState(null);
  const [fxAmount, setFxAmount] = useState("1");
  const [fxFrom, setFxFrom] = useState("USD");
  const [fxTo, setFxTo] = useState("NIO");
  const [fxRate, setFxRate] = useState(null);
  const [fxResult, setFxResult] = useState("");
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState("");


  const deviceTypeLabel = device.isPhone
    ? "Movil"
    : device.isTablet
      ? "Tablet"
      : "PC";
  const deviceRuleLabel = device.isPhone
    ? "< 640px"
    : device.isTablet
      ? "640-1023px"
      : ">= 1024px";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search || "");
    const isFreshLogin = ["1", "true", "yes"].includes((params.get("fresh") || "").toLowerCase());
    if (!isFreshLogin) return;

    const run = async () => {
      try {
        await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      } catch (_) {
        // ignore logout errors; local cleanup still helps
      }

      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch (_) {
        // ignore storage cleanup errors
      }

      try {
        const cleanUrl = `${window.location.origin}/login`;
        window.history.replaceState({}, "", cleanUrl);
      } catch (_) {
        // ignore history errors
      }

      toast.success("Sesión limpiada. Ingresa nuevamente tu PIN.");
    };

    run();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // High-frequency lockout countdown (centiseconds) for the full-screen red overlay.
  useEffect(() => {
    if (!lockoutUntil) {
      setLockoutRemainingMs(0);
      setLockoutSeconds(null);
      return undefined;
    }
    const untilMs =
      lockoutUntil instanceof Date ? lockoutUntil.getTime() : new Date(lockoutUntil).getTime();
    if (Number.isNaN(untilMs)) {
      setLockoutUntil(null);
      setLockoutRemainingMs(0);
      setLockoutSeconds(null);
      return undefined;
    }

    const tick = () => {
      const remaining = Math.max(0, untilMs - Date.now());
      setLockoutRemainingMs(remaining);
      setLockoutSeconds(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        setLockoutUntil(null);
        setLockoutRemainingMs(0);
        setLockoutSeconds(null);
        setRemainingAttempts(null);
      }
    };
    tick();
    const timer = setInterval(tick, LOCKOUT_TICK_MS);
    return () => clearInterval(timer);
  }, [lockoutUntil]);

  const clearLocalLockout = useCallback(() => {
    setLockoutUntil(null);
    setLockoutSeconds(null);
    setLockoutRemainingMs(0);
    setRemainingAttempts(null);
    setShowGerenciaUnlock(false);
    setUnlockPin("");
    setUnlockError(null);
  }, []);

  const applyLockoutFromDetail = useCallback((detail) => {
    if (!detail || typeof detail !== "object") return;
    if (detail.remaining_attempts !== undefined) {
      setRemainingAttempts(detail.remaining_attempts);
    }
    const seconds = Number(detail.lockout_seconds);
    if (detail.lockout_until) {
      const until = new Date(detail.lockout_until);
      if (!Number.isNaN(until.getTime())) {
        setLockoutUntil(until);
        const ms = Math.max(0, until.getTime() - Date.now());
        setLockoutRemainingMs(ms);
        setLockoutSeconds(Math.ceil(ms / 1000));
        return;
      }
    }
    if (Number.isFinite(seconds) && seconds > 0) {
      const until = new Date(Date.now() + seconds * 1000);
      setLockoutUntil(until);
      setLockoutRemainingMs(seconds * 1000);
      setLockoutSeconds(seconds);
    }
  }, []);

  // Restore terminal lockout after refresh (server-side IP lock)
  useEffect(() => {
    let cancelled = false;
    const loadTerminalStatus = async () => {
      try {
        const res = await axios.get(`${API}/auth/pin/terminal-status`, { timeout: 5000 });
        if (cancelled) return;
        const data = res.data || {};
        if (data.locked && data.lockout_until) {
          applyLockoutFromDetail(data);
        }
      } catch {
        // ignore — login page still works offline from client state
      }
    };
    loadTerminalStatus();
    return () => {
      cancelled = true;
    };
  }, [applyLockoutFromDetail]);

  const formatTime = (date) => {
    const days = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
    const ddd = days[date.getDay()];
    // HH:MM:SS format
    const time = date.toLocaleTimeString('es-GT', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${ddd} ${time}`;
  };

  const formatDateFull = (date) => {
    return date.toLocaleDateString('es-GT', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const handleToolToggle = (tool) => {
    setActiveTool((prev) => (prev === tool ? null : tool));
    setFxError("");
  };

  const handleFreshSessionReset = useCallback(() => {
    const freshUrl = `${window.location.origin}/login?fresh=1&t=${Date.now()}`;
    window.location.href = freshUrl;
  }, []);

  const handleSwapCurrencies = () => {
    setFxFrom((prev) => {
      setFxTo(prev);
      return fxTo;
    });
  };

  const handleConvertCurrency = useCallback(async () => {
    const amount = parseFloat(fxAmount);
    if (Number.isNaN(amount)) {
      setFxError("Ingresa un monto valido");
      return;
    }
    setFxLoading(true);
    setFxError("");
    try {
      const response = await axios.get(`${API}/currencies/convert`, {
        params: {
          amount,
          from_currency: fxFrom,
          to_currency: fxTo,
        },
      });
      setFxRate(response.data.rate);
      setFxResult(response.data.converted);
    } catch (error) {
      console.error("FX convert error:", error);
      setFxError("No se pudo obtener la tasa del sistema");
    } finally {
      setFxLoading(false);
    }
  }, [fxAmount, fxFrom, fxTo]);

  useEffect(() => {
    if (activeTool === "calculator") {
      handleConvertCurrency();
    }
  }, [activeTool, handleConvertCurrency]);

  const playTone = useCallback((kind) => {
    playLoginPinpadSound(kind);
  }, []);

  const handleGerenciaUnlock = useCallback(async (pinOverride = null) => {
    const pinToUse = String(pinOverride ?? unlockPin).replace(/\D/g, "").slice(0, 8);
    if (pinToUse.length !== PIN_LENGTH) {
      setUnlockError("Ingresa el PIN de gerencia (8 dígitos)");
      playTone("warning");
      return;
    }
    setUnlockLoading(true);
    setUnlockError(null);
    try {
      const res = await axios.post(
        `${API}/auth/pin/terminal-unlock`,
        { unlock_pin: pinToUse },
        { timeout: 10000 },
      );
      clearLocalLockout();
      setPin("");
      playTone("success");
      const who = res.data?.unlocked_by_name || res.data?.role || "gerencia";
      toast.success(`Terminal desbloqueada (${who}). Ya pueden iniciar sesión.`);
    } catch (error) {
      const detail = error?.response?.data?.detail;
      const msg =
        (typeof detail === "object" ? detail?.message : detail) ||
        "PIN de gerencia inválido";
      setUnlockError(typeof msg === "string" ? msg : "No se pudo desbloquear");
      playTone("error");
      setUnlockPin("");
      // Keep focus for another attempt without showing digits
      window.setTimeout(() => unlockPinInputRef.current?.focus(), 50);
    } finally {
      setUnlockLoading(false);
    }
  }, [clearLocalLockout, playTone, unlockPin]);

  const handleUnlockPinInputChange = useCallback(
    (event) => {
      if (unlockLoading) return;
      const digits = String(event.target.value || "").replace(/\D/g, "").slice(0, PIN_LENGTH);
      setUnlockError(null);
      setUnlockPin(digits);
      if (digits.length === PIN_LENGTH) {
        window.setTimeout(() => handleGerenciaUnlock(digits), 40);
      }
    },
    [handleGerenciaUnlock, unlockLoading],
  );

  // Focus hidden input when gerencia unlock mode opens
  useEffect(() => {
    if (!isPinLocked || !showGerenciaUnlock) return undefined;
    const t = window.setTimeout(() => unlockPinInputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [isPinLocked, showGerenciaUnlock]);

  // Keyboard capture for gerencia unlock (physical keyboard / numpad)
  useEffect(() => {
    if (!isPinLocked || !showGerenciaUnlock || unlockLoading) return undefined;

    const onKeyDown = (event) => {
      // Don't steal keys from real inputs (except our hidden unlock field)
      const tag = String(event.target?.tagName || "").toLowerCase();
      const isOurInput = event.target === unlockPinInputRef.current;
      if (tag === "input" && !isOurInput) return;
      if (tag === "textarea" || tag === "select") return;

      if (event.key === "Escape") {
        event.preventDefault();
        setShowGerenciaUnlock(false);
        setUnlockPin("");
        setUnlockError(null);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (unlockPin.length === PIN_LENGTH) handleGerenciaUnlock(unlockPin);
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        setUnlockError(null);
        setUnlockPin((prev) => prev.slice(0, -1));
        return;
      }

      let digit = null;
      if (/^[0-9]$/.test(event.key)) digit = event.key;
      else if (event.code?.startsWith("Numpad") && /^Numpad[0-9]$/.test(event.code)) {
        digit = event.code.replace("Numpad", "");
      }
      if (digit == null) return;

      event.preventDefault();
      setUnlockError(null);
      setUnlockPin((prev) => {
        if (prev.length >= PIN_LENGTH) return prev;
        const next = (prev + digit).slice(0, PIN_LENGTH);
        if (next.length === PIN_LENGTH) {
          window.setTimeout(() => handleGerenciaUnlock(next), 40);
        }
        return next;
      });
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [handleGerenciaUnlock, isPinLocked, showGerenciaUnlock, unlockLoading, unlockPin]);

  const handlePinLogin = useCallback(async (pinOverride = null) => {
    const pinToUse = pinOverride ?? pin;
    if (isPinLocked) {
      playTone("warning");
      toast.error(
        lockoutRemainingMs > 0
          ? `Terminal bloqueada. Espera ${formatLockoutCountdown(lockoutRemainingMs)}`
          : "Terminal bloqueada por intentos fallidos"
      );
      return;
    }
    if (pinToUse === ATTENDANCE_KIOSK_SHORTCUT_PIN) {
      playTone("success");
      toast.success("Abriendo reloj marcador...");
      setPin("");
      window.location.href = "/attendance-clock";
      return;
    }

    if (pinToUse.length !== PIN_LENGTH) {
      playTone("warning");
      toast.error("Ingresa tu PIN de 8 dígitos");
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await axios.post(
        `${API}/auth/pin/login`,
        { pin: pinToUse },
        { withCredentials: true, signal: controller.signal, timeout: 8000 }
      );

      const resData = response.data;
      if (
        !resData ||
        typeof resData !== "object" ||
        typeof resData === "string" ||
        (!resData.user && !resData.user_id && !resData.session_token)
      ) {
        throw new Error("Respuesta inválida del servidor. Verifique la conexión.");
      }

      const loggedUser = resData?.user || resData;
      if (!loggedUser || (!loggedUser.user_id && !loggedUser.id && !loggedUser.name)) {
        throw new Error("No se pudo obtener la información del usuario.");
      }

      setAuthStatus("success");
      setRemainingAttempts(null);
      setLockoutUntil(null);
      setLockoutSeconds(null);
      setLockoutRemainingMs(0);

      const sessionToken = resData?.session_token;
      if (sessionToken) {
        setStoredSessionToken(sessionToken);
      }
      setStoredUser(loggedUser);

      // Apply saved theme from server/session if provided
      try {
        const serverMode = loggedUser.theme_mode || loggedUser.mode;
        const serverSkin = loggedUser.theme_skin || loggedUser.skin;
        if (serverMode) setMode(serverMode);
        if (serverSkin) setSkin(serverSkin);
      } catch (e) {
        // ignore
      }
      toast.success(`Bienvenido, ${loggedUser.name || "usuario"}`);
      playTone("success");
      
      // Attempt auth check but don't block widely if it delays
      try {
        await Promise.race([
          checkAuth(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000)),
        ]);
      } catch (_) {
        // ignore timeout
      }

      const loggedRole = loggedUser.role;
      const nextPath = new URLSearchParams(window.location.search).get("next");
      const targetPath = nextPath && nextPath.startsWith("/") ? nextPath : getRoleHomePath(loggedRole);
      navigate(targetPath, { replace: true });
    } catch (error) {
      setAuthStatus("error");
      setShowResetWarning(true);
      setTimeout(() => setShowResetWarning(false), 5000);
      // Reset error status after animation
      setTimeout(() => setAuthStatus("idle"), 500);

      const detail = error.response?.data?.detail;
      let message = error.message || "PIN incorrecto";
      if (error.response?.status) {
        setBackendStatus("ok");
      }

      if (error.code === "ECONNABORTED" || error.code === "ERR_CANCELED") {
        message = "Tiempo de espera agotado. Intenta de nuevo en unos segundos.";
        try {
          const ping = await axios.get(`${API}/`, { timeout: 3000 });
          if (ping?.status >= 200 && ping?.status < 500) {
            setBackendStatus("ok");
          }
        } catch (_) {
          setBackendStatus("down");
        }
      } else if (error.response?.status === 429) {
        message = (typeof detail === "object" && detail?.message)
          ? detail.message
          : "Demasiados intentos desde esta ubicación. Intente más tarde.";
        setRemainingAttempts(0);
        if (typeof detail === "object") {
          applyLockoutFromDetail({
            remaining_attempts: 0,
            lockout_seconds: detail.retry_after_seconds || detail.lockout_seconds || 60,
            lockout_until: detail.lockout_until,
          });
        }
      } else if (detail) {
        if (typeof detail === "object") {
          message = detail.message || message;
          applyLockoutFromDetail(detail);
          if (
            detail.remaining_attempts !== undefined &&
            Number(detail.remaining_attempts) >= 0 &&
            !detail.lockout_until &&
            !(Number(detail.lockout_seconds) > 0)
          ) {
            message = `${message}. Intentos restantes: ${detail.remaining_attempts}`;
          }
        } else {
          message = detail;
        }
      } else if (!error.response?.status) {
        setBackendStatus("unknown");
      }

      toast.error(message);
      playTone("error");
      setPin("");
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [applyLockoutFromDetail, checkAuth, isPinLocked, lockoutRemainingMs, pin, playTone, setMode, setSkin]);

  const handlePinKeyPress = useCallback((digit) => {
    if (isPinLocked || loading) return;
    if (authStatus === 'error') setAuthStatus('idle');
    if (showResetWarning) setShowResetWarning(false);
    
    // If pin is full, don't add more digits unless it's a fresh start logic (optional)
    // But here we rely on the user clearing or just typing if length < 6
    if (pin.length < PIN_LENGTH) {
      playTone("key");
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === PIN_LENGTH) {
        // Auto-submit when PIN is complete
        // Small delay to ensure state consistency
        setTimeout(() => handlePinLogin(newPin), 50);
      }
    }
  }, [authStatus, handlePinLogin, isPinLocked, loading, pin, playTone, showResetWarning]);

  const handlePinBackspace = useCallback(() => {
    if (isPinLocked || loading || pin.length === 0) return;
    playTone("key");
    setPin((prevPin) => prevPin.slice(0, -1));
  }, [isPinLocked, loading, pin.length, playTone]);

  const handlePinInputChange = useCallback((event) => {
    if (isPinLocked || loading) return;
    const digits = event.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPin(digits);
    if (digits.length === PIN_LENGTH) {
       setTimeout(() => handlePinLogin(digits), 50);
    }
  }, [handlePinLogin, isPinLocked, loading]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (loading || isPinLocked) return;

      // Normalize numpad keys (key and code) so NumLock on/off still works
      const numpadCodeMap = {
        Numpad0: "0",
        Numpad1: "1",
        Numpad2: "2",
        Numpad3: "3",
        Numpad4: "4",
        Numpad5: "5",
        Numpad6: "6",
        Numpad7: "7",
        Numpad8: "8",
        Numpad9: "9",
      };

      const numpadKeyMap = {
        Insert: "0",
        End: "1",
        ArrowDown: "2",
        PageDown: "3",
        ArrowLeft: "4",
        Clear: "5",
        ArrowRight: "6",
        Home: "7",
        ArrowUp: "8",
        PageUp: "9",
      };

      const key = event.key;
      const code = event.code;
      const digit = numpadCodeMap[code] ?? numpadKeyMap[key] ?? ( /^[0-9]$/.test(key) ? key : null );

      if (digit !== null && /^[0-9]$/.test(digit)) {
        event.preventDefault();
        handlePinKeyPress(digit);
        return;
      }
      if (key === "Backspace" || key === "Delete") {
        event.preventDefault();
        handlePinBackspace();
        return;
      }
      if (key === "Enter" && pin.length === PIN_LENGTH) {
        event.preventDefault();
        handlePinLogin();
      }
    };

    // Capture phase helps when focus is inside buttons or other elements
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handlePinBackspace, handlePinKeyPress, handlePinLogin, isPinLocked, loading, pin.length]);

  // Connectivity check: ping API root and update status
  const checkBackend = useCallback(async (signal) => {
    setCheckingBackend(true);
    try {
      await axios.get(`${API}/`, { timeout: 3000, signal });
      setBackendStatus("ok");
      // lastBackendCheck omitted
    } catch (err) {
      if (axios.isCancel?.(err) || err?.code === "ERR_CANCELED") {
        return;
      }
      setBackendStatus("down");
      // lastBackendCheck omitted
    } finally {
      setCheckingBackend(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    // immediate check on mount
    checkBackend(controller.signal).catch(() => null);

    const interval = setInterval(() => {
      if (!mounted) return;
      const c = new AbortController();
      checkBackend(c.signal).catch(() => null);
    }, CONNECTIVITY_POLL_INTERVAL);

    return () => {
      mounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [checkBackend]);

  return (
    <div 
      className="min-h-screen relative flex items-center justify-center overflow-hidden select-none bg-black font-microgramma safe-area-top safe-area-bottom pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
      onPointerDown={handleWakeActivity}
      onMouseMove={handleWakeActivity}
      onTouchStart={handleWakeActivity}
      onClick={handleWakeActivity}
    >
      {/* Background Promo Video Player */}
      <BackgroundPromoVideo
        isPortrait={device.isPortrait}
        isMuted={isMuted}
        onInteract={resetOsdTimer}
        onVideoChange={(vid) => setCurrentPlayingVideo(vid)}
        allowWidescreenOnMobile={true}
      />

      <input
        ref={pinInputRef}
        type="tel"
        inputMode="numeric"
        autoComplete="one-time-code"
        className="sr-only"
        value={pin}
        onChange={handlePinInputChange}
        disabled={loading || isPinLocked}
        aria-label="PIN"
      />

      {/* Top Left HUD - Time & Date Minimalist */}
      <div className="absolute top-6 left-6 z-20 pointer-events-none text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] font-microgramma">
        <p className="text-3xl sm:text-5xl font-black tracking-wider">
          {formatTime(currentTime)}
        </p>
        <p className="text-xs sm:text-sm font-bold text-white/90 uppercase tracking-widest mt-1">
          {formatDateFull(currentTime)}
        </p>
      </div>

      {/* Top Right HUD - Tool Buttons (Server Status, Calculator, Info, Theme, Mudo) - Sincronizados con OSD */}
      <div 
        className={`absolute top-4 right-4 z-30 flex items-center gap-2 transition-all duration-500 transform ${
          isPinpadVisible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/20 text-white backdrop-blur-md transition-all shadow-lg font-microgramma"
          onClick={(e) => {
            e.stopPropagation();
            resetOsdTimer();
            setShowServerConfig(true);
          }}
          aria-label="Configurar servidor"
          title="Estado del Servidor"
        >
          <Server className="h-4 w-4 text-sky-400" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/20 text-white backdrop-blur-md transition-all shadow-lg font-microgramma"
          onClick={(e) => {
            e.stopPropagation();
            resetOsdTimer();
            handleToolToggle("calculator");
          }}
          aria-label="Abrir calculadora"
          title="Calculadora de divisas"
        >
          <Calculator className="h-4 w-4 text-amber-300" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/20 text-white backdrop-blur-md transition-all shadow-lg font-microgramma"
          onClick={(e) => {
            e.stopPropagation();
            resetOsdTimer();
            setShowLoginInfo((prev) => !prev);
          }}
          aria-label={showLoginInfo ? "Ocultar información" : "Mostrar información"}
          title="Información del dispositivo"
          data-testid="login-info-toggle"
        >
          <Info className="h-4 w-4 text-emerald-300" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/20 text-white backdrop-blur-md transition-all shadow-lg font-microgramma"
          onClick={(e) => {
            e.stopPropagation();
            resetOsdTimer();
            toggleMode();
          }}
          aria-label="Cambiar tema"
          title="Tema claro/oscuro"
        >
          {resolvedMode === "dark" ? (
            <Sun className="h-4 w-4 text-yellow-300" />
          ) : (
            <Moon className="h-4 w-4 text-indigo-300" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            resetOsdTimer();
            setIsMuted((prev) => !prev);
          }}
          className="h-10 w-10 rounded-full bg-black/40 hover:bg-black/60 border border-white/20 text-white backdrop-blur-md transition-all shadow-lg font-microgramma"
          aria-label={isMuted ? "Activar audio" : "Silenciar audio"}
          title={isMuted ? "Activar audio" : "Silenciar audio"}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4 text-red-400" />
          ) : (
            <Volume2 className="h-4 w-4 text-emerald-400 animate-pulse" />
          )}
        </Button>
      </div>

      {/* Floating Calculator Overlay */}
      {activeTool === "calculator" && (
        <div 
          className="absolute top-20 right-6 z-40 w-[340px] rounded-2xl border border-white/20 bg-black/85 p-4 text-white shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 font-microgramma"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-sky-400">Calculadora de Divisas</h3>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-white/70 hover:text-white" onClick={() => setActiveTool(null)}>
              Cerrar
            </Button>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-white/80">Monto</Label>
              <input
                className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400 font-mono"
                value={fxAmount}
                onChange={(event) => setFxAmount(event.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs text-white/80">De</Label>
                <select
                  className="mt-1 w-full rounded-xl border border-white/20 bg-zinc-900 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                  value={fxFrom}
                  onChange={(event) => setFxFrom(event.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="NIO">NIO</option>
                </select>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={handleSwapCurrencies}
                aria-label="Intercambiar divisas"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <Label className="text-xs text-white/80">A</Label>
                <select
                  className="mt-1 w-full rounded-xl border border-white/20 bg-zinc-900 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                  value={fxTo}
                  onChange={(event) => setFxTo(event.target.value)}
                >
                  <option value="NIO">NIO</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <Button className="w-full rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold" onClick={handleConvertCurrency} disabled={fxLoading}>
              {fxLoading ? "Calculando..." : "Convertir"}
            </Button>
            <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between text-white/70">
                <span>Tasa</span>
                <span className="font-mono text-white">{fxRate ? fxRate.toFixed(4) : "-"}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-sm text-sky-300 pt-1 border-t border-white/10">
                <span>Resultado</span>
                <span>
                  {fxResult !== "" && fxResult !== null
                    ? formatCurrency(fxResult, fxTo)
                    : "-"}
                </span>
              </div>
              {fxError && <div className="text-xs text-rose-400">{fxError}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Device Info Overlay */}
      {showLoginInfo && (
        <div 
          className="absolute top-20 right-6 z-40 w-full max-w-sm rounded-2xl border border-white/20 bg-black/85 p-4 text-xs text-white shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 font-microgramma"
          onClick={(e) => e.stopPropagation()}
          data-testid="login-device-validator"
        >
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
            <span className="font-semibold text-sky-400">Información del Acceso</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs text-white/70 hover:text-white" onClick={() => setShowLoginInfo(false)}>
              Cerrar
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1">
              <span className={`inline-block h-2 w-2 rounded-full ${
                backendStatus === 'ok' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : backendStatus === 'down' ? 'bg-rose-500' : 'bg-yellow-400 animate-pulse'
              }`} />
              <span>
                {backendStatus === 'ok' && "Servidor en línea"}
                {backendStatus === 'down' && "Sin conexión"}
                {backendStatus === 'unknown' && (checkingBackend ? "Comprobando..." : "Verificando...")}
              </span>
            </div>
            <span className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1">
              Pantalla: <strong>{deviceTypeLabel}</strong> ({device.viewportWidth}x{device.viewportHeight})
            </span>
            <span className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1">
              Orientación: <strong>{device.isPortrait ? "Vertical (Tótem)" : "Horizontal"}</strong>
            </span>
          </div>
          <div className="mt-3 text-right text-white/50 text-[10px] font-mono">
            Version: {buildVersion} · Build: {buildTimeLabel}
          </div>
        </div>
      )}

      {/* Floating Wake Button when PIN pad is hidden (Heartbeat pulse 3 times with 25% resting opacity, then smooth fadeout) */}
      {!isPinpadVisible && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            resetOsdTimer();
          }}
          className={`fixed bottom-24 sm:bottom-14 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center gap-2.5 px-6 py-3 rounded-full bg-black/60 hover:bg-black/85 border border-white/20 backdrop-blur-xl text-white shadow-2xl text-xs sm:text-sm font-bold tracking-wider cursor-pointer font-microgramma transition-all duration-700 max-w-[90vw] whitespace-nowrap select-none ${
            isWakeButtonVisible
              ? "opacity-100 scale-100 animate-heartbeat-3s"
              : "opacity-0 scale-95 pointer-events-none"
          }`}
          data-testid="pin-wake-prompt"
        >
          <Lock className="h-4 w-4 text-sky-400 shrink-0" />
          <span className="truncate">Toca o teclea tu PIN para acceder</span>
        </button>
      )}

      {/* Center - Frosted Glass PIN Pad with 5-second OSD auto-fadeout */}
      <div
        className={`relative z-20 w-full max-w-[340px] sm:max-w-sm mx-auto p-5 sm:p-7 rounded-3xl backdrop-blur-2xl bg-black/50 dark:bg-black/65 border border-white/20 text-white shadow-2xl transition-all duration-500 transform font-microgramma ${
          isPinpadVisible ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <h2 className="font-microgramma text-xl sm:text-2xl font-black text-white tracking-wider">Acceso Rápido</h2>
          <p className="text-xs text-white/70 mt-0.5 tracking-wide">
            Ingresa tu PIN de 8 dígitos para acceder
          </p>
        </div>

        {/* PIN Display (always masked) */}
        <div className="flex justify-center gap-1.5 mb-5 flex-wrap max-w-[320px] mx-auto">
          {[...Array(PIN_LENGTH)].map((_, i) => (
            <div
              key={i}
              className={`w-7 sm:w-8 h-10 sm:h-11 rounded-xl border-2 flex items-center justify-center text-xl font-bold font-microgramma transition-all ${
                pin.length > i
                  ? "border-sky-400 bg-sky-500/30 text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.6)] scale-105"
                  : "border-white/20 bg-white/5 text-white/30"
              }`}
            >
              {pin.length > i ? "•" : ""}
            </div>
          ))}
        </div>

        {remainingAttempts !== null && !isPinLocked && (
          <div className="text-center text-xs text-amber-300 mb-2 font-bold font-microgramma">
            Intentos restantes: {remainingAttempts}
          </div>
        )}

        <div className={`grid grid-cols-3 gap-2 max-w-xs mx-auto p-1 rounded-2xl transition-all duration-300 ${
          isPinLocked ? "opacity-40 pointer-events-none" :
          authStatus === "error" ? "bg-destructive/30 ring-2 ring-destructive animate-shake" :
          authStatus === "success" ? "bg-green-500/30 ring-2 ring-green-500" :
          ""
        }`}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <Button
              key={digit}
              type="button"
              variant="outline"
              className="h-12 sm:h-14 rounded-2xl border-white/15 bg-white/10 hover:bg-white/25 active:bg-white/35 active:scale-95 text-white text-xl sm:text-2xl font-microgramma font-bold backdrop-blur-md shadow-md transition-all"
              onClick={() => {
                resetOsdTimer();
                handlePinKeyPress(String(digit));
              }}
              disabled={loading || isPinLocked}
              data-testid={`pin-key-${digit}`}
            >
              {digit}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            className="h-12 sm:h-14 rounded-2xl border-white/15 bg-white/10 hover:bg-white/25 active:bg-white/35 text-white text-xs sm:text-sm font-microgramma font-bold tracking-wider backdrop-blur-md transition-all"
            onClick={() => {
              resetOsdTimer();
              handlePinBackspace();
            }}
            disabled={loading || isPinLocked || pin.length === 0}
          >
            Borrar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 sm:h-14 rounded-2xl border-white/15 bg-white/10 hover:bg-white/25 active:bg-white/35 active:scale-95 text-white text-xl sm:text-2xl font-microgramma font-bold backdrop-blur-md shadow-md transition-all"
            onClick={() => {
              resetOsdTimer();
              handlePinKeyPress("0");
            }}
            disabled={loading || isPinLocked}
            data-testid="pin-key-0"
          >
            0
          </Button>
          <Button
            type="button"
            className="h-12 sm:h-14 rounded-2xl bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white font-microgramma font-black text-base sm:text-lg tracking-wider shadow-[0_0_15px_rgba(14,165,233,0.5)] transition-all"
            onClick={() => {
              resetOsdTimer();
              handlePinLogin();
            }}
            disabled={loading || isPinLocked || pin.length !== PIN_LENGTH || backendStatus === 'down'}
            data-testid="pin-submit"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "OK"}
          </Button>
        </div>
      </div>

      {/* Desktop / Landscape HUD - Bottom Left Version and Build Label */}
      <div className="absolute bottom-4 left-6 z-20 pointer-events-none text-white/70 text-xs drop-shadow-[0_1px_5px_rgba(0,0,0,0.85)] space-y-0.5 font-microgramma hidden sm:block">
        <p className="font-bold text-white/80 tracking-wide">© 2026 MUNDO DE ACCESORIOS. Todos los derechos reservados.</p>
        <p className="text-[11px] text-white/50 tracking-wider">Version: {buildVersion} · Build: {buildTimeLabel}</p>
      </div>

      {/* Desktop / Landscape HUD - Bottom Right Mc-LarenS Logo with Sheen */}
      <div className="absolute bottom-4 right-6 z-20 pointer-events-none hidden sm:flex items-center">
        <div className="logo-sheen-container drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">
          <img
            src="/brands/mclarens-white-red.png?v=3"
            alt="Mc-LarenS Auto Accesorios"
            className="h-8 sm:h-11 w-auto object-contain select-none filter drop-shadow-[0_0_2px_rgba(255,255,255,0.45)]"
            draggable={false}
          />
        </div>
      </div>

      {/* Mobile / Vertical Unified Footer (Zero overlapping, centered and compact) */}
      <div className="absolute bottom-3 inset-x-0 z-20 pointer-events-none flex flex-col items-center justify-center gap-1.5 px-4 sm:hidden font-microgramma">
        <div className="logo-sheen-container drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">
          <img
            src="/brands/mclarens-white-red.png?v=3"
            alt="Mc-LarenS Auto Accesorios"
            className="h-7 w-auto object-contain select-none filter drop-shadow-[0_0_2px_rgba(255,255,255,0.45)]"
            draggable={false}
          />
        </div>
        <p className="text-[10px] text-white/60 tracking-wider text-center drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
          © 2026 Mundo de Accesorios · v{buildVersion}
        </p>
      </div>


      {/* Full-screen lockout overlay (cashier-style, red, huge countdown with centiseconds) */}
      {isPinLocked ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center px-3 sm:px-4 backdrop-blur-md bg-rose-800/55"
          data-testid="pin-lockout-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-label="Terminal bloqueada por intentos fallidos"
        >
          <div className="w-full max-w-xl min-w-0 rounded-2xl border-2 border-rose-300/80 bg-rose-950/90 text-rose-50 shadow-2xl p-4 sm:p-8 md:p-10 text-center overflow-hidden">
            <div className="mx-auto mb-3 sm:mb-4 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-rose-600/40 ring-4 ring-rose-300/40">
              <Lock className="h-8 w-8 sm:h-10 sm:w-10 text-rose-100" strokeWidth={2.25} aria-hidden="true" />
            </div>
            <div className="flex items-center justify-center gap-2 text-sm sm:text-base font-semibold uppercase tracking-wide text-rose-100/90">
              <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5" />
              Terminal bloqueada
            </div>
            <p className="mt-2 sm:mt-3 text-sm sm:text-base text-rose-100/90 px-1">
              Demasiados intentos de PIN fallidos. Espera a que termine el temporizador para reintentar.
            </p>

            {/* Dynamic 7-seg size: scales with card width / padding */}
            <div
              className="mt-5 sm:mt-6 w-full min-w-0 overflow-hidden px-0.5"
              style={{ containerType: "inline-size" }}
            >
              <SevenSegCountdown
                remainingMs={lockoutRemainingMs}
                showGlow
                className="w-full max-w-full text-rose-100"
                style={{
                  // Prefer container query units so digits fit inside card padding
                  fontSize: "clamp(1.35rem, 16cqi, 4.75rem)",
                  transform: "skewX(-6deg)",
                  maxWidth: "100%",
                }}
                data-testid="pin-lockout-countdown"
              />
            </div>
            <p className="mt-2 sm:mt-3 text-xs sm:text-sm uppercase tracking-[0.2em] text-rose-200/80">
              cuenta regresiva
            </p>
            {lockoutUntil ? (
              <p className="mt-3 text-xs sm:text-sm text-rose-200/70">
                Desbloqueo estimado: {lockoutUntil.toLocaleTimeString()}
              </p>
            ) : null}

            {/* Gerencia unlock: keyboard only, 8 masked slots (no on-screen pinpad) */}
            <div className="mt-5 sm:mt-6 border-t border-rose-300/20 pt-4 sm:pt-5">
              {!showGerenciaUnlock ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-rose-200/40 bg-rose-900/40 text-rose-50 hover:bg-rose-800/60 hover:text-white"
                  onClick={() => {
                    setShowGerenciaUnlock(true);
                    setUnlockPin("");
                    setUnlockError(null);
                  }}
                  data-testid="gerencia-unlock-open"
                >
                  <ShieldAlert className="h-4 w-4 mr-2" />
                  Desbloquear con PIN de gerencia
                </Button>
              ) : (
                <div
                  className="space-y-3"
                  onClick={() => unlockPinInputRef.current?.focus()}
                  role="presentation"
                >
                  <p className="text-sm text-rose-100/90 text-center">
                    Teclea el PIN de <strong>gerencia</strong> (no se muestra en pantalla). Enter para confirmar · Esc para cancelar.
                  </p>

                  {/* Hidden password field — real keyboard target; never displays digits */}
                  <input
                    ref={unlockPinInputRef}
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    name="gerencia-unlock-pin"
                    value={unlockPin}
                    onChange={handleUnlockPinInputChange}
                    disabled={unlockLoading}
                    maxLength={PIN_LENGTH}
                    className="sr-only"
                    aria-label="PIN de gerencia para desbloquear terminal"
                    data-testid="gerencia-unlock-input"
                  />

                  <div className="flex justify-center gap-1.5 sm:gap-2">
                    {[...Array(PIN_LENGTH)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-11 w-8 sm:h-12 sm:w-10 rounded-md border-2 flex items-center justify-center text-xl font-bold transition-colors ${
                          unlockPin.length > i
                            ? "border-rose-200 bg-rose-800/80 text-rose-50"
                            : unlockPin.length === i
                              ? "border-rose-100 bg-rose-900/60 text-rose-200 ring-2 ring-rose-300/40"
                              : "border-rose-400/40 bg-rose-950/50 text-rose-300/40"
                        }`}
                        aria-hidden="true"
                      >
                        {unlockPin.length > i ? "•" : ""}
                      </div>
                    ))}
                  </div>

                  {unlockLoading ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-rose-100/80">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verificando…
                    </div>
                  ) : (
                    <p className="text-center text-xs text-rose-200/70">
                      {unlockPin.length}/{PIN_LENGTH} dígitos
                    </p>
                  )}

                  {unlockError ? (
                    <p className="text-center text-sm text-amber-200" data-testid="gerencia-unlock-error">
                      {unlockError}
                    </p>
                  ) : null}

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-rose-200/80 hover:text-rose-50 hover:bg-rose-900/40"
                    disabled={unlockLoading}
                    onClick={() => {
                      setShowGerenciaUnlock(false);
                      setUnlockPin("");
                      setUnlockError(null);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal de Configuración y Diagnóstico de Servidor */}
      <ServerConnectionDialog
        isOpen={showServerConfig}
        onClose={() => setShowServerConfig(false)}
      />
    </div>
  );
}
