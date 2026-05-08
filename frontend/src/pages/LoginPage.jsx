import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Loader2, Sun, Moon, Calculator, ArrowLeftRight, Info } from "lucide-react";
import { API_BASE as API } from "@/lib/api";
import { APP_ENV } from "@/lib/env";
import { playLoginPinpadSound } from "@/lib/uiSounds";
import { useDevice } from "../hooks/useDevice";

// Connectivity check interval (ms)
const CONNECTIVITY_POLL_INTERVAL = 10000;
const PIN_LENGTH = 8;
const ATTENDANCE_KIOSK_SHORTCUT_PIN = (typeof window !== 'undefined' && window.__ATTENDANCE_KIOSK_SHORTCUT_PIN__)
  ? String(window.__ATTENDANCE_KIOSK_SHORTCUT_PIN__)
  : APP_ENV.attendanceKioskShortcutPin;

export function LoginPage() {
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
  const [pinUsers, setPinUsers] = useState([]);
  const [showLoginInfo, setShowLoginInfo] = useState(false);
  const buildVersion = APP_ENV.buildVersion;
  const buildTimeRaw = APP_ENV.buildTime;
  const buildTime = buildTimeRaw ? new Date(buildTimeRaw) : null;
  const buildTimeLabel = buildTime
    ? buildTime.toLocaleString("es-NI", { dateStyle: "medium", timeStyle: "short" })
    : "desconocida";

  // Reloj Digital y Mensaje Motivacional
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTool, setActiveTool] = useState(null);
  const [fxAmount, setFxAmount] = useState("1");
  const [fxFrom, setFxFrom] = useState("USD");
  const [fxTo, setFxTo] = useState("NIO");
  const [fxRate, setFxRate] = useState(null);
  const [fxResult, setFxResult] = useState("");
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState("");

  const sha256 = useCallback(async (value) => {
    const source = String(value ?? "");
    if (!source) return "";
    if (typeof window !== "undefined" && window.crypto?.subtle) {
      const data = new TextEncoder().encode(source);
      const digest = await window.crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return "";
  }, []);
  
  // Frases aleatorias
  const messages = [
    "¡A romperla en ventas hoy! 🚀",
    "Tu esfuerzo hace la diferencia. 💪",
    "Sonríe, estás haciendo un gran trabajo. 😃",
    "Cada cliente es una nueva oportunidad. ✨",
    "Hoy es un buen día para tener un gran día. 🌞",
    "El éxito es la suma de pequeños esfuerzos. 💼",
    "Calidad y servicio, nuestra pasión. 🛠️",
    "¡Vamos con todo, equipo! 🔥",
    "La excelencia es un hábito. ⭐",
    "La constancia construye resultados. 🧱",
    "Tus metas están más cerca de lo que crees. 🎯",
    "Cuidar al cliente siempre suma. 🤝",
    "Hoy es perfecto para mejorar un 1%. 📈",
    "Tu enfoque marca la diferencia. 🧠",
    "Actitud positiva, ventas positivas. 😊",
    "El detalle vende, cuida el detalle. 🔍",
    "Cada paso cuenta. Sigue adelante. 🚶",
    "Cree en tu potencial. 🌟",
    "Lo que haces hoy define tu mañana. 📅",
    "Hazlo con orgullo. 🏆",
    "Tu energia contagia. ⚡",
    "La disciplina es libertad. 🔒",
    "Aprende, aplica, mejora. 📚",
    "Los grandes resultados nacen de grandes habitos. 🔁",
    "Suma valor en cada interaccion. 💬",
    "Tu mejor venta es el servicio. 🤍",
    "Hoy puedes superar tu record. 🥇",
    "El cliente lo nota: da lo mejor. 👀",
    "Se amable, se firme, se profesional. 🧭",
    "Construye confianza todos los dias. 🧱",
    "Cada consulta es una oportunidad. 💡",
    "Escucha bien, vende mejor. 👂",
    "Tu calidad habla por ti. 🗣️",
    "Sigue, no te detengas. 🏃",
    "Lo simple bien hecho es poderoso. ✨",
    "Tu esfuerzo tiene recompensa. 🎁",
    "El equipo unido logra mas. 🧩",
    "Respira, enfocate y avanza. 🌬️",
    "Hoy es un gran dia para crecer. 🌱",
    "Mantente firme en tus metas. 🧗",
    "Tu atencion es tu ventaja. 🎛️",
    "La puntualidad es respeto. ⏰",
    "Tu excelencia inspira. 🌠",
    "Hoy puedes aprender algo nuevo. 🧪",
    "Haz que cada cliente se vaya feliz. 😊",
    "Confia en tu proceso. 🧵",
    "La calidad es un estandar, no un extra. ✅",
    "Actua con seguridad. 🛡️",
    "Cada desafio te fortalece. 🥋",
    "Tu constancia construye resultados. 🧱",
    "Atiende con calidez. ☀️",
    "El esfuerzo de hoy es el exito de manana. 🌄",
    "Lo mejor esta por venir. 🔮",
    "Se proactivo, marca la pauta. 🧭",
    "Hazlo simple, hazlo bien. ✔️",
    "Tu enfoque crea resultados. 🧩",
    "La excelencia se nota. 👌",
    "Hoy es dia de avanzar. 🚀",
    "Tu energia impulsa al equipo. ⚙️",
    "Piensa en soluciones. 🧠",
    "Cada venta cuenta. 💵",
    "El servicio es tu mejor carta. 🃏",
    "Hazlo con pasion. ❤️",
    "El cliente primero, siempre. 🥇",
    "Tu trabajo deja huella. 👣",
    "Se claro, se directo, se amable. 💬",
    "El orden trae resultados. 📦",
    "Pequenos logros, grandes cambios. 🔧",
    "Tu actitud abre puertas. 🚪",
    "Agradece y sigue. 🙌",
    "No pares, estas logrando. 🏁",
    "Sigue aprendiendo cada dia. 📘",
    "Tus metas valen el esfuerzo. 🎯",
    "Hoy es un buen dia para vender mas. 💼",
    "La honestidad construye clientes fieles. 🤍",
    "Hazlo mejor que ayer. ⏫",
    "Concentrate en lo que puedes controlar. 🎛️",
    "La energia positiva se nota. 🌞",
    "El compromiso se ve. 🔒",
    "Tu esfuerzo suma al equipo. 🤝",
    "Se constante, se paciente. 🕰️",
    "La calidad es tu sello. 🪪",
    "Hoy puedes inspirar a alguien. 🌟",
    "Cada dia es una nueva oportunidad. 🔄",
    "Tu servicio vale oro. 🪙",
    "Confia en tu habilidad. 🧠",
    "Avanza con seguridad. 🛡️",
    "El trabajo bien hecho se recomienda. 📣",
    "Actua con excelencia. 🏅",
    "Cuida los detalles, ganan clientes. 🔍",
    "La dedicacion se premia. 🎖️",
    "Tu ritmo define tu resultado. 🎶",
    "Hoy es dia de dar el 100%. 💯",
    "Eres parte de algo grande. 🌍",
    "La actitud correcta crea oportunidades. 🧭",
    "Sigue, ya estas avanzando. ➡️",
    "Hazlo con orgullo y respeto. 🫡",
    "Tu disciplina abre caminos. 🛤️",
    "Cada cliente merece lo mejor. 🫶",
    "Hazlo con calma y precision. 🎯",
    "Se constante, se consistente. 🧱",
    "Tu esfuerzo inspira confianza. 🤝",
    "Hoy es un buen dia para superar limites. 🚧",
    "La excelencia es tu decision diaria. ✅",
    "El exito se construye paso a paso. 🪜",
    "Tu servicio crea lealtad. 🧲",
    "La calidad no se negocia. 🛠️",
    "Tu enfoque es tu poder. 🔦",
    "Hazlo facil para el cliente. 🧩",
    "Cada detalle suma valor. 🧷",
    "Tu mejor version esta en camino. 🌈",
    "La energia del equipo es clave. 🔑",
    "Confia en tu experiencia. 🧰",
    "Hoy es dia de grandes resultados. 🏆",
    "Eres capaz de mas de lo que piensas. 💭",
    "Sirve con excelencia y veras resultados. 🏅",
    "El esfuerzo constante siempre gana. 🥇",
    "Tu actitud define la experiencia. 🎫",
    "La confianza se construye con acciones. 🧱",
    "Hoy es un buen dia para brillar. ✨",
    "La dedicacion te hace destacar. 🔦",
    "Con enfoque, todo se logra. 🎯",
    "Tu servicio es tu mejor publicidad. 📢",
    "Hazlo con energia y alegria. 😄",
    "Cada dia cuenta, aprovechalo. 🗓️",
    "Tu compromiso es tu ventaja. 🧩",
    "Sigue adelante, estas en buen camino. 🛣️",
    "Hazlo bien a la primera. ✅",
    "La excelencia es contagiosa. 🌟",
    "Tu esfuerzo tiene impacto. 🌍",
    "La actitud correcta crea resultados. 📈",
    "Hoy es un gran dia para servir. 🤍"
  ];
  
  // Seleccionar mensaje solo al montar el componente
  const [dailyMessage] = useState(() => messages[Math.floor(Math.random() * messages.length)]);

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

  const handlePinLogin = useCallback(async (pinOverride = null) => {
    const pinToUse = pinOverride ?? pin;
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
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      let resolvedUserId = null;
      try {
        const pinIndex = await sha256(pinToUse);
        if (pinIndex && Array.isArray(pinUsers) && pinUsers.length > 0) {
          const match = pinUsers.find((u) => u?.login_pin_index === pinIndex);
          if (match?.user_id) resolvedUserId = match.user_id;
        }
      } catch (_) {
        // ignore local resolution failures; backend fallback still works
      }

      const payload = resolvedUserId ? { pin: pinToUse, user_id: resolvedUserId } : { pin: pinToUse };
      const response = await axios.post(
        `${API}/auth/pin/login`,
        payload,
        { withCredentials: true, signal: controller.signal, timeout: 25000 }
      );
      setAuthStatus("success");
      // Apply saved theme from server/session if provided
      try {
        const serverMode = response.data.theme_mode || response.data.mode;
        const serverSkin = response.data.theme_skin || response.data.skin;
        if (serverMode) setMode(serverMode);
        if (serverSkin) setSkin(serverSkin);
      } catch (e) {
        // ignore
      }
      toast.success(`Bienvenido, ${response.data.name}`);
      playTone("success");
      
      // Attempt auth check but don't block widely if it delays
      Promise.race([
        checkAuth(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
      ]).catch(() => null);

      window.location.href = "/workbench";
    } catch (error) {
      setAuthStatus("error");
      setShowResetWarning(true);
      setTimeout(() => setShowResetWarning(false), 5000);
      // Reset error status after animation
      setTimeout(() => setAuthStatus("idle"), 500);

      const detail = error.response?.data?.detail;
      let message = "PIN incorrecto";
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
      } else if (detail) {
        if (typeof detail === "object") {
          message = detail.message || message;
          if (detail.remaining_attempts !== undefined) setRemainingAttempts(detail.remaining_attempts);
          if (detail.lockout_until) setLockoutUntil(new Date(detail.lockout_until));
          if (detail.lockout_seconds !== undefined) setLockoutSeconds(detail.lockout_seconds);
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
  }, [checkAuth, pin, pinUsers, playTone, setMode, setSkin, sha256]);

  const handlePinKeyPress = useCallback((digit) => {
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
  }, [authStatus, handlePinLogin, pin, playTone, showResetWarning]);

  const handlePinBackspace = useCallback(() => {
    if (pin.length === 0) return;
    playTone("key");
    setPin((prevPin) => prevPin.slice(0, -1));
  }, [pin.length, playTone]);

  const handlePinInputChange = useCallback((event) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPin(digits);
    if (digits.length === PIN_LENGTH) {
       setTimeout(() => handlePinLogin(digits), 50);
    }
  }, [handlePinLogin]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (loading) return;

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
  }, [handlePinBackspace, handlePinKeyPress, handlePinLogin, loading, pin.length]);

  // Load PIN users so we can attribute login attempts to a specific user
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await axios.get(`${API}/auth/pin/users`);
        if (!mounted) return;
        setPinUsers(r.data || []);
      } catch (e) {
        // ignore failures; backend may be unavailable or no users defined
      }
    })();
    return () => { mounted = false; };
  }, []);

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
      className="min-h-screen bg-background flex"
    >
      {/* DEBUG BANNER: shows remaining attempts and lockout state for quick visibility */}
      {(remainingAttempts !== null || lockoutUntil) && (
        <div className="absolute top-4 right-4 z-50 bg-yellow-50 border border-yellow-300 text-sm p-2 rounded-md shadow">
          <div className="font-medium">Depuración PIN</div>
          {remainingAttempts !== null && <div>Intentos restantes: {remainingAttempts}</div>}
          {lockoutSeconds !== null && <div>Tiempo de bloqueo (s): {lockoutSeconds}</div>}
          {lockoutUntil && <div>Bloqueado hasta: {lockoutUntil.toLocaleTimeString()}</div>}
        </div>
      )}
      <input
        ref={pinInputRef}
        type="tel"
        inputMode="numeric"
        autoComplete="one-time-code"
        className="sr-only"
        value={pin}
        onChange={handlePinInputChange}
        disabled={loading}
        aria-label="PIN"
      />

      {/* keep pinUsers referenced to avoid unused-vars lint (no visual impact) */}
      <span style={{display:'none'}}>{pinUsers.length}</span>

      {/* Left side - Info */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative background circle */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-foreground/10 rounded-full blur-3xl pointer-events-none" />
        <img
          src="/logo-big.png"
          alt="Mundo de Accesorios"
          className="pointer-events-none absolute left-1/2 top-1/2 w-[700px] -translate-x-1/2 -translate-y-1/2 opacity-10"
        />
        
        {/* Clock - Top Right */}
        <div className="absolute top-12 right-12 text-right font-mono">
          <div className="text-lg font-medium text-primary-foreground/90 mb-0 capitalize tracking-wide">
            {formatDateFull(currentTime)}
          </div>
          <div className="text-4xl font-bold text-primary-foreground tracking-widest opacity-100">
            {formatTime(currentTime)}
          </div>
        </div>

        <div>
          {/* Motivational Message Card */}
          <div className="absolute left-1/2 top-36 w-full max-w-md -translate-x-1/2 bg-primary-foreground/10 border-l-4 border-yellow-400 p-4 rounded-r-lg backdrop-blur-md text-center">
            <p className="text-primary-foreground text-xl font-medium italic animate-pulse-slow">
              &quot;{dailyMessage}&quot;
            </p>
          </div>
        </div>

        {activeTool === "calculator" && (
          <div className="absolute left-8 bottom-24 w-[360px] rounded-xl border border-border bg-background/95 p-4 text-foreground shadow-xl backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Calculadora de Divisas</h3>
              <Button variant="ghost" size="sm" onClick={() => setActiveTool(null)}>
                Cerrar
              </Button>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Monto</Label>
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={fxAmount}
                  onChange={(event) => setFxAmount(event.target.value)}
                  inputMode="decimal"
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs">De</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
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
                  className="h-10 w-10"
                  onClick={handleSwapCurrencies}
                  aria-label="Intercambiar divisas"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                  <Label className="text-xs">A</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                    value={fxTo}
                    onChange={(event) => setFxTo(event.target.value)}
                  >
                    <option value="NIO">NIO</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <Button className="w-full" onClick={handleConvertCurrency} disabled={fxLoading}>
                {fxLoading ? "Calculando..." : "Convertir"}
              </Button>
              <div className="rounded-md border border-border bg-muted/60 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>Tasa</span>
                  <span>{fxRate ? fxRate.toFixed(4) : "-"}</span>
                </div>
                <div className="mt-2 flex items-center justify-between font-semibold">
                  <span>Resultado</span>
                  <span>
                    {fxResult !== "" && fxResult !== null
                      ? new Intl.NumberFormat("es-NI", {
                          style: "currency",
                          currency: fxTo,
                        }).format(fxResult)
                      : "-"}
                  </span>
                </div>
                {fxError && <div className="mt-2 text-xs text-destructive">{fxError}</div>}
              </div>
            </div>
          </div>
        )}

        {activeTool === "calendar" && (
          <div className="absolute left-8 bottom-24 w-[320px] rounded-xl border border-border bg-background/95 p-4 text-foreground shadow-xl backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Calendario</h3>
              <Button variant="ghost" size="sm" onClick={() => setActiveTool(null)}>
                Cerrar
              </Button>
            </div>
            <Label className="text-xs">Selecciona una fecha</Label>
            <input
              type="date"
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="space-y-2 text-primary-foreground/60 text-sm">
          <div>© 2026 MUNDO DE ACCESORIOS. Todos los derechos reservados.</div>
          <div>
            Version: {buildVersion} · Build: {buildTimeLabel}
          </div>
        </div>
      </div>

      {/* Right side - Login */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden p-8">
        <Card className="relative z-10 w-full max-w-md border-0 shadow-xl">
          <CardContent className="relative overflow-hidden pt-8 pb-8 px-8">
            <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center p-6">
              <img
                src="/logo-big.png"
                alt=""
                aria-hidden="true"
                draggable={false}
                className="h-auto w-[78%] max-w-lg select-none object-contain"
                style={{ mixBlendMode: "multiply", opacity: watermarkOpacity }}
              />
            </div>

            <div className="relative z-10">
            <div className="relative mb-4">
              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12"
                  onClick={() => handleToolToggle("calculator")}
                  aria-label="Abrir calculadora"
                >
                  <Calculator className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12"
                  onClick={() => setShowLoginInfo((prev) => !prev)}
                  aria-label={showLoginInfo ? "Ocultar informacion" : "Mostrar informacion"}
                  data-testid="login-info-toggle"
                >
                  <Info className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12"
                  onClick={() => toggleMode()}
                  aria-label="Cambiar tema"
                >
                  {resolvedMode === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {showLoginInfo ? (
                <div
                  className="absolute right-0 top-16 z-20 w-full rounded-xl border border-primary/20 bg-card/95 p-3 text-xs shadow-xl backdrop-blur-md"
                  data-testid="login-device-validator"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Informacion del acceso</span>
                    <span className="text-muted-foreground">Estado expandido</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-md border bg-background/80 px-2 py-1">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                        backendStatus === 'ok' ? 'bg-emerald-500' : backendStatus === 'down' ? 'bg-destructive' : 'bg-yellow-400 animate-pulse'
                      }`} />
                      <span className="text-muted-foreground">
                        {backendStatus === 'ok' && "Servidor OK"}
                        {backendStatus === 'down' && "Servidor sin conexion"}
                        {backendStatus === 'unknown' && (checkingBackend ? "Comprobando servidor..." : "Verificando servidor...")}
                      </span>
                    </div>

                    <span className="rounded-md border bg-background/80 px-2 py-1 text-muted-foreground">
                      Pantalla: <span className="font-semibold text-foreground">{deviceTypeLabel}</span>
                    </span>

                    <span className="rounded-md border bg-background/80 px-2 py-1 text-muted-foreground">
                      Regla: <span className="font-semibold text-foreground">{deviceRuleLabel}</span>
                    </span>

                    <span className="rounded-md border bg-background/80 px-2 py-1 text-muted-foreground">
                      {device.viewportWidth}x{device.viewportHeight} · {device.isPortrait ? "Vertical" : "Horizontal"} · {device.isTouchDevice ? "Tactil" : "No tactil"}
                    </span>
                  </div>

                  <div className="mt-3 text-right text-muted-foreground">
                    Version: {buildVersion} · Build: {buildTimeLabel}
                  </div>
                </div>
              ) : null}
            </div>

            {activeTool && (
              <div className="mb-6 rounded-xl border border-border bg-card/80 p-4 text-sm lg:hidden">
                {activeTool === "calculator" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Calculadora de Divisas</span>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTool(null)}>
                        Cerrar
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Monto</Label>
                      <input
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={fxAmount}
                        onChange={(event) => setFxAmount(event.target.value)}
                        inputMode="decimal"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">De</Label>
                        <select
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
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
                        className="h-10 w-10"
                        onClick={handleSwapCurrencies}
                        aria-label="Intercambiar divisas"
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </Button>
                      <div className="flex-1">
                        <Label className="text-xs">A</Label>
                        <select
                          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                          value={fxTo}
                          onChange={(event) => setFxTo(event.target.value)}
                        >
                          <option value="NIO">NIO</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                    </div>
                    <Button className="w-full" onClick={handleConvertCurrency} disabled={fxLoading}>
                      {fxLoading ? "Calculando..." : "Convertir"}
                    </Button>
                    <div className="rounded-md border border-border bg-muted/60 p-3">
                      <div className="flex items-center justify-between">
                        <span>Tasa</span>
                        <span>{fxRate ? fxRate.toFixed(4) : "-"}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between font-semibold">
                        <span>Resultado</span>
                        <span>
                          {fxResult !== "" && fxResult !== null
                            ? new Intl.NumberFormat("es-NI", {
                                style: "currency",
                                currency: fxTo,
                              }).format(fxResult)
                            : "-"}
                        </span>
                      </div>
                      {fxError && <div className="mt-2 text-xs text-destructive">{fxError}</div>}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* PIN Login */}
            <div className="w-full">
              <h2 className="font-heading text-2xl font-bold mb-2">Acceso Rápido</h2>
              <p className="text-muted-foreground mb-6">
                Ingresa tu PIN de 8 dígitos para acceder
              </p>

              <Label className="text-center block mb-3">PIN</Label>

              {/* PIN Display (always masked) */}
              <div className="flex justify-center gap-1 mb-6 flex-wrap max-w-[340px] mx-auto">
                {[...Array(PIN_LENGTH)].map((_, i) => (
                  <div
                    key={i}
                    className={`w-9 h-11 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-all ${
                      pin.length > i ? "border-primary bg-primary/10" : "border-muted"
                    }`}
                  >
                    {pin.length > i ? "•" : ""}
                  </div>
                ))}
              </div>

              {remainingAttempts !== null && (
                <div className="text-center text-sm text-muted-foreground mb-2">Intentos restantes: {remainingAttempts}</div>
              )}
              {lockoutUntil && (
                <div className="text-center text-sm text-destructive mb-4">PIN bloqueado hasta {lockoutUntil.toLocaleTimeString()}</div>
              )}

              <div className={`grid grid-cols-3 gap-2 max-w-xs mx-auto p-2 rounded-xl transition-all duration-300 ${
                authStatus === "error" ? "bg-destructive/20 ring-2 ring-destructive animate-shake" :
                authStatus === "success" ? "bg-green-500/20 ring-2 ring-green-500" :
                ""
              }`}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                  <Button
                    key={digit}
                    variant="outline"
                    className="h-14 text-xl font-semibold transition-colors"
                    onClick={() => handlePinKeyPress(String(digit))}
                    disabled={loading}
                    data-testid={`pin-key-${digit}`}
                  >
                    {digit}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  className="h-14 text-sm transition-colors"
                  onClick={handlePinBackspace}
                  disabled={loading || pin.length === 0}
                >
                  Borrar
                </Button>
                <Button
                  variant="outline"
                  className="h-14 text-xl font-semibold transition-colors"
                  onClick={() => handlePinKeyPress("0")}
                  disabled={loading}
                  data-testid="pin-key-0"
                >
                  0
                </Button>
                <Button
                  className="h-14"
                  onClick={() => handlePinLogin()}
                  disabled={loading || pin.length !== PIN_LENGTH || backendStatus === 'down'}
                  data-testid="pin-submit"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "OK"}
                </Button>
              </div>
            </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
