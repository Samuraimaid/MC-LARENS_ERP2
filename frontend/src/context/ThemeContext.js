import React, { createContext, useContext, useState, useEffect } from "react";

const THEME_MODE_KEY = "theme_mode";
const THEME_SKIN_KEY = "theme_skin";
const LEGACY_THEME_KEY = "theme";
const DEFAULT_SKIN = "atlas";
const DEFAULT_MODE = "light";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // Do not pre-read persisted theme before auth to avoid visual bleed between users on login.
  const [mode, setMode] = useState(DEFAULT_MODE);
  const [skin, setSkin] = useState(DEFAULT_SKIN);
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
  }, [mode, skin, resolvedMode]);

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
      if (storedMode && storedMode !== mode) {
        setMode(storedMode);
      }
      if (storedSkin && storedSkin !== skin) {
        setSkin(storedSkin);
      }
    };
    const handler = () => syncFromStorage();
    window.addEventListener("theme:sync", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("theme:sync", handler);
      window.removeEventListener("storage", handler);
    };
  }, [mode, skin]);

  const toggleMode = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setSystemTheme = () => {
    setMode("system");
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        skin,
        resolvedMode,
        setMode,
        setSkin,
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
