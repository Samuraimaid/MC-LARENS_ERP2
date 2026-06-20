import React, { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { Sidebar } from "./Sidebar";
import { Toaster } from "../ui/sonner";
import { FloatingTools } from "../FloatingTools";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { getBrandingForBranch } from "../../lib/branding";
import { APP_ENV } from "../../lib/env";
import { API_BASE as API } from "@/lib/api";
import { AUTOSAVE_STATUS, AUTOSAVE_STATUS_EVENT } from "../../lib/autosaveStatus";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { cn } from "../../lib/utils";
import { toast } from "sonner";
import { Bell, BookOpen, Briefcase, Building2, Calculator, Car, Check, ClipboardList, Cloud, CloudAlert, CloudDownload, CloudUpload, FlaskConical, Lock, LogOut, Menu, Moon, ShoppingCart, Sun, User, Users, RefreshCw, Unlock, X } from "lucide-react";
import { useDevice } from "../../hooks/useDevice";
import { BottomNav } from "./BottomNav";
import { isCashierRole as isCashierRoleHelper } from "../../lib/roleHome";

const SESSION_LOCK_STORAGE_KEY = "erp:session-lock";
const SESSION_LOCK_TAMPER_KEY = "erp:session-lock-tamper";
const SELLER_CONNECTIVITY_POLL_MS = 10000;

const BRANCH_LABELS = {
  branch_main: "Mundo de Accesorios",
  branch_north: "TopCar El Calvario",
  branch_south: "TopCar La Tigre",
};

const WORKBENCH_TAB_ITEMS = [
  { key: "notifications", label: "Notificaciones", icon: Bell },
  { key: "sales", label: "Ventas", icon: ShoppingCart },
  { key: "quotations", label: "Cotizaciones", icon: ClipboardList },
  { key: "catalog", label: "Catálogo", icon: BookOpen },
  { key: "samples", label: "Muestras", icon: FlaskConical },
  { key: "customers", label: "Clientes", icon: Users },
  { key: "vehicles", label: "Vehículos", icon: Car },
];

function HeaderCloudSyncIcon({ className }) {
  return (
    <span className={cn("relative inline-block", className)} aria-hidden="true">
      <Cloud className="h-full w-full" />
      <RefreshCw className="absolute -bottom-[8%] -right-[8%] h-[55%] w-[55%] rounded-full bg-background p-[1px]" />
    </span>
  );
}

function HeaderCloudCheckIcon({ className }) {
  return (
    <span className={cn("relative inline-block", className)} aria-hidden="true">
      <Cloud className="h-full w-full" />
      <Check className="absolute -bottom-[4%] -right-[8%] h-[55%] w-[55%] rounded-full bg-background p-[1px]" />
    </span>
  );
}

export function MainLayout() {
  const { user, logout } = useAuth();
  const { resolvedMode, toggleMode, watermarkOpacity } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1440
  );
  const device = useDevice();
  const isPhone = device.isPhone;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1366 : false
  );
  const [isSessionLocked, setIsSessionLocked] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return JSON.parse(window.sessionStorage.getItem(SESSION_LOCK_STORAGE_KEY) || "{}")?.locked === true;
    } catch {
      return false;
    }
  });
  const [lockedPath, setLockedPath] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return JSON.parse(window.sessionStorage.getItem(SESSION_LOCK_STORAGE_KEY) || "{}")?.path || "";
    } catch {
      return "";
    }
  });
  const [unlockPin, setUnlockPin] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockCooldownUntil, setUnlockCooldownUntil] = useState(0);
  const [unlockCountdownSec, setUnlockCountdownSec] = useState(0);
  const [unlockFailedAttempts, setUnlockFailedAttempts] = useState(0);
  const [unlockRemainingAttempts, setUnlockRemainingAttempts] = useState(3);
  const [lockOverlayTone, setLockOverlayTone] = useState("warning");
  const [sellerAutosaveStatus, setSellerAutosaveStatus] = useState(AUTOSAVE_STATUS.SYNCED);
  const [sellerServerStatus, setSellerServerStatus] = useState("unknown");
  const lastBackWarningRef = useRef(0);
  const branding = getBrandingForBranch(user?.branch_id);
  const branchLabel = BRANCH_LABELS[user?.branch_id] || user?.branch_id || "Sucursal no asignada";
  const roleLabel = String(user?.role || "sin_rol").replace(/_/g, " ").toUpperCase();
  const userFirstName = String(user?.name || "").trim();
  const userLastName = String(user?.last_name || user?.lastname || user?.apellido || "").trim();
  const userDisplayName = useMemo(() => {
    if (userFirstName && userLastName) {
      const normalizedFirstName = userFirstName.toLowerCase();
      const normalizedLastName = userLastName.toLowerCase();
      if (normalizedFirstName.includes(` ${normalizedLastName}`) || normalizedFirstName.endsWith(normalizedLastName)) {
        return userFirstName;
      }
      return `${userFirstName} ${userLastName}`.trim();
    }
    return userFirstName || branding.brandName;
  }, [userFirstName, userLastName, branding.brandName]);
  const buildVersion = APP_ENV.buildVersion;
  const buildTime = APP_ENV.buildTime;
  const buildTimeLabel = buildTime
    ? new Date(buildTime).toLocaleString("es-NI", { dateStyle: "short", timeStyle: "short" })
    : "hora desconocida";
  const isMobile = viewportWidth < 1024;
  const isSellerRole = String(user?.role || "").toLowerCase() === "ventas";
  const isCashierRole = isCashierRoleHelper(user?.role);
  const hideNavigationChrome = isSellerRole || isCashierRole;
  const isWorkbenchRoute = location.pathname === "/workbench";
  const workbenchTabSet = new Set(WORKBENCH_TAB_ITEMS.map((tab) => tab.key));
  const requestedWorkbenchTab = String(new URLSearchParams(location.search).get("tab") || "sales");
  const activeWorkbenchTab = workbenchTabSet.has(requestedWorkbenchTab) ? requestedWorkbenchTab : "sales";

  const headerStatusPresentation = useMemo(() => {
    if (!isSellerRole) {
      if (sellerServerStatus === "down") {
        return {
          icon: CloudAlert,
          title: "Sin conexión con el servidor",
          className: "text-destructive hover:text-destructive hover:bg-destructive/10",
          iconClassName: "",
        };
      }

      return {
        icon: HeaderCloudCheckIcon,
        title: "Conectado y sincronizado",
        className: "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10",
        iconClassName: "",
      };
    }

    const effectiveStatus = sellerServerStatus === "down"
      ? AUTOSAVE_STATUS.DISCONNECTED
      : sellerAutosaveStatus;

    switch (effectiveStatus) {
      case AUTOSAVE_STATUS.DISCONNECTED:
        return {
          icon: CloudAlert,
          title: "Sin conexión con el servidor",
          className: "text-destructive hover:text-destructive hover:bg-destructive/10",
          iconClassName: "",
        };
      case AUTOSAVE_STATUS.RECOVERING:
        return {
          icon: CloudDownload,
          title: "Recuperando datos del formulario desde el servidor",
          className: "text-amber-600 hover:text-amber-700 hover:bg-amber-500/10",
          iconClassName: "animate-pulse",
        };
      case AUTOSAVE_STATUS.SAVING:
        return {
          icon: CloudUpload,
          title: "Guardando cambios localmente",
          className: "text-violet-600 hover:text-violet-700 hover:bg-violet-500/10",
          iconClassName: "animate-pulse",
        };
      case AUTOSAVE_STATUS.SYNCING:
        return {
          icon: HeaderCloudSyncIcon,
          title: "Sincronizando con el servidor",
          className: "text-primary hover:text-primary hover:bg-primary/10",
          iconClassName: "animate-spin",
        };
      case AUTOSAVE_STATUS.SYNCED:
      default:
        return {
          icon: HeaderCloudCheckIcon,
          title: "Todo guardado y sincronizado",
          className: "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10",
          iconClassName: "",
        };
    }
  }, [isSellerRole, sellerAutosaveStatus, sellerServerStatus]);

  const handleWorkbenchTabChange = (nextTab) => {
    const safeTab = workbenchTabSet.has(nextTab) ? nextTab : "sales";
    navigate(`/workbench?tab=${encodeURIComponent(safeTab)}`, { replace: true });
  };

  useEffect(() => {
    if (viewportWidth < 1024) {
      setIsSidebarCollapsed(true);
    }
  }, [viewportWidth]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.title = `${branding.brandName} ERP`;

    let favicon = document.querySelector("link[rel='icon']");
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.setAttribute("rel", "icon");
      document.head.appendChild(favicon);
    }
    favicon.setAttribute("type", "image/png");
    favicon.setAttribute("sizes", "32x32");
    const faviconSrc = `${branding.favicon}${String(branding.favicon).includes("?") ? "&" : "?"}v=${encodeURIComponent(buildVersion)}`;
    favicon.setAttribute("href", faviconSrc);
  }, [branding.brandName, branding.favicon, buildVersion]);

  useEffect(() => {
    if (!isSellerRole || typeof window === "undefined") return undefined;

    const handleSellerAutosaveStatus = (event) => {
      const nextStatus = event?.detail?.status;
      if (!nextStatus) return;
      setSellerAutosaveStatus(nextStatus);
    };

    window.addEventListener(AUTOSAVE_STATUS_EVENT, handleSellerAutosaveStatus);
    return () => {
      window.removeEventListener(AUTOSAVE_STATUS_EVENT, handleSellerAutosaveStatus);
    };
  }, [isSellerRole]);

  useEffect(() => {
    if (isCashierRole) return undefined;

    let disposed = false;

    const checkServerStatus = async () => {
      try {
        await axios.get(`${API}/`, { timeout: 3000, withCredentials: true });
        if (!disposed) {
          setSellerServerStatus("ok");
        }
      } catch {
        if (!disposed) {
          setSellerServerStatus("down");
        }
      }
    };

    checkServerStatus();
    const intervalId = window.setInterval(checkServerStatus, SELLER_CONNECTIVITY_POLL_MS);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [isCashierRole]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isCashierRole) return;
    if (location.pathname !== "/cashier") {
      navigate("/cashier", { replace: true });
    }
  }, [isCashierRole, location.pathname, navigate]);

  useEffect(() => {
    if (!user) return;
    const serverLocked = Boolean(user.session_locked);
    if (serverLocked) {
      const currentPath = `${location.pathname}${location.search}${location.hash}`;
      setIsSessionLocked(true);
      setLockedPath((prev) => prev || currentPath);
    }
  }, [user, location.pathname, location.search, location.hash]);

  useEffect(() => {
    let mounted = true;

    const syncServerLockState = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!mounted || !res.ok) return;
        const me = await res.json();
        const serverLocked = Boolean(me?.session_locked);
        if (serverLocked) {
          const currentPath = `${location.pathname}${location.search}${location.hash}`;
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(
              SESSION_LOCK_STORAGE_KEY,
              JSON.stringify({ locked: true, path: currentPath })
            );
          }
          setIsSessionLocked(true);
          setLockedPath((prev) => prev || currentPath);
          return;
        }
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(SESSION_LOCK_STORAGE_KEY);
        }
        setIsSessionLocked(false);
        setLockedPath("");
      } catch {
        // ignore transient sync errors; server middleware still blocks commands.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        syncServerLockState();
      }
    };

    syncServerLockState();
    window.addEventListener("focus", syncServerLockState);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted = false;
      window.removeEventListener("focus", syncServerLockState);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isSessionLocked) {
      window.sessionStorage.setItem(
        SESSION_LOCK_STORAGE_KEY,
        JSON.stringify({ locked: true, path: lockedPath || location.pathname })
      );
      return;
    }
    window.sessionStorage.removeItem(SESSION_LOCK_STORAGE_KEY);
  }, [isSessionLocked, lockedPath, location.pathname]);

  useEffect(() => {
    if (unlockCooldownUntil <= 0) {
      setUnlockCountdownSec(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((unlockCooldownUntil - Date.now()) / 1000));
      setUnlockCountdownSec(remaining);
      if (remaining <= 0) {
        setUnlockCooldownUntil(0);
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [unlockCooldownUntil]);

  useEffect(() => {
    if (!isSessionLocked || !lockedPath) return;
    const currentPath = `${location.pathname}${location.search}${location.hash}`;
    if (currentPath !== lockedPath) {
      navigate(lockedPath, { replace: true });
    }
  }, [isSessionLocked, lockedPath, location.pathname, location.search, location.hash, navigate]);

  useEffect(() => {
    if (!isSessionLocked || typeof window === "undefined") return;

    const registerTamperAttempt = (reason) => {
      setLockOverlayTone("danger");
      try {
        const raw = window.sessionStorage.getItem(SESSION_LOCK_TAMPER_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        const count = Number(parsed?.count || 0) + 1;
        window.sessionStorage.setItem(
          SESSION_LOCK_TAMPER_KEY,
          JSON.stringify({
            count,
            reason,
            lastAt: Date.now(),
          })
        );
      } catch {
        // Ignore storage errors.
      }
    };

    try {
      const raw = window.sessionStorage.getItem(SESSION_LOCK_TAMPER_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const lastAt = Number(parsed?.lastAt || 0);
      if (lastAt > 0 && Date.now() - lastAt < 10 * 60 * 1000) {
        setLockOverlayTone("danger");
      }
    } catch {
      // Ignore storage parsing errors.
    }

    const lockState = { __sessionLock: true, ts: Date.now() };
    window.history.pushState(lockState, document.title, window.location.href);

    const handlePopState = () => {
      window.history.pushState(lockState, document.title, window.location.href);
      registerTamperAttempt("history-popstate");
      const now = Date.now();
      if (now - lastBackWarningRef.current > 1200) {
        toast.error("Desbloquea la sesión para navegar");
        lastBackWarningRef.current = now;
      }
    };

    const handleBeforeUnload = () => {
      try {
        const raw = window.sessionStorage.getItem(SESSION_LOCK_TAMPER_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        const count = Number(parsed?.count || 0) + 1;
        window.sessionStorage.setItem(
          SESSION_LOCK_TAMPER_KEY,
          JSON.stringify({ count, reason: "reload-or-unload", lastAt: Date.now() })
        );
      } catch {
        // Ignore storage write errors during unload.
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isSessionLocked]);

  const handleSelectTool = (tool) => {
    setActiveTool((prev) => (prev === tool ? null : tool));
  };

  const handleLockSession = () => {
    const execute = async () => {
      const currentPath = `${location.pathname}${location.search}${location.hash}`;
      try {
        const res = await fetch("/api/auth/session/lock", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.detail?.message || body?.detail || "No se pudo bloquear la sesión");
        }
        setIsSessionLocked(true);
        setLockedPath(currentPath);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            SESSION_LOCK_STORAGE_KEY,
            JSON.stringify({ locked: true, path: currentPath })
          );
        }
        setUnlockPin("");
        setUnlockFailedAttempts(0);
        setUnlockRemainingAttempts(3);
        setLockOverlayTone("warning");
        setMobileNavOpen(false);
        toast.success("Sesión bloqueada");
      } catch (error) {
        toast.error(error?.message || "No se pudo bloquear la sesión");
      }
    };
    execute();
  };

  const handleUnlockSession = async () => {
    const isUnlockCoolingDown = unlockCooldownUntil > Date.now();
    if (isUnlockCoolingDown) {
      toast.error(`Debes esperar ${unlockCountdownSec}s para volver a intentar`);
      return;
    }

    const pin = String(unlockPin || "").trim();
    if (!/^\d{8}$/.test(pin)) {
      toast.error("Ingresa tu PIN de 8 dígitos para desbloquear");
      return;
    }
    if (!user?.user_id) {
      toast.error("No se encontró usuario de sesión para validar PIN");
      return;
    }
    setUnlockBusy(true);
    try {
      await unlockWithServerPayload();
      setIsSessionLocked(false);
      setLockedPath("");
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(SESSION_LOCK_STORAGE_KEY);
      }
      setUnlockPin("");
      setUnlockCooldownUntil(0);
      setUnlockFailedAttempts(0);
      setUnlockRemainingAttempts(3);
      setLockOverlayTone("warning");
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(SESSION_LOCK_TAMPER_KEY);
      }
      toast.success("Sesión desbloqueada");
    } catch (error) {
      setLockOverlayTone("danger");
      toast.error(error?.message || "No se pudo desbloquear la sesión");
    } finally {
      setUnlockBusy(false);
    }
  };

  const isUnlockCoolingDown = unlockCooldownUntil > Date.now();

  const unlockWithServerPayload = async () => {
    const pin = String(unlockPin || "").trim();
    const res = await fetch("/api/auth/session/unlock", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = body?.detail;
      const detailObj = detail && typeof detail === "object" ? detail : null;
      const message = (typeof detail === "string" ? detail : detailObj?.message) || "PIN incorrecto";

      if (detailObj?.lockout_until) {
        const untilMs = Date.parse(String(detailObj.lockout_until));
        if (Number.isFinite(untilMs) && untilMs > Date.now()) {
          setUnlockCooldownUntil(untilMs);
          setUnlockPin("");
        }
      }

      if (typeof detailObj?.failed_attempts === "number") {
        setUnlockFailedAttempts(Math.max(0, Number(detailObj.failed_attempts) || 0));
      }

      if (typeof detailObj?.remaining_attempts === "number") {
        setUnlockRemainingAttempts(Math.max(0, Number(detailObj.remaining_attempts) || 0));
      }

      if (typeof detailObj?.remaining_attempts === "number" && detailObj.remaining_attempts > 0) {
        throw new Error(`${message}. Intentos restantes antes de bloqueo: ${detailObj.remaining_attempts}`);
      }

      throw new Error(message);
    }

    return res;
  };

  return (
    <div className="relative h-screen overflow-hidden bg-background">
      <div className={cn("flex h-screen", isSessionLocked ? "pointer-events-none select-none blur-[2px]" : "") }>
        {!isMobile && !hideNavigationChrome ? (
          <Sidebar
            mode={isSidebarCollapsed ? "icon" : "full"}
            onToggleCalculator={() => handleSelectTool("calculator")}
            onToggleSessionLock={handleLockSession}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className={cn(
              "sticky top-0 z-30 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80",
              isPhone ? "min-h-[52px] py-1.5" : !isMobile && isSidebarCollapsed ? "h-20 min-h-0 py-0" : "min-h-[72px] py-3"
            )}
          >
            <div className="flex h-full items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {!hideNavigationChrome ? (
                  <Button
                    variant="outline"
                    size="icon"
                    className="ui-interactive haptic-feedback touch-action-manipulation"
                    onClick={() => {
                      if (isMobile) {
                        setMobileNavOpen((prev) => !prev);
                      } else {
                        setIsSidebarCollapsed((prev) => !prev);
                      }
                    }}
                    aria-label="Abrir menú"
                  >
                    {isMobile && mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </Button>
                ) : null}
                <div className="min-w-0 max-w-[48vw] sm:max-w-[360px] md:max-w-[440px]">
                  <div className="text-sm font-semibold leading-tight truncate" title={userDisplayName}>
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <User className="h-3.5 w-3.5 shrink-0 icon-spring" />
                      <span className="truncate">{userDisplayName}</span>
                    </span>
                  </div>
                  <div className="mt-0.5 flex max-w-full items-center gap-2 text-[10px] text-muted-foreground leading-tight" title={`${roleLabel} ${branchLabel}`}>
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <Briefcase className="h-3 w-3 shrink-0 icon-spring" />
                      <span className="truncate">{roleLabel}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground/70">•</span>
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <Building2 className="h-3 w-3 shrink-0 icon-spring" />
                      <span className="truncate">{branchLabel}</span>
                    </span>
                  </div>
                </div>
              </div>
              {!isMobile && isWorkbenchRoute ? (
                <div className="hidden min-w-0 flex-1 justify-center lg:flex">
                  <Tabs value={activeWorkbenchTab} onValueChange={handleWorkbenchTabChange} className="w-full max-w-[980px]">
                    <TabsList className="grid h-12 w-full grid-cols-7 rounded-full border bg-card/95 p-1">
                      {WORKBENCH_TAB_ITEMS.map((tab) => {
                        const Icon = tab.icon;
                        return (
                          <TabsTrigger
                            key={tab.key}
                            value={tab.key}
                            title={tab.label}
                            className="inline-flex h-full items-center justify-center rounded-full px-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                          >
                            <Icon className="h-5 w-5" />
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </Tabs>
                </div>
              ) : null}
              {/* Botones y usuario a la derecha */}
              <div className="flex items-center gap-1">
                {!isPhone && (
                  <span
                    className="inline-flex min-w-[138px] flex-col rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold tracking-normal text-primary leading-tight"
                    title={`Build ${buildVersion} ${buildTimeLabel}`}
                  >
                    <span className="truncate">BUILD {buildVersion}</span>
                    <span className="font-normal tracking-normal text-[8px] text-primary/80 truncate">{buildTimeLabel}</span>
                  </span>
                )}
                {!isPhone && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 ui-interactive haptic-feedback touch-action-manipulation"
                    onClick={() => handleSelectTool("calculator")}
                    aria-label="Abrir calculadora"
                  >
                    <Calculator className="h-5 w-5 icon-spring" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("ui-interactive haptic-feedback touch-action-manipulation", isPhone ? "h-8 w-8" : "h-10 w-10")}
                  onClick={toggleMode}
                  aria-label="Cambiar tema"
                >
                  {resolvedMode === "dark" ? <Sun className="h-4 w-4 icon-spring" /> : <Moon className="h-4 w-4 icon-spring" />}
                </Button>
                {isCashierRole ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("ui-interactive haptic-feedback touch-action-manipulation", isPhone ? "h-8 w-8" : "h-10 w-10")}
                    onClick={handleLockSession}
                    aria-label="Bloquear sesión"
                    data-testid="lock-session-btn"
                  >
                    <Lock className={cn("icon-spring", isPhone ? "h-4 w-4" : "h-5 w-5")} />
                  </Button>
                ) : (
                  <div
                    className={cn(
                      "inline-flex items-center justify-center rounded-md ui-interactive haptic-feedback touch-action-manipulation",
                      headerStatusPresentation.className,
                      isPhone ? "h-8 w-8" : "h-10 w-10"
                    )}
                    title={headerStatusPresentation.title}
                    aria-label={headerStatusPresentation.title}
                    data-testid="seller-autosave-status"
                  >
                    <headerStatusPresentation.icon className={cn("icon-spring", headerStatusPresentation.iconClassName, isPhone ? "h-4 w-4" : "h-5 w-5")} />
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("text-destructive hover:text-destructive hover:bg-destructive/10 ui-interactive haptic-feedback touch-action-manipulation", isPhone ? "h-8 w-8" : "h-10 w-10")}
                  onClick={async () => { await logout(); navigate("/login", { replace: true }); }}
                  aria-label="Cerrar sesión"
                  data-testid="logout-btn"
                >
                  <LogOut className={cn("icon-spring", isPhone ? "h-4 w-4" : "h-5 w-5")} />
                </Button>
              </div>
            </div>
          </div>

          <main className={cn("flex-1 overflow-auto relative", isPhone && isWorkbenchRoute ? "pb-16" : "")}>
            {/* Watermark: store logo fixed in the content area */}
            <div className="pointer-events-none sticky top-0 z-0 w-full" style={{ height: 0 }}>
              <div className="flex items-center justify-center overflow-hidden p-6" style={{ height: "100vh" }}>
                <img
                  src={branding.logo}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="w-full h-full select-none object-contain"
                  style={{ mixBlendMode: "multiply", opacity: watermarkOpacity }}
                />
              </div>
            </div>
            <Outlet />
          </main>
        </div>

        {isMobile && !hideNavigationChrome ? (
          <div
            className={`fixed inset-0 z-40 ${mobileNavOpen ? "pointer-events-auto" : "pointer-events-none"}`}
            aria-hidden={!mobileNavOpen}
          >
            <button
              className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${mobileNavOpen ? "opacity-100" : "opacity-0"}`}
              onClick={() => setMobileNavOpen(false)}
              aria-label="Cerrar menú"
            />
            <div
              className={`absolute inset-y-0 left-0 h-full w-[min(86vw,340px)] border-r bg-card shadow-2xl transform transition-transform duration-300 ease-out ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}
            >
              <Sidebar
                mode="full"
                onNavigate={() => setMobileNavOpen(false)}
                onToggleCalculator={() => handleSelectTool("calculator")}
                onToggleSessionLock={handleLockSession}
              />
            </div>
          </div>
        ) : null}

        <FloatingTools
          activeTool={activeTool}
          onClose={() => setActiveTool(null)}
          onSelectTool={setActiveTool}
        />
      </div>

      {isPhone && isWorkbenchRoute ? <BottomNav /> : null}

      {isSessionLocked ? (
        <div
          className={cn(
            "fixed inset-0 z-[80] flex items-center justify-center px-4 backdrop-blur-md",
            lockOverlayTone === "danger" ? "bg-rose-700/35" : "bg-amber-500/35"
          )}
        >
          <div
            className={cn(
              "w-full max-w-md rounded-lg border p-4 shadow-xl",
              lockOverlayTone === "danger"
                ? "border-rose-400 bg-rose-950/85 text-rose-50"
                : "border-amber-400 bg-amber-950/85 text-amber-50"
            )}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="h-4 w-4" />
              Sesión bloqueada
            </div>
            <p className="mt-2 text-sm opacity-95">
              Ingresa tu PIN para desbloquear y continuar usando el sistema.
            </p>
            <div className="mt-2 rounded-sm border border-current/20 bg-black/10 px-3 py-2 text-xs space-y-1">
              <p>Intentos fallidos acumulados: {unlockFailedAttempts}</p>
              <p>Intentos restantes antes del siguiente bloqueo: {unlockRemainingAttempts}</p>
            </div>
            {isUnlockCoolingDown ? (
              <p className="mt-2 text-xs font-semibold text-rose-200">
                Bloqueado temporalmente por intentos fallidos. Espera {unlockCountdownSec}s para intentar de nuevo.
              </p>
            ) : null}
            <div className="mt-3 space-y-2">
              <Label htmlFor="main-unlock-pin">PIN de usuario para desbloquear</Label>
              <Input
                id="main-unlock-pin"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={unlockPin}
                onChange={(e) => setUnlockPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="PIN de 8 dígitos"
                disabled={unlockBusy || isUnlockCoolingDown}
                autoFocus
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button onClick={handleUnlockSession} disabled={unlockBusy || isUnlockCoolingDown}>
                {unlockBusy ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Unlock className="h-4 w-4 mr-2" />}
                {isUnlockCoolingDown ? `Espera ${unlockCountdownSec}s` : "Desbloquear"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Toaster position="top-right" richColors />
    </div>
  );
}
