import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/common/PasswordField";
import { ShieldCheck } from "lucide-react";

/**
 * Modal to confirm sensitive actions with the user's 8-digit login PIN.
 * Controlled: open + onConfirm(pin) + onCancel.
 */
export function ReauthPinDialog({
  open,
  onOpenChange,
  title = "Confirmar con tu PIN",
  description = "Esta acción requiere confirmar tu identidad con el PIN de 8 dígitos.",
  actionLabel = null,
  loading = false,
  error = null,
  onConfirm,
  onCancel,
}) {
  const [pin, setPin] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPin("");
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  const submit = (e) => {
    e?.preventDefault?.();
    const value = String(pin || "").trim();
    if (value.length !== 8) return;
    onConfirm?.(value);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel?.();
        onOpenChange?.(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
            {actionLabel ? (
              <span className="mt-1 block text-xs text-muted-foreground">
                Acción: <code className="rounded bg-muted px-1">{actionLabel}</code>
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <PasswordField
              id="reauth-pin"
              ref={inputRef}
              label="PIN de inicio de sesión"
              mode="pin"
              pinLength={8}
              value={pin}
              onChange={(next) => setPin(next)}
              placeholder="••••••••"
              disabled={loading}
              coaching={false}
              autoComplete="current-password"
              inputClassName="tracking-[0.35em] text-center"
              data-testid="reauth-pin"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => {
                onCancel?.();
                onOpenChange?.(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || pin.length !== 8}>
              {loading ? "Verificando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Imperative helper: returns a Promise that resolves with PIN or null if cancelled.
 * Renders via a temporary state holder — prefer using ReauthPinDialog + local state.
 */
export function createPinPromptController() {
  let resolveFn = null;
  return {
    waitForPin() {
      return new Promise((resolve) => {
        resolveFn = resolve;
      });
    },
    resolve(pin) {
      resolveFn?.(pin);
      resolveFn = null;
    },
    cancel() {
      resolveFn?.(null);
      resolveFn = null;
    },
  };
}
