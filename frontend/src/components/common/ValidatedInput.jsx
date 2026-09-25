import React, { useId, useImperativeHandle } from "react";
import PropTypes from "prop-types";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useFieldValidation } from "@/hooks/useFieldValidation";

/** Explicit success copy — silence is not enough (video 12). */
export const VALIDATION_SUCCESS_SHORT = "Listo";
export const VALIDATION_SUCCESS_LONG = "Se ve bien";

/**
 * Thin feedback row under a field (error or explicit success).
 * Use with useFieldValidation when you keep a custom Input layout.
 */
export function FieldValidationFeedback({
  showError,
  showSuccess,
  errorMessage,
  successLabel = VALIDATION_SUCCESS_LONG,
  className,
  testId,
}) {
  if (showError && errorMessage) {
    return (
      <p
        className={cn("mt-1 text-xs text-destructive", className)}
        role="alert"
        data-testid={testId ? `${testId}-error` : undefined}
      >
        {errorMessage}
      </p>
    );
  }
  if (showSuccess) {
    return (
      <p
        className={cn(
          "mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400",
          className
        )}
        data-testid={testId ? `${testId}-ok` : undefined}
      >
        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{successLabel}</span>
      </p>
    );
  }
  return null;
}

FieldValidationFeedback.propTypes = {
  showError: PropTypes.bool,
  showSuccess: PropTypes.bool,
  errorMessage: PropTypes.string,
  successLabel: PropTypes.string,
  className: PropTypes.string,
  testId: PropTypes.string,
};

/** Border classes for custom layouts using useFieldValidation. */
export function fieldValidationInputClass(field, { showSuccessChrome = true } = {}) {
  return cn(
    field?.showError && "border-destructive focus-visible:ring-destructive/40",
    showSuccessChrome &&
      field?.showSuccess &&
      "border-emerald-500 focus-visible:ring-emerald-500/40"
  );
}

/**
 * Label + Input with U12 timing: blur first → live after error;
 * green border + check + “Se ve bien”/“Listo” when OK.
 *
 * Ref API: { markSubmitAttempted(), reset(), valid }
 */
export const ValidatedInput = React.forwardRef(function ValidatedInput(
  {
    label,
    value,
    onChange,
    validate,
    enabled = true,
    resetKey,
    successLabel = VALIDATION_SUCCESS_LONG,
    showSuccessChrome = true,
    id: idProp,
    className,
    inputClassName,
    labelClassName,
    wrapperClassName,
    requiredMark = false,
    hint,
    type = "text",
    onBlur: onBlurProp,
    "data-testid": testId,
    ...inputProps
  },
  ref
) {
  const autoId = useId();
  const id = idProp || autoId;
  const field = useFieldValidation({ value, validate, enabled, resetKey });

  useImperativeHandle(
    ref,
    () => ({
      markSubmitAttempted: () => field.markSubmitAttempted(),
      reset: () => field.reset(),
      get valid() {
        return field.valid;
      },
    }),
    [field]
  );

  const handleBlur = (e) => {
    field.onBlur();
    if (typeof onBlurProp === "function") onBlurProp(e);
  };

  const showOk = showSuccessChrome && field.showSuccess;

  return (
    <div className={cn("space-y-1", wrapperClassName)} data-field-validation="">
      {label ? (
        <Label htmlFor={id} className={labelClassName}>
          {label}
          {requiredMark ? " *" : null}
        </Label>
      ) : null}
      <div className="relative">
        <Input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={handleBlur}
          aria-invalid={field.showError || undefined}
          aria-describedby={
            field.showError || showOk ? `${id}-feedback` : undefined
          }
          data-testid={testId}
          className={cn(
            inputClassName,
            fieldValidationInputClass(field, { showSuccessChrome }),
            showOk && "pr-9",
            className
          )}
          {...inputProps}
        />
        {showOk ? (
          <Check
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
        ) : null}
      </div>
      {hint && !field.showError && !showOk ? (
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      ) : null}
      <div id={`${id}-feedback`}>
        <FieldValidationFeedback
          showError={field.showError}
          showSuccess={showOk}
          errorMessage={field.errorMessage}
          successLabel={successLabel}
          testId={testId}
        />
      </div>
    </div>
  );
});

ValidatedInput.propTypes = {
  label: PropTypes.node,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  validate: PropTypes.func.isRequired,
  enabled: PropTypes.bool,
  resetKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
  successLabel: PropTypes.string,
  showSuccessChrome: PropTypes.bool,
  id: PropTypes.string,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  wrapperClassName: PropTypes.string,
  requiredMark: PropTypes.bool,
  hint: PropTypes.node,
  type: PropTypes.string,
  onBlur: PropTypes.func,
  "data-testid": PropTypes.string,
};

ValidatedInput.displayName = "ValidatedInput";

export default ValidatedInput;
