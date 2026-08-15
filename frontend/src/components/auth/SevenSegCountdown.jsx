import React from "react";
import { cn } from "@/lib/utils";

const SEVEN_SEG_FONT = {
  fontFamily: "DSEG7Classic, ui-monospace, monospace",
  fontStyle: "italic",
  fontWeight: 400,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0.08em",
  fontSynthesis: "none",
};

/**
 * 7-segment countdown with centiseconds.
 * Colon blinks 1 Hz (on 0.5s / off 0.5s) like a digital wristwatch.
 * Font is applied inline + class so minify/cascade cannot drop DSEG7.
 */
export function SevenSegCountdown({
  remainingMs = 0,
  className,
  style,
  showGlow = false,
  "data-testid": testId,
}) {
  const totalMs = Math.max(0, Number(remainingMs) || 0);
  const totalSeconds = Math.floor(totalMs / 1000);
  const centiseconds = Math.floor((totalMs % 1000) / 10);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, "0");
  const cc = String(centiseconds).padStart(2, "0");

  // Duty cycle 50%: visible first half of each second, hidden second half
  const colonOn = Math.floor(totalMs / 500) % 2 === 0;

  const label = minutes > 0 ? `${minutes}:${ss}.${cc}` : `${ss}.${cc}`;

  const digitStyle = { fontFamily: "inherit", fontStyle: "inherit", fontWeight: "inherit" };

  return (
    <span
      className={cn(
        "font-seven-seg inline-flex items-baseline justify-center leading-none",
        showGlow && "font-seven-seg-glow",
        className,
      )}
      style={{ ...SEVEN_SEG_FONT, ...style }}
      data-testid={testId}
      aria-label={label}
      role="timer"
    >
      {minutes > 0 ? (
        <>
          <span style={digitStyle}>{minutes}</span>
          <span
            className={cn(
              "inline-block transition-opacity duration-75",
              colonOn ? "opacity-100" : "opacity-0",
            )}
            style={digitStyle}
            aria-hidden="true"
          >
            :
          </span>
          <span style={digitStyle}>{ss}</span>
        </>
      ) : (
        <span style={digitStyle}>{ss}</span>
      )}
      <span style={digitStyle} aria-hidden="true">
        .
      </span>
      <span style={digitStyle}>{cc}</span>
    </span>
  );
}

export default SevenSegCountdown;
