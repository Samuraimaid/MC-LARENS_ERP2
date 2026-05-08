import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { API_BASE as API } from "@/lib/api";

const THEME_MODE_KEY = "theme_mode";
const THEME_SKIN_KEY = "theme_skin";
const LEGACY_THEME_KEY = "theme";
const WATERMARK_OPACITY_KEY = "watermark_opacity";
const DEFAULT_SKIN = "atlas";
const DEFAULT_MODE = "light";
const DEFAULT_WATERMARK_OPACITY = 0.11;
const MIN_WATERMARK_OPACITY = 0;
const MAX_WATERMARK_OPACITY = 0.3;

const ThemeContext = createContext(null);

const normalizeWatermarkOpacity = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_WATERMARK_OPACITY;
  return Math.min(MAX_WATERMARK_OPACITY, Math.max(MIN_WATERMARK_OPACITY, numeric));
};

export function ThemeProvider({ children }) {
  // Do not pre-read persisted theme before auth to avoid visual bleed between users on login.
  const [mode, setMode] = useState(DEFAULT_MODE);
  const [skin, setSkin] = useState(DEFAULT_SKIN);
  const [watermarkOpacity, setWatermarkOpacityState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_WATERMARK_OPACITY;
    return normalizeWatermarkOpacity(window.localStorage.getItem(WATERMARK_OPACITY_KEY));
  });
  const [systemMode, setSystemMode] = useState(() => {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  });

  const resolvedMode = mode === "system" ? systemMode : mode;

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");
    root.classList.add(resolvedMode);
    root.setAttribute("data-theme", resolvedMode);
    root.setAttribute("data-skin", skin);

    localStorage.setItem(THEME_MODE_KEY, mode);
    localStorage.setItem(THEME_SKIN_KEY, skin);
    if (mode === "system") {
      localStorage.removeItem(LEGACY_THEME_KEY);
    } else {
      localStorage.setItem(LEGACY_THEME_KEY, resolvedMode);
    }
    localStorage.setItem(WATERMARK_OPACITY_KEY, String(watermarkOpacity));
  }, [mode, skin, resolvedMode]);

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
      if (storedMode && storedMode !== mode) {
        setMode(storedMode);
      }
      if (storedSkin && storedSkin !== skin) {
        setSkin(storedSkin);
      }
      if (storedWatermarkOpacity !== null) {
        const nextWatermarkOpacity = normalizeWatermarkOpacity(storedWatermarkOpacity);
        if (nextWatermarkOpacity !== watermarkOpacity) {
          setWatermarkOpacityState(nextWatermarkOpacity);
        }
      }
    };
    const handler = () => syncFromStorage();
    window.addEventListener("theme:sync", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("theme:sync", handler);
      window.removeEventListener("storage", handler);
    };
  }, [mode, skin, watermarkOpacity]);

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

    loadAppearanceSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleMode = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setSystemTheme = () => {
    setMode("system");
  };

  const setWatermarkOpacity = (value) => {
    const normalized = normalizeWatermarkOpacity(value);
    setWatermarkOpacityState(normalized);
    localStorage.setItem(WATERMARK_OPACITY_KEY, String(normalized));
    window.dispatchEvent(new Event("theme:sync"));
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        skin,
        resolvedMode,
        watermarkOpacity,
        setMode,
        setSkin,
        setWatermarkOpacity,
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
