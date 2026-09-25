import React from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Sticky bottom Cancelar / Guardar for identity & high-stakes settings (U4).
 * Hidden when not dirty. Brief “Guardado” is handled by SettingsSavedBadge.
 */
export function SettingsSaveBar({
  dirty = false,
  saving = false,
  saveDisabled = false,
  onSave,
  onCancel,
  saveLabel = "Guardar",
  cancelLabel = "Cancelar",
  message = "Tienes cambios sin guardar",
  className,
  testId = "settings-save-bar",
}) {
  if (!dirty) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/85",
        "safe-area-bottom",
        className,
      )}
      role="status"
      aria-live="polite"
      data-testid={testId}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{message}</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
            data-testid={`${testId}-cancel`}
          >
            <X className="mr-2 h-4 w-4" />
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={saving || saveDisabled}
            data-testid={`${testId}-save`}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Guardando…" : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Brief “Guardado” badge after instant prefs persist (tema, liquid glass, densidades).
 */
export function SettingsSavedBadge({ visible = false, label = "Guardado", className }) {
  if (!visible) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 animate-fade-up-soft",
        className,
      )}
      data-testid="settings-saved-badge"
      role="status"
      aria-live="polite"
    >
      {label}
    </span>
  );
}

export default SettingsSaveBar;
