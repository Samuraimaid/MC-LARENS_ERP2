import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { erpActionButtonClass, ERP_ACTION_BUTTONS } from "@/lib/erpDesignSystem";
import { Check } from "lucide-react";

/**
 * Barra de acciones unificada para formularios embebidos (ventas, cotizaciones, futuros módulos).
 */
export default function ErpFormToolbar({
  children,
  className = "",
  saveFlash = false,
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 ui-fade-in-stagger", className)}>
      {children}
      {saveFlash ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-erp-fade-check">
          <Check className="h-3.5 w-3.5" />
          Guardado
        </span>
      ) : null}
    </div>
  );
}

export function ErpToolbarButton({
  action = "refresh",
  icon: Icon,
  label,
  onClick,
  disabled = false,
  testId,
  title,
  showLabelOnSm = true,
  className = "",
}) {
  const iconClass = action === "create"
    ? ERP_ACTION_BUTTONS.iconCreate
    : action === "saveClear"
      ? ERP_ACTION_BUTTONS.iconSaveClear
      : action === "save"
        ? ERP_ACTION_BUTTONS.iconSave
        : "";

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      title={title || label}
      className={erpActionButtonClass(action, className)}
    >
      {Icon ? <Icon className={cn("h-3.5 w-3.5", iconClass, showLabelOnSm && label ? "sm:mr-1.5" : "")} /> : null}
      {label ? (
        <span className={showLabelOnSm ? "hidden sm:inline" : ""}>{label}</span>
      ) : null}
    </Button>
  );
}