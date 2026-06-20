import React, { useMemo, useRef } from "react";
import { cn, formatCurrency, formatCurrencyToParts } from "@/lib/utils";

const DIGIT_CHARS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

function usePreviousNumber(value) {
  const pairRef = useRef({ current: value, previous: value });
  if (pairRef.current.current !== value) {
    pairRef.current = { previous: pairRef.current.current, current: value };
  }
  return pairRef.current.previous;
}

function alignDigitsFromRight(currentDigits, previousDigits) {
  const maxLen = Math.max(currentDigits.length, previousDigits.length);
  const aligned = [];

  for (let place = 0; place < maxLen; place += 1) {
    const currentIndex = currentDigits.length - 1 - place;
    const previousIndex = previousDigits.length - 1 - place;
    const current = currentIndex >= 0 ? currentDigits[currentIndex] : null;
    const previous = previousIndex >= 0 ? previousDigits[previousIndex] : null;
    aligned.unshift({
      current,
      previous: previous ?? current,
      isNew: current !== null && previous === null,
      isRemoved: false,
    });
  }

  return aligned;
}

function RollingDigit({ value, className = "" }) {
  const digit = Number(value);
  const safeDigit = Number.isFinite(digit) ? Math.min(9, Math.max(0, digit)) : 0;

  return (
    <span className={cn("erp-rolling-digit overflow-hidden leading-none", className)}>
      <span
        className="erp-rolling-digit-strip"
        style={{ transform: `translate3d(0, -${safeDigit * 10}%, 0)` }}
      >
        {DIGIT_CHARS.map((char) => (
          <span key={char} className="erp-rolling-digit-cell">
            {char}
          </span>
        ))}
      </span>
    </span>
  );
}

function renderDigitString(currentString, previousString, keyPrefix) {
  const currentDigits = currentString.replace(/\D/g, "");
  const previousDigits = previousString.replace(/\D/g, "");
  const aligned = alignDigitsFromRight(currentDigits, previousDigits);
  let alignedIndex = 0;

  return currentString.split("").map((char, index) => {
    if (!/\d/.test(char)) {
      return (
        <span key={`${keyPrefix}-sep-${index}`} className="erp-rolling-static">
          {char}
        </span>
      );
    }

    const slot = aligned[alignedIndex] ?? { current: char, previous: char, isNew: false };
    alignedIndex += 1;

    return (
      <span
        key={`${keyPrefix}-digit-${index}`}
        className={cn("erp-rolling-digit-wrap", slot.isNew && "animate-erp-digit-enter")}
      >
        <RollingDigit value={slot.current ?? char} />
      </span>
    );
  });
}

function renderCurrencyParts(currentParts, previousParts) {
  return currentParts.map((part, index) => {
    const previousPart = previousParts[index];
    const previousValue = previousPart?.value ?? part.value;

    if (part.type === "integer" || part.type === "fraction") {
      return (
        <span key={`${part.type}-${index}`} className="inline-flex items-center">
          {renderDigitString(part.value, previousValue, `${part.type}-${index}`)}
        </span>
      );
    }

    return (
      <span key={`${part.type}-${index}`} className="erp-rolling-static">
        {part.value}
      </span>
    );
  });
}

export function ErpRollingCurrency({
  value = 0,
  currency = "NIO",
  className = "",
  prefix = "",
  ...props
}) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const previousValue = usePreviousNumber(safeValue);
  const label = formatCurrency(safeValue, currency);

  const currentParts = useMemo(() => formatCurrencyToParts(safeValue, currency), [safeValue, currency]);
  const previousParts = useMemo(() => formatCurrencyToParts(previousValue, currency), [previousValue, currency]);

  return (
    <span
      className={cn("erp-rolling-amount font-mono tabular-nums", className)}
      aria-label={prefix ? `${prefix}${label}` : label}
      aria-live="polite"
      {...props}
    >
      {prefix ? <span className="erp-rolling-static">{prefix}</span> : null}
      {renderCurrencyParts(currentParts, previousParts)}
    </span>
  );
}

export function ErpRollingQuantity({
  value = 0,
  className = "",
  ...props
}) {
  const safeValue = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
  const previousValue = usePreviousNumber(safeValue);
  const currentDigits = String(safeValue);
  const previousDigits = String(previousValue);

  return (
    <span
      className={cn("erp-rolling-amount font-mono tabular-nums", className)}
      aria-label={String(safeValue)}
      aria-live="polite"
      {...props}
    >
      {renderDigitString(currentDigits, previousDigits, "qty")}
    </span>
  );
}

export default ErpRollingCurrency;