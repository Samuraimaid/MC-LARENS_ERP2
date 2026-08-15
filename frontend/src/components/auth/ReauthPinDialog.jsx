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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
            <Label htmlFor="reauth-pin">PIN de inicio de sesión</Label>
            <Input
              id="reauth-pin"
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              pattern="[0-9]{8}"
              placeholder="••••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              disabled={loading}
              className="tracking-[0.35em] text-center text-lg font-mono"
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
