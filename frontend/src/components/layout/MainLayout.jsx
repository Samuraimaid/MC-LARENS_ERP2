import React, { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Toaster } from "../ui/sonner";
import { FloatingTools } from "../FloatingTools";
import { useAuth } from "../../context/AuthContext";
import { getBrandingForBranch } from "../../lib/branding";
import { APP_ENV } from "../../lib/env";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { cn } from "../../lib/utils";
import { toast } from "sonner";
import { Lock, Menu, RefreshCw, Unlock, X } from "lucide-react";

const SESSION_LOCK_STORAGE_KEY = "erp:session-lock";
const SESSION_LOCK_TAMPER_KEY = "erp:session-lock-tamper";

export function MainLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1440
  );
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
  const lastBackWarningRef = useRef(0);
  const branding = getBrandingForBranch(user?.branch_id);
  const buildVersion = APP_ENV.buildVersion;
  const isMobile = viewportWidth < 1024;

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
    if (typeof window === "undefined") return;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

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
        {!isMobile ? (
          <Sidebar
            mode={isSidebarCollapsed ? "icon" : "full"}
            onToggleCalculator={() => handleSelectTool("calculator")}
            onToggleSessionLock={handleLockSession}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-30 border-b bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
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
              <div className="text-sm font-semibold truncate">{branding.brandName}</div>
            </div>
          </div>

          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>

        {isMobile ? (
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
