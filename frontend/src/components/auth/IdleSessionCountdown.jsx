import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, LogOut, MousePointerClick, Timer } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useIdleSession, formatCountdownMs } from "@/hooks/useIdleSession";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Countdown in the last minutes of session idle.
 * On expire: logout (free terminal for next seller) — does not PIN-lock the UI.
 */
export function IdleSessionCountdown({ paused = false } = {}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const idleMinutes = Number(user?.session_policy?.idle_minutes);
  const resolvedIdle =
    Number.isFinite(idleMinutes) && idleMinutes > 0
      ? idleMinutes
      : String(user?.role || "").toLowerCase() === "ventas"
        ? 5
        : 60;

  const handleExpire = useCallback(async () => {
    toast.warning("Sesión cerrada por inactividad. Terminal libre para el siguiente vendedor.");
    try {
      // Clear local lock so the next seller is not stuck on a lock overlay
      try {
        window.sessionStorage.removeItem("erp:session-lock");
        window.sessionStorage.removeItem("erp:session-lock-tamper");
      } catch {
        // ignore
      }
      await logout();
    } catch {
      // ignore
    }
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  const idle = useIdleSession({
    enabled: Boolean(user),
    idleMinutes: resolvedIdle,
    paused,
    onExpire: handleExpire,
  });

  const handleStay = async () => {
    setBusy(true);
    try {
      const ok = await idle.stayActive();
      if (ok) {
        toast.success("Sesión extendida. Sigue trabajando.");
      } else {
        toast.error("No se pudo renovar la sesión. Inicia de nuevo con tu PIN.");
        navigate("/login", { replace: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReleaseTerminal = async () => {
    setBusy(true);
    try {
      await logout();
      toast.message("Sesión cerrada. Terminal disponible.");
      navigate("/login", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  if (!user || !idle.isWarning) return null;

  const role = String(user.role || "").toLowerCase();
  const isSharedTerminal = role === "ventas" || role === "cajero";

  return (
    <>
      {/* Compact bar — always visible during warn window */}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "fixed inset-x-0 bottom-0 z-[90] border-t px-3 py-2.5 shadow-lg",
          idle.isCritical
            ? "border-destructive/40 bg-destructive text-destructive-foreground"
            : "border-amber-500/40 bg-amber-500 text-amber-950",
        )}
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 min-w-0">
            <Timer className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold leading-tight">
                Inactividad: cierra en{" "}
                <span
                  className="font-seven-seg inline-block text-xl sm:text-2xl"
                  style={{ transform: "skewX(-4deg)" }}
                >
                  {idle.formatRemainingFluid}
                </span>
              </p>
              <p className="text-xs sm:text-sm opacity-90">
                {isSharedTerminal
                  ? "Si sales, el terminal queda libre para otro vendedor. Toca “Sigo aquí” si sigues en el puesto."
                  : "Mueve el mouse o confirma para no cerrar la sesión."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant={idle.isCritical ? "secondary" : "default"}
              className={cn(
                "font-semibold",
                !idle.isCritical && "bg-amber-950 text-amber-50 hover:bg-amber-900",
              )}
              disabled={busy}
              onClick={handleStay}
            >
              <MousePointerClick className="h-4 w-4 mr-1.5" />
              Sigo aquí
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                idle.isCritical
                  ? "border-white/40 bg-transparent text-destructive-foreground hover:bg-white/10"
                  : "border-amber-950/30 bg-transparent text-amber-950 hover:bg-amber-950/10",
              )}
              disabled={busy}
              onClick={handleReleaseTerminal}
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Liberar terminal
            </Button>
          </div>
        </div>
      </div>

      {/* Critical last seconds: centered emphasis without full PIN lock */}
      {idle.isCritical ? (
        <div className="fixed inset-0 z-[89] flex items-center justify-center bg-black/45 p-4 pointer-events-none">
          <div
            className="pointer-events-auto w-full max-w-md rounded-xl border border-destructive/50 bg-background p-5 shadow-2xl"
            role="alertdialog"
            aria-labelledby="idle-critical-title"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-destructive/15 p-2">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div className="flex-1">
                <h2 id="idle-critical-title" className="text-lg font-bold">
                  ¡Sesión por cerrar!
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Quedan{" "}
                  <span
                    className="font-seven-seg font-seven-seg-glow inline-block text-destructive text-2xl sm:text-3xl"
                    style={{ transform: "skewX(-6deg)" }}
                  >
                    {formatCountdownMs(idle.remainingMs)}
                  </span>
                  . Si no respondes, se cierra el login para que otro pueda usar el terminal.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" disabled={busy} onClick={handleStay} className="flex-1 min-w-[8rem]">
                    Sigo aquí
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={handleReleaseTerminal}
                    className="flex-1 min-w-[8rem]"
                  >
                    Liberar terminal
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default IdleSessionCountdown;
