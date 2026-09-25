import React, { useMemo, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HoldToConfirmButton } from "@/components/destructive";
import { cn } from "@/lib/utils";

/**
 * Quarantined danger zone at bottom of settings (U4 + U6).
 * Red border budget; type-phrase unlock + hold-to-confirm (~300ms ring).
 * Verb label (never Sí/No). Away from primary Save path by placement.
 */
export function SettingsDangerZone({
  title = "Zona de peligro",
  description = "Acciones irreversibles. Procedé con cuidado.",
  confirmPhrase,
  confirmLabel,
  actionLabel = "Eliminar para siempre",
  onConfirm,
  loading = false,
  disabled = false,
  children,
  className,
  testId = "settings-danger-zone",
  /** Optional note when multi-day cooldown API is absent */
  cooldownNote = "No hay periodo de gracia multi-día: esta acción es permanente en este dispositivo.",
}) {
  const [typed, setTyped] = useState("");
  const expected = String(confirmPhrase || "").trim();
  const unlocked = useMemo(
    () => expected.length > 0 && typed.trim() === expected,
    [expected, typed],
  );

  const handleConfirm = async () => {
    if (!unlocked || loading || disabled) return;
    await onConfirm?.();
    setTyped("");
  };

  return (
    <Card
      className={cn(
        "border-2 border-destructive/70 bg-destructive/[0.03] shadow-none",
        className,
      )}
      data-testid={testId}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="text-destructive/80">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        {expected ? (
          <div className="space-y-3 rounded-lg border border-destructive/40 bg-background/60 p-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${testId}-confirm`} className="text-sm">
                {confirmLabel || (
                  <>
                    Escribí <span className="font-mono font-semibold text-destructive">{expected}</span> para
                    desbloquear
                  </>
                )}
              </Label>
              <Input
                id={`${testId}-confirm`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder={expected}
                className="font-mono"
                data-testid={`${testId}-confirm-input`}
                disabled={loading || disabled}
              />
            </div>
            <HoldToConfirmButton
              variant="destructive"
              disabled={!unlocked || loading || disabled}
              loading={loading}
              onConfirm={handleConfirm}
              testId={`${testId}-confirm-btn`}
              title={`Mantener pulsado para ${String(actionLabel).toLowerCase()}`}
            >
              <Trash2 className="h-4 w-4" />
              {loading ? "Eliminando…" : actionLabel}
            </HoldToConfirmButton>
            {cooldownNote ? (
              <p className="text-[11px] text-muted-foreground" data-testid={`${testId}-cooldown-note`}>
                {cooldownNote}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default SettingsDangerZone;
