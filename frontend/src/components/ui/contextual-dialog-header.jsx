import React from "react";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Soft status modals matching the classic “pastel glyph” system alerts:
 * huge soft shape on the left + dark title + muted body + solid action color.
 *
 * Variants: information | warning | error | question | success
 * Sizes: "hero" (status cards) | "inline" (form / dense dialogs)
 */

/** Filled white glyphs (not stroke icons) — closer to the reference art */
function GlyphX({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none">
      <path
        d="M18 18 L46 46 M46 18 L18 46"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlyphCheck({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none">
      <path
        d="M14 34 L26 46 L50 18"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GlyphInfo({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="currentColor">
      <circle cx="32" cy="16" r="6.5" />
      <rect x="25.5" y="28" width="13" height="28" rx="6.5" />
    </svg>
  );
}

function GlyphExclaim({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="currentColor">
      <rect x="26" y="10" width="12" height="30" rx="6" />
      <circle cx="32" cy="50" r="6.5" />
    </svg>
  );
}

function GlyphQuestion({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none">
      <path
        d="M22 24c0-7 5.5-12 12-12s12 5 12 12c0 6-4 9-8 11-2.5 1.2-4 3-4 6"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle cx="32" cy="50" r="4.5" fill="currentColor" />
    </svg>
  );
}

/** Shared motion classes for status action buttons (hover / active via CSS). */
const STATUS_BTN_MOTION =
  "status-dialog-btn transition-all duration-200 ease-out";

export const STATUS_VARIANT_STYLES = {
  information: {
    Glyph: GlyphInfo,
    shape: "rounded-full bg-[#A8D4F0] text-white",
    title: "text-slate-700 dark:text-slate-100",
    primaryBtn: cn(
      STATUS_BTN_MOTION,
      "status-dialog-btn-primary",
      "bg-[#4A90C8] text-white hover:bg-[#3A7AB0] focus-visible:ring-[#4A90C8]",
    ),
    secondaryBtn: cn(
      STATUS_BTN_MOTION,
      "status-dialog-btn-secondary",
      "bg-slate-100 text-slate-600 hover:bg-slate-200 border-0 shadow-none",
    ),
  },
  warning: {
    Glyph: GlyphExclaim,
    shape:
      "bg-[#F5D76E] text-white [clip-path:polygon(50%_6%,96%_90%,4%_90%)] rounded-none shadow-none",
    title: "text-slate-700 dark:text-slate-100",
    primaryBtn: cn(
      STATUS_BTN_MOTION,
      "status-dialog-btn-primary",
      "bg-[#E8B923] text-white hover:bg-[#D4A61A] focus-visible:ring-[#E8B923]",
    ),
    secondaryBtn: cn(
      STATUS_BTN_MOTION,
      "status-dialog-btn-secondary",
      "bg-slate-100 text-slate-600 hover:bg-slate-200 border-0 shadow-none",
    ),
  },
  error: {
    Glyph: GlyphX,
    shape: "rounded-full bg-[#F0A8A8] text-white",
    title: "text-slate-700 dark:text-slate-100",
    primaryBtn: cn(
      STATUS_BTN_MOTION,
      "status-dialog-btn-primary",
      "bg-[#E74C3C] text-white hover:bg-[#C93C2E] focus-visible:ring-[#E74C3C]",
    ),
    secondaryBtn: cn(
      STATUS_BTN_MOTION,
      "status-dialog-btn-secondary",
      "bg-slate-100 text-slate-600 hover:bg-slate-200 border-0 shadow-none",
    ),
  },
  question: {
    Glyph: GlyphQuestion,
    shape: "rounded-full bg-[#A8C5F0] text-white",
    title: "text-slate-700 dark:text-slate-100",
    primaryBtn: cn(
      STATUS_BTN_MOTION,
      "status-dialog-btn-primary",
      "bg-[#4A7BC8] text-white hover:bg-[#3A6AB0] focus-visible:ring-[#4A7BC8]",
    ),
    secondaryBtn: cn(
      STATUS_BTN_MOTION,
      "status-dialog-btn-secondary",
      "bg-slate-100 text-slate-600 hover:bg-slate-200 border-0 shadow-none",
    ),
  },
  success: {
    Glyph: GlyphCheck,
    shape: "rounded-full bg-[#8FD4B8] text-white",
    title: "text-slate-700 dark:text-slate-100",
    primaryBtn: cn(
      STATUS_BTN_MOTION,
      "status-dialog-btn-primary",
      "bg-[#2ECC71] text-white hover:bg-[#27AE60] focus-visible:ring-[#2ECC71]",
    ),
    secondaryBtn: cn(
      STATUS_BTN_MOTION,
      "status-dialog-btn-secondary",
      "bg-slate-100 text-slate-600 hover:bg-slate-200 border-0 shadow-none",
    ),
  },
};

export function getStatusPrimaryButtonClass(variant = "information") {
  return (STATUS_VARIANT_STYLES[variant] || STATUS_VARIANT_STYLES.information).primaryBtn;
}

export function getStatusSecondaryButtonClass(variant = "information") {
  return (STATUS_VARIANT_STYLES[variant] || STATUS_VARIANT_STYLES.information).secondaryBtn;
}

export function ContextualDialogHeader({
  title,
  description,
  variant = "information",
  /** Optional custom glyph component (receives className). If omitted, uses variant default. */
  glyph: GlyphOverride = null,
  /** @deprecated use `glyph` — kept so older icon={Lucide} call sites still render something */
  icon: IconOverride = null,
  className = "",
  titleClassName = "",
  descriptionClassName = "",
  children = null,
  /** "hero" = large status card. "inline" = compact form header. */
  size = "hero",
}) {
  const style = STATUS_VARIANT_STYLES[variant] || STATUS_VARIANT_STYLES.information;
  const isHero = size !== "inline";
  const isWarning = variant === "warning";
  const Glyph = GlyphOverride || style.Glyph;
  const LegacyIcon = IconOverride;

  return (
    <DialogHeader className={cn("space-y-0 text-left", className)}>
      <div
        className={cn(
          "flex",
          isHero
            ? "flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left"
            : "flex-row items-start gap-3",
        )}
      >
        {/* Soft pastel shape with entrance pop + soft glow */}
        <div
          className={cn(
            "relative flex shrink-0 items-center justify-center text-white",
            isHero
              ? isWarning
                ? "h-[7.5rem] w-[7.5rem] sm:h-36 sm:w-36"
                : "h-28 w-28 sm:h-36 sm:w-36"
              : isWarning
                ? "mt-0.5 h-12 w-12"
                : "mt-0.5 h-11 w-11",
            style.shape,
            isHero && "status-dialog-glyph",
          )}
          aria-hidden="true"
        >
          {LegacyIcon && !GlyphOverride ? (
            <LegacyIcon
              className={cn(isHero ? "h-14 w-14 sm:h-16 sm:w-16" : "h-6 w-6")}
              strokeWidth={isHero ? 2.5 : 2.25}
            />
          ) : (
            <Glyph
              className={cn(
                isHero
                  ? isWarning
                    ? "h-12 w-12 translate-y-1 sm:h-14 sm:w-14"
                    : "h-14 w-14 sm:h-16 sm:w-16"
                  : "h-6 w-6",
              )}
            />
          )}
        </div>

        <div
          className={cn(
            "min-w-0 flex-1 space-y-1.5",
            isHero ? "w-full sm:pr-6" : "pr-6",
          )}
        >
          <DialogTitle
            className={cn(
              "font-semibold tracking-tight",
              isHero ? "text-xl sm:text-2xl status-dialog-title-in" : "text-lg",
              "leading-snug break-words",
              style.title,
              titleClassName,
            )}
          >
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription
              className={cn(
                "text-sm leading-relaxed text-slate-500 dark:text-slate-400 break-words",
                isHero && "mx-auto max-w-[18rem] sm:mx-0 sm:max-w-none status-dialog-desc-in",
                descriptionClassName,
              )}
            >
              {description}
            </DialogDescription>
          ) : null}
          {children}
        </div>
      </div>
    </DialogHeader>
  );
}

/**
 * Footer tuned for status cards + mobile:
 * full-width stacked on phones; solid rounded actions with hover motion.
 */
export function ContextualDialogFooter({
  className = "",
  children,
  variant = null,
  ...props
}) {
  return (
    <div
      className={cn(
        "status-dialog-footer-in flex w-full flex-col-reverse gap-2 pt-2",
        "sm:flex-row sm:justify-end sm:gap-2",
        "pb-[max(0px,env(safe-area-inset-bottom,0px))]",
        className,
      )}
      data-status-variant={variant || undefined}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, {
          className: cn(
            "status-dialog-btn w-full sm:w-auto min-h-11 min-w-[7.5rem] touch-manipulation rounded-md font-semibold uppercase tracking-wide text-xs sm:text-sm",
            child.props.className,
          ),
        });
      })}
    </div>
  );
}

export default ContextualDialogHeader;
