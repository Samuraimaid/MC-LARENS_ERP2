export const UI_SOUND_MUTED_KEY = "ui_sound_muted";
export const UI_SOUND_PROFILE_KEY = "ui_sound_profile";

export const UI_SOUND_PROFILES = {
  SUBTLE: "subtle",
  ARCADE: "arcade",
};

export const THEME_CUSTOM_SOUND_MUTED_FIELD = "ui_sound_muted";
export const THEME_CUSTOM_SOUND_PROFILE_FIELD = "ui_sound_profile";

export const DEFAULT_UI_SOUND_MUTED = false;
export const DEFAULT_UI_SOUND_PROFILE = UI_SOUND_PROFILES.SUBTLE;

const toBool = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const normalizeSoundProfile = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === UI_SOUND_PROFILES.ARCADE) return UI_SOUND_PROFILES.ARCADE;
  return UI_SOUND_PROFILES.SUBTLE;
};

export const getStoredSoundPreferences = () => {
  if (typeof window === "undefined" || !window.localStorage) {
    return { muted: DEFAULT_UI_SOUND_MUTED, profile: DEFAULT_UI_SOUND_PROFILE };
  }
  return {
    muted: toBool(window.localStorage.getItem(UI_SOUND_MUTED_KEY), DEFAULT_UI_SOUND_MUTED),
    profile: normalizeSoundProfile(window.localStorage.getItem(UI_SOUND_PROFILE_KEY) || DEFAULT_UI_SOUND_PROFILE),
  };
};

export const persistSoundPreferencesToLocalStorage = ({ muted, profile }) => {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(UI_SOUND_MUTED_KEY, muted ? "true" : "false");
  window.localStorage.setItem(UI_SOUND_PROFILE_KEY, normalizeSoundProfile(profile));
};

export const extractSoundPreferencesFromThemeCustom = (custom) => {
  const data = custom && typeof custom === "object" ? custom : {};
  return {
    muted: toBool(data[THEME_CUSTOM_SOUND_MUTED_FIELD], DEFAULT_UI_SOUND_MUTED),
    profile: normalizeSoundProfile(data[THEME_CUSTOM_SOUND_PROFILE_FIELD] || DEFAULT_UI_SOUND_PROFILE),
  };
};

export const mergeSoundPreferencesIntoThemeCustom = (currentCustom, prefs) => {
  const next = currentCustom && typeof currentCustom === "object" ? { ...currentCustom } : {};
  next[THEME_CUSTOM_SOUND_MUTED_FIELD] = prefs.muted ? "true" : "false";
  next[THEME_CUSTOM_SOUND_PROFILE_FIELD] = normalizeSoundProfile(prefs.profile);
  return next;
};