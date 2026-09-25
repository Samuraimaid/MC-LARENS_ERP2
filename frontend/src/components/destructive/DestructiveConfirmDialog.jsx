import React, { useState } from "react";
import PropTypes from "prop-types";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HoldToConfirmButton } from "./HoldToConfirmButton";
import { cn } from "@/lib/utils";

/**
 * Destructive confirm dialog (U6 / video 06).
 * Verb labels only — never Sí/No. Hold-to-confirm on the destroy action.
 * Cancel uses neutral outline (red budget: red only for permanent destroy).
 */
export function DestructiveConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  /** Verb for the destroy action, e.g. "Eliminar producto" */
  confirmVerb,
  /** Verb for keeping / backing out, e.g. "Conservar producto" — never "No"/"Cancelar" alone as Yes/No */
  cancelVerb = "Conservar",
  onConfirm,
  loading = false,
  /** When set, shows a required motivo field before hold unlocks */
  requireReason = false,
  reasonLabel = "Motivo (obligatorio)",
  reasonPlaceholder = "Explicá el motivo…",
  defaultReason = "",
  /** Optional note under actions (e.g. cooldown gap) */
  footnote,
  testId = "destructive-confirm",
  className,
}) {
  const [reason, setReason] = useState(defaultReason || "");
  const reasonOk = !requireReason || String(reason || "").trim().length > 0;

  const handleOpenChange = (next) => {
    if (!next) setReason(defaultReason || "");
    onOpenChange?.(next);
  };

  const handleConfirm = async () => {
    if (!reasonOk || loading) return;
    const payload = requireReason ? { reason: String(reason).trim() } : undefined;
    await onConfirm?.(payload);
    setReason(defaultReason || "");
    onOpenChange?.(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        className={cn("sm:max-w-md", className)}
        data-testid={testId}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {title}
          </AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        {requireReason ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${testId}-reason`}>{reasonLabel}</Label>
            <Textarea
              id={`${testId}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              rows={3}
              disabled={loading}
              data-testid={`${testId}-reason`}
            />
          </div>
        ) : null}

        {footnote ? (
          <p className="text-xs text-muted-foreground" data-testid={`${testId}-footnote`}>
            {footnote}
          </p>
        ) : null}

        <AlertDialogFooter className="gap-2 sm:gap-3">
          {/* Neutral cancel — red budget: not destructive */}
          <AlertDialogCancel
            disabled={loading}
            className="mt-0"
            data-testid={`${testId}-cancel`}
          >
            {cancelVerb}
          </AlertDialogCancel>
          <HoldToConfirmButton
            variant="destructive"
            disabled={!reasonOk || loading}
            loading={loading}
            onConfirm={handleConfirm}
            testId={`${testId}-hold`}
            title={`Mantener pulsado para ${String(confirmVerb || "").toLowerCase()}`}
          >
            {confirmVerb}
          </HoldToConfirmButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

DestructiveConfirmDialog.propTypes = {
  open: PropTypes.bool,
  onOpenChange: PropTypes.func,
  title: PropTypes.string,
  description: PropTypes.node,
  confirmVerb: PropTypes.string.isRequired,
  cancelVerb: PropTypes.string,
  onConfirm: PropTypes.func,
  loading: PropTypes.bool,
  requireReason: PropTypes.bool,
  reasonLabel: PropTypes.string,
  reasonPlaceholder: PropTypes.string,
  defaultReason: PropTypes.string,
  footnote: PropTypes.node,
  testId: PropTypes.string,
  className: PropTypes.string,
};

export default DestructiveConfirmDialog;
