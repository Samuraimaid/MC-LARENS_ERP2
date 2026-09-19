import React, { forwardRef, useMemo } from "react";

function readReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function sizeFromClassName(className) {
  const raw = String(className || "");
  const bracket = raw.match(/\bh-\[(\d+)px\]/);
  if (bracket) return Number(bracket[1]);
  const match = raw.match(/\bh-(\d+(?:\.\d+)?)\b/);
  if (!match) return null;
  return Math.round(Number(match[1]) * 4);
}

/**
 * Drop-in replacement wrapper: lucide-animated on hover, lucide-react if
 * prefers-reduced-motion or animated icon missing.
 */
export function createAnimatedLucideIcon(AnimatedIcon, FallbackIcon, displayName) {
  const Comp = forwardRef(function AnimatedLucideBridge(props, ref) {
    const {
      className,
      size,
      color,
      strokeWidth,
      absoluteStrokeWidth,
      animateOnHover = true,
      ...rest
    } = props;

    const reduced = useMemo(() => readReducedMotion(), []);
    if (reduced || !AnimatedIcon || !FallbackIcon) {
      if (!FallbackIcon) return null;
      return (
        <FallbackIcon
          ref={ref}
          className={className}
          size={size}
          color={color}
          strokeWidth={strokeWidth}
          absoluteStrokeWidth={absoluteStrokeWidth}
          {...rest}
        />
      );
    }

    const resolvedSize = typeof size === "number" ? size : sizeFromClassName(className) || 24;
    const mergedClass = ["inline-flex shrink-0 items-center justify-center", className]
      .filter(Boolean)
      .join(" ");

    return (
      <AnimatedIcon
        ref={ref}
        className={mergedClass}
        size={resolvedSize}
        color={color}
        strokeWidth={strokeWidth}
        animateOnHover={animateOnHover}
        {...rest}
      />
    );
  });
  Comp.displayName = displayName || FallbackIcon?.displayName || "AnimatedLucideIcon";
  return Comp;
}
