import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import axios from "axios";
import { API_BASE as API } from "@/lib/api";

const THEME_MODE_KEY = "theme_mode";
const THEME_SKIN_KEY = "theme_skin";
const LEGACY_THEME_KEY = "theme";
const WATERMARK_OPACITY_KEY = "watermark_opacity";
const LIQUID_GLASS_KEY = "liquid_glass";
const LIQUID_GLASS_OPACITY_KEY = "mclarens-liquid-glass-opacity";
const DEFAULT_LIQUID_GLASS = true;
/** Default slightly more transparent than Fase 1 card fill (~0.48). */
const DEFAULT_LIQUID_GLASS_OPACITY = 0.40;
const MIN_LIQUID_GLASS_OPACITY = 0.25;
const MAX_LIQUID_GLASS_OPACITY = 0.70;
const DEFAULT_SKIN = "atlas";
const DEFAULT_MODE = "light";
const DEFAULT_WATERMARK_OPACITY = 0.04;
const MIN_WATERMARK_OPACITY = 0;
const MAX_WATERMARK_OPACITY = 0.15;

/** Shared defaults for Settings “Volver al valor predeterminado” (U4). */
export const THEME_DEFAULTS = {
  mode: DEFAULT_MODE,
  skin: DEFAULT_SKIN,
  liquidGlass: DEFAULT_LIQUID_GLASS,
  liquidGlassOpacity: DEFAULT_LIQUID_GLASS_OPACITY,
  watermarkOpacity: DEFAULT_WATERMARK_OPACITY,
};

const ThemeContext = createContext(null);

const normalizeWatermarkOpacity = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_WATERMARK_OPACITY;
  return Math.min(MAX_WATERMARK_OPACITY, Math.max(MIN_WATERMARK_OPACITY, numeric));
};

const normalizeLiquidGlassOpacity = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_LIQUID_GLASS_OPACITY;
  return Math.min(MAX_LIQUID_GLASS_OPACITY, Math.max(MIN_LIQUID_GLASS_OPACITY, numeric));
};

const applyLiquidGlassOpacityVar = (opacity) => {
  if (typeof window === "undefined") return;
  window.document.documentElement.style.setProperty(
    "--liquid-glass-alpha",
    String(normalizeLiquidGlassOpacity(opacity))
  );
};

export function ThemeProvider({ children }) {
  // Do not pre-read persisted theme before auth to avoid visual bleed between users on login.
  const [mode, setModeState] = useState(DEFAULT_MODE);
  const [skin, setSkinState] = useState(DEFAULT_SKIN);
  const [watermarkOpacity, setWatermarkOpacityState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_WATERMARK_OPACITY;
    return normalizeWatermarkOpacity(window.localStorage.getItem(WATERMARK_OPACITY_KEY));
  });
  const [liquidGlass, setLiquidGlassState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_LIQUID_GLASS;
    const stored = window.localStorage.getItem(LIQUID_GLASS_KEY);
    if (stored === null) return DEFAULT_LIQUID_GLASS;
    return stored === "1" || stored === "true";
  });
  const [liquidGlassOpacity, setLiquidGlassOpacityState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_LIQUID_GLASS_OPACITY;
    return normalizeLiquidGlassOpacity(window.localStorage.getItem(LIQUID_GLASS_OPACITY_KEY));
  });
  const [systemMode, setSystemMode] = useState(() => {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  });

  const skipPersistRef = useRef(true);
  const canPersistRef = useRef(false);
  const persistTimerRef = useRef(null);
  const modeRef = useRef(mode);
  const skinRef = useRef(skin);
  const liquidGlassRef = useRef(liquidGlass);
  const liquidGlassOpacityRef = useRef(liquidGlassOpacity);

  modeRef.current = mode;
  skinRef.current = skin;
  liquidGlassRef.current = liquidGlass;
  liquidGlassOpacityRef.current = liquidGlassOpacity;

  const resolvedMode = mode === "system" ? systemMode : mode;

  const buildThemeCustom = useCallback(() => {
    // Merge with existing theme_custom keys when we know them from last GET.
    // For now only sync liquid glass prefs; Auth sound prefs live under the same blob
    // and are preserved by the backend when we omit `custom` — so only send custom
    // when changing liquid-glass fields explicitly.
    return {
      liquid_glass: liquidGlassRef.current,
      liquid_glass_opacity: liquidGlassOpacityRef.current,
    };
  }, []);

  const persistToBackend = useCallback((nextMode, nextSkin, includeCustom = false) => {
    if (skipPersistRef.current || !canPersistRef.current) return;
    if (typeof window === "undefined") return;
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(async () => {
      try {
        const body = { mode: nextMode, skin: nextSkin };
        if (includeCustom) {
          body.custom = buildThemeCustom();
        }
        await axios.put(`${API}/settings/theme`, body, { withCredentials: true });
      } catch (_) {
        // 401 while logged out, or offline — localStorage still holds the choice.
      }
    }, 350);
  }, [buildThemeCustom]);

  const applyFromServerOrStorage = useCallback((opts = {}) => {
    const { mode: nextMode, skin: nextSkin, custom } = opts;
    skipPersistRef.current = true;
    if (nextMode) setModeState(nextMode);
    if (nextSkin) setSkinState(nextSkin);
    if (custom && typeof custom === "object") {
      if (typeof custom.liquid_glass === "boolean") {
        setLiquidGlassState(custom.liquid_glass);
      }
      if (custom.liquid_glass_opacity != null) {
        setLiquidGlassOpacityState(normalizeLiquidGlassOpacity(custom.liquid_glass_opacity));
      }
    }
    // Allow user-driven persists after this apply settles.
    queueMicrotask(() => {
      skipPersistRef.current = false;
      canPersistRef.current = true;
    });
  }, []);

  useLayoutEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");
    root.classList.add(resolvedMode);
    root.setAttribute("data-theme", resolvedMode);
    root.setAttribute("data-skin", skin);
    root.setAttribute("data-liquid-glass", liquidGlass ? "true" : "false");
    applyLiquidGlassOpacityVar(liquidGlassOpacity);

    localStorage.setItem(THEME_MODE_KEY, mode);
    localStorage.setItem(THEME_SKIN_KEY, skin);
    localStorage.setItem(LIQUID_GLASS_KEY, liquidGlass ? "true" : "false");
    localStorage.setItem(LIQUID_GLASS_OPACITY_KEY, String(liquidGlassOpacity));
    if (mode === "system") {
      localStorage.removeItem(LEGACY_THEME_KEY);
    } else {
      localStorage.setItem(LEGACY_THEME_KEY, resolvedMode);
    }
    localStorage.setItem(WATERMARK_OPACITY_KEY, String(watermarkOpacity));
  }, [mode, skin, resolvedMode, liquidGlass, liquidGlassOpacity, watermarkOpacity]);

  useEffect(() => {
    localStorage.setItem(WATERMARK_OPACITY_KEY, String(watermarkOpacity));
  }, [watermarkOpacity]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e) => {
      setSystemMode(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const syncFromStorage = () => {
      const storedMode = localStorage.getItem(THEME_MODE_KEY) || localStorage.getItem(LEGACY_THEME_KEY);
      const storedSkin = localStorage.getItem(THEME_SKIN_KEY);
      const storedWatermarkOpacity = localStorage.getItem(WATERMARK_OPACITY_KEY);
      const storedLiquidGlass = localStorage.getItem(LIQUID_GLASS_KEY);
      const storedLiquidGlassOpacity = localStorage.getItem(LIQUID_GLASS_OPACITY_KEY);
      skipPersistRef.current = true;
      if (storedMode && storedMode !== modeRef.current) {
        setModeState(storedMode);
      }
      if (storedSkin && storedSkin !== skinRef.current) {
        setSkinState(storedSkin);
      }
      if (storedWatermarkOpacity !== null) {
        const nextWatermarkOpacity = normalizeWatermarkOpacity(storedWatermarkOpacity);
        setWatermarkOpacityState((prev) =>
          nextWatermarkOpacity !== prev ? nextWatermarkOpacity : prev
        );
      }
      if (storedLiquidGlass !== null) {
        const nextLiquidGlass = storedLiquidGlass === "1" || storedLiquidGlass === "true";
        setLiquidGlassState((prev) => (nextLiquidGlass !== prev ? nextLiquidGlass : prev));
      }
      if (storedLiquidGlassOpacity !== null) {
        const nextOpacity = normalizeLiquidGlassOpacity(storedLiquidGlassOpacity);
        setLiquidGlassOpacityState((prev) => (nextOpacity !== prev ? nextOpacity : prev));
      }
      queueMicrotask(() => {
        skipPersistRef.current = false;
        canPersistRef.current = true;
      });
    };
    const handler = () => syncFromStorage();
    window.addEventListener("theme:sync", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("theme:sync", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  // Load saved theme from backend once a session cookie exists (cross-device restore).
  useEffect(() => {
    let cancelled = false;

    const loadAppearanceSettings = async () => {
      try {
        const response = await axios.get(`${API}/settings/appearance/public`);
        if (cancelled) return;
        const nextWatermarkOpacity = normalizeWatermarkOpacity(response?.data?.watermark_opacity);
        setWatermarkOpacityState(nextWatermarkOpacity);
      } catch (_) {
        // Keep the locally cached/default value when appearance settings are unavailable.
      }
    };

    const loadUserTheme = async () => {
      try {
        const response = await axios.get(`${API}/settings/theme`, { withCredentials: true });
        if (cancelled) return;
        const data = response?.data || {};
        applyFromServerOrStorage({
          mode: data.mode,
          skin: data.skin,
          custom: data.custom,
        });
      } catch (_) {
        // Not logged in yet — Auth / PIN login will fire theme:sync after session starts.
        skipPersistRef.current = true;
        canPersistRef.current = false;
      }
    };

    loadAppearanceSettings();
    loadUserTheme();
    return () => {
      cancelled = true;
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [applyFromServerOrStorage]);

  // Persist mode/skin whenever the user changes them (sidebar toggle, settings, etc.).
  useEffect(() => {
    persistToBackend(mode, skin, false);
  }, [mode, skin, persistToBackend]);

  const setMode = (next) => {
    const value = typeof next === "function" ? next(modeRef.current) : next;
    setModeState(value);
  };

  const setSkin = (next) => {
    const value = typeof next === "function" ? next(skinRef.current) : next;
    setSkinState(value);
  };

  const toggleMode = () => {
    setModeState((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setSystemTheme = () => {
    setModeState("system");
  };

  const setWatermarkOpacity = (value) => {
    const normalized = normalizeWatermarkOpacity(value);
    setWatermarkOpacityState(normalized);
    localStorage.setItem(WATERMARK_OPACITY_KEY, String(normalized));
    window.dispatchEvent(new Event("theme:sync"));
  };

  const setLiquidGlass = (value) => {
    const next = Boolean(value);
    setLiquidGlassState(next);
    localStorage.setItem(LIQUID_GLASS_KEY, next ? "true" : "false");
    window.dispatchEvent(new Event("theme:sync"));
    // Persist glass into theme_custom when logged in.
    persistToBackend(modeRef.current, skinRef.current, true);
  };

  const setLiquidGlassOpacity = (value) => {
    const normalized = normalizeLiquidGlassOpacity(value);
    setLiquidGlassOpacityState(normalized);
    localStorage.setItem(LIQUID_GLASS_OPACITY_KEY, String(normalized));
    applyLiquidGlassOpacityVar(normalized);
    window.dispatchEvent(new Event("theme:sync"));
    persistToBackend(modeRef.current, skinRef.current, true);
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        skin,
        resolvedMode,
        watermarkOpacity,
        liquidGlass,
        liquidGlassOpacity,
        setMode,
        setSkin,
        setWatermarkOpacity,
        setLiquidGlass,
        setLiquidGlassOpacity,
        toggleMode,
        setSystemTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
