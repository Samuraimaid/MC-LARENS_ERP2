import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_BASE as API, getStoredSessionToken, setStoredSessionToken, getStoredUser, setStoredUser } from "@/lib/api";
import { APP_ENV } from "@/lib/env";
import { toast } from "sonner";
import { TOPCAR_BRANCH_IDS } from "../lib/branding";
import {
  DEFAULT_UI_SOUND_MUTED,
  DEFAULT_UI_SOUND_PROFILE,
  extractSoundPreferencesFromThemeCustom,
  persistSoundPreferencesToLocalStorage,
} from "@/lib/userUiPreferences";

const DRAFT_KEY_PREFIXES = ["draft_sale_v1", "draft_quote_v1"];
const DRAFT_META_KEYS = [
  "draft_sale_tabs_v1",
  "draft_sale_active_v1",
  "draft_quote_tabs_v1",
  "draft_quote_active_v1",
];
const DRAFT_BACKUP_KEY = "draft_backup_v1";
const THEME_MODE_KEY = "theme_mode";
const THEME_SKIN_KEY = "theme_skin";
const LEGACY_THEME_KEY = "theme";
const SYNC_DEBOUNCE_MS = 1500;

const debounce = (fn, waitMs) => {
  let timer = null;
  const wrapped = (...args) => {
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  };
  wrapped.cancel = () => {
    if (timer) {
      window.clearTimeout(timer);
      timer = null;
    }
  };
  return wrapped;
};

const getBranchThemeDefaults = (branchId) => {
  const isTopCar = TOPCAR_BRANCH_IDS.has(String(branchId || ""));
  if (isTopCar) {
    return { mode: "light", skin: "spectrum-01" };
  }
  return { mode: "light", skin: "atlas" };
};

const resolveEffectiveRole = (role) => {
  if (!role) return "";
  if (role === "recursos_humanos") return "gerencia";
  return role;
};

const isDraftValueEmpty = (value) => {
  if (!value) return true;
  try {
    const draft = JSON.parse(value);
    return !draft?.selectedCustomerId
      && (!draft?.cartItems || draft.cartItems.length === 0)
      && !draft?.notes
      && !draft?.customerSearch
      && !draft?.productSearch
      && !draft?.globalDiscount
      && (!draft?.appliedDiscounts || draft.appliedDiscounts.length === 0);
  } catch (error) {
    return false;
  }
};

const getDraftCompletenessScore = (value) => {
  if (!value) return 0;
  try {
    const draft = typeof value === "string" ? JSON.parse(value) : value;
    if (!draft || typeof draft !== "object") return 0;

    let score = 0;
    if (draft.selectedCustomerId) score += 4;
    if (draft.selectedVehicle) score += 3;
    if (draft.selectedVehicleData && typeof draft.selectedVehicleData === "object") score += 2;
    if (draft.selectedWarehouse) score += 1;
    if (draft.paymentMethod && draft.paymentMethod !== "cash") score += 1;
    if (Array.isArray(draft.cartItems) && draft.cartItems.length > 0) score += 6 + Math.min(draft.cartItems.length, 5);
    if (Number(draft.globalDiscount) > 0) score += 2;
    if ((draft.globalDiscountMode || "percent") !== "percent") score += 1;
    if (Array.isArray(draft.appliedDiscounts) && draft.appliedDiscounts.length > 0) score += 2 + draft.appliedDiscounts.length;
    if (draft.notes) score += 1;
    if (draft.customerSearch) score += 1;
    if (draft.productSearch) score += 1;
    if (draft.applyIVA === false) score += 1;
    if (draft.applyRetention) score += 1;
    if (draft.showNewCustomer || draft.showNewVehicleDialog) score += 1;
    if (draft.newCustomer || draft.newVehicle) score += 1;
    return score;
  } catch (error) {
    return 0;
  }
};

const collectDraftEntries = () => {
  if (typeof window === "undefined" || !window.localStorage) return [];
  const entries = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i) || "";
    if (DRAFT_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)) || DRAFT_META_KEYS.includes(key)) {
      entries.push({ key, value: window.localStorage.getItem(key) });
    }
  }
  return entries;
};

function observeDraftsAutoSync() {
  if (typeof window === "undefined" || !window.localStorage) return () => {};
  let lastDrafts = JSON.stringify(collectDraftEntries());
  const syncDrafts = debounce(async () => {
    const entries = collectDraftEntries();
    const current = JSON.stringify(entries);
    if (current !== lastDrafts && entries.length > 0) {
      lastDrafts = current;
      try {
        await axios.post(`${API}/drafts/backup`, { entries }, { withCredentials: true });
      } catch (error) {
        // ignore intermittent sync failures
      }
    }
  }, SYNC_DEBOUNCE_MS);

  const storageHandler = (event) => {
    if (
      DRAFT_KEY_PREFIXES.some((prefix) => event.key?.startsWith(prefix))
      || DRAFT_META_KEYS.includes(event.key)
    ) {
      syncDrafts();
    }
  };
  window.addEventListener("storage", storageHandler);

  const origSetItem = window.localStorage.setItem;
  window.localStorage.setItem = function setItemWithDraftSync(key, value) {
    origSetItem.apply(this, arguments);
    if (
      DRAFT_KEY_PREFIXES.some((prefix) => key?.startsWith(prefix))
      || DRAFT_META_KEYS.includes(key)
    ) {
      syncDrafts();
    }
  };

  return () => {
    window.removeEventListener("storage", storageHandler);
    window.localStorage.setItem = origSetItem;
    if (typeof syncDrafts.cancel === "function") {
      syncDrafts.cancel();
    }
  };
}

const applyDraftEntries = (entries = []) => {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (!Array.isArray(entries)) return;
  entries.forEach(({ key, value }) => {
    if (!key) return;
    const existing = window.localStorage.getItem(key);
    if (typeof value !== "string") return;
    if (DRAFT_META_KEYS.includes(key)) {
      if (existing !== value) {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    const shouldReplace = existing === null
      || existing === ""
      || (isDraftValueEmpty(existing) && !isDraftValueEmpty(value))
      || getDraftCompletenessScore(value) > getDraftCompletenessScore(existing);
    if (shouldReplace) {
      window.localStorage.setItem(key, value);
    }
  });
};

const hasDrafts = () => {
  if (typeof window === "undefined" || !window.localStorage) return false;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i) || "";
    if (DRAFT_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      return true;
    }
  }
  return false;
};

const backupDrafts = () => {
  if (typeof window === "undefined" || !window.localStorage) return;
  const backup = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i) || "";
    if (DRAFT_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)) || DRAFT_META_KEYS.includes(key)) {
      backup.push({ key, value: window.localStorage.getItem(key) });
    }
  }
  if (backup.length > 0) {
    window.localStorage.setItem(DRAFT_BACKUP_KEY, JSON.stringify(backup));
  }
};

const restoreDrafts = () => {
  if (typeof window === "undefined" || !window.localStorage) return;
  const raw = window.localStorage.getItem(DRAFT_BACKUP_KEY);
  if (!raw) return;
  try {
    const backup = JSON.parse(raw);
    if (!Array.isArray(backup)) return;
    applyDraftEntries(backup);
    window.localStorage.removeItem(DRAFT_BACKUP_KEY);
  } catch (error) {
    // ignore invalid backup
  }
};

const applyThemePreferences = (userDoc) => {
  if (typeof window === "undefined" || !window.localStorage || !userDoc) return;
  const defaults = getBranchThemeDefaults(userDoc.branch_id);
  const nextMode = userDoc.theme_mode || defaults.mode;
  const nextSkin = userDoc.theme_skin || defaults.skin;
  window.localStorage.setItem(THEME_MODE_KEY, nextMode);
  if (nextMode === "light" || nextMode === "dark") {
    window.localStorage.setItem(LEGACY_THEME_KEY, nextMode);
  } else {
    window.localStorage.removeItem(LEGACY_THEME_KEY);
  }
  window.localStorage.setItem(THEME_SKIN_KEY, nextSkin);

  const userSoundPrefs = extractSoundPreferencesFromThemeCustom(userDoc.theme_custom);
  persistSoundPreferencesToLocalStorage({
    muted: userSoundPrefs.muted ?? DEFAULT_UI_SOUND_MUTED,
    profile: userSoundPrefs.profile || DEFAULT_UI_SOUND_PROFILE,
  });

  window.dispatchEvent(new Event("theme:sync"));
  window.dispatchEvent(new Event("ui:sound-sync"));
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    // Iniciar sincronización automática de drafts
    useEffect(() => {
      const cleanup = observeDraftsAutoSync();
      return cleanup;
    }, []);
  const [user, setUser] = useState(() => getStoredUser());
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(() => !getStoredUser());
  const invalidSessionNotifiedRef = useRef(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status;
        const detail = error?.response?.data?.detail;
        const detailMessage = typeof detail === "string" ? detail : detail?.message;
        const detailCode = typeof detail === "object" && detail ? detail.code : null;
        const configUrl = error?.config?.url || "";
        const isLoginAttempt =
          configUrl.includes("/auth/pin/login") || configUrl.includes("/auth/reauth");
        const isSessionTimeout =
          status === 401 &&
          !isLoginAttempt &&
          (detailCode === "SESSION_IDLE_TIMEOUT" ||
            detailCode === "SESSION_EXPIRED" ||
            detailCode === "SESSION_INVALID" ||
            detailMessage === "Invalid session" ||
            detailMessage === "Unauthorized");

        const isLoginPage = typeof window !== "undefined" && window.location.pathname.startsWith("/login");
        if (isSessionTimeout) {
          setUser(null);
          setStoredUser(null);
          setStoredSessionToken(null);
          setPermissions(null);
          if (!invalidSessionNotifiedRef.current && !isLoginPage) {
            let msg = "Se cerró la sesión. Vuelve a iniciar con tu PIN.";
            if (detailCode === "SESSION_IDLE_TIMEOUT") {
              msg =
                (typeof detailMessage === "string" ? detailMessage : null) ||
                "Sesión cerrada por inactividad. Inicia sesión de nuevo.";
            } else if (detailCode === "SESSION_EXPIRED") {
              msg =
                (typeof detailMessage === "string" ? detailMessage : null) ||
                "La sesión ha expirado. Vuelve a iniciar sesión con tu PIN.";
            } else if (
              detailMessage === "Invalid session" ||
              detailMessage === "Unauthorized"
            ) {
              msg =
                "Se cerró sesión en otro dispositivo que estaba logueado con tu cuenta";
            }
            toast.error(typeof msg === "string" ? msg : "Sesión expirada");
            invalidSessionNotifiedRef.current = true;
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        withCredentials: true,
      });
      if (
        !response.data ||
        typeof response.data !== "object" ||
        typeof response.data === "string" ||
        (!response.data.user_id && !response.data.id && !response.data.role && !response.data.name)
      ) {
        throw new Error("Invalid session user");
      }
      setUser(response.data);
      setStoredUser(response.data);
      if (response.data?.session_token) {
        setStoredSessionToken(response.data.session_token);
      }
      invalidSessionNotifiedRef.current = false;
      try {
        const permsRes = await axios.get(`${API}/permissions/me`, { withCredentials: true });
        setPermissions(permsRes?.data?.effective_permissions || null);
      } catch (error) {
        setPermissions(null);
      }
      applyThemePreferences(response.data);
      restoreDrafts();
      try {
        const res = await axios.get(`${API}/drafts/backup`, { withCredentials: true });
        applyDraftEntries(res?.data?.entries);
      } catch (error) {
        // ignore
      }
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        setUser(null);
        setStoredUser(null);
        setStoredSessionToken(null);
        setPermissions(null);
      } else {
        const cachedUser = getStoredUser();
        if (cachedUser) {
          setUser(cachedUser);
        } else {
          setUser(null);
          setPermissions(null);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    // Use environment-configured auth URL to avoid hardcoded external providers
    const redirectUrl = window.location.origin + "/workbench";
    const authBase = APP_ENV.authUrl || `${API}/auth/login`;
    window.location.href = `${authBase}?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const processSession = async (sessionId) => {
    try {
      const response = await axios.post(
        `${API}/auth/session`,
        { session_id: sessionId },
        { withCredentials: true }
      );
      setUser(response.data);
      setStoredUser(response.data);
      if (response.data?.session_token) {
        setStoredSessionToken(response.data.session_token);
      }
      invalidSessionNotifiedRef.current = false;
      try {
        const permsRes = await axios.get(`${API}/permissions/me`, { withCredentials: true });
        setPermissions(permsRes?.data?.effective_permissions || null);
      } catch (error) {
        setPermissions(null);
      }
      applyThemePreferences(response.data);
      restoreDrafts();
      try {
        const res = await axios.get(`${API}/drafts/backup`, { withCredentials: true });
        applyDraftEntries(res?.data?.entries);
      } catch (error) {
        // ignore
      }
      return response.data;
    } catch (error) {
      console.error("Session processing failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (hasDrafts()) {
        // Autoguardado silencioso, sin confirmación
        backupDrafts();
        try {
          const entries = collectDraftEntries();
          if (entries.length > 0) {
            await axios.post(`${API}/drafts/backup`, { entries }, { withCredentials: true });
          }
        } catch (error) {
          // ignore
        }
      }
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setStoredUser(null);
      setStoredSessionToken(null);
      setPermissions(null);
      invalidSessionNotifiedRef.current = false;
    }
  };

  const hasRole = (allowedRoles) => {
    if (!user) return false;
    const effectiveUserRole = resolveEffectiveRole(user.role);
    if (effectiveUserRole === "programador") return true;
    const effectiveAllowedRoles = (allowedRoles || []).map(resolveEffectiveRole);
    return effectiveAllowedRoles.includes(effectiveUserRole);
  };

  const ADMIN_PERMISSION_FLOOR = {
    users: ["view", "create", "edit", "delete"],
    settings: ["view", "create", "edit", "delete"],
    system_settings: ["view", "create", "edit", "delete"],
    branches: ["view", "create", "edit", "delete"],
  };

  const hasPermission = (functionKey, action = "view") => {
    if (!user || !functionKey) return false;
    const effectiveRole = resolveEffectiveRole(user.role);
    const adminActions = ADMIN_PERMISSION_FLOOR[functionKey];
    if (
      (effectiveRole === "gerencia" || effectiveRole === "programador")
      && Array.isArray(adminActions)
      && adminActions.includes(action)
    ) {
      return true;
    }
    if (!permissions || typeof permissions !== "object") {
      return true;
    }
    for (const moduleValue of Object.values(permissions)) {
      if (!moduleValue || typeof moduleValue !== "object") continue;
      const functionPerms = moduleValue[functionKey];
      if (functionPerms && typeof functionPerms === "object") {
        return Boolean(functionPerms[action]);
      }
    }
    return false;
  };

  const isManager = () => hasRole(["gerencia", "supervisor"]);
  const canSell = () => hasRole(["gerencia", "supervisor", "ventas"]);
  const canManageInventory = () => hasRole(["gerencia", "supervisor", "bodegas"]);
  const canInstall = () => hasRole(["gerencia", "supervisor", "instalaciones"]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        processSession,
        checkAuth,
        hasRole,
        hasPermission,
        permissions,
        isManager,
        canSell,
        canManageInventory,
        canInstall,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
