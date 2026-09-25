import React, { useId, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  assessPassword,
  assessPin,
  meterBarClass,
  meterTextClass,
} from "@/lib/passwordStrength";

/**
 * U15 — Shared password / PIN field with live coaching.
 * - Live checklist (green checks as met) while typing — before submit
 * - Strength meter with coach labels Débil → Regular → Casi → Fuerte
 * - Eye toggle; never blocks paste; password-manager friendly autocomplete
 */
export const PasswordField = React.forwardRef(function PasswordField(
  {
    label,
    value,
    onChange,
    mode = "password",
    pinLength = 8,
    pinLabel,
    coaching = true,
    autoComplete,
    name,
    id: idProp,
    placeholder,
    disabled = false,
    required = false,
    className,
    inputClassName,
    maxLength,
    inputMode,
    "data-testid": testId,
    description,
    onBlur,
    onFocus,
    onKeyDown,
    autoFocus = false,
  },
  ref
) {
  const reactId = useId();
  const inputId = idProp || `pwd-${reactId}`;
  const [visible, setVisible] = useState(false);

  const isPin = mode === "pin";
  const effectiveMax =
    maxLength ?? (isPin ? pinLength : undefined);
  const effectiveInputMode = inputMode ?? (isPin ? "numeric" : undefined);
  const effectiveAutoComplete =
    autoComplete ??
    (isPin
      ? "one-time-code"
      : coaching
        ? "new-password"
        : "current-password");

  const assessment = useMemo(() => {
    if (!coaching) return null;
    if (isPin) {
      return assessPin(value, { length: pinLength, label: pinLabel });
    }
    return assessPassword(value);
  }, [coaching, isPin, value, pinLength, pinLabel]);

  const showCoaching = coaching && assessment && String(value ?? "").length > 0;

  const handleChange = (event) => {
    let next = event.target.value;
    if (isPin) {
      // Digits only for PIN create/edit; paste of "12 34" still works via strip.
      next = String(next).replace(/\D/g, "");
      if (effectiveMax != null) next = next.slice(0, effectiveMax);
    }
    onChange?.(next, event);
  };

  // Intentionally do NOT call preventDefault on paste — password managers / SKU paste.
  const handlePaste = () => {
    /* no-op: allow native paste */
  };

  return (
    <div className={cn("space-y-1.5", className)} data-testid={testId ? `${testId}-wrap` : undefined}>
      {label ? (
        <Label htmlFor={inputId} className="text-sm font-medium">
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
      ) : null}

      <div className="relative">
        <Input
          ref={ref}
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
          value={value ?? ""}
          onChange={handleChange}
          onPaste={handlePaste}
          onBlur={onBlur}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          autoComplete={effectiveAutoComplete}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode={effectiveInputMode}
          maxLength={effectiveMax}
          className={cn(
            "pr-10 font-mono",
            isPin && "tracking-widest text-lg",
            inputClassName
          )}
          data-testid={testId || undefined}
          aria-describedby={
            showCoaching ? `${inputId}-meter ${inputId}-checklist` : undefined
          }
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Ocultar" : "Mostrar"}
          aria-pressed={visible}
          data-testid={testId ? `${testId}-eye` : undefined}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>

      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}

      {showCoaching ? (
        <>
          <div
            id={`${inputId}-meter`}
            className="space-y-1"
            data-testid={testId ? `${testId}-meter` : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "text-xs font-semibold",
                  meterTextClass(assessment.level)
                )}
              >
                {assessment.label}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {assessment.tip}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={assessment.percent}
              aria-label={`Fortaleza: ${assessment.label}`}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-200 ease-out",
                  meterBarClass(assessment.level)
                )}
                style={{ width: `${assessment.percent}%` }}
              />
            </div>
          </div>

          <ul
            id={`${inputId}-checklist`}
            className="mt-1 space-y-0.5"
            data-testid={testId ? `${testId}-checklist` : undefined}
          >
            {assessment.items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  item.ok
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground"
                )}
              >
                {item.ok ? (
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                )}
                <span>
                  {item.label}
                  {item.soft && !item.ok ? (
                    <span className="text-muted-foreground/80"> · sugerido</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* Empty coaching hint so users see guidance before typing (video 15: before submit) */}
      {coaching && assessment && String(value ?? "").length === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid={testId ? `${testId}-hint` : undefined}>
          {assessment.tip}
        </p>
      ) : null}
    </div>
  );
});

PasswordField.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  mode: PropTypes.oneOf(["password", "pin"]),
  pinLength: PropTypes.number,
  pinLabel: PropTypes.string,
  coaching: PropTypes.bool,
  autoComplete: PropTypes.string,
  name: PropTypes.string,
  id: PropTypes.string,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  maxLength: PropTypes.number,
  inputMode: PropTypes.string,
  "data-testid": PropTypes.string,
  description: PropTypes.string,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  onKeyDown: PropTypes.func,
  autoFocus: PropTypes.bool,
};

PasswordField.displayName = "PasswordField";

export default PasswordField;
