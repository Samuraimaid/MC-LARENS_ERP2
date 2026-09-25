import React, { useCallback } from "react";
import PropTypes from "prop-types";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** U13 / video 13 — geometry: rail = 2× knob; padding = knob radius (flush ends). */
export const MORPH_TOGGLE_KNOB_DIAMETER_PX = 20;
export const MORPH_TOGGLE_KNOB_RADIUS_PX = MORPH_TOGGLE_KNOB_DIAMETER_PX / 2;
export const MORPH_TOGGLE_RAIL_WIDTH_PX = MORPH_TOGGLE_KNOB_DIAMETER_PX * 2;
export const MORPH_TOGGLE_RAIL_HEIGHT_PX = MORPH_TOGGLE_KNOB_DIAMETER_PX;
export const MORPH_TOGGLE_PADDING_PX = MORPH_TOGGLE_KNOB_RADIUS_PX;
/** Travel = rail width − knob = diameter (knob center anchored at radius from each end). */
export const MORPH_TOGGLE_TRAVEL_PX =
  MORPH_TOGGLE_RAIL_WIDTH_PX - MORPH_TOGGLE_KNOB_DIAMETER_PX;

export const MORPH_TOGGLE_DURATION_MS = 250;
export const MORPH_TOGGLE_EASING = "ease-out";
export const MORPH_TOGGLE_TRANSITION = `${MORPH_TOGGLE_DURATION_MS}ms ${MORPH_TOGGLE_EASING}`;

/** Default Spanish rollback toast (U13). */
export const MORPH_TOGGLE_ERROR_ES = "No se pudo guardar — intenta de nuevo";

export const MORPH_TOGGLE_LABEL_ON = "Activado";
export const MORPH_TOGGLE_LABEL_OFF = "Desactivado";

/** Labeled rail still flush-ends; wider only for Activado/Desactivado text. */
export const MORPH_TOGGLE_LABELED_RAIL_WIDTH_PX = 96;

/**
 * MorphToggle — don't snap; morph ~4 CSS props in 250ms ease-out:
 * (1) rail color (2) knob translateX (3) knob shadow soft→glow (4) label crossfade.
 * A11y: role=switch, aria-checked, Spacebar (native button), teal focus ring outside rail.
 * Optimistic: pending shows circular spinner inside the knob.
 */
const MorphToggle = React.forwardRef(function MorphToggle(
  {
    checked = false,
    onCheckedChange,
    pending = false,
    disabled = false,
    showLabel = false,
    labelOn = MORPH_TOGGLE_LABEL_ON,
    labelOff = MORPH_TOGGLE_LABEL_OFF,
    className,
    id,
    "aria-label": ariaLabel,
    "data-testid": testId,
    ...rest
  },
  ref
) {
  const isOn = Boolean(checked);
  const isDisabled = Boolean(disabled) || Boolean(pending);

  const handleToggle = useCallback(() => {
    if (isDisabled) return;
    if (typeof onCheckedChange === "function") {
      onCheckedChange(!isOn);
    }
  }, [isDisabled, onCheckedChange, isOn]);

  const railWidth = showLabel
    ? MORPH_TOGGLE_LABELED_RAIL_WIDTH_PX
    : MORPH_TOGGLE_RAIL_WIDTH_PX;
  const knobTravel = railWidth - MORPH_TOGGLE_KNOB_DIAMETER_PX;

  return (
    <button
      ref={ref}
      type="button"
      id={id}
      role="switch"
      aria-checked={isOn ? "true" : "false"}
      aria-busy={pending ? "true" : undefined}
      aria-label={ariaLabel}
      disabled={isDisabled}
      data-state={isOn ? "checked" : "unchecked"}
      data-pending={pending ? "true" : "false"}
      data-testid={testId}
      onClick={handleToggle}
      className={cn(
        "group relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-0 p-0",
        "outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      style={{
        width: railWidth,
        height: MORPH_TOGGLE_RAIL_HEIGHT_PX,
        borderRadius: MORPH_TOGGLE_KNOB_RADIUS_PX,
      }}
      {...rest}
    >
      {/* Rail — morph (1) background-color */}
      <span
        aria-hidden
        className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: MORPH_TOGGLE_KNOB_RADIUS_PX,
          backgroundColor: isOn ? "hsl(var(--primary))" : "hsl(var(--muted))",
          transition: `background-color ${MORPH_TOGGLE_TRANSITION}`,
          boxShadow: isOn
            ? "inset 0 0 0 1px color-mix(in srgb, white 22%, transparent)"
            : "inset 0 0 0 1px hsl(var(--border))",
        }}
        data-morph="rail-color"
      />

      {/* Label crossfade (4) — optional; omit when row already has text label */}
      {showLabel ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center text-[9px] font-semibold uppercase tracking-wide"
        >
          <span
            className="absolute right-1.5 max-w-[52%] truncate text-primary-foreground"
            style={{
              opacity: isOn ? 1 : 0,
              transition: `opacity ${MORPH_TOGGLE_TRANSITION}`,
            }}
            data-morph="label-on"
          >
            {labelOn}
          </span>
          <span
            className="absolute left-1.5 max-w-[52%] truncate text-muted-foreground"
            style={{
              opacity: isOn ? 0 : 1,
              transition: `opacity ${MORPH_TOGGLE_TRANSITION}`,
            }}
            data-morph="label-off"
          >
            {labelOff}
          </span>
        </span>
      ) : null}

      {/* Knob — morph (2) translateX + (3) shadow soft→glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 flex items-center justify-center rounded-full bg-background"
        style={{
          width: MORPH_TOGGLE_KNOB_DIAMETER_PX,
          height: MORPH_TOGGLE_KNOB_DIAMETER_PX,
          left: 0,
          transform: `translateX(${isOn ? knobTravel : 0}px)`,
          transition: `transform ${MORPH_TOGGLE_TRANSITION}, box-shadow ${MORPH_TOGGLE_TRANSITION}`,
          boxShadow: isOn
            ? "0 0 0 2px color-mix(in srgb, hsl(var(--primary)) 35%, transparent), 0 0 12px color-mix(in srgb, hsl(var(--primary)) 55%, transparent)"
            : "0 1px 3px hsl(var(--foreground) / 0.18), 0 0 0 1px hsl(var(--border))",
        }}
        data-morph="knob"
      >
        {pending ? (
          <Loader2
            className="animate-spin text-muted-foreground"
            style={{ width: 12, height: 12 }}
            aria-hidden
            data-testid={testId ? `${testId}-spinner` : undefined}
          />
        ) : null}
      </span>
    </button>
  );
});

MorphToggle.displayName = "MorphToggle";

MorphToggle.propTypes = {
  checked: PropTypes.bool,
  onCheckedChange: PropTypes.func,
  pending: PropTypes.bool,
  disabled: PropTypes.bool,
  showLabel: PropTypes.bool,
  labelOn: PropTypes.string,
  labelOff: PropTypes.string,
  className: PropTypes.string,
  id: PropTypes.string,
  "aria-label": PropTypes.string,
  "data-testid": PropTypes.string,
};

export default MorphToggle;
export { MorphToggle };
