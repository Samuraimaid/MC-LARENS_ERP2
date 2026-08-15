import React from "react";
import { cn } from "@/lib/utils";

/**
 * 7-segment countdown with centiseconds.
 * Colon blinks 1 Hz (on 0.5s / off 0.5s) like a digital wristwatch.
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

  const label =
    minutes > 0 ? `${minutes}:${ss}.${cc}` : `${ss}.${cc}`;

  return (
    <span
      className={cn(
        "font-seven-seg inline-flex items-baseline justify-center leading-none",
        showGlow && "font-seven-seg-glow",
        className,
      )}
      style={style}
      data-testid={testId}
      aria-label={label}
      role="timer"
    >
      {minutes > 0 ? (
        <>
          <span className="tabular-nums">{minutes}</span>
          <span
            className={cn(
              "inline-block transition-opacity duration-75",
              colonOn ? "opacity-100" : "opacity-0",
            )}
            aria-hidden="true"
          >
            :
          </span>
          <span className="tabular-nums">{ss}</span>
        </>
      ) : (
        <span className="tabular-nums">{ss}</span>
      )}
      <span className="tabular-nums" aria-hidden="true">
        .
      </span>
      <span className="tabular-nums">{cc}</span>
    </span>
  );
}

export default SevenSegCountdown;
