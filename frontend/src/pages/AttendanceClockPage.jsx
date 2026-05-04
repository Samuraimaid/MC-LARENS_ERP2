import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { API_BASE as API } from "@/lib/api";
import { useTheme } from "../context/ThemeContext";

const PIN_LENGTH = 4;
const OFFLINE_QUEUE_KEY = "attendance_offline_queue_v1";
const PIN_DIRECTORY_CACHE_KEY = "attendance_pin_directory_v1";
const PIN_DIRECTORY_SYNC_MARKER_KEY = "attendance_pin_directory_sync_marker_v1";
const LOCAL_PIN_USER_MAP_KEY = "attendance_local_pin_user_map_v1";
const FULLSCREEN_LOCK_KEY = "attendance_kiosk_fullscreen_lock_v1";

const safeStorageGet = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
};

const safeStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (_) {
    // Ignore storage write failures on locked-down kiosk browsers.
  }
};

const eventLabelMap = {
  clock_in: "Entrada a labores",
  lunch_out: "Salida a almuerzo",
  lunch_in: "Entrada de almuerzo",
  clock_out: "Salida laboral",
};

const KIOSK_TOAST_OPTIONS = {
  className: "text-xl font-semibold",
};

export function AttendanceClockPage() {
  const { setMode } = useTheme();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastEventLabel, setLastEventLabel] = useState("");
  const [nextEventLabel, setNextEventLabel] = useState("");
  const [timeFormat, setTimeFormat] = useState("24h");
  const [directory, setDirectory] = useState([]);
  const [localUserPreview, setLocalUserPreview] = useState("");
  const [localPinUserMap, setLocalPinUserMap] = useState({});
  const [isGalaxyTab8PortraitViewport, setIsGalaxyTab8PortraitViewport] = useState(false);
  const [feedbackState, setFeedbackState] = useState("idle");
  const feedbackTimerRef = useRef(null);

  const triggerFeedback = useCallback((state) => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    setFeedbackState(state);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackState("idle");
      feedbackTimerRef.current = null;
    }, 1000);
  }, []);

  useEffect(() => () => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const detectTabletViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const portraitLike = width >= 700 && width <= 900 && height >= 980 && height <= 1366;
      setIsGalaxyTab8PortraitViewport(portraitLike);
    };

    detectTabletViewport();
    window.addEventListener("resize", detectTabletViewport);
    return () => window.removeEventListener("resize", detectTabletViewport);
  }, []);

  useEffect(() => {
    if (!safeStorageGet(FULLSCREEN_LOCK_KEY)) {
      safeStorageSet(FULLSCREEN_LOCK_KEY, "1");
    }

    const root = document.documentElement;
    const body = document.body;
    const prevRootOverflow = root.style.overflow;
    const prevRootOverscroll = root.style.overscrollBehavior;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const prevBodyTouchAction = body.style.touchAction;

    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.touchAction = "none";

    const preventTouchMove = (event) => {
      event.preventDefault();
    };

    document.addEventListener("touchmove", preventTouchMove, { passive: false });

    return () => {
      document.removeEventListener("touchmove", preventTouchMove);
      root.style.overflow = prevRootOverflow;
      root.style.overscrollBehavior = prevRootOverscroll;
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehavior = prevBodyOverscroll;
      body.style.touchAction = prevBodyTouchAction;
    };
  }, []);

  const ensureFullscreen = useCallback(() => {
    try {
      if (safeStorageGet(FULLSCREEN_LOCK_KEY) !== "1") return;
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          // Ignore fullscreen re-entry failures caused by browser restrictions.
        });
      }
    } catch (_) {
      // Ignore fullscreen errors in unsupported environments.
    }
  }, []);

  useEffect(() => {
    const bootTimer = setTimeout(() => ensureFullscreen(), 250);

    const onUserInteraction = () => ensureFullscreen();
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && safeStorageGet(FULLSCREEN_LOCK_KEY) === "1") {
        setTimeout(() => ensureFullscreen(), 150);
      }
    };

    window.addEventListener("pointerdown", onUserInteraction);
    window.addEventListener("touchstart", onUserInteraction, { passive: true });
    window.addEventListener("keydown", onUserInteraction);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      clearTimeout(bootTimer);
      window.removeEventListener("pointerdown", onUserInteraction);
      window.removeEventListener("touchstart", onUserInteraction);
      window.removeEventListener("keydown", onUserInteraction);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [ensureFullscreen]);

  const playTone = useCallback((kind) => {
    try {
      const AudioContextCls = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCls) return;
      const ctx = new AudioContextCls();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      let frequency = 780;
      let peakGain = 0.2;
      let duration = 0.18;
      let oscillatorType = "sine";

      if (kind === "key") {
        frequency = 1320;
        peakGain = 0.22;
        duration = 0.1;
        oscillatorType = "square";
      }
      if (kind === "success") {
        frequency = 820;
        peakGain = 0.24;
        duration = 0.18;
        oscillatorType = "triangle";
      }
      if (kind === "warning") {
        frequency = 520;
        peakGain = 0.24;
        duration = 0.22;
        oscillatorType = "sawtooth";
      }
      if (kind === "error") {
        frequency = 180;
        peakGain = 0.28;
        duration = 0.3;
        oscillatorType = "square";
      }

      oscillator.type = oscillatorType;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(peakGain, ctx.currentTime + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration + 0.01);
      oscillator.onended = () => ctx.close();
    } catch (_) {
      // Ignore Web Audio failures on browsers that block sound playback.
    }
  }, []);

  const getQueue = useCallback(() => {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      // Ignore malformed offline queue data and start from an empty queue.
      return [];
    }
  }, []);

  const setQueue = useCallback((items) => {
    safeStorageSet(OFFLINE_QUEUE_KEY, JSON.stringify(items));
  }, []);

  const getDirectory = useCallback(() => {
    try {
      const raw = localStorage.getItem(PIN_DIRECTORY_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      // Ignore malformed cached directory data and fall back to an empty list.
      return [];
    }
  }, []);

  const setDirectoryCache = useCallback((items) => {
    safeStorageSet(PIN_DIRECTORY_CACHE_KEY, JSON.stringify(items));
    setDirectory(items);
  }, []);

  const loadLocalPinMap = useCallback(() => {
    try {
      const raw = localStorage.getItem(LOCAL_PIN_USER_MAP_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      // Ignore malformed local pin-user map data and use an empty object.
      return {};
    }
  }, []);

  const saveLocalPinMap = useCallback((map) => {
    safeStorageSet(LOCAL_PIN_USER_MAP_KEY, JSON.stringify(map));
    setLocalPinUserMap(map);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setDirectory(getDirectory());
    setLocalPinUserMap(loadLocalPinMap());
  }, [getDirectory, getQueue, loadLocalPinMap]);

  const sha256 = useCallback(async (value) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }, []);

  const loadKioskMeta = useCallback(async () => {
    try {
      const [settingsRes, dirRes] = await Promise.all([
        axios.get(`${API}/hr/attendance/settings/public`).catch(() => ({ data: null })),
        axios.get(`${API}/hr/timeclock/pin-directory`).catch(() => ({ data: [] })),
      ]);
      const settings = settingsRes?.data;
      if (settings?.time_format === "12h" || settings?.time_format === "24h") {
        setTimeFormat(settings.time_format);
      }
      const kioskThemeMode = settings?.kiosk_theme_mode;
      if (kioskThemeMode === "light" || kioskThemeMode === "dark" || kioskThemeMode === "system") {
        setMode(kioskThemeMode);
      }
      const remoteSyncMarker = typeof settings?.pin_directory_sync_marker === "string"
        ? settings.pin_directory_sync_marker
        : "";
      if (remoteSyncMarker) {
        const localSyncMarker = safeStorageGet(PIN_DIRECTORY_SYNC_MARKER_KEY) || "";
        if (localSyncMarker !== remoteSyncMarker) {
          saveLocalPinMap({});
          setLocalUserPreview("");
          safeStorageSet(PIN_DIRECTORY_SYNC_MARKER_KEY, remoteSyncMarker);
        }
      }
      const list = Array.isArray(dirRes.data) ? dirRes.data : [];
      setDirectoryCache(list);
    } catch (_) {
      // Ignore transient metadata fetch failures and keep cached kiosk state.
    }
  }, [saveLocalPinMap, setDirectoryCache, setMode]);

  useEffect(() => {
    loadKioskMeta();
    const timer = setInterval(loadKioskMeta, 30000);
    return () => clearInterval(timer);
  }, [loadKioskMeta]);

  const timeLabel = useMemo(
    () => currentTime.toLocaleTimeString("en-US", {
      hour12: timeFormat === "12h",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).toUpperCase(),
    [currentTime, timeFormat],
  );
  const dateLabel = useMemo(
    () => currentTime.toLocaleDateString("es-NI", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }),
    [currentTime],
  );

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const queue = getQueue();
    if (queue.length === 0) return;

    const pending = [...queue];
    const failed = [];
    for (const item of pending) {
      try {
        await axios.post(`${API}/hr/timeclock/kiosk-punch`, { pin: item.pin });
      } catch (_) {
        // Keep failed punches in the offline queue for the next retry.
        failed.push(item);
      }
    }
    setQueue(failed);
    if (failed.length === 0) {
      toast.success("Cola offline sincronizada", KIOSK_TOAST_OPTIONS);
      playTone("success");
    }
  }, [getQueue, playTone, setQueue]);

  useEffect(() => {
    flushQueue();
    const interval = setInterval(flushQueue, 10000);
    return () => clearInterval(interval);
  }, [flushQueue]);

  const submitPunch = useCallback(async (pinToUse) => {
    if (pinToUse.length !== PIN_LENGTH) return;
    setLoading(true);

    let resolvedUserId = localPinUserMap?.[pinToUse]?.user_id || null;
    if (!resolvedUserId && directory.length > 0) {
      try {
        const pinIndex = await sha256(pinToUse);
        const directoryMatch = directory.find((item) => item.pin_index === pinIndex);
        resolvedUserId = directoryMatch?.user_id || null;
      } catch (_) {
        // Ignore local hash lookup failures and defer user resolution to the API.
      }
    }

    if (!navigator.onLine) {
      const queue = getQueue();
      queue.push({ pin: pinToUse, created_at: new Date().toISOString() });
      setQueue(queue);
      toast.warning("Sin conexión. Marcación en cola para reintento automático", KIOSK_TOAST_OPTIONS);
      triggerFeedback("warning");
      playTone("warning");
      setPin("");
      setLoading(false);
      return;
    }

    try {
      const requestPayload = resolvedUserId
        ? { pin: pinToUse, user_id: resolvedUserId }
        : { pin: pinToUse };
      const response = await axios.post(`${API}/hr/timeclock/kiosk-punch`, requestPayload);
      const eventType = response.data?.event_type;
      const eventLabel = response.data?.event_label || eventLabelMap[eventType] || eventType;
      const nextLabel = response.data?.next_event_label || "Día completado";
      const userName = response.data?.record?.user_name || "Usuario";
      const userId = response.data?.record?.user_id || "";
      const userRole = response.data?.record?.user_role || "";

      setLastEventLabel(eventLabel);
      setNextEventLabel(nextLabel);
      if (response.data?.time_format === "12h" || response.data?.time_format === "24h") {
        setTimeFormat(response.data.time_format);
      }
      toast.success(`${userName}: ${eventLabel}`, KIOSK_TOAST_OPTIONS);
      triggerFeedback("success");
      playTone("success");

      const policyAlerts = Array.isArray(response.data?.policy_alerts) ? response.data.policy_alerts : [];
      if (policyAlerts.length > 0) {
        toast.warning(policyAlerts[0]?.description || "Marcación fuera de política de horario", KIOSK_TOAST_OPTIONS);
        triggerFeedback("warning");
        playTone("warning");
      }

      const updatedMap = { ...localPinUserMap, [pinToUse]: { user_id: userId, name: userName, role: userRole } };
      saveLocalPinMap(updatedMap);
      setPin("");
    } catch (error) {
      const isNetworkError = !error?.response;
      if (isNetworkError) {
        const queue = getQueue();
        queue.push({ pin: pinToUse, created_at: new Date().toISOString() });
        setQueue(queue);
        toast.warning("Sin conexión. Marcación guardada para reintento automático", KIOSK_TOAST_OPTIONS);
        triggerFeedback("warning");
        playTone("warning");
      } else {
        toast.error(error.response?.data?.detail || "No se pudo registrar la marcación", KIOSK_TOAST_OPTIONS);
        triggerFeedback("error");
        playTone("error");
      }
      setPin("");
    } finally {
      setLoading(false);
    }
  }, [directory, getQueue, localPinUserMap, playTone, saveLocalPinMap, setQueue, sha256, triggerFeedback]);

  const handlePinKeyPress = useCallback((digit) => {
    if (loading || pin.length >= PIN_LENGTH) return;
    playTone("key");
    const newPin = `${pin}${digit}`;
    setPin(newPin);
    if (newPin.length === PIN_LENGTH) {
      setTimeout(() => submitPunch(newPin), 50);
    }
  }, [loading, pin, playTone, submitPunch]);

  useEffect(() => {
    const loadPreview = async () => {
      if (pin.length !== PIN_LENGTH) {
        setLocalUserPreview("");
        return;
      }
      try {
        const localMatch = localPinUserMap[pin];
        if (localMatch) {
          setLocalUserPreview(`${localMatch.name || localMatch.user_id} · ${localMatch.role || "sin rol"} (cache local)`);
          return;
        }

        const pinIndex = await sha256(pin);
        const match = directory.find((item) => item.pin_index === pinIndex);
        if (match) {
          setLocalUserPreview(`${match.name || match.user_id} · ${match.role || "sin rol"}`);
          return;
        }
        setLocalUserPreview("Usuario no encontrado en cache local");
      } catch (_) {
        // Ignore preview failures and clear the local user hint.
        setLocalUserPreview("");
      }
    };
    loadPreview();
  }, [directory, localPinUserMap, pin, sha256]);

  const handleClearPin = useCallback(() => {
    if (loading) return;
    playTone("key");
    setPin("");
  }, [loading, playTone]);

  useEffect(() => {
    const handler = (event) => {
      if (loading) return;
      const { key, code } = event;
      const numpadMap = {
        Numpad0: "0", Numpad1: "1", Numpad2: "2", Numpad3: "3", Numpad4: "4",
        Numpad5: "5", Numpad6: "6", Numpad7: "7", Numpad8: "8", Numpad9: "9",
      };
      const digit = numpadMap[code] || (/^[0-9]$/.test(key) ? key : null);
      if (digit !== null) {
        event.preventDefault();
        handlePinKeyPress(digit);
        return;
      }
      if (key === "Backspace") {
        event.preventDefault();
        handleClearPin();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClearPin, handlePinKeyPress, loading]);

  return (
    <div
      className={`min-h-[calc(100vh-4rem)] flex items-center justify-center transition-colors duration-200 ${
        feedbackState === "success"
          ? "bg-green-100"
          : feedbackState === "warning"
            ? "bg-yellow-100"
            : feedbackState === "error"
              ? "bg-red-100"
              : "bg-white"
      } ${isGalaxyTab8PortraitViewport ? "p-2 md:p-3" : "p-4"}`}
      data-testid="attendance-clock-page"
    >
      <Card className={`w-full border-2 ${isGalaxyTab8PortraitViewport ? "max-w-[860px]" : "max-w-5xl"}`}>
        <CardHeader className={`text-center ${isGalaxyTab8PortraitViewport ? "space-y-1.5 py-3" : "space-y-2"}`}>
          <CardDescription className={`capitalize ${isGalaxyTab8PortraitViewport ? "text-base" : "text-xl"}`}>{dateLabel}</CardDescription>
          <div className={`${isGalaxyTab8PortraitViewport ? "w-full px-1 text-[clamp(3.2rem,14vw,7rem)]" : "text-[clamp(2.2rem,7.2vw,4.8rem)] md:text-[clamp(2.8rem,6.2vw,5.2rem)]"} text-center font-mono font-bold leading-none whitespace-nowrap`}>{timeLabel}</div>
        </CardHeader>
        <CardContent className={`relative overflow-hidden ${isGalaxyTab8PortraitViewport ? "space-y-3 pb-4" : "space-y-4"}`}>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10">
            <img src="/logo-transparent.png" alt="Marca de agua empresa" className={`${isGalaxyTab8PortraitViewport ? "w-[60%]" : "w-[75%]"} max-w-3xl object-contain`} />
          </div>
          <Label className={`text-center block ${isGalaxyTab8PortraitViewport ? "text-lg" : "text-xl"}`}>PIN (4 dígitos)</Label>
          <div className={`relative z-10 flex justify-center ${isGalaxyTab8PortraitViewport ? "gap-2" : "gap-3"}`}>
            {[...Array(PIN_LENGTH)].map((_, index) => (
              <div
                key={index}
                className={`${isGalaxyTab8PortraitViewport ? "w-12 h-14 text-3xl" : "w-14 h-16 md:w-16 md:h-20 text-4xl"} rounded-lg border-2 flex items-center justify-center font-bold ${pin.length > index ? "border-primary bg-primary/10" : "border-muted"}`}
              >
                {pin.length > index ? "•" : ""}
              </div>
            ))}
          </div>

          {localUserPreview && (
            <div className="text-center text-base text-muted-foreground">{localUserPreview}</div>
          )}

          <div className={`relative z-10 grid grid-cols-3 ${isGalaxyTab8PortraitViewport ? "gap-2.5 max-w-[620px]" : "gap-4 max-w-3xl"} mx-auto`}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <Button
                key={digit}
                variant="outline"
                className={`${isGalaxyTab8PortraitViewport ? "h-20 text-4xl" : "h-24 md:h-28 text-5xl"} font-bold`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  handlePinKeyPress(String(digit));
                }}
                onDragStart={(event) => event.preventDefault()}
                disabled={loading}
              >
                {digit}
              </Button>
            ))}
            <Button
              variant="outline"
              className={`${isGalaxyTab8PortraitViewport ? "h-20 text-xl" : "h-24 md:h-28 text-2xl"}`}
              onPointerDown={(event) => {
                event.preventDefault();
                handleClearPin();
              }}
              onDragStart={(event) => event.preventDefault()}
              disabled={loading || pin.length === 0}
            >
              Borrar
            </Button>
            <Button
              variant="outline"
              className={`${isGalaxyTab8PortraitViewport ? "h-20 text-4xl" : "h-24 md:h-28 text-5xl"} font-bold`}
              onPointerDown={(event) => {
                event.preventDefault();
                handlePinKeyPress("0");
              }}
              onDragStart={(event) => event.preventDefault()}
              disabled={loading}
            >
              0
            </Button>
            <Button
              className={`${isGalaxyTab8PortraitViewport ? "h-20 text-xl" : "h-24 md:h-28 text-2xl"}`}
              onPointerDown={(event) => {
                event.preventDefault();
                submitPunch(pin);
              }}
              onDragStart={(event) => event.preventDefault()}
              disabled={loading || pin.length !== PIN_LENGTH}
            >
              {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : "OK"}
            </Button>
          </div>

          {(lastEventLabel || nextEventLabel) && (
            <div className={`rounded-lg border ${isGalaxyTab8PortraitViewport ? "p-2.5 text-sm" : "p-3 text-sm"} space-y-1`}>
              {lastEventLabel && <div>Última marcación: <strong>{lastEventLabel}</strong></div>}
              {nextEventLabel && <div>Siguiente esperada: <strong>{nextEventLabel}</strong></div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
