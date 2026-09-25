import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * U12 — Validation timing (video 12):
 * 1. Do NOT validate-yell on every first keystroke.
 * 2. First check on blur (or submit attempt) — not a submit-only wall of errors.
 * 3. If invalid → show error, then escalate to live-on-change until fixed.
 * 4. Success is explicit (caller: green border + check + “Se ve bien” / “Listo”).
 *
 * @param {object} opts
 * @param {unknown} opts.value
 * @param {(value: unknown) => { valid: boolean, message?: string }} opts.validate
 * @param {boolean} [opts.enabled=true]
 * @param {string|number|boolean} [opts.resetKey] — change to clear timing state (form reset)
 */
export function useFieldValidation({ value, validate, enabled = true, resetKey }) {
  const [blurred, setBlurred] = useState(false);
  /** True only after an invalid blur/submit — then revalidate on every change. */
  const [liveMode, setLiveMode] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (resetKey === undefined) return;
    setBlurred(false);
    setLiveMode(false);
    setSubmitAttempted(false);
  }, [resetKey]);

  const result = useMemo(() => {
    if (!enabled || typeof validate !== "function") {
      return { valid: true, message: "" };
    }
    try {
      const out = validate(value);
      if (out && typeof out === "object") {
        return {
          valid: Boolean(out.valid),
          message: out.message || "",
        };
      }
      return { valid: Boolean(out), message: "" };
    } catch {
      return { valid: false, message: "Revisa este campo" };
    }
  }, [enabled, validate, value]);

  const hasContent = String(value ?? "").trim() !== "";

  // Errors: only after escalate (live) or submit attempt — first blur sets liveMode if invalid.
  const showError = Boolean(enabled && !result.valid && (liveMode || submitAttempted));
  // Success: after blur or live/submit path, when valid — never for empty optional fields.
  const showSuccess = Boolean(
    enabled &&
      result.valid &&
      hasContent &&
      (blurred || liveMode || submitAttempted)
  );

  const onBlur = useCallback(() => {
    if (!enabled) return;
    setBlurred(true);
    let ok = true;
    try {
      const next = typeof validate === "function" ? validate(value) : { valid: true };
      ok = next && typeof next === "object" ? Boolean(next.valid) : Boolean(next);
    } catch {
      ok = false;
    }
    if (!ok) setLiveMode(true);
  }, [enabled, validate, value]);

  const markSubmitAttempted = useCallback(() => {
    if (!enabled) return false;
    setSubmitAttempted(true);
    setBlurred(true);
    let ok = true;
    try {
      const next = typeof validate === "function" ? validate(value) : { valid: true };
      ok = next && typeof next === "object" ? Boolean(next.valid) : Boolean(next);
    } catch {
      ok = false;
    }
    if (!ok) setLiveMode(true);
    return ok;
  }, [enabled, validate, value]);

  const reset = useCallback(() => {
    setBlurred(false);
    setLiveMode(false);
    setSubmitAttempted(false);
  }, []);

  return {
    valid: result.valid,
    message: result.message,
    showError,
    showSuccess,
    errorMessage: showError ? result.message : null,
    onBlur,
    markSubmitAttempted,
    reset,
    liveMode,
    blurred,
    submitAttempted,
  };
}

export default useFieldValidation;
