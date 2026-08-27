import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * TachometerLoader Component
 * Reusable automotive loading component inspired by the official "Mundo de Accesorios" tachometer logo.
 * 
 * @param {Object} props
 * @param {'fullscreen' | 'modal' | 'inline' | 'mini'} [props.variant='modal'] - Display style
 * @param {number} [props.progress] - Optional progress percentage (0 to 100). If undefined, runs continuous revving animation.
 * @param {string} [props.statusText='Cargando datos del sistema...'] - Status text displayed below
 * @param {string} [props.rpmLabel] - Optional custom RPM label text
 * @param {boolean} [props.showLogoText=true] - Whether to show "MUNDO DE ACCESORIOS" banner
 * @param {boolean} [props.showProgressBar=true] - Whether to show the bottom glowing progress bar
 * @param {string} [props.className] - Additional class names for container
 */
export default function TachometerLoader({
  variant = "modal",
  progress,
  statusText = "Cargando datos del sistema...",
  rpmLabel,
  showLogoText = true,
  showProgressBar = true,
  className = "",
}) {
  const isManualProgress = typeof progress === "number" && !isNaN(progress);
  const clampedProgress = isManualProgress ? Math.max(0, Math.min(100, progress)) : 0;

  // Angle maps from -105deg (0 RPM) to +55deg (Redline / 100%)
  const needleAngle = useMemo(() => {
    if (!isManualProgress) return null;
    return -105 + (clampedProgress / 100) * 160;
  }, [clampedProgress, isManualProgress]);

  // Arc stroke-dashoffset maps from 440 (empty) to 0 (full)
  const arcDashOffset = useMemo(() => {
    if (!isManualProgress) return null;
    return 440 - (clampedProgress / 100) * 440;
  }, [clampedProgress, isManualProgress]);

  const computedRpmText = useMemo(() => {
    if (rpmLabel) return rpmLabel;
    if (isManualProgress) {
      const rpm = Math.round(800 + (clampedProgress / 100) * 6400);
      return `RPM: ${rpm.toLocaleString()} • ${Math.round(clampedProgress)}%`;
    }
    return "REV: 6,400 RPM • ESTADO ÓPTIMO";
  }, [clampedProgress, isManualProgress, rpmLabel]);

  // 1. MINI TOPBAR VARIANT (DISCRETE SYNC)
  if (variant === "mini") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-400 shadow-sm backdrop-blur-md animate-fade-in dark:border-sky-500/40 dark:bg-sky-950/40",
          className
        )}
      >
        <svg
          viewBox="0 0 400 240"
          className="h-4 w-7 shrink-0 overflow-visible"
        >
          <path
            d="M 50 175 A 150 150 0 0 1 350 175 Z"
            fill="#090d16"
            stroke="#00d2ff"
            strokeWidth="16"
          />
          <g
            className={!isManualProgress ? "animate-tacho-needle-continuous origin-[200px_175px]" : "origin-[200px_175px] transition-transform duration-150"}
            style={isManualProgress ? { transform: `rotate(${needleAngle}deg)` } : undefined}
          >
            <polygon points="194,175 206,175 200,45" fill="#ffffff" />
            <circle cx="200" cy="175" r="24" fill="#00d2ff" />
          </g>
        </svg>
        <span className="truncate">{statusText}</span>
      </div>
    );
  }

  // 2. MAIN TACHOMETER COMPONENT (MODAL / FULLSCREEN / INLINE)
  const content = (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center p-6 text-center select-none",
        variant === "modal" && "rounded-3xl border border-white/10 bg-slate-950/85 p-8 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/90",
        variant === "fullscreen" && "rounded-3xl border border-white/10 bg-slate-950/90 p-10 shadow-2xl backdrop-blur-3xl",
        className
      )}
    >
      <div className="relative w-72 sm:w-80">
        <svg
          className="w-full h-auto overflow-visible drop-shadow-[0_12px_24px_rgba(0,0,0,0.5)]"
          viewBox="0 0 400 240"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="tachoGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00d2ff" />
              <stop offset="70%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#ff3344" />
            </linearGradient>
            <linearGradient id="yellowLogoGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fff566" />
              <stop offset="100%" stopColor="#ffe600" />
            </linearGradient>
          </defs>

          {/* Dial Bezel & Housing */}
          <path
            d="M 50 175 A 150 150 0 0 1 350 175 Z"
            fill="#090d16"
            stroke="#ffffff"
            strokeWidth="5"
          />
          <path
            d="M 62 175 A 138 138 0 0 1 338 175 Z"
            fill="#04060a"
            stroke="#1e293b"
            strokeWidth="2"
          />

          {/* Background Track */}
          <path
            d="M 75 175 A 125 125 0 0 1 325 175"
            fill="none"
            stroke="#1e293b"
            strokeWidth="6"
            strokeLinecap="round"
          />

          {/* Animated Cyan/Redline Progress Arc */}
          <path
            d="M 75 175 A 125 125 0 0 1 325 175"
            fill="none"
            stroke="url(#tachoGrad)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="440"
            className={!isManualProgress ? "animate-tacho-arc-continuous filter drop-shadow-[0_0_8px_rgba(0,210,255,0.6)]" : "transition-all duration-150 filter drop-shadow-[0_0_8px_rgba(0,210,255,0.6)]"}
            style={isManualProgress ? { strokeDashoffset: arcDashOffset } : undefined}
          />

          {/* White & Red Ticks */}
          <line x1="82" y1="175" x2="98" y2="175" stroke="#ffffff" strokeWidth="4" />
          <line x1="88" y1="148" x2="102" y2="152" stroke="#ffffff" strokeWidth="2.5" />
          <line x1="98" y1="122" x2="111" y2="130" stroke="#ffffff" strokeWidth="4" />
          <line x1="112" y1="99" x2="123" y2="110" stroke="#ffffff" strokeWidth="2.5" />

          <line x1="131" y1="79" x2="140" y2="92" stroke="#ffffff" strokeWidth="4" />
          <line x1="153" y1="64" x2="160" y2="78" stroke="#ffffff" strokeWidth="2.5" />
          <line x1="178" y1="53" x2="182" y2="68" stroke="#ffffff" strokeWidth="4" />
          <line x1="205" y1="48" x2="206" y2="63" stroke="#ffffff" strokeWidth="2.5" />
          <line x1="232" y1="52" x2="229" y2="67" stroke="#ffffff" strokeWidth="4" />

          {/* Redline Ticks */}
          <line x1="258" y1="62" x2="251" y2="76" stroke="#ffffff" strokeWidth="2.5" />
          <line x1="281" y1="77" x2="271" y2="90" stroke="#ffffff" strokeWidth="4" />
          <line x1="300" y1="97" x2="288" y2="108" stroke="#ff3344" strokeWidth="3" className="animate-pulse" />
          <line x1="314" y1="120" x2="300" y2="128" stroke="#ff3344" strokeWidth="4.5" className="animate-pulse" />
          <line x1="324" y1="146" x2="309" y2="150" stroke="#ff3344" strokeWidth="3" className="animate-pulse" />
          <line x1="328" y1="175" x2="312" y2="175" stroke="#ff3344" strokeWidth="5" className="animate-pulse" />

          <path
            d="M 281 77 A 125 125 0 0 1 328 175"
            fill="none"
            stroke="#ff3344"
            strokeWidth="3"
            strokeDasharray="4 3"
            opacity="0.85"
          />

          {/* Sweeping Needle */}
          <g
            className={!isManualProgress ? "animate-tacho-needle-continuous origin-[200px_175px]" : "origin-[200px_175px] transition-transform duration-150"}
            style={isManualProgress ? { transform: `rotate(${needleAngle}deg)` } : undefined}
          >
            <polygon points="196,175 204,175 201,55 199,55" fill="#ffffff" />
            <polygon points="198,175 202,175 200,52 200,52" fill="#00d2ff" opacity="0.8" />
            <circle cx="200" cy="175" r="14" fill="#0b0f19" stroke="#ffffff" strokeWidth="3" />
            <circle cx="200" cy="175" r="6" fill="#00d2ff" />
          </g>

          {/* Official Banner: MUNDO DE ACCESORIOS */}
          {showLogoText ? (
            <g transform="translate(0, 15)">
              <polygon
                points="15,160 385,160 375,208 5,208"
                fill="#000000"
                stroke="#ffffff"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              <text
                x="195"
                y="196"
                fontFamily="'Outfit', sans-serif"
                fontWeight="900"
                fontStyle="italic"
                fontSize="34"
                fill="url(#yellowLogoGrad)"
                textAnchor="middle"
                letterSpacing="0.5px"
                style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.8))" }}
              >
                MUNDO DE ACCESORIOS
              </text>
              <rect
                x="58"
                y="209"
                width="274"
                height="20"
                rx="10"
                fill="#000000"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <text
                x="195"
                y="223"
                fontFamily="'Outfit', sans-serif"
                fontWeight="600"
                fontSize="11.5"
                fill="#ffffff"
                textAnchor="middle"
                letterSpacing="0.2px"
              >
                Accesorios para todo tipo de vehículo
              </text>
            </g>
          ) : null}
        </svg>
      </div>

      {/* Status Texts & Progress Bar */}
      <div className="mt-4 flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-1 text-sm sm:text-base font-bold text-sky-400">
          <span>{statusText}</span>
          <span className="inline-flex">
            <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
          </span>
        </div>

        <div className="font-mono text-xs text-slate-400 tracking-wider">
          {computedRpmText}
        </div>

        {showProgressBar ? (
          <div className="mt-2 h-1.5 w-48 sm:w-56 overflow-hidden rounded-full bg-white/10 border border-white/5">
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r from-sky-400 via-yellow-400 to-red-500 shadow-[0_0_8px_rgba(0,210,255,0.8)]",
                !isManualProgress ? "animate-tacho-progress-continuous" : "transition-all duration-150"
              )}
              style={isManualProgress ? { width: `${clampedProgress}%` } : undefined}
            />
          </div>
        ) : null}
      </div>
    </div>
  );

  if (variant === "fullscreen") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xl animate-fade-in">
        {content}
      </div>
    );
  }

  return content;
}
